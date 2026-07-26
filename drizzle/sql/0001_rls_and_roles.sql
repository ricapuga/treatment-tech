-- Mecánica de RLS obligatoria — blueprint Sección 7, bloque "RLS — MECÁNICA OBLIGATORIA".
-- Correr DESPUÉS de que drizzle-kit haya generado y aplicado la migración base de tablas.
-- NUNCA saltarse este archivo: sin él, RLS existe en el papel pero no protege nada
-- (ver ADR-006/hallazgo de auditoría — Neon owner role bypassea RLS por defecto).
--
-- Reemplaza <APP_USER_PASSWORD> con un secreto real generado (ej. openssl rand -base64 24)
-- y guárdalo como DATABASE_URL de la app (no la de drizzle-kit, que sí puede usar el owner).

-- 1) Rol dedicado NO-owner para la aplicación. (Debe crearse ANTES que cualquier
-- GRANT que lo referencie — orden real, no solo lógico: un GRANT a un rol
-- inexistente falla la migración completa a medio camino.)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD '<APP_USER_PASSWORD>';
  END IF;
END
$$;

-- 0) Helper: lee app.tenant_id de forma segura.
-- Por qué existe esta función y no un current_setting(...)::uuid repetido en cada
-- policy: una vez que una conexión pooled ha tenido `app.tenant_id` fijado por SET
-- LOCAL al menos una vez, Postgres NO vuelve a NULL el valor "leído sin set" en esa
-- conexión — vuelve a '' (string vacío), porque es un GUC personalizado (no nativo).
-- current_setting('app.tenant_id', true)::uuid sobre '' lanza
-- "invalid input syntax for type uuid" en vez de devolver NULL — eso rompe la
-- garantía fail-closed (0 filas) y en su lugar tira un error 500 la primera vez que
-- una query toca una conexión reciclada sin pasar por withTenant(). Encontrado y
-- corregido en la corrida de validación local del 2026-07-26 (ver DEVIATIONS.md).
CREATE OR REPLACE FUNCTION app_current_tenant_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$;

GRANT EXECUTE ON FUNCTION app_current_tenant_id() TO app_user;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Tablas de Better Auth (user/session/account/verification, generadas por
-- `pnpm dlx @better-auth/cli generate` — ver src/lib/db/auth-schema.ts) necesitan
-- DELETE además de SELECT/INSERT/UPDATE (logout borra la fila de session; limpieza
-- de tokens de verification vencidos). Estas 4 tablas NO llevan RLS ni tenant_id —
-- son metadata de autenticación, no PHI clínico (ver comentario en src/lib/auth.ts).
GRANT SELECT, INSERT, UPDATE, DELETE ON account, session, "user", verification TO app_user;

-- Blindaje a futuro: si se agregan tablas nuevas más adelante (ej. la tabla de
-- twoFactor cuando se active el plugin de 2FA de Better Auth, blueprint M1 paso 5),
-- que no dependan de correr este script de GRANTs a mano otra vez. Solo aplica a
-- tablas creadas por el MISMO rol que ejecuta este ALTER DEFAULT PRIVILEGES — o sea,
-- correr este archivo con el mismo rol owner que corre las migraciones de drizzle-kit.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;

REVOKE UPDATE, DELETE ON audit_log FROM app_user; -- bitácora inmutable también para la app
REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC;

-- 2) FORCE ROW LEVEL SECURITY en toda tabla con tenant_id + política de aislamiento.
--    FORCE es indispensable: sin él, el dueño de la tabla (o un rol con privilegios de
--    tabla directos) sigue viendo todo aunque RLS esté "enabled".
DO $$
DECLARE
  tbl text;
BEGIN
  -- case_stages y signatures se excluyen de este loop genérico: ninguna de las dos
  -- tiene columna tenant_id propia (case_stages solo tiene case_id; signatures solo
  -- document_id) — llevan política dedicada por EXISTS/JOIN más abajo. Incluirlas
  -- aquí falla en tiempo de ejecución ("column tenant_id does not exist") — error
  -- real encontrado y corregido en la corrida de validación local del 2026-07-26.
  FOREACH tbl IN ARRAY ARRAY[
    'locations','users','patients','cases','documents',
    'attendance_sessions','ledger_entries','consents','urine_screens',
    'files','catalogs','content_library'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format(
      'DROP POLICY IF EXISTS tenant_isolation ON %I', tbl
    );
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = app_current_tenant_id())',
      tbl
    );
  END LOOP;
END
$$;

-- catalogs y content_library son NULL para tenant_id cuando son globales — la política
-- de arriba los ocultaría siempre. Se sustituye por una que permite global U propio tenant.
DROP POLICY IF EXISTS tenant_isolation ON catalogs;
CREATE POLICY tenant_isolation ON catalogs
  USING (tenant_id IS NULL OR tenant_id = app_current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation ON content_library;
CREATE POLICY tenant_isolation ON content_library
  USING (tenant_id IS NULL OR tenant_id = app_current_tenant_id());

-- signatures no tiene tenant_id propio (vive vía documents) — se aisla por EXISTS/JOIN
-- contra documents. Defensa en profundidad: aunque toda query de la app también debería
-- filtrar por caso/documento, esta política bloquea el acceso aunque esa disciplina falle.
ALTER TABLE signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE signatures FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON signatures;
CREATE POLICY tenant_isolation ON signatures
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = signatures.document_id
        AND d.tenant_id = app_current_tenant_id()
    )
  );

-- case_stages tampoco tiene tenant_id propio (vive vía cases) — mismo patrón que signatures.
ALTER TABLE case_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_stages FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON case_stages;
CREATE POLICY tenant_isolation ON case_stages
  USING (
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = case_stages.case_id
        AND c.tenant_id = app_current_tenant_id()
    )
  );

-- 3) Vista de saldo — RN-5: el saldo nunca se almacena, siempre se calcula.
CREATE OR REPLACE VIEW case_balances AS
  SELECT case_id,
    SUM(CASE WHEN kind = 'charge' AND NOT voided THEN amount_cents ELSE 0 END)
  - SUM(CASE WHEN kind = 'payment' AND NOT voided THEN amount_cents ELSE 0 END)
  + SUM(CASE WHEN kind = 'adjustment' AND NOT voided THEN amount_cents ELSE 0 END) AS balance_cents
  FROM ledger_entries
  GROUP BY case_id;

GRANT SELECT ON case_balances TO app_user;

-- NOTA CRÍTICA para lib/db/rls.ts:
-- Con connection pooling (Neon en modo transacción), un SET de sesión normal NO persiste
-- entre queries. Toda operación de la app debe ir envuelta en una transacción con
--   SET LOCAL app.tenant_id = '<uuid>';
-- ejecutado como PRIMER statement de esa transacción. SET LOCAL, nunca SET a secas.
-- Ver src/lib/db/rls.ts para el wrapper que hace esto automáticamente.
