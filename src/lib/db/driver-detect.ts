/**
 * Detección de entorno para elegir driver de Postgres.
 *
 * Producción SIEMPRE es Neon (blueprint ADR-001) — este archivo no cambia esa
 * decisión. Lo que agrega es la capacidad de correr la app COMPLETA en local contra
 * un Postgres normal (sin Neon) mientras las cuentas de Vercel/Neon/AWS siguen en
 * trámite, usando el driver estándar `pg` en vez del driver HTTP/WebSocket de Neon
 * (que no habla con Postgres local sin un proxy). Ver DEVIATIONS.md.
 *
 * La detección es por host: localhost/127.0.0.1 = Postgres local; cualquier otro
 * host (incluido cualquier host de Neon) = producción real, driver de Neon. Si
 * DATABASE_URL no es una URL válida, se asume producción (falla seguro hacia el
 * comportamiento ya probado en Neon, no hacia un driver que nunca se ha usado ahí).
 */
export function isLocalPostgres(databaseUrl: string): boolean {
  try {
    const { hostname } = new URL(databaseUrl);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}
