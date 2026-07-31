/**
 * Setup de base de datos para el pilot en Vercel — corre DENTRO del build de Vercel
 * (ver "vercel-build" en package.json), NO en el sandbox de desarrollo de este
 * proyecto: el sandbox donde vive esta sesión de Claude no tiene salida de red hacia
 * Neon (solo un allowlist de registries de paquetes) — el build de Vercel sí tiene
 * salida completa a internet, por eso el setup de DB se ejecuta ahí.
 *
 * Hace dos cosas, en orden, ambas 100% idempotentes (correr esto en cada deploy no
 * rompe nada):
 *   1) Aplica las migraciones de drizzle-kit (drizzle/*.sql) contra DATABASE_URL_MIGRATIONS
 *      (rol owner de Neon) usando el migrator programático de drizzle-orm — equivalente
 *      a `pnpm db:migrate` pero sin necesitar la CLI interactiva.
 *   2) Aplica drizzle/sql/0001_rls_and_roles.sql (creación de app_user, RLS, policies)
 *      sustituyendo el placeholder <APP_USER_PASSWORD> por la variable de entorno
 *      APP_USER_PASSWORD — ver CLAUDE.md, esta pieza es "no negociable": sin ella RLS
 *      existe en el papel pero no protege nada.
 *
 * Si DATABASE_URL_MIGRATIONS no está definida, se asume que este build NO es el pilot
 * de Neon (ej. un preview futuro sin DB propia) y el script no hace nada — para no
 * romper builds que no necesitan este paso.
 */
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { readFileSync } from "node:fs";
import path from "node:path";

async function main() {
  const ownerUrl = process.env.DATABASE_URL_MIGRATIONS;
  if (!ownerUrl) {
    console.log("[deploy-migrate] DATABASE_URL_MIGRATIONS no definida — se omite setup de DB.");
    return;
  }

  const appUserPassword = process.env.APP_USER_PASSWORD;
  if (!appUserPassword) {
    throw new Error(
      "[deploy-migrate] APP_USER_PASSWORD no está definida — requerida para crear/mantener " +
        "el rol app_user (drizzle/sql/0001_rls_and_roles.sql). Configúrala en las variables " +
        "de entorno del proyecto en Vercel."
    );
  }

  const pool = new Pool({ connectionString: ownerUrl });

  try {
    console.log("[deploy-migrate] Aplicando migraciones de drizzle-kit...");
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
    console.log("[deploy-migrate] Migraciones OK.");

    console.log("[deploy-migrate] Aplicando drizzle/sql/0001_rls_and_roles.sql (RLS + rol app_user)...");
    const rlsSqlRaw = readFileSync(
      path.join(process.cwd(), "drizzle/sql/0001_rls_and_roles.sql"),
      "utf-8"
    );
    const rlsSql = rlsSqlRaw.replace("<APP_USER_PASSWORD>", appUserPassword);
    // Protocolo simple de `pg` (una sola llamada .query con el archivo completo) sí
    // soporta múltiples statements + bloques DO $$ ... $$ separados por ';' — a
    // diferencia del protocolo extendido (parametrizado), que no lo permite.
    await pool.query(rlsSql);
    console.log("[deploy-migrate] RLS + rol app_user OK.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[deploy-migrate] FALLÓ:", err);
  process.exit(1);
});
