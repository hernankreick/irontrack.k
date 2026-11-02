// Adherencia al plan en un periodo: UNA definicion para las estadisticas del entrenador.
//
//   planificadas = dias de la rutina asignada x semanas del periodo efectivo (redondeo hacia arriba de dias / 7).
//                  El periodo efectivo empieza en max(desde, dia en que se asigno la rutina): no se penaliza lo anterior a la asignacion.
//   completadas  = sesiones completadas de ESA rutina (rutina_id; legado sin rutina_id: mismo nombre) del alumno dentro del periodo
//                  efectivo, contando una sola vez cada (dia de calendario, dia de la rutina). No se filtra por ciclo: un reinicio no
//                  borra que el alumno entreno. Las validadas por el entrenador (origen "validada_coach") cuentan, pero se informan aparte;
//                  si el mismo dia hay una realizada y una validada, cuenta como realizada.
//                  D7.2: (1) tope POR SEMANA: cada semana de calendario (lunes a domingo) aporta como maximo `diasPorSemana`, y el
//                  total no supera `planificadas`; asi entrenar de mas una semana (o repetir un dia tras un reinicio de semana) no tapa
//                  una semana vacia, y el resultado no depende del dia en que empieza el periodo. (2) Una fila sin dia de la
//                  rutina (dia_idx nulo) no se suma si ese mismo dia ya hay una con dia_idx (es el mismo entrenamiento; si la nula era
//                  realizada, ese dia cuenta como realizado). (3) Legado sin
//                  rutina_id: solo cuenta si se creo despues de asignar la rutina (por timestamp, como D7.1 en orphanSessions).
//   pct          = completadas / planificadas (tope 100). Sin rutina, sin dias o periodo efectivo vacio: pct = null (sin plan).
//   La semana en curso cuenta contra la meta semanal completa (no se prorratea por los dias transcurridos): es el «X % esta semana».
// Modulo puro.

import { diaDeSesion, diaDeCreatedAt, enRango, lunesDe } from "./fechas.js";
import { isCompletedSession, sessionMatchesRoutine } from "../studentWeeklyProgress.js";

export const ORIGEN_VALIDADA = "validada_coach";

/** Instante de un created_at en ms; sin zona horaria se lee como UTC (igual que createdAtSortKey / diaDeCreatedAt). */
function tsMs(v) {
  if (v == null || v === "") return NaN;
  var str = String(v).trim();
  if (!/[zZ]$|[+-]\d{2}:?\d{2}$/.test(str)) str = str.replace(" ", "T") + "Z";
  return Date.parse(str);
}

function diasDeRutina(rutina) {
  var days = (rutina && rutina.datos && Array.isArray(rutina.datos.days)) ? rutina.datos.days
    : (rutina && Array.isArray(rutina.days) ? rutina.days : []);
  return days.length;
}

/**
 * @param {object} p
 * @param {object} p.rutina   rutina asignada vigente (id, nombre, created_at, datos.days)
 * @param {Array}  p.sesiones filas de `sesiones` (pueden ser de todo el roster)
 * @param {*}      p.alumnoId
 * @param {number} p.desde    numero de dia (inclusivo)
 * @param {number} p.hasta    numero de dia (inclusivo)
 * @returns {{ planificadas, completadas, realizadas, validadas, pct, desdeEfectivo, semanas, diasPorSemana, motivo }}
 */
