/**
 * Seed inicial — blueprint M1 paso 4: tenant DUI Metropolitan, ubicación Archer,
 * roster con roles, MÁS cuentas reales de Better Auth para poder iniciar sesión
 * de verdad (no solo el perfil de negocio en `users`).
 *
 * Roster confirmado por Jorge (documento "Preguntas para Jorge — Treatment Tech",
 * sección 5, respondido 2026-07-26): María I. Torres y Jorge Torres como consejeros
 * clínicos, Guadalupe G Perez en lugar de Cindy Torres (rol administrativo).
 *
 * Jorge respondió a Jorge y María como "Consejero" en la tabla — pero Jorge se deja
 * como `owner` aquí (decisión de Ricardo, no de este script): owner ya incluye acceso
 * a documentos clínicos (está en CLINICAL_ROLES, ver src/lib/rbac.ts) y además
 * necesita administrar el tenant como director de la clínica. Guadalupe queda como
 * `admin` (decisión explícita de Ricardo, no `front_desk` como el placeholder
 * anterior) — OJO: `admin` SÍ está en CLINICAL_ROLES, o sea que a diferencia de Cindy
 * Torres (front_desk, sin acceso), Guadalupe SÍ va a poder abrir documentos clínicos
 * del expediente. Si esa no es la intención real, cambiar su rol a `front_desk` aquí.
 *
 * Correos: los tres reales que regresó Jorge son el MISMO
 * (duimetropolitan@gmail.com) — no sirve para login individual ni para que
 * `audit_log` distinga quién hizo qué. Por instrucción de Ricardo se deja con
 * placeholders `@duimetropolitan.example` por ahora; pendiente ayudarles a generar
 * correos institucionales de dominio propio antes de dar acceso real a producción.
 *
 * Requiere DATABASE_URL apuntando al rol app_user (o al owner solo para este script
 * de bootstrap inicial, si app_user aún no existe — ver drizzle/sql/0001_rls_and_roles.sql,
 * que debe correr ANTES que este seed, y drizzle/0001_hot_mauler.sql con las tablas
 * de Better Auth, que también debe existir antes).
 *
 * SEED_PASSWORD (opcional): contraseña para las cuentas de Better Auth creadas aquí.
 * Si no se define, usa un valor de desarrollo obvio — NUNCA usar el default en una
 * base de datos que no sea local/desechable.
 *
 * Correr: pnpm db:seed
 */
import { config as loadEnv } from "dotenv";
import { readFileSync } from "node:fs";

