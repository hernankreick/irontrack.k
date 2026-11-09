import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export const pw = require(process.env.PLAYWRIGHT_MODULE || '/opt/node-tools/node_modules/playwright');
const HERE = path.dirname(new URL(import.meta.url).pathname); const REPO = path.resolve(HERE, '../../../..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
export function serve() { return new Promise((res) => { const s = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]); let f = u.startsWith('/repo/') ? path.join(REPO, u.slice(6)) : path.join(HERE, u === '/' ? 'index.html' : u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
}).listen(0, '127.0.0.1', () => res({ s, port: s.address().port })); }); }
export const SEED = [{ id: 'rr-ana', name: 'Rutina Ana', alumno_id: 'al-1', alumno: 'Ana Ficticia', note: '', saved: true, collapsed: false,
  days: [{ label: 'Día 1', warmup: [], exercises: [
    { id: 'sq', name: 'Sentadilla', sets: '3', reps: '8', kg: '60', pause: 90, note: '', weeks: [] },
    { id: 'bp', name: 'Press banca', sets: '4', reps: '10', kg: '40', pause: 90, note: '', weeks: [] }] },
    { label: 'Día 2', warmup: [], exercises: [{ id: 'dl', name: 'Peso muerto', sets: '3', reps: '5', kg: '80', pause: 120, note: '', weeks: [] }] }] }];
export async function open(browser, port, { seed = SEED, mode = 'ok', delay = 0, serverRows = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(([seed, mode, delay, serverRows]) => {
    if (!sessionStorage.getItem('__seeded')) { localStorage.setItem('it_rt', JSON.stringify(seed)); sessionStorage.setItem('__seeded', '1'); }
    window.__mode = mode; window.__delay = delay; if (serverRows) window.__serverRows = serverRows;
  }, [seed, mode, delay, serverRows]);
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error' && !/Warning:/.test(m.text())) errors.push('console: ' + m.text().slice(0, 160)); });
  await page.goto('http://127.0.0.1:' + port + '/'); await page.waitForSelector('text=Rutina Ana', { timeout: 15000 });
  return { ctx, page, errors };
}
export const S = (page) => page.evaluate(() => ({ routines: window.__routines, writes: window.__writes, toasts: window.__toasts, db: window.__db, ls: JSON.parse(localStorage.getItem('it_rt') || '[]') }));
export const barVisible = (page) => page.evaluate(() => { const b = document.querySelector('.it-routines-unsaved'); return !!b && b.classList.contains('is-visible'); });
// Editar series/reps/kg de un ejercicio via menú ⋮ → Editar → modal real → GUARDAR
export async function editExercise(page, exName, { sets, reps, kg } = {}) {
  const card = page.locator('div', { has: page.getByText(exName, { exact: true }) }).filter({ has: page.getByRole('button', { name: 'Más acciones del ejercicio' }) }).last();
  await card.getByRole('button', { name: 'Más acciones del ejercicio' }).click();
  await page.locator('.it-routine-menu-item', { hasText: 'Editar' }).click();
  const dlg = page.getByRole('dialog', { name: 'Editar ejercicio: ' + exName });
  const inputs = dlg.locator('input');
  if (sets != null) await inputs.nth(0).fill(String(sets));
  if (reps != null) await inputs.nth(1).fill(String(reps));
  if (kg != null) await inputs.nth(2).fill(String(kg));
  return dlg;
}
