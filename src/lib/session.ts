import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "./auth";
import { withTenant } from "./db/rls";
import { users } from "./db/schema";

export type CurrentSession = {
  userId: string; // id en la tabla de negocio `users`, NO el id de Better Auth
  tenantId: string;
  email: string;
  name: string;
  role: string;
  locale: string;
};

/**
 * Sesión activa + perfil de negocio, en una sola llamada.
 *
 * Dos pasos, deliberadamente en ese orden:
 * 1) `auth.api.getSession()` — lee la cookie/tabla `session` de Better Auth (sin RLS,
 *    no es PHI). El `user` que regresa ya trae tenantId/businessUserId porque se
 *    fijaron como additionalFields al crear la cuenta (ver src/lib/auth.ts) — así se
 *    evita el problema de huevo y gallina de tener que leer la tabla `users` (que SÍ
 *    tiene RLS) antes de saber a qué tenant pertenece la sesión.
 * 2) Con el tenantId ya conocido, `withTenant()` trae la fila real de `users` — esto
 *    es lo que permite rechazar a alguien desactivado (`active = false`) aunque su
 *    cookie de sesión todavía sea válida por hasta 12h (blueprint M1 paso 5, y el
 *    comentario pendiente que dejó proxy.ts).
 *
 * Devuelve null si no hay sesión, si el usuario de negocio no existe, o si está
 * inactivo — el llamador decide qué hacer (normalmente redirect a /login).
 */
export async function getCurrentSession(): Promise<CurrentSession | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const authUser = session.user as typeof session.user & {
    tenantId?: string;
    businessUserId?: string;
  };
  if (!authUser.tenantId || !authUser.businessUserId) return null;

  return withTenant(authUser.tenantId, async (tx) => {
    const rows = await tx
      .select()
      .from(users)
      .where(eq(users.id, authUser.businessUserId as string))
      .limit(1);
    const row = rows[0];
    if (!row || !row.active) return null;

    return {
      userId: row.id,
      tenantId: authUser.tenantId as string,
      email: row.email,
      name: row.name,
      role: row.role,
      locale: row.locale ?? "en",
    };
  });
}

/** Variante que lanza en vez de devolver null — para Server Actions y páginas que
 * ya pasaron por el proxy y por lo tanto no deberían llegar aquí sin sesión válida;
 * si llegan, es una condición real de error (sesión revocada a medio vuelo, usuario
 * desactivado), no un flujo normal a manejar con un if silencioso. */
export async function requireSession(): Promise<CurrentSession> {
  const session = await getCurrentSession();
  if (!session) {
    throw new Error("No hay sesión activa o el usuario está inactivo.");
  }
  return session;
}
