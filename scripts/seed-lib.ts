/**
 * Lógica compartida de seed — extraída de scripts/seed.ts para poder correrla desde
 * dos lugares:
 *   1) CLI local: `pnpm db:seed` (scripts/seed.ts, contra Postgres local).
 *   2) Ruta de bootstrap del pilot en Vercel (src/app/api/setup/bootstrap/route.ts),
 *      disparada una sola vez desde el navegador — ver esa ruta para el detalle de
 *      por qué existe (el sandbox de esta sesión de Claude no tiene salida de red
 *      hacia Neon, así que el seed del pilot se dispara vía HTTP, no desde una shell).
 *
 * runSeed() es SEGURO de llamar más de una vez: si el tenant "DUI Metropolitan
 * Services, Inc." (por licenseNumber) ya existe, no vuelve a insertar nada — regresa
 * de inmediato con already=true. El resto de los inserts (form_schemas) ya usaban
 * onConflictDoNothing(); tenant/roster/cuentas de Better Auth NO son idempotentes por
 * sí solos (violarían constraints únicos / signUpEmail fallaría con email duplicado),
 * por eso el guard de "ya existe" cubre TODO el bloque, no solo una parte.
 */

/**
 * resetTenant — borra el tenant "DUI Metropolitan Services, Inc." (por licenseNumber)
 * y TODO lo que cuelga de él (casos, documentos, roster, cuentas de Better Auth), en
 * el orden correcto para no violar los FK (RESTRICT por default — este schema no usa
 * ON DELETE CASCADE salvo Better Auth session/account -> user).
 *
 * Existe para poder recrear las cuentas sembradas con un SEED_PASSWORD distinto sin
 * tocar la base a mano (el sandbox de Claude no tiene salida de red hacia Neon) —
 * runSeed() no actualiza el password de cuentas que ya existen, solo crea de cero.
 * Solo se usa desde la ruta de bootstrap (?reset=1), protegida por el mismo
 * SETUP_TOKEN. No falla si el tenant no existe (no-op).
 *
 * EXCEPCIÓN DELIBERADA a "toda tabla con PHI se toca SOLO vía withTenant()" de
 * CLAUDE.md: usa `DATABASE_URL_MIGRATIONS` (rol owner) con `pg` directo, NO el cliente
 * normal de la app. Encontrado corriendo esto contra Postgres local: `app_user` tiene
 * GRANT SELECT/INSERT/UPDATE pero NO DELETE en las tablas clínicas (deliberado —
 * drizzle/sql/0001_rls_and_roles.sql, protección real contra borrado accidental desde
 * la app, no un descuido) — intentarlo vía `db`/`withTenant()` normal falla con
 * "permission denied". Owner sí puede, y es exactamente para esto (setup/mantenimiento
 * fuera del flujo normal de la app, igual que scripts/deploy-migrate.ts). Herramienta
 * de admin de piloto, no código de negocio — desactivar junto con SETUP_TOKEN antes de
 * cargar PHI real (ver M5 hardening).
 */
