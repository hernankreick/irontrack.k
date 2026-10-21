// Chat coach-alumno: ultimos 50 mensajes (EN-02), envio sin perder el texto (TR-03 / EN-13) y CTA global del Dashboard (EN-04).
//
//   node scripts/test-chatMensajes.mjs
//
// Igual que los otros scripts/test-*.mjs: sin dependencias nuevas, node:assert. Todo con mocks: ninguna peticion a Supabase.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CHAT_PAGE_LIMIT, mensajesPath, enOrdenCronologico, appendUnique, isSavedMessage, enviarMensaje, mensajeErrorEnvio, createSendLock,
  resolveDashboardMessageTarget,
} from "../lib/chatMessages.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

// ---- Servidor simulado: interpreta SOLO lo que arma mensajesPath (alumno_id=eq.X, order=col.dir[.nullslast],..., limit=N), como PostgREST.
function fakeQuery(rows, p) {
  const q = new URLSearchParams(p.split("?")[1].replace(/\+/g, "%2B"));
  const aid = q.get("alumno_id").replace(/^eq\./, "");
  const specs = q.get("order").split(",").map((s) => { const [col, dir, nulls] = s.split("."); return { col, desc: dir === "desc", nullsLast: nulls === "nullslast" }; });
  const limit = Number(q.get("limit"));
  const out = rows.filter((r) => String(r.alumno_id) === aid).slice();
  out.sort((a, b) => {
    for (const s of specs) {
      const x = a[s.col], y = b[s.col];
      if (x == null && y == null) continue;
      // PostgreSQL: NULL es "mayor" que cualquier valor => en DESC va primero salvo NULLS LAST; en ASC va ultimo salvo NULLS FIRST.
      if (x == null) return s.nullsLast ? 1 : (s.desc ? -1 : 1);
      if (y == null) return s.nullsLast ? -1 : (s.desc ? 1 : -1);
      if (x === y) continue;
      const c = x < y ? -1 : 1;
      return s.desc ? -c : c;
    }
    return 0;
  });
  return out.slice(0, limit);
}
const T0 = Date.parse("2026-10-01T10:00:00Z");
const mk = (n, over) => Object.assign({ id: "id-" + String(n).padStart(4, "0"), alumno_id: "A", texto: "m" + n, de_entrenador: n % 2 === 0, created_at: new Date(T0 + n * 60000).toISOString().slice(0, 19) }, over || {});
const nuevos = (n, alumno) => Array.from({ length: n }, (_, i) => mk(i + 1, alumno ? { alumno_id: alumno } : {}));
const getMensajesSim = (rows, aid) => enOrdenCronologico(fakeQuery(rows, mensajesPath(aid)));

await test("mensajesPath: ultimos 50 (desc, nulls last, desempate por id) con alumno_id codificado", () => {
  assert.equal(CHAT_PAGE_LIMIT, 50);
  const p = mensajesPath("0a1b2c3d-0000-4000-8000-000000000001");
  assert.equal(p, "mensajes?alumno_id=eq.0a1b2c3d-0000-4000-8000-000000000001&select=*&order=created_at.desc.nullslast,id.desc&limit=50");
  assert.ok(!p.includes("created_at.asc"));
  assert.ok(mensajesPath("a&b=1 x").includes("alumno_id=eq.a%26b%3D1%20x&"), "un id raro no inyecta parametros");
  assert.ok(mensajesPath("A", 0).endsWith("limit=50") && mensajesPath("A", -3).endsWith("limit=50") && mensajesPath("A", 1.5).endsWith("limit=50"));
  assert.ok(mensajesPath("A", 20).endsWith("limit=20"));
});

await test("conversacion con menos de 50 mensajes: llegan todos, en orden cronologico", () => {
  const r = getMensajesSim(nuevos(7), "A");
  assert.deepEqual(r.map((m) => m.texto), ["m1", "m2", "m3", "m4", "m5", "m6", "m7"]);
});

