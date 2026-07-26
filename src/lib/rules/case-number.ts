import { sql } from "drizzle-orm";
import { withTenant, type Tx } from "../db/rls";

/**
 * RN-1 (blueprint Sección 7) — número de caso: secuencia mensual por tenant,
 * formato `0XX+MON+YY` (ej. 001JAN26), transaccional, sin huecos ni duplicados.
 *
 * Por qué `case_number_seq` es una TABLA y no un SEQUENCE nativo de Postgres:
 * un SEQUENCE nativo consume el número aunque la transacción haga rollback (no es
 * transaccional por diseño, es más rápido a costa de eso) — eso sí deja huecos.
 * Una fila de tabla con INSERT ... ON CONFLICT DO UPDATE participa en la transacción
 * normal: si la transacción que crea el caso falla y hace rollback, el incremento
 * también se revierte. Es más lento bajo concurrencia alta, pero a la escala de una
 * clínica (decenas de casos al mes) es irrelevante y la garantía de "sin huecos" vale
 * más que la velocidad.
 *
 * CASE_NUMBER_SEQ_SQL_TEXT (con placeholders $1/$2, forma "cruda") existe para que
 * tests/rules/case-number.test.ts pueda ejercer la MISMA sentencia contra Postgres
 * local vía el driver `pg` genérico (el driver de Neon vía WebSocket no habla con
 * Postgres local sin un proxy — ver PROGRESS.md). El código de producción de abajo
 * usa el `sql` tag de drizzle (parametrizado de forma segura) con el mismo texto —
 * si cambia uno, cambiar el otro.
 */

const MONTH_ABBR = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
] as const;

export function computePeriod(date: Date): string {
  const mon = MONTH_ABBR[date.getUTCMonth()];
  const yy = String(date.getUTCFullYear()).slice(-2);
  return `${mon}${yy}`;
}

export function formatCaseNumber(seq: number, period: string): string {
  return `${String(seq).padStart(3, "0")}${period}`;
}

// Forma cruda (placeholders $1=tenant_id, $2=period), usada por el test contra `pg`.
// MANTENER EN SINCRONÍA con el `sql` tag de assignCaseNumber() más abajo.
export const CASE_NUMBER_SEQ_SQL_TEXT = `
  INSERT INTO case_number_seq (tenant_id, period, next_val)
  VALUES ($1, $2, 1)
  ON CONFLICT (tenant_id, period)
  DO UPDATE SET next_val = case_number_seq.next_val + 1
  RETURNING next_val
`;

/**
 * Forma "componible": recibe una transacción YA ABIERTA (con app.tenant_id ya fijado
 * por withTenant()) en vez de abrir la suya propia. Existe para que flujos que crean
 * más de una fila relacionada (ej. admisión: paciente + caso + case_number + etapas)
 * lo hagan en UNA sola transacción real — si cualquier paso falla, todo revierte,
 * incluido el incremento de la secuencia. Nunca llamar dos veces (una por
 * assignCaseNumber() y otra por acá) para el mismo caso: se consumiría un número de
 * más. `assignCaseNumber()` de abajo es un envoltorio de conveniencia para el caso
 * de uso aislado (ej. los tests) y usa esta misma función por dentro.
 */
export async function assignCaseNumberTx(
  tx: Tx,
  tenantId: string,
  admissionDate: Date
): Promise<string> {
  const period = computePeriod(admissionDate);

  // Mismo statement que CASE_NUMBER_SEQ_SQL_TEXT, vía el tag `sql` de drizzle:
  // los valores se parametrizan de forma segura (nunca interpolación de string).
  const result = await tx.execute(sql`
    INSERT INTO case_number_seq (tenant_id, period, next_val)
    VALUES (${tenantId}::uuid, ${period}, 1)
    ON CONFLICT (tenant_id, period)
    DO UPDATE SET next_val = case_number_seq.next_val + 1
    RETURNING next_val
  `);
  const rows = (result as unknown as { rows: Array<{ next_val: number }> }).rows;
  const seq = rows[0].next_val;
  return formatCaseNumber(seq, period);
}

export async function assignCaseNumber(tenantId: string, admissionDate: Date): Promise<string> {
  return withTenant(tenantId, (tx) => assignCaseNumberTx(tx, tenantId, admissionDate));
}
