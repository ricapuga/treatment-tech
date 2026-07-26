/**
 * Seed inicial — blueprint M1 paso 4: tenant DUI Metropolitan, ubicación Archer,
 * roster con roles, MÁS cuentas reales de Better Auth para poder iniciar sesión
 * de verdad (no solo el perfil de negocio en `users`).
 *
 * Roster tomado de build-inputs/extracted/option_catalogs.json (nombres reales
 * encontrados en los catálogos del PDF: "George Torres, BA, CADC", "Maria I. Torres,
 * CADC", "Cindy Torres"). El rol de cada quien y si el roster sigue vigente es la
 * pregunta 2 del documento "1. Entendimiento de la Plataforma y la Oportunidad.md"
 * — este seed es un punto de partida razonable, no un hecho confirmado. AJUSTAR
 * antes de dar acceso real a producción.
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
        email: "cindy.torres@duimetropolitan.example",
        name: "Cindy Torres",
        credentials: null,
        role: "front_desk" as const,
      },
    ];

    for (const person of rosterInput) {
      await tx.insert(schema.users).values({
        tenantId: tenant.id,
        email: person.email,
        name: person.name,
        credentials: person.credentials,
        role: person.role,
        locale: "en",
      });
    }

    return { archer, roster: rosterInput };
  });

  const seedPassword = process.env.SEED_PASSWORD ?? "DevOnly-ChangeMe-123";

  // Cuentas reales de Better Auth (tabla `user` + `account` — sin RLS, no son PHI, ver
  // src/lib/auth.ts) — sin esto el login no tiene contra qué autenticar. Se enlazan
  // con el perfil de negocio de arriba por email, fuera de la transacción anterior:
  // Better Auth maneja su propia sesión/transacción internamente vía signUpEmail.
  for (const person of roster) {
    await auth.api.signUpEmail({
      body: { email: person.email, password: seedPassword, name: person.name },
    });
  }

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
