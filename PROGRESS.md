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

### Pendiente para cerrar M1 (bloqueado por credenciales que Ricardo debe crear)
- [ ] Paso 2: cuentas Vercel Pro (BAA), Neon (Scale + HIPAA + BAA), AWS (BAA en Artifact),
      Stripe (test), Resend, Upstash — ver checklist entregado aparte.
- [ ] Correr `drizzle-kit generate` + `drizzle-kit migrate` contra Neon real (owner), luego
      `drizzle/sql/0001_rls_and_roles.sql` a mano (o vía script de migración) para crear
      `app_user` y las políticas.
- [ ] Correr `scripts/seed.ts` contra la DB real.
- [ ] `pnpm build` limpio + deploy a Vercel + smoke test.
- [ ] Test SQL de RLS (Gate M1 checklist ítem 4) — implementar en `tests/rls.test.ts` una vez
      haya DB real contra la cual correr.

### Sin bloqueo — se puede seguir avanzando ahora mismo sin las cuentas
- Curación del formulario de intake (`forms_1_7`) leyendo `build-inputs/templates-r12/`
  (adelanto de M2 paso 2) se puede empezar en paralelo.
- Formulario de login real (conectar a `auth.api.signInEmail`) — trivial una vez exista
  DATABASE_URL, no requiere las otras cuentas.

## Notas de verificación pendientes (no asumir, correr cuando haya DB)
- `pnpm typecheck` y `pnpm lint`: correr después de cada bloque de cambios, no solo al final.
- El Gate M1 completo vive en el blueprint, Sección 12 — no reinventar el checklist aquí.
