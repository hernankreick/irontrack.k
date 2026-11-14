// Interfaz de "Prescrito vs. ejecutado" (components/prescrito): estados, textos, accesibilidad y objetivos tactiles. Renderiza los componentes reales con esbuild
// + react-dom/server (en memoria). node scripts/test-prescritoEjecutadoVista.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { prepararInicioEntrenamiento } from "../lib/workoutSessionDate.js";
import { construirFilaCopia } from "../lib/prescripcionCopiaSync.js";
import { compararSesionesDelAlumno } from "../lib/prescritoEjecutadoResumen.js";
import { huellaMostradaDeSesion } from "../lib/prescritoEjecutadoCarga.js";
import * as T from "../lib/prescritoEjecutadoTextos.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(ROOT, "package.json"));
const { build } = require("esbuild");
const entry = `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Vista from ${JSON.stringify(ROOT + "/components/prescrito/PrescritoEjecutadoVista.jsx")};
import Panel from ${JSON.stringify(ROOT + "/components/prescrito/PrescritoEjecutadoPanel.jsx")};
import { IronTrackI18nProvider } from ${JSON.stringify(ROOT + "/contexts/IronTrackI18nContext.jsx")};
export { registrarHostPrescritoEjecutado } from ${JSON.stringify(ROOT + "/lib/prescritoEjecutadoHost.js")};
export const vista = (p) => renderToStaticMarkup(React.createElement(Vista, p));
export const panel = (p) => renderToStaticMarkup(React.createElement(IronTrackI18nProvider, { lang: 'es' }, React.createElement(Panel, p)));
`;
const out = await build({ stdin: { contents: entry, resolveDir: ROOT, loader: "jsx" }, bundle: true, write: false, format: "cjs", platform: "node", external: ["react", "react-dom", "react-dom/server"], loader: { ".jsx": "jsx" } });
const mod = { exports: {} }; new Function("require", "module", "exports", out.outputFiles[0].text)(require, mod, mod.exports);
const { vista, panel, registrarHostPrescritoEjecutado } = mod.exports; // el puente DEBE ser el del mismo bundle que el panel

let n = 0; const test = (name, fn) => { fn(); n++; console.log("ok -", name); };
const texto = (html) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/\s+/g, " ");
const memStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const A = "alumno-a", R = "rutina-1", T0 = new Date(2026, 10, 5, 10, 0).getTime();
const rutina = () => ({ id: R, nombre: "R", alumno_id: A, datos: { semana_activa: 1, days: [{ label: "A", warmup: [{ id: "mov", name: "Movilidad", sets: "2", reps: "12", kg: "20" }], exercises: [{ id: "sq", name: "Sentadilla", sets: "3", reps: "8-10", kg: "50" }, { id: "bp", name: "Press", sets: "3", reps: "10", kg: "30" }, { id: "pl", name: "Plancha", sets: "2", reps: "45s", kg: "PC" }] }] } });
const s = prepararInicioEntrenamiento({ storage: memStorage(), alumnoId: A, session: { rId: R, dIdx: 0, exIdx: 0, startTime: T0 }, ciclo: 1, semana: 0, now: T0 }).session; const uid = s.identity.sessionId;
const copia = Object.assign({ origen_lectura: "servidor" }, construirFilaCopia({ rutina: rutina(), alumnoId: A, session: s, capturadaEn: "2026-11-05T13:00:00.000Z" }).row);
const sesion = (id, over) => Object.assign({ id, alumno_id: A, rutina_id: R, ciclo: 1, semana: 1, dia_idx: 0, fecha: s.fecha, sesion_uid: uid, identidad_v: 1 }, over || {});
let k = 0; const ser = (bloque, pos, ej, kg, reps) => ({ id: "p" + (++k), alumno_id: A, sesion_uid: uid, bloque, pos, ejercicio_id: ej, kg, reps, semana: 0, fecha: s.fecha });
const series = [ser("warmup", 0, "mov", 20, 12), ser("warmup", 0, "mov", 20, 12), ser("main", 0, "sq", 55, 8), ser("main", 0, "sq", 50, 6), ser("main", 1, "bp", 30, 10)]; // press: 1 de 3; plancha omitida
const resultado = (extra) => compararSesionesDelAlumno({ sesiones: [sesion("s1")], copias: [copia], series, contexto: Object.assign({ registroSeriesCompleto: true, planificacionMostradaHash: huellaMostradaDeSesion([copia]) }, extra || {}) });

