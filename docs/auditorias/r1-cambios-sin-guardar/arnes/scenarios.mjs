// Escenarios R1 sobre componentes REALES (RutinaView/RoutineCard/DaySection/EditExerciseModal) con datos ficticios y Supabase simulado.
import { pw, serve, open, S, barVisible, editExercise, SEED } from './lib.mjs';
const { s, port } = await serve(); const browser = await pw.chromium.launch();
const results = [];
const rec = (id, title, pass, evidence) => { results.push({ id, title, reproduced: pass, evidence }); console.log((pass ? 'REPRODUCIDO ' : 'NO REPRO    ') + id + ' — ' + title + '\n   ' + JSON.stringify(evidence)); };
const kgSq = (st, src = 'routines') => (src === 'ls' ? st.ls : st.routines)[0].days[0].exercises.find((e) => e.id === 'sq').kg;
const dbKg = (st, id = 'rr-ana') => st.db[id] ? st.db[id].datos.days[0].exercises.find((e) => e.id === 'sq').kg : '(sin escritura en servidor)';
async function editSave(page, ex, vals) { const d = await editExercise(page, ex, vals); await d.getByRole('button', { name: 'GUARDAR' }).click(); await page.waitForTimeout(200); }
const saveAll = (page) => page.locator('.it-routines-unsaved').getByRole('button', { name: 'Guardar cambios' }).click();

