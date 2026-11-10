// Logica pura del editor de progresion semanal (compartida por EditExModal y EditExerciseModal). Sin React, sin red, sin almacenamiento.
// Modelo (sin cambios): ex.weeks = [{ sets, reps, kg, pausa, note }]; la cantidad de semanas de un ejercicio es ex.weeks.length y la
// duracion de la rutina se deduce (lib/routineWeeks.js = maximo entre ejercicios): no existe un campo de duracion que mantener.

export const MIN_WEEKS = 4;
export const MAX_WEEKS = 8;
export const WEEK_OPTIONS = [4, 5, 6, 7, 8];

export const blankWeek = () => ({ sets: '', reps: '', kg: '', note: '', pausa: '' });

const str = (v) => (v === undefined || v === null ? '' : String(v));

// Normaliza una semana guardada a los 5 campos conocidos (mismo recorte de campos que hacian los editores anteriores).
export function normalizeWeek(w) {
  const x = w && typeof w === 'object' ? w : {};
  return { sets: str(x.sets), reps: str(x.reps), kg: str(x.kg), note: str(x.note), pausa: str(x.pausa) };
}

// Cantidad de semanas al abrir: la guardada; menos de 4 se completa a 4 (igual que antes). NUNCA se recorta por encima de 8.
export function detectWeekCount(weeks) {
  const n = Array.isArray(weeks) ? weeks.length : 0;
  return Math.max(MIN_WEEKS, n);
}

// Todas las semanas guardadas (incluidas las que superen el selector) + vacias hasta MIN_WEEKS.
export function initWeeksFull(weeks) {
  const base = (Array.isArray(weeks) ? weeks : []).map(normalizeWeek);
  while (base.length < MIN_WEEKS) base.push(blankWeek());
  return base;
}

// Opciones del selector: 4..8 y, si el ejercicio guardado tiene mas, esa cantidad tambien (para no ocultar ni recortar datos).
export function weekOptionsFor(initialCount) {
  const opts = [...WEEK_OPTIONS];
  if (initialCount > MAX_WEEKS) opts.push(initialCount);
  return opts;
}

export function weekHasData(w) {
  if (!w) return false;
  return [w.sets, w.reps, w.kg, w.pausa, w.note].some((v) => str(v).trim() !== '');
}

// Semanas (indices) con datos que dejarian de guardarse al pasar de `from` a `to` semanas (to < from).
export function weeksLostByReducing(weeks, from, to) {
  const lost = [];
  for (let i = to; i < from && i < weeks.length; i++) if (weekHasData(weeks[i])) lost.push(i);
  return lost;
}

// Aumenta: agrega semanas vacias solo si el arreglo local no las tiene (los datos ocultos por una reduccion NO confirmada se conservan).
export function ensureWeeks(weeks, count) {
  if (weeks.length >= count) return weeks;
  const out = weeks.slice();
  while (out.length < count) out.push(blankWeek());
  return out;
}

// Lo que se guarda: exactamente `count` semanas (con el mismo respaldo de pausa que antes).
export function weeksForSave(weeks, count, pause) {
  return ensureWeeks(weeks, count).slice(0, count).map((w) => ({ ...w, pausa: w.pausa || pause }));
}

export function setWeekField(weeks, wi, field, value) {
  return weeks.map((w, i) => (i === wi ? { ...w, [field]: value } : w));
}

export function copyWeekValues(weeks, from, to) {
  if (from < 0 || to < 0 || from >= weeks.length || to >= weeks.length) return weeks;
  const s = weeks[from];
  return weeks.map((w, i) => (i === to ? { ...w, sets: s.sets, reps: s.reps, kg: s.kg, pausa: s.pausa } : w));
}

export function fillRowRight(weeks, field, from, count) {
  const v = weeks[from][field];
  return weeks.map((w, i) => (i > from && i < count ? { ...w, [field]: v } : w));
}

// Mismas lineas de delta que mostraban los editores (solo cambia que ahora es una funcion reutilizable).
export function deltaHint(method, prev, cur) {
  if (!prev || !cur || method === 'manual') return '';
  let d, unit = '';
  if (method === 'carga' && prev.kg && cur.kg) { d = Math.round((parseFloat(cur.kg) - parseFloat(prev.kg)) * 10) / 10; unit = ' kg'; }
  else if (method === 'reps' && prev.reps && cur.reps) { d = parseInt(cur.reps, 10) - parseInt(prev.reps, 10); unit = ' reps'; }
  else if (method === 'series' && prev.sets && cur.sets) { d = parseInt(cur.sets, 10) - parseInt(prev.sets, 10); unit = ' series'; }
  else if (method === 'pausa' && prev.pausa && cur.pausa) { d = parseInt(cur.pausa, 10) - parseInt(prev.pausa, 10); unit = 's pausa'; }
  else return '';
  if (!Number.isFinite(d) || d === 0) return '';
  return (d > 0 ? '+' : '') + d + unit;
}

export const METHOD_FIELD = { carga: 'kg', reps: 'reps', series: 'sets', pausa: 'pausa', manual: null };

// Misma regla que EditExerciseModal.autocompletar (cada semana parte de la semana anterior GUARDADA en el estado, como antes), limitada a las semanas visibles (+2.5 kg, +1 rep, +1 serie, -15 s con minimo 15 s).
export function autocompleteWeeks(weeks, base, method, count) {
  if (method === 'manual') return weeks;
  return weeks.map((w, i) => {
    if (i >= count) return w;
    const p = i > 0 ? weeks[i - 1] : null;
    const next = {
      sets: w.sets || base.sets,
      reps: w.reps || base.reps,
      kg: w.kg || base.kg,
      note: w.note,
      pausa: w.pausa || base.pause,
    };
    if (i === 0) return next;
    if (method === 'carga') return { ...next, kg: String(Math.round((parseFloat(p.kg || base.kg || 0) + 2.5) * 10) / 10) };
    if (method === 'reps') return { ...next, reps: String(parseInt(p.reps || base.reps || 8, 10) + 1) };
    if (method === 'series') return { ...next, sets: String(parseInt(p.sets || base.sets || 3, 10) + 1) };
    if (method === 'pausa') return { ...next, pausa: String(Math.max(15, parseInt(p.pausa || base.pause || 90, 10) - 15)) };
    return next;
  });
}