test("estados: cargando (aria-live), error (alert + Reintentar de 44 px), sin_tabla (explica sin alarmar), vacio", () => {
  assert.match(vista({ estado: "cargando" }), /role="status"[^>]*aria-live="polite"/);
  const e = vista({ estado: "error", onReintentar() {} }); assert.match(e, /role="alert"/); assert.match(e, /min-height:44px[^"]*|min-height:\s*44px/); assert.match(texto(e), /No pudimos cargar la comparación/); assert.match(texto(e), /Reintentar/);
  assert.ok(!vista({ estado: "error" }).includes("Reintentar"), "sin handler no hay boton");
  assert.match(texto(vista({ estado: "sin_tabla" })), /todavía no está habilitada/); assert.match(texto(vista({ estado: "sin_tabla", lang: "en" })), /not enabled in the database yet/);
  assert.match(texto(vista({ estado: "ok", resultado: compararSesionesDelAlumno({ sesiones: [], copias: [], series: [] }) })), /Todavía no hay sesiones terminadas/);
});
test("resultado verificable: porcentajes calculados solo si son validos; ejercicios completos/parciales/omitidos; cada resultado con icono Y palabra", () => {
  const html = vista({ estado: "ok", resultado: resultado(), abiertoInicial: true, cobertura: { historial_completo: true } }); const t = texto(html);
  assert.match(t, /Prescrito vs\. ejecutado/); assert.match(t, /Ciclo 1 · Semana 1/); assert.match(t, /Sentadilla/); assert.match(t, /Press/); assert.match(t, /Plancha/);
  assert.match(t, /Por debajo/); assert.match(t, /Cumplió/); assert.match(t, /No comparable/);
  assert.match(t, /1 completos · 2 parciales · 1 omitidos/); assert.match(t, /Ejercicios con todas las series 25 %/); assert.match(t, /Repeticiones en objetivo — algún ejercicio no es comparable/);
  assert.match(html, /aria-hidden="true">▼<\/span>/); assert.ok(html.includes("✓") && html.includes("–"), "iconos ademas del color");
  assert.match(t, /Series prescrito 2 · hecho 2/); assert.match(t, /Series prescrito 3 · hecho 1/, "series prescritas vs hechas"); assert.ok(!/NaN|undefined|null/.test(t), "ninguna cifra rota");
});
test("sin datos suficientes: cada estado se explica con palabras; sin porcentajes engañosos; cobertura 0 %", () => {
  const sinCopia = compararSesionesDelAlumno({ sesiones: [sesion("s1")], copias: [], series, contexto: { registroSeriesCompleto: true } });
  const t = texto(vista({ estado: "ok", resultado: sinCopia, abiertoInicial: true })); assert.match(t, /Sin copia de lo prescrito/); assert.match(t, /No se compara con la rutina actual/); assert.match(t, /Sin datos para comparar/);
  assert.match(t, /—/); assert.match(t, /ninguna sesión se pudo comparar/); assert.ok(!/\d+ %/.test(t.replace(/0 %/g, "")) || /0 %/.test(t));
  const hist = compararSesionesDelAlumno({ sesiones: [sesion("s2", { sesion_uid: null, identidad_v: null })], copias: [copia], series: series.map((x) => Object.assign({}, x, { sesion_uid: null })), contexto: { planificacionMostradaHash: huellaMostradaDeSesion([copia]) } });
  assert.match(texto(vista({ estado: "ok", resultado: hist, abiertoInicial: true })), /Sin cierre confirmado|Series sin vincular/);
  assert.match(texto(vista({ estado: "ok", resultado: resultado({ registroSeriesCompleto: false }), abiertoInicial: true, cobertura: { historial_completo: false } })), /historial de series está incompleto/);
  const sinEvid = texto(vista({ estado: "ok", resultado: resultado({ registroSeriesCompleto: false }), abiertoInicial: true })); assert.match(sinEvid, /Sin evidencia de si se hizo/); assert.ok(!/Omitido/.test(sinEvid), "sin registro completo no se afirma 'Omitido'");
});
test("accesibilidad y movil: botones con aria-expanded/aria-controls y >= 44 px, texto sin tamaños < 13 px, sin anchos fijos que desborden, modo claro y oscuro", () => {
  const html = vista({ estado: "ok", resultado: resultado(), abiertoInicial: true });
  const botones = [...html.matchAll(/<button[^>]*>/g)].map((m) => m[0]); assert.ok(botones.length >= 2);
  for (const b of botones) { assert.match(b, /aria-expanded="(true|false)"/); assert.match(b, /aria-controls="pe-/); const m = /min-height:(\d+)px/.exec(b); assert.ok(m && Number(m[1]) >= 44, b); }
  for (const m of html.matchAll(/font-size:(\d+)px/g)) assert.ok(Number(m[1]) >= 13, "fuente " + m[1]);
  assert.ok(!/(?:^|;|")width:\d{3,}px/.test(html), "sin anchos fijos grandes"); assert.match(html, /overflow-wrap:anywhere/); assert.match(html, /<section[^>]*aria-labelledby="pe-titulo"/); assert.match(html, /<h3 id="pe-titulo"/);
  const oscuro = vista({ estado: "ok", resultado: resultado(), darkMode: true }), claro = vista({ estado: "ok", resultado: resultado(), darkMode: false });
  assert.notEqual(oscuro, claro); assert.ok(oscuro.includes("#12121a") && claro.includes("#ffffff"));
  const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  for (const [fg, bg] of [["#a1a1aa", "#12121a"], ["#4ade80", "#052e16"], ["#facc15", "#422006"], ["#f87171", "#450a0a"], ["#475569", "#ffffff"], ["#15803d", "#dcfce7"], ["#854d0e", "#fef9c3"], ["#b91c1c", "#fee2e2"], ["#1d4ed8", "#ffffff"], ["#60a5fa", "#12121a"]]) assert.ok(ratio(fg, bg) >= 4.5, fg + " sobre " + bg + " = " + ratio(fg, bg).toFixed(2));
});
test("textos: es/en/pt completos para todos los estados y motivos; porcentaje nulo muestra raya y razon", () => {
  for (const lang of ["es", "en", "pt"]) {
    for (const e of ["verificable", "sin_copia", "ambigua", "copia_cache", "sin_finalizar", "validacion_manual_sin_series", "semana_inconsistente", "series_sin_vinculo"]) { assert.ok(T.etiquetaEstado(e, lang) && T.etiquetaEstado(e, lang) !== e); assert.ok(T.explicacionEstado(e, lang) !== e); }
    for (const m of ["prescripcion_vacia", "prescripcion_texto", "sin_series_ejecutadas", "unidad_de_series_no_garantizada", "faltantes_sin_evidencia_de_registro_completo", "kg_ejecutado_vacio_o_cero"]) assert.ok(T.textoMotivo(m, lang) !== m);
  }
  assert.deepEqual(T.textoPorcentaje({ valor: 75, motivo: null }, "es"), { texto: "75 %", nota: null }); assert.equal(T.textoPorcentaje({ valor: null, motivo: "sin_sesiones_verificables" }, "es").texto, "—"); assert.equal(T.textoPorcentaje(null, "es").texto, "—");
  assert.equal(T.textoResultado("rara", "es").clave, "no_comparable");
});
test("panel (contenedor): sin la bandera de build no renderiza NADA ni lee datos; con ella arranca en 'cargando'", () => {
  registrarHostPrescritoEjecutado({ activo: false, cargar() { throw new Error("no debe leer"); } }); assert.equal(panel({ alumnoId: A, propio: true }), "");
  registrarHostPrescritoEjecutado({ activo: true, cargar: async () => ({ estado: "ok" }) }); assert.match(panel({ alumnoId: A, propio: true }), /Cargando la comparación/);
  registrarHostPrescritoEjecutado(null); assert.equal(panel({ alumnoId: A }), "");
});
console.log("\n" + n + " pruebas OK");
