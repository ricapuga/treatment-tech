import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit y tsx no auto-cargan env files como sí lo hace `next dev` — sin esto,
// DATABASE_URL_MIGRATIONS solo funcionaría si se exporta a mano en cada terminal.
loadEnv({ path: ".env.local" });
loadEnv(); // fallback a .env si existe, sin pisar lo ya cargado de .env.local

// CRÍTICO: drizzle-kit necesita privilegios de owner (crear tablas) — usa
// DATABASE_URL_MIGRATIONS, NUNCA DATABASE_URL (esa es la conexión de app_user en
// runtime, sin privilegios para crear nada, a propósito — ver src/lib/db/client.ts).
// Fallback a DATABASE_URL solo para no romper en checkouts que aún no separan
// ambas variables, con advertencia explícita.
const migrationsUrl = process.env.DATABASE_URL_MIGRATIONS ?? process.env.DATABASE_URL;

if (!process.env.DATABASE_URL_MIGRATIONS) {
  console.warn(
    "[drizzle.config] DATABASE_URL_MIGRATIONS no está definida — usando DATABASE_URL como fallback. " +
      "Si DATABASE_URL ya apunta al rol app_user (como debe ser en runtime), esta migración fallará " +
      "por falta de privilegios. Define DATABASE_URL_MIGRATIONS con la conexión de owner en .env.local."
  );
}
if (!migrationsUrl) {
  console.warn(
    "[drizzle.config] Ninguna de las dos variables está definida — drizzle-kit fallará al generar/migrar. Copia .env.example a .env.local y complétalo."
  );
}

export default defineConfig({
  // schema.ts: las 19 tablas clínicas/de negocio del blueprint. auth-schema.ts: las
  // tablas de Better Auth (user/session/account/verification), generadas por
  // `pnpm dlx @better-auth/cli generate` a partir de src/lib/auth.ts — no se editan
  // a mano, se regeneran si auth.ts cambia (ej. al agregar el plugin de 2FA).
  schema: ["./src/lib/db/schema.ts", "./src/lib/db/auth-schema.ts"],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: migrationsUrl ?? "",
  },
  verbose: true,
  strict: true,
});
