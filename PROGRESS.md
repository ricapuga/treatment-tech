# Progreso — Treatment Tech (piloto Archer)

Fuente de verdad del build: `treatment-tech-blueprint.md` (junto a este repo, en el
paquete de construcción). Este archivo es el "dónde nos quedamos" — actualízalo al
final de cada paso, no solo de cada milestone.

## Milestone actual: M1 — Esqueleto desplegado con auth, tenancy y auditoría

### Hecho (2026-07-26, esta sesión)
- [x] Paso 3: `create-next-app` (Next 16.2, TS strict, Tailwind v4, App Router, src/) +
      Drizzle, Better Auth, next-intl, pdf-lib, signature_pad, Stripe, AWS SDK, Upstash-ready,
      vitest, tsx, @playwright/test instalados. shadcn/ui inicializado a mano (`ui.shadcn.com`
      no es alcanzable desde este sandbox — el CLI de shadcn falló por red; `components.json`
      y `lib/utils.ts` están wireados manualmente con las mismas convenciones, así que
      `pnpm dlx shadcn@latest add <componente>` debe funcionar normal en tu máquina/CI).
- [x] Paso 4 (parcial): esquema Drizzle completo (`src/lib/db/schema.ts`) con las 19 tablas
      de la Sección 7. RLS/roles/FORCE RLS/policies/vista `case_balances` en SQL crudo
      (`drizzle/sql/0001_rls_and_roles.sql`) — deliberadamente NO en el schema de Drizzle,
      porque es mecánica de seguridad explícita que no debe depender de que drizzle-kit la
      regenere "bien" en una corrida futura.
- [x] Mecánica RLS bajo pooling (`src/lib/db/rls.ts`): `withTenant()` usando el driver de
      Pool (`drizzle-orm/neon-serverless`) + `db.transaction()` + `SET LOCAL` real dentro de
      la transacción. Esta es la pieza que la auditoría de arquitectura marcó como el riesgo
      más alto de todo el blueprint (RLS silenciosamente inefectivo bajo connection pooling
      HTTP) — quedó resuelta con el driver correcto, no solo documentada.
- [x] `src/lib/audit.ts`: `recordAudit()` corre dentro de `withTenant()`, INSERT-only.
- [x] Better Auth configurado (`src/lib/auth.ts`, ruta `/api/auth/[...all]`), middleware de
      protección de rutas (`src/middleware.ts`).
- [x] next-intl bilingüe (es/en) por cookie de sesión (NO por URL /en//es/, porque el idioma
      es preferencia de usuario, no de ruta) — toggle funcional en el shell.
- [x] Shell base: sidebar + header + toggle es/en (`src/app/(app)/layout.tsx`), dashboard
      placeholder, login placeholder.
- [x] `scripts/seed.ts`: tenant DUI Metropolitan + ubicación Archer + roster (George/Jorge
      Torres, Maria I. Torres, Cindy Torres — nombres reales de los catálogos extraídos,
      roles y correos son placeholders a confirmar).
- [x] `.env.example` completo.

### Hecho (2026-07-26, segunda sesión — validación contra Postgres local + reglas de negocio)
Mientras se esperan las cuentas de Neon/Vercel/AWS, se levantó Postgres 16 local en el
sandbox para validar TODO lo que no depende de que sea específicamente Neon — la mecánica
de RLS es SQL estándar, no específica de Neon, así que se pudo probar de verdad, no solo
por inspección de código. Esto encontró y corrigió dos bugs reales:

1. **`case_stages` no tiene columna `tenant_id`** (por diseño — solo tiene `case_id`), pero
   `drizzle/sql/0001_rls_and_roles.sql` intentaba aplicarle la política genérica de
   `tenant_id = ...` y fallaba en tiempo de ejecución. Corregido con una política dedicada
   por EXISTS/JOIN contra `cases`, igual que ya existía para `signatures`.
