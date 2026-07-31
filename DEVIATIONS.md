# Desviaciones del blueprint

Formato por entrada: qué decía el blueprint, qué se hizo, por qué, impacto en milestones
posteriores. Ver protocolo de desviación en CLAUDE.md.

## 2026-07-26 — shadcn/ui: init manual en vez de CLI
- **Blueprint decía:** `pnpm dlx shadcn@latest init`.
- **Qué se hizo:** el comando falla en este sandbox (sin acceso de red a `ui.shadcn.com`).
  Se creó `components.json` a mano con la configuración estándar (style default, baseColor
  neutral, alias @/components, @/lib/utils, @/components/ui) y `src/lib/utils.ts` con el
  helper `cn()` estándar (clsx + tailwind-merge). Se instalaron las dependencias que el CLI
  habría instalado (`class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`,
  `tailwindcss-animate`).
- **Por qué:** no bloquear M1 por una restricción de red de este entorno específico, que
  probablemente no existe en tu máquina o en CI.
- **Impacto:** ninguno esperado — `pnpm dlx shadcn@latest add <componente>` debería funcionar
  normal en un entorno con red completa, usando exactamente este `components.json`. Si falla
  ahí también, es una desviación real a investigar, no repetir este workaround sin más.

## 2026-07-26 — `middleware.ts` → `proxy.ts` (Next.js 16 renombró el archivo)
- **Blueprint decía:** middleware de protección de rutas en `middleware.ts` (convención
  estándar de Next.js en el momento en que se escribió el blueprint).
- **Qué se hizo:** Next.js 16.2 deprecó `middleware.ts` a favor de `proxy.ts`, con la
  función exportada como `proxy` (o default) en vez de `middleware`. `pnpm build` lo
  advierte explícitamente. Se renombró el archivo y la función; misma lógica.
- **Por qué:** exactamente el tipo de cambio que `AGENTS.md` (generado por
  create-next-app) advierte al inicio del repo — "This is NOT the Next.js you know".
  Ignorar la advertencia habría dejado el proxy funcionando hoy pero roto en la
  próxima versión que remueva el fallback de compatibilidad.
- **Impacto:** ninguno — incluir esta nota para que nadie "corrija" de vuelta a
  `middleware.ts` pensando que es más estándar.

## 2026-07-26 — RLS: driver de Pool (`drizzle-orm/neon-serverless`) en vez de HTTP para
withTenant()
- **Blueprint decía:** SET LOCAL app.tenant_id dentro de una transacción; no especificaba
  el driver exacto de Neon a usar para `lib/db/rls.ts`.
- **Qué se hizo:** `src/lib/db/rls.ts` usa `@neondatabase/serverless` `Pool` (WebSocket, con
  estado) + `drizzle-orm/neon-serverless`, en vez del cliente HTTP sin estado
  (`drizzle-orm/neon-http`) que sí se usa en `src/lib/db/client.ts` para lecturas que no
  necesitan RLS con tenant (si las hay).
- **Por qué:** el cliente HTTP de Neon no sostiene estado de sesión entre statements — no
  puede ejecutar `SET LOCAL` y luego una query en la MISMA transacción física, que es
  exactamente el requisito de la mecánica RLS bajo pooling. El driver de Pool sí lo permite
  vía `db.transaction()`.
- **Impacto:** ninguno negativo esperado. Si en producción el uso de WebSockets desde
  funciones serverless de Vercel da problemas de cold-start o límites de conexión, es un
  ítem a vigilar en M5 (hardening) — no bloquea M1-M4.

## 2026-07-26 — Selección de driver por entorno (Neon vs Postgres local) en client.ts y rls.ts
- **Blueprint decía:** driver de Neon (HTTP en client.ts, Pool WebSocket en rls.ts) —
  correcto y sin cambios para producción.
