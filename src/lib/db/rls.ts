import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

/**
 * withTenant — la ÚNICA forma permitida de tocar tablas con PHI.
 *
 * Por qué existe este archivo (no es un detalle de implementación, es la pieza que
 * hace que RLS realmente aísle datos — ver hallazgo de la auditoría de arquitectura):
 * Neon usa connection pooling en modo transacción. Un `SET app.tenant_id = ...` de
 * sesión normal NO persiste de una query a la siguiente bajo ese modo — cada query
 * puede aterrizar en una conexión física distinta. La única forma correcta es:
 *
 *   1) abrir una transacción real (múltiples statements, misma conexión física),
 *   2) como PRIMER statement de esa transacción, `SET LOCAL app.tenant_id = '<uuid>'`,
 *   3) ejecutar la operación real dentro de la MISMA transacción,
 *   4) commit (automático al resolver el callback) / rollback (automático si lanza).
 *
 * Por eso este archivo usa el driver de Pool (WebSocket, conexión con estado) vía
 * drizzle-orm/neon-serverless — NO el cliente HTTP de client.ts, que es sin estado
 * y no puede sostener SET LOCAL entre statements.
 *
 * Toda Server Action, toda API route, todo script (seed, generate-schemas) que lea
 * o escriba una tabla con tenant_id DEBE pasar por withTenant(). Nunca usar `db` de
 * client.ts para leer/escribir PHI.
 */

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const dbWithPool = drizzle(pool, { schema });

export async function withTenant<T>(
  tenantId: string,
  fn: (tx: Parameters<Parameters<typeof dbWithPool.transaction>[0]>[0]) => Promise<T>
): Promise<T> {
  if (!tenantId) {
    throw new Error(
      "withTenant() llamado sin tenantId — con app.tenant_id vacío, current_setting(...)::uuid " +
        "de la política RLS falla o no matchea, y la query devuelve 0 filas silenciosamente " +
        "en vez de fallar ruidosamente. Revisa la sesión antes de llegar aquí."
    );
  }

  return dbWithPool.transaction(async (tx) => {
    // SET LOCAL, nunca SET a secas: SET LOCAL vive solo dentro de esta transacción,
    // que es exactamente la garantía que RLS necesita bajo connection pooling.
    // Se pasa como parámetro (no interpolación de string) para evitar inyección SQL.
    await tx.execute(sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`);
    return fn(tx);
  });
}

/**
 * Cliente SOLO para operaciones explícitamente fuera de tenant (ej. lookup de tenant
 * por dominio antes de tener sesión). No debe usarse para ninguna tabla con PHI.
 * Sigue conectando como app_user (nunca como owner) — RLS con FORCE bloquea todo salvo
 * lo explícitamente permitido por policy, así que aunque se use mal aquí, el daño
 * está acotado por el mismo mecanismo.
 */
export { dbWithPool as dbNoTenant };
