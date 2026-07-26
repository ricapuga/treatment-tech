import { sql } from "drizzle-orm";
import { withTenant, type Tx } from "./db/rls";

export type AuditAction =
  | "login"
  | "logout"
  | "view_dashboard"
  | "view_case"
  | "create_patient"
  | "create_case"
  | "update_case"
  | "sign_document"
  | "void_document"
  | "generate_pdf"
  | "download_pdf"
  | "create_ledger_entry"
  | "void_ledger_entry";

interface AuditEntry {
  tenantId: string;
  userId: string | null;
  action: AuditAction | (string & {});
  entity: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
  ip?: string | null;
}

/**
 * Regla no negociable #4 del blueprint: toda mutación y toda lectura de expediente
 * escribe en audit_log, sin excepciones. audit_log es INSERT-only (REVOKE UPDATE,
 * DELETE aplicado en drizzle/sql/0001_rls_and_roles.sql) — ni siquiera app_user puede
 * alterar un registro después de escrito.
 *
 * Debe correr DENTRO de la misma transacción con tenant que la operación que audita,
 * para que un rollback de la operación también revierta el registro de auditoría
 * (evita bitácoras huérfanas de operaciones que en realidad fallaron). Por eso existe
 * `recordAuditTx` (recibe una tx ya abierta, mismo patrón que
 * `assignCaseNumberTx` en lib/rules/case-number.ts) para flujos que ya están dentro de
 * un `withTenant()` — ej. crear paciente+caso+etapas en una sola transacción y que la
 * entrada de auditoría viva o muera con esa misma transacción. `recordAudit` sigue
 * disponible para el caso de uso aislado (login/logout, donde no hay otra operación
 * con la que compartir transacción).
 */
export async function recordAuditTx(tx: Tx, entry: AuditEntry) {
  await tx.execute(sql`
    INSERT INTO audit_log (tenant_id, user_id, action, entity, entity_id, details, ip)
    VALUES (
      ${entry.tenantId}::uuid,
      ${entry.userId}::uuid,
      ${entry.action},
      ${entry.entity},
      ${entry.entityId ?? null},
      ${JSON.stringify(entry.details ?? {})}::jsonb,
      ${entry.ip ?? null}::inet
    )
  `);
}

export async function recordAudit(entry: AuditEntry) {
  return withTenant(entry.tenantId, (tx) => recordAuditTx(tx, entry));
}
