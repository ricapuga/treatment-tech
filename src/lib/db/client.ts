import { drizzle as drizzleNeonHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { neon } from "@neondatabase/serverless";
import { Pool as PgPool } from "pg";
import * as schema from "./schema";
import { isLocalPostgres } from "./driver-detect";

/**
 * Cliente de base de datos de la APLICACIÓN.
 *
 * CRÍTICO (ver ADR de mecánica RLS y Gate M1): DATABASE_URL en producción/preview/dev
 * SIEMPRE debe ser la connection string del rol `app_user`, JAMÁS la del owner de Neon.
 * Conectarse como owner bypassea Row Level Security por completo sin ningún error visible
 * — el bug queda invisible hasta que alguien filtra datos de otro tenant.
 *
 * DATABASE_URL_MIGRATIONS (solo usada por drizzle-kit, nunca importada por la app en
 * runtime) sí puede ser la del owner, porque crear tablas/roles requiere privilegios
 * que app_user no tiene y no debe tener.
 *
 * Driver: Neon (HTTP) en producción/Neon real; `pg` (node-postgres) SOLO cuando
 * DATABASE_URL apunta a localhost — permite correr la app completa (incluido Better
 * Auth) contra Postgres local sin esperar la cuenta de Neon. Ver driver-detect.ts.
 */
const url = process.env.DATABASE_URL!;

export const db = isLocalPostgres(url)
  ? drizzleNodePg(new PgPool({ connectionString: url }), { schema })
  : drizzleNeonHttp(neon(url), { schema });

export { schema };