await test("conversacion con mas de 50 mensajes: llegan los ULTIMOS 50, del mas viejo al mas nuevo (EN-02)", () => {
  const rows = nuevos(120);
  const r = getMensajesSim(rows, "A");
  assert.equal(r.length, 50);
  assert.equal(r[0].texto, "m71");
  assert.equal(r[49].texto, "m120", "el mensaje mas reciente SIEMPRE esta");
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].created_at < r[i].created_at, "cronologico estricto");
  // Regresion: la consulta anterior (asc + limit 50) devolvia los 50 MAS VIEJOS y perdia el reciente.
  const vieja = fakeQuery(rows, "mensajes?alumno_id=eq.A&select=*&order=created_at.asc&limit=50");
  assert.equal(vieja[vieja.length - 1].texto, "m50");
  assert.ok(!vieja.some((m) => m.texto === "m120"));
});

await test("exactamente 50 y 51 mensajes: borde del limite", () => {
  assert.equal(getMensajesSim(nuevos(50), "A").length, 50);
  assert.equal(getMensajesSim(nuevos(50), "A")[0].texto, "m1");
  const r51 = getMensajesSim(nuevos(51), "A");
  assert.equal(r51.length, 50); assert.equal(r51[0].texto, "m2"); assert.equal(r51[49].texto, "m51");
});

await test("timestamps iguales: ningun mensaje se pierde ni se duplica y el orden es estable entre consultas", () => {
  const mismo = "2026-10-01T10:00:00";
  const rows = [mk(1, { created_at: mismo, id: "id-c" }), mk(2, { created_at: mismo, id: "id-a" }), mk(3, { created_at: mismo, id: "id-b" }), mk(4, { created_at: "2026-10-01T10:05:00", id: "id-z" })];
  const r1 = getMensajesSim(rows, "A"), r2 = getMensajesSim(rows.slice().reverse(), "A");
  assert.deepEqual(r1.map((m) => m.id), r2.map((m) => m.id), "mismo orden sin importar el orden fisico de las filas");
  assert.equal(new Set(r1.map((m) => m.id)).size, 4);
  assert.equal(r1[3].id, "id-z", "el mas nuevo al final");
  assert.deepEqual(r1.slice(0, 3).map((m) => m.id), ["id-a", "id-b", "id-c"], "empatados: desc en el servidor => asc tras revertir (determinista)");
});

await test("created_at NULL: con nullslast un mensaje sin fecha NO desplaza a los recientes", () => {
  const rows = nuevos(60);
  rows.push(mk(901, { created_at: null, id: "id-nulo-1" }), mk(902, { created_at: null, id: "id-nulo-2" }));
  const r = getMensajesSim(rows, "A");
  assert.equal(r.length, 50);
  assert.equal(r[49].texto, "m60", "el ultimo real sigue siendo el reciente");
  assert.ok(!r.some((m) => m.created_at == null), "los NULL no entran en los ultimos 50 si hay 50 con fecha");
  // Contraste: SIN nullslast, PostgreSQL pone los NULL primero en DESC y desplazan a los mas nuevos.
  const sin = fakeQuery(rows, "mensajes?alumno_id=eq.A&select=*&order=created_at.desc,id.desc&limit=50");
  assert.ok(sin.some((m) => m.created_at == null));
  // Pocos mensajes: el NULL no se pierde y queda como el mas viejo.
  const pocos = [mk(1), mk(2, { created_at: null, id: "id-n" }), mk(3)];
  assert.deepEqual(getMensajesSim(pocos, "A").map((m) => m.texto), ["m2", "m1", "m3"]);
});

await test("conversaciones separadas: cada alumno ve solo lo suyo", () => {
  const rows = [...nuevos(60, "A"), ...nuevos(5, "B")];
  const a = getMensajesSim(rows, "A"), b = getMensajesSim(rows, "B");
  assert.ok(a.every((m) => m.alumno_id === "A") && b.every((m) => m.alumno_id === "B"));
  assert.equal(a.length, 50); assert.equal(b.length, 5);
  assert.deepEqual(getMensajesSim(rows, "C"), []);
});

