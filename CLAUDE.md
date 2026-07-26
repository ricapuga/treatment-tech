@AGENTS.md

# Treatment Tech

Plataforma SaaS clínica para tratamiento de sustancias/DUI. Cliente cero y piloto:
DUI Metropolitan Services, Inc. (Archer, Chicago) — creado y operado por Jorge Torres,
socio fundador del proceso clínico. Estado actual: **en construcción, Milestone 1 en
curso**. Ver `PROGRESS.md` para el detalle de qué está hecho.

**Fuente de verdad:** `treatment-tech-blueprint.md` (vive junto a este repo, en la
carpeta del paquete de construcción). Léelo completo antes de escribir código. Si este
archivo y el blueprint difieren, gana el blueprint. `treatment-tech-adr.md` tiene el
razonamiento detrás de cada decisión — incluye ADR-016, que explica por qué Archer se
construye como instancia permanente y autosuficiente, no como piloto desechable.

## Protocolo de ejecución
1. **Ubícate.** Lee `PROGRESS.md`: milestone actual y último paso completado.
2. **Trabaja el milestone actual** paso a paso, en orden, como está en la Sección 12
   del blueprint.
3. **Corre el gate.** Al final del milestone ejecuta TODOS los checks. Todos deben pasar.
4. **Registra.** Actualiza `PROGRESS.md`: milestone, pasos, resultados del gate, timestamp.
5. **Avanza** al siguiente. Repite hasta pasar el gate final (M5).

## Disciplina de gates (no negociable)
- NUNCA avances con un gate en rojo. Arregla hasta verde.
- Si un gate no pasa tras 3 intentos distintos, DETENTE y escribe el reporte de desviación.
- Los gates se EJECUTAN, no se asumen. Corre los comandos y lee la salida.

## Protocolo de desviación
Si debes desviarte del blueprint (librería deprecada, API cambió, flag ⚠ VERIFY se
resolvió distinto):
1. Haz la desviación mínima viable que preserve la intención.
2. Regístrala en `DEVIATIONS.md`: qué decía el blueprint, qué hiciste, por qué, impacto
   en milestones posteriores.
3. Si la desviación invalida secciones posteriores, DETENTE y pide al usuario llevar
   `DEVIATIONS.md` a The Architect para parchar el blueprint. No improvises otra
   arquitectura.

## Hábitos de verificación
- Tras cada paso: la app sigue corriendo / tests siguen verdes. Sin estados rotos entre
  pasos.
- Antes de cada commit: `pnpm lint` y `pnpm typecheck` en verde.
- Commit mínimo por milestone: `M{n}: {resumen}`.

## Stack rápido
Next.js 16.2 · TypeScript strict · Tailwind v4 + shadcn/ui (init manual, ver
DEVIATIONS.md) · next-intl (es/en, por cookie no por URL) · Neon Postgres (HIPAA/BAA) +
Drizzle · Better Auth · pdf-lib · signature_pad · Stripe · AWS S3 (BAA) · Vercel Pro (BAA)

## Comandos
| Acción | Comando |
|---|---|
| Dev | `pnpm dev` |
| Lint / Typecheck | `pnpm lint` / `pnpm typecheck` |
| Unit tests | `pnpm test` |
| E2E | `pnpm test:e2e` |
| Generar migración | `pnpm db:generate` |
| Migrar (owner) | `pnpm db:migrate` — luego correr a mano `drizzle/sql/0001_rls_and_roles.sql` |
| Seed | `pnpm db:seed` |

## Environment
Ver blueprint Sección 13 y `.env.example`. Pide al usuario las llaves del milestone en
curso, no todas por adelantado. M1: DATABASE_URL, DATABASE_URL_MIGRATIONS,
BETTER_AUTH_*, RESEND. M2: AWS_*, STRIPE_*, UPSTASH_*.

## Estándares de código
TS strict sin `any`; validación Zod en toda action/route; toda mutación y toda lectura
de expediente escribe audit_log vía `lib/audit.ts`; reglas de negocio SOLO en
`lib/rules/` con unit tests; documentos `signed` inmutables; cadenas UI SOLO vía
next-intl (nada hardcodeado); PHI jamás en logs, emails, ni metadata de Stripe; toda
tabla con PHI se toca SOLO vía `withTenant()` de `src/lib/db/rls.ts` — nunca el cliente
de `src/lib/db/client.ts` directamente.

## Qué NO hacer
- No agregues features fuera del blueprint (anótalas en `IDEAS.md`).
- No cambies tecnologías sin protocolo de desviación.
- No saltes tests para pasar un gate.
- No commitees secretos ni `.env`.
- No toques la Fase 2 (migración histórica masiva, multi-clínica self-serve, e-fax) —
  fuera de alcance v1.
- No construyas nada que dependa de que exista un SEGUNDO tenant para funcionar. Archer
  debe operar sola, indefinidamente, como caso normal del sistema (ADR-016).
