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

## Arrancar en local — con Postgres local (sin esperar a Neon)

La app corre completa contra un Postgres normal mientras no exista la cuenta de Neon
(login real incluido) — ver `src/lib/db/driver-detect.ts` y DEVIATIONS.md. El orden
importa: las tablas de Better Auth y el script de RLS/roles deben existir ANTES de
sembrar datos.

```bash
# 1. Postgres local con una base vacía (ejemplo con el Postgres del sistema):
createdb treatment_tech_dev
psql -d treatment_tech_dev -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"

# 2. .env.local — ver .env.example. DATABASE_URL_MIGRATIONS = tu rol owner local;
#    DATABASE_URL = la del rol app_user (se crea en el paso 4, con la password que
#    pongas en 0001_rls_and_roles.sql).
cp .env.example .env.local

pnpm install

# 3. Tablas: negocio (schema.ts) + Better Auth (auth-schema.ts, generado por su CLI).
pnpm db:generate && pnpm db:migrate

# 4. RLS, roles y grants — DESPUÉS de las tablas, incluidas las de Better Auth.
#    Reemplaza <APP_USER_PASSWORD> por una contraseña real antes de correr esto.
psql -d treatment_tech_dev -f drizzle/sql/0001_rls_and_roles.sql

# 5. Seed: tenant + Archer + roster + cuentas reales de Better Auth (login funcional).
pnpm db:seed

pnpm dev
```

Con eso, `/login` acepta las cuentas sembradas (ver la salida de `pnpm db:seed` para la
contraseña) y `/dashboard` incluye un simulador de las reglas RN-2/RN-3 — útil para
mostrar que la lógica de Jorge quedó bien capturada sin tener que leer código.

## Arrancar contra Neon real (producción/preview)

Mismo flujo, pero `DATABASE_URL`/`DATABASE_URL_MIGRATIONS` apuntan a Neon en vez de
localhost — el driver cambia solo, no hay nada que tocar a mano.

## Comandos

Ver tabla en `CLAUDE.md`.
