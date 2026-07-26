import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";

/**
 * Gate M2 (blueprint Sección 12): "Saldo correcto en escenario tabla: cargo $1,500;
 * pagos $500+$300 → saldo $700 (test automatizado)." Más el caso de un movimiento
 * anulado: NO debe contar en el saldo (RN-5 + "void con motivo").
 *
 * Mismo patrón que tests/rls.test.ts: conecta como app_user con SET LOCAL
 * app.tenant_id real, porque lo que se prueba es la vista `case_balances` (SQL
 * crudo) tal como la usa la app — no una versión simplificada del cálculo.
 */
const ownerUrl = process.env.TEST_DATABASE_URL_OWNER;
const appUserUrl = process.env.TEST_DATABASE_URL_APP_USER;
const skip = !ownerUrl || !appUserUrl;

describe.skipIf(skip)("case_balances: RN-5 (Gate M2)", () => {
  const ownerPool = new Pool({ connectionString: ownerUrl });
  const appPool = new Pool({ connectionString: appUserUrl });

  let tenantId: string;
  let caseId: string;

  beforeAll(async () => {
    const t = await ownerPool.query(
      `INSERT INTO tenants (name) VALUES ('Ledger Test Tenant') RETURNING id`
    );
    tenantId = t.rows[0].id;

    const loc = await ownerPool.query(
      `INSERT INTO locations (tenant_id, name) VALUES ($1, 'Test Location') RETURNING id`,
      [tenantId]
    );
    const patient = await ownerPool.query(
      `INSERT INTO patients (tenant_id, first_name, last_name, dob)
       VALUES ($1, 'Ledger', 'Test', '1990-01-01') RETURNING id`,
      [tenantId]
    );
    const kase = await ownerPool.query(
      `INSERT INTO cases (tenant_id, location_id, patient_id, case_number, admission_date)
       VALUES ($1, $2, $3, '999TST26', '2026-07-26') RETURNING id`,
      [tenantId, loc.rows[0].id, patient.rows[0].id]
    );
    caseId = kase.rows[0].id;
  });

  afterAll(async () => {
    await ownerPool.query(`DELETE FROM ledger_entries WHERE tenant_id = $1`, [tenantId]);
    await ownerPool.query(`DELETE FROM cases WHERE id = $1`, [caseId]);
    await ownerPool.query(`DELETE FROM patients WHERE tenant_id = $1`, [tenantId]);
    await ownerPool.query(`DELETE FROM locations WHERE tenant_id = $1`, [tenantId]);
    await ownerPool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]);
    await ownerPool.end();
    await appPool.end();
  });

  it("cargo $1,500; pagos $500+$300 → saldo $700", async () => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);

      await client.query(
        `INSERT INTO ledger_entries (tenant_id, case_id, entry_date, kind, amount_cents, method)
         VALUES ($1, $2, '2026-07-26', 'charge', 150000, 'cash')`,
        [tenantId, caseId]
      );
      await client.query(
        `INSERT INTO ledger_entries (tenant_id, case_id, entry_date, kind, amount_cents, method)
         VALUES ($1, $2, '2026-07-26', 'payment', 50000, 'cash')`,
        [tenantId, caseId]
      );
      await client.query(
        `INSERT INTO ledger_entries (tenant_id, case_id, entry_date, kind, amount_cents, method)
         VALUES ($1, $2, '2026-07-26', 'payment', 30000, 'cash')`,
        [tenantId, caseId]
      );

      const result = await client.query(
        `SELECT balance_cents FROM case_balances WHERE case_id = $1`,
        [caseId]
      );
      expect(Number(result.rows[0].balance_cents)).toBe(70000);
      await client.query("COMMIT");
    } finally {
      client.release();
    }
  });

  it("un pago anulado no cuenta en el saldo", async () => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);

      const voided = await client.query(
        `INSERT INTO ledger_entries (tenant_id, case_id, entry_date, kind, amount_cents, method)
         VALUES ($1, $2, '2026-07-26', 'payment', 20000, 'cash') RETURNING id`,
        [tenantId, caseId]
      );
      await client.query(`UPDATE ledger_entries SET voided = true WHERE id = $1`, [
        voided.rows[0].id,
      ]);

      // Saldo sigue en $700 (70000) — el pago anulado de $200 NO debe restarse dos
      // veces ni contarse: 150000 - 50000 - 30000 - 0(anulado) = 70000.
      const result = await client.query(
        `SELECT balance_cents FROM case_balances WHERE case_id = $1`,
        [caseId]
      );
      expect(Number(result.rows[0].balance_cents)).toBe(70000);
      await client.query("COMMIT");
    } finally {
      client.release();
    }
  });
});