2. **`current_setting('app.tenant_id', true)` no siempre regresa NULL cuando no está fijado**:
   en una conexión pooled donde el GUC personalizado `app.tenant_id` ya se tocó una vez
   (aunque haya sido en una transacción anterior, ya terminada), Postgres lo resetea a `''`
   (string vacío), no a NULL. `current_setting(...)::uuid` sobre `''` lanza un error de
   Postgres en vez de devolver 0 filas — rompía la garantía "fail-closed" del Gate M1.
   Corregido con una función helper `app_current_tenant_id()` que aplica `NULLIF(..., '')`
   antes del cast — todas las políticas la usan ahora en vez de repetir el cast crudo.
   **Este bug es exactamente el tipo de cosa que solo aparece corriendo el sistema de
   verdad, nunca leyendo el código** — quedó documentado en el SQL y aquí para que quede
   registro de por qué existe esa función.

Con esos dos fixes:
- [x] Migración base (`drizzle-kit generate` + aplicada) + `0001_rls_and_roles.sql` corren
      limpias de principio a fin contra Postgres 16 local, sin errores.
- [x] **Gate M1, checklist ítem 4 (test SQL de RLS) — implementado y en VERDE**:
      `tests/rls.test.ts`, 5 casos: aislamiento por tenant propio, 0 filas contra tenant
      ajeno, SET LOCAL no persiste entre transacciones, fail-closed sin tenant fijado
      (el caso que expuso el bug #2), y el contraste documentado de que el owner sí
      bypassea RLS (por eso la app nunca se conecta como owner).
- [x] `scripts/seed.ts` — la lógica de INSERT se validó línea por línea contra los
      constraints reales de la tabla (CHECK de `role`, UNIQUE de `email`) en una
      transacción de prueba (rollback, no dejó datos). El script en sí usa el driver HTTP
      de Neon, que no habla con Postgres local sin un proxy — se corre contra Neon real
      en cuanto exista la cuenta; lo que se validó aquí es que la lógica no choca con
      ningún constraint del esquema.
- [x] **RN-1 (número de caso), RN-2 (LOI→programas) y RN-3 (horas→sesiones) implementadas
      en `src/lib/rules/` con 26 pruebas unitarias**, incluyendo el caso de regresión
      exacto del bug del PDF original (comparación de texto "7" >= "50") y una prueba de
      concurrencia real (5 asignaciones de número de caso disparadas en paralelo contra
      Postgres local, sin duplicar ni dejar huecos) — adelanta trabajo de M2/M3 que no
      depende de las cuentas pendientes.
- [x] `drizzle.config.ts` corregido para usar `DATABASE_URL_MIGRATIONS` (owner) en vez de
      `DATABASE_URL` (app_user) — evita que la migración falle por falta de privilegios el
      día que alguien la corra tal cual contra Neon.

**Total de pruebas automatizadas ahora: 31, todas en verde** (`pnpm test`).

### Hecho (2026-07-26, tercera pasada — la app corre completa en local, con login real)
- [x] **`src/lib/db/client.ts` y `src/lib/db/rls.ts` ahora eligen driver por entorno**
      (`src/lib/db/driver-detect.ts`): Neon en producción, `pg`/`node-postgres` cuando
      `DATABASE_URL` apunta a localhost. Esto permitió correr TODA la app —no solo
      pruebas aisladas— contra Postgres local, incluyendo Better Auth. Ver DEVIATIONS.md.
- [x] Tablas de Better Auth generadas de verdad (`pnpm dlx @better-auth/cli generate` →
      `src/lib/db/auth-schema.ts`: `user`, `session`, `account`, `verification`) y
      agregadas al `schema` de `drizzle.config.ts` — antes solo existían en teoría.
- [x] **Bug real encontrado y corregido en `scripts/seed.ts`**: insertaba `locations` y
      `users` sin pasar por `withTenant()` — Postgres lo rechazó con "new row violates
      row-level security policy" al correrlo de verdad. Mismo error habría ocurrido
      contra Neon en producción. Corregido: ahora respeta la misma disciplina que el
      resto de la app. El seed también crea cuentas reales de Better Auth para el
      roster (antes solo creaba el perfil de negocio, sin nada contra qué autenticar).
- [x] **Login real conectado**: `src/app/login/actions.ts` (Server Action →
      `auth.api.signInEmail`) + `src/app/login/login-form.tsx`. Se agregó el plugin
      `nextCookies()` a `src/lib/auth.ts` — sin él, el login autentica pero nunca
      escribe la cookie de sesión (footgun conocido de Better Auth + Server Actions).
- [x] **Verificado de extremo a extremo con Playwright, en un navegador real**: visitar
      `/dashboard` sin sesión redirige a `/login` → llenar el formulario con la cuenta
      real de Jorge (sembrada) → sesión creada → `/dashboard` renderiza. Screenshot
      guardado y revisado.
- [x] **Simulador de reglas en el dashboard** (`src/app/(app)/dashboard/rules-demo.tsx`):
      selecciona LOI + horas, muestra los programas requeridos (RN-2) y las sesiones
      calculadas (RN-3) usando el mismo código de `src/lib/rules/` que ya tiene pruebas.
      No es parte del producto final — se reemplaza cuando exista el hub real del
      expediente en M2 — pero es lo primero que se puede mostrar en pantalla, hoy,
      sin esperar ninguna cuenta.

### Pendiente para cerrar M1 (bloqueado por credenciales que Ricardo debe crear)
- [ ] Paso 2: cuentas Vercel Pro (BAA), Neon (Scale + HIPAA + BAA), AWS (BAA en Artifact),
      Stripe (test), Resend, Upstash — ver checklist entregado aparte.
- [ ] Correr `drizzle-kit generate` + `drizzle-kit migrate` contra Neon real (owner) — el
      esquema y el SQL ya están validados contra Postgres local, así que esto debería ser
      un trámite, no una fuente de sorpresas nuevas.
- [ ] Correr `0001_rls_and_roles.sql` contra Neon real, con una contraseña real generada
      para `app_user` (reemplazar `<APP_USER_PASSWORD>`).
- [ ] Correr `scripts/seed.ts` contra la DB real de Neon.
- [ ] `pnpm build` limpio + deploy a Vercel + smoke test en producción.
- [ ] Re-correr `tests/rls.test.ts` apuntando a Neon real antes de dar M1 por cerrado —
      la lógica ya se probó, pero Neon real es el ambiente que de verdad importa.

### Sin bloqueo — se puede seguir avanzando ahora mismo sin las cuentas
- Curación del formulario de intake (`forms_1_7`) leyendo `build-inputs/templates-r12/`
  (adelanto de M2 paso 2).
- Formulario de login real (conectar a `auth.api.signInEmail`) — se puede construir y
  probar contra Postgres local ahora mismo, mismo patrón que se usó para RN-1.
- Reglas de negocio restantes (RN-4 horas acumuladas, RN-5 ya vive en la vista SQL,
  RN-6 gate de consent, RN-7 condicionales declarativas) — todas son candidatas a
  desarrollarse y probarse contra Postgres local sin esperar a Neon.

## Notas de verificación pendientes (no asumir, correr cuando haya DB)
- `pnpm typecheck`, `pnpm lint` y `pnpm test`: correr después de cada bloque de cambios,
  no solo al final — así se atraparon los dos bugs de esta sesión.
- El Gate M1 completo vive en el blueprint, Sección 12 — no reinventar el checklist aquí.
- Postgres local (este sandbox): DB `treatment_tech_dev`, rol owner `postgres` / password
  `devpassword`, rol `app_user` / password `devapppassword` — ver `.env.local` (no se
  commitea, está en `.gitignore`). Es un entorno de desarrollo desechable, no usar estas
  credenciales para nada real.
