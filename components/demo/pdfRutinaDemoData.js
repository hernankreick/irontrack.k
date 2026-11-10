// Rutinas FICTICIAS para la demo y las pruebas del PDF de rutina (demo/pdf-rutina.html). Sin datos reales.

const NOTAS_LARGAS =
  'Mantener el torso erguido, bajar controlando 3 segundos y subir explosivo. Si la técnica se rompe en las últimas repeticiones, ' +
  'cortar la serie y registrar el RPE real. Descansar lo indicado aunque se sienta bien; la semana de descarga reduce 10 % la carga.';

// Semanas con progresión +2 kg cada 3 semanas y reps 8-9-10 (mismo patrón del mockup).
export const mkWeeks = (n, opts) => {
  const o = opts || {};
  return Array.from({ length: n }, (_, i) => ({
    sets: String(o.sets ?? 3),
    reps: String(8 + (i % 3)),
    kg: String(o.kg0 + 2 * Math.floor(i / 3)),
    pausa: String(o.pausa ?? 60),
    note: o.notes && o.notes[i] ? o.notes[i] : '',
  }));
};

const ex = (id, name, weeksN, extra) => {
  const e = extra || {};
  return {
    id, name, sets: '3', reps: '8-10', kg: String(e.kg0 ?? 16), pause: e.pause ?? 60, progresion: e.progresion || 'carga',
    weeks: weeksN ? mkWeeks(weeksN, { kg0: e.kg0 ?? 16, notes: e.notes, pausa: e.pausa }) : [],
    ...(e.raw || {}),
  };
};

/** Rutina ficticia donde TODOS los ejercicios tienen n semanas. */
export function rutinaDeSemanas(n) {
  return {
    id: 'demo-' + n, name: 'Fuerza base · ' + n + ' semanas', alumno: 'Alumno Demo', note: 'Ganar fuerza general', created: '10/11/2026',
    days: [
      {
        label: 'Dia 1', warmup: [ex('w1', 'Movilidad de cadera', n, { kg0: 0, progresion: 'manual', pausa: 30 })],
        exercises: [
          ex('a1', 'Sentadilla goblet', n, { kg0: 16, notes: { 1: 'Pausa de 1 s abajo' } }),
          ex('a2', 'Press de banca', n, { kg0: 40, progresion: 'reps' }),
          ex('a3', 'Remo con barra', n, { kg0: 30, pausa: 90 }),
          ex('a4', 'Plancha con carga', n, { kg0: 10, progresion: 'series' }),
        ],
      },
      {
        label: 'Dia 2', warmup: [],
        exercises: [
          ex('b1', 'Peso muerto rumano', n, { kg0: 50, pausa: 120, progresion: 'pausa' }),
          ex('b2', 'Press militar', n, { kg0: 25 }),
          ex('b3', 'Dominadas asistidas', n, { kg0: 0, progresion: 'manual' }),
        ],
      },
    ],
  };
}

/** Ejercicios con duraciones DISTINTAS (4, 5, 6, 7, 8, 10 semanas y uno sin semanas) en la misma rutina. */
export function rutinaMixta() {
  return {
    id: 'demo-mixta', name: 'Rutina mixta (duraciones distintas)', alumno: 'Alumno Demo', note: '', created: '10/11/2026',
    days: [{
      label: 'Dia 1', warmup: [],
      exercises: [
        ex('m4', 'Sentadilla goblet (4 sem)', 4),
        ex('m5', 'Press mancuernas (5 sem)', 5, { kg0: 14 }),
        ex('m6', 'Remo con barra (6 sem)', 6, { kg0: 30 }),
        ex('m7', 'Peso muerto rumano (7 sem)', 7, { kg0: 50, progresion: 'series' }),
        ex('m8', 'Hip thrust (8 sem)', 8, { kg0: 60, progresion: 'pausa' }),
        ex('m10', 'Dominadas lastradas (10 sem)', 10, { kg0: 5 }),
        ex('m0', 'Plancha (sin semanas guardadas)', 0, { kg0: 0, progresion: 'manual', raw: { reps: '30 s', kg: '' } }),
      ],
    }],
  };
}

