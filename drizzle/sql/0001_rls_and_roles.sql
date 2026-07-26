-- Mecánica de RLS obligatoria — blueprint Sección 7, bloque "RLS — MECÁNICA OBLIGATORIA".
-- Correr DESPUÉS de que drizzle-kit haya generado y aplicado la migración base de tablas.
-- NUNCA saltarse este archivo: sin él, RLS existe en el papel pero no protege nada
-- (ver ADR-006/hallazgo de auditoría — Neon owner role bypassea RLS por defecto).
--
-- Reemplaza <APP_USER_PASSWORD> con un secreto real generado (ej. openssl rand -base64 24)
-- y guárdalo como DATABASE_URL de la app (no la de drizzle-kit, que sí puede usar el owner).

-- 1) Rol dedicado NO-owner para la aplicación.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD '<APP_USER_PASSWORD>';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
REVOKE UPDATE, DELETE ON audit_log FROM app_user; -- bitácora inmutable también para la app
REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC;

-- 2) FORCE ROW LEVEL SECURITY en toda tabla con tenant_id + política de aislamiento.
--    FORCE es indispensable: sin él, el dueño de la tabla (o un rol con privilegios de
--    tabla directos) sigue viendo todo aunque RLS esté "enabled".
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'locations','users','patients','cases','case_stages','documents',
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
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_setting(''app.tenant_id'', true)::uuid)',
      tbl
    );
  END LOOP;
END
$$;

-- catalogs y content_library son NULL para tenant_id cuando son globales — la política
-- de arriba los ocultaría siempre. Se sustituye por una que permite global U propio tenant.
DROP POLICY IF EXISTS tenant_isolation ON catalogs;
CREATE POLICY tenant_isolation ON catalogs
  USING (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation ON content_library;
CREATE POLICY tenant_isolation ON content_library
  USING (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id', true)::uuid);

-- signatures no tiene tenant_id propio (vive vía documents) — RLS por join no es nativo
-- de Postgres; se restringe a nivel de aplicación (toda query de signatures pasa por
-- lib/db/rls.ts + un JOIN/EXISTS contra documents en la query, nunca acceso directo).
-- Igual se fuerza RLS con una política restrictiva basada en EXISTS para defensa en profundidad.
ALTER TABLE signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE signatures FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON signatures;
CREATE POLICY tenant_isolation ON signatures
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = signatures.document_id
        AND d.tenant_id = current_setting('app.tenant_id', true)::uuid
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
