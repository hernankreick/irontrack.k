// QA visual de "Prescrito vs. ejecutado" (components/prescrito) con datos ficticios, sin red ni Supabase. Playwright NO es dependencia: se resuelve del entorno (ver lib.mjs).
// Uso: node scripts/qa/prescrito-ejecutado-visual.mjs [--widths 375,390,430,768] [--out <carpeta de capturas>]
// En cada ancho, claro y oscuro y estados ok (desplegado) / sin_copia / error / sin_tabla / cargando: sin overflow horizontal, controles >= 44 px, texto >= 13 px,
// contraste >= 4,5:1 contra el fondo efectivo, sin errores de pagina. Capturas en --out. No reemplaza probar en un iPhone real (safe area, teclado, VoiceOver).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { chromiumPath, resolvePlaywright } from "./lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(path.join(ROOT, "package.json"));
const { build } = require("esbuild");
const o = { widths: [375, 390, 430, 768], out: fs.mkdtempSync(path.join(os.tmpdir(), "pe-visual-")) };
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a === "--widths") o.widths = process.argv[++i].split(",").map(Number); else if (a === "--out") { o.out = path.resolve(process.argv[++i]); fs.mkdirSync(o.out, { recursive: true }); } else throw new Error("Opcion desconocida: " + a); }

const entry = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import Vista from ${JSON.stringify(ROOT + "/components/prescrito/PrescritoEjecutadoVista.jsx")};
import { prepararInicioEntrenamiento } from ${JSON.stringify(ROOT + "/lib/workoutSessionDate.js")};
import { construirFilaCopia } from ${JSON.stringify(ROOT + "/lib/prescripcionCopiaSync.js")};
import { compararSesionesDelAlumno } from ${JSON.stringify(ROOT + "/lib/prescritoEjecutadoResumen.js")};
import { huellaMostradaDeSesion } from ${JSON.stringify(ROOT + "/lib/prescritoEjecutadoCarga.js")};
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const A = 'alumno-a', R = 'rutina-1', T0 = new Date(2026, 10, 5, 10, 0).getTime();
const rutina = { id: R, nombre: 'R', alumno_id: A, datos: { semana_activa: 1, days: [{ label: 'A', warmup: [{ id: 'mov', name: 'Movilidad de cadera con banda elastica', sets: '2', reps: '12', kg: '20' }], exercises: [
  { id: 'sq', name: 'Sentadilla frontal con pausa en el fondo', sets: '3', reps: '8-10', kg: '50' }, { id: 'bp', name: 'Press', sets: '3', reps: '10', kg: '30' }, { id: 'pl', name: 'Plancha', sets: '2', reps: '45s', kg: 'PC' }] }] } };
const s = prepararInicioEntrenamiento({ storage: mem(), alumnoId: A, session: { rId: R, dIdx: 0, exIdx: 0, startTime: T0 }, ciclo: 1, semana: 0, now: T0 }).session;
const copia = Object.assign({ origen_lectura: 'servidor' }, construirFilaCopia({ rutina, alumnoId: A, session: s, capturadaEn: '2026-11-05T13:00:00.000Z' }).row);
const mk = (id, semana, uid) => ({ id, alumno_id: A, rutina_id: R, ciclo: 1, semana, dia_idx: 0, fecha: s.fecha, sesion_uid: uid, identidad_v: 1 });
let k = 0; const ser = (b, p, e, kg, r) => ({ id: 'p' + (++k), alumno_id: A, sesion_uid: s.identity.sessionId, bloque: b, pos: p, ejercicio_id: e, kg, reps: r, semana: 0, fecha: s.fecha });
const series = [ser('warmup', 0, 'mov', 20, 12), ser('warmup', 0, 'mov', 20, 12), ser('main', 0, 'sq', 55, 8), ser('main', 0, 'sq', 50, 6), ser('main', 1, 'bp', 30, 10)];
const ok = compararSesionesDelAlumno({ sesiones: [mk('s1', 1, s.identity.sessionId), mk('s2', 2, 'zzzzzzzz-zzzz-4zzz-8zzz-zzzzzzzzzzzz')], copias: [copia], series, contexto: { registroSeriesCompleto: true, planificacionMostradaHash: huellaMostradaDeSesion([copia]) } });
const sinCopia = compararSesionesDelAlumno({ sesiones: [mk('s1', 1, s.identity.sessionId)], copias: [], series, contexto: {} });
const casos = { ok: { estado: 'ok', resultado: ok, cobertura: { historial_completo: true }, abiertoInicial: true }, sin_copia: { estado: 'ok', resultado: sinCopia, abiertoInicial: true }, error: { estado: 'error', onReintentar() {} }, sin_tabla: { estado: 'sin_tabla' }, cargando: { estado: 'cargando' } };
window.montar = (caso, dark, lang) => { document.body.style.background = dark ? '#0a0a0f' : '#ffffff'; document.body.style.margin = '0'; document.body.style.padding = '16px'; document.body.style.fontFamily = 'Inter, system-ui, sans-serif';
  window.__root && window.__root.unmount(); const el = document.getElementById('root'); el.innerHTML = ''; window.__root = createRoot(el); window.__root.render(React.createElement(Vista, Object.assign({ darkMode: dark, lang }, casos[caso]))); };
