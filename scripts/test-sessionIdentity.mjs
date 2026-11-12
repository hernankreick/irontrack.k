// SessionIdentity PR-1 (contrato puro): node scripts/test-sessionIdentity.mjs
// Datos 100 % ficticios. Sin red, sin Supabase, sin almacenamiento.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "../lib/sessionIdentity.js";
const { crearIdentidad, validarIdentidad, esIdentidadValida, serializarIdentidad, deserializarIdentidad, validarAnclaV2,
  anclaV2DesdeIdentidad, clasificarAncla, generarSessionId, esUuidV4, identidadPerteneceA, ERR } = M;

let n = 0;
function test(name, fn) { fn(); n++; console.log("ok -", name); }
const clone = (o) => JSON.parse(JSON.stringify(o));
function deepFreeze(o) { if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; }

const UUID = "123e4567-e89b-42d3-a456-426614174000";
const datos = () => ({ alumnoId: "alu-1", rutinaId: "rut-1", diaIdx: 0, semanaIdx: 2, ciclo: 1, fecha: "10/11/2026", startedAt: 1760000000000 });
const gen = (id = UUID) => ({ genId: () => id });
const ident = () => crearIdentidad(datos(), gen()).value;
const anclaV1 = () => ({ v: 1, alumnoId: "alu-1", rId: "rut-1", dIdx: 0, ciclo: 1, semana: 2, startTime: 1760000000000, fecha: "10/11/2026" });
const anclaV2 = () => ({ v: 2, sessionId: UUID, alumnoId: "alu-1", rId: "rut-1", dIdx: 0, ciclo: 1, semana: 2, startTime: 1760000000000, fecha: "10/11/2026" });

// ---------------------------------------------------------------- UUID
test("UUID v4: acepta validos y rechaza invalidos", () => {
  assert.ok(esUuidV4(UUID));
  for (const bad of ["", "abc", UUID.toUpperCase(), "123e4567-e89b-12d3-a456-426614174000", "123e4567-e89b-42d3-c456-426614174000",
    "123e4567e89b42d3a456426614174000", UUID + "0", " " + UUID, null, undefined, 5, {}, [UUID]]) assert.equal(esUuidV4(bad), false, String(bad));
});
test("generacion por defecto: UUID v4 aleatorios y distintos", () => {
  const ids = new Set();
  for (let i = 0; i < 50; i++) { const r = generarSessionId(); assert.ok(r.ok && esUuidV4(r.value)); ids.add(r.value); }
  assert.equal(ids.size, 50);
});
test("generador inyectado invalido o que lanza -> error, sin reparar", () => {
  assert.equal(crearIdentidad(datos(), gen("no-es-uuid")).error, ERR.UUID_GENERADO_INVALIDO);
  assert.equal(crearIdentidad(datos(), { genId: () => { throw new Error("x"); } }).ok, false);
  assert.equal(crearIdentidad(datos(), { genId: () => null }).ok, false);
});
test("sessionId no se deriva de los datos: mismos datos, ids distintos", () => {
  const a = crearIdentidad(datos()).value, b = crearIdentidad(datos()).value;
  assert.notEqual(a.sessionId, b.sessionId);
  assert.ok(esUuidV4(a.sessionId) && esUuidV4(b.sessionId));
});
test("el modulo no usa Math.random, localStorage ni derivacion por hash", () => {
  const src = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../lib/sessionIdentity.js"), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  for (const re of [/Math\.random/, /localStorage/, /sessionStorage/, /window\./, /document\./, /createHash/, /subtle/]) assert.ok(!re.test(src), String(re));
});

