/**
 * Plantillas de rutina: agregar entradas aquí para escalar sin tocar la UI.
 * Cada ejercicio referencia `id` del catálogo EX en App.jsx.
 */
export const ROUTINE_TEMPLATES = [
  {
    id: 'ppl_hype',
    nameEs: 'PPL — Hipertrofia',
    nameEn: 'PPL — Hypertrophy',
    hintEs: 'Empuje · Tracción · Pierna',
    hintEn: 'Push · Pull · Legs',
    days: [
      {
        labelEs: 'Empuje',
        labelEn: 'Push',
        exercises: [
          { id: 'bp', sets: '4', reps: '6-10', pause: 120 },
          { id: 'idbp', sets: '3', reps: '8-12', pause: 90 },
          { id: 'late', sets: '3', reps: '12-15', pause: 60 },
          { id: 'tric', sets: '3', reps: '10-12', pause: 60 },
        ],
      },
      {
        labelEs: 'Tracción',
        labelEn: 'Pull',
        exercises: [
          { id: 'lat', sets: '4', reps: '8-12', pause: 90 },
          { id: 'row', sets: '4', reps: '8-10', pause: 90 },
          { id: 'curl', sets: '3', reps: '10-12', pause: 60 },
          { id: 'revfly', sets: '3', reps: '12-15', pause: 60 },
        ],
      },
      {
        labelEs: 'Pierna',
        labelEn: 'Legs',
        exercises: [
          { id: 'sq', sets: '4', reps: '6-10', pause: 120 },
          { id: 'rdl', sets: '3', reps: '8-10', pause: 90 },
          { id: 'lp', sets: '3', reps: '10-15', pause: 90 },
          { id: 'legext', sets: '3', reps: '12-15', pause: 60 },
        ],
      },
    ],
  },
  {
    id: 'upper_lower',
    nameEs: 'T / I — 4 días',
    nameEn: 'Upper / Lower — 4 days',
    hintEs: 'Torso · Inferior ×2',
    hintEn: 'Upper · Lower ×2',
    days: [
      {
        labelEs: 'Torso A',
        labelEn: 'Upper A',
        exercises: [
          { id: 'bp', sets: '4', reps: '6-8', pause: 120 },
          { id: 'row', sets: '4', reps: '6-10', pause: 90 },
          { id: 'ohp', sets: '3', reps: '8-10', pause: 90 },
          { id: 'lat', sets: '3', reps: '10-12', pause: 75 },
          { id: 'tric', sets: '3', reps: '10-12', pause: 60 },
        ],
      },
      {
        labelEs: 'Inferior A',
        labelEn: 'Lower A',
        exercises: [
          { id: 'sq', sets: '4', reps: '6-8', pause: 120 },
          { id: 'rdl', sets: '3', reps: '8-10', pause: 90 },
          { id: 'lp', sets: '3', reps: '10-12', pause: 90 },
          { id: 'legext', sets: '3', reps: '12-15', pause: 60 },
        ],
      },
      {
        labelEs: 'Torso B',
        labelEn: 'Upper B',
        exercises: [
          { id: 'dbp', sets: '4', reps: '8-10', pause: 90 },
          { id: 'prow', sets: '4', reps: '6-8', pause: 90 },
          { id: 'arnold', sets: '3', reps: '8-12', pause: 75 },
          { id: 'hammer', sets: '3', reps: '10-12', pause: 60 },
          { id: 'curl', sets: '3', reps: '10-12', pause: 60 },
        ],
      },
      {
        labelEs: 'Inferior B',
        labelEn: 'Lower B',
        exercises: [
          { id: 'dl', sets: '3', reps: '5-8', pause: 150 },
          { id: 'hip', sets: '3', reps: '8-12', pause: 90 },
          { id: 'seathc', sets: '3', reps: '10-12', pause: 75 },
          { id: 'calf', sets: '4', reps: '12-20', pause: 45 },
        ],
      },
    ],
  },
  {
    id: 'full3',
    nameEs: 'Cuerpo completo ×3',
    nameEn: 'Full body ×3',
    hintEs: '3 días equilibrados',
    hintEn: '3 balanced days',
    days: [
      {
        labelEs: 'Full A',
        labelEn: 'Full A',
        exercises: [
          { id: 'sq', sets: '4', reps: '6-10', pause: 120 },
          { id: 'bp', sets: '3', reps: '8-10', pause: 90 },
          { id: 'row', sets: '3', reps: '8-10', pause: 90 },
          { id: 'lat', sets: '3', reps: '10-12', pause: 75 },
        ],
      },
      {
        labelEs: 'Full B',
        labelEn: 'Full B',
        exercises: [
          { id: 'rdl', sets: '3', reps: '8-10', pause: 120 },
          { id: 'ohp', sets: '3', reps: '8-10', pause: 90 },
          { id: 'lat', sets: '3', reps: '10-12', pause: 75 },
          { id: 'curl', sets: '3', reps: '10-12', pause: 60 },
        ],
      },
      {
        labelEs: 'Full C',
        labelEn: 'Full C',
        exercises: [
          { id: 'lp', sets: '4', reps: '10-12', pause: 90 },
          { id: 'dip', sets: '3', reps: '8-12', pause: 75 },
          { id: 'cabrow', sets: '3', reps: '10-12', pause: 75 },
          { id: 'plank', sets: '3', reps: '45-60s', pause: 60 },
        ],
      },
    ],
  },
];

function exerciseRow(row) {
  return {
    id: row.id,
    sets: String(row.sets ?? '3'),
    reps: String(row.reps ?? '8-10'),
    kg: '',
    pause: row.pause != null ? row.pause : 90,
    note: row.note ?? '',
    weeks: [],
  };
}

/** Días vacíos con etiquetas localizadas */
export function emptyDays(n, es) {
  return Array.from({ length: n }, (_, i) => ({
    label: es ? `Día ${i + 1}` : `Day ${i + 1}`,
    warmup: [],
    exercises: [],
    showWarmup: false,
    showMain: true,
  }));
}

/**
 * @param {typeof ROUTINE_TEMPLATES[0]} template
 * @param {boolean} es
 */
export function instantiateTemplate(template, es) {
  return template.days.map((d) => ({
    label: es ? d.labelEs : d.labelEn,
    warmup: [],
    exercises: (d.exercises || []).map(exerciseRow),
    showWarmup: false,
    showMain: true,
  }));
}

export function getTemplateById(id) {
  return ROUTINE_TEMPLATES.find((t) => t.id === id) || null;
}
