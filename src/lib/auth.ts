import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db/client";

/**
 * Better Auth — ver ADR-002. Self-hosted (no Clerk/Auth0) para no meter PHI de
 * sesión a un tercero sin BAA y para mantener costo fijo bajo el presupuesto de M1.
 *
 * IMPORTANTE: Better Auth genera sus propias tablas (user/session/account/verification)
 * vía su CLI (`pnpm dlx @better-auth/cli generate`) apuntando a este archivo — esas
 * tablas viven en el mismo esquema `public` pero NO llevan tenant_id ni pasan por
 * withTenant(): son metadata de autenticación, no PHI clínico. El perfil de negocio
 * (role, credentials, tenant_id) vive en la tabla `users` de schema.ts, enlazada por
 * email. El login determina la sesión; la sesión determina el tenant activo para
 * TODAS las queries subsecuentes vía withTenant() — nunca al revés.
 *
 * TOTP y sesión de 12h (blueprint M1 paso 5) se configuran cuando se agregue el plugin
 * de two-factor de Better Auth — pendiente de credenciales (RESEND_API_KEY) para el
 * flujo de invitación por correo.
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
    // TODO M1: activar requireEmailVerification cuando RESEND_API_KEY esté disponible.
  },
  session: {
    expiresIn: 60 * 60 * 12, // 12h — blueprint M1 paso 5
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
});
