import { defineConfig } from "drizzle-kit";

// DATABASE_URL debe apuntar a la conexión POOLED de Neon del proyecto con HIPAA
// habilitado. Ver blueprint Sección 13 (Environment Setup) para dónde obtenerla.
if (!process.env.DATABASE_URL) {
  console.warn(
    "[drizzle.config] DATABASE_URL no está definida — drizzle-kit fallará al generar/migrar. Copia .env.example a .env.local y complétalo."
  );
}

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  verbose: true,
  strict: true,
});
