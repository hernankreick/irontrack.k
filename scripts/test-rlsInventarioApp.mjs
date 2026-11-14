// Contrato entre el CODIGO de la app y las politicas RLS v1: toda tabla y operacion que la app usa debe estar cubierta por una politica versionada.
// Si alguien agrega una tabla o una operacion nueva (p.ej. un DELETE sobre `fotos` o una tabla nueva) sin politica, esta prueba falla en vez de quedar
// cubierta por la politica permisiva anterior o rota en produccion. Estatica: lee el codigo y los .sql, sin red ni base.   node scripts/test-rlsInventarioApp.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let n = 0; const test = (name, fn) => { fn(); n++; console.log("ok -", name); };
const leer = (...p) => readFileSync(path.join(ROOT, ...p), "utf8");
function archivos(dir, acc = []) { for (const e of readdirSync(path.join(ROOT, dir))) { const rel = path.join(dir, e); const st = statSync(path.join(ROOT, rel)); if (st.isDirectory()) { if (!["node_modules", "demo"].includes(e)) archivos(rel, acc); } else if (/\.(jsx?|mjs)$/.test(e)) acc.push(rel); } return acc; }
const FUENTES = ["App.jsx", ...archivos("components"), ...archivos("lib"), ...archivos("hooks"), ...archivos("contexts")].filter((f) => !/components\/demo\//.test(f));

// Politicas versionadas: tabla -> comandos con politica.
const politicas = {};
const agregar = (t, cmd) => { (politicas[t] = politicas[t] || new Set()).add(cmd.toUpperCase()); };
for (const m of leer("docs", "rls-v1", "1_migracion.sql").matchAll(/CREATE POLICY it_rls_\w+ ON public\.(\w+) FOR (SELECT|INSERT|UPDATE|DELETE)/g)) agregar(m[1], m[2]);
for (const m of leer("docs", "prescripcion-copias-v1", "1_tabla.sql").matchAll(/CREATE POLICY it_rls_\w+ ON public\.(\w+) FOR (SELECT|INSERT|UPDATE|DELETE)/g)) agregar(m[1], m[2]);
for (const f of ["coach_calendar_assignments.sql", "coach_notification_reads.sql"]) for (const m of leer("sql", f).matchAll(/create policy "[^"]+"\s+on public\.(\w+)\s+for (select|insert|update|delete)/gi)) agregar(m[1], m[2]);

// Uso real de la app: tabla -> operaciones.
const uso = {};
const usa = (t, op, f) => { ((uso[t] = uso[t] || {})[op] = uso[t][op] || new Set()).add(f); };
for (const f of FUENTES) {
  const s = leer(f);
  for (const m of s.matchAll(/\.from\(\s*["']([a-z_]+)["']\s*\)/g)) {
    const w = s.slice(m.index + m[0].length, m.index + m[0].length + 400).split(/\n\s*\n/)[0]; let alguna = false;
    for (const [re, ops] of [[/\.\s*insert\s*\(/, ["INSERT"]], [/\.\s*update\s*\(/, ["UPDATE"]], [/\.\s*delete\s*\(/, ["DELETE"]], [/\.\s*upsert\s*\(/, ["INSERT", "UPDATE"]], [/\.\s*select\s*\(/, ["SELECT"]]]) if (re.test(w)) { alguna = true; ops.forEach((o) => usa(m[1], o, f)); }
    assert.ok(alguna, "no se pudo clasificar la operacion de from('" + m[1] + "') en " + f + ": ajustar el inventario");
  }
  for (const m of s.matchAll(/(?:sbFetch|sbFetchStrict|sbRequestStatus|fetchPath|requestStatus)\(\s*["']([a-z_]+)(?:["']|\?)/g)) {
    const w = s.slice(m.index + m[0].length, m.index + m[0].length + 80); const mm = /,\s*["'](POST|PATCH|DELETE|PUT|GET)["']/.exec(w); const met = mm ? mm[1] : "GET";
    usa(m[1], { GET: "SELECT", POST: "INSERT", PATCH: "UPDATE", PUT: "UPDATE", DELETE: "DELETE" }[met], f);
  }
  for (const m of s.matchAll(/["']mensajes\?[^"']*["']/g)) usa("mensajes", "SELECT", f);
}
// Llamadas construidas dinamicamente (la URL llega por variable): se declaran aqui con su justificacion y se verifican contra el codigo.
const DINAMICAS = [["alumnos", "DELETE", "App.jsx", /\/rest\/v1\/alumnos\?id=eq\./], ["mensajes", "UPDATE", "App.jsx", /method: "PATCH"/]];
for (const [t, op, f, re] of DINAMICAS) { assert.ok(re.test(leer(f)), "la llamada dinamica declarada ya no existe: " + t + " " + op); usa(t, op, f + " (dinamica)"); }

test("la app usa solo tablas conocidas (si aparece una nueva sin politica versionada, esto falla)", () => {
  const sinPolitica = Object.keys(uso).filter((t) => !politicas[t]);
  assert.deepEqual(sinPolitica, [], "tablas que la app usa y NINGUNA politica versionada cubre: " + sinPolitica.join(", ") + " (con RLS v1 aplicada, o quedarian con la politica permisiva anterior o inaccesibles)");
  assert.ok(Object.keys(uso).length >= 14, "inventario: " + Object.keys(uso).join(", "));
});
test("cada operacion que hace la app sobre cada tabla tiene una politica del mismo comando", () => {
  const huecos = [];
  for (const [t, ops] of Object.entries(uso)) for (const op of Object.keys(ops)) if (!(politicas[t] && politicas[t].has(op))) huecos.push(t + " " + op + " <- " + [...ops[op]].slice(0, 2).join(", "));
  assert.deepEqual(huecos, [], "operaciones de la app SIN politica (RLS v1 las rechazaria): " + huecos.join(" | "));
});
test("el upsert de la app (INSERT ... ON CONFLICT DO UPDATE) tiene politica de INSERT, UPDATE y SELECT en esas tablas", () => {
  for (const t of Object.keys(uso).filter((t) => uso[t].INSERT && uso[t].UPDATE)) for (const c of ["INSERT", "UPDATE", "SELECT"]) assert.ok(politicas[t].has(c), t + " " + c);
});
test("la migracion cubre todas las tablas de datos que reemplaza y no deja operaciones sin comando documentado en la matriz del README", () => {
  const mig = leer("docs", "rls-v1", "1_migracion.sql"); const listadas = [...mig.matchAll(/ARRAY\['alumnos'[^\]]*\]/g)][0][0].match(/'[a-z_]+'/g).map((x) => x.slice(1, -1));
  for (const t of listadas) assert.ok(politicas[t], "tabla listada sin politicas: " + t);
  const readme = leer("docs", "rls-v1", "README.md"); for (const t of listadas) assert.ok(readme.includes("`" + t + "`"), "falta en la matriz del README: " + t);
});
console.log("\n" + n + " pruebas OK (" + Object.keys(uso).length + " tablas, " + FUENTES.length + " archivos analizados)");
