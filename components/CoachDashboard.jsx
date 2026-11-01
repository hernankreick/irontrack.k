import React from "react";
import CoachNotificationCenter from "./CoachNotificationCenter.jsx";
import ProgresoView from "./ProgresoView.jsx";
import { ALUMNOS_STATUS, alumnosEmptyKind, alumnosRefreshFailed } from "../lib/coachAlumnosLoad.js";
import CoachDashboardD5 from "./coach/CoachDashboardD5.jsx";
import { coachDashboardModelo } from "./coach/coachDashboardModelo.js";
import { irontrackMsg as M, localeForSort } from "../lib/irontrackMsg.js";
import { coachThemePalette } from "./coachThemePalette.js";
import { getStudentRoutine, getStudentWeeklyProgress } from "../lib/studentWeeklyProgress.js";
import { isCoachValidatedSession } from "../lib/orphanSessions.js";
import { claveBajaActividad, claveFaltaUna, claveInactivo, claveRutinaTerminada, claveSinRutina, ultimoDiaActividad } from "./coach/alertasEpisodio.js";
import { adherencia, diaLocal, lunesDe } from "../lib/metricas/index.js";

/** Padding/gap base compartidos con `navItemStyle` (tablas, listas). */
export const NAV_ITEM_PAD = "10px 12px";

/** Estilo unificado para filas tipo nav (icono + texto) dentro del dashboard */
export function navItemStyle(isActive, palette) {
  var P = palette || coachThemePalette(true);
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: NAV_ITEM_PAD,
    borderRadius: 8,
    cursor: "pointer",
    backgroundColor: isActive ? P.blueDim : "transparent",
    color: isActive ? P.blue : P.t2,
    fontFamily: "DM Sans, system-ui, sans-serif",
    fontSize: 14,
    fontWeight: isActive ? 600 : 400,
  };
}

function parseDateMs(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "string" && raw.indexOf("/") >= 0) {
    var p = raw.split("/");
    if (p.length >= 3) {
      var d = new Date(parseInt(p[2], 10), parseInt(p[1], 10) - 1, parseInt(p[0], 10));
      return isNaN(d.getTime()) ? null : d.getTime();
    }
  }
  var d2 = new Date(typeof raw === "string" ? raw.slice(0, 19) : raw);
  return isNaN(d2.getTime()) ? null : d2.getTime();
}

function coachDisplayName(a) {
  var n = (a && (a.nombre || "")).trim();
  if (n) return n;
  return (a && a.email) || "";
}