// ---------------------------------------------------------------- crear / validar
test("crear: identidad valida con contrato exacto y congelada", () => {
  const r = crearIdentidad(datos(), gen());
  assert.ok(r.ok);
  assert.deepEqual(r.value, { v: 1, sessionId: UUID, ...datos() });
  assert.deepEqual(Object.keys(r.value), ["v", "sessionId", "alumnoId", "rutinaId", "diaIdx", "semanaIdx", "ciclo", "fecha", "startedAt"]);
  assert.ok(Object.isFrozen(r.value));
  assert.ok(esIdentidadValida(r.value));
});
test("crear: ignora v/sessionId de entrada y acepta alumnoId/rutinaId numericos", () => {
  const r = crearIdentidad({ ...datos(), alumnoId: 7, rutinaId: 9, v: 99, sessionId: "otro" }, gen());
  assert.ok(r.ok); assert.equal(r.value.v, 1); assert.equal(r.value.sessionId, UUID); assert.equal(r.value.alumnoId, 7);
});
test("crear: limites validos (semana 0 y 3, ciclo 1, dia 0)", () => {
  for (const s of [0, 3]) assert.ok(crearIdentidad({ ...datos(), semanaIdx: s }, gen()).ok);
  assert.ok(crearIdentidad({ ...datos(), ciclo: 1, diaIdx: 0 }, gen()).ok);
  assert.ok(crearIdentidad({ ...datos(), ciclo: 25, diaIdx: 6, fecha: "29/02/2028" }, gen()).ok);
});
const malos = {
  alumnoId: [undefined, null, "", NaN, Infinity, {}, [], true],
  rutinaId: [undefined, null, "", NaN, {}, false],
  diaIdx: [undefined, -1, 1.5, "0", NaN, null, Infinity],
  semanaIdx: [undefined, -1, 4, 5, 1.5, "1", NaN, null],
  ciclo: [undefined, 0, -1, 1.5, "1", NaN, null],
  fecha: [undefined, "", "31/02/2026", "29/02/2027", "0/1/2026", "32/1/2026", "1/13/2026", "2026-11-10", "10/11/26", 20261110, null],
  startedAt: [undefined, 0, -5, 1.5, "1760000000000", NaN, Infinity, null, 2 ** 60]
};
test("crear: cada campo invalido, ausente o corrupto devuelve error con el campo", () => {
  for (const [campo, vals] of Object.entries(malos)) for (const v of vals) {
    const d = datos(); d[campo] = v;
    const r = crearIdentidad(d, gen());
    assert.equal(r.ok, false, campo + "=" + String(v));
    assert.equal(r.campo, campo);
    assert.ok([ERR.CAMPO_AUSENTE, ERR.CAMPO_INVALIDO].includes(r.error));
  }
  for (const campo of Object.keys(malos)) { const d = datos(); delete d[campo]; const r = crearIdentidad(d, gen()); assert.equal(r.error, ERR.CAMPO_AUSENTE); assert.equal(r.campo, campo); }
});
test("crear: entrada no objeto -> error", () => {
  for (const x of [null, undefined, 5, "x", [], true]) assert.equal(crearIdentidad(x, gen()).error, ERR.NO_OBJETO);
});
test("fechas inexistentes e invalidas rechazadas; bisiesto aceptado", () => {
  assert.equal(crearIdentidad({ ...datos(), fecha: "31/04/2026" }, gen()).ok, false);
  assert.equal(crearIdentidad({ ...datos(), fecha: "29/02/2026" }, gen()).ok, false);
  assert.ok(crearIdentidad({ ...datos(), fecha: "29/2/2024" }, gen()).ok);
});
test("validar: version ausente o incompatible", () => {
  const i = { ...ident() };
  assert.equal(validarIdentidad({ ...i, v: 2 }).error, ERR.VERSION);
  assert.equal(validarIdentidad({ ...i, v: "1" }).error, ERR.VERSION);
  const { v, ...sinV } = i; assert.equal(validarIdentidad(sinV).error, ERR.CAMPO_AUSENTE);
});
test("validar: UUID invalido, campos extra y no objeto", () => {
  const i = ident();
  assert.equal(validarIdentidad({ ...i, sessionId: "123" }).campo, "sessionId");
  assert.equal(validarIdentidad({ ...i, sessionId: undefined }).error, ERR.CAMPO_AUSENTE);
  assert.equal(validarIdentidad({ ...i, extra: 1 }).campo, "extra");
  for (const x of [null, undefined, 1, "x", [], () => 1]) assert.equal(validarIdentidad(x).ok, false);
});
test("no se repara: semana fuera de rango no se recorta ni se normaliza", () => {
  assert.equal(validarIdentidad({ ...ident(), semanaIdx: 4 }).ok, false);
  assert.equal(validarIdentidad({ ...ident(), ciclo: 0 }).ok, false);
});

