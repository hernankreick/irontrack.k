// Prueba el preflight de SOLO LECTURA (sql/rls_p0_preflight_readonly.sql) contra el stack local: debe detectar lo que falta y no escribir nada.
//   node qa/test-preflight.mjs      (requiere qa/stack.sh up)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newPasswords, prepare, psql, q, root } from "./seed.mjs";

const SQL = readFileSync(root + "sql/rls_p0_preflight_readonly.sql", "utf8");
const run = (uid) => psql(["-At", "-F", "|", "-c", SQL.replace("e2447231-c0ba-4f90-946f-63bf364570af", uid)])
  .split("\n").filter(Boolean).map((l) => { const [resultado, gate, check, expected, actual] = l.split("|"); return { resultado, gate, check, expected, actual }; });
const fallas = (rows) => rows.filter((r) => r.resultado === "FALLA" && r.gate === "BLOQUEANTE").map((r) => r.check);
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok -", name); };

await prepare(newPasswords(), async ({ coach }) => {
  const snapshot = () => q("SELECT (SELECT count(*) FROM alumnos)||'/'||(SELECT count(*) FROM rutinas)||'/'||(SELECT count(*) FROM pg_policies WHERE schemaname='public')||'/'||(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public')");
  const before = snapshot();
  t("estado inicial (9 alumnos legacy): la única falla bloqueante es 'alumnos sin auth_uid' (el seed vincula 2 de 9)", () => {
    const f = fallas(run(coach.id));
    assert.deepEqual(f, ["alumnos sin auth_uid (no podrian entrar)"], JSON.stringify(f));
  });
  t("descartada la falla de vinculación, no queda ninguna otra falla bloqueante", () => {
    // No se fabrican identidades: se verifica que, descartada esa única falla, el resto de los chequeos bloqueantes pasa.
    const rows = run(coach.id).filter((r) => r.check !== "alumnos sin auth_uid (no podrian entrar)");
    assert.deepEqual(fallas(rows), []);
  });
  t("detecta columna faltante, tipo incorrecto, UID inexistente y alumno ajeno", () => {
    q("ALTER TABLE mensajes RENAME COLUMN leido TO leido_x");
    assert.ok(fallas(run(coach.id)).includes("columna mensajes.leido"));
    q("ALTER TABLE mensajes RENAME COLUMN leido_x TO leido");
    q("ALTER TABLE rutinas ALTER COLUMN datos TYPE json USING datos::json");
    assert.ok(fallas(run(coach.id)).includes("tipo rutinas.datos"));
    q("ALTER TABLE rutinas ALTER COLUMN datos TYPE jsonb USING datos::jsonb");
    assert.ok(fallas(run("00000000-0000-0000-0000-0000000000ff")).includes("principal en auth.users"));
    q("UPDATE alumnos SET entrenador_id='otro-entrenador' WHERE nombre='Alumno 9'");
    assert.ok(fallas(run(coach.id)).includes("alumnos con entrenador_id que no es legacy ni el principal"));
    q("UPDATE alumnos SET entrenador_id='entrenador_principal' WHERE nombre='Alumno 9'");
    q("INSERT INTO ejercicio_overrides(entrenador_id,ejercicio_id,name) VALUES ('entrenador_principal','sq','a'),('" + coach.id + "','sq','b')");
    assert.ok(fallas(run(coach.id)).includes("ejercicio_overrides: conflicto legacy vs UUID"));
    q("DELETE FROM ejercicio_overrides");
  });
  t("es de solo lectura: no cambió filas, políticas ni funciones", () => assert.equal(snapshot(), before));
});
console.log(n + " tests ok");
process.exit(0);
