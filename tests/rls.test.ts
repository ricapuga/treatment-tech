import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";

/**
 * Gate M1, checklist ítem 4 (blueprint Sección 12): "Test SQL de RLS conectado como
 * app_user: con SET LOCAL app.tenant_id de un tenant ajeno, SELECT * FROM patients
 * devuelve 0 filas; conectado como owner el test NO cuenta."
 *
 * Usa `pg` (driver estándar de Postgres) en vez de `@neondatabase/serverless` porque
 * este test corre contra Postgres local (ver PROGRESS.md — validación de M1 antes de
 * tener cuenta de Neon real). La mecánica que se prueba aquí (transacción + SET LOCAL +
 * policy) es protocolo estándar de Postgres, no específico de un driver: si pasa aquí,
 * la misma secuencia de statements funciona igual a través de drizzle-orm/neon-serverless
 * en producción (src/lib/db/rls.ts). Este test no reemplaza probarlo contra Neon real
 * antes de go-live — solo confirma que la POLICY en sí es correcta.
 *
 * Requiere TEST_DATABASE_URL_OWNER (para sembrar los tenants/pacientes de prueba) y
 * TEST_DATABASE_URL_APP_USER (conexión como app_user, la que realmente se audita).
 */

const ownerUrl = process.env.TEST_DATABASE_URL_OWNER;
const appUserUrl = process.env.TEST_DATABASE_URL_APP_USER;

const skip = !ownerUrl || !appUserUrl;

describe.skipIf(skip)("RLS: aislamiento por tenant (Gate M1)", () => {
  const ownerPool = new Pool({ connectionString: ownerUrl });
  const appPool = new Pool({ connectionString: appUserUrl });

  let tenantA: string;
  let tenantB: string;

  beforeAll(async () => {
    // Fixtures de prueba — dos tenants ficticios, uno con un paciente cada uno.
    // NO tocan el tenant real de Archer sembrado por scripts/seed.ts.
    const t1 = await ownerPool.query(
      `INSERT INTO tenants (name) VALUES ('RLS Test Tenant A') RETURNING id`
    );
    const t2 = await ownerPool.query(
      `INSERT INTO tenants (name) VALUES ('RLS Test Tenant B') RETURNING id`
    );
    tenantA = t1.rows[0].id;
    tenantB = t2.rows[0].id;

    await ownerPool.query(
      `INSERT INTO patients (tenant_id, first_name, last_name, dob) VALUES ($1, 'Paciente', 'DeA', '1990-01-01')`,
      [tenantA]
    );
    await ownerPool.query(
      `INSERT INTO patients (tenant_id, first_name, last_name, dob) VALUES ($1, 'Paciente', 'DeB', '1990-01-01')`,
      [tenantB]
    );
  });

  afterAll(async () => {
    // Limpieza — owner sí puede DELETE (bypassea RLS por ser superusuario en este dev DB).
    await ownerPool.query(`DELETE FROM patients WHERE tenant_id IN ($1, $2)`, [tenantA, tenantB]);
    await ownerPool.query(`DELETE FROM tenants WHERE id IN ($1, $2)`, [tenantA, tenantB]);
    await ownerPool.end();
    await appPool.end();
  });

  it("con SET LOCAL del tenant propio, ve solo su paciente", async () => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantA]);
      const res = await client.query("SELECT * FROM patients");
      expect(res.rows).toHaveLength(1);
      expect(res.rows[0].last_name).toBe("DeA");
      await client.query("COMMIT");
    } finally {
      client.release();
    }
  });

  it("con SET LOCAL de un tenant ajeno, patients devuelve 0 filas (no un error)", async () => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      // Fijamos el tenant A pero consultamos esperando NO ver nada de B.
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantA]);
      const res = await client.query(
        "SELECT * FROM patients WHERE last_name = 'DeB'"
      );
      expect(res.rows).toHaveLength(0);
      await client.query("COMMIT");
    } finally {
      client.release();
    }
  });

  it("SET LOCAL no persiste fuera de su transacción (mecánica de pooling)", async () => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantA]);
      await client.query("COMMIT");

      // Nueva transacción, MISMA conexión física, SIN volver a fijar tenant_id:
      // current_setting debe volver a estar vacío — confirma que SET LOCAL realmente
      // se limita a la transacción anterior y no se filtra a la siguiente.
      await client.query("BEGIN");
      const res = await client.query(
        "SELECT current_setting('app.tenant_id', true) AS tid"
      );
      expect(res.rows[0].tid).toBeFalsy();
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("sin tenant_id fijado, patients devuelve 0 filas (fail-closed, no fail-open)", async () => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      const res = await client.query("SELECT * FROM patients");
      expect(res.rows).toHaveLength(0);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("conectado como owner (superusuario), RLS no aplica — documentado, no es el gate real", async () => {
    // Este resultado es ESPERADO y es precisamente el motivo por el que la app nunca
    // debe conectarse como owner (ver src/lib/db/client.ts). No es el check que cuenta
    // para el gate — se deja aquí solo para dejar el contraste documentado y visible.
    const res = await ownerPool.query("SELECT * FROM patients");
    expect(res.rows.length).toBeGreaterThanOrEqual(2);
  });
});

if (skip) {
  describe("RLS: aislamiento por tenant (Gate M1)", () => {
    it.skip("saltado: define TEST_DATABASE_URL_OWNER y TEST_DATABASE_URL_APP_USER para correr este gate", () => {});
  });
}
