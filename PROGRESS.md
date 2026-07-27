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

### Bloqueo de `build-inputs/templates-r12/` — resuelto (encontrado en el T7 Shield)
Se creía que faltaban 11 de 19 PDFs R12 en blanco (empezando por Forms 1-7, el más
urgente para curar). El usuario pidió revisar si ya estaban en el disco T7 antes de
pedirlos de nuevo — sí estaban, solo que no en la carpeta
`Treatment Tech - Build Package/` que se venía usando para entregables, sino en
`2026 Data Base Richard Puga/001 Clinical Control - January/Process Control - January/`
(la carpeta base sin sufijo "Copy", que es la plantilla maestra en blanco que se
duplica para cada paciente nuevo — se confirmó que está en blanco, sin PHI, extrayendo
texto de la primera página de cada PDF antes de copiarlo).

Se localizaron y copiaron a `build-inputs/templates-r12/` los 11 módulos que faltaban:
`forms-1-7.pdf`, `process-control.pdf`, `admin-control.pdf`, `assessment.pdf`,
`treatment-plan.pdf`, `case-review.pdf`, `activity-notes-12.pdf`,
`activity-notes-20.pdf`, `activity-notes-75.pdf`, `case-coordination.pdf`,
`admissions.pdf`. `build-inputs/templates-r12/` ahora tiene los 19 módulos completos.

**Corrección sobre un error propio (mismo día):** al comparar el PDF encontrado contra
el `fields.json` ya extraído, reporté que el PDF real tenía más campos (ej. Forms_1-7:
98 → 116) y concluí que la extracción original venía de una revisión vieja del
formulario. Eso era falso — era un bug en mi propio script de comparación: usé
`pypdf.PdfReader.get_fields()`, que además de los campos reales (con `/FT` — tipo de
campo) también devuelve los nodos intermedios del árbol de nombres jerárquico de
AcroForm (ej. `Text6.0.1`, que agrupa a `Text6.0.1.0` y `Text6.0.1.1`), sin `/FT` propio.
Filtrando esos nodos intermedios (`type == "None"`), los 11 módulos coinciden EXACTO,
campo por campo, con el `fields.json` que ya existía en `build-inputs/extracted/` desde
antes de esta sesión — 98/98, 244/244, 360/360, etc., en los 11. **`fields.json`,
`field_scripts.json`, `doc_js.json`, `page_scripts.json` y `option_catalogs.json` de los
19 módulos ya estaban completos y correctos desde antes** — lo único que faltaba de
verdad era copiar los 11 PDFs en blanco a `templates-r12/`, ya resuelto arriba. Se
restauraron los `fields.json` originales (se habían guardado como
`.stale-r12-2024` por precaución; ya no aplica el nombre, eran los correctos) y no se
tocó nada más de `build-inputs/extracted/`.
- [ ] Empezar la curación de labels con la plantilla real de Forms 1-7 (98 campos reales,
  7 páginas, `build-inputs/extracted/Forms_1-7/fields.json` + `field_scripts.json`) — ya
  no depende de material faltante ni de re-extracción.

### Respuestas de Jorge (documento "Preguntas para Jorge — Treatment Tech", 2026-07-26)
Jorge respondió el documento de validación completo. Resumen y qué se hizo con cada
respuesta:

1. **Orden de etapas — confirmado, con corrección aplicada.** El orden real es
   Admisión → Evaluación/Plan de tratamiento → Revisión de caso/Notas de actividad →
   **Egreso → Plan de cuidado continuo**. `CASE_STAGE_ORDER`
   (`src/lib/rules/case-stages.ts`) tenía `continue_care` ANTES de `discharge` —
   corregido, ya no es DRAFT.
2. **Revisión de caso — sin cadencia fija, "a criterio del consejero"**, y puede
   repetirse (hasta 7 vistas por caso en el sistema actual). Anotado en
   `case-stages.ts`: la etapa `case_review` representa "hay al menos una revisión",
   no cada revisión — las revisiones concretas viven como filas repetidas en
   `documents`. Pendiente de M3: UI para listar/crear varias dentro de la misma etapa.
3. **Notas de actividad — nivel confirmado por horas**: Nivel 1 = 20 horas
   (`ActivityNotes20`), Nivel 2 = 75 horas (`ActivityNotes75`); por eliminación,
   Intervención Temprana = `ActivityNotes12`. Útil para cuando se cure el contenido
   de esos 3 módulos — no requirió cambio de código todavía.
4. **Treatment Verification — a solicitud, no en punto fijo.** Solo se genera si la
   Secretaría de Estado (o el cliente) lo pide, generalmente al final. Confirma que
   NO es parte de la secuencia obligatoria de `case_stages` — queda fuera de
   `CASE_STAGE_ORDER` a propósito, disponible bajo demanda.
