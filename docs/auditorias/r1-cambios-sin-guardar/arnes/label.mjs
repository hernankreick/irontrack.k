import { pw, serve, open, S, editExercise } from './lib.mjs';
const { s, port } = await serve(); const b = await pw.chromium.launch();
const lbl = (p) => p.locator('button[aria-live=polite]').first().innerText();
{ const { ctx, page } = await open(b, port);
  console.log('inicial:', await lbl(page));
  await page.evaluate(() => window.__setRoutines((p) => p.map((rr) => ({ ...rr, days: rr.days.map((d, i) => i ? d : { ...d, exercises: [...d.exercises, { id: 'row', name: 'Remo', sets: '3', reps: '8', kg: '' }] }) }))));
  await page.waitForTimeout(200); console.log('tras agregar desde biblioteca:', await lbl(page));
  await page.click('#nav-alumnos'); await page.click('#nav-rutinas'); await page.waitForTimeout(300);
  console.log('tras cambiar de sección y volver:', await lbl(page)); await ctx.close(); }
{ const { ctx, page } = await open(b, port);
  const d = await editExercise(page, 'Sentadilla', { kg: 100 }); await d.getByRole('button', { name: 'GUARDAR' }).click(); await page.waitForTimeout(200);
  console.log('E1 tras editar:', await lbl(page)); await page.reload(); await page.waitForSelector('text=Rutina Ana'); await page.waitForTimeout(300);
  console.log('E2 tras recargar:', await lbl(page), '| kg local', (await S(page)).routines[0].days[0].exercises[0].kg); await ctx.close(); }
await b.close(); s.close();