- **Qué se hizo:** se agregó `src/lib/db/driver-detect.ts` (`isLocalPostgres()`, detecta
  por hostname si `DATABASE_URL` apunta a `localhost`/`127.0.0.1`) y ambos archivos ahora
  eligen entre el driver de Neon (producción) y `drizzle-orm/node-postgres` + `pg` (SOLO
  cuando el host es local). Esto permite correr la aplicación COMPLETA — incluido Better
  Auth, `withTenant()`, y el login real — contra Postgres local, sin esperar la cuenta de
  Neon. `pg` se movió a `dependencies` (no `devDependencies`) porque ahora lo importa
  código de producción, aunque la rama que lo ejecuta nunca corre contra Neon real.
- **Por qué:** mientras la cuenta de Neon estaba pendiente, se pudo validar de extremo a
  extremo (login real, sesión real, RLS real) en vez de solo con pruebas aisladas.
- **Impacto:** ninguno en producción — contra cualquier host que no sea localhost, el
  comportamiento es idéntico al original (driver de Neon). Verificar una vez que exista
  DATABASE_URL de Neon real que `isLocalPostgres()` regrese `false` para ese host (debería,
  ya que el hostname de Neon nunca es localhost/127.0.0.1).

## 2026-07-26 — `scripts/seed.ts`: bug real corregido — insertaba fuera de `withTenant()`
- **Qué pasaba:** la primera versión de `seed.ts` insertaba `locations` y `users`
  directamente vía el cliente `db` (app_user), sin pasar por `withTenant()`. Contra Postgres
  local esto falló de inmediato con "new row violates row-level security policy" — la
  política de RLS bloquea el INSERT porque `app.tenant_id` nunca se fijó. El mismo error
  habría ocurrido contra Neon real la primera vez que alguien corriera el seed.
- **Qué se hizo:** el seed ahora envuelve la creación de `locations` y `users` en
  `withTenant(tenant.id, ...)`, exactamente como cualquier otra parte de la app. Además
  ahora crea cuentas reales de Better Auth (`auth.api.signUpEmail`) para cada persona del
  roster, con una contraseña de desarrollo (`SEED_PASSWORD` o el default documentado) —
  antes el seed solo creaba el perfil de negocio, sin nada contra qué iniciar sesión.
- **Por qué:** el seed es código de la app como cualquier otro — debe respetar la misma
  disciplina de RLS. Encontrado corriendo el script de verdad, no por inspección.
- **Impacto:** ninguno negativo. Positivo: el bug se corrigió ANTES de que alguien lo
  encontrara corriendo esto contra Neon en producción.

## 2026-07-31 — `drizzle/sql/0001_rls_and_roles.sql`: bug real corregido — password de `app_user` no se resincronizaba
- **Qué pasaba:** el bloque que crea el rol `app_user` usaba `IF NOT EXISTS ... CREATE
  ROLE ... PASSWORD '<APP_USER_PASSWORD>'` — correcto para la primera corrida, pero si el
  rol ya existía, el script no tocaba el password aunque `APP_USER_PASSWORD` cambiara. En
  el primer deploy real al pilot de Vercel + Neon, el build corrió este script sin ningún
  error ("RLS + rol app_user OK.") pero el login en producción falló con "password
  authentication failed for user 'app_user'" — el rol existía, pero su password real no
  coincidía con el que traía `DATABASE_URL` en tiempo de ejecución (Postgres da el mismo
  mensaje genérico para "rol inexistente" y "password incorrecto", por diseño
  anti-enumeración, así que el mensaje de error no distinguía cuál de los dos era).
- **Qué se hizo:** se agregó una rama `ELSE ALTER ROLE app_user WITH LOGIN PASSWORD
  '<APP_USER_PASSWORD>'` — ahora cada corrida de este script (o sea cada build en Vercel,
  ver `scripts/deploy-migrate.ts`) deja el password del rol forzosamente sincronizado con
  la variable de entorno actual, sin importar el estado previo.
- **Por qué:** un script "idempotente" que solo actúa la primera vez no es realmente
  idempotente para el caso de credenciales — debe converger al estado deseado en cada
  corrida, no solo crear una vez y nunca más tocar.
- **Impacto:** ninguno negativo. Corregido antes de confirmar el pilot como funcional —
  ver PROGRESS.md.