/** Casos borde: valores vacíos, notas extensas, pausa no numérica, datos antiguos (sin progresion/pausa por semana, números). */
export function rutinaBorde() {
  return {
    id: 'demo-borde', name: 'Casos borde', alumno: '', note: 'Nota del plan muy larga para comprobar que no se corta ni se pierde: ' + NOTAS_LARGAS, created: '',
    days: [{
      label: 'Dia 1', warmup: [],
      exercises: [
        ex('e1', 'Vacíos (semanas sin valores)', 0, { raw: { sets: '', reps: '', kg: '', pause: '', weeks: [{ sets: '', reps: '', kg: '', pausa: '', note: '' }, {}, null] } }),
        ex('e2', 'Notas extensas por semana', 6, { kg0: 20, notes: { 0: NOTAS_LARGAS, 3: NOTAS_LARGAS, 5: 'Cierre del bloque' } }),
        ex('e3', 'Pausa no numérica y kg de texto', 4, { raw: { pause: '90-120', kg: 'Peso corporal', weeks: [{ sets: '3', reps: '8-10', kg: 'PC', pausa: '90-120', note: '' }, { sets: '3', reps: '8-10', kg: 'PC+5', pausa: '90-120', note: '' }, { sets: '4', reps: '6', kg: 'PC+10', pausa: '120', note: '' }, { sets: '4', reps: '6', kg: 'PC+10', pausa: '120', note: '' }] } }),
        ex('e4', 'Rutina antigua: números y sin pausa semanal', 5, { raw: { sets: 4, reps: 10, kg: 12.5, pause: 45, progresion: undefined, weeks: [{ sets: 4, reps: 10, kg: 12.5 }, { sets: 4, reps: 10, kg: 15 }, { sets: 4, reps: 10, kg: 17.5 }, { sets: 4, reps: 10, kg: 20 }, { sets: 4, reps: 10 }] } }),
        ex('e5', 'Sin campo weeks (muy antiguo)', 0, { raw: { weeks: undefined } }),
        ex('e6', 'Nombre con <b>HTML</b> & "comillas"', 4, { kg0: 8 }),
      ],
    }],
  };
}

/** Rutina con muchos ejercicios para comprobar saltos de página: 5 días x 8 ejercicios de 8 semanas + entrada en calor. */
export function rutinaLarga(n) {
  const weeksN = n || 8;
  const days = Array.from({ length: 5 }, (_, d) => ({
    label: 'Dia ' + (d + 1),
    warmup: [ex('lw' + d, 'Activación día ' + (d + 1), weeksN, { kg0: 0, progresion: 'manual' })],
    exercises: Array.from({ length: 8 }, (_, e) => ex('l' + d + '-' + e, 'Ejercicio ' + (d + 1) + '.' + (e + 1), weeksN, { kg0: 10 + e * 5, notes: e % 3 === 0 ? { 2: 'Nota semana 3 del ejercicio ' + (e + 1) } : undefined })),
  }));
  return { id: 'demo-larga', name: 'Rutina larga · 5 días', alumno: 'Alumno Demo', note: '', created: '10/11/2026', days };
}

export const RUTINAS_DEMO = [
  { id: '4', label: '4 semanas', build: () => rutinaDeSemanas(4) },
  { id: '5', label: '5 semanas', build: () => rutinaDeSemanas(5) },
  { id: '6', label: '6 semanas', build: () => rutinaDeSemanas(6) },
  { id: '7', label: '7 semanas', build: () => rutinaDeSemanas(7) },
  { id: '8', label: '8 semanas', build: () => rutinaDeSemanas(8) },
  { id: 'mixta', label: 'Mixta (4 a 10 sem.)', build: rutinaMixta },
  { id: 'borde', label: 'Casos borde', build: rutinaBorde },
  { id: 'larga', label: 'Larga (5 días, 8 sem.)', build: () => rutinaLarga(8) },
];
