CREATE SCHEMA IF NOT EXISTS tests;
DROP TABLE IF EXISTS tests.results; CREATE TABLE tests.results(name text, ok boolean, got text, want text);
CREATE OR REPLACE FUNCTION tests.x(uid text, rl text, q text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(uid,''), true);
  EXECUTE 'SET LOCAL ROLE '||rl;
  BEGIN
    EXECUTE q; GET DIAGNOSTICS n = ROW_COUNT; RESET ROLE; RETURN 'ok:'||n;
  EXCEPTION WHEN OTHERS THEN RESET ROLE; RETURN 'err:'||SQLSTATE;
  END;
END $$;
CREATE OR REPLACE FUNCTION tests.t(name text, uid text, rl text, q text, want text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE g text := tests.x(uid, rl, q);
BEGIN INSERT INTO tests.results VALUES (name, g = want, g, want); END $$;
CREATE OR REPLACE FUNCTION tests.state(name text, q text, want text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE g text;
BEGIN EXECUTE q INTO g; INSERT INTO tests.results VALUES (name, g = want, g, want); END $$;

\set C1 '''00000000-0000-0000-0000-0000000000c1'''
\set C2 '''00000000-0000-0000-0000-0000000000c2'''
\set UA '''00000000-0000-0000-0000-0000000000a1'''
\set UB '''00000000-0000-0000-0000-0000000000b1'''
\set D1 '''00000000-0000-0000-0000-0000000000d1'''
\set QC1 ''''''''00000000-0000-0000-0000-0000000000c1''''''''
\set QC2 ''''''''00000000-0000-0000-0000-0000000000c2''''''''
\set QUA ''''''''00000000-0000-0000-0000-0000000000a1''''''''
\set QUB ''''''''00000000-0000-0000-0000-0000000000b1''''''''
\set QD1 ''''''''00000000-0000-0000-0000-0000000000d1''''''''
\set IDA '11111111-1111-1111-1111-111111111111'
\set IDB '22222222-2222-2222-2222-222222222222'

