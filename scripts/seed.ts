/**
 * Seed inicial — blueprint M1 paso 4: tenant DUI Metropolitan, ubicación Archer,
 * roster con roles.
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
 * que debe correr ANTES que este seed).
 *
 * Correr: pnpm tsx scripts/seed.ts
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/lib/db/schema";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está definida. Copia .env.example a .env.local.");
  }

  const sqlClient = neon(process.env.DATABASE_URL);
  const db = drizzle(sqlClient, { schema });

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

  console.log("Seeding location: Archer ...");
  const [archer] = await db
    .insert(schema.locations)
    .values({
      tenantId: tenant.id,
      name: "Archer",
      licenseNumber: "A-2854-0004-A",
    })
    .returning();

  console.log("Seeding roster (AJUSTAR roles/correos antes de producción real) ...");
  const roster = [
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

  for (const person of roster) {
    await db.insert(schema.users).values({
      tenantId: tenant.id,
      email: person.email,
      name: person.name,
      credentials: person.credentials,
      role: person.role,
      locale: "en",
    });
  }

  console.log(
    `Listo. tenant=${tenant.id} location(Archer)=${archer.id}. Recuerda: los correos de arriba son placeholders — reemplázalos por los reales antes de invitar al equipo.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
