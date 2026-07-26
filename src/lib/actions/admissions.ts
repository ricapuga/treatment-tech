"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { requireSession } from "../session";
import { withTenant } from "../db/rls";
import { schema } from "../db/client";
import { assignCaseNumberTx } from "../rules/case-number";
import { getRequiredPrograms, UnresolvedLOIError } from "../rules/loi";
import { CASE_STAGE_ORDER } from "../rules/case-stages";
import { recordAuditTx } from "../audit";

/**
 * Admisión (Milestone 2, blueprint pasos 3-4): crear paciente + caso + case_number
 * (RN-1) + etapas iniciales (case_stages) en UNA sola transacción con tenant fijado —
 * si cualquier paso falla (incluido un LOI sin mapeo resuelto en RN-2), nada queda a
 * medias: ni paciente huérfano, ni número de caso consumido de más.
 *
 * Validación con Zod en el límite de la Server Action, como exige CLAUDE.md — nunca
 * confiar en los tipos del formulario.
 */
const admissionSchema = z.object({
  firstName: z.string().trim().min(1, "required"),
  lastName: z.string().trim().min(1, "required"),
  dob: z.string().trim().min(1, "required"),
  driversLicense: z.string().trim().optional(),
  language: z.string().trim().optional(),
  locationId: z.string().uuid("invalid_location"),
  admissionDate: z.string().trim().min(1, "required"),
  referralSource: z.string().trim().optional(),
  county: z.string().trim().optional(),
  loi: z.string().trim().min(1, "required"),
  counselorId: z
    .union([z.string().uuid(), z.literal("")])
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export type AdmissionState = { error: string | null };

export async function createAdmission(
  _prevState: AdmissionState,
  formData: FormData
): Promise<AdmissionState> {
  const parsed = admissionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "invalid_form" };
  }
  const input = parsed.data;

  // RN-2: validar el LOI ANTES de tocar la base de datos — más barato que hacerlo
  // fallar a medio camino de la transacción, y el mensaje es más claro para quien
  // está en el formulario.
  try {
    getRequiredPrograms(input.loi);
  } catch (err) {
    if (err instanceof UnresolvedLOIError) {
      return { error: err.message };
    }
    throw err;
  }

  const session = await requireSession();
  const admissionDate = new Date(input.admissionDate);

  let caseId: string;
  try {
    caseId = await withTenant(session.tenantId, async (tx) => {
      const [patient] = await tx
        .insert(schema.patients)
        .values({
          tenantId: session.tenantId,
          firstName: input.firstName,
          lastName: input.lastName,
          dob: input.dob,
          driversLicense: input.driversLicense || null,
          language: input.language || null,
        })
        .returning();

      const caseNumber = await assignCaseNumberTx(tx, session.tenantId, admissionDate);

      const [createdCase] = await tx
        .insert(schema.cases)
        .values({
          tenantId: session.tenantId,
          locationId: input.locationId,
          patientId: patient.id,
          caseNumber,
          admissionDate: input.admissionDate,
          referralSource: input.referralSource || null,
          county: input.county || null,
          loi: input.loi,
          counselorId: input.counselorId ?? null,
          // requiredHours / requiredCcMonths: RN-2 da un RANGO por bloque de programa
          // (RE/EI/OP), no un valor único de caso — no se inventa aquí un total; se
          // fija por programa cuando el hub de horas (M3) exista. Los programas
          // requeridos se derivan de `loi` on-demand vía getRequiredPrograms(), nunca
          // se duplican como columna.
        })
        .returning();

      await tx.insert(schema.caseStages).values(
        CASE_STAGE_ORDER.map((stage, i) => ({
          caseId: createdCase.id,
          stage,
          status: i === 0 ? ("in_progress" as const) : ("pending" as const),
        }))
      );

      await recordAuditTx(tx, {
        tenantId: session.tenantId,
        userId: session.userId,
        action: "create_case",
        entity: "cases",
        entityId: createdCase.id,
        details: { caseNumber, loi: input.loi },
      });

      return createdCase.id;
    });
  } catch (err) {
    console.error("createAdmission failed", err);
    return { error: "server_error" };
  }

  redirect(`/cases/${caseId}`);
}