5. **RN-2 resuelto: "Intensive Outpatient" → `[OP, CCP]`**, 75 horas (mismo combo que
   "Outpatient", en el extremo superior de `HOURS_RANGE.OP`). Aplicado en
   `src/lib/rules/loi.ts` — ya no lanza `UnresolvedLOIError`. Test actualizado en
   `tests/rules/loi.test.ts`. `pnpm typecheck` / `lint` / `test` verdes (44/44).
6. **Administrative Control — NO es obligatorio.** "La agencia tiene la opción de usar
   la tabla de pagos o usar su propio sistema de control." Confirma que el ledger que
   ya construimos (RN-5, `case_balances`) es la fuente de verdad de la plataforma sin
   conflicto — la tabla de pagos del PDF no hay que replicarla funcionalmente.
7. **Case Coordination — condicional, no default.** Solo se llena cuando el caso lo
   requiere (ej. cliente deja el programa sin notificación). Pendiente de M3: modelar
   como documento opcional que se agrega bajo demanda, no como etapa fija.
8. **Firma — los 8 documentos listados SÍ se firman.** Jorge no especificó todavía
   quién firma cada uno (paciente/consejero/ambos) — queda abierto, pero confirma que
   la inmutabilidad de `documents.status = 'signed'` aplica a los 8, no solo a
   algunos.
9. **Catálogos de opciones (referido, educación, estado civil, condado) — confirmados
   sin cambios.** No requiere acción.
10. **Pasos no documentados — ninguno.** Cerrado, no hay proceso oculto que capturar.

### Roster — resuelto con decisión de Ricardo, aplicado y re-sembrado
Jorge regresó el roster con un cambio real (Cindy Torres → Guadalupe G Perez, rol
"Administrativo") y dos ambigüedades que Ricardo resolvió directamente:
- **Los tres correos que regresó Jorge son el mismo** (`duimetropolitan@gmail.com`).
  Decisión de Ricardo: dejarlo con los placeholders `@duimetropolitan.example` por
  ahora (no se puede sembrar un correo compartido — rompe unicidad de Better Auth y
  la trazabilidad de `audit_log`) y ayudarles después a generar correos
  institucionales de dominio propio antes de dar acceso real a producción. **Pendiente
  de negocio, no de código**: ayudar a Jorge a configurar correos por persona con su
  propio dominio (ej. Google Workspace o similar) cuando estén listos.
- **Jorge**: se mantiene como `owner` (no se baja a `counselor` aunque así respondió
  la tabla) — owner ya incluye acceso clínico y además necesita administrar el tenant.
- **Guadalupe G Perez**: rol `admin` (decisión explícita de Ricardo, no `front_desk`
  como tenía el placeholder anterior). Aplicado en `scripts/seed.ts` con nota explícita
  de que `admin` SÍ tiene acceso a documentos clínicos (está en `CLINICAL_ROLES`) — a
  diferencia de Cindy Torres antes, que estaba en `front_desk` sin ese acceso.
- [x] `scripts/seed.ts` actualizado y corrido contra Postgres local desde cero (DB
  recreada, migraciones + RLS/roles + seed reaplicados) — roster real confirmado en la
  tabla `users`: Jorge (`owner`), María I. Torres (`counselor`), Guadalupe G Perez
  (`admin`).
- [x] **Hueco de cobertura encontrado al quitar a Cindy Torres (front_desk) del
  roster**: la regla de RBAC clínico (Gate M2: front_desk no puede abrir documentos
  clínicos) solo se había verificado a mano con Playwright contra esa cuenta de
  prueba — sin ella sembrada por defecto, nadie la vuelve a probar sin querer.
  Agregado `tests/rbac.test.ts` (7 pruebas, cubre los 6 roles + uno inexistente) para
  que esta regla de seguridad no dependa de que alguien recuerde sembrar una cuenta de
  prueba. `pnpm typecheck` / `lint` / `test`: verdes, 51/51.

## Notas de verificación pendientes (no asumir, correr cuando haya DB)
- `pnpm typecheck`, `pnpm lint` y `pnpm test`: correr después de cada bloque de cambios,
  no solo al final — así se atraparon los dos bugs de esta sesión.
- El Gate M1 completo vive en el blueprint, Sección 12 — no reinventar el checklist aquí.
- Postgres local (este sandbox): DB `treatment_tech_dev`, rol owner `postgres` / password
  `devpassword`, rol `app_user` / password `devapppassword` — ver `.env.local` (no se
  commitea, está en `.gitignore`). Es un entorno de desarrollo desechable, no usar estas
  credenciales para nada real.

## Forms 1-7 — primer contenido clínico REAL cargado en el motor (reemplaza demo_intake)