// Cargar .env.local ANTES de importar cualquier módulo que lea process.env.DATABASE_URL
// a nivel de módulo (src/lib/db/client.ts, src/lib/auth.ts). Por eso los imports de
// esos módulos son dinámicos (await import) dentro de main(), no imports estáticos
// arriba — un import estático se evalúa antes de que este archivo alcance a llamar
// loadEnv(), y el cliente de DB se construiría con DATABASE_URL todavía undefined.
loadEnv({ path: ".env.local" });
loadEnv();

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está definida. Copia .env.example a .env.local.");
  }

  const { db, schema } = await import("../src/lib/db/client");
  const { withTenant } = await import("../src/lib/db/rls");
  const { auth } = await import("../src/lib/auth");

  // `tenants` NO lleva RLS (es la tabla de identidad, no un hijo de tenant_id) — este
  // INSERT sí puede ir por el cliente app_user normal, sin withTenant().
  console.log("Seeding tenant: DUI Metropolitan Services, Inc. ...");
  const [tenant] = await db
    .insert(schema.tenants)
    .values({
      name: "DUI Metropolitan Services, Inc.",
      licenseNumber: "A-2854-0004-A",
      settings: {
        defaultLocale: "en",
        caseNumberFormat: "0XX+MON+YY",
      },
    })
    .returning();

  // A partir de aquí, TODA tabla (locations, users, ...) tiene FORCE ROW LEVEL
  // SECURITY con policy tenant_id = app_current_tenant_id(). Sin pasar por
  // withTenant(), el INSERT viola la policy (WITH CHECK implícito de una policy sin
  // separar USING/WITH CHECK) y Postgres lo rechaza con "new row violates row-level
  // security policy" — encontrado exactamente así al correr este script por primera
  // vez contra Postgres local. Es la regla correcta funcionando, no un bug de RLS:
  // el bug estaba en que este script no la respetaba. El propio proceso de seed debe
  // comportarse como cualquier otro código de la app.
  const { archer, roster } = await withTenant(tenant.id, async (tx) => {
    console.log("Seeding location: Archer ...");
    const [archer] = await tx
      .insert(schema.locations)
      .values({
        tenantId: tenant.id,
        name: "Archer",
        licenseNumber: "A-2854-0004-A",
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

  const seedPassword = process.env.SEED_PASSWORD ?? "DevOnly-ChangeMe-123";

  // Cuentas reales de Better Auth (tabla `user` + `account` — sin RLS, no son PHI, ver
  // src/lib/auth.ts) — sin esto el login no tiene contra qué autenticar. Se enlazan
  // con el perfil de negocio de arriba por email, fuera de la transacción anterior:
  // Better Auth maneja su propia sesión/transacción internamente vía signUpEmail.
  // tenantId/businessUserId van en la cuenta de Better Auth (additionalFields, ver
  // src/lib/auth.ts) para que getCurrentSession() sepa el tenant SIN consultar una
  // tabla con RLS antes de tener tenant_id — ver comentario en auth.ts.
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

  // Schema DEMO del motor de formularios (src/components/form-engine/) — NO es
  // contenido clínico real de Jorge (eso se cura contra build-inputs/ en M2/M3, ver
  // treatment-tech-blueprint.md Sección 12). Existe solo para probar en pantalla que
  // el motor (multipágina, condicionales RN-7, autosave) funciona, con datos
  // claramente ficticios — mismo espíritu que el simulador de RN-2/RN-3 del
  // dashboard. form_schemas no tiene tenant_id (es contenido global) así que se
  // inserta con el cliente sin tenant, y onConflictDoNothing() para que correr el
  // seed dos veces no truene.
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
          {
            key: "notes",
            type: "textarea",
            labelEn: "Intake notes",
            labelEs: "Notas de admisión",
          },
        ],
        pages: [
          {
            title: { en: "Referral", es: "Referencia" },
            fields: ["referral_source", "prior_treatment", "prior_treatment_details"],
          },
          { title: { en: "Notes", es: "Notas" }, fields: ["notes"] },
        ],
        conditions: [
          { if: "prior_treatment", eq: "yes", show: ["prior_treatment_details"] },
        ],
      },
    })
    .onConflictDoNothing();

  // Schema REAL de Forms 1-7 (blueprint M2 paso 2, curado en esta sesión contra
  // build-inputs/templates-r12/forms-1-7.pdf — 52 campos, 3 páginas: Demographic
  // Data, Program Requirements, Fees & Financial Responsibility). Reemplaza a
  // demo_intake como el formulario real de la etapa "intake" — ver PROGRESS.md
  // sección de curación de Forms 1-7 para el detalle de cada decisión (por qué LOI
  // no es un campo editable aquí, por qué sesiones/costo se calculan y no se
  // capturan, qué condiciones son evidencia real de field_scripts.json vs cuáles se
  // dejaron sin inventar). El JSON vive en build-inputs/curated/ — versionable y
  // revisable por separado del código del seed.
  console.log("Seeding form_schemas: forms_1_7 (contenido REAL, curado de Forms 1-7 R12) ...");
  const forms17Schema = JSON.parse(
    readFileSync(
      new URL("../build-inputs/curated/forms_1_7.schema.json", import.meta.url),
      "utf-8"
    )
  );
  await db
    .insert(schema.formSchemas)
    .values({
      key: forms17Schema.key,
      version: forms17Schema.version,
      titleEn: forms17Schema.titleEn,
      titleEs: forms17Schema.titleEs,
      schema: forms17Schema,
    })
    .onConflictDoNothing();

  // Schema REAL de Assessment (Biopsychosocial Assessment, ASAM 6 dimensiones) —
  // segundo módulo clínico real curado (blueprint M2, etapa "assessment" de
  // CASE_STAGE_ORDER), contra build-inputs/templates-r12/assessment.pdf (12 páginas,
  // ~360 campos reales del AcroForm original). Ver PROGRESS.md sección de curación de
  // Assessment para el detalle de las simplificaciones documentadas (tablas de
  // episodios N/A colapsadas, campos sin lista de opciones confirmada dejados como
  // texto libre, etc.). El JSON vive en build-inputs/curated/ — versionable y
  // revisable por separado del código del seed.
  console.log("Seeding form_schemas: assessment (contenido REAL, curado de Assessment R12) ...");
  const assessmentSchema = JSON.parse(
    readFileSync(
      new URL("../build-inputs/curated/assessment.schema.json", import.meta.url),
      "utf-8"
    )
  );
  await db
    .insert(schema.formSchemas)
    .values({
      key: assessmentSchema.key,
      version: assessmentSchema.version,
      titleEn: assessmentSchema.titleEn,
      titleEs: assessmentSchema.titleEs,
      schema: assessmentSchema,
    })
    .onConflictDoNothing();

  // Schema REAL de Treatment Plan — tercer módulo clínico real curado (blueprint M2,
  // etapa "treatment_plan" de CASE_STAGE_ORDER), contra
  // build-inputs/templates-r12/treatment-plan.pdf (7 páginas, 78 campos reales del
  // AcroForm original). A diferencia de assessment, este módulo NO tiene condiciones
  // RN-7 (field_scripts.json solo trae scripts de formateo de fecha). Ver
  // build_treatment_plan_schema.py y PROGRESS.md para el detalle de las
  // simplificaciones/hallazgos documentados (ausencia real de campos en Dimensión 1,
  // el bug de sincronización "Text2"/"Date" del PDF resuelto con keys distintas por
  // dimensión, etc.). El JSON vive en build-inputs/curated/ — versionable y revisable
  // por separado del código del seed.
  console.log("Seeding form_schemas: treatment_plan (contenido REAL, curado de Treatment Plan R12) ...");
  const treatmentPlanSchema = JSON.parse(
    readFileSync(
      new URL("../build-inputs/curated/treatment_plan.schema.json", import.meta.url),
      "utf-8"
    )
  );
  await db
    .insert(schema.formSchemas)
    .values({
      key: treatmentPlanSchema.key,
      version: treatmentPlanSchema.version,
      titleEn: treatmentPlanSchema.titleEn,
      titleEs: treatmentPlanSchema.titleEs,
      schema: treatmentPlanSchema,
    })
    .onConflictDoNothing();

  // Schema REAL de Case Review — cuarto módulo clínico real curado (blueprint M2,
  // etapa "case_review" de CASE_STAGE_ORDER), contra
  // build-inputs/templates-r12/case-review.pdf (2 páginas, 28 campos reales del
  // AcroForm original). Igual que treatment_plan, NO tiene condiciones RN-7. Ver
  // build_case_review_schema.py y PROGRESS.md para el detalle (Dimensión 1 con un
  // solo campo de estado vs. 3 notas de progreso en las Dimensiones 2-6, el campo
  // "Recommendations" que en realidad captura la escala ASAM, el mismo bug de
  // sincronización "Text2" ya visto en treatment_plan). El JSON vive en
  // build-inputs/curated/ — versionable y revisable por separado del código del seed.
  console.log("Seeding form_schemas: case_review (contenido REAL, curado de Case Review R12) ...");
  const caseReviewSchema = JSON.parse(
    readFileSync(
      new URL("../build-inputs/curated/case_review.schema.json", import.meta.url),
      "utf-8"
    )
  );
  await db
    .insert(schema.formSchemas)
    .values({
      key: caseReviewSchema.key,
      version: caseReviewSchema.version,
      titleEn: caseReviewSchema.titleEn,
      titleEs: caseReviewSchema.titleEs,
      schema: caseReviewSchema,
    })
    .onConflictDoNothing();

  // Schema REAL de Activity Notes — variante de 12 horas ("EARLY INTERVENTION
  // PROGRAM"), quinto módulo clínico real curado, contra
  // build-inputs/templates-r12/activity-notes-12.pdf (2 páginas, 94 campos curados de
  // 102 reales del AcroForm original). A diferencia de los 4 módulos anteriores, este
  // NO tiene una etapa propia en CASE_STAGE_ORDER — es una bitácora de sesiones que se
  // usa DURANTE el tratamiento, con un consejero potencialmente distinto por sesión.
  // Por eso NO tiene todavía un link en el hub del expediente (/cases/[id]) — la UI
  // para listar/crear múltiples notas de actividad por caso queda pendiente de M3,
  // igual que la UI de revisiones múltiples de case_review. Ver PROGRESS.md. Es la
  // primera de 3 variantes por tamaño (12/20/75 horas) — las otras 2 quedan
  // pendientes.
  console.log("Seeding form_schemas: activity_notes_12 (contenido REAL, curado de Activity Notes 12hrs R12) ...");
  const activityNotes12Schema = JSON.parse(
    readFileSync(
      new URL("../build-inputs/curated/activity_notes_12.schema.json", import.meta.url),
      "utf-8"
    )
  );
  await db
    .insert(schema.formSchemas)
    .values({
      key: activityNotes12Schema.key,
      version: activityNotes12Schema.version,
      titleEn: activityNotes12Schema.titleEn,
      titleEs: activityNotes12Schema.titleEs,
      schema: activityNotes12Schema,
    })
    .onConflictDoNothing();

  console.log(
    `Listo. tenant=${tenant.id} location(Archer)=${archer.id}.\n` +
      `Recuerda: los correos de arriba son placeholders — reemplázalos por los reales antes de invitar al equipo.\n` +
      `Contraseña de las cuentas sembradas: "${seedPassword}" (defínela vía SEED_PASSWORD si quieres otra) — es SOLO para desarrollo/demo local, rotar antes de cualquier uso real.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
