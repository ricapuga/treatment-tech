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
 * La lógica real vive en scripts/seed-lib.ts (runSeed()) — compartida con la ruta de
 * bootstrap del pilot en Vercel (src/app/api/setup/bootstrap/route.ts), que dispara
 * el mismo seed vía HTTP porque el sandbox donde corre Claude no tiene salida de red
 * hacia Neon. Este archivo es solo el wrapper de CLI para desarrollo local.
 *
 * Correr: pnpm db:seed
 */
import { config as loadEnv } from "dotenv";

// Cargar .env.local ANTES de importar cualquier módulo que lea process.env.DATABASE_URL
// a nivel de módulo (src/lib/db/client.ts, src/lib/auth.ts). Por eso el import de
// seed-lib.ts es dinámico (await import) dentro de main(), no estático arriba — un
// import estático se evalúa antes de que este archivo alcance a llamar loadEnv(), y
// el cliente de DB se construiría con DATABASE_URL todavía undefined.
loadEnv({ path: ".env.local" });
loadEnv();

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está definida. Copia .env.example a .env.local.");
  }

  const { runSeed } = await import("./seed-lib");
  const result = await runSeed();

  if (result.already) {
    console.log(`Ya estaba sembrado (tenant=${result.tenantId}) — no se repitió nada.`);
    return;
  }

  console.log(
    `Listo. tenant=${result.tenantId} location(Archer)=${result.locationId}.\n` +
      `Recuerda: los correos de arriba son placeholders — reemplázalos por los reales antes de invitar al equipo.\n` +
      `Contraseña de las cuentas sembradas: "${result.seedPassword}" (defínela vía SEED_PASSWORD si quieres otra) — es SOLO para desarrollo/demo local, rotar antes de cualquier uso real.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
