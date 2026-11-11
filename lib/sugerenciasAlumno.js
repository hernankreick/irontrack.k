// ═══════════════════════════════════════════════════════════════
// SUGERENCIAS DE CARGA PARA EL ENTRENADOR (P0-3)
// ═══════════════════════════════════════════════════════════════
// Orientativas y de solo lectura: nunca modifican rutinas, cargas ni registros, y solo las muestra la interfaz del entrenador
// (components/students). Cuatro resultados por ejercicio de la rutina: "subir", "mantener", "evaluar_reduccion" e "insuficiente".
//
// Datos (lo que realmente existe):
//  - `progreso` (select=*): ejercicio_id, kg, reps, fecha d/m/aaaa, semana (0-based), ciclo, alumno_id. No guarda el día de la rutina
//    ni rutina_id, y el servidor NO guarda RPE: el RPE no se usa.
//  - Prescripción de cada semana: ex.weeks[w] (sets, reps, kg, pausa, note) con respaldo en la base del ejercicio (resolveExerciseForWeek).
//
// Sesión = mismo día de calendario + misma semana + mismo ciclo (antes cada FILA se tomaba como una sesión: tres series de un solo
// entrenamiento daban «estancado» o «subir»). Día de la rutina: si el ejercicio está en un solo día, ese; si está en varios, solo las
// series que una sesión de `sesiones` (fecha, semana, ciclo, ejercicios, dia_idx) asigna a ese día.
// Series de trabajo de una sesión = las de su mayor carga (el calentamiento y las series de descarga no cuentan).
// Sesiones COMPARABLES = las de semanas con la misma prescripción de series y rango de reps que la semana activa, sin semanas de
// descarga planificada (nota «descarga»/«deload», o kg o series prescritos menores que la semana anterior).
//
// Reglas:
//  - subir: las dos últimas sesiones comparables completas (todas las series prescritas, a la carga de trabajo, en el tope del rango)
//    y la última con carga >= la anterior. Incremento conservador por equipo (INCREMENTO_KG). Si una semana siguiente ya prescribe
//    más kg, se respeta la progresión planificada (mantener).
//  - evaluar_reduccion: caída sostenida en las tres últimas sesiones comparables (las dos últimas peores que la primera y la última
//    no mejor que la anterior). Una sola sesión baja no alcanza. Es una evaluación para el entrenador: no propone un peso.
//  - mantener: dos o más sesiones comparables sin criterio de subir ni de reducir (progreso parcial o estable); semana de descarga.
//  - insuficiente: sin historial, una sola sesión, sin dos sesiones comparables, día ambiguo, prescripción sin series o sin rango de
//    reps numérico (AMRAP, distancia), o ejercicio por tiempo.
// Módulo puro, sin React ni Supabase.

import { exerciseHasTimeTarget, resolveExerciseForWeek } from "./workoutSession.js";
import { parseFechaDMY } from "./progressDate.js";
import { diaDeCreatedAt } from "./metricas/fechas.js";
import { rowCiclo } from "./rutinaCiclo.js";

/** Incremento conservador (kg) por equipo; configurable en el futuro. */
export const INCREMENTO_KG = { mancuernas: 1, defecto: 2.5 };
export const TIPOS_SUGERENCIA = { SUBIR: "subir", MANTENER: "mantener", EVALUAR_REDUCCION: "evaluar_reduccion", INSUFICIENTE: "insuficiente" };
var PRIORIDAD = { evaluar_reduccion: 0, subir: 1, mantener: 2, insuficiente: 3 };
var EPS = 0.01;

