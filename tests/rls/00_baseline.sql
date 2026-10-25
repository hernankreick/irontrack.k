-- Esquema BASE RECONSTRUIDO (no es un dump de producción): emula Supabase (roles, auth.uid(), auth.jwt()) y el estado inseguro
-- confirmado en la auditoría (acceso_total, grants amplios). Tipos mixtos a propósito (uuid/text). Solo para PostgreSQL local efímero.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
CREATE SCHEMA auth;
-- raw_app_meta_data: lo escribe SOLO el servidor (Admin API). raw_user_meta_data: lo edita el propio usuario.
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_app_meta_data jsonb NOT NULL DEFAULT '{}', raw_user_meta_data jsonb NOT NULL DEFAULT '{}');
-- Igual que Supabase: los claims salen del JWT (request.jwt.claims).
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
 $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
 $$ SELECT nullif(auth.jwt() ->> 'sub', '')::uuid $$;
GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.jwt() TO anon, authenticated;

\ir 00b_public_schema.sql