await test("enOrdenCronologico: conserva null (error), no muta la entrada y [] sigue siendo []", () => {
  assert.equal(enOrdenCronologico(null), null);
  assert.equal(enOrdenCronologico(undefined), null);
  assert.deepEqual(enOrdenCronologico([]), []);
  const inp = [{ id: 3 }, { id: 2 }, { id: 1 }];
  assert.deepEqual(enOrdenCronologico(inp).map((m) => m.id), [1, 2, 3]);
  assert.deepEqual(inp.map((m) => m.id), [3, 2, 1]);
});

await test("appendUnique: sin duplicados por id (aunque el polling lo traiga antes), sin mutar y tolera mensajes sin id", () => {
  const base = [{ id: "a" }, { id: "b" }];
  assert.deepEqual(appendUnique(base, { id: "c" }).map((m) => m.id), ["a", "b", "c"]);
  assert.equal(appendUnique(base, { id: "b", texto: "x" }), base);
  assert.equal(appendUnique([{ id: 7 }], { id: "7" }).length, 1, "7 y '7' son el mismo id");
  assert.deepEqual(appendUnique(null, { id: "a" }).map((m) => m.id), ["a"]);
  assert.equal(appendUnique([{ id: "a" }], { texto: "sin id" }).length, 2);
  assert.deepEqual(base.map((m) => m.id), ["a", "b"]);
});

await test("isSavedMessage: solo cuenta como guardado si el servidor devolvio la fila creada", () => {
  assert.equal(isSavedMessage([{ id: "x", texto: "hola" }]), true);
  for (const bad of [null, undefined, [], [null], [{}], [{ id: null }], {}, "ok", 201]) assert.equal(isSavedMessage(bad), false, JSON.stringify(bad));
});

await test("envio exitoso: ok con la fila del servidor", async () => {
  const calls = [];
  const r = await enviarMensaje(async (p) => { calls.push(p); return [{ id: "n1", ...p }]; }, { alumno_id: "A", texto: "hola" });
  assert.equal(r.ok, true); assert.equal(r.mensaje.id, "n1"); assert.equal(calls.length, 1);
});

await test("error de Supabase (403/500 => sbFetch devuelve null) y respuesta vacia: no es exito, reason 'servidor'", async () => {
  for (const respuesta of [null, [], undefined, [{}]]) {
    const r = await enviarMensaje(async () => respuesta, { texto: "hola" });
    assert.deepEqual(r, { ok: false, reason: "servidor" }, JSON.stringify(respuesta));
  }
});

await test("error de red (fetch lanza): no propaga la excepcion, reason 'red'", async () => {
  const r = await enviarMensaje(async () => { throw new TypeError("Failed to fetch"); }, { texto: "hola" });
  assert.deepEqual(r, { ok: false, reason: "red" });
});

await test("mensajes de error comprensibles (es/en), conservan la idea de reintento y no filtran detalles del servidor", () => {
  for (const reason of ["red", "servidor"]) {
    const es = mensajeErrorEnvio(reason, true), en = mensajeErrorEnvio(reason, false);
    assert.ok(/sigue acá/.test(es) && /reintentar/.test(es)); assert.ok(/still here/.test(en) && /retry/.test(en));
    assert.ok(!/HTTP|40\d|50\d|Failed to fetch/i.test(es + en));
  }
  assert.notEqual(mensajeErrorEnvio("red", true), mensajeErrorEnvio("servidor", true));
});

