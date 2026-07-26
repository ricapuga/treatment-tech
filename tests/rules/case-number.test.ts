import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import {
  computePeriod,
  formatCaseNumber,
  CASE_NUMBER_SEQ_SQL_TEXT,
} from "@/lib/rules/case-number";

describe("RN-1: formato de número de caso (puro, sin DB)", () => {
  it("computePeriod: enero 2026 -> JAN26", () => {
    expect(computePeriod(new Date(Date.UTC(2026, 0, 15)))).toBe("JAN26");
  });

  it("computePeriod: diciembre 2026 -> DEC26", () => {
    expect(computePeriod(new Date(Date.UTC(2026, 11, 1)))).toBe("DEC26");
  });

  it("formatCaseNumber: seq=1 -> 001JAN26", () => {
    expect(formatCaseNumber(1, "JAN26")).toBe("001JAN26");
  });

  it("formatCaseNumber: seq=42 -> 042JAN26 (LPAD a 3 dígitos)", () => {
    expect(formatCaseNumber(42, "JAN26")).toBe("042JAN26");
  });

  it("formatCaseNumber: seq=100 -> 100JAN26 (no trunca al llegar a 3 dígitos)", () => {
    expect(formatCaseNumber(100, "JAN26")).toBe("100JAN26");
  });
});

const ownerUrl = process.env.TEST_DATABASE_URL_OWNER;
const skip = !ownerUrl;

describe.skipIf(skip)("RN-1: secuencia transaccional contra Postgres real (Gate M2, adelantado)", () => {
  const pool = new Pool({ connectionString: ownerUrl });
  let tenantId: string;

  beforeAll(async () => {
    const t = await pool.query(`INSERT INTO tenants (name) VALUES ('Case Number Test Tenant') RETURNING id`);
    tenantId = t.rows[0].id;
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM case_number_seq WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]);
    await pool.end();
  });

  it("primera asignación del mes empieza en 1", async () => {
    const res = await pool.query(CASE_NUMBER_SEQ_SQL_TEXT, [tenantId, "FEBTEST"]);
    expect(res.rows[0].next_val).toBe(1);
  });

  it("asignaciones secuenciales no se repiten ni saltan (10 llamadas seguidas)", async () => {
    const values: number[] = [];
    for (let i = 0; i < 10; i++) {
      const res = await pool.query(CASE_NUMBER_SEQ_SQL_TEXT, [tenantId, "MARTEST"]);
      values.push(res.rows[0].next_val);
    }
    expect(values).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("concurrencia: 5 asignaciones disparadas en paralelo no duplican ni dejan huecos", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => pool.query(CASE_NUMBER_SEQ_SQL_TEXT, [tenantId, "APRTEST"]))
    );
    const values = results.map((r) => r.rows[0].next_val).sort((a, b) => a - b);
    expect(values).toEqual([1, 2, 3, 4, 5]);
  });

  it("tenants distintos no comparten secuencia aunque sea el mismo period", async () => {
    const t2 = await pool.query(`INSERT INTO tenants (name) VALUES ('Case Number Test Tenant 2') RETURNING id`);
    const tenantId2 = t2.rows[0].id;
    try {
      const resA = await pool.query(CASE_NUMBER_SEQ_SQL_TEXT, [tenantId, "MAYTEST"]);
      const resB = await pool.query(CASE_NUMBER_SEQ_SQL_TEXT, [tenantId2, "MAYTEST"]);
      expect(resA.rows[0].next_val).toBe(1);
      expect(resB.rows[0].next_val).toBe(1); // tenant distinto, mismo period -> también empieza en 1
    } finally {
      await pool.query(`DELETE FROM case_number_seq WHERE tenant_id = $1`, [tenantId2]);
      await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId2]);
    }
  });
});