export function adherencia(p) {
  var o = p || {};
  var rutina = o.rutina;
  var diasPorSemana = diasDeRutina(rutina);
  var base = { planificadas: 0, completadas: 0, realizadas: 0, validadas: 0, pct: null, desdeEfectivo: null, semanas: 0, diasPorSemana: diasPorSemana, motivo: null };
  if (!rutina || rutina.id == null) return Object.assign(base, { motivo: "sin_rutina" });
  if (!(diasPorSemana > 0)) return Object.assign(base, { motivo: "rutina_sin_dias" });
  var asignada = diaDeCreatedAt(rutina.created_at);
  var desde = o.desde;
  if (asignada != null && (desde == null || asignada > desde)) desde = asignada;
  if (desde == null || o.hasta == null || desde > o.hasta) return Object.assign(base, { desdeEfectivo: desde, motivo: "periodo_vacio" });
  var semanas = Math.ceil((o.hasta - desde + 1) / 7);
  var planificadas = diasPorSemana * semanas;

  var rid = String(rutina.id);
  var rnombre = String(rutina.nombre || rutina.name || "");
  var aid = o.alumnoId != null && o.alumnoId !== "" ? String(o.alumnoId) : null;
  var asignadaMs = tsMs(rutina.created_at);
  var porClave = {};
  (Array.isArray(o.sesiones) ? o.sesiones : []).forEach(function (s) {
    if (!s || !isCompletedSession(s)) return;
    if (aid && String(s.alumno_id) !== aid) return;
    if (!sessionMatchesRoutine(s, rid, rnombre)) return;
    if ((s.rutina_id == null || s.rutina_id === "") && Number.isFinite(asignadaMs) && s.created_at) {
      var creadaMs = tsMs(s.created_at);
      if (Number.isFinite(creadaMs) && creadaMs < asignadaMs) return; // legado de una rutina anterior con el mismo nombre
    }
    var dia = diaDeSesion(s);
    if (!enRango(dia, desde, o.hasta)) return;
    var di = s.dia_idx == null || s.dia_idx === "" ? "?" : String(s.dia_idx);
    var clave = dia + "|" + di;
    var validada = s.origen === ORIGEN_VALIDADA;
    // realizada gana a validada en la misma clave
    porClave[clave] = porClave[clave] === "realizada" || !validada ? "realizada" : "validada";
  });
  // dia_idx nulo + otra fila con dia_idx el mismo dia: es el mismo entrenamiento, no suma (pero si era realizada, el dia lo es)
  var diasConIdx = {};
  Object.keys(porClave).forEach(function (k) { var parts = k.split("|"); if (parts[1] !== "?") (diasConIdx[parts[0]] = diasConIdx[parts[0]] || []).push(k); });
  Object.keys(porClave).forEach(function (k) {
    var parts = k.split("|");
    if (parts[1] !== "?" || !diasConIdx[parts[0]]) return;
    var otras = diasConIdx[parts[0]];
    if (porClave[k] === "realizada" && !otras.some(function (o) { return porClave[o] === "realizada"; })) porClave[otras[0]] = "realizada";
    delete porClave[k];
  });
  var claves = Object.keys(porClave);
  // tope por semana de calendario (lunes a domingo); las realizadas tienen prioridad sobre las validadas
  var porSemana = {};
  claves.forEach(function (k) {
    var lun = lunesDe(Number(k.split("|")[0]));
    (porSemana[lun] = porSemana[lun] || []).push(k);
  });
  var realizadas = 0, validadas = 0;
  Object.keys(porSemana).forEach(function (w) {
    var ks = porSemana[w];
    var r = ks.filter(function (k) { return porClave[k] === "realizada"; }).length;
    var take = Math.min(ks.length, diasPorSemana);
    var takeR = Math.min(r, take);
    realizadas += takeR;
    validadas += take - takeR;
  });
  // el total nunca supera lo planificado (se recortan primero las validadas)
  var exceso = Math.max(0, realizadas + validadas - planificadas);
  var recorteV = Math.min(exceso, validadas);
  validadas -= recorteV;
  realizadas -= exceso - recorteV;
  var completadas = realizadas + validadas;
  return Object.assign(base, {
    planificadas: planificadas,
    completadas: completadas,
    realizadas: realizadas,
    validadas: validadas,
    pct: Math.min(100, Math.round((100 * completadas) / planificadas)),
    desdeEfectivo: desde,
    semanas: semanas,
  });
}