// ---- Modelo del formulario con la MISMA logica que Chat.jsx (candado + enviarMensaje + limpiar solo si ok)
function formulario(addFn) {
  const lock = createSendLock();
  const st = { texto: "", error: null, mensajes: [], enviando: false };
  const enviar = () => lock.run(async () => {
    const limpio = st.texto.trim();
    if (!limpio) return;
    st.enviando = true; st.error = null;
    try {
      const r = await enviarMensaje(addFn, { texto: limpio });
      if (r.ok) { st.mensajes = appendUnique(st.mensajes, r.mensaje); if (st.texto.trim() === limpio) st.texto = ""; }
      else st.error = mensajeErrorEnvio(r.reason, true);
    } finally { st.enviando = false; }
  });
  return { st, enviar };
}

await test("reintento tras un error: el texto se conserva y el segundo intento (sin reescribir) lo envia y recien ahi limpia", async () => {
  let n = 0;
  const f = formulario(async (p) => (++n === 1 ? null : [{ id: "ok1", ...p }]));
  f.st.texto = "  hola coach  ";
  await f.enviar();
  assert.equal(f.st.texto, "  hola coach  "); assert.ok(f.st.error); assert.equal(f.st.mensajes.length, 0); assert.equal(f.st.enviando, false);
  await f.enviar();
  assert.equal(f.st.texto, ""); assert.equal(f.st.error, null); assert.equal(f.st.mensajes.length, 1); assert.equal(f.st.mensajes[0].texto, "hola coach");
});

await test("un error de red tampoco deja el chat bloqueado (enviando vuelve a false) y permite reintentar", async () => {
  let n = 0;
  const f = formulario(async (p) => { if (++n === 1) throw new TypeError("Failed to fetch"); return [{ id: "ok2", ...p }]; });
  f.st.texto = "hola";
  await f.enviar();
  assert.equal(f.st.enviando, false); assert.equal(f.st.texto, "hola"); assert.match(f.st.error, /Sin conexión/);
  await f.enviar();
  assert.equal(f.st.texto, ""); assert.equal(f.st.mensajes.length, 1);
});

await test("doble toque: un solo envio aunque el primero siga en curso; luego se puede volver a enviar", async () => {
  let llamadas = 0, soltar;
  const f = formulario(() => { llamadas++; return new Promise((res) => { soltar = () => res([{ id: "d" + llamadas, texto: "x" }]); }); });
  f.st.texto = "hola";
  const p1 = f.enviar(), p2 = f.enviar(), p3 = f.enviar();
  assert.equal(llamadas, 1, "los toques 2 y 3 se descartan sincronamente");
  soltar(); await Promise.all([p1, p2, p3]);
  assert.equal(llamadas, 1); assert.equal(f.st.mensajes.length, 1); assert.equal(f.st.texto, "");
  f.st.texto = "otro"; const p4 = f.enviar(); soltar(); await p4;
  assert.equal(llamadas, 2);
});

await test("lo que el usuario escribio mientras se enviaba no se borra; texto vacio o en blanco no envia", async () => {
  let soltar, llamadas = 0;
  const f = formulario(() => { llamadas++; return new Promise((res) => { soltar = () => res([{ id: "e1", texto: "a" }]); }); });
  f.st.texto = "a"; const p = f.enviar(); f.st.texto = "a y sigo escribiendo"; soltar(); await p;
  assert.equal(f.st.texto, "a y sigo escribiendo");
  f.st.texto = "   "; await f.enviar(); assert.equal(llamadas, 1);
});

await test("el candado se libera aunque la funcion lance, y devuelve el valor de la funcion", async () => {
  const lock = createSendLock();
  await assert.rejects(() => lock.run(async () => { throw new Error("boom"); }), /boom/);
  assert.equal(lock.busy, false);
  assert.equal(await lock.run(async () => 42), 42);
});

await test("polling + envio: si el polling ya trajo el mensaje enviado, no se duplica en pantalla", () => {
  const servidor = nuevos(3);
  const enviado = mk(4);
  const trasPolling = enOrdenCronologico(servidor.concat([enviado]).reverse());
  assert.equal(appendUnique(trasPolling, enviado).length, 4);
});