function num(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  var s = String(v == null ? "" : v).trim();
  if (/^-?\d+,\d+$/.test(s)) s = s.replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

function fmtKg(kg) {
  return String(Math.round(kg * 100) / 100).replace(".", ",") + " kg";
}

/** Rango de reps de una prescripción: "8-10", "8 a 10", "10" => { min, max }; cualquier otra cosa (AMRAP, 400 m, 45s) => null. */
export function rangoReps(reps) {
  var s = String(reps == null ? "" : reps).trim().toLowerCase();
  var m = /^(\d{1,3})\s*(?:-|–|a)\s*(\d{1,3})(?:\s*reps?)?$/.exec(s);
  if (m) {
    var a = Number(m[1]), b = Number(m[2]);
    return a > 0 && b >= a ? { min: a, max: b } : null;
  }
  m = /^(\d{1,3})(?:\s*reps?)?$/.exec(s);
  return m && Number(m[1]) > 0 ? { min: Number(m[1]), max: Number(m[1]) } : null;
}

function prescripcion(ex, semanaIdx) {
  var p = Number.isInteger(semanaIdx) && semanaIdx >= 0 ? resolveExerciseForWeek(ex, semanaIdx) : ex;
  var sets = parseInt(p && p.sets, 10);
  var rango = rangoReps(p && p.reps);
  return { sets: sets > 0 ? sets : null, rango: rango, kg: num(p && p.kg), clave: (sets > 0 ? sets : "?") + "x" + (rango ? rango.min + "-" + rango.max : "?") };
}

/** Semana de descarga PLANIFICADA (índice 0-based): nota «descarga»/«deload», o kg o series prescritos menores que la semana anterior. */
export function esDescargaPlanificada(ex, semanaIdx) {
  var weeks = ex && Array.isArray(ex.weeks) ? ex.weeks : [];
  var w = weeks[semanaIdx];
  if (!w || typeof w !== "object") return false;
  if (/descarga|deload/i.test(String(w.note || ""))) return true;
  if (semanaIdx < 1) return false;
  var prev = resolveExerciseForWeek(ex, semanaIdx - 1), cur = resolveExerciseForWeek(ex, semanaIdx);
  var kp = num(prev.kg), kc = num(cur.kg), sp = parseInt(prev.sets, 10), sc = parseInt(cur.sets, 10);
  return (kp > 0 && kc > 0 && kc < kp - EPS) || (sp > 0 && sc > 0 && sc < sp);
}

/** Días (índices) de la rutina que incluyen el ejercicio. */
function diasConEjercicio(dias, exId) {
  var out = [];
  dias.forEach(function (dia, i) {
    var en = [].concat((dia && dia.warmup) || [], (dia && dia.exercises) || []).some(function (e) { return e && String(e.id) === String(exId); });
    if (en) out.push(i);
  });
  return out;
}

/** Día de la rutina de una serie según `sesiones` (una sola sesión que la explique), o null. */
function diaDeSerie(row, sesiones, rutinaId) {
  var dia = parseFechaDMY(row.fecha);
  var sem = Number(row.semana);
  var encontrados = {};
  var n = 0;
  (sesiones || []).forEach(function (s) {
    if (!s || parseFechaDMY(s.fecha) !== dia || Number(s.semana) !== sem + 1 || rowCiclo(s) !== rowCiclo(row)) return;
    if (rutinaId != null && s.rutina_id != null && s.rutina_id !== "" && String(s.rutina_id) !== String(rutinaId)) return;
    var ids = String(s.ejercicios || "").split(",").map(function (x) { return x.trim(); });
    if (ids.indexOf(String(row.ejercicio_id)) < 0) return;
    var di = Number(s.dia_idx);
    if (s.dia_idx == null || s.dia_idx === "" || !Number.isInteger(di) || di < 0) return;
    if (!encontrados[di]) { encontrados[di] = true; n++; }
  });
  return n === 1 ? Number(Object.keys(encontrados)[0]) : null;
}

/** Sesiones (día + semana + ciclo) de un ejercicio, del más antiguo al más reciente, con sus series de trabajo. */
function sesionesDe(rows) {
  var porClave = {};
  rows.forEach(function (r) {
    var k = r._dia + "|" + r._semana + "|" + rowCiclo(r);
    (porClave[k] = porClave[k] || { dia: r._dia, semana: r._semana, series: [] }).series.push(r);
  });
  return Object.keys(porClave).map(function (k) {
    var s = porClave[k];
    var top = Math.max.apply(null, s.series.map(function (r) { return r._kg; }));
    var trabajo = s.series.filter(function (r) { return Math.abs(r._kg - top) < EPS; }).map(function (r) { return r._reps; }).sort(function (a, b) { return b - a; });
    return { dia: s.dia, semana: s.semana, topKg: top, reps: trabajo };
  }).sort(function (a, b) { return a.dia - b.dia || a.semana - b.semana; });
}

function completa(ses, p) {
  return ses.reps.length >= p.sets && ses.reps.slice(0, p.sets).every(function (r) { return r >= p.rango.max; });
}

function sumaReps(ses, n) {
  return ses.reps.slice(0, n).reduce(function (a, b) { return a + b; }, 0);
}

/** ¿`a` rindió menos que `b`? Menos carga de trabajo, o la misma carga con menos reps en las series prescritas. */
function peor(a, b, n) {
  if (a.topKg < b.topKg - EPS) return true;
  return Math.abs(a.topKg - b.topKg) < EPS && sumaReps(a, n) < sumaReps(b, n);
}

function describir(ses) {
  return fmtKg(ses.topKg) + " × " + ses.reps.join(",");
}

/**
 * @param {Array}  registros   filas de `progreso` del alumno (forma real del select)
 * @param {object} rutinaDatos datos de la rutina vigente (days, semana_activa)
 * @param {Array}  EX          catálogo (nombre, equipo, objetivo de tiempo)
 * @param {object} [opts]      { rutina (fila con id y created_at: borde de asignación), sesiones (filas de `sesiones` para asignar el día), alumnoId }
 * @returns {Array} sugerencias { exId, nombre, tipo, estado, motivo, accion, ajuste, evidencia, kgSugerido?, prioridad, bloque, dIdx, eIdx, exData }
 */
export function generarSugerenciasAlumno(registros, rutinaDatos, EX, opts) {
  if (!rutinaDatos) return [];
  var o = opts || {};
  var dias = Array.isArray(rutinaDatos.days) ? rutinaDatos.days : [];
  var semanaActiva = Number(rutinaDatos.semana_activa);
  var semIdx = Number.isInteger(semanaActiva) && semanaActiva >= 1 ? semanaActiva - 1 : 0;
  var aid = o.alumnoId != null && o.alumnoId !== "" ? String(o.alumnoId) : null;
  var asignada = o.rutina && o.rutina.created_at ? diaDeCreatedAt(o.rutina.created_at) : null;
  var rutinaId = o.rutina && o.rutina.id != null ? o.rutina.id : null;
  var catalogo = {};
  (Array.isArray(EX) ? EX : []).forEach(function (e) { if (e && e.id != null) catalogo[String(e.id)] = e; });

  // series válidas del alumno, de esta rutina (no anteriores a la asignación); sin mutar las filas recibidas
  var validas = [];
  (Array.isArray(registros) ? registros : []).forEach(function (r) {
    if (!r || r.ejercicio_id == null) return;
    if (aid && r.alumno_id != null && String(r.alumno_id) !== aid) return;
    var dia = parseFechaDMY(r.fecha);
    var kg = num(r.kg), reps = num(r.reps);
    if (dia == null || !(kg > 0) || !(reps > 0) || !Number.isInteger(reps)) return;
    if (asignada != null && dia < asignada) return;
    var sem = Number(r.semana);
    validas.push(Object.assign({}, r, { _dia: dia, _kg: kg, _reps: reps, _semana: Number.isInteger(sem) && sem >= 0 ? sem : -1 }));
  });

  var out = [];
  dias.forEach(function (dia, dIdx) {
    [["warmup", (dia && dia.warmup) || []], ["exercises", (dia && dia.exercises) || []]].forEach(function (par) {
      var bloque = par[0];
      par[1].forEach(function (ex, eIdx) {
        if (!ex || ex.id == null) return;
        var exId = String(ex.id);
        var propias = validas.filter(function (r) { return String(r.ejercicio_id) === exId; });
        // calentamiento: solo si tiene series con carga
        if (bloque === "warmup" && !propias.length) return;
        var s = evaluar(ex, exId, dIdx, propias);
        var info = catalogo[exId];
        s.exId = ex.id;
        s.nombre = info ? info.name : ex.name || exId;
        s.estado = s.tipo;
        s.prioridad = PRIORIDAD[s.tipo];
        s.bloque = bloque;
        s.dIdx = dIdx;
        s.eIdx = eIdx;
        s.exData = ex;
        out.push(s);
      });
    });
  });
  return out.sort(function (a, b) { return a.prioridad - b.prioridad; });

  function insuf(motivo, ajuste) {
    var textos = {
      sin_historial: "Sin registros de este ejercicio en la rutina",
      una_sesion: "Una sola sesión registrada",
      sin_sesiones_comparables: "Sin dos sesiones comparables con la prescripción de la semana activa",
      dia_ambiguo: "El ejercicio está en varios días y las series no se pueden asignar a este día",
      prescripcion_insuficiente: "La prescripción no tiene series y un rango de repeticiones numérico",
      por_tiempo: "Ejercicio por tiempo: no hay regla de carga",
    };
    return { tipo: "insuficiente", motivo: motivo, accion: "Datos insuficientes", ajuste: ajuste || textos[motivo] || "" };
  }

  function evaluar(ex, exId, dIdx, propias) {
    var actual = resolveExerciseForWeek(ex, semIdx);
    if (exerciseHasTimeTarget(actual) || exerciseHasTimeTarget(catalogo[exId])) return insuf("por_tiempo");
    var p = prescripcion(ex, semIdx);
    if (!p.sets || !p.rango) return insuf("prescripcion_insuficiente");
    if (esDescargaPlanificada(ex, semIdx)) {
      return { tipo: "mantener", motivo: "descarga_planificada", accion: "Mantener la descarga planificada", ajuste: "Semana " + (semIdx + 1) + " de descarga: no se evalúa subir ni reducir" };
    }
    if (!propias.length) return insuf("sin_historial");
    var filas = propias;
    if (diasConEjercicio(dias, exId).length > 1) {
      filas = propias.filter(function (r) { return diaDeSerie(r, o.sesiones, rutinaId) === dIdx; });
      if (!filas.length) return insuf("dia_ambiguo");
    }
    var todas = sesionesDe(filas);
    if (todas.length < 2) return insuf("una_sesion");
    var comparables = todas.filter(function (s) {
      var sem = s.semana >= 0 ? s.semana : null;
      if (sem == null && Array.isArray(ex.weeks) && ex.weeks.length) return false; // semana desconocida con progresión semanal
      if (sem != null && esDescargaPlanificada(ex, sem)) return false;
      return prescripcion(ex, sem).clave === p.clave;
    });
    if (comparables.length < 2) return insuf("sin_sesiones_comparables");
    var n = p.sets;
    var ult = comparables[comparables.length - 1], pen = comparables[comparables.length - 2];
    var evidencia = comparables.slice(-3).map(describir).join(" → ");
    if (comparables.length >= 3) {
      var ref = comparables[comparables.length - 3];
      if (peor(pen, ref, n) && peor(ult, ref, n) && !peor(pen, ult, n)) {
        return {
          tipo: "evaluar_reduccion", motivo: "caida_sostenida", evidencia: evidencia,
          accion: "Evaluar reducción de carga",
          ajuste: "Caída sostenida en las últimas 3 sesiones comparables. Decisión del entrenador.",
        };
      }
    }
    if (completa(pen, p) && completa(ult, p) && ult.topKg >= pen.topKg - EPS) {
      var info = catalogo[exId];
      var inc = /mancuerna/i.test(String((info && (info.equip || info.equipment)) || "")) ? INCREMENTO_KG.mancuernas : INCREMENTO_KG.defecto;
      var objetivo = Math.round((ult.topKg + inc) * 100) / 100;
      var weeks = Array.isArray(ex.weeks) ? ex.weeks : [];
      for (var w = semIdx + 1; w < weeks.length; w++) {
        var kgPlan = num(resolveExerciseForWeek(ex, w).kg);
        if (kgPlan > ult.topKg + EPS) {
          return {
            tipo: "mantener", motivo: "progresion_planificada", evidencia: evidencia,
            accion: "Mantener la progresión planificada",
            ajuste: "Objetivo cumplido en 2 sesiones; la semana " + (w + 1) + " ya prescribe " + fmtKg(kgPlan),
          };
        }
      }
      return {
        tipo: "subir", motivo: "objetivo_cumplido", evidencia: evidencia, kgSugerido: objetivo,
        accion: "Aumentar a " + fmtKg(objetivo) + " (+" + fmtKg(inc) + ")",
        ajuste: n + "×" + p.rango.max + " cumplido en las 2 últimas sesiones a " + fmtKg(ult.topKg) + "; empezar en " + p.rango.min + " reps",
      };
    }
    var parcial = sumaReps(ult, n) > sumaReps(pen, n) || ult.topKg > pen.topKg + EPS;
    return {
      tipo: "mantener", motivo: parcial ? "progreso_parcial" : "estable", evidencia: evidencia,
      accion: "Mantener " + fmtKg(ult.topKg),
      ajuste: (parcial ? "Progreso dentro del rango" : "Rendimiento estable") + ": buscar " + n + "×" + p.rango.max + " en 2 sesiones antes de subir (última: " + ult.reps.join(",") + ")",
    };
  }
}
