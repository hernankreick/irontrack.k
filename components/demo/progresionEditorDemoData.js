// Datos ficticios y logica pura de la maqueta comparativa del editor de progresion semanal (demo/progresion-editor.html).
// Los metodos y las formulas de "Autocompletar" replican EditExerciseModal / EditExModal; aqui NO se guarda nada.

export const METODOS = [
  { id: 'carga',  label: '+ Carga',  desc: 'Subir kg c/semana',     color: '#2563EB', field: 'kg' },
  { id: 'reps',   label: '+ Reps',   desc: 'Más reps, mismo peso',  color: '#22C55E', field: 'reps' },
  { id: 'series', label: '+ Series', desc: 'Más series c/semana',   color: '#8B5CF6', field: 'sets' },
  { id: 'pausa',  label: '− Pausa',  desc: 'Reducir descanso',      color: '#F59E0B', field: 'pausa' },
  { id: 'manual', label: 'Manual',   desc: 'Definís vos c/semana',  color: '#8B9AB2', field: null },
];

export const FIELDS = [
  { key: 'sets',  label: 'Series', short: 'SERIES' },
  { key: 'reps',  label: 'Reps',   short: 'REPS' },
  { key: 'kg',    label: 'Kg',     short: 'KG' },
  { key: 'pausa', label: 'Pausa',  short: 'PAUSA (s)' },
];

export const EXERCISE_NAME = 'Sentadilla goblet';
export const BASE_INICIAL = { sets: '3', reps: '8', kg: '16', pause: '60' };

// 8 semanas siempre en memoria: al pasar de 8 a 4 semanas no se pierden datos; ambos diseños leen este mismo arreglo.
export function semanasIniciales() {
  const w = (sets, reps, kg, pausa, note = '') => ({ sets, reps, kg, pausa, note });
  return [
    w('3', '8', '16', '60'),
    w('3', '9', '16', '60', 'Pausa completa entre series'),
    w('3', '10', '16', '60'),
    w('3', '8', '18', '60', 'Subir 2 kg y volver a 8 reps'),
    w('3', '9', '18', '60'),
    w('3', '10', '18', '60'),
    w('3', '8', '20', '60'),
    w('3', '9', '20', '60', 'Semana de descarga si hay fatiga'),
  ];
}

export function deltaHint(method, prev, cur) {
  const m = METODOS.find((x) => x.id === method);
  if (!m || !m.field || !prev || !cur) return '';
  const a = prev[m.field], b = cur[m.field];
  if (a === '' || b === '' || a == null || b == null) return '';
  const d = method === 'carga' ? parseFloat(b) - parseFloat(a) : parseInt(b, 10) - parseInt(a, 10);
  if (!Number.isFinite(d) || d === 0) return '';
  const r = Math.round(d * 10) / 10;
  return (r > 0 ? '+' : '−') + Math.abs(r);
}

// Misma regla que EditExerciseModal.autocompletar (+2.5 kg, +1 rep, +1 serie, −15 s con minimo 15 s).
// Cada semana parte de la anterior ya recalculada; las celdas vacias toman el valor base.
export function autocompletar(weeks, base, method, count) {
  if (method === 'manual') return weeks;
  const out = [];
  weeks.forEach((w, i) => {
    const cur = { ...w, sets: w.sets || base.sets, reps: w.reps || base.reps, kg: w.kg || base.kg, pausa: w.pausa || base.pause };
    if (i > 0 && i < count) {
      const p = out[i - 1];
      if (method === 'carga') cur.kg = String(Math.round((parseFloat(p.kg || base.kg || 0) + 2.5) * 10) / 10);
      if (method === 'reps') cur.reps = String(parseInt(p.reps || base.reps || 8, 10) + 1);
      if (method === 'series') cur.sets = String(parseInt(p.sets || base.sets || 3, 10) + 1);
      if (method === 'pausa') cur.pausa = String(Math.max(15, parseInt(p.pausa || base.pause || 90, 10) - 15));
    }
    out.push(i < count ? cur : w);
  });
  return out;
}

export function setCell(weeks, wi, field, value) {
  return weeks.map((w, i) => (i === wi ? { ...w, [field]: value } : w));
}

// Copia series/reps/kg/pausa de una semana a otra (la nota no se copia).
export function copyWeek(weeks, from, to) {
  if (from < 0 || to < 0 || from >= weeks.length || to >= weeks.length) return weeks;
  const s = weeks[from];
  return weeks.map((w, i) => (i === to ? { ...w, sets: s.sets, reps: s.reps, kg: s.kg, pausa: s.pausa } : w));
}

// Copia un campo de la semana `from` a todas las siguientes hasta `count`.
export function fillRight(weeks, field, from, count) {
  const v = weeks[from][field];
  return weeks.map((w, i) => (i > from && i < count ? { ...w, [field]: v } : w));
}