await test("Dashboard: el CTA global lleva a Alumnos filtrado, nunca elige un alumno por posicion", () => {
  assert.deepEqual(resolveDashboardMessageTarget({ todos: 5, inactivos: 2 }), { empty: false, tab: "alumnos", filter: "inactivos" });
  assert.deepEqual(resolveDashboardMessageTarget({ todos: 5, inactivos: 0 }), { empty: false, tab: "alumnos", filter: "todos" });
  for (const c of [{ todos: 0, inactivos: 0 }, {}, null, undefined]) assert.deepEqual(resolveDashboardMessageTarget(c), { empty: true });
  const r = resolveDashboardMessageTarget({ todos: 3, inactivos: 1, alumnos: [{ id: "x" }] });
  assert.ok(!("alumnoId" in r) && !("alumno" in r));
});

await test("cableado en App.jsx: getMensajes usa la ruta nueva y el CTA global no abre alumnos[0]", () => {
  const app = read("App.jsx");
  assert.match(app, /getMensajes: \(alumnoId\) => sbFetch\(mensajesPath\(alumnoId\)\)\.then\(enOrdenCronologico\)/);
  assert.ok(!/mensajes\?alumno_id=eq\."\+alumnoId\+"&select=\*&order=created_at\.asc/.test(app), "la consulta ascendente anterior ya no existe");
  const a = app.indexOf("const handleCoachDashboardEnviarMensaje"), b = app.indexOf("const handleCoachDashboardCrearRutina");
  const h = app.slice(a, b);
  assert.ok(a > 0 && b > a);
  assert.match(h, /resolveDashboardMessageTarget\(coachAlumnosCounts\)/);
  assert.match(h, /setCoachAlumnosFilter\(target\.filter\)/); assert.match(h, /setTab\(target\.tab\)/);
  assert.ok(!/\[0\]/.test(h) && !/setChatModal/.test(h), "no elige un alumno ni abre el chat");
  // los botones por fila (con alumno asociado) siguen abriendo el chat del alumno correcto
  assert.match(app, /handleCoachDashboardAbrirChatAlumno/);
});

await test("cableado en Chat.jsx: texto solo se limpia con exito, candado sincrono, error visible y boton deshabilitado", () => {
  const c = read("components/Chat.jsx");
  assert.match(c, /createSendLock\(\)/); assert.match(c, /sendLock\.current\.run\(/);
  assert.match(c, /enviarMensaje\(sb\.addMensaje, msg\)/);
  assert.ok(!/setTexto\(""\)/.test(c), "no hay limpieza incondicional del campo");
  const ok = c.indexOf("if(r.ok)"), el = c.indexOf("} else {", ok), lim = c.indexOf('setTexto(cur=>cur.trim()===limpio?"":cur)');
  assert.ok(ok > 0 && lim > ok && lim < el, "el campo se limpia solo dentro de la rama de exito");
  assert.match(c, /finally \{\s*setEnviando\(false\)/);
  assert.match(c, /role="alert"/); assert.match(c, /disabled=\{enviando\}/); assert.match(c, /aria-label=\{es\?"Enviar mensaje"/);
});

await test("consumidores de getMensajes: solo Chat y ChatFlotante; el contrato (orden cronologico / null en error) se conserva", () => {
  const chat = read("components/Chat.jsx"), flot = read("components/ChatFlotante.jsx");
  assert.equal((chat.match(/sb\.getMensajes\(/g) || []).length, 2);
  assert.equal((flot.match(/sb\.getMensajes\(/g) || []).length, 1);
  assert.match(chat, /if \(m\) setMensajes\(m\)/); assert.match(chat, /if \(m2\) setMensajes\(m2\)/); // null no pisa la lista
  assert.match(flot, /filter\(msg => msg\.de_entrenador && !msg\.leido\)/); // el conteo no depende del orden
  assert.ok(!/enOrdenCronologico|mensajesPath/.test(flot), "ChatFlotante no cambia");
});

console.log("\n" + count + " pruebas OK");
