CREATE SCHEMA IF NOT EXISTS tests;
DROP TABLE IF EXISTS tests.results; CREATE TABLE tests.results(name text, ok boolean, got text, want text);
-- tests.x: ejecuta q como `rl` con un JWT simulado. claims = jsonb COMPLETO del token (sub, app_metadata, user_metadata...). NULL = anon.
CREATE OR REPLACE FUNCTION tests.x(claims jsonb, rl text, q text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  PERFORM set_config('request.jwt.claims', coalesce(claims::text,''), true);
  EXECUTE 'SET LOCAL ROLE '||rl;
  BEGIN
    EXECUTE q; GET DIAGNOSTICS n = ROW_COUNT; RESET ROLE; RETURN 'ok:'||n;
  EXCEPTION WHEN OTHERS THEN RESET ROLE; RETURN 'err:'||SQLSTATE;
  END;
END $$;
CREATE OR REPLACE FUNCTION tests.t(name text, claims jsonb, rl text, q text, want text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE g text := tests.x(claims, rl, q);
BEGIN INSERT INTO tests.results VALUES (name, g = want, g, want); END $$;
CREATE OR REPLACE FUNCTION tests.state(name text, q text, want text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE g text;
BEGIN EXECUTE q INTO g; INSERT INTO tests.results VALUES (name, g = want, g, want); END $$;
-- JWT de cuentas del seed
CREATE OR REPLACE FUNCTION tests.jwt(uid text, app jsonb DEFAULT '{}', usr jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql AS
 $$ SELECT jsonb_build_object('sub',uid,'role','authenticated','app_metadata',app,'user_metadata',usr) $$;
-- Atajos de JWT (cuentas del seed)
CREATE OR REPLACE FUNCTION tests.ja()  RETURNS jsonb LANGUAGE sql AS $$ SELECT tests.jwt('00000000-0000-0000-0000-0000000000a1','{"alumno_id":"11111111-1111-1111-1111-111111111111"}') $$;
CREATE OR REPLACE FUNCTION tests.jb()  RETURNS jsonb LANGUAGE sql AS $$ SELECT tests.jwt('00000000-0000-0000-0000-0000000000b1','{"alumno_id":"22222222-2222-2222-2222-222222222222"}') $$;
CREATE OR REPLACE FUNCTION tests.jc1() RETURNS jsonb LANGUAGE sql AS $$ SELECT tests.jwt('00000000-0000-0000-0000-0000000000c1') $$;
CREATE OR REPLACE FUNCTION tests.jc2() RETURNS jsonb LANGUAGE sql AS $$ SELECT tests.jwt('00000000-0000-0000-0000-0000000000c2') $$;
-- Externo autenticado que ESCRIBIÓ user_metadata afirmando ser entrenador y alumno A (lo único que un usuario puede escribir de su token).
CREATE OR REPLACE FUNCTION tests.jd1() RETURNS jsonb LANGUAGE sql AS $$ SELECT tests.jwt('00000000-0000-0000-0000-0000000000d1','{}',
  '{"role":"entrenador","alumno_id":"11111111-1111-1111-1111-111111111111","entrenador":true}') $$;
-- Cuenta con fila en `entrenadores` (escrita por el cliente) pero fuera de coach_accounts.
CREATE OR REPLACE FUNCTION tests.je1() RETURNS jsonb LANGUAGE sql AS $$ SELECT tests.jwt('00000000-0000-0000-0000-0000000000e1') $$;
