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

### Hecho (2026-07-26, cuarta pasada — sistema de diseño nuevo, benchmarked contra BestNotes)
Investigación de la competencia directa (BestNotes) — features, precios y, sobre todo,
reseñas reales de usuarios pagando por el producto — mostró un patrón consistente: es
funcional pero se percibe anticuado ("still feels like DOS", "very old school", "look
& feel was also lacking"). Esa es exactamente la brecha a explotar. Resultado en dos
partes:

1. **Documento de estrategia** — `Estrategia Competitiva — Superar a BestNotes.md`,
   entregado aparte, con el análisis completo y la hoja de ruta de diseño/producto.
2. **El sistema de diseño ya se aplicó a la app real, no solo se describió**:
   - `src/app/globals.css`: tokens explícitos (paleta índigo/slate + semánticos por
     estado, radios, sombras) en vez de clases sueltas repetidas por archivo.
   - `src/components/ui/badge.tsx` y `card.tsx` (nuevos): primitivos reutilizables,
     los mismos que va a necesitar el hub de expediente en M2.
   - `src/components/nav-link.tsx` (nuevo): estado activo en la navegación.
   - Shell (`(app)/layout.tsx`), login (`login/page.tsx`, `login-form.tsx`) y
     dashboard (`dashboard/page.tsx`, `rules-demo.tsx`) — rediseñados sobre esos
     tokens: sidebar con iconos y marca, login split-screen con panel de marca,
     tarjetas de KPI, badges de color por riesgo/estado en el simulador RN-2/RN-3.
   - **Verificado con Playwright contra Postgres local + login real**: capturas de
     `/login` (desktop y mobile) y `/dashboard` autenticado, revisadas visualmente
     antes de entregar. `pnpm typecheck`, `pnpm lint` y `pnpm test` (31/31) en verde
     después del cambio.
   - No es una desviación del blueprint (no cambia arquitectura, datos ni reglas) —
     por eso no lleva entrada en `DEVIATIONS.md`. Es una mejora de UI acumulativa
     sobre el mismo esqueleto de M1.

## Milestone 2 (adelantado sin esperar cuentas pendientes) — arrancó 2026-07-26

Blueprint dice M2 = semanas 2-3, pero los pasos 3-6 (CRUD de pacientes, `lib/case-number.ts`
ya existía de antes, hub del expediente v1) no dependen de Neon/Vercel/AWS reales —
igual que el resto de este avance, se construyó y probó contra Postgres local.

### Hecho
- [x] **Sesión real conectada de punta a punta** (antes solo login sin nada detrás):
  - `src/lib/auth.ts`: `user.additionalFields` agrega `tenantId`/`businessUserId` a la
    cuenta de Better Auth — resuelve un problema real de huevo-y-gallina (la tabla de
    negocio `users` tiene RLS; no se puede saber el tenant leyéndola sin ya saber el
    tenant). Migración `drizzle/0002_aberrant_romulus.sql` generada y aplicada;
    `scripts/seed.ts` actualizado para pasar ambos campos al crear cada cuenta.
  - `src/lib/session.ts` (nuevo): `getCurrentSession()`/`requireSession()` — sesión de
    Better Auth + perfil de negocio real (rol, nombre, activo) en una sola llamada.
  - `(app)/layout.tsx`: ya no es placeholder — redirige a `/login` sin sesión válida
    (defensa en profundidad además del proxy), muestra nombre/tenant real, logout real.
- [x] **Admisión completa** (`src/lib/actions/admissions.ts` + `/cases/new`): paciente
  + caso + número de caso (RN-1) + etapas iniciales (`case_stages`, orden de
  `src/lib/rules/case-stages.ts`, derivado de `nav_graph.json`) en UNA transacción —
  si el LOI no tiene mapeo resuelto en RN-2, no se crea nada a medias.
- [x] **Admissions Control** (`/cases`): lista con filtros de ubicación/estatus/mes y
  saldo (vía la vista `case_balances`, RN-5).
- [x] **Hub del expediente v1** (`/cases/[id]`): CaseHeader, programas requeridos
  derivados de LOI (RN-2, nunca duplicados como columna), StageMap, saldo, consents
  (vacío por ahora — se llena desde intake, aún sin curar).
- [x] Refactor sin cambio de comportamiento para permitir transacciones compuestas:
  `assignCaseNumberTx`/`recordAuditTx` (reciben una `tx` ya abierta) — `assignCaseNumber`/
  `recordAudit` originales siguen existiendo como envoltorio de conveniencia. Se
  exporta `Tx` desde `lib/db/rls.ts` para tipar esto sin `any`.
- [x] Verificado con Playwright, en navegador real, flujo completo: login → nueva
  admisión (dos pacientes seguidos, case_number 001/002 sin huecos ni duplicados,
  igual que probó `tests/rules/case-number.test.ts` pero ahora por la UI real) → hub
  del caso con programas/etapas/saldo correctos → lista de admisiones con datos reales.
- [x] `tests/rules/case-stages.test.ts` (3 tests) — 34 pruebas totales en verde.

### Bug real encontrado y corregido
`sql\`WHERE case_id = ANY(${caseIds}::uuid[])\`` con el driver `pg` NO pasa el array de
JS como un solo parámetro de tipo array de Postgres — drizzle lo expande en parámetros
separados por coma, produciendo SQL inválido (`ANY(($1, $2)::uuid[])`). Encontrado
corriendo `/cases` de verdad (typecheck y tests no lo atrapan, porque el error solo
existe en tiempo de ejecución contra Postgres). Corregido con
`IN (${sql.join(caseIds.map(id => sql\`${id}::uuid\`), sql\`, \`)})` — el patrón correcto
de drizzle para `IN` dinámico con SQL crudo. Queda como nota de código en
`src/app/(app)/cases/page.tsx` para no repetir el error si se agrega otra consulta así.

### Hecho (mismo día, segunda pasada de M2) — ledger manual
- [x] `src/lib/actions/ledger.ts`: `createLedgerEntry` / `voidLedgerEntry`. Validaciones
  del Gate M2 ("no pagos negativos, void con motivo"): monto se valida como positivo
  antes de tocar la base; anular exige un motivo (mín. 3 caracteres) que se guarda en
  `audit_log.details` — no hay columna de razón en `ledger_entries` (ni en el blueprint
  ni en el schema), la bitácora inmutable es el lugar correcto para ese dato.
- [x] `/cases/[id]/ledger`: formulario de movimiento + tabla con anulación inline;
  enlazado desde el hub del caso ("Ver ledger" junto al saldo).
- [x] **`tests/ledger.test.ts` — el escenario EXACTO del Gate M2**: cargo $1,500,
  pagos $500+$300 → saldo $700 (contra Postgres real, vía la vista `case_balances`,
  no una reimplementación en JS del cálculo). Segunda prueba: un pago anulado no
  cuenta en el saldo. 36 pruebas totales en verde.
- [x] Verificado con Playwright en navegador real: agregar cargo+2 pagos → saldo
  $700.00 en pantalla; anular uno de los pagos → saldo sube a $1,000.00 al instante,
  la fila queda marcada "anulado" y pierde el botón de anular.

### Hecho (mismo día, tercera pasada de M2) — motor de formularios v1
- [x] **`<SchemaForm/>`** (`src/components/form-engine/schema-form.tsx`): renderiza
  cualquier `form_schemas.schema` — tipos de campo (text/textarea/number/date/select/
  radio/checkbox), multipágina, autosave de borrador con debounce, bloqueo de edición
  cuando el documento ya está `completed`/`signed`.
- [x] **RN-7 (visibilidad condicional) implementada y separada del componente**:
  `src/lib/rules/form-conditions.ts` — `computeVisibleFieldKeys()` interpreta
  `{if, eq, show}` declarativo, más `findDanglingFieldReferences()` para detectar un
  schema con una key de campo que no existe. 7 pruebas unitarias, incluido el caso
  exacto del Gate M3 (responder "No" en BMCC oculta evidencia y muestra el campo N/A).
- [x] **RBAC del Gate M2 implementado de verdad, no solo descrito**: `src/lib/rbac.ts`
  (`canAccessClinicalDocuments`) — front_desk/billing no pueden abrir ni guardar un
  documento clínico; el check vive en la página (antes de tocar la base) Y en las dos
  acciones de guardado, por separado — la UI nunca es la única defensa.
- [x] `src/lib/actions/documents.ts`: `saveDraftDocument` / `completeDocument`, ambas
  respetan la inmutabilidad de documentos `signed` (regla no negociable de CLAUDE.md).
- [x] Schema **`demo_intake`** sembrado (2 páginas, 4 campos, 1 condicional) —
  EXPLÍCITAMENTE de prueba, no contenido clínico real (mismo criterio que el
  simulador de RN-2/RN-3 del dashboard). La curación real de Forms 1-7 sigue
  pendiente y sigue siendo trabajo con Jorge, no algo que este motor adivine.
- [x] Verificado con Playwright en navegador real: llenar página 1 dispara el
  condicional RN-7 en pantalla (aparece "Prior treatment details" al elegir "Yes"),
  autosave visible ("borrador guardado"), completar el formulario → estado
  `completed` persiste tras recargar la página (no es solo estado de React) y los
  campos quedan bloqueados; una segunda cuenta con rol `front_desk` (Cindy Torres,
  ya sembrada) recibe la pantalla de "Acceso restringido" al intentar abrir el mismo
  formulario — la regla de RBAC del Gate M2 confirmada con una cuenta real, no solo
  leyendo el código.
- [x] 6 pruebas nuevas (`tests/rules/form-conditions.test.ts`) — 43 pruebas totales.

### Bug real encontrado y corregido
`src/lib/actions/documents.ts` (archivo `"use server"`) exportaba
`canAccessClinicalDocuments`, una función síncrona normal — Next.js exige que TODO
export de un módulo `"use server"` sea una Server Action async, y el build entero
truena ("Server Actions must be async functions") en cuanto un Server Component la
importa solo para un chequeo de rol. Encontrado corriendo la página del formulario de
verdad (ni typecheck ni lint lo atrapan — es una regla de Next.js en tiempo de build/
runtime, no de TypeScript). Corregido moviendo el helper de RBAC a `src/lib/rbac.ts`,
un módulo plano sin `"use server"`, importable tanto desde acciones como desde Server
Components. Queda como nota para no repetir el patrón: nunca exportar un helper
síncrono desde un archivo `"use server"`.

### Pendiente de M2 (curación de contenido, no de plomería)
- [ ] Paso 1-2: curar `form_schemas` real (`forms_1_7`) contra `build-inputs/` — el
  motor que lo va a renderizar ya existe y ya está probado; falta el contenido, que
  es trabajo con Jorge, no de ingeniería.
- [ ] Firma (`SignaturePad`) + subida a almacenamiento — depende de que se confirme
  DigitalOcean Spaces o, en su defecto, AWS (ver ADR-017).
- [ ] Stripe Checkout (el ledger manual ya cubre cargos/pagos a mano; falta el webhook
  de Stripe cuando exista la cuenta de prueba).

## Notas de verificación pendientes (no asumir, correr cuando haya DB)
- `pnpm typecheck`, `pnpm lint` y `pnpm test`: correr después de cada bloque de cambios,
  no solo al final — así se atraparon los dos bugs de esta sesión.
- El Gate M1 completo vive en el blueprint, Sección 12 — no reinventar el checklist aquí.
- Postgres local (este sandbox): DB `treatment_tech_dev`, rol owner `postgres` / password
  `devpassword`, rol `app_user` / password `devapppassword` — ver `.env.local` (no se
  commitea, está en `.gitignore`). Es un entorno de desarrollo desechable, no usar estas
  credenciales para nada real.
