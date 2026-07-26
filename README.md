# Treatment Tech

Plataforma web para DUI Metropolitan Services, Inc. (Archer) — reemplazo del sistema
de PDFs/Adobe diseñado y operado por Jorge Torres. Piloto pensado para funcionar de
forma permanente en Archer (ADR-016), con posibilidad de escalar a más clínicas
después de validarse ahí.

**Antes de tocar código, lee `CLAUDE.md` y `PROGRESS.md`.** La especificación completa
vive en `treatment-tech-blueprint.md` (junto a este repo, en la carpeta del paquete de
construcción) — este README no la repite.

## Estado

Milestone 1 en curso. Ver `PROGRESS.md` para el detalle exacto de qué está hecho y qué
falta (la mayor parte de lo que falta depende de cuentas de terceros que aún no
existen — Vercel, Neon, AWS, Stripe, Resend, Upstash).

## Arrancar en local

```bash
cp .env.example .env.local   # completar con las llaves reales una vez existan las cuentas
pnpm install
pnpm db:generate && pnpm db:migrate   # requiere DATABASE_URL_MIGRATIONS (owner)
# correr a mano drizzle/sql/0001_rls_and_roles.sql contra la misma DB (crea app_user + policies)
pnpm db:seed
pnpm dev
```

## Comandos

Ver tabla en `CLAUDE.md`.
