"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireSession } from "../session";
import { withTenant } from "../db/rls";
import { schema } from "../db/client";
import { recordAuditTx } from "../audit";

/**
 * Ledger manual (blueprint M2 paso 9): cargos/pagos/ajustes a mano, con las
 * validaciones que el Gate M2 pide explícitamente ("no pagos negativos, void con
 * motivo"). El saldo NUNCA se calcula ni se guarda aquí — RN-5 vive solo en la vista
 * `case_balances` (SQL crudo); estas acciones únicamente insertan/marcan movimientos.
 */

const MONEY = z
  .string()
  .trim()
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "invalid_amount")
  .transform((v) => Math.round(Number(v) * 100));

const createEntrySchema = z.object({
  caseId: z.string().uuid(),
  kind: z.enum(["charge", "payment", "adjustment"]),
  amount: MONEY,
  method: z.enum(["cash", "check", "card_terminal", "stripe"]),
  service: z.string().trim().optional(),
  entryDate: z.string().trim().min(1, "required"),
});

export type LedgerEntryState = { error: string | null };

export async function createLedgerEntry(
  _prevState: LedgerEntryState,
  formData: FormData
): Promise<LedgerEntryState> {
  const parsed = createEntrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "invalid_form" };
  }
  const input = parsed.data;

  // "No pagos negativos" (Gate M2): amount ya viene validado como número positivo por
  // el regex de MONEY (no acepta signo). Un monto de $0 tampoco tiene sentido como
  // movimiento — se rechaza aquí, no en el schema, para que el mensaje sea claro.
  if (input.amount <= 0) {
    return { error: "amount_must_be_positive" };
  }

  const session = await requireSession();

  try {
    await withTenant(session.tenantId, async (tx) => {
      const [entry] = await tx
        .insert(schema.ledgerEntries)
        .values({
          tenantId: session.tenantId,
          caseId: input.caseId,
          entryDate: input.entryDate,
          service: input.service || null,
          kind: input.kind,
          amountCents: input.amount,
          method: input.method,
          recordedBy: session.userId,
        })
        .returning();

      await recordAuditTx(tx, {
        tenantId: session.tenantId,
        userId: session.userId,
        action: "create_ledger_entry",
        entity: "ledger_entries",
        entityId: entry.id,
        details: { kind: input.kind, amountCents: input.amount, caseId: input.caseId },
      });
    });
  } catch (err) {
    console.error("createLedgerEntry failed", err);
    return { error: "server_error" };
  }

  revalidatePath(`/cases/${input.caseId}/ledger`);
  revalidatePath(`/cases/${input.caseId}`);
  return { error: null };
}

const voidEntrySchema = z.object({
  caseId: z.string().uuid(),
  entryId: z.string().uuid(),
  reason: z.string().trim().min(3, "reason_required"),
});

export async function voidLedgerEntry(
  _prevState: LedgerEntryState,
  formData: FormData
): Promise<LedgerEntryState> {
  const parsed = voidEntrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "invalid_form" };
  }
  const input = parsed.data;
  const session = await requireSession();

  try {
    await withTenant(session.tenantId, async (tx) => {
      const rows = await tx
        .select({ id: schema.ledgerEntries.id, voided: schema.ledgerEntries.voided })
        .from(schema.ledgerEntries)
        .where(eq(schema.ledgerEntries.id, input.entryId))
        .limit(1);
      const existing = rows[0];
      if (!existing) throw new Error("ledger entry not found");
      if (existing.voided) throw new Error("ledger entry already voided");

      await tx
        .update(schema.ledgerEntries)
        .set({ voided: true })
        .where(eq(schema.ledgerEntries.id, input.entryId));

      // El motivo ("void con motivo", Gate M2) vive en audit_log.details — no hay
      // columna de razón en ledger_entries (ni en el blueprint ni en el schema): la
      // bitácora inmutable es el lugar correcto para un dato de auditoría como este,
      // no una columna mutable más en la tabla de negocio.
      await recordAuditTx(tx, {
        tenantId: session.tenantId,
        userId: session.userId,
        action: "void_ledger_entry",
        entity: "ledger_entries",
        entityId: input.entryId,
        details: { reason: input.reason, caseId: input.caseId },
      });
    });
  } catch (err) {
    console.error("voidLedgerEntry failed", err);
    return { error: "server_error" };
  }

  revalidatePath(`/cases/${input.caseId}/ledger`);
  revalidatePath(`/cases/${input.caseId}`);
  return { error: null };
}
