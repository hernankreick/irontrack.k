// D76-09 · Ensayo del despliegue completo en PostgreSQL 17 LOCAL y DESECHABLE (mismo aislamiento que 05): diagnóstico → migración →
// verificación posterior → modos → rollback, más los casos que DEBEN abortar. Datos ficticios. Uso: RUNNER=... node 06_validar_despliegue.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cargarPg, config, verificarAislamiento, DB } from "./05_aplicar_local.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const leer = (f) => readFileSync(path.join(HERE, "..", f), "utf8");
const conEmailFicticio = (sql) => sql.split("'entrenador@irontrack.app'").join("'coach@ficticio.test'");
const pg = cargarPg();

async function baseNueva(extra) {
  const adm = new pg.Client(config("postgres")); await adm.connect(); await verificarAislamiento(adm, "postgres");
  await adm.query("drop database if exists " + DB); await adm.query("create database " + DB); await adm.end();
  const c = new pg.Client(config(DB)); await c.connect(); await verificarAislamiento(c, DB);
  await c.query(readFileSync(path.join(HERE, "03_mock_supabase_local.sql"), "utf8"));
  if (extra) await c.query(extra);
  return c;
}
const filas = async (c, sql) => (await c.query(conEmailFicticio(sql))).rows;
const veredicto = (rows) => rows.find((r) => r.control === "VEREDICTO");
const resultados = (rows) => Object.fromEntries(rows.map((r) => [r.n, r.resultado]));
let ok = 0;
const t = async (nombre, fn) => { await fn(); ok++; console.log("ok -", nombre); };

await t("diagnóstico sobre la base sin migrar: GO (sin FALLA), solo lectura", async () => {
  const c = await baseNueva();
  const antes = (await c.query("select count(*) n from pg_class")).rows[0].n;
  const rows = await filas(c, leer("1_diagnostico_previo.sql"));
  console.table(rows.map((r) => ({ n: r.n, resultado: r.resultado, control: r.control.slice(0, 60), detalle: (r.detalle || "").slice(0, 60) })));
  assert.ok(!rows.some((r) => r.resultado === "FALLA"), "sin fallas");
  assert.match(veredicto(rows).resultado, /^GO/);
  assert.equal((await c.query("select count(*) n from pg_class")).rows[0].n, antes, "no crea objetos");
  await c.end();
});
await t("migración + verificación posterior: todo OK; datos existentes intactos; luego el diagnóstico pasa a NO-GO (ya aplicada)", async () => {
  const c = await baseNueva("insert into public.progreso (alumno_id, ejercicio_id, kg, reps, nota, fecha, semana) values ('b0000000-0000-4000-8000-000000000001','press',60,8,'','2/11/2026',1)");
  await c.query(conEmailFicticio(leer("2_migracion_d76_09.sql")));
  const rows = await filas(c, leer("3_verificacion_posterior.sql"));
  console.table(rows.map((r) => ({ n: r.n, resultado: r.resultado, control: r.control.slice(0, 60), detalle: (r.detalle || "").slice(0, 50) })));
  assert.equal(veredicto(rows).resultado, "OK");
  assert.equal(resultados(await filas(c, leer("1_diagnostico_previo.sql")))[2], "FALLA", "no se puede aplicar dos veces");
  const seg = await filas(c, leer("4_modos_y_seguimiento.sql").split("\n").filter((l) => !l.startsWith("--")).join("\n"));
  assert.equal(seg.find((r) => r.dato === "modo").valor, "off");
  await c.end();
});
await t("aborta y NO deja nada si hay 2 cuentas confirmadas con el email del entrenador", async () => {
  // Segunda cuenta confirmada con el mismo email (distinta mayúscula: auth.users lo admite) => ambigüedad.
  const c = await baseNueva("update auth.users set email = 'Coach@Ficticio.test' where id = 'e0000000-0000-4000-8000-000000000009'");
  assert.equal(veredicto(await filas(c, leer("1_diagnostico_previo.sql"))).resultado, "NO-GO");
  await assert.rejects(c.query(conEmailFicticio(leer("2_migracion_d76_09.sql"))), /exactamente 1 cuenta Auth confirmada/);
  await c.query("rollback").catch(() => {});
  assert.equal((await c.query("select to_regnamespace('it_private') is null as limpio")).rows[0].limpio, true);
  await c.end();
});
await t("aborta y NO deja nada si progreso tiene otra columna NOT NULL sin default (el reingreso fallaría)", async () => {
  const c = await baseNueva("alter table public.progreso add column rpe integer not null default 0; alter table public.progreso alter column rpe drop default");
  const rows = await filas(c, leer("1_diagnostico_previo.sql"));
  assert.equal(resultados(rows)[8], "FALLA"); assert.equal(veredicto(rows).resultado, "NO-GO");
  await assert.rejects(c.query(conEmailFicticio(leer("2_migracion_d76_09.sql"))), /NOT NULL sin default no contempladas: progreso\.rpe/);
  await c.query("rollback").catch(() => {});
  assert.equal((await c.query("select to_regnamespace('it_private') is null as limpio")).rows[0].limpio, true);
  await c.end();
});
await t("aborta si la cuenta del entrenador no tiene fila en public.entrenadores", async () => {
  const c = await baseNueva("delete from public.entrenadores");
  assert.equal(resultados(await filas(c, leer("1_diagnostico_previo.sql")))[14], "FALLA");
  await assert.rejects(c.query(conEmailFicticio(leer("2_migracion_d76_09.sql"))), /no tiene fila en public\.entrenadores/);
  await c.end();
});
await t("rollback nivel 2: quita objetos, conserva columnas y datos; re-aplicar la migración vuelve a funcionar", async () => {
  const c = await baseNueva();
  await c.query(conEmailFicticio(leer("2_migracion_d76_09.sql")));
  await c.query("insert into public.progreso (alumno_id, ejercicio_id, kg, reps, nota, fecha, semana, historial_token) values ('b0000000-0000-4000-8000-000000000001','press',60,8,'','2/11/2026',1,null)");
  await c.query(leer("5_rollback_d76_09.sql"));
  const v = (await c.query(`select to_regnamespace('it_private') is null as sin_it_private,
      (select count(*) from pg_trigger where not tgisinternal and tgname like 'it\\_%') as triggers,
      (select count(*) from information_schema.columns where table_schema='public' and table_name in ('progreso','sesiones')
        and column_name in ('historial_token','historial_epoch','reingreso_de_epoch','reingreso_at')) as columnas,
      (select count(*) from public.progreso) as filas`)).rows[0];
  assert.deepEqual([v.sin_it_private, Number(v.triggers), Number(v.columnas), Number(v.filas)], [true, 0, 8, 1]);
  const d = await filas(c, leer("1_diagnostico_previo.sql"));
  assert.equal(resultados(d)[4], "AVISO"); assert.match(veredicto(d).resultado, /^GO/);
  await c.query(conEmailFicticio(leer("2_migracion_d76_09.sql")));
  assert.equal(veredicto(await filas(c, leer("3_verificacion_posterior.sql"))).resultado, "OK");
  await c.end();
});
console.log(`\n${ok} ensayos OK`);
