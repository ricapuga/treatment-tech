import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

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
 */
const sqlClient = neon(process.env.DATABASE_URL!);

export const db = drizzle(sqlClient, { schema });

export { schema };