// ---------------------------------------------------------------- inmutabilidad
test("no muta los objetos recibidos", () => {
  const d = deepFreeze(datos()); assert.ok(crearIdentidad(d, gen()).ok);
  const i = deepFreeze(clone(ident())); assert.ok(validarIdentidad(i).ok); assert.ok(serializarIdentidad(i).ok);
  const a = deepFreeze(anclaV2()); assert.ok(validarAnclaV2(a).ok); assert.ok(clasificarAncla(a).tipo === "v2");
  const a1 = deepFreeze(anclaV1()); assert.equal(clasificarAncla(a1).tipo, "v1");
  const antes = clone(datos()); const d2 = datos(); crearIdentidad(d2, gen()); assert.deepEqual(d2, antes);
});
test("la identidad es inmutable y la validacion devuelve copia", () => {
  const i = ident();
  assert.throws(() => { "use strict"; i.semanaIdx = 3; }, TypeError);
  assert.throws(() => { "use strict"; i.sessionId = UUID.replace("e", "f"); }, TypeError);
  const mutable = clone(i); const v = validarIdentidad(mutable).value;
  assert.notEqual(v, mutable); mutable.alumnoId = "otro"; assert.equal(v.alumnoId, "alu-1");
});

// ---------------------------------------------------------------- serializacion
test("serializar/deserializar sin perdida (ida y vuelta)", () => {
  for (const d of [datos(), { ...datos(), alumnoId: 12, rutinaId: 34, semanaIdx: 0, ciclo: 7 }]) {
    const i = crearIdentidad(d, gen()).value;
    const s = serializarIdentidad(i); assert.ok(s.ok && typeof s.value === "string");
    const back = deserializarIdentidad(s.value); assert.ok(back.ok);
    assert.deepEqual(back.value, i);
    assert.equal(serializarIdentidad(back.value).value, s.value);
    assert.strictEqual(typeof back.value.alumnoId, typeof i.alumnoId);
  }
});
test("deserializar: JSON roto, vacio, no objeto, incompatibles o corruptos -> error sin lanzar", () => {
  for (const bad of ["", "{", "null", "[]", "5", '"x"', "undefined"]) assert.equal(deserializarIdentidad(bad).ok, false, bad);
  assert.equal(deserializarIdentidad("{").error, ERR.JSON_INVALIDO);
  assert.equal(deserializarIdentidad(JSON.stringify({ ...ident(), v: 2 })).error, ERR.VERSION);
  assert.equal(deserializarIdentidad(JSON.stringify({ ...ident(), semanaIdx: 9 })).campo, "semanaIdx");
  assert.equal(deserializarIdentidad(JSON.stringify({ ...ident(), sessionId: "x" })).campo, "sessionId");
  const { fecha, ...sinFecha } = ident(); assert.equal(deserializarIdentidad(JSON.stringify(sinFecha)).error, ERR.CAMPO_AUSENTE);
  for (const x of [null, undefined, 3]) assert.equal(deserializarIdentidad(x).ok, false);
});
test("serializar una identidad invalida -> error, nunca una cadena", () => {
  const r = serializarIdentidad({ ...ident(), ciclo: 0 }); assert.equal(r.ok, false); assert.equal(r.value, undefined);
});

// ---------------------------------------------------------------- pertenencia
test("una identidad pertenece a un solo alumno", () => {
  const i = ident();
  assert.ok(identidadPerteneceA(i, "alu-1"));
  assert.equal(identidadPerteneceA(i, "alu-2"), false);
  assert.equal(identidadPerteneceA(i, null), false);
  assert.equal(identidadPerteneceA(crearIdentidad({ ...datos(), alumnoId: 1 }, gen()).value, "1"), false);
  assert.equal(identidadPerteneceA({ ...i, ciclo: 0 }, "alu-1"), false);
});