Hasta ahora el motor de formularios (`src/components/form-engine/`) solo se había
probado con `demo_intake`, un schema de 4 campos inventado para probar el motor, no
contenido real. Esta sesión se curó el primer módulo real: **Forms 1-7 (Admisión)**,
contra el AcroForm original (`build-inputs/templates-r12/forms-1-7.pdf`, 7 páginas, 98
campos reales — `Forms_1-7/fields.json` + `field_scripts.json`). Reemplaza a
`demo_intake` como el formulario que se abre desde la etapa "Admisión" del expediente.

**Cómo se curó (nuevo método, útil para los ~18 módulos que faltan):** en vez de
transcribir a mano los nombres crípticos del PDF (`Text6.0.1`, `Dropdown8`, ...), se
renderizaron las 7 páginas como imágenes (`pdftoppm`), se extrajo la posición (`/Rect`)
y el nombre jerárquico resuelto de cada widget, y se dibujaron cajas de color sobre la
imagen de cada página (rojo=texto, azul=dropdown/choice, verde=otros) con el nombre del
campo encima — así se pudo leer visualmente qué campo real corresponde a qué etiqueta
impresa, en vez de adivinar por el nombre técnico. Para las páginas sin texto visible
(p. ej. página 6, "Program Requirements") el contenido real vive en el valor por
defecto (`/V`) del campo — se extrajo de ahí. Para la lógica de mostrar/ocultar y las
fórmulas de cuotas, se leyó `field_scripts.json` (el JavaScript real embebido en el PDF,
disparadores `/AA`) en vez de inventar reglas — esto CONFIRMÓ que `LOI_TO_PROGRAMS` en
`loi.ts` ya era 100% correcto contra la fuente original, y dio las fórmulas reales de
cuotas (`AFSimple_Calculate`), capturadas en `src/lib/rules/fees.ts` (nuevo, con tests).

**Qué se agregó al motor (genérico, no específico de Forms 1-7):**
- Tipo de campo nuevo `"info"` (`form-conditions.ts` + `schema-form.tsx`) — bloque de
  texto de solo lectura (párrafos legales/boilerplate), NO captura dato, no participa
  en autosave, se muestra/oculta con las mismas condiciones RN-7 que cualquier otro
  campo. Es el primer tipo de campo nuevo desde que se construyó el motor.
- Patrón de "banderas sintéticas" para condicionar visibilidad por programa (RN-2 →
  RN-7) SIN tocar el motor de condiciones: `program_re`/`program_ei`/`program_op`/
  `program_ccp` se declaran en `schema.fields` (para que pase la validación de
  referencias) pero NO se listan en ninguna página (nunca se piden al usuario) — su
  valor real lo calcula `forms/[key]/page.tsx` con `getRequiredPrograms(case.loi)` y lo
  inyecta en `initialData`. El motor de condiciones (`computeVisibleFieldKeys`) ya
  soportaba esto sin cambios, porque lee `condition.if` como una llave cualquiera de
  `FormData`, no necesariamente un campo renderizado.

**Contenido de `forms_1_7` (52 campos, 3 páginas — `build-inputs/curated/
forms_1_7.schema.json`, generado con `build-inputs/curated/build_forms_1_7_schema.py`
para evitar errores de transcripción):**
1. **Demographic Data** (35 campos) — datos de admisión reales, etiquetas y opciones
   de dropdown reales (referido, educación, estado civil, condado, etc.).
2. **Program Requirements** (4 bloques `info`) — texto legal real de cada programa
   (Risk Education, Early Intervention, Outpatient, Continuing Care), visible solo si
   la bandera de programa correspondiente es `true`.
3. **Fees & Financial Responsibility** (9 campos) — horas/meses mínimos y cuota por
   sesión de cada programa aplicable (mismo condicionamiento por bandera), más un
   bloque `info` con las provisiones especiales (cuota de reapertura, ver `fees.ts`).

**Prellenado desde el caso** (`forms/[key]/page.tsx`, específico a `key === "forms_1_7"`
a propósito — generalizar el prellenado por schema es trabajo aparte si aparece un
segundo caso de uso): nombre del paciente, fecha de nacimiento, número de licencia de
conducir, nombre del coordinador de admisión (el usuario en sesión), y las 4 banderas
de programa. El documento guardado siempre gana sobre el prellenado si ya se editó.

**Decisión explícita, sin inventar:** se investigó si `employment_describe` (página 1)
debía ocultarse/mostrarse según `employment_type` (patrón visto en otros campos) — no
se encontró ningún disparador en `field_scripts.json` que lo respalde, así que se dejó
SIEMPRE visible. Comentario explícito en `build_forms_1_7_schema.py` documentando que
no se inventó esa condición.

