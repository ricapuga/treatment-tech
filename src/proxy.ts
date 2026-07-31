import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Proxy de protección de rutas (Next.js 16 renombró `middleware` → `proxy`; ver
 * DEVIATIONS.md). Gate M1: "ruta protegida redirige" y "usuario inactivo no entra".
 * Esta capa solo verifica presencia de sesión (rápido, sin round-trip a DB en cada
 * request); la validación completa de rol/tenant/activo ocurre en el layout de
 * (app) vía auth.api.getSession(), que sí consulta la tabla `users` de negocio y
 * puede rechazar a un usuario desactivado con sesión aún vigente.
 *
 * /api/setup queda pública a propósito: es la ruta de bootstrap/reset del pilot
 * (src/app/api/setup/bootstrap/route.ts), pensada para usarse ANTES de que exista
 * ninguna sesión — se protege sola con su propio SETUP_TOKEN por query param, no con
 * cookie de sesión. Sin esta excepción, el proxy la redirige a /login antes de que el
 * route handler siquiera corra.
 */
const PUBLIC_PATHS = ["/login", "/api/auth", "/api/setup"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