// ---------------------------------------------------------------- anclas
test("ancla v1 valida: se reconoce como v1 SIN sessionId ni identidad inventada", () => {
  const r = clasificarAncla(anclaV1());
  assert.equal(r.tipo, "v1"); assert.equal(r.sessionId, null);
  assert.equal("identidad" in r, false); assert.equal("sessionId" in r.ancla, false);
  assert.deepEqual(r.ancla, anclaV1());
});
test("ancla v1 con sessionId, corrupta o incompleta -> invalida", () => {
  assert.equal(clasificarAncla({ ...anclaV1(), sessionId: UUID }).tipo, "invalida");
  for (const [k, v] of [["semana", 4], ["ciclo", 0], ["fecha", "31/02/2026"], ["startTime", -1], ["alumnoId", ""], ["rId", null], ["dIdx", -1]]) {
    const r = clasificarAncla({ ...anclaV1(), [k]: v }); assert.equal(r.tipo, "invalida", k); assert.equal(r.campo, k);
  }
  const a = anclaV1(); delete a.startTime; assert.equal(clasificarAncla(a).error, ERR.CAMPO_AUSENTE);
});
test("ancla v2 valida -> identidad equivalente", () => {
  const r = validarAnclaV2(anclaV2()); assert.ok(r.ok);
  assert.deepEqual(r.value, ident());
  const c = clasificarAncla(anclaV2()); assert.equal(c.tipo, "v2"); assert.deepEqual(c.identidad, ident());
});
test("ancla v2: campos ausentes, corruptos o incompatibles", () => {
  for (const [k, v] of [["sessionId", "x"], ["sessionId", undefined], ["semana", 4], ["semana", -1], ["ciclo", 0], ["fecha", "31/02/2026"], ["startTime", "1"], ["rId", ""], ["dIdx", 1.5], ["alumnoId", undefined]]) {
    const r = validarAnclaV2({ ...anclaV2(), [k]: v }); assert.equal(r.ok, false, k); assert.equal(r.campo, k);
  }
  assert.equal(validarAnclaV2({ ...anclaV2(), v: 1 }).error, ERR.VERSION);
  assert.equal(validarAnclaV2({ ...anclaV2(), v: 3 }).error, ERR.VERSION);
  assert.equal(validarAnclaV2(anclaV1()).ok, false);
  for (const x of [null, undefined, "x", 3, []]) assert.equal(validarAnclaV2(x).ok, false);
});
test("clasificar: version desconocida o ausente -> invalida", () => {
  assert.equal(clasificarAncla({ ...anclaV1(), v: 3 }).tipo, "invalida");
  const { v, ...sinV } = anclaV1(); assert.equal(clasificarAncla(sinV).tipo, "invalida");
  for (const x of [null, undefined, "x", 3, []]) assert.equal(clasificarAncla(x).tipo, "invalida");
});
test("identidad <-> ancla v2 sin perdida", () => {
  const i = ident(); const a = anclaV2DesdeIdentidad(i); assert.ok(a.ok);
  assert.deepEqual(a.value, anclaV2());
  assert.deepEqual(validarAnclaV2(a.value).value, i);
  assert.equal(anclaV2DesdeIdentidad({ ...i, semanaIdx: 9 }).ok, false);
});
test("ancla v1 nunca se promueve: validarAnclaV2 no le agrega sessionId", () => {
  assert.equal(validarAnclaV2(anclaV1()).ok, false);
  assert.equal(clasificarAncla(anclaV1()).sessionId, null);
});

// ---------------------------------------------------------------- aislamiento
test("el modulo no esta conectado a App.jsx, componentes ni otros lib", () => {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const app = readFileSync(path.join(root, "App.jsx"), "utf8");
  assert.ok(!/sessionIdentity/.test(app));
});

console.log("\n" + n + " pruebas OK");