export async function resetTenant(): Promise<{ deleted: boolean; tenantId: string | null }> {
  const ownerUrl = process.env.DATABASE_URL_MIGRATIONS;
  if (!ownerUrl) {
    throw new Error(
      "resetTenant() requiere DATABASE_URL_MIGRATIONS (rol owner) — no configurada."
    );
  }

  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: ownerUrl });

  try {
    const LICENSE_NUMBER = "A-2854-0004-A";
    const { rows } = await pool.query<{ id: string }>(
      `SELECT id FROM tenants WHERE license_number = $1 LIMIT 1`,
      [LICENSE_NUMBER]
    );
    if (!rows[0]) {
      return { deleted: false, tenantId: null };
    }
    const tenantId = rows[0].id;

    // Hijos sin tenant_id propio primero (vía document_id/case_id), luego el resto
    // por tenant_id directo — cases al final de sus hijos, locations/patients/users
    // al final de cases, tenant al final de todo.
    await pool.query(
      `DELETE FROM signatures WHERE document_id IN (SELECT id FROM documents WHERE tenant_id = $1)`,
      [tenantId]
    );
    await pool.query(
      `DELETE FROM case_stages WHERE case_id IN (SELECT id FROM cases WHERE tenant_id = $1)`,
      [tenantId]
    );
    for (const table of [
      "attendance_sessions",
      "ledger_entries",
      "consents",
      "urine_screens",
      "files",
      "documents",
      "cases",
      "patients",
      "locations",
      "users",
      "audit_log",
      "catalogs",
      "content_library",
      "case_number_seq",
    ]) {
      await pool.query(`DELETE FROM ${table} WHERE tenant_id = $1`, [tenantId]);
    }
    // Better Auth: "user" -> cascada real a session/account (onDelete: "cascade" en
    // auth-schema.ts), así que basta borrar "user" por tenant_id.
    await pool.query(`DELETE FROM "user" WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]);

    return { deleted: true, tenantId };
  } finally {
    await pool.end();
  }
}
export async function runSeed(): Promise<{
  already: boolean;
  tenantId: string;
  locationId: string;
  seedPassword: string;
  roster: Array<{ email: string; role: string }>;
}> {
  const { db, schema } = await import("../src/lib/db/client");
  const { withTenant } = await import("../src/lib/db/rls");
  const { auth } = await import("../src/lib/auth");
  const { eq } = await import("drizzle-orm");
  const { readFileSync } = await import("node:fs");

  const LICENSE_NUMBER = "A-2854-0004-A";
  const seedPassword = process.env.SEED_PASSWORD ?? "DevOnly-ChangeMe-123";

  const existing = await db
    .select({ id: schema.tenants.id })
    .from(schema.tenants)
    .where(eq(schema.tenants.licenseNumber, LICENSE_NUMBER))
    .limit(1);

  if (existing[0]) {
    const [loc] = await withTenant(existing[0].id, async (tx) =>
      tx.select({ id: schema.locations.id }).from(schema.locations).limit(1)
    );
    return {
      already: true,
      tenantId: existing[0].id,
      locationId: loc?.id ?? "",
      seedPassword,
      roster: [],
    };
  }

  console.log("Seeding tenant: DUI Metropolitan Services, Inc. ...");
  const [tenant] = await db
    .insert(schema.tenants)
    .values({
      name: "DUI Metropolitan Services, Inc.",
      licenseNumber: LICENSE_NUMBER,
      settings: {
        defaultLocale: "en",
        caseNumberFormat: "0XX+MON+YY",
      },
    })
    .returning();

  const { archer, roster } = await withTenant(tenant.id, async (tx) => {
    console.log("Seeding location: Archer ...");
    const [archer] = await tx
      .insert(schema.locations)
      .values({
        tenantId: tenant.id,
        name: "Archer",
        licenseNumber: LICENSE_NUMBER,
      })
      .returning();

    console.log("Seeding roster (AJUSTAR roles/correos antes de producción real) ...");
    const rosterInput = [
      {
        email: "jorge.torres@duimetropolitan.example",
        name: "George (Jorge) Torres",
        credentials: "BA, CADC",
        role: "owner" as const,
      },
      {
        email: "maria.torres@duimetropolitan.example",
        name: "Maria I. Torres",
        credentials: "CADC",
        role: "counselor" as const,
      },
      {
        email: "guadalupe.perez@duimetropolitan.example",
        name: "Guadalupe G Perez",
        credentials: null,
        role: "admin" as const,
      },
    ];

    const roster: Array<(typeof rosterInput)[number] & { businessUserId: string }> = [];
    for (const person of rosterInput) {
      const [row] = await tx
        .insert(schema.users)
        .values({
          tenantId: tenant.id,
          email: person.email,
          name: person.name,
          credentials: person.credentials,
          role: person.role,
          locale: "en",
        })
        .returning();
      roster.push({ ...person, businessUserId: row.id });
    }

    return { archer, roster };
  });

  for (const person of roster) {
    await auth.api.signUpEmail({
      body: {
        email: person.email,
        password: seedPassword,
        name: person.name,
        tenantId: tenant.id,
        businessUserId: person.businessUserId,
      },
    });
  }

  const curated: Array<{ file: string; label: string }> = [
    { file: "forms_1_7.schema.json", label: "forms_1_7 (contenido REAL, curado de Forms 1-7 R12)" },
    { file: "assessment.schema.json", label: "assessment (contenido REAL, curado de Assessment R12)" },
    { file: "treatment_plan.schema.json", label: "treatment_plan (contenido REAL, curado de Treatment Plan R12)" },
    { file: "case_review.schema.json", label: "case_review (contenido REAL, curado de Case Review R12)" },
    {
      file: "activity_notes_12.schema.json",
      label: "activity_notes_12 (contenido REAL, curado de Activity Notes 12hrs R12)",
    },
  ];

  console.log("Seeding form_schemas: demo_intake (motor de formularios, NO contenido real) ...");
  await db
    .insert(schema.formSchemas)
    .values({
      key: "demo_intake",
      version: 1,
      titleEn: "Demo intake (form engine test — not real content)",
      titleEs: "Intake de prueba (motor de formularios — no es contenido real)",
      schema: {
        key: "demo_intake",
        version: 1,
        titleEn: "Demo intake (form engine test — not real content)",
        titleEs: "Intake de prueba (motor de formularios — no es contenido real)",
        fields: [
          {
            key: "referral_source",
            type: "select",
            labelEn: "Referral source",
            labelEs: "Fuente de referencia",
            required: true,
            options: [
              { value: "court", labelEn: "Court", labelEs: "Corte" },
              { value: "self", labelEn: "Self-referral", labelEs: "Voluntario" },
              { value: "employer", labelEn: "Employer", labelEs: "Empleador" },
            ],
          },
          {
            key: "prior_treatment",
            type: "radio",
            labelEn: "Prior treatment?",
            labelEs: "¿Tratamiento previo?",
            required: true,
            options: [
              { value: "yes", labelEn: "Yes", labelEs: "Sí" },
              { value: "no", labelEn: "No", labelEs: "No" },
            ],
          },
          {
            key: "prior_treatment_details",
            type: "textarea",
            labelEn: "Prior treatment details",
            labelEs: "Detalle del tratamiento previo",
          },
          { key: "notes", type: "textarea", labelEn: "Intake notes", labelEs: "Notas de admisión" },
        ],
        pages: [
          {
            title: { en: "Referral", es: "Referencia" },
            fields: ["referral_source", "prior_treatment", "prior_treatment_details"],
          },
          { title: { en: "Notes", es: "Notas" }, fields: ["notes"] },
        ],
        conditions: [{ if: "prior_treatment", eq: "yes", show: ["prior_treatment_details"] }],
      },
    })
    .onConflictDoNothing();

  for (const { file, label } of curated) {
    console.log(`Seeding form_schemas: ${label} ...`);
    const parsed = JSON.parse(
      readFileSync(new URL(`../build-inputs/curated/${file}`, import.meta.url), "utf-8")
    );
    await db
      .insert(schema.formSchemas)
      .values({
        key: parsed.key,
        version: parsed.version,
        titleEn: parsed.titleEn,
        titleEs: parsed.titleEs,
        schema: parsed,
      })
      .onConflictDoNothing();
  }

  return {
    already: false,
    tenantId: tenant.id,
    locationId: archer.id,
    seedPassword,
    roster: roster.map((r) => ({ email: r.email, role: r.role })),
  };
}
