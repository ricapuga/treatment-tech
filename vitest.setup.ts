import { config as loadEnv } from "dotenv";

// vitest no auto-carga .env.local — sin esto, tests/rls.test.ts (y cualquier test
// futuro contra DB) se saltaría silenciosamente por falta de las variables TEST_*.
loadEnv({ path: ".env.local" });
loadEnv();
