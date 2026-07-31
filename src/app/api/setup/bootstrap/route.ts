import { NextRequest } from "next/server";

/**
 * Bootstrap de datos de prueba para el PILOT en Vercel — existe solo por una
 * limitación de infraestructura de esta sesión: el sandbox donde corre Claude no
 * tiene salida de red hacia Neon (solo un allowlist de registries de paquetes), así
 * que no se puede correr `pnpm db:seed` desde ahí contra la base del pilot. Esta
 * ruta permite dispararlo con un clic desde un navegador con internet normal (el
 * tuyo) en vez de necesitar una terminal.
 *
 * Protegida por SETUP_TOKEN (variable de entorno del proyecto en Vercel, no
 * committeada) — sin el token correcto, o si SETUP_TOKEN no está configurada,
 * responde 404 (no revela ni que la ruta existe). Segura de llamar más de una vez:
 * runSeed() (scripts/seed-lib.ts) detecta si el tenant ya existe y no repite nada.
 *
 * Una vez confirmado el pilot, esta ruta puede desactivarse quitando SETUP_TOKEN de
 * Vercel (vuelve a responder 404) — no hace falta borrar el código para "cerrarla".
 */
export async function GET(req: NextRequest) {
  const expected = process.env.SETUP_TOKEN;
  const provided = req.nextUrl.searchParams.get("token");

  if (!expected || !provided || provided !== expected) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const { runSeed } = await import("../../../../../scripts/seed-lib");
    const result = await runSeed();

    const rosterHtml = result.roster
      .map((r) => `<li><code>${r.email}</code> — ${r.role}</li>`)
      .join("");

    const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><title>Treatment Tech — Setup del pilot</title>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:48px auto;line-height:1.5;color:#1a1a1a}
code{background:#f4f4f4;padding:2px 6px;border-radius:4px}
.ok{color:#0a7a2f} ul{padding-left:20px}</style></head>
<body>
<h1>Treatment Tech — Setup del pilot</h1>
${
  result.already
    ? `<p class="ok">Los datos de prueba ya estaban sembrados (tenant existente). No se repitió nada.</p>`
    : `<p class="ok">Datos de prueba creados correctamente.</p>
       <p>Cuentas para iniciar sesión (contraseña para todas: <code>${result.seedPassword}</code>):</p>
       <ul>${rosterHtml}</ul>`
}
<p><a href="/login">Ir al login →</a></p>
</body></html>`;

    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  } catch (err) {
    console.error("[setup/bootstrap] error:", err);
    return new Response(`Error corriendo el seed: ${(err as Error).message}`, { status: 500 });
  }
}
