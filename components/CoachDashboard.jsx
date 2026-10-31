import React from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Target,
} from "lucide-react";
import GlobalCreateMenu from "./GlobalCreateMenu.jsx";
import GlobalSearch from "./GlobalSearch.jsx";
import CoachNotificationCenter from "./CoachNotificationCenter.jsx";
import ProgresoView from "./ProgresoView.jsx";
import { ALUMNOS_STATUS, alumnosEmptyKind, alumnosRefreshFailed } from "../lib/coachAlumnosLoad.js";
import CoachActiveStudentsCard from "./coach/CoachActiveStudentsCard.jsx";
import CoachDashboardAttentionCard from "./coach/CoachDashboardAttentionCard.jsx";
import CoachDashboardSummaryGrid from "./coach/CoachDashboardSummaryGrid.jsx";
import CoachDashboardStyles from "./coach/CoachDashboardStyles.jsx";
import CoachQuickActions from "./coach/CoachQuickActions.jsx";
import { buildQuickActions } from "./coach/coachDashboardQuickActionsConfig.js";
import { coachType as T, coachSpace as S, coachFirstNameFromFullName } from "./coachUiScale.js";
import { irontrackMsg as M, localeForSort } from "../lib/irontrackMsg.js";
import { coachThemePalette } from "./coachThemePalette.js";
import { getStudentRoutine, getStudentWeeklyProgress } from "../lib/studentWeeklyProgress.js";
import { isCoachValidatedSession } from "../lib/orphanSessions.js";
import { adherencia, diaLocal, lunesDe, rachaSemanal } from "../lib/metricas/index.js";

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

/** Barras de semana: letras según locale (LMXJVSD / MTWTFSS / STQQSSD). */
function weekBarsForLang(lang) {
  var letters =
    lang === "en"
      ? ["M", "T", "W", "T", "F", "S", "S"]
      : lang === "pt"
        ? ["S", "T", "Q", "Q", "S", "S", "D"]
        : ["L", "M", "X", "J", "V", "S", "D"];
  var p = [100, 100, 75, 100, 50, 0, 0];
  return letters.map(function (d, i) {
    return { d: d, p: p[i] };
  });
}

function pctColor(p) {
  if (p >= 70) return "#22c55e";
  if (p >= 30) return "#eab308";
  return "#ef4444";
}

/** Color del % en lista mobile: menor a 30 rojo, 30–79 ámbar, 80+ verde */
function pctBracketColor(p) {
  if (p < 30) return "#EF4444";
  if (p < 80) return "#F59E0B";
  return "#22C55E";
}

function estadoTextColor(row, lang, muted) {
  if (row.planState === "cargando") return muted || "#71717a";
  if (row.cat === "sin_rutina") return "#EF4444";
  if (row.cat === "inactivo") return "#F59E0B";
  return sesionColor(row.ult, lang, muted);
}

function rowStatusConfig(row, lang, C) {
  var neutralBg = "rgba(148,163,184,0.16)";
  if (row.planState === "cargando") {
    return {
      label: M(lang, "Cargando…", "Loading…", "Carregando…"),
      color: C.t2,
      bg: neutralBg,
      action: M(lang, "Ver perfil", "View profile", "Ver perfil"),
      primary: false,
    };
  }
  if (row.cat === "sin_rutina") {
    return {
      label: M(lang, "Sin rutina", "No routine", "Sem rotina"),
      color: C.red,
      bg: C.redDim,
      action: M(lang, "Asignar rutina", "Assign routine", "Atribuir rotina"),
      primary: true,
    };
  }
  if (row.cat === "inactivo") {
    return {
      label: M(lang, "Sin actividad", "No activity", "Sem atividade"),
      color: C.red,
      bg: C.redDim,
      action: M(lang, "Ver perfil", "View profile", "Ver perfil"),
      primary: false,
    };
  }
  if (row.pct == null || row.seguimiento === "rutina_nueva") {
    // sin dias validos, rutina no disponible o rutina nueva (semana pasada no medible): no hay con que clasificar
    return {
      label: row.seguimiento === "rutina_nueva"
        ? M(lang, "Rutina nueva", "New routine", "Rotina nova")
        : row.planState === "sin_datos_rutina" ? M(lang, "Sin datos", "No data", "Sem dados") : M(lang, "Sin plan", "No plan", "Sem plano"),
      color: C.t2,
      bg: neutralBg,
      action: M(lang, "Ver perfil", "View profile", "Ver perfil"),
      primary: false,
    };
  }
  if (row.seguimiento === "baja") {
    return {
      label: M(lang, "Baja actividad", "Low activity", "Baixa atividade"),
      color: C.yel,
      bg: C.yelDim,
      action: M(lang, "Ver perfil", "View profile", "Ver perfil"),
      primary: false,
    };
  }
  return {
    label: M(lang, "Al día", "On track", "Em dia"),
    color: C.green,
    bg: C.greenDim,
    action: M(lang, "Ver perfil", "View profile", "Ver perfil"),
    primary: false,
  };
}

