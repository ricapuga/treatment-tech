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
- **Corrección (mismo día, después de redeployar):** el `ALTER ROLE` de arriba no
  arregló el login — mismo error exacto después de subirlo. Causa raíz real, encontrada
  al revisar `scripts/deploy-migrate.ts`: el archivo SQL menciona el placeholder
  `<APP_USER_PASSWORD>` primero en un COMENTARIO (línea 6, explica qué hace el archivo)
  y solo después en las líneas de `CREATE ROLE`/`ALTER ROLE` que de verdad importan.
  `rlsSqlRaw.replace("<APP_USER_PASSWORD>", appUserPassword)` — `.replace()` de un solo
  string sustituye SOLO la primera aparición — sustituía la del comentario y dejaba las
  líneas de `CREATE`/`ALTER ROLE` con el texto literal `"<APP_USER_PASSWORD>"` (con los
  símbolos `<>` incluidos) como password real del rol, nunca el secreto verdadero. Este
  bug existía desde el primer deploy (antes incluso del `ALTER ROLE` de arriba) — el
  diagnóstico de "password no resincronizado entre builds" de la entrada anterior era
  incompleto: el password nunca fue el correcto, ni siquiera la primera vez. Corregido
  cambiando a `rlsSqlRaw.replaceAll(...)`. El `ALTER ROLE` de la entrada anterior sigue
  siendo correcto tenerlo (buena práctica de convergencia), solo no era la causa de
  este error específico.

## 2026-07-31 — `scripts/seed-lib.ts` (`resetTenant()`): excepción deliberada a "solo vía `withTenant()`"
- **Qué pasaba:** para poder recrear las cuentas sembradas del pilot con un password
  distinto (`SEED_PASSWORD` nuevo), hacía falta poder borrar el tenant existente y
  volver a sembrar — `runSeed()` no actualiza cuentas que ya existen. Al escribir
  `resetTenant()` con el cliente normal de la app (`db`, rol `app_user`, el mismo que
  usa cualquier código de negocio), falló con "permission denied for table
  attendance_sessions" — `app_user` solo tiene GRANT SELECT/INSERT/UPDATE en las
  tablas clínicas, nunca DELETE (`drizzle/sql/0001_rls_and_roles.sql`), a propósito:
  protección real contra borrado accidental desde la aplicación, no un descuido.
- **Qué se hizo:** `resetTenant()` usa `DATABASE_URL_MIGRATIONS` (rol owner) con `pg`
  directo, igual que `scripts/deploy-migrate.ts` — NO el `db`/`withTenant()` normal de
  CLAUDE.md ("toda tabla con PHI se toca SOLO vía `withTenant()`").
- **Por qué es una excepción aceptable:** es herramienta de administración de piloto
  (setup/mantenimiento fuera del flujo normal de la app), no código de negocio — mismo
  espíritu que las migraciones. Gateada por el mismo `SETUP_TOKEN` que el resto de
  `/api/setup/bootstrap`.
- **Impacto / pendiente:** desactivar esta ruta (quitar `SETUP_TOKEN` de Vercel) antes
  de cargar PHI real — no es un mecanismo que deba sobrevivir a M5. Si hace falta un
  reset de contraseña real más adelante, el camino correcto es el flujo de Better Auth
  (forgot-password + `RESEND_API_KEY`), pendiente de esas credenciales.

## 2026-07-31 — Condado en "Nuevo caso": texto libre → catálogo cerrado (bug real, no desviación de blueprint)
- **Qué pasaba:** `src/app/(app)/cases/new/admission-form.tsx` capturaba `county` como
  texto libre, mientras que Forms 1-7 (curado del PDF real de Jorge) ya tenía un
  catálogo cerrado de 5 condados (DuPage, Kane, Will, McHenry, Lake —
  `build-inputs/curated/forms_1_7.schema.json`). Dos lugares del sistema tratando el
  mismo dato de forma distinta — encontrado por Ricardo probando el flujo de admisión
  en el pilot, no en revisión de código.
- **Qué se hizo:** se cambió el campo a `<select>` con el mismo catálogo de 5 condados.
  `county` sigue siendo `text` opcional en `cases` (sin migración de esquema) — el
  cambio es solo de UI/validación de captura.
- **Impacto:** ninguno negativo. Ningún caso real había sido creado todavía en el
  pilot (tenant recién reseteado), así que no hay datos previos con texto libre que
  limpiar.

## 2026-07-31 — Dashboard: se quitó el "Simulador de reglas clínicas (RN-2/RN-3)" antes de mostrar el pilot a Jorge
- **Qué pasaba:** `src/app/(app)/dashboard/rules-demo.tsx` (`<RulesDemo />`) es una
  herramienta de QA interna, ya documentada en su propio comentario como "esto NO es
  parte del producto final" — pensada para verificar visualmente que las reglas de
  RN-2/RN-3 quedaron bien capturadas, sin leer código ni pruebas. Ricardo la vio como
  primera pantalla después de iniciar sesión y no entendió qué era ("Tampoco entendí
  el simulador inicial") — riesgo real de confusión si Jorge la ve antes de que el
  producto tenga el hub real de casos (M2/M3) que la reemplaza.
- **Qué se hizo:** se quitó `<RulesDemo />` de `src/app/(app)/dashboard/page.tsx`
  (import y uso). El archivo `rules-demo.tsx` NO se borró — sigue disponible para
  verificación de desarrollo, solo dejó de renderizarse en la app.
- **Por qué:** Ricardo pidió avanzar el desarrollo un poco más antes de mostrarle el
  pilot a Jorge — quitar herramienta de debug visible del camino es parte de esa
  preparación, no requiere ningún cambio de lógica de negocio.
- **Impacto:** ninguno — el componente sigue existiendo en el repo por si se necesita
  para verificación interna; basta reimportarlo si hace falta de nuevo.