**Verificado end-to-end** (Postgres local recreado desde cero + reseed, servidor dev +
Playwright headless contra un caso real con LOI "Significant Risk" → RE+OP+CCP, sin EI):
prellenado correcto (nombre, DOB, licencia, coordinador), las 3 páginas navegan, la
página 2 muestra los 3 bloques de texto correctos y oculta Early Intervention, la
página 3 muestra los campos de cuota correctos (oculta los de EI) y el bloque de
provisiones especiales, autosave guarda en `documents.data` (incluidas las banderas de
programa, sin que las banderas ni los campos `info` se pidan al usuario). `pnpm
typecheck` / `lint` / `test`: verdes, 64/64 (nuevos: `tests/rules/fees.test.ts`,
`tests/forms-1-7-schema.test.ts`).

**Deliberadamente fuera de alcance de este paso** (no es que falte, es que no es este
paso):
- **Páginas 2, 3, 5 del PDF original** (consentimientos/educación del paciente,
  contenido estático compartido) y **página 4** (RN-6, divulgación 42 CFR Part 2) —
  leídas y transcritas a notas de trabajo pero NO guardadas todavía en un archivo
  curado del repo. Necesitan un patrón de UI distinto (consentimiento/reconocimiento
  con firma) al de `SchemaForm`, no encajan como páginas del mismo formulario.
  Pendiente: crear `build-inputs/curated/forms_1_7_consent_pages.md` con el texto
  extraído antes de construir esa UI.
- **Cálculo de cuota total en vivo en el navegador** — `fees.ts` ya tiene las
  funciones puras (`programFeeCents`, `totalFeeCents`), pero mostrarlas recalculadas
  mientras el consejero edita "Fee per session" es una mejora del motor a futuro, no
  de este schema.
- Los otros ~18 módulos del expediente completo (Forms 1-7 es solo Admisión) — mismo
  método de curación, pendiente uno por uno.

**Próximo paso sugerido (cumplido, ver siguiente sección):** curar el siguiente módulo
(Evaluación, la siguiente etapa de `CASE_STAGE_ORDER`) con el mismo método de
renderizado + overlay + `field_scripts.json`.

## Assessment — segundo contenido clínico REAL curado (etapa "Evaluación")

Segundo módulo curado con el mismo método que Forms 1-7, pero mucho más grande: 12
páginas, ~360 campos reales del AcroForm original
(`build-inputs/templates-r12/assessment.pdf`) — es el "Biopsychosocial Assessment for
Client Placement" estándar ASAM, con las 6 dimensiones (Intoxicación/abstinencia,
Condiciones biomédicas, Condiciones psiquiátricas y cognitivas, Riesgos relacionados al
uso de sustancias, Interacciones con el entorno de recuperación, Consideraciones
centradas en la persona), conclusiones de la evaluación, diagnóstico DSM-5, colocación
ASAM y firma de consejero/médico.

**Curado en 351 campos, 12 páginas, 8 condiciones RN-7** —
`build-inputs/curated/assessment.schema.json`, generado con
`build-inputs/curated/build_assessment_schema.py` (mismo patrón de generador Python que
`forms_1_7`, con loops para las estructuras repetitivas — tabla de sustancias, grilla
DSM-5, grilla de trastornos clínicos, tablas de episodios). Reemplaza a la etapa
"Evaluación" del expediente (antes sin formulario asignado).

**Hallazgo importante que confirma la disciplina de "no inventar":** la página 12 tiene
un campo "ASAM Placement, 4th Edition" (nivel de cuidado ASAM: Level 1/2/3/4) que a
primera vista parece redundante con `cases.loi` (RN-2). Se investigó en
`field_scripts.json` si hay algún trigger que los conecte — no lo hay. Son conceptos
distintos en el PDF real: `cases.loi` es la escala de riesgo DUI específica de Illinois
que ya existe (RN-2, `loi.ts`), mientras que "ASAM Placement" es la escala estándar de
nivel de cuidado clínico ASAM, capturada aquí como dato del assessment sin ninguna
automatización hacia `cases.loi` — no se inventó esa conexión.

**Simplificaciones deliberadas frente al PDF original (documentadas en el propio
generador, `build_assessment_schema.py`):**
1. Los 4 patrones reales "¿Sí/No? → tabla de episodios o N/A" (hospitalizaciones
   médicas, hospitalizaciones psiquiátricas, arrestos, tratamiento previo — confirmados
   en `field_scripts.json`: `BMCC`, `DIM3PS`, `DIM3ADRA`, `DIM5RL`) tenían 3-4 campos
   "N/A" vacíos separados en el PDF original; aquí se colapsan a un solo campo de texto
   "no aplica" por sección — no pierde contenido clínico (los N/A del PDF no llevan
   información distinguible entre sí).