// E1 navegación interna (Rutinas → Alumnos → Rutinas)
{ const { ctx, page } = await open(browser, port);
  await editSave(page, 'Sentadilla', { kg: 100 }); const before = await barVisible(page);
  await page.click('#nav-alumnos'); await page.waitForTimeout(200); await page.click('#nav-rutinas'); await page.waitForTimeout(400);
  const st = await S(page); const after = await barVisible(page);
  rec('E1', 'Editar kg y cambiar de sección: al volver, la edición sigue en memoria pero el aviso «cambios sin guardar» desaparece y no hubo escritura', before && !after && kgSq(st) === '100' && st.writes.length === 0,
    { barraAntes: before, barraDespues: after, kgLocal: kgSq(st), escrituras: st.writes.length, servidor: dbKg(st) });
  // E1b: Descartar ya no puede revertir la edición anterior (baseline tomado del estado editado)
  await editSave(page, 'Press banca', { kg: 55 });
  await page.locator('.it-routines-unsaved').getByRole('button', { name: 'Descartar' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Descartar' }).click(); await page.waitForTimeout(300);
  const st2 = await S(page);
  rec('E1b', 'Tras volver a la sección, «Descartar» no revierte la edición previa (kg 100 queda como base) ', kgSq(st2) === '100',
    { kgSentadillaTrasDescartar: kgSq(st2), kgPressTrasDescartar: st2.routines[0].days[0].exercises.find((e) => e.id === 'bp').kg, servidor: dbKg(st2) });
  await ctx.close(); }

// E2 recarga (equivalente a cierre de Safari / PWA expulsada de memoria y reapertura)
{ const { ctx, page } = await open(browser, port);
  let dialogs = 0; page.on('dialog', async (d) => { dialogs++; await d.dismiss(); });
  await editSave(page, 'Sentadilla', { kg: 100 });
  await page.reload(); await page.waitForSelector('text=Rutina Ana'); await page.waitForTimeout(400);
  const st = await S(page);
  rec('E2', 'Recarga con cambios sin guardar: sin aviso beforeunload; la edición queda solo en localStorage, sin indicador y sin llegar al servidor', dialogs === 0 && !(await barVisible(page)) && kgSq(st, 'ls') === '100' && st.writes.length === 0,
    { dialogosBeforeUnload: dialogs, barra: await barVisible(page), kgLocalStorage: kgSq(st, 'ls'), escrituras: st.writes.length });
  await ctx.close(); }

// E3-E5 error de guardado (Guardar cambios) → ¿éxito falso?
for (const [id, mode, label] of [['E3', 'error', 'error PostgREST/RLS (42501)'], ['E4', 'vacio', '0 filas actualizadas ([])'], ['E5', 'red', 'falla de red (excepción)']]) {
  const { ctx, page } = await open(browser, port, { mode });
  await editSave(page, 'Sentadilla', { kg: 100 }); await saveAll(page); await page.waitForTimeout(500);
  const st = await S(page); const bar = await barVisible(page);
  rec(id, '«Guardar cambios» con ' + label + ': toast de éxito y aviso apagado sin haber guardado', !bar && st.toasts.some((t) => /Cambios guardados/.test(t)) && dbKg(st) === '(sin escritura en servidor)',
    { toasts: st.toasts, barra: bar, intentos: st.writes.map((w) => w.op + ':' + w.mode), servidor: dbKg(st) });
  await ctx.close(); }

// E6 guardado por tarjeta («Guardar» de RoutineCard) con error
{ const { ctx, page } = await open(browser, port, { mode: 'error' });
  await editSave(page, 'Sentadilla', { kg: 100 });
  await page.getByRole('button', { name: 'Guardar', exact: true }).click(); await page.waitForTimeout(500);
  const st = await S(page); const lbl = await page.locator('button[aria-live=polite]').first().innerText();
  rec('E6', 'Botón «Guardar» de la tarjeta con error de servidor: muestra «Rutina guardada ✓» y la tarjeta pasa a «Guardado»', st.toasts.some((t) => /Rutina guardada/.test(t)) && /Guardado/.test(lbl),
    { toasts: st.toasts, etiquetaBoton: lbl, barraGlobal: await barVisible(page), servidor: dbKg(st) });
  await ctx.close(); }

// E7 edición durante un guardado en curso (latencia 1,5 s)
{ const { ctx, page } = await open(browser, port, { delay: 1500 });
  await editSave(page, 'Sentadilla', { kg: 100 }); await saveAll(page); await page.waitForTimeout(150);
  await editSave(page, 'Press banca', { kg: 77 }); await page.waitForTimeout(2200);
  const st = await S(page); const bar = await barVisible(page);
  const dbBp = st.db['rr-ana'] ? st.db['rr-ana'].datos.days[0].exercises.find((e) => e.id === 'bp').kg : null;
  rec('E7', 'Editar mientras «Guardar cambios» está en curso: al terminar se apaga el aviso aunque la 2.ª edición no se guardó', !bar && dbBp !== '77' && st.routines[0].days[0].exercises.find((e) => e.id === 'bp').kg === '77',
    { barra: bar, kgPressLocal: '77', kgPressServidor: dbBp, escrituras: st.writes.length, toasts: st.toasts });
  await ctx.close(); }

// E8 doble toque en «Guardar cambios» con rutina nueva (saved:false) → inserciones duplicadas
{ const seed = [{ ...SEED[0], id: 'local-nueva', saved: false }];
  const { ctx, page } = await open(browser, port, { seed, delay: 800 });
  await editSave(page, 'Sentadilla', { kg: 100 });
  await page.evaluate(() => { const b = [...document.querySelectorAll('.it-routines-unsaved button')].find((x) => /Guardar cambios/.test(x.textContent)); b.click(); b.click(); });
  await page.waitForTimeout(2000); const st = await S(page);
  const inserts = st.writes.filter((w) => w.op === 'insert').length;
  rec('E8', 'Doble toque en «Guardar cambios» con una rutina nueva: se crean filas duplicadas en el servidor', inserts >= 2, { inserts, idsLocales: st.routines.map((r) => r.id), toasts: st.toasts });
  await ctx.close(); }

// E9 reordenar ejercicios (autoguardado inmediato) → ¿qué days se envían?
{ const { ctx, page } = await open(browser, port);
  const handles = page.getByRole('button', { name: 'Reordenar ejercicio' });
  const a = await handles.nth(0).boundingBox(), b2 = await handles.nth(1).boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2 + (b2.y - a.y + 20) * i / 12);
  await page.mouse.up(); await page.waitForTimeout(600);
  const st = await S(page); const w = st.writes[0];
  rec('E9', 'Reordenar ejercicios dispara un autoguardado; se inspecciona el payload enviado', !!w && (w.days == null || !Array.isArray(w.days) || w.days.length !== 2),
    { escrituras: st.writes.map((x) => ({ op: x.op, diasEnviados: Array.isArray(x.days) ? x.days.length : String(x.days) })), ordenLocal: st.routines[0].days[0].exercises.map((e) => e.id), barra: await barVisible(page) });
  await ctx.close(); }

// E10 «Guardar cambios» escribe TODAS las rutinas en memoria, aunque solo se editó una
{ const seed = [SEED[0], { ...SEED[0], id: 'rr-beto', name: 'Rutina Beto', alumno_id: 'al-2', alumno: 'Beto Ficticio', collapsed: true }];
  const { ctx, page } = await open(browser, port, { seed });
  await editSave(page, 'Sentadilla', { kg: 100 }); await saveAll(page); await page.waitForTimeout(500);
  const st = await S(page);
  rec('E10', '«Guardar cambios» reescribe también rutinas no editadas con la copia local (riesgo de pisar cambios hechos en otro dispositivo)', st.writes.some((w) => w.id === 'rr-beto'),
    { rutinasEscritas: st.writes.map((w) => w.id) });
  await ctx.close(); }

// E11 cerrar el modal de edición con × después de tipear
{ const { ctx, page } = await open(browser, port);
  const d = await editExercise(page, 'Sentadilla', { kg: 100 }); await d.getByRole('button', { name: 'Cerrar' }).click(); await page.waitForTimeout(200);
  const st = await S(page);
  rec('E11', 'Cerrar el modal «Editar ejercicio» con × tras tipear: se descarta sin confirmación', kgSq(st) === '60', { kgLocal: kgSq(st), modalAbierto: await page.getByRole('dialog').count() });
  await ctx.close(); }

console.log('\nRESUMEN', JSON.stringify(results.map((r) => [r.id, r.reproduced])));
(await import('node:fs')).writeFileSync(new URL('./out/results.json', import.meta.url), JSON.stringify(results, null, 2));
await browser.close(); s.close();
