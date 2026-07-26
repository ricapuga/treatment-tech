"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { requireSession } from "../session";
import { withTenant } from "../db/rls";
import { schema } from "../db/client";
import { recordAuditTx } from "../audit";
import { canAccessClinicalDocuments } from "../rbac";

/**
 * Motor de formularios (blueprint M2 paso 7 / M3): guardar borrador y completar un
 * documento. La curación real de contenido clínico (Forms 1-7, Assessment, etc.) es
 * un paso aparte con Jorge — esto es la plomería que cualquier schema futuro reutiliza.
 *
 * RBAC (Gate M2: "front_desk NO puede abrir el documento de intake clínico forms_1_7
 * de contenido clínico ni sus datos (403)"): front_desk y billing quedan fuera de
 * cualquier documento de expediente clínico — solo counselor+ puede leer o escribir.
 * `canAccessClinicalDocuments` vive en `lib/rbac.ts` (no aquí) porque este archivo es
 * "use server": Next.js exige que TODO export de un módulo así sea una Server Action
 * async — un helper síncrono aquí rompe el build en cuanto algo fuera de una acción
 * lo importa (ver comentario completo en rbac.ts).
 */
export type DocumentState = { error: string | null };

const saveDraftSchema = z.object({
  caseId: z.string().uuid(),
  schemaKey: z.string().min(1),
  schemaVersion: z.coerce.number().int().positive(),
  data: z.string(), // JSON.stringify del formulario — se parsea y valida abajo
});

export async function saveDraftDocument(
  _prevState: DocumentState,
  formData: FormData
): Promise<DocumentState> {
  const parsed = saveDraftSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "invalid_form" };
  }
  const input = parsed.data;

  let dataObj: Record<string, unknown>;
  try {
    dataObj = JSON.parse(input.data);
  } catch {
    return { error: "invalid_json" };
  }

  const session = await requireSession();
  if (!canAccessClinicalDocuments(session.role)) {
    // Gate M2: acceso restringido responde error explícito, no un 500 ni un guardado
    // silencioso a medias. El límite HTTP real (403 de verdad) lo aplica el llamador
    // si expone esto detrás de una ruta — ver nota en el page.tsx del motor.
    return { error: "forbidden" };
  }

  try {
    await withTenant(session.tenantId, async (tx) => {
      const existing = await tx
        .select({ id: schema.documents.id, status: schema.documents.status })
        .from(schema.documents)
        .where(
          and(
            eq(schema.documents.caseId, input.caseId),
            eq(schema.documents.schemaKey, input.schemaKey)
          )
        )
        .limit(1);

      if (existing[0]?.status === "signed") {
        // Regla no negociable (CLAUDE.md): documento signed es inmutable.
        throw new Error("document_signed_immutable");
      }

      if (existing[0]) {
        await tx
          .update(schema.documents)
          .set({ data: dataObj, updatedAt: new Date() })
          .where(eq(schema.documents.id, existing[0].id));
      } else {
        await tx.insert(schema.documents).values({
          tenantId: session.tenantId,
          caseId: input.caseId,
          schemaKey: input.schemaKey,
          schemaVersion: input.schemaVersion,
          data: dataObj,
          status: "draft",
          createdBy: session.userId,
        });
      }
      // Autosave de borrador: NO se audita cada tecleo (sería ruido puro en la
      // bitácora) — solo se audita al completar. Ver completeDocument().
    });
  } catch (err) {
    console.error("saveDraftDocument failed", err);
    return { error: "server_error" };
  }

  return { error: null };
}

const completeSchema = z.object({
  caseId: z.string().uuid(),
  schemaKey: z.string().min(1),
});

export async function completeDocument(
  _prevState: DocumentState,
  formData: FormData
): Promise<DocumentState> {
  const parsed = completeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "invalid_form" };
  }
  const input = parsed.data;

  const session = await requireSession();
  if (!canAccessClinicalDocuments(session.role)) {
    return { error: "forbidden" };
  }

  try {
    await withTenant(session.tenantId, async (tx) => {
      const rows = await tx
        .select({ id: schema.documents.id, status: schema.documents.status })
        .from(schema.documents)
        .where(
          and(
            eq(schema.documents.caseId, input.caseId),
            eq(schema.documents.schemaKey, input.schemaKey)
          )
        )
        .limit(1);
      const doc = rows[0];
      if (!doc) throw new Error("document_not_found");
      if (doc.status === "signed") throw new Error("document_signed_immutable");

      await tx
        .update(schema.documents)
        .set({ status: "completed", completedBy: session.userId, completedAt: new Date() })
        .where(eq(schema.documents.id, doc.id));

      await recordAuditTx(tx, {
        tenantId: session.tenantId,
        userId: session.userId,
        action: "update_case",
        entity: "documents",
        entityId: doc.id,
        details: { schemaKey: input.schemaKey, status: "completed" },
      });
    });
  } catch (err) {
    console.error("completeDocument failed", err);
    return { error: "server_error" };
  }

  return { error: null };
}