`;
const bundle = (await build({ stdin: { contents: entry, resolveDir: ROOT, loader: "jsx" }, bundle: true, write: false, format: "iife", platform: "browser", loader: { ".jsx": "jsx" }, define: { "process.env.NODE_ENV": '"production"' } })).outputFiles[0].text;

const pw = resolvePlaywright();
const browser = await pw.chromium.launch({ executablePath: chromiumPath(), args: ["--no-first-run"] });
const fallos = []; let comprobados = 0;
for (const width of o.widths) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(String(e))); page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>'); await page.addScriptTag({ content: bundle });
  for (const dark of [true, false]) for (const caso of ["ok", "sin_copia", "error", "sin_tabla", "cargando"]) {
    await page.evaluate(([c, d]) => window.montar(c, d, "es"), [caso, dark]); await page.waitForTimeout(60);
    const r = await page.evaluate(() => {
      const bgDe = (el) => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; const m = c.match(/rgba?\(([^)]+)\)/); if (m) { const p = m[1].split(",").map(Number); if (p.length < 4 || p[3] > 0.99) return p.slice(0, 3); } } return [255, 255, 255]; };
      const lum = (c) => { const v = c.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
      const root = document.getElementById("root"); const out = { overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, chicos: [], fuentes: [], contraste: [] };
      for (const b of root.querySelectorAll("button")) { const r = b.getBoundingClientRect(); if (r.height < 43.5 || r.width < 43.5) out.chicos.push((b.textContent || "").trim().slice(0, 30) + " " + Math.round(r.width) + "x" + Math.round(r.height)); }
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let nd;
      while ((nd = w.nextNode())) { const t = nd.textContent.trim(); if (!t) continue; const el = nd.parentElement; const cs = getComputedStyle(el); const fs = parseFloat(cs.fontSize); if (fs < 12.9) out.fuentes.push(t.slice(0, 30) + " " + fs);
        const m = cs.color.match(/rgba?\(([^)]+)\)/); if (!m || el.getAttribute("aria-hidden") === "true") continue; const fg = m[1].split(",").map(Number).slice(0, 3); const bg = bgDe(el); const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x); const ratio = (a + 0.05) / (b + 0.05); if (ratio < 4.5) out.contraste.push(t.slice(0, 30) + " " + ratio.toFixed(2)); }
      return out;
    });
    comprobados++; const etiqueta = width + "px " + (dark ? "oscuro" : "claro") + " " + caso;
    if (r.overflow) fallos.push(etiqueta + ": overflow horizontal"); if (r.chicos.length) fallos.push(etiqueta + ": controles < 44 px " + r.chicos.join("; "));
    if (r.fuentes.length) fallos.push(etiqueta + ": texto < 13 px " + r.fuentes.slice(0, 3).join("; ")); if (r.contraste.length) fallos.push(etiqueta + ": contraste < 4,5 " + r.contraste.slice(0, 3).join("; "));
    if (caso === "ok" || caso === "sin_copia") await page.screenshot({ path: path.join(o.out, "pe-" + width + "-" + (dark ? "oscuro" : "claro") + "-" + caso + ".png"), fullPage: true });
  }
  if (errs.length) fallos.push(width + "px: errores de pagina " + errs.slice(0, 3).join(" | "));
  await ctx.close();
}
await browser.close();
console.log("combinaciones comprobadas: " + comprobados + " | capturas: " + o.out);
if (fallos.length) { console.log("FALLOS:\n- " + fallos.join("\n- ")); process.exit(1); }
console.log("OK: sin overflow, controles >= 44 px, texto >= 13 px, contraste >= 4,5:1 y sin errores de pagina");