2. Un campo sin lista de opciones confirmada en `option_catalogs.json`
   (`dim4_support_network`, "¿Sus amigos/familia apoyan su tratamiento?") se dejó como
   texto libre en vez de inventar opciones — mismo criterio que `employment_describe`
   en forms_1_7.
3. Los títulos de dimensión IMPRESOS en el PDF se usan como fuente de verdad para
   agrupar contenido (coinciden exactamente con la sección "ASSESSMENT CONCLUSIONS" de
   la página 11), no los prefijos internos de nombre de campo del AcroForm — algunos no
   coinciden entre sí (ej. los campos de la página 7, impresa como "DIMENSION 4", usan
   internamente el prefijo `DIM5RL`; es una inconsistencia del PDF original, no un
   error de esta curación).
4. La firma real (trazo, `signature_pad`) no se captura — igual que forms_1_7, sigue
   pendiente como tarea aparte del motor.
5. `Counselor list 01` aparece con el mismo nombre de campo AcroForm en la página 1 y
   la página 12 del PDF (mismo campo sincronizado) → se declara una sola vez
   (`counselor_name`, página 1) y no se repite, mismo principio de "no repetir captura"
   ya aplicado en forms_1_7.

**Opciones reales, no inventadas** — confirmadas contra
`option_catalogs.json["Assessment"]`: la grilla DSM-5 (36 campos "Never/Sometimes/
Frequently" + 8 campos "Yes/No/I'm not sure" para Tolerancia/Abstinencia), 38 códigos
de diagnóstico DSM-5 reales (F10.x Alcohol, F12.x Cannabis, F14.x Cocaine, F11.x
Opioid — únicamente estas 4 sustancias tienen código en el PDF real, no se inventaron
las demás), 15 opciones reales de colocación ASAM, y la lista real de consejeros
("Maria I Torres, CADC" / "George Torres, BA, CADC" — coincide con el roster
confirmado por Jorge).

**Prellenado desde el caso** (`forms/[key]/page.tsx`, específico a `key ===
"assessment"`): solo `client_name` (nombre del paciente). A diferencia de forms_1_7, NO
se intentó adivinar cuál de los 2 valores fijos de `counselor_name` corresponde a
`session.name` (no coinciden byte a byte: "George (Jorge) Torres" vs "George Torres,
BA, CADC") — se deja que el consejero lo seleccione a mano, documentado explícitamente
en el código como una decisión de "no inventar" en vez de un olvido.

**Verificado end-to-end** (Postgres local recreado desde cero + reseed con los 3
schemas — `demo_intake`, `forms_1_7`, `assessment` —, servidor dev + Playwright
headless contra un caso real nuevo con LOI "Moderate Risk"): el link "Abrir Evaluación"
aparece en la etapa correcta del expediente, las 12 páginas navegan sin error, el
nombre del paciente se prellena correctamente, autosave guarda en `documents.data`, el
campo `dim2_hospitalizations_na` y la tabla de episodios permanecen ambos ocultos
cuando la pregunta Sí/No no se ha respondido (comportamiento RN-7 correcto, no asume
nada), y la página final (diagnóstico DSM-5 + colocación ASAM + firma) muestra las
listas reales completas. `pnpm typecheck` / `lint` / `test`: verdes, 75/75 (nuevo:
`tests/assessment-schema.test.ts`, 11 pruebas).

**Limitación de UX conocida, no nueva de este módulo:** el motor `SchemaForm` no tiene
un layout de "tabla/grilla" — cada celda de la grilla DSM-5 (11 criterios × 4 columnas)
se renderiza como un campo independiente con su etiqueta repetida, en vez de una tabla
visual compacta. Ya era así en el motor desde que se construyó; aquí se nota más por el
tamaño de la grilla (44 campos). Candidato razonable para una mejora futura del motor
(un tipo de campo "grid" que agrupe N campos bajo una sola fila con columnas) si se
sigue curando contenido con esta forma — anotado, no construido todavía (fuera de
alcance de "curar contenido", es cambio de motor).

**Deliberadamente fuera de alcance de este paso:** los otros ~17 módulos restantes del
expediente completo (Treatment Plan, Case Review, Activity Notes x3, Continue Care,
Discharge, Admin Control, Treatment Verification, Status Report, Case Coordination, 4
cartas) — mismo método de curación, pendiente uno por uno. El campo "ASAM Placement" no
se conecta a ningún flujo downstream todavía (es solo dato capturado) — si en el futuro
se decide que debería influir en algo (ej. mostrar una alerta si diverge mucho del LOI
de admisión), es una decisión de producto nueva, no algo que el PDF original ya hace.

**Próximo paso sugerido:** curar el siguiente módulo (probablemente Treatment Plan, la
siguiente etapa de `CASE_STAGE_ORDER`), con el mismo método.

## Treatment Plan — tercer contenido clínico REAL curado (etapa "Plan de tratamiento")

Tercer módulo curado con el mismo método (páginas renderizadas + overlay de posición/
nombre de widget + lectura visual + `field_scripts.json` + `option_catalogs.json`),
contra `build-inputs/templates-r12/treatment-plan.pdf`: 7 páginas, 78 campos únicos del
AcroForm original / 128 instancias de widget (varios campos —encabezado, fechas
objetivo— se repiten/sincronizan por nombre en varias páginas). Es el plan de
tratamiento ASAM de 6 dimensiones (mismas 6 que Assessment) más una página final de
Plan Educativo, Medicamentos, Criterios de Alta y Firmas. Reemplaza a la etapa "Plan de
tratamiento" del expediente (antes sin formulario asignado).

**Curado en 85 campos, 7 páginas, 0 condiciones RN-7** —
`build-inputs/curated/treatment_plan.schema.json`, generado con
`build-inputs/curated/build_treatment_plan_schema.py`. A diferencia de Forms 1-7 y
Assessment, `field_scripts.json` de este módulo NO tiene ninguna lógica condicional de
mostrar/ocultar (solo 4 entradas, todas de formateo de fecha para los campos "Date" y
"Text2") — por eso este schema no necesita ningún `condition` RN-7, es más plano pese a
cubrir 7 páginas.

**Novedad de método:** las ~30 listas de opciones reales de este módulo (varias con 6-7
frases clínicas largas por Problema/Evidenciado por/Meta/Objetivos/Métodos de cada
dimensión) se cargan PROGRAMÁTICAMENTE desde `option_catalogs.json` dentro del
generador (`opts("Dropdown5")`, etc.) en vez de re-transcribirlas a mano como en
`build_assessment_schema.py` — el volumen de texto era mucho mayor y transcribir a mano
introduce riesgo real de error de copiado en contenido clínico. El generador falla
fuerte (`KeyError`) si algún campo referenciado no existe en el catálogo, para que un
typo no produzca en silencio un `<select>` vacío.

**Hallazgo estructural real, preservado tal cual (no es un olvido de curación):** la
Dimensión 1 (página 1) NO tiene en el AcroForm original ningún campo de "As evidenced
by / Goal / Objectives / Methods and frequency / Comments" — solo fecha objetivo
(`dim1_target_date`) y un campo de texto libre "Problem" (`dim1_problem`). El PDF
imprime las etiquetas de esas secciones en la página pero sin caja de formulario
debajo (confirmado por conteo exacto de widgets: 10 en página 1 = 3 encabezado + 5
diagnóstico + fecha + problema). Las Dimensiones 2-6 sí siguen el patrón uniforme
completo.

**Segundo hallazgo real, resuelto con el mismo criterio de "no replicar bugs de
nomenclatura del PDF" ya aplicado en Assessment (ahí en la dirección contraria):**
1. El campo AcroForm "Text2" (fecha objetivo) es LITERALMENTE el mismo nombre de campo
   compartido/sincronizado en las 7 páginas — escribir una fecha en cualquier
   dimensión, en el PDF real, sincroniza el mismo valor en TODAS las demás. Esto no
   tiene sentido de negocio (son 6 fechas objetivo genuinamente distintas por
   dimensión, más la del plan educativo) — se decidió capturarlas como keys DISTINTAS
   (`dim2_target_date` .. `dim6_target_date`, `edu_plan_target_date`) en vez de
   replicar la sincronización accidental.
2. El campo "Date" se repite 3 veces en la página 7 con el mismo nombre AcroForm
   (encabezado del plan + firma del paciente + firma del consejero) — mismo problema,
   misma solución: `plan_date` (reusa el encabezado de la página 1), y
   `patient_review_date` / `counselor_signature_date` como keys nuevas y distintas
   entre sí.
3. El encabezado (`client_name`, `counselor_name`, `diagnosis_line_1..5`) SÍ se reusa
   sin separar — a diferencia de las fechas, es genuinamente el mismo dato (mismo
   paciente, mismo consejero, mismo diagnóstico) en las 7 páginas — mismo principio de
   "no repetir captura" que `counselor_name` en assessment, declarado una sola vez en
   la página 1 y reusado (no repetido) en la página 7 para el bloque de firmas.

**Opciones reales, no inventadas** — confirmadas contra
`option_catalogs.json["TreatmentPlan"]`: 36 códigos de diagnóstico DSM-5 (idénticos a
los 37 de Assessment MENOS "Z03.89 No Diagnosis" — confirmado por diferencia de
conjuntos: `AS only: {"Z03.89 No Diagnosis"}`, `TP only: set()`), la misma lista real
de 2 consejeros, y las ~30 listas de frases clínicas reales por dimensión (Problema/
Evidenciado por/Meta/Objetivos/Métodos), todas cargadas programáticamente (ver
"Novedad de método" arriba) — ninguna opción fue escrita a mano.

**Otras decisiones documentadas en el generador** (`build_treatment_plan_schema.py`,
comentario de cabecera, 10 puntos en total): el valor por defecto visible en el PDF
para "Problem" de Dimensión 1 (`Text11`) no se siembra como valor inicial del campo —
el motor no tiene mecanismo de "default" y sembrar texto clínico de un caso ficticio
sería el mismo tipo de invención que este proyecto evita; "Continued Stay Review
Criteria" (`Text36`) se captura como bloque `info` de solo lectura (boilerplate ASAM
PPC fijo, no dato editable por caso) en vez de campo de texto; la tabla de medicamentos
(3 filas × Nombre/Razón/Dosis) se deja siempre visible sin condición Sí/No, fiel al PDF
real (que tampoco la oculta pese a tener la pregunta "¿necesita medicamento?").

**Prellenado desde el caso** (`forms/[key]/page.tsx`, `key === "treatment_plan"`):
solo `client_name`, mismo criterio que assessment — `counselor_name` y los 5
`diagnosis_line_*` son listas fijas/juicio clínico que no se pueden inferir de forma
confiable, se dejan para selección manual del consejero.

**Verificado end-to-end** (Postgres local recreado desde cero + reseed con los 4
schemas — `demo_intake`, `forms_1_7`, `assessment`, `treatment_plan` —, servidor dev +
Playwright headless contra un caso real nuevo "Luis TPVerifyTest"): el link "Abrir Plan
de Tratamiento" aparece en la etapa correcta del expediente, las 7 páginas navegan sin
error, `client_name` se prellena correctamente, autosave guarda en `documents.data`
(`{"client_name": "Luis TPVerifyTest"}` antes de cualquier otra edición), el bloque
`info` de "Continued Stay Review Criteria" renderiza el párrafo completo, y la tabla de
3×3 medicamentos y el bloque de firmas de la página 7 renderizan correctamente.
`pnpm typecheck` / `lint` / `test`: verdes, 88/88 (nuevo: `tests/treatment-plan-schema.
test.ts`, 13 pruebas).

**Checkpoint sobre la limitación de UX de "grilla" (anotada en la sección de
Assessment):** con este tercer módulo real ya curado, la evidencia es mixta a favor de
seguir esperando — Assessment tenía grillas grandes (DSM-5, trastornos clínicos) que se
beneficiarían de un tipo de campo "grid", pero Treatment Plan no tiene ninguna
estructura de grilla (sus campos repetidos son listas verticales de opciones, no
tablas). Sigue sin haber evidencia suficiente de un patrón dominante que justifique el
cambio de motor ahora — se mantiene la recomendación de revisitar tras 1-2 módulos más
con mejor señal (ej. si Case Review o Activity Notes traen grillas similares a
Assessment).

**Deliberadamente fuera de alcance de este paso:** los ~15 módulos restantes del
expediente completo (Case Review, Activity Notes x3, Continue Care, Discharge, Admin
Control, Treatment Verification, Status Report, Case Coordination, 4 cartas) — mismo
método de curación, pendiente uno por uno.

**Próximo paso sugerido:** curar el siguiente módulo (probablemente Case Review, la
siguiente etapa de `CASE_STAGE_ORDER`), con el mismo método.

## Case Review — cuarto contenido clínico REAL curado (etapa "Revisión de caso")

Cuarto módulo curado con el mismo método, contra
`build-inputs/templates-r12/case-review.pdf`: 2 páginas, 28 campos únicos del AcroForm
original / 33 instancias de widget. Es la "Continued Service Review" / "Outpatient
Treatment" — una revisión periódica de las mismas 6 dimensiones ASAM, más el progreso
del Treatment Plan y la recomendación de nivel de cuidado ASAM. Reemplaza a la etapa
"Revisión de caso" del expediente (antes sin formulario asignado). Nota: como ya
apuntó Jorge (pregunta 1.2, ver sección anterior), un mismo caso puede tener varias
revisiones — este schema es el contenido de UNA revisión; la UI para listar/crear
múltiples revisiones por caso sigue pendiente de M3 (`documents` ya soporta filas
repetidas del mismo `schemaKey` por diseño).

**Curado en 32 campos, 2 páginas, 0 condiciones RN-7** —
`build-inputs/curated/case_review.schema.json`, generado con
`build-inputs/curated/build_case_review_schema.py` (mismo generador con `opts()`
cargando `option_catalogs.json` programáticamente, igual que treatment_plan).
`field_scripts.json` de este módulo tampoco tiene lógica condicional (solo 2 scripts de
formateo de fecha para "Text2") — mismo patrón que Treatment Plan, cero `conditions`.

**Estructura real distinta de Treatment Plan, aunque comparte las 6 dimensiones ASAM:**
en vez de Problem/Evidenced by/Goal/Objectives/Methods, aquí cada dimensión es una
lista de notas de progreso de sesión. La Dimensión 1 tiene UN solo campo
(`dim1_status`) — y ese campo, real, solo tiene UNA opción en todo el catálogo
("Patient presents no signs of intoxication or withdrawals at this time.") — se dejó
tal cual, sin inventar más opciones para completar un `<select>` de apariencia más
"normal". Las Dimensiones 2-6 tienen TRES campos cada una (`dimN_notes_1/_2/_3`) con
listas reales de 6 frases de progreso por dimensión.

**Hallazgo de nomenclatura, resuelto con el mismo criterio que Treatment Plan:** el
campo "Recommendations" de la página 2 está etiquetado así en el PDF, pero su lista de
opciones real (`option_catalogs.json`) es idéntica a la escala de colocación ASAM (15
niveles, mismo catálogo que `asam_placement` en Assessment y Treatment Plan) — se
capturó como `asam_recommendation` preservando la etiqueta real del PDF ("Recommendations")
en vez de renombrarlo a "ASAM Placement", porque así es como este documento específico
lo presenta; el contenido real sigue siendo la escala ASAM. El encabezado "ASAM
PLACEMENT" en sí es solo un título de agrupación visual — NO tiene ningún campo de
formulario propio, no se inventó uno.

**Mismo bug de sincronización "Text2" ya documentado en Treatment Plan:** el campo
AcroForm "Text2" es el mismo nombre compartido entre "Review date" (encabezado) y las
dos fechas de firma (paciente/consejero) en la página 2 — se resolvió igual, con keys
distintas (`review_date`, `patient_review_date`, `counselor_signature_date`).
"Patient name" (`Text1.0`) sí se reusa sin separar (mismo dato real en encabezado y
firma).

**Opciones reales, no inventadas** — confirmadas contra
`option_catalogs.json["CaseReview"]`: tipo de revisión (4 opciones: Continued
stay/Discharge/Transfer/As needed), nivel de intervención (2: Outpatient/Intensive
Outpatient), progreso de metas/objetivos (10 opciones, 10%-100%), 36 códigos DSM-5
(mismo catálogo que treatment_plan), 15 niveles ASAM, y la misma lista real de 2
consejeros (con una variación menor de puntuación en este PDF: "Maria I. Torres, CADC"
con punto, vs. "Maria I Torres, CADC" sin punto en Assessment/Treatment Plan — se
preservó el texto exacto de CADA PDF, no se normalizó entre módulos, porque no hay
evidencia de cuál es la forma "correcta" y unificar sería una inferencia no confirmada).

**Prellenado desde el caso** (`forms/[key]/page.tsx`, `key === "case_review"`): solo
`patient_name` (la key de este schema para el nombre, distinta de `client_name` en
treatment_plan/assessment — el PDF real de Case Review usa "Patient name" en vez de
"Client's name", y se preservó esa diferencia real en vez de forzar una key genérica
compartida entre schemas).

**Verificado end-to-end** (Postgres local recreado desde cero + reseed con los 5
schemas — `demo_intake`, `forms_1_7`, `assessment`, `treatment_plan`, `case_review` —,
servidor dev + Playwright headless contra un caso real nuevo "Carla CRVerifyTest"): el
link "Abrir Revisión de Caso" aparece en la etapa correcta del expediente, las 2
páginas navegan sin error, `patient_name` se prellena correctamente, autosave guarda en
`documents.data` (`{"patient_name": "Carla CRVerifyTest"}` antes de cualquier otra
edición). `pnpm typecheck` / `lint` / `test`: verdes, 100/100 (nuevo:
`tests/case-review-schema.test.ts`, 10 pruebas).

**Deliberadamente fuera de alcance de este paso:** los ~14 módulos restantes (Activity
Notes x3, Continue Care, Discharge, Admin Control, Treatment Verification, Status
Report, Case Coordination, 4 cartas) — mismo método, pendiente uno por uno. La UI para
múltiples revisiones por caso (nota de Jorge, pregunta 1.2) sigue pendiente de M3.

**Próximo paso sugerido:** curar el siguiente módulo — probablemente uno de Activity
Notes (hay 3 variantes: 12/20/75 sesiones, mismo tipo de contenido en distinto tamaño de
tabla) o Discharge, con el mismo método. Vale la pena revisar primero cuál de los
módulos restantes tiene más prioridad clínica/operativa real para Jorge antes de
asumir el orden de `CASE_STAGE_ORDER` a ciegas — Activity Notes probablemente se usa
con más frecuencia en el día a día que Discharge.