function sesionColor(s, lang, muted) {
  var m = muted || "#71717a";
  if (s == null || s === "") return m;
  var today = M(lang, "Hoy", "Today", "Hoje");
  var noAct = M(lang, "Sin actividad", "No activity", "Sem atividade");
  var noRut = M(lang, "Sin rutina", "No routine", "Sem rotina");
  if (s === today) return "#22c55e";
  if (s === noAct || s === noRut) return "#ef4444";
  return m;
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

function countSesionesSince(a, sesionesGlobales, sinceMs) {
  return (sesionesGlobales || []).filter(function (s) {
    if (String(s.alumno_id) !== String(a.id)) return false;
    var t = parseDateMs(s.created_at || s.fecha);
    return t != null && t >= sinceMs;
  }).length;
}

function countProgresoSince(a, progresoGlobal, sinceMs) {
  return (progresoGlobal[String(a.id)] || progresoGlobal[a.id] || []).filter(function (r) {
    var t = parseDateMs(r.fecha);
    return t != null && t >= sinceMs;
  }).length;
}

function formatUltimaSesion(lastMs, lang, sinRutina) {
  if (sinRutina) return M(lang, "Sin rutina", "No routine", "Sem rotina");
  if (lastMs == null) return M(lang, "Sin actividad", "No activity", "Sem atividade");
  var days = Math.floor((Date.now() - lastMs) / 86400000);
  if (days <= 0) return M(lang, "Hoy", "Today", "Hoje");
  if (days === 1) return M(lang, "Ayer", "Yesterday", "Ontem");
  if (days < 14) return M(lang, "Hace " + days + " días", days + "d ago", "Há " + days + " dias");
  if (days < 45) return M(lang, "Hace " + Math.floor(days / 7) + " sem.", Math.floor(days / 7) + "w ago", "Há " + Math.floor(days / 7) + " sem.");
  return M(lang, "Sin actividad", "No activity", "Sem atividade");
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
 * Prioridad: sin rutina > rutina terminada > a 1 sesión > inactivo > poca actividad en la semana (con rutina).
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
  var now = Date.now();
  var pal = P || coachThemePalette(true);
  alumnos.forEach(function (a) {
    var cat = catFn(a);
    var name = coachDisplayName(a);
    if (!name) return;
    var initials = coachInitials(a);
    if (cat === "sin_rutina") {
      out.push({
        key: "sr-" + a.id,
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
    if (rutina) {
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
          key: "rutina-terminada-" + a.id + "-" + rutinaId + "-w" + weekly.weekIndex,
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
        return;
      }
      if (rutinaId && totalDays > 1 && hasRealRoutineSessions && completedDaysFromSessions > 0 && completedDaysFromSessions === totalDays - 1) {
        out.push({
          key: "rutina-falta-1-" + a.id + "-" + rutinaId + "-w" + weekly.weekIndex,
          alumnoId: a.id,
          rutinaId: rutinaId,
          initials: initials,
          name: name,
          badge: M(lang, "Le queda 1 sesión", "1 session left", "Falta 1 sessão"),
          bc: pal.blue,
          bd: pal.blueDim,
          desc: M(
            lang,
            "A " + name + " le queda 1 sesión para completar su rutina.",
            name + " has 1 session left to complete their routine.",
            "Falta 1 sessão para " + name + " concluir a rotina."
          ),
          severity: 2,
          category: "seguimiento",
          primaryLabel: M(lang, "REVISAR", "REVIEW", "REVISAR"),
          primaryAction: "review",
          secondaryLabel: M(lang, "ASIGNAR NUEVA RUTINA", "ASSIGN NEW ROUTINE", "ATRIBUIR NOVA ROTINA"),
          secondaryAction: "review",
        });
        return;
      }
    }
    if (cat === "inactivo") {
      out.push({
        key: "in-" + a.id,
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
    var since7 = now - 7 * 86400000;
    var n7 = countSesionesSince(a, ses, since7);
    var p7 = countProgresoSince(a, progresoGlobal, since7);
    if (cat === "activo" && n7 === 0 && p7 === 0) {
      out.push({
        key: "wk-" + a.id,
        alumnoId: a.id,
        initials: initials,
        name: name,
        badge: M(lang, "Poca actividad", "Low activity", "Pouca atividade"),
        bc: pal.yel,
        bd: pal.yelDim,
        desc: M(
          lang,
          "Sin sesiones ni registros en la última semana.",
          "No sessions or logs in the last week.",
          "Sem sessões nem registros na última semana."
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
  return out.slice(0, 12);
}

function buildCoachActiveRows(alumnos, catFn, sesionesGlobales, progresoGlobal, rutinasSBEntrenador, lang, cargando, semanas) {
  if (!Array.isArray(alumnos) || alumnos.length === 0) return [];
  return alumnos
    .map(function (a) {
      var cat = catFn(a);
      var rutina = getStudentRoutine(rutinasSBEntrenador, a);
      // Adherencia de la semana de CALENDARIO (no el avance de la semana de la rutina: ese solo se usa en las alertas de rutina).
      var comp = adherenciaSemanalAlumno(a, cat, rutina, sesionesGlobales, semanas, cargando);
      var lastMs = getLastActivityMs(a, sesionesGlobales, progresoGlobal);
      var ult = cargando ? "—" : formatUltimaSesion(lastMs, lang, cat === "sin_rutina");
      return {
        id: a.id,
        initials: coachInitials(a),
        name: coachDisplayName(a) || M(lang, "Alumno", "Athlete", "Aluno"),
        pct: comp.pct,
        planState: comp.planState,
        seguimiento: comp.seguimiento,
        adh: comp,
        ult: ult,
        cat: cat,
      };
    })
    .filter(function (row) {
      return !!row.name;
    })
    .sort(function (a, b) {
      function pr(row) {
        if (row.planState === "cargando") return 6;
        if (row.cat === "sin_rutina") return 0;
        if (row.cat === "inactivo") return 1;
        if (row.seguimiento === "baja") return 2;
        if (row.pct == null) return 3;
        if (row.seguimiento === "rutina_nueva") return 4;
        return 5;
      }
      var pa = pr(a);
      var pb = pr(b);
      if (pa !== pb) return pa - pb;
      if (a.pct != null && b.pct != null && a.pct !== b.pct) return a.pct - b.pct;
      return String(a.name).localeCompare(String(b.name), localeForSort(lang));
    });
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

  var coachActiveRows = React.useMemo(
    function () {
      return buildCoachActiveRows(alumnos, catFn, sesionesGlobales, progresoGlobal, rutinasSBEntrenador, lang, cargando, semanasDashboard(diaLocal()));
    },
    [alumnos, catFn, sesionesGlobales, progresoGlobal, rutinasSBEntrenador, lang, cargando]
  );

  var weekBars = React.useMemo(
    function () {
      return weekBarsForLang(lang);
    },
    [lang]
  );

  var quickActions = React.useMemo(
    function () {
      return buildQuickActions(lang, darkMode);
    },
    [lang, darkMode]
  );

  var greetingLine = React.useMemo(
    function () {
      var h = new Date().getHours();
      if (h < 12) return M(lang, "Buenos días", "Good morning", "Bom dia");
      if (h < 18) return M(lang, "Buenas tardes", "Good afternoon", "Boa tarde");
      return M(lang, "Buenas noches", "Good evening", "Boa noite");
    },
    [lang]
  );

  var coachSaludoNombre = React.useMemo(
    function () {
      var first = coachFirstNameFromFullName(coachName);
      if (first) return ", " + first;
      return M(lang, ", Entrenador", ", Coach", ", Treinador");
    },
    [lang, coachName]
  );

  /**
   * Resumen semanal = ADHERENCIA de la semana de calendario en curso (lunes .. hoy), con la definicion y la regla de equipo de Progreso.
   * Solo alumnos con plan verificable (rutina con dias validos). weeklyState: "cargando" | "sin_alumnos" | "sin_plan" | "ok"
   */
  var hoyDia = diaLocal();
  var semanas = semanasDashboard(hoyDia);
  var equipo = resumenAdherenciaEquipo(coachActiveRows, historiaCompleta);
  var sesionesCompletadas = equipo.completadas;
  var sesionesTotales = equipo.planificadas;
  var weeklyState = cargando ? "cargando" : (alumnos || []).length === 0 ? "sin_alumnos" : equipo.alumnosConPlan > 0 && sesionesTotales > 0 ? "ok" : "sin_plan";
  var hayPlan = weeklyState === "ok";
  var pctSemana = hayPlan ? equipo.pct : null;
  var deltaSemana = hayPlan ? equipo.delta : null;
  /**
   * Objetivo del 80 % sobre la MISMA metrica que se muestra (adherencia promedio). No se informa "faltan N sesiones": con un promedio de
   * porcentajes no existe un numero unico (cada sesion mueve el promedio distinto segun el alumno), y calcularlo con los totales
   * contradecia el diagnostico. Se informa lo verificable: el promedio frente al 80 % y cuantos alumnos con plan ya lo alcanzan.
   */
  var objetivoSemanalPct = 80;
  var objetivoAlcanzado = hayPlan && pctSemana >= objetivoSemanalPct;
  var alumnosEnObjetivo = hayPlan ? coachActiveRows.filter(function (r) { return r.planState === "ok" && r.pct >= objetivoSemanalPct; }).length : null;
  var semanaEnCurso = semanas.diaSemana < 7;
  function fechaCorta(dia) {
    var d = new Date(dia * 86400000);
    return d.getUTCDate() + "/" + (d.getUTCMonth() + 1);
  }
  var diasCortos = lang === "en" ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : lang === "pt" ? ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"] : ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
  /** Periodo de referencia visible: "lun 26/10 – hoy". */
  var periodoSemanaTexto = diasCortos[0] + " " + fechaCorta(semanas.actual.desde) + " – " + M(lang, "hoy", "today", "hoje");
  var deltaSemanaTexto = !hayPlan
    ? null
    : deltaSemana == null
      ? M(lang, "Sin comparación", "No comparison", "Sem comparação")
      : (deltaSemana >= 0 ? "+" : "") + deltaSemana + "% " + M(lang, "vs semana pasada (", "vs last week (", "vs semana passada (") + diasCortos[0] + "–" + diasCortos[semanas.diaSemana - 1] + ")";
  var filasConDatos = cargando ? [] : coachActiveRows;
  var sinRutinaCount = cargando ? null : filasConDatos.filter(function (r) { return r.cat === "sin_rutina"; }).length;
  var inactivosCount = cargando ? null : filasConDatos.filter(function (r) { return r.cat === "inactivo"; }).length;
  var bajaActividadCount = cargando ? null : filasConDatos.filter(function (r) { return r.cat !== "sin_rutina" && r.cat !== "inactivo" && r.seguimiento === "baja"; }).length;
  /** Alumnos con al menos una sesión completada en la semana de calendario actual (lib/metricas/racha.js; incluye validadas). */
  var alumnosActivosSemana = cargando ? null : (alumnos || []).filter(function (a) {
    return rachaSemanal(sesionesGlobales, { hoy: hoyDia, alumnoId: a.id }).incluyeSemanaActual;
  }).length;
  var activosSemanaText = alumnosActivosSemana == null || (alumnos || []).length === 0 ? "—" : alumnosActivosSemana + " / " + alumnos.length;
  var sinPlanTexto = M(lang, "Sin plan semanal", "No weekly plan", "Sem plano semanal");
  var cargandoTexto = M(lang, "Cargando…", "Loading…", "Carregando…");
  var dashboardInterpretacion = weeklyState === "cargando"
    ? M(lang, "Cargando los datos de tu equipo", "Loading your team's data", "Carregando os dados da sua equipe")
    : weeklyState === "sin_alumnos"
      ? M(lang, "Todavía no tenés alumnos", "No athletes yet", "Ainda não há alunos")
      : weeklyState === "sin_plan"
        ? M(lang, "Ningún alumno tiene una rutina con días: no hay objetivo semanal", "No athlete has a routine with days: no weekly target", "Nenhum aluno tem rotina com dias: sem objetivo semanal")
        : pctSemana >= objetivoSemanalPct
          ? M(lang, "Semana en objetivo", "Week on target", "Semana no objetivo")
          : semanaEnCurso
            // semana sin terminar: el plan es el de la semana completa, asi que todavia no se juzga (sin umbral nuevo)
            ? M(lang, "Semana en curso · día " + semanas.diaSemana + " de 7", "Week in progress · day " + semanas.diaSemana + " of 7", "Semana em curso · dia " + semanas.diaSemana + " de 7")
            : pctSemana >= 55
            ? M(lang, "Vas bien, pero podés mejorar", "You're doing well, but can improve", "Você vai bem, mas pode melhorar")
            : M(lang, "Necesita atención esta semana", "Needs attention this week", "Precisa de atenção esta semana");
  var semanaSubtitulo = weeklyState === "ok"
    ? M(lang, "sesiones completadas · ", "sessions completed · ", "sessões concluídas · ") + periodoSemanaTexto
    : weeklyState === "cargando"
      ? cargandoTexto
      : weeklyState === "sin_alumnos"
        ? M(lang, "Sin alumnos", "No athletes", "Sem alunos")
        : sinPlanTexto;

  var _mobile = React.useState(false);
  var isMobile = _mobile[0];
  var setIsMobile = _mobile[1];
  var _phone = React.useState(false);
  var isPhone = _phone[0];
  var setIsPhone = _phone[1];
  React.useEffect(function () {
    if (typeof window === "undefined" || !window.matchMedia) return;
    var mq = window.matchMedia("(max-width: 768px)");
    var mqPhone = window.matchMedia("(max-width: 767px)");
    function update() {
      setIsMobile(mq.matches);
      setIsPhone(mqPhone.matches);
    }
    update();
    if (mq.addEventListener) { mq.addEventListener("change", update); mqPhone.addEventListener("change", update); }
    else { mq.addListener(update); mqPhone.addListener(update); }
    return function () {
      if (mq.removeEventListener) { mq.removeEventListener("change", update); mqPhone.removeEventListener("change", update); }
      else { mq.removeListener(update); mqPhone.removeListener(update); }
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

  function runQuick(action) {
    if (action === "message" && typeof onEnviarMensaje === "function") onEnviarMensaje();
    else if (action === "routine" && typeof onCrearRutina === "function") onCrearRutina();
    else if (action === "review" && typeof onRevisarAlumnos === "function") onRevisarAlumnos();
  }

  var diagnosticoPrincipal = dashboardInterpretacion;
  var impactoEstimado = !hayPlan
    ? (weeklyState === "cargando" ? cargandoTexto : weeklyState === "sin_alumnos" ? M(lang, "Sin alumnos", "No athletes", "Sem alunos") : sinPlanTexto)
    : objetivoAlcanzado
      ? M(lang, "Objetivo semanal alcanzado: adherencia promedio " + pctSemana + "%", "Weekly target reached: average adherence " + pctSemana + "%", "Objetivo semanal alcançado: aderência média " + pctSemana + "%")
      : M(lang, "Adherencia promedio " + pctSemana + "% · objetivo 80%", "Average adherence " + pctSemana + "% · target 80%", "Aderência média " + pctSemana + "% · objetivo 80%");
  var alumnosEnObjetivoTexto = hayPlan
    ? M(
        lang,
        alumnosEnObjetivo + " de " + equipo.alumnosConPlan + " alumnos con plan en el 80% o más",
        alumnosEnObjetivo + " of " + equipo.alumnosConPlan + " athletes with a plan at 80% or more",
        alumnosEnObjetivo + " de " + equipo.alumnosConPlan + " alunos com plano em 80% ou mais"
      )
    : null;
  var accionRecomendada = cargando
    ? cargandoTexto
    : sinRutinaCount > 0
      ? M(lang, "Asignar rutinas pendientes", "Assign pending routines", "Atribuir rotinas pendentes")
      : inactivosCount > 0
        ? M(lang, "Enviar mensaje a alumnos inactivos", "Message inactive athletes", "Enviar mensagem a alunos inativos")
        : bajaActividadCount > 0
          ? M(lang, "Revisar alumnos con baja actividad", "Review low-activity athletes", "Revisar alunos com baixa atividade")
          : M(lang, "Revisar progreso del equipo", "Review team progress", "Revisar progresso da equipe");
  // D4: cada destino abre Alumnos con SU filtro (sin filtros heredados); sin el handler especifico, la lista completa.
  var irSinRutina = typeof onVerSinRutina === "function" ? onVerSinRutina : onRevisarAlumnos;
  var irInactivos = typeof onVerInactivos === "function" ? onVerInactivos : onRevisarAlumnos;
  var irBaja = typeof onVerBajaActividad === "function" ? onVerBajaActividad : onRevisarAlumnos;
  var verSinRutinaTxt = M(lang, "Ver alumnos sin rutina", "View athletes without routine", "Ver alunos sem rotina");
  var verInactivosTxt = M(lang, "Ver alumnos inactivos", "View inactive athletes", "Ver alunos inativos");
  var verBajaTxt = M(lang, "Ver alumnos con baja actividad", "View low-activity athletes", "Ver alunos com baixa atividade");
  // El boton describe a donde lleva el handler (Alumnos con filtro), no el titulo de la recomendacion.
  var accionCtaLabel = cargando
    ? M(lang, "Ver alumnos", "View athletes", "Ver alunos")
    : sinRutinaCount > 0
      ? verSinRutinaTxt
      : inactivosCount > 0
        ? verInactivosTxt
        : bajaActividadCount > 0
          ? verBajaTxt
          : M(lang, "Ver alumnos", "View athletes", "Ver alunos");
  var accionPrincipalHandler = cargando
    ? onRevisarAlumnos
    : sinRutinaCount > 0
      ? irSinRutina
      : inactivosCount > 0
        ? irInactivos
        : bajaActividadCount > 0
          ? irBaja
          : onRevisarAlumnos;
  var dashBg = darkMode ? "#0A0F1A" : C.bg;
  var dashCard = darkMode ? "#0D1424" : C.card;
  var dashCardSoft = darkMode ? "#101A2D" : C.cardDark;
  var dashBorder = darkMode ? "rgba(148,163,184,0.16)" : C.brd;
  var dashMuted = darkMode ? "#94A3B8" : C.t2;
  var attentionItems = [
    {
      key: "sin-rutina",
      Icon: Target,
      count: sinRutinaCount,
      color: C.red,
      cta: verSinRutinaTxt,
      onClick: irSinRutina,
      title: M(lang, "alumnos sin rutina", "athletes without routine", "alunos sem rotina"),
      sub: M(lang, "Asignales una rutina para que comiencen", "Assign routines so they can start", "Atribua rotinas para começarem"),
    },
    {
      key: "inactivos",
      Icon: Clock3,
      count: inactivosCount,
      color: C.yel,
      cta: verInactivosTxt,
      onClick: irInactivos,
      title: M(lang, "alumnos inactivos", "inactive athletes", "alunos inativos"),
      sub: M(lang, "Hace más de 21 días sin actividad", "No activity in over 21 days", "Mais de 21 dias sem atividade"),
    },
    {
      key: "baja",
      Icon: AlertCircle,
      count: bajaActividadCount,
      color: C.yel,
      cta: verBajaTxt,
      onClick: irBaja,
      title: M(lang, "alumnos con baja actividad", "athletes with low activity", "alunos com baixa atividade"),
      sub: M(lang, "Menos del 30% de adherencia la semana pasada y en esta", "Under 30% adherence last week and this week", "Menos de 30% de aderência na semana passada e nesta"),
    },
  ];
  var activeStudentsMobileRows = coachActiveRows.map(function (row, idx) {
    var br = row.pct == null ? null : pctBracketColor(row.pct);
    var status = rowStatusConfig(row, lang, C);
    return {
      id: row.id,
      initials: row.initials,
      name: row.name,
      ult: row.ult,
      pct: row.pct,
      pctText: row.pct == null ? "—" : row.pct + "%",
      percentColor: br || dashMuted,
      avatarBg: br ? br + "33" : "rgba(148,163,184,0.2)",
      estadoColor: estadoTextColor(row, lang, dashMuted),
      statusLabel: status.label,
      statusBg: status.bg,
      statusColor: status.color,
      borderBottom: idx < coachActiveRows.length - 1 ? "1px solid " + C.rowDivider : "none",
      rowCursor: typeof onVerPerfil === "function" ? "pointer" : "default",
      role: typeof onVerPerfil === "function" ? "button" : undefined,
      onClick: function () {
        if (typeof onVerPerfil === "function") onVerPerfil(row.id);
      },
    };
  });
  var activeStudentsDesktopRows = coachActiveRows.map(function (row, idx) {
    var col = row.pct == null ? null : pctColor(row.pct);
    var status = rowStatusConfig(row, lang, C);
    return {
      id: row.id,
      initials: row.initials,
      name: row.name,
      ult: row.ult,
      pct: row.pct,
      pctText: row.pct == null ? "—" : row.pct + "%",
      percentColor: col || dashMuted,
      avatarBg: col ? col + "22" : "rgba(148,163,184,0.16)",
      sessionColor: sesionColor(row.ult, lang, dashMuted),
      statusLabel: status.label,
      statusBg: status.bg,
      statusColor: status.color,
      borderBottom: idx < coachActiveRows.length - 1 ? "1px solid " + dashBorder : "none",
      rowCursor: typeof onVerPerfil === "function" ? "pointer" : "default",
      role: typeof onVerPerfil === "function" ? "button" : undefined,
      onClick: function () {
        if (typeof onVerPerfil === "function") onVerPerfil(row.id);
      },
      // D4: «Asignar rutina» solo para alumnos SIN rutina (con rutina, el cambio se hace desde la ficha: «Cambiar rutina»).
      actions: [].concat(row.cat === "sin_rutina" && typeof onAsignarRutina === "function" ? [
        {
          key: "assign",
          label: M(lang, "Asignar rutina", "Assign routine", "Atribuir rotina"),
          primary: true,
          enabled: true,
          onClick: function (ev) {
            ev.stopPropagation();
            onAsignarRutina(row.id);
          },
        },
      ] : [], [
        {
          key: "profile",
          label: M(lang, "Perfil", "Profile", "Perfil"),
          primary: false,
          enabled: typeof onVerPerfil === "function",
          onClick: function (ev) {
            ev.stopPropagation();
            if (typeof onVerPerfil === "function") onVerPerfil(row.id);
          },
        },
        {
          key: "message",
          label: M(lang, "Mensaje", "Message", "Mensagem"),
          primary: false,
          enabled: typeof onAbrirChatAlumno === "function",
          onClick: function (ev) {
            ev.stopPropagation();
            if (typeof onAbrirChatAlumno === "function") onAbrirChatAlumno(row.id);
          },
        },
      ]),
    };
  });
  var activeStudentsHeaders = [
    M(lang, "ALUMNO", "ATHLETE", "ALUNO"),
    M(lang, "ADHERENCIA (SEMANA)", "ADHERENCE (WEEK)", "ADERÊNCIA (SEMANA)"),
    M(lang, "ÚLTIMA SESIÓN", "LAST SESSION", "ÚLTIMA SESSÃO"),
    M(lang, "ESTADO", "STATUS", "ESTADO"),
    M(lang, "ACCIÓN", "ACTION", "AÇÃO"),
  ];

  return (
    <>
      <CoachDashboardStyles darkMode={darkMode} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          width: "100%",
          boxSizing: "border-box",
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        <header
          style={{
            padding: isPhone ? "16px 16px" : S.headerPadding,
            borderBottom: `1px solid ${C.brd}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: S.gridGapTight,
          }}
        >
          <div>
            <h2 style={{ ...T.screenTitle, color: C.t, margin: 0 }}>
              {greetingLine}
              {coachSaludoNombre}
            </h2>
            <p style={{ ...T.screenSubtitle, color: dashMuted, margin: "6px 0 0 0" }}>
              {M(lang, "Acá tenés el resumen de tu equipo", "Here's your team's summary", "Aqui está o resumo da sua equipe")}
            </p>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              minWidth: 0,
              ...(isMobile ? { flex: "1 1 100%", maxWidth: "100%" } : { flexShrink: 0 }),
            }}
          >
            <div
              className="coach-search-wrap"
              style={{
                flex: 1,
                minWidth: 0,
                width: "100%",
                ...(isMobile ? {} : { maxWidth: 440 }),
              }}
            >
              <GlobalSearch
                alumnos={globalSearchData.alumnos}
                rutinas={globalSearchData.rutinas}
                ejercicios={globalSearchData.ejercicios}
                sesiones={globalSearchData.sesiones}
                onNavigate={onGlobalSearchNavigate}
                placeholder={isMobile ? M(lang, "Buscar…", "Search…", "Buscar…") : M(lang, "Buscar alumno, rutina, ejercicio...", "Search athlete, routine, exercise...", "Buscar aluno, rotina, exercício...")}
                compactInputEnd
                darkMode={darkMode}
              />
            </div>
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
            <GlobalCreateMenu
              lang={lang}
              onNuevoAlumno={onNuevoAlumno}
              onNuevaRutina={onNuevaRutina}
              onNuevoEjercicio={onNuevoEjercicio}
              alwaysShowDropdown={true}
              showChevron={false}
              plusSize={15}
              label={M(lang, "CREAR", "CREATE", "CRIAR")}
              triggerStyle={{
                background: C.blue,
                color: "#fff",
                borderRadius: 7,
                height: 36,
                padding: "0 14px",
                fontSize: 15,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 6,
                textTransform: "uppercase",
                letterSpacing: 0.4,
                border: "none",
                cursor: "pointer",
                fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
                outline: "none",
                boxSizing: "border-box",
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            />
          </div>
        </header>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: isMobile ? 16 : 22,
            padding: isPhone ? 16 : S.pagePadding,
            background: dashBg,
          }}
        >
          <CoachDashboardAttentionCard
            title={M(lang, "ATENCIÓN HOY", "TODAY'S ATTENTION", "ATENÇÃO HOJE")}
            items={attentionItems}
            isMobile={isMobile}
            dashCard={dashCard}
            dashBorder={dashBorder}
            dashCardSoft={dashCardSoft}
            dashMuted={dashMuted}
            colors={{ ...C, darkMode: darkMode }}
            type={T}
            okLabel={M(lang, "Al día", "All clear", "Em dia")}
            loadingLabel={cargandoTexto}
          />
          <CoachDashboardSummaryGrid
            isMobile={isMobile}
            mobileGap={16}
            desktopGap={S.gridGap}
            recommendationProps={{
              eyebrow: M(lang, "RECOMENDACIÓN PRINCIPAL", "MAIN RECOMMENDATION", "RECOMENDAÇÃO PRINCIPAL"),
              title: accionRecomendada,
              description: diagnosticoPrincipal,
              impactLabel: M(lang, "IMPACTO ESTIMADO", "ESTIMATED IMPACT", "IMPACTO ESTIMADO"),
              impactText: impactoEstimado,
              ctaLabel: accionCtaLabel,
              onAction: accionPrincipalHandler,
              colors: C,
              type: T,
              dashCard: dashCard,
              dashBorder: dashBorder,
              dashMuted: dashMuted,
            }}
            mobileWeekKpiProps={{
              label: M(lang, "Esta semana", "This week", "Esta semana"),
              value: hayPlan ? sesionesCompletadas + "/" + sesionesTotales : "—",
              subtitle: semanaSubtitulo,
              progress: pctSemana,
              accent: "#2563EB",
              colors: C,
              type: T,
              blockGap: S.blockGap,
            }}
            mobilePerformanceKpiProps={{
              label: M(lang, "Activos esta semana", "Active this week", "Ativos esta semana"),
              value: activosSemanaText,
              subtitle: M(lang, "alumnos con al menos una sesión", "athletes with at least one session", "alunos com pelo menos uma sessão"),
              progress: alumnosActivosSemana != null && alumnos.length > 0 ? Math.round((alumnosActivosSemana / alumnos.length) * 100) : null,
              accent: "#22C55E",
              colors: C,
              type: T,
              blockGap: S.blockGap,
            }}
            desktopWeeklyProps={{
              title: M(lang, "Adherencia semanal", "Weekly adherence", "Aderência semanal"),
              completedText: hayPlan ? sesionesCompletadas + " / " + sesionesTotales : "—",
              pctText: hayPlan ? pctSemana + "%" : "—",
              subtitle: semanaSubtitulo,
              deltaText: deltaSemanaTexto,
              deltaBg: deltaSemana == null ? "rgba(148,163,184,0.14)" : deltaSemana >= 0 ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
              deltaColor: deltaSemana == null ? C.t2 : deltaSemana >= 0 ? C.green : C.red,
              progressPct: pctSemana || 0,
              trackBg: darkMode ? "rgba(148,163,184,0.14)" : C.brd,
              insightTitle: M(lang, "Insight del día", "Today's insight", "Insight do dia"),
              insightText: diagnosticoPrincipal,
              insightColor: !hayPlan ? C.t2 : objetivoAlcanzado ? C.green : C.yel,
              goalText: !hayPlan ? impactoEstimado : alumnosEnObjetivoTexto,
              primaryLabel: M(lang, "Acción recomendada", "Recommended action", "Ação recomendada"),
              secondaryLabel: M(lang, "Ver equipo", "View team", "Ver equipe"),
              onPrimary: accionPrincipalHandler,
              onSecondary: onRevisarAlumnos,
              gaugeOffset: 188.5 * (1 - (pctSemana || 0) / 100),
              colors: C,
              type: T,
              dashCard: dashCard,
              dashBorder: dashBorder,
              dashCardSoft: dashCardSoft,
              dashMuted: dashMuted,
              blockGap: S.blockGap,
            }}
            desktopPerformanceProps={{
              title: M(lang, "Resumen de la semana", "Week summary", "Resumo da semana"),
              metrics: [
                { label: M(lang, "Sesiones planificadas", "Planned sessions", "Sessões planejadas"), value: hayPlan ? sesionesTotales : weeklyState === "cargando" ? "—" : M(lang, "Sin plan", "No plan", "Sem plano") },
                { label: M(lang, "Sesiones completadas", "Completed sessions", "Sessões concluídas"), value: hayPlan ? sesionesCompletadas : "—" },
                { label: M(lang, "Alumnos activos esta semana", "Active athletes this week", "Alunos ativos esta semana"), value: activosSemanaText },
              ],
              colors: C,
              type: T,
              dashCard: dashCard,
              dashBorder: dashBorder,
              blockGap: S.blockGap,
            }}
          />

          <div
            style={{
              display: "none",
              background: C.card,
              border: `1px solid ${C.brd}`,
              borderRadius: 12,
              padding: S.cardPadding,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: S.blockGap,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <AlertCircle size={17} color={C.yel} strokeWidth={2} />
                <span style={{ ...T.cardTitleSemibold, color: C.t }}>
                  {M(lang, "Alertas inteligentes", "Smart alerts", "Alertas inteligentes")}
                </span>
              </div>
              <button
                type="button"
                style={{
                  background: "none",
                  border: "none",
                  color: C.blue,
                  ...T.link,
                  cursor: "pointer",
                  padding: 0,
                }}
                onClick={function () {
                  if (typeof onRevisarAlumnos === "function") onRevisarAlumnos();
                }}
              >
                {M(lang, "Ver todas →", "See all →", "Ver todas →")}
              </button>
            </div>
            {coachAlertsReal.length === 0 ? (
              <div
                style={{
                  padding: "22px 12px",
                  textAlign: "center",
                  borderRadius: 9,
                  background: C.cardDark,
                  border: `1px dashed ${C.brd}`,
                  ...T.body,
                  color: C.t2,
                }}
              >
                {M(
                  lang,
                  "No hay alertas por ahora. Cuando un alumno necesite atención (sin rutina, inactividad o poca actividad semanal), aparecerá acá.",
                  "No alerts right now. When an athlete needs attention, it will show here.",
                  "Sem alertas por enquanto. Quando um aluno precisar de atenção, aparecerá aqui."
                )}
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: 11,
                }}
              >
                {coachAlertsReal.map(function (a) {
                  var alumId = a.alumnoId;
                  var primaryLabel = a.primaryLabel || M(lang, "REVISAR", "REVIEW", "REVISAR");
                  var secondaryLabel = a.secondaryLabel || M(lang, "VER PERFIL", "VIEW PROFILE", "VER PERFIL");
                  function runAlertAction(kind) {
                    if (!alumId) return;
                    if (kind === "chat" && typeof onAbrirChatAlumno === "function") {
                      onAbrirChatAlumno(alumId);
                      return;
                    }
                    if (kind === "profile" && typeof onVerPerfil === "function") {
                      onVerPerfil(alumId);
                      return;
                    }
                    if (typeof onRevisar === "function") onRevisar(alumId);
                  }
                  return (
                    <div
                      key={a.key}
                      style={{
                        background: C.cardDark,
                        border: `1px solid ${C.brd}`,
                        borderRadius: 9,
                        padding: 13,
                      }}
                    >
                      <div style={{ display: "flex", gap: 9, marginBottom: 6, alignItems: "flex-start" }}>
                        <div
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: "50%",
                            background: a.bd,
                            color: a.bc,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 13,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {a.initials}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ ...T.bodyLg, color: C.t }}>{a.name}</div>
                          <div
                            style={{
                              display: "inline-block",
                              marginTop: 6,
                              background: a.bd,
                              color: a.bc,
                              fontSize: 13,
                              padding: "3px 9px",
                              borderRadius: 99,
                            }}
                          >
                            {a.badge}
                          </div>
                        </div>
                      </div>
                      <p style={{ ...T.body, color: C.t2, margin: "6px 0 0 0" }}>{a.desc}</p>
                      <div style={{ display: "flex", gap: 7, marginTop: 9 }}>
                        <button
                          type="button"
                          style={{
                            background: a.bc,
                            color: a.bc === C.yel ? (darkMode ? "#0a0a0f" : "#0f172a") : "#fff",
                            borderRadius: 5,
                            padding: "6px 11px",
                            fontSize: 13,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            border: "none",
                            cursor: alumId ? "pointer" : "not-allowed",
                            opacity: alumId ? 1 : 0.45,
                          }}
                          disabled={!alumId}
                          onClick={function () {
                            runAlertAction(a.primaryAction || "review");
                          }}
                        >
                          {primaryLabel}
                        </button>
                        <button
                          type="button"
                          style={{
                            background: "transparent",
                            border: `1px solid ${C.brd}`,
                            color: C.t2,
                            borderRadius: 5,
                            padding: "6px 11px",
                            fontSize: 13,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            cursor: alumId ? "pointer" : "not-allowed",
                            opacity: alumId ? 1 : 0.45,
                          }}
                          disabled={!alumId}
                          onClick={function () {
                            runAlertAction(a.secondaryAction || "profile");
                          }}
                        >
                          {secondaryLabel}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <CoachQuickActions
            title={M(lang, "ACCIONES RÁPIDAS", "QUICK ACTIONS", "AÇÕES RÁPIDAS")}
            actions={quickActions}
            onRunQuick={runQuick}
            ctaLabel={M(lang, "Abrir", "Open", "Abrir")}
            colors={C}
            type={T}
            dashMuted={dashMuted}
            dashCard={dashCard}
            dashBorder={dashBorder}
            dashCardSoft={dashCardSoft}
            blockGap={S.blockGap}
            isMobile={isMobile}
          />

          {alumnosRefreshFailed(alumnosStatus, alumnos.length) && (
            <div role="status" style={{ fontSize: 12, color: dashMuted, padding: "0 4px" }}>
              {M(lang, "No pudimos actualizar tus alumnos. Reintentamos automáticamente; mostramos los últimos datos.", "We couldn't refresh your athletes. Retrying automatically; showing the latest data.", "Não foi possível atualizar seus alunos. Tentando de novo; mostrando os últimos dados.")}
            </div>
          )}
          <CoachActiveStudentsCard
            title={M(lang, "Mis alumnos", "My athletes", "Meus alunos")}
            seeAllLabel={M(lang, "Ver todos →", "See all →", "Ver todos →")}
            onSeeAll={onRevisarAlumnos}
            emptyText={
              alumnosEmptyKind(alumnosStatus || ALUMNOS_STATUS.READY, alumnos.length) === "loading"
                ? M(lang, "Cargando alumnos…", "Loading athletes…", "Carregando alunos…")
                : alumnosEmptyKind(alumnosStatus || ALUMNOS_STATUS.READY, alumnos.length) === "error"
                  ? M(lang, "No pudimos cargar tus alumnos. Reintentá desde Alumnos.", "We couldn't load your athletes. Retry from Athletes.", "Não foi possível carregar seus alunos. Tente em Alunos.")
                  : M(
                    lang,
                    "Todavía no tenés alumnos cargados. Agregá alumnos desde Alumnos o con «Crear».",
                    "No athletes yet. Add them from Athletes or «Create».",
                    "Ainda não há alunos. Adicione em Alunos ou em «Criar»."
                  )
            }
            isMobile={isMobile}
            mobileRows={activeStudentsMobileRows}
            desktopRows={activeStudentsDesktopRows}
            desktopHeaders={activeStudentsHeaders}
            colors={C}
            type={T}
            dashCard={dashCard}
            dashBorder={dashBorder}
            blockGap={S.blockGap}
            navItemPad={NAV_ITEM_PAD}
          />
        </div>
      </div>

    </>
  );
}
