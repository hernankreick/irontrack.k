// Flujos cuyo estado vive en App.jsx: se aplican en el arnés las MISMAS transformaciones de setRoutines (copiadas de App.jsx), sobre RutinaView real.
import { pw, serve, open, S, barVisible, editExercise } from './lib.mjs';
const { s, port } = await serve(); const browser = await pw.chromium.launch(); const out = [];
const rec = (id, t, ok, ev) => { out.push({ id, t, ok, ev }); console.log((ok ? 'REPRODUCIDO ' : 'NO REPRO    ') + id + ' — ' + t + '\n   ' + JSON.stringify(ev)); };
// E12: confirmar «Agregar ejercicios» de la biblioteca (App.jsx:4485-4515). rutinasSB no contiene la rutina → solo cambio local.
{ const { ctx, page } = await open(browser, port);
  await page.getByRole('button', { name: /Ejercicio|Agregar ejercicio/i }).first().click().catch(() => {});
  const addEx = await page.evaluate(() => window.__addEx);
  await page.evaluate(({ rId, dIdx, bloque }) => { const blk = bloque || 'exercises'; const newExs = [{ id: 'row', name: 'Remo', sets: '3', reps: '8-10', kg: '', pause: 0, note: '', weeks: [] }];
    window.__setRoutines((p) => p.map((rr) => rr.id !== rId ? rr : { ...rr, days: rr.days.map((d, i) => i !== dIdx ? d : { ...d, [blk]: [...(d[blk] || []), ...newExs] }) })); }, addEx || { rId: 'rr-ana', dIdx: 0, bloque: 'exercises' });
  await page.waitForTimeout(300); const st = await S(page);
  rec('E12', 'Agregar ejercicios desde la biblioteca (rutina no cargada en la ficha): cambio solo local, sin aviso «sin guardar» ni escritura', !(await barVisible(page)) && st.writes.length === 0 && st.routines[0].days[0].exercises.some((e) => e.id === 'row'),
    { modalPedido: addEx, barra: await barVisible(page), escrituras: st.writes.length, ejerciciosDia1: st.routines[0].days[0].exercises.map((e) => e.id) });
  // Además, «Guardar cambios» queda inaccesible y handleSaveAll sale temprano (if (!hasUnsaved) return)
  await ctx.close(); }
// E13: confirmDuplicateDay (App.jsx:1093-1113) desde «Copiar día»
{ const { ctx, page } = await open(browser, port);
  await page.getByRole('button', { name: 'Copiar día' }).first().click(); const dup = await page.evaluate(() => window.__dup);
  await page.evaluate((m) => { const src = m.sourceDay; window.__setRoutines((p) => p.map((rr) => rr.id !== m.rId ? rr : { ...rr, days: rr.days.map((dd, ddi) => ddi !== 1 ? dd : { ...JSON.parse(JSON.stringify(src)), label: dd.label }) })); }, dup);
  await page.waitForTimeout(300); const st = await S(page);
  rec('E13', 'Duplicar Día 1 sobre Día 2: reemplaza el Día 2 localmente sin aviso «sin guardar» ni escritura', !(await barVisible(page)) && st.writes.length === 0 && st.routines[0].days[1].exercises[0].id === 'sq',
    { barra: await barVisible(page), escrituras: st.writes.length, dia2: st.routines[0].days[1].exercises.map((e) => e.id) });
  await ctx.close(); }
// E14: edición sin guardar → Alumnos → «Abrir en Rutinas» (App.jsx:2817-2830 con rut armado en StudentsSection.jsx:577)
{ const { ctx, page } = await open(browser, port);
  const d = await editExercise(page, 'Sentadilla', { kg: 100 }); await d.getByRole('button', { name: 'GUARDAR' }).click(); await page.waitForTimeout(200);
  await page.click('#nav-alumnos'); await page.waitForTimeout(200);
  await page.evaluate(() => { const server = JSON.parse(JSON.stringify(window.__routines[0])); server.days[0].exercises[0].kg = '60';
    const rutinaActiva = { id: 'rr-ana', nombre: 'Rutina Ana', datos: { days: server.days, alumno: 'Ana Ficticia', semana_activa: 1 } };
    const rut = { id: rutinaActiva.id, ...(rutinaActiva.datos || {}), name: rutinaActiva.nombre, saved: true, alumno_id: 'al-1', alumno: 'Ana Ficticia' };
    window.__setRoutines((prev) => { const ex = prev.find((x) => x.id === rut.id); return ex ? prev.map((x) => x.id === rut.id ? rut : x) : [rut].concat(prev); }); });
  await page.click('#nav-rutinas'); await page.waitForTimeout(400); const st = await S(page);
  rec('E14', 'Edición sin guardar + cambiar a Alumnos + «Abrir en Rutinas»: la copia del servidor reemplaza la edición local sin aviso', st.routines[0].days[0].exercises[0].kg === '60' && st.writes.length === 0,
    { kgAntes: '100', kgDespues: st.routines[0].days[0].exercises[0].kg, escrituras: st.writes.length, barra: await barVisible(page) });
  await ctx.close(); }
(await import('node:fs')).writeFileSync(new URL('./out/results-app.json', import.meta.url), JSON.stringify(out, null, 2));
await browser.close(); s.close();