function coachInitials(a) {
  var base = coachDisplayName(a) || "?";
  return base
    .split(/\s+/)
    .map(function (p) {
      return p.charAt(0);
    })
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Espejo de coachAlumnoCategoria en App.jsx (fallback si no se pasa getAlumnoCategoria). */
function defaultCoachAlumnoCategoria(a, rutinasSBEntrenador, sesionesGlobales, progresoGlobal) {
  if (!rutinasSBEntrenador.some(function (r) { return String(r.alumno_id) === String(a.id); })) return "sin_rutina";
  var cutoff = Date.now() - 21 * 24 * 60 * 60 * 1000;
  var ses = sesionesGlobales || [];
  for (var i = 0; i < ses.length; i++) {
    if (String(ses[i].alumno_id) !== String(a.id)) continue;
    var raw = ses[i].created_at || "";
    if (!raw) continue;
    var d = new Date(raw.slice(0, 10));
    if (!isNaN(d.getTime()) && d.getTime() >= cutoff) return "activo";
  }
  var plist = progresoGlobal[a.id];
  if (plist && plist.length) {
    for (var j = 0; j < plist.length; j++) {
      var fecha = plist[j].fecha || "";
      if (!fecha) continue;
      var d2;
      if (fecha.indexOf("/") >= 0) {
        var p = fecha.split("/");
        d2 = new Date(parseInt(p[2], 10), parseInt(p[1], 10) - 1, parseInt(p[0], 10));
      } else {
        d2 = new Date(fecha.slice(0, 10));
      }
      if (!isNaN(d2.getTime()) && d2.getTime() >= cutoff) return "activo";
    }
  }
  return "inactivo";
}

function getLastActivityMs(a, sesionesGlobales, progresoGlobal) {
  var best = null;
  (sesionesGlobales || []).forEach(function (s) {
    if (String(s.alumno_id) !== String(a.id)) return;
    var t = parseDateMs(s.created_at || s.fecha);
    if (t != null && (best == null || t > best)) best = t;
  });
  (progresoGlobal[String(a.id)] || progresoGlobal[a.id] || []).forEach(function (r) {
    var t = parseDateMs(r.fecha);
    if (t != null && (best == null || t > best)) best = t;
  });
  return best;
}

/** Umbral de "Baja actividad": el mismo 30 % que ya usaba el Dashboard (no es un umbral nuevo). */
var BAJA_ACTIVIDAD_PCT = 30;

/**
 * Semanas de calendario (lunes-domingo, numeros de dia de lib/metricas/fechas.js) que usa el Dashboard:
 *   actual         lunes de esta semana .. hoy                    (adherencia de la semana en curso)
 *   previaMismo    lunes anterior .. mismo dia de la semana pasada (comparacion "vs semana pasada": mismo tramo)
 *   previaCompleta lunes .. domingo de la semana pasada           (seguimiento: semana terminada, sin el sesgo de una semana recien empezada)
 */
export function semanasDashboard(hoy) {
  var lunes = lunesDe(hoy);
  return {
    hoy: hoy,
    diaSemana: hoy - lunes + 1,
    actual: { desde: lunes, hasta: hoy },
    previaMismo: { desde: lunes - 7, hasta: hoy - 7 },
    previaCompleta: { desde: lunes - 7, hasta: lunes - 1 },
  };
}

/**
 * Adherencia semanal de UN alumno con la definicion de Progreso (lib/metricas/adherencia.js, sin cambios) y su estado:
 *   planState: "cargando" | "sin_rutina" | "sin_datos_rutina" | "sin_dias" | "rutina_nueva" | "ok"
 *   seguimiento (solo con plan): "baja" | "rutina_nueva" | "al_dia"
 *     baja         = con actividad en los ultimos 21 dias (categoria "activo"), adherencia < 30 % en la semana pasada COMPLETA
 *                    (rutina asignada antes de ese lunes) y < 30 % en lo que va de esta semana. Un 0 % al empezar la semana no basta.
 *     rutina_nueva = la semana pasada no se puede medir completa (rutina asignada despues de su lunes): todavia no se juzga.
 */
export function adherenciaSemanalAlumno(a, cat, rutina, sesiones, semanas, cargando) {
  if (cargando) return { pct: null, planState: "cargando", seguimiento: null };
  if (cat === "sin_rutina") return { pct: null, planState: "sin_rutina", seguimiento: null };
  if (!rutina) return { pct: null, planState: "sin_datos_rutina", seguimiento: null };
  function adh(rango) {
    return adherencia({ rutina: rutina, sesiones: sesiones, alumnoId: a.id, desde: rango.desde, hasta: rango.hasta });
  }
  var actual = adh(semanas.actual);
  if (actual.motivo === "rutina_sin_dias") return { pct: null, planState: "sin_dias", seguimiento: null, actual: actual };
  if (actual.pct == null) return { pct: null, planState: "rutina_nueva", seguimiento: "rutina_nueva", actual: actual };
  var previaMismo = adh(semanas.previaMismo);
  var previaCompleta = adh(semanas.previaCompleta);
  var previaMedible = previaCompleta.pct != null && previaCompleta.desdeEfectivo === semanas.previaCompleta.desde;
  var seguimiento = !previaMedible
    ? "rutina_nueva"
    : cat === "activo" && previaCompleta.pct < BAJA_ACTIVIDAD_PCT && actual.pct < BAJA_ACTIVIDAD_PCT
      ? "baja"
      : "al_dia";
  return { pct: actual.pct, planState: "ok", seguimiento: seguimiento, actual: actual, previaMismo: previaMismo, previaCompleta: previaCompleta };
}

/**
 * Ids de los alumnos con seguimiento "baja" (regla de D3, adherenciaSemanalAlumno). Lo usa App.jsx para el filtro «Baja actividad» de
 * Alumnos, asi el filtro y el contador del Dashboard salen de la MISMA funcion y de las mismas entradas (rutinas, categoria, sesiones).
 * @returns {Object<string, true>}
 */
export function bajaActividadIds(p) {
  var o = p || {};
  var semanas = semanasDashboard(o.hoy != null ? o.hoy : diaLocal());
  var out = {};
  (o.alumnos || []).forEach(function (a) {
    if (!a || a.id == null) return;
    var cat = typeof o.catFn === "function" ? o.catFn(a) : null;
    if (cat === "sin_rutina" || cat === "inactivo") return;
    var r = adherenciaSemanalAlumno(a, cat, getStudentRoutine(o.rutinas, a), o.sesiones, semanas, !!o.cargando);
    if (r.seguimiento === "baja") out[String(a.id)] = true;
  });
  return out;
}

/** Tope tecnico de la busqueda hacia atras de inicioBajaActividad (no es un umbral clinico: corta el bucle en ~2 anos). */
var MAX_SEMANAS_EPISODIO_BAJA = 104;

/**
 * D6.2: lunes (numero de dia) en que EMPEZO el episodio actual de «Baja actividad» (regla de D3), para su identidad en la campana.
 * Es la primera semana del tramo de semanas COMPLETAS consecutivas con adherencia < 30 % (misma funcion adherencia y mismo umbral que
 * adherenciaSemanalAlumno) que termina en la semana pasada. Solo cuenta semanas medibles enteras (rutina asignada antes de su lunes).
 * No cambia mientras dura el episodio (cada semana nueva con < 30 % alarga el tramo por el final, no por el principio) y cambia tras
 * recuperarse: una semana completa con >= 30 % corta el tramo y una recaida posterior empieza otro. null si la semana pasada no cumple.
 */
export function inicioBajaActividad(a, rutina, sesiones, hoy) {
  if (!a || a.id == null || !rutina) return null;
  var lunesPrevia = lunesDe(hoy != null ? hoy : diaLocal()) - 7;
  var inicio = null;
  for (var k = 0; k < MAX_SEMANAS_EPISODIO_BAJA; k++) {
    var desde = lunesPrevia - 7 * k;
    var r = adherencia({ rutina: rutina, sesiones: sesiones, alumnoId: a.id, desde: desde, hasta: desde + 6 });
    if (r.pct == null || r.desdeEfectivo !== desde || !(r.pct < BAJA_ACTIVIDAD_PCT)) break;
    inicio = desde;
  }
  return inicio;
}

/**
 * Resumen del equipo con la regla de Progreso (coachProgresoMetrics.js, «Adherencia promedio»): promedio de los % de los alumnos
 * con plan; la variacion compara SOLO alumnos con plan en ambos periodos y no se informa con el historial de sesiones incompleto.
 */
export function resumenAdherenciaEquipo(filas, historiaCompleta) {
  var conPlan = (filas || []).filter(function (r) { return r.planState === "ok"; });
  var sum = 0, pairCur = 0, pairPrev = 0, pairN = 0, completadas = 0, planificadas = 0, validadas = 0;
  conPlan.forEach(function (r) {
    sum += r.pct;
    completadas += r.adh.actual.completadas;
    planificadas += r.adh.actual.planificadas;
    validadas += r.adh.actual.validadas;
    if (r.adh.previaMismo && r.adh.previaMismo.pct != null) {
      pairCur += r.pct;
      pairPrev += r.adh.previaMismo.pct;
      pairN++;
    }
  });
  var sesionesIncompletas = !!(historiaCompleta && historiaCompleta.sesiones === false);
  var delta = pairN > 0 && !sesionesIncompletas ? Math.round(pairCur / pairN) - Math.round(pairPrev / pairN) : null;
  return {
    alumnosConPlan: conPlan.length,
    pct: conPlan.length > 0 ? Math.round(sum / conPlan.length) : null,
    completadas: completadas,
    planificadas: planificadas,
    validadas: validadas,
    delta: delta,
    motivoSinDelta: delta != null ? null : sesionesIncompletas ? "historial_incompleto" : "sin_periodo_comparable",
  };
}

/**
 * Alertas derivadas solo de datos reales (sin inventar alumnos).
 * Prioridad (severity): mensajes y sin rutina (0) > inactivo, rutina terminada y entrenamientos (1) > a 1 sesión y baja actividad (2).
 * El orden visible lo decide la campana (alertasPrioridad.js: no leidas y de seguimiento primero).
 */
function buildChatMessageAlerts(alumnos, mensajesPendientes, lang, P) {
  if (!Array.isArray(alumnos) || alumnos.length === 0 || !Array.isArray(mensajesPendientes)) return [];
  var byAlumno = {};
  mensajesPendientes.forEach(function (m) {
    if (!m || m.de_entrenador === true) return;
    var alumnoId = m.alumno_id != null ? String(m.alumno_id) : "";
    if (!alumnoId || m.leido === true) return;
    var t = new Date(m.created_at || 0).getTime() || 0;
    var prev = byAlumno[alumnoId];
    if (!prev || t > prev.atMs) byAlumno[alumnoId] = { msg: m, atMs: t };
  });

  var pal = P || coachThemePalette(true);
  return alumnos
    .map(function (a) {
      var alumnoId = a && a.id != null ? String(a.id) : "";
      var pending = byAlumno[alumnoId];
      if (!pending) return null;
      var name = coachDisplayName(a) || (pending.msg && pending.msg.nombre) || M(lang, "Alumno", "Athlete", "Aluno");
      var msgId = pending.msg && pending.msg.id != null ? String(pending.msg.id) : String(pending.atMs || Date.now());
      return {
        key: "chat-" + alumnoId + "-" + msgId,
        alumnoId: alumnoId,
        chatId: msgId,
        tipo: "chat_message",
        initials: coachInitials(a),
        name: name,
        badge: M(lang, "Nuevo mensaje", "New message", "Nova mensagem"),
        bc: pal.blue,
        bd: pal.blueDim,
        desc: name + M(lang, " te envió un mensaje.", " sent you a message.", " enviou uma mensagem para você."),
        severity: 0,
        category: "mensaje",
        primaryLabel: M(lang, "ABRIR CHAT", "OPEN CHAT", "ABRIR CHAT"),
        primaryAction: "chat",
        atMs: pending.atMs || null,
      };
    })
    .filter(Boolean);
}

function parseSessionAlertMs(session) {
  if (!session) return 0;
  var created = new Date(session.created_at || session.updated_at || 0).getTime();
  if (created) return created;
  var rawFecha = String(session.fecha || "").trim();
  if (!rawFecha) return 0;
  var parts = rawFecha.split(/[\/-]/);
  if (parts.length === 3) {
    var dd = parseInt(parts[0], 10);
    var mm = parseInt(parts[1], 10);
    var yyyy = parseInt(parts[2], 10);
    if (yyyy < 100) yyyy += 2000;
    var rawHora = String(session.hora || "00:00").trim();
    var hp = rawHora.split(":");
    var hh = parseInt(hp[0], 10) || 0;
    var min = parseInt(hp[1], 10) || 0;
    var local = new Date(yyyy, Math.max(0, mm - 1), dd, hh, min).getTime();
    if (local) return local;
  }
  return new Date(rawFecha).getTime() || 0;
}

function buildWorkoutCompletedAlerts(alumnos, sesionesGlobales, lang, P) {
  if (!Array.isArray(alumnos) || alumnos.length === 0 || !Array.isArray(sesionesGlobales)) return [];
  var pal = P || coachThemePalette(true);
  var byAlumno = {};
  alumnos.forEach(function (a) {
    if (a && a.id != null) byAlumno[String(a.id)] = a;
  });
  var seen = {};
  return sesionesGlobales
    .map(function (s) {
      if (!s || s.alumno_id == null) return null;
      // Sesion que registro el propio entrenador con "Validar": no es un aviso (no la acaba de completar el alumno).
      if (isCoachValidatedSession(s)) return null;
      var alumnoId = String(s.alumno_id);
      var alumno = byAlumno[alumnoId];
      if (!alumno) return null;
      var dayIndex = s.dia_idx != null ? s.dia_idx : null;
      var rutinaId = s.rutina_id != null ? String(s.rutina_id) : "";
      var fecha = s.fecha || "";
      var dedupeKey = [
        alumnoId,
        rutinaId || s.rutina_nombre || "",
        dayIndex != null ? String(dayIndex) : "",
        s.semana != null ? String(s.semana) : "",
        fecha,
      ].join("|");
      if (seen[dedupeKey]) return null;
      seen[dedupeKey] = true;
      var atMs = parseSessionAlertMs(s);
      var sessionId = s.id != null ? String(s.id) : dedupeKey;
      var name = coachDisplayName(alumno) || M(lang, "Alumno", "Athlete", "Aluno");
      return {
        key: "workout-completed-" + sessionId,
        tipo: "workout_completed",
        alumnoId: alumnoId,
        rutinaId: rutinaId || null,
        dayIndex: dayIndex,
        fecha: fecha,
        initials: coachInitials(alumno),
        name: name,
        badge: M(lang, "Entrenamiento completo", "Workout completed", "Treino concluído"),
        bc: pal.green,
        bd: pal.greenDim,
        desc: name + M(lang, " completó el entrenamiento.", " completed the workout.", " concluiu o treino."),
        severity: 1,
        category: "logro",
        primaryLabel: M(lang, "VER PERFIL", "VIEW PROFILE", "VER PERFIL"),
        primaryAction: "review",
        atMs: atMs || null,
      };
    })
    .filter(Boolean)
    .sort(function (a, b) {
      return (b.atMs || 0) - (a.atMs || 0);
    })
    .slice(0, 8);
}

function buildCoachAlerts(alumnos, catFn, sesionesGlobales, progresoGlobal, rutinasSBEntrenador, lang, P, currentWeek, mensajesPendientes, cargando) {
  if (!Array.isArray(alumnos) || alumnos.length === 0) return [];
  var ses = sesionesGlobales || [];
  var out = buildChatMessageAlerts(alumnos, mensajesPendientes, lang, P);
  // Historial todavia cargando: sin sesiones no se puede saber quien esta inactivo (se veria a todos "sin actividad").
  if (cargando) return out;
  out = out.concat(buildWorkoutCompletedAlerts(alumnos, ses, lang, P));
  var pal = P || coachThemePalette(true);
  var hoy = diaLocal();
  // Misma funcion y mismas entradas que el Dashboard (coachDashboardModelo) y el filtro de Alumnos (App.jsx).
  var bajaIds = bajaActividadIds({ alumnos: alumnos, catFn: catFn, rutinas: rutinasSBEntrenador, sesiones: ses, hoy: hoy });
  alumnos.forEach(function (a) {
    var cat = catFn(a);
    var name = coachDisplayName(a);
    if (!name) return;
    var initials = coachInitials(a);
    if (cat === "sin_rutina") {
      out.push({
        // D6.1: sin cambios (sin historial de bajas de rutina no se pueden distinguir episodios; ver alertasEpisodio.js)
        key: claveSinRutina(a.id),
        alumnoId: a.id,
        initials: initials,
        name: name,
        badge: M(lang, "Sin rutina", "No routine", "Sem rotina"),
        bc: pal.yel,
        bd: pal.yelDim,
        desc: M(lang, "No tiene rutina asignada en el sistema.", "No routine assigned.", "Sem rotina atribuída no sistema."),
        severity: 0,
      });
      return;
    }
    var rutina = getStudentRoutine(rutinasSBEntrenador, a);
    // D6.2: las alertas de seguimiento (sin rutina / inactivo / baja actividad) salen SIEMPRE con las categorias del Dashboard; las de
    // avance de rutina (terminada / a 1 sesion) ya no las tapan (antes hacian "return" y un inactivo o un alumno con baja actividad podia
    // figurar en la campana solo como «Le queda 1 sesión»). Con un alumno inactivo no se emiten: hablan de una semana que no esta en curso;
    // con baja actividad se mantiene «Rutina terminada» (logro) y no «Le queda 1 sesión».
    if (rutina && cat !== "inactivo") {
      var weekly = getStudentWeeklyProgress({
        alumno: a,
        rutina: rutina,
        sesiones: ses,
        progreso: progresoGlobal,
        currentWeek: currentWeek,
      });
      var totalDays = weekly.totalDays || 0;
      var completedDaysFromSessions = weekly.completedDaysFromSessions || 0;
      var hasRealRoutineSessions = (weekly.realSessionsCount || 0) > 0;
      var rutinaId = String(rutina.id || weekly.rutinaId || "");
      if (rutinaId && totalDays > 0 && hasRealRoutineSessions && completedDaysFromSessions >= totalDays && weekly.weekIndex === 3) {
        out.push({
          // D6.1: un episodio por rutina y ciclo (la deteccion de semana 4 no cambia: D6.3)
          key: claveRutinaTerminada(a.id, rutinaId, rutina),
          alumnoId: a.id,
          rutinaId: rutinaId,
          initials: initials,
          name: name,
          badge: M(lang, "Rutina terminada", "Routine completed", "Rotina concluída"),
          bc: pal.green,
          bd: pal.greenDim,
          desc: name + M(lang, " terminó su rutina.", " completed their routine.", " concluiu sua rotina."),
          severity: 1,
          category: "logro",
          primaryLabel: M(lang, "FELICITAR", "CONGRATULATE", "PARABENIZAR"),
          primaryAction: "chat",
          secondaryLabel: M(lang, "ASIGNAR NUEVA RUTINA", "ASSIGN NEW ROUTINE", "ATRIBUIR NOVA ROTINA"),
          secondaryAction: "review",
        });
      } else if (rutinaId && totalDays > 1 && hasRealRoutineSessions && completedDaysFromSessions > 0 && completedDaysFromSessions === totalDays - 1 && !bajaIds[String(a.id)]) {
        // «Le queda 1 sesión» solo para quien esta al dia: con baja actividad el aviso es ese (el conteo por semana de rutina no mira
        // el calendario y contradiria al Dashboard). El calculo de sesiones completadas no cambia.
        out.push({
          key: claveFaltaUna(a.id, rutinaId, rutina, weekly.weekIndex),
          alumnoId: a.id,
          rutinaId: rutinaId,
          initials: initials,
          name: name,
          badge: M(lang, "Le queda 1 sesión", "1 session left", "Falta 1 sessão"),
          bc: pal.blue,
          bd: pal.blueDim,
          desc: M(
            lang,
            "A " + name + " le queda 1 sesión para completar la semana.",
            name + " has 1 session left to complete the week.",
            "Falta 1 sessão para " + name + " concluir a semana."
          ),
          severity: 2,
          category: "seguimiento",
          primaryLabel: M(lang, "REVISAR", "REVIEW", "REVISAR"),
          primaryAction: "review",
          secondaryLabel: M(lang, "ASIGNAR NUEVA RUTINA", "ASSIGN NEW ROUTINE", "ATRIBUIR NOVA ROTINA"),
          secondaryAction: "review",
        });
      }
    }
    if (cat === "inactivo") {
      out.push({
        // D6.1: un episodio por ultimo dia de actividad (vuelve a avisar si el alumno se recupera y recae)
        key: claveInactivo(a.id, ultimoDiaActividad(a.id, ses, progresoGlobal)),
        alumnoId: a.id,
        initials: initials,
        name: name,
        badge: M(lang, "Sin actividad reciente", "Inactive", "Inativo recentemente"),
        bc: pal.red,
        bd: pal.redDim,
        desc: M(
          lang,
          "Sin sesiones ni registros en las últimas 3 semanas.",
          "No sessions or logs in the last 3 weeks.",
          "Sem sessões nem registros nas últimas 3 semanas."
        ),
        severity: 1,
      });
      return;
    }
    // D6.2: «Baja actividad» con la regla COMPARTIDA de D3/D4 (bajaActividadIds, la misma del Dashboard y del filtro de Alumnos).
    // Antes la campana usaba otra condicion («sin nada en 7 dias corridos») y podia avisar de alumnos «Al día» en el Dashboard.
    if (bajaIds[String(a.id)]) {
      out.push({
        // (solo las sesiones del alumno: equivalente, adherencia ya filtra por alumno, y evita recorrer todo el historial en cada semana)
        key: claveBajaActividad(a.id, inicioBajaActividad(a, rutina, ses.filter(function (s) { return s && String(s.alumno_id) === String(a.id); }), hoy)),
        alumnoId: a.id,
        initials: initials,
        name: name,
        badge: M(lang, "Baja actividad", "Low activity", "Baixa atividade"),
        bc: pal.yel,
        bd: pal.yelDim,
        desc: M(
          lang,
          "Completó menos del 30 % de su plan la semana pasada y en lo que va de esta.",
          "Completed under 30% of their plan last week and so far this week.",
          "Concluiu menos de 30% do plano na semana passada e até agora nesta."
        ),
        severity: 2,
      });
    }
  });
  out.sort(function (x, y) {
    if (x.severity !== y.severity) return x.severity - y.severity;
    if (x.atMs != null || y.atMs != null) return (y.atMs || 0) - (x.atMs || 0);
    return String(x.name).localeCompare(String(y.name), localeForSort(lang));
  });
  // D6.2: sin recorte. Antes se cortaba en 12 ANTES de la campana y, con varios entrenamientos completados (severidad 1), se perdian
  // alertas de seguimiento y el contador no las veia. El conjunto ya es acotado (una alerta de seguimiento por alumno, un mensaje por
  // alumno y los 8 entrenamientos mas recientes); la campana ordena y muestra las primeras 12 con «Ver más» (alertasPrioridad.js).
  return out;
}

/**
 * Contenido del dashboard del coach (sin sidebar ni app shell).
 * El layout global y DesktopSidebar los provee App.jsx.
 *
 * Handlers opcionales — si no se pasan, los botones no hacen nada (útil en tests).
 */
export default function CoachDashboard({
  activeNav = "dashboard",
  alumnos = [],
  alumnosStatus,
  sesionesGlobales = [],
  mensajesEntrenadorPendientes = [],
  progresoGlobal = {},
  historiaCompleta = null,
  rutinasSBEntrenador = [],
  allEx = [],
  lang = "es",
  onEnviarMensaje,
  onCrearRutina,
  onRevisarAlumnos,
  /** D4: Alumnos con el filtro correspondiente (sin filtros heredados). Si no se pasan, se usa onRevisarAlumnos. */
  onVerInactivos,
  onVerSinRutina,
  onVerBajaActividad,
  /** D4: abre la ficha del alumno y el flujo existente de asignacion de rutina (solo alumnos sin rutina). */
  onAsignarRutina,
  onRevisar,
  onVerPerfil,
  onNuevoAlumno,
  onNuevaRutina,
  onNuevoEjercicio,
  globalSearchData = { alumnos: [], rutinas: [], ejercicios: [], sesiones: [] },
  onGlobalSearchNavigate,
  /** Navegar a la pestaña Progreso (notificaciones tipo logro / resumen). */
  onIrProgreso,
  /** Abrir modal de chat con un alumno por id (notificaciones tipo mensaje). */
  onAbrirChatAlumno,
  /** (a) => "sin_rutina" | "activo" | "inactivo" — preferentemente coachAlumnoCategoria desde App.jsx */
  getAlumnoCategoria,
  /** Alineado con `darkMode` de App (config Tema día/noche). */
  darkMode = true,
  currentWeek = 0,
  /** Nombre del entrenador (session) para saludo e iniciales en la shell. */
  coachName = "",
  supabase = null,
  entrenadorId = null,
}) {
  var C = React.useMemo(
    function () {
      return coachThemePalette(darkMode);
    },
    [darkMode]
  );

  /** Alumnos o historial todavia sin cargar: no se calculan estados ni cumplimiento (sin datos se veria a todos "inactivos"). */
  var alumnosCargando = alumnosEmptyKind(alumnosStatus || ALUMNOS_STATUS.READY, alumnos.length) === "loading";
  var historialCargando =
    alumnos.length > 0 && historiaCompleta == null && !(sesionesGlobales || []).length && !Object.keys(progresoGlobal || {}).length;
  var cargando = alumnosCargando || historialCargando;

  var catFn = React.useMemo(
    function () {
      if (typeof getAlumnoCategoria === "function") return getAlumnoCategoria;
      return function (a) {
        return defaultCoachAlumnoCategoria(a, rutinasSBEntrenador, sesionesGlobales, progresoGlobal);
      };
    },
    [getAlumnoCategoria, rutinasSBEntrenador, sesionesGlobales, progresoGlobal]
  );

  var coachAlertsReal = React.useMemo(
    function () {
      return buildCoachAlerts(alumnos, catFn, sesionesGlobales, progresoGlobal, rutinasSBEntrenador, lang, C, currentWeek, mensajesEntrenadorPendientes, cargando);
    },
    [alumnos, catFn, sesionesGlobales, progresoGlobal, rutinasSBEntrenador, lang, C, currentWeek, mensajesEntrenadorPendientes, cargando]
  );

  // Dashboard D5: el modelo sale de las funciones reales de D3/D4 (adherenciaSemanalAlumno, bajaActividadIds, resumenAdherenciaEquipo).
  var modeloD5 = React.useMemo(
    function () {
      return coachDashboardModelo({
        alumnos: alumnos,
        rutinas: rutinasSBEntrenador,
        sesiones: sesionesGlobales,
        progresoGlobal: progresoGlobal,
        historiaCompleta: historiaCompleta,
        alumnosStatus: alumnosStatus,
        catFn: catFn,
      });
    },
    [alumnos, rutinasSBEntrenador, sesionesGlobales, progresoGlobal, historiaCompleta, alumnosStatus, catFn]
  );

  var _mobile = React.useState(false);
  var isMobile = _mobile[0];
  var setIsMobile = _mobile[1];
  React.useEffect(function () {
    if (typeof window === "undefined" || !window.matchMedia) return;
    var mq = window.matchMedia("(max-width: 768px)");
    function update() {
      setIsMobile(mq.matches);
    }
    update();
    if (mq.addEventListener) mq.addEventListener("change", update);
    else mq.addListener(update);
    return function () {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else mq.removeListener(update);
    };
  }, []);

  if (activeNav === "progreso") {
    return (
      <ProgresoView
        alumnos={alumnos}
        sesionesGlobales={sesionesGlobales}
        progresoGlobal={progresoGlobal}
        historiaCompleta={historiaCompleta}
        rutinasSBEntrenador={rutinasSBEntrenador}
        allEx={allEx}
        darkMode={darkMode}
      />
    );
  }

  return (
    <CoachDashboardD5
      modelo={modeloD5}
      darkMode={darkMode}
      coachName={coachName}
      campana={
        <CoachNotificationCenter
          lang={lang}
          alertRows={coachAlertsReal}
          onRevisarAlumno={onRevisar}
          onVerPerfilAlumno={onVerPerfil}
          onIrAlumnos={onRevisarAlumnos}
          onIrProgreso={onIrProgreso}
          onAbrirChatAlumno={onAbrirChatAlumno}
          useFixedMobilePanel={isMobile}
          darkMode={darkMode}
          supabase={supabase}
          entrenadorId={entrenadorId}
        />
      }
      globalSearchData={globalSearchData}
      onGlobalSearchNavigate={onGlobalSearchNavigate}
      alumnosRefreshFailed={alumnosRefreshFailed(alumnosStatus, alumnos.length)}
      onVerSinRutina={onVerSinRutina}
      onVerInactivos={onVerInactivos}
      onVerBajaActividad={onVerBajaActividad}
      onVerPerfil={onVerPerfil}
      onRevisarAlumnos={onRevisarAlumnos}
      onNuevoAlumno={onNuevoAlumno}
      onNuevaRutina={onNuevaRutina}
      onIrProgreso={onIrProgreso}
    />
  );
}
