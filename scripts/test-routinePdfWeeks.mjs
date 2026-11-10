// PDF de rutina con TODAS las semanas configuradas (4..8 y mas), sin truncar ni inventar semanas. Solo lectura. Sin red ni navegador.
//   node scripts/test-routinePdfWeeks.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const imp = (f) => import(pathToFileURL(path.join(ROOT, f)).href);
let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

const X = await imp("lib/routinePdfExport.js");
const D = await imp("components/demo/pdfRutinaDemoData.js");

const render = (r, cw = 0) => {
  const rows = X.buildRoutinePdfRows(r, { allEx: [], es: true, progress: {}, currentWeek: cw });
  return { rows, html: X.buildRoutinePdfDocumentHtml(r, rows, true, { currentWeek: cw }, { autoPrint: false }) };
};
const deepFreeze = (o) => { if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };
const cards = (html) => html.split('<article class="itpdf-card').slice(1);
const cellCount = (card) => (card.match(/<td class="itpdf-c/g) || []).length;
const weekHeads = (card) => [...card.matchAll(/<th class="itpdf-th[^"]*">(?:▸ )?SEM (\d+)<\/th>/g)].map((m) => Number(m[1]));

await test("rutinas de 4, 5, 6, 7 y 8 semanas: cada ejercicio muestra exactamente sus semanas y 4 variables por semana", () => {
  for (const n of [4, 5, 6, 7, 8]) {
    const { rows, html } = render(D.rutinaDeSemanas(n));
    const exRows = rows.filter((r) => r.type === "ex" || r.type === "warmup-ex");
    assert.equal(exRows.length, 8);
    exRows.forEach((r) => assert.equal(r.wks.length, n));
    const cs = cards(html);
    assert.equal(cs.length, 8, "una tarjeta por ejercicio");
    cs.forEach((c) => {
      assert.deepEqual(weekHeads(c), Array.from({ length: n }, (_, i) => i + 1), n + " semanas en orden");
      assert.equal(cellCount(c), 4 * n, "series, reps, kg y pausa por cada semana");
      assert.equal((c.match(/<table/g) || []).length, 1, "una sola tabla (sin bloques) hasta 8 semanas");
    });
    assert.doesNotMatch(html, new RegExp("SEM " + (n + 1) + "<"), "no hay semana " + (n + 1));
  }
});

await test("ningun valor configurado se pierde: todos los kg, reps y pausas de cada semana aparecen en el documento", () => {
  const r = D.rutinaDeSemanas(8);
  const { html } = render(r);
  const exFirst = r.days[0].exercises[0];
  const c = cards(html).find((x) => x.includes("Sentadilla goblet"));
  const tds = [...c.matchAll(/<td class="itpdf-c[^"]*">([^<]*)<\/td>/g)].map((m) => m[1]);
  // orden: fila series, reps, kg, pausa; cada una con 8 semanas
  const fila = (i) => tds.slice(i * 8, i * 8 + 8);
  assert.deepEqual(fila(0), exFirst.weeks.map((w) => w.sets));
  assert.deepEqual(fila(1), exFirst.weeks.map((w) => w.reps));
  assert.deepEqual(fila(2), exFirst.weeks.map((w) => w.kg));
  assert.deepEqual(fila(3), exFirst.weeks.map(() => "1min"));
});

await test("ejercicios con DISTINTA cantidad de semanas en la misma rutina; sin semanas = solo valores base (no se inventan semanas)", () => {
  const { rows, html } = render(D.rutinaMixta());
  const byId = Object.fromEntries(rows.filter((r) => r.type === "ex").map((r) => [r.ex.id, r]));
  assert.deepEqual(["m4", "m5", "m6", "m7", "m8", "m10", "m0"].map((k) => byId[k].wks.length), [4, 5, 6, 7, 8, 10, 0]);
  const cs = cards(html);
  const heads = cs.map(weekHeads);
  assert.deepEqual(heads.slice(0, 5).map((h) => h.length), [4, 5, 6, 7, 8]);
  const planchaCard = cs.find((c) => c.includes("Plancha"));
  assert.deepEqual(weekHeads(planchaCard), [], "sin columnas de semana");
  assert.match(planchaCard, /itpdf-tbl--base/);
  assert.match(html, /4–10 semanas/, "el plan informa el rango real de semanas");
});

await test("mas de 8 semanas: no se trunca; se reparten en bloques parejos con todas las semanas una vez", () => {
  assert.deepEqual(X.splitWeekChunks(8), [[0, 8]]);
  assert.deepEqual(X.splitWeekChunks(9), [[0, 5], [5, 9]]);
  assert.deepEqual(X.splitWeekChunks(10), [[0, 5], [5, 10]]);
  assert.deepEqual(X.splitWeekChunks(16), [[0, 8], [8, 16]]);
  assert.equal(X.splitWeekChunks(17).length, 3);
  assert.deepEqual(X.splitWeekChunks(0), []);
  for (let n = 1; n <= 40; n++) {
    const ch = X.splitWeekChunks(n);
    assert.equal(ch[0][0], 0); assert.equal(ch[ch.length - 1][1], n);
    ch.forEach(([a, b], i) => { assert.ok(b - a >= 1 && b - a <= 8); if (i) assert.equal(a, ch[i - 1][1]); });
  }
  const { html } = render(D.rutinaMixta());
  const c10 = cards(html).find((x) => x.includes("(10 sem)"));
  assert.equal((c10.match(/<table/g) || []).length, 2);
  assert.deepEqual(weekHeads(c10), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(cellCount(c10), 40);
});

await test("valores vacios: guion, nunca 'undefined', 'null' ni 'NaN'; las semanas vacias configuradas se muestran como tales", () => {
  const { html } = render(D.rutinaBorde());
  assert.doesNotMatch(html, /undefined|null|NaN/);
  const c = cards(html).find((x) => x.includes("Vacíos"));
  assert.deepEqual(weekHeads(c), [1, 2, 3]);
  assert.equal((c.match(/itpdf-c--empty">—</g) || []).length, 12);
});

await test("notas semanales extensas: texto completo, sin cortar, por semana; el encabezado remite al recuadro de notas del plan", () => {
  const r = D.rutinaBorde();
  const { html } = render(r);
  const nota = r.days[0].exercises[1].weeks[0].note;
  assert.ok(nota.length > 200);
  assert.equal(html.split(nota.replace(/&/g, "&amp;")).length - 1 >= 2, true, "las dos semanas con la misma nota larga");
  assert.match(html, /Cierre del bloque/);
  assert.ok(html.includes(r.note.replace(/&/g, "&amp;")), "nota larga del plan completa");
  assert.doesNotMatch(html, /…/, "sin puntos suspensivos de truncado");
});

await test("compatibilidad con rutinas antiguas: numeros, sin pausa por semana, sin campo weeks/progresion, pausa no numerica", () => {
  const { rows, html } = render(D.rutinaBorde());
  const c4 = cards(html).find((x) => x.includes("Rutina antigua"));
  const tds = [...c4.matchAll(/<td class="itpdf-c([^"]*)">([^<]*)<\/td>/g)];
  const vals = tds.map((m) => m[2]);
  assert.deepEqual(vals.slice(10, 15), ["12.5", "15", "17.5", "20", "12.5"], "kg: la 5a semana sin kg usa la base (12.5)");
  assert.equal(tds[14][1].includes("itpdf-c--inh"), true, "heredado marcado");
  assert.equal(tds[10][1].includes("inh"), false, "valor propio no marcado");
  assert.deepEqual(vals.slice(15, 20), ["45s", "45s", "45s", "45s", "45s"], "pausa base numerica");
  assert.ok(html.includes(">90-120<"), "pausa no numerica se conserva tal cual");
  assert.ok(html.includes(">Peso corporal<") === false && html.includes(">PC+10<"));
  assert.match(html, /Los valores en gris provienen de la configuración base/);
  const sinWeeks = rows.find((r) => r.ex && r.ex.id === "e5");
  assert.deepEqual(sinWeeks.wks, []);
  assert.ok(html.includes("Nombre con &lt;b&gt;HTML&lt;/b&gt; &amp; &quot;comillas&quot;"), "texto escapado");
});

await test("ejercicios sin progresion (sin weeks): una sola fila con los valores base y leyenda; sin chip de metodo", () => {
  const r = { id: "x", name: "R", days: [{ label: "Dia 1", warmup: [], exercises: [{ id: "q", name: "Plancha", sets: "3", reps: "30 s", kg: "", pause: 60, progresion: "carga", weeks: [] }] }] };
  const { html } = render(r);
  const c = cards(html)[0];
  assert.deepEqual([...c.matchAll(/<td class="itpdf-c[^"]*">([^<]*)<\/td>/g)].map((m) => m[1]), ["3", "30 s", "—", "1min"]);
  assert.match(c, /Valores base/);
  assert.doesNotMatch(c, /Progresión:/);
  assert.doesNotMatch(html, /Los valores en gris/);
});

await test("metodo de progresion: chip y fila resaltada segun +Carga, +Reps, +Series, −Pausa; Manual sin chip", () => {
  const mk = (m) => ({ id: "x", name: "R", days: [{ label: "Dia 1", warmup: [], exercises: [{ id: "q", name: "E", sets: "3", reps: "8", kg: "10", pause: 60, progresion: m, weeks: D.mkWeeks(4, { kg0: 10 }) }] }] });
  const exp = { carga: ["+ Carga", "Kg"], reps: ["+ Reps", "Reps"], series: ["+ Series", "Series"], pausa: ["− Pausa", "Pausa"] };
  for (const [m, [chip, row]] of Object.entries(exp)) {
    const { html } = render(mk(m));
    assert.ok(html.includes("Progresión: " + chip), m);
    assert.match(html, new RegExp("itpdf-tr itpdf-tr--prog\"><th class=\"itpdf-rl\" scope=\"row\">" + row + "<"));
  }
  const { html } = render(mk("manual"));
  assert.doesNotMatch(html, /Progresión:/); assert.equal(html.includes('class="itpdf-tr itpdf-tr--prog"'), false);
});

await test("rutina con muchos ejercicios: todos presentes y reglas de salto de pagina (tarjetas indivisibles, titulos pegados al contenido)", () => {
  const r = D.rutinaLarga(8);
  const { html } = render(r);
  assert.equal(cards(html).length, 5 * 9);
  for (let d = 0; d < 5; d++) for (let e = 0; e < 8; e++) assert.ok(html.includes("Ejercicio " + (d + 1) + "." + (e + 1) + "<"), "ejercicio " + (d + 1) + "." + (e + 1));
  assert.match(html, /\.itpdf-card[^{]*\{break-inside:avoid;page-break-inside:avoid\}/);
  assert.match(html, /\.itpdf-day-title,\.itpdf-block-head\{break-after:avoid;page-break-after:avoid\}/);
  assert.match(html, /@page\{margin:8mm;size:A4\}/);
  assert.equal((html.match(/itpdf-day-title/g) || []).length >= 5, true);
});

await test("semana actual: se resalta solo si existe en el ejercicio; el PDF no agrega semanas por ella", () => {
  const { html } = render(D.rutinaDeSemanas(4), 5);
  assert.doesNotMatch(html, /itpdf-th--active">/);
  const w4 = render(D.rutinaDeSemanas(4), 2).html;
  assert.equal((w4.match(/itpdf-th--active">▸ SEM 3</g) || []).length, 8);
});

await test("solo lectura: la rutina de entrada (congelada) no se modifica y el resultado es determinista", () => {
  for (const build of [D.rutinaMixta, D.rutinaBorde, () => D.rutinaLarga(8)]) {
    const r = build();
    const before = JSON.stringify(r);
    deepFreeze(r);
    const a = render(r).html, b = render(r).html;
    assert.equal(JSON.stringify(r), before);
    assert.equal(a, b);
  }
});

await test("aviso de deslizamiento solo cuando hay mas de 4 semanas y solo visible en pantallas angostas (no en el PDF impreso)", () => {
  assert.equal(render(D.rutinaDeSemanas(4)).html.includes('class="itpdf-swipe"'), false);
  assert.equal(render(D.rutinaDeSemanas(6)).html.includes('class="itpdf-swipe"'), true);
  const css = render(D.rutinaDeSemanas(6)).html;
  assert.match(css, /\.itpdf-swipe\{display:none;/);
  assert.match(css, /@media screen and \(max-width:620px\)\{\.itpdf-swipe\{display:block\}/);
});

await test("alcance: el exportador no usa red, Supabase ni almacenamiento; App.jsx ya no fija 4 semanas", () => {
  const code = read("lib/routinePdfExport.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  assert.doesNotMatch(code, /supabase|fetch\(|localStorage|sessionStorage|XMLHttpRequest/i);
  const app = read("App.jsx");
  assert.doesNotMatch(app, /weeks4/);
  assert.match(app, /buildRoutinePdfRows\(r, \{ allEx, es, progress, currentWeek \}\)/);
  const exp = read("lib/routinePdfExport.js");
  assert.doesNotMatch(exp, /repeat\(4,\s*1fr\)/, "ya no hay grilla fija de 4 columnas");
});

console.log(count + " pruebas ok");
