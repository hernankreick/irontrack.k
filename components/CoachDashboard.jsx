import React from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  FilePlus,
  MessageSquare,
  Target,
} from "lucide-react";
import GlobalCreateMenu from "./GlobalCreateMenu.jsx";
import GlobalSearch from "./GlobalSearch.jsx";
import CoachNotificationCenter from "./CoachNotificationCenter.jsx";
import ProgresoView from "./ProgresoView.jsx";
import CoachActiveStudentsCard from "./coach/CoachActiveStudentsCard.jsx";
import CoachDashboardAttentionCard from "./coach/CoachDashboardAttentionCard.jsx";
import CoachDashboardSummaryGrid from "./coach/CoachDashboardSummaryGrid.jsx";
import CoachQuickActions from "./coach/CoachQuickActions.jsx";
import { coachType as T, coachSpace as S, coachFirstNameFromFullName } from "./coachUiScale.js";
import { irontrackMsg as M, localeForSort } from "../lib/irontrackMsg.js";
import { coachThemePalette } from "./coachThemePalette.js";
import { getStudentRoutine, getStudentWeeklyProgress } from "../lib/studentWeeklyProgress.js";

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

/** Metadatos visuales compartidos por acción rápida (gradientes, sombras). */
const QUICK_VISUAL_DARK = {
  message: {
    gradient: "linear-gradient(152deg, #2563eb 0%, #3730a3 42%, #0f172a 88%)",
    border: "rgba(255,255,255,0.1)",
    shadow: "0 6px 28px rgba(15,23,42,0.55), 0 2px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.12)",
    shadowHover:
      "0 18px 48px rgba(37,99,235,0.35), 0 10px 28px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18)",
    orbBg: "linear-gradient(165deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.06) 100%)",
    orbBorder: "rgba(255,255,255,0.28)",
    orbShadow: "0 4px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.35)",
    Icon: MessageSquare,
    iconColor: "#ffffff",
    titleColor: "#ffffff",
    subColor: "rgba(255,255,255,0.72)",
    ctaColor: "rgba(255,255,255,0.58)",
    ctaBorder: "rgba(255,255,255,0.1)",
  },
  routine: {
    gradient: "linear-gradient(152deg, #7c3aed 0%, #5b21b6 40%, #0c0a12 88%)",
    border: "rgba(255,255,255,0.1)",
    shadow: "0 6px 28px rgba(12,10,18,0.6), 0 2px 8px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.1)",
    shadowHover:
      "0 18px 48px rgba(124,58,237,0.38), 0 10px 28px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.16)",
    orbBg: "linear-gradient(165deg, rgba(255,255,255,0.2) 0%, rgba(167,139,250,0.12) 100%)",
    orbBorder: "rgba(196,181,253,0.35)",
    orbShadow: "0 4px 18px rgba(88,28,135,0.45), inset 0 1px 0 rgba(255,255,255,0.3)",
    Icon: FilePlus,
    iconColor: "#f5f3ff",
    titleColor: "#ffffff",
    subColor: "rgba(255,255,255,0.72)",
    ctaColor: "rgba(255,255,255,0.58)",
    ctaBorder: "rgba(255,255,255,0.1)",
  },
  review: {
    gradient: "linear-gradient(152deg, #059669 0%, #0d9488 38%, #022c22 88%)",
    border: "rgba(255,255,255,0.1)",
    shadow: "0 6px 28px rgba(2,44,34,0.55), 0 2px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.1)",
    shadowHover:
      "0 18px 48px rgba(16,185,129,0.32), 0 10px 28px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.15)",
    orbBg: "linear-gradient(165deg, rgba(255,255,255,0.2) 0%, rgba(52,211,153,0.12) 100%)",
    orbBorder: "rgba(110,231,183,0.35)",
    orbShadow: "0 4px 18px rgba(4,120,87,0.4), inset 0 1px 0 rgba(255,255,255,0.28)",
    Icon: Eye,
    iconColor: "#ecfdf5",
    titleColor: "#ffffff",
    subColor: "rgba(255,255,255,0.72)",
    ctaColor: "rgba(255,255,255,0.58)",
    ctaBorder: "rgba(255,255,255,0.1)",
  },
};

const QUICK_VISUAL_LIGHT = {
  message: {
    gradient: "linear-gradient(152deg, #eff6ff 0%, #dbeafe 42%, #ffffff 92%)",
    border: "rgba(37,99,235,0.2)",
    shadow: "0 6px 24px rgba(15,23,42,0.07), 0 2px 8px rgba(15,23,42,0.04)",
    shadowHover: "0 14px 36px rgba(37,99,235,0.14), 0 8px 20px rgba(15,23,42,0.07)",
    orbBg: "linear-gradient(165deg, rgba(37,99,235,0.12) 0%, #ffffff 100%)",
    orbBorder: "rgba(37,99,235,0.28)",
    orbShadow: "0 2px 12px rgba(37,99,235,0.12)",
    Icon: MessageSquare,
    iconColor: "#2563eb",
    titleColor: "#0f172a",
    subColor: "rgba(15,23,42,0.58)",
    ctaColor: "rgba(37,99,235,0.85)",
    ctaBorder: "rgba(15,23,42,0.08)",
  },
  routine: {
    gradient: "linear-gradient(152deg, #f5f3ff 0%, #ede9fe 45%, #ffffff 92%)",
    border: "rgba(124,58,237,0.22)",
    shadow: "0 6px 24px rgba(15,23,42,0.07), 0 2px 8px rgba(15,23,42,0.04)",
    shadowHover: "0 14px 36px rgba(124,58,237,0.14), 0 8px 20px rgba(15,23,42,0.07)",
    orbBg: "linear-gradient(165deg, rgba(124,58,237,0.12) 0%, #ffffff 100%)",
    orbBorder: "rgba(124,58,237,0.3)",
    orbShadow: "0 2px 12px rgba(124,58,237,0.12)",
    Icon: FilePlus,
    iconColor: "#7c3aed",
    titleColor: "#0f172a",
    subColor: "rgba(15,23,42,0.58)",
    ctaColor: "rgba(124,58,237,0.88)",
    ctaBorder: "rgba(15,23,42,0.08)",
  },
  review: {
    gradient: "linear-gradient(152deg, #ecfdf5 0%, #d1fae5 42%, #ffffff 92%)",
    border: "rgba(5,150,105,0.22)",
    shadow: "0 6px 24px rgba(15,23,42,0.07), 0 2px 8px rgba(15,23,42,0.04)",
    shadowHover: "0 14px 36px rgba(5,150,105,0.14), 0 8px 20px rgba(15,23,42,0.07)",
    orbBg: "linear-gradient(165deg, rgba(16,185,129,0.12) 0%, #ffffff 100%)",
    orbBorder: "rgba(16,185,129,0.3)",
    orbShadow: "0 2px 12px rgba(16,185,129,0.12)",
    Icon: Eye,
    iconColor: "#059669",
    titleColor: "#0f172a",
    subColor: "rgba(15,23,42,0.58)",
    ctaColor: "rgba(5,150,105,0.9)",
    ctaBorder: "rgba(15,23,42,0.08)",
  },
};

function buildQuickActions(lang, darkMode) {
  var v = darkMode !== false ? QUICK_VISUAL_DARK : QUICK_VISUAL_LIGHT;
  return [
    {
      action: "message",
      ...v.message,
      title: M(lang, "Enviar mensaje", "Send message", "Enviar mensagem"),
      sub: M(lang, "a tu equipo", "to your team", "à sua equipe"),
    },
    {
      action: "routine",
      ...v.routine,
      title: M(lang, "Crear rutina", "Create routine", "Criar rotina"),
      sub: M(lang, "personalizada", "custom", "personalizada"),
    },
    {
      action: "review",
      ...v.review,
      title: M(lang, "Revisar alumnos", "Review athletes", "Rever alunos"),
      sub: M(lang, "que necesitan atención", "who need attention", "que precisam de atenção"),
    },
  ];
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
  if (row.cat === "sin_rutina") return "#EF4444";
  if (row.cat === "inactivo") return "#F59E0B";
  return sesionColor(row.ult, lang, muted);
}

function rowStatusConfig(row, lang, C) {
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
  if (row.pct < 30) {
    return {
      label: M(lang, "Baja actividad", "Low activity", "Baixa atividade"),
      color: C.yel,
      bg: C.yelDim,
      action: M(lang, "Ver perfil", "View profile", "Ver perfil"),
      primary: false,
    };
  }
  return {
    label: M(lang, "Buen cumplimiento", "Good compliance", "Bom cumprimento"),
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

function computeCompliancePct(a, cat, sesionesGlobales, progresoGlobal, rutina) {
  if (cat === "sin_rutina") return 0;
  var weekly = getStudentWeeklyProgress({
    alumno: a,
    rutina: rutina,
    sesiones: sesionesGlobales,
    progreso: progresoGlobal,
  });
  if (weekly.totalDays > 0 || weekly.completedDays > 0) return weekly.pct;
  var now = Date.now();
  var d7 = now - 7 * 86400000;
  var ses = sesionesGlobales || [];
  var n7 = countSesionesSince(a, ses, d7);
  var p7 = countProgresoSince(a, progresoGlobal, d7);
  if (cat === "inactivo") {
    var last = getLastActivityMs(a, ses, progresoGlobal);
    if (last == null) return 5;
    var days = Math.floor((now - last) / 86400000);
    return Math.max(5, Math.min(42, 40 - Math.min(35, days)));
  }
  var score = Math.round(52 + n7 * 14 + Math.min(24, p7 * 3));
  return Math.max(71, Math.min(100, score));
}

function isCompletedSession(s) {
  return !(s && (s.estado === "pendiente" || s.completada === false));
}

function sesionesBetween(sesionesGlobales, fromMs, toMs) {
  return (sesionesGlobales || []).filter(function (s) {
    var t = parseDateMs(s.created_at || s.fecha);
    return t != null && t >= fromMs && t < toMs && isCompletedSession(s);
  }).length;
}

function weeklyTargetFromRutinas(alumnos, rutinasSBEntrenador) {
  var byAlumno = {};
  (rutinasSBEntrenador || []).forEach(function (r) {
    if (!r || !r.alumno_id) return;
    if (!byAlumno[r.alumno_id]) byAlumno[r.alumno_id] = r;
  });
  return (alumnos || []).reduce(function (sum, a) {
    var r = byAlumno[a.id];
    if (!r) return sum;
    var days = r.datos && Array.isArray(r.datos.days) ? r.datos.days.length : 0;
    return sum + Math.max(1, days || 3);
  }, 0);
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

function buildCoachAlerts(alumnos, catFn, sesionesGlobales, progresoGlobal, rutinasSBEntrenador, lang, P, currentWeek, mensajesPendientes) {
  if (!Array.isArray(alumnos) || alumnos.length === 0) return [];
  var ses = sesionesGlobales || [];
  var out = buildChatMessageAlerts(alumnos, mensajesPendientes, lang, P);
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
      if (rutinaId && totalDays > 0 && hasRealRoutineSessions && completedDaysFromSessions >= totalDays) {
        out.push({
          key: "rutina-terminada-" + a.id + "-" + rutinaId,
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
          key: "rutina-falta-1-" + a.id + "-" + rutinaId,
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

function buildCoachActiveRows(alumnos, catFn, sesionesGlobales, progresoGlobal, rutinasSBEntrenador, lang) {
  if (!Array.isArray(alumnos) || alumnos.length === 0) return [];
  return alumnos
    .map(function (a) {
      var cat = catFn(a);
      var rutina = getStudentRoutine(rutinasSBEntrenador, a);
      var weekly = getStudentWeeklyProgress({
        alumno: a,
        rutina: rutina,
        sesiones: sesionesGlobales,
        progreso: progresoGlobal,
      });
      var pct = computeCompliancePct(a, cat, sesionesGlobales, progresoGlobal, rutina);
      var lastMs = getLastActivityMs(a, sesionesGlobales, progresoGlobal);
      var ult = formatUltimaSesion(lastMs, lang, cat === "sin_rutina");
      return {
        id: a.id,
        initials: coachInitials(a),
        name: coachDisplayName(a) || M(lang, "Alumno", "Athlete", "Aluno"),
        pct: pct,
        ult: ult,
        cat: cat,
        weekly: weekly,
      };
    })
    .filter(function (row) {
      return !!row.name;
    })
    .sort(function (a, b) {
      function pr(row) {
        if (row.cat === "sin_rutina") return 0;
        if (row.cat === "inactivo") return 1;
        if (row.pct < 30) return 2;
        return 3;
      }
      var pa = pr(a);
      var pb = pr(b);
      if (pa !== pb) return pa - pb;
      if (a.pct !== b.pct) return a.pct - b.pct;
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
  sesionesGlobales = [],
  mensajesEntrenadorPendientes = [],
  progresoGlobal = {},
  rutinasSBEntrenador = [],
  allEx = [],
  lang = "es",
  onEnviarMensaje,
  onCrearRutina,
  onRevisarAlumnos,
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
      return buildCoachAlerts(alumnos, catFn, sesionesGlobales, progresoGlobal, rutinasSBEntrenador, lang, C, currentWeek, mensajesEntrenadorPendientes);
    },
    [alumnos, catFn, sesionesGlobales, progresoGlobal, rutinasSBEntrenador, lang, C, currentWeek, mensajesEntrenadorPendientes]
  );

  var coachActiveRows = React.useMemo(
    function () {
      return buildCoachActiveRows(alumnos, catFn, sesionesGlobales, progresoGlobal, rutinasSBEntrenador, lang);
    },
    [alumnos, catFn, sesionesGlobales, progresoGlobal, rutinasSBEntrenador, lang]
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

  /** Resumen de stats derivado del estado actual del dashboard. */
  var nowMs = Date.now();
  var weekStartMs = nowMs - 7 * 86400000;
  var prevWeekStartMs = nowMs - 14 * 86400000;
  var weeklyTeam = (alumnos || []).map(function (a) {
    return getStudentWeeklyProgress({
      alumno: a,
      rutina: getStudentRoutine(rutinasSBEntrenador, a),
      sesiones: sesionesGlobales,
      progreso: progresoGlobal,
    });
  });
  var sesionesCompletadas = weeklyTeam.reduce(function (sum, w) { return sum + (w.completedDays || 0); }, 0);
  var sesionesPrevias = sesionesBetween(sesionesGlobales, prevWeekStartMs, weekStartMs);
  var sesionesTotales = weeklyTeam.reduce(function (sum, w) { return sum + (w.totalDays || 0); }, 0);
  if (sesionesTotales <= 0) sesionesTotales = weeklyTargetFromRutinas(alumnos, rutinasSBEntrenador);
  if (sesionesTotales <= 0) sesionesTotales = Math.max(sesionesCompletadas, alumnos.length);
  var pctSemana = sesionesTotales > 0 ? Math.min(100, Math.round((sesionesCompletadas / sesionesTotales) * 100)) : 0;
  var pctSemanaPrevia = sesionesTotales > 0 ? Math.min(100, Math.round((sesionesPrevias / sesionesTotales) * 100)) : 0;
  var deltaSemana = pctSemana - pctSemanaPrevia;
  var objetivoSemanalPct = 80;
  var objetivoSesiones = sesionesTotales > 0 ? Math.ceil((sesionesTotales * objetivoSemanalPct) / 100) : 0;
  var faltanObjetivo = Math.max(0, objetivoSesiones - sesionesCompletadas);
  var sinRutinaCount = coachActiveRows.filter(function (r) { return r.cat === "sin_rutina"; }).length;
  var inactivosCount = coachActiveRows.filter(function (r) { return r.cat === "inactivo"; }).length;
  var bajaActividadCount = coachActiveRows.filter(function (r) { return r.cat !== "sin_rutina" && r.cat !== "inactivo" && r.pct < 30; }).length;
  var buenosCount = coachActiveRows.filter(function (r) { return r.cat === "activo" && r.pct >= 70; }).length;
  var rendimientoScore = alumnos.length > 0 ? Math.round(pctSemana * 0.7 + (buenosCount / alumnos.length) * 30) : 0;
  var rendimientoDeltaPts = Math.round(deltaSemana * 0.4);
  var rachaActual = sesionesCompletadas > 0 ? Math.min(7, Math.max(1, Math.ceil(sesionesCompletadas / Math.max(1, alumnos.length)))) : 0;
  var dashboardInterpretacion = pctSemana >= objetivoSemanalPct
    ? M(lang, "Semana en objetivo", "Week on target", "Semana no objetivo")
    : pctSemana >= 55
      ? M(lang, "Vas bien, pero podés mejorar", "You're doing well, but can improve", "Você vai bem, mas pode melhorar")
      : M(lang, "Necesita atención esta semana", "Needs attention this week", "Precisa de atenção esta semana");

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
  var impactoEstimado =
    faltanObjetivo > 0
      ? M(
          lang,
          faltanObjetivo + " sesiones para llegar al objetivo semanal",
          faltanObjetivo + " sessions to reach the weekly target",
          faltanObjetivo + " sessões para chegar ao objetivo semanal"
        )
      : M(lang, "Objetivo semanal alcanzado", "Weekly target reached", "Objetivo semanal alcançado");
  var accionRecomendada =
    sinRutinaCount > 0
      ? M(lang, "Asignar rutinas pendientes", "Assign pending routines", "Atribuir rotinas pendentes")
      : inactivosCount > 0
        ? M(lang, "Enviar mensaje a alumnos inactivos", "Message inactive athletes", "Enviar mensagem a alunos inativos")
        : bajaActividadCount > 0
          ? M(lang, "Revisar alumnos con baja actividad", "Review low-activity athletes", "Revisar alunos com baixa atividade")
          : M(lang, "Revisar progreso del equipo", "Review team progress", "Revisar progresso da equipe");
  var accionPrincipalHandler =
    sinRutinaCount > 0
      ? onCrearRutina
      : inactivosCount > 0
        ? onEnviarMensaje
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
      cta: M(lang, "Asignar ahora", "Assign now", "Atribuir agora"),
      onClick: onCrearRutina,
      title: M(lang, "alumnos sin rutina", "athletes without routine", "alunos sem rotina"),
      sub: M(lang, "Asignales una rutina para que comiencen", "Assign routines so they can start", "Atribua rotinas para começarem"),
    },
    {
      key: "inactivos",
      Icon: Clock3,
      count: inactivosCount,
      color: C.yel,
      cta: M(lang, "Enviar mensaje", "Send message", "Enviar mensagem"),
      onClick: onEnviarMensaje,
      title: M(lang, "alumnos inactivos", "inactive athletes", "alunos inativos"),
      sub: M(lang, "Hace más de 21 días sin actividad", "No activity in over 21 days", "Mais de 21 dias sem atividade"),
    },
    {
      key: "baja",
      Icon: AlertCircle,
      count: bajaActividadCount,
      color: C.yel,
      cta: M(lang, "Ver y revisar", "View and review", "Ver e revisar"),
      onClick: onRevisarAlumnos,
      title: M(lang, "alumnos con baja actividad", "athletes with low activity", "alunos com baixa atividade"),
      sub: M(lang, "Menos del 30% de cumplimiento", "Under 30% compliance", "Menos de 30% de cumprimento"),
    },
  ];
  var activeStudentsMobileRows = coachActiveRows.map(function (row, idx) {
    var br = pctBracketColor(row.pct);
    var status = rowStatusConfig(row, lang, C);
    return {
      id: row.id,
      initials: row.initials,
      name: row.name,
      ult: row.ult,
      pct: row.pct,
      percentColor: br,
      avatarBg: br + "33",
      estadoColor: estadoTextColor(row, lang, C.t2),
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
    var col = pctColor(row.pct);
    var status = rowStatusConfig(row, lang, C);
    return {
      id: row.id,
      initials: row.initials,
      name: row.name,
      ult: row.ult,
      pct: row.pct,
      percentColor: col,
      avatarBg: col + "22",
      sessionColor: sesionColor(row.ult, lang, C.t2),
      statusLabel: status.label,
      statusBg: status.bg,
      statusColor: status.color,
      borderBottom: idx < coachActiveRows.length - 1 ? "1px solid " + dashBorder : "none",
      rowCursor: typeof onVerPerfil === "function" ? "pointer" : "default",
      role: typeof onVerPerfil === "function" ? "button" : undefined,
      onClick: function () {
        if (typeof onVerPerfil === "function") onVerPerfil(row.id);
      },
      actions: [
        {
          key: "assign",
          label: M(lang, "Asignar", "Assign", "Atribuir"),
          primary: status.primary,
          enabled: typeof onRevisar === "function",
          onClick: function (ev) {
            ev.stopPropagation();
            if (typeof onRevisar === "function") onRevisar(row.id);
          },
        },
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
      ],
    };
  });
  var activeStudentsHeaders = [
    M(lang, "ALUMNO", "ATHLETE", "ALUNO"),
    M(lang, "CUMPLIMIENTO", "COMPLIANCE", "CUMPRIMENTO"),
    M(lang, "ÚLTIMA SESIÓN", "LAST SESSION", "ÚLTIMA SESSÃO"),
    M(lang, "ESTADO", "STATUS", "ESTADO"),
    M(lang, "ACCIÓN", "ACTION", "AÇÃO"),
  ];

  return (
    <>
      <style>{`
        .cd-card,
        .cd-quick-card,
        .cd-attention-block,
        .cd-row {
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
          transform: translateY(0);
        }
        .cd-card {
          animation: cdIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .cd-card:hover,
        .cd-quick-card:hover {
          transform: translateY(-2px);
          box-shadow: ${darkMode ? "0 18px 42px rgba(0,0,0,0.26)" : "0 16px 34px rgba(15,23,42,0.08)"} !important;
          border-color: ${darkMode ? "rgba(148,163,184,0.24)" : "rgba(37,99,235,0.22)"} !important;
        }
        .cd-attention-block:hover,
        .cd-row:hover {
          transform: translateY(-2px);
          border-color: ${darkMode ? "rgba(148,163,184,0.22)" : "rgba(37,99,235,0.18)"} !important;
        }
        .cd-btn {
          transition: transform 0.16s ease, background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease;
        }
        .cd-btn:active {
          transform: scale(0.97);
        }
        .cd-progress-fill {
          transition: width 0.42s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes cdIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .cd-quick-card:focus-visible,
        .cd-btn:focus-visible {
          outline: 2px solid rgba(59,130,246,0.7);
          outline-offset: 2px;
        }
      `}</style>
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
            padding: S.headerPadding,
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
            <p style={{ ...T.screenSubtitle, color: C.t2, margin: "6px 0 0 0" }}>
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
                placeholder={M(lang, "Buscar alumno, rutina, ejercicio...", "Search athlete, routine, exercise...", "Buscar aluno, rotina, exercício...")}
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
            padding: S.pagePadding,
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
          />
          <CoachDashboardSummaryGrid
            isMobile={isMobile}
            mobileGap={10}
            desktopGap={S.gridGap}
            recommendationProps={{
              eyebrow: M(lang, "RECOMENDACIÓN PRINCIPAL", "MAIN RECOMMENDATION", "RECOMENDAÇÃO PRINCIPAL"),
              title: accionRecomendada,
              description: diagnosticoPrincipal,
              impactLabel: M(lang, "IMPACTO ESTIMADO", "ESTIMATED IMPACT", "IMPACTO ESTIMADO"),
              impactText: impactoEstimado,
              ctaLabel: accionRecomendada,
              onAction: accionPrincipalHandler,
              colors: C,
              type: T,
              dashCard: dashCard,
              dashBorder: dashBorder,
              dashMuted: dashMuted,
            }}
            mobileWeekKpiProps={{
              label: M(lang, "Esta semana", "This week", "Esta semana"),
              value: sesionesCompletadas + "/" + sesionesTotales,
              subtitle: M(lang, "sesiones completadas", "sessions completed", "sessões concluídas"),
              progress: pctSemana,
              accent: "#2563EB",
              colors: C,
              type: T,
              blockGap: S.blockGap,
            }}
            mobilePerformanceKpiProps={{
              label: M(lang, "Rendimiento", "Performance", "Desempenho"),
              value: rendimientoScore,
              suffix: "/100",
              deltaText: "+" + rendimientoDeltaPts + " " + M(lang, "pts vs sem. ant.", "pts vs last wk", "pts vs sem. ant."),
              progress: rendimientoScore,
              accent: "#22C55E",
              colors: C,
              type: T,
              blockGap: S.blockGap,
            }}
            desktopWeeklyProps={{
              title: M(lang, "Cumplimiento semanal", "Weekly completion", "Cumprimento semanal"),
              completedText: sesionesCompletadas + " / " + sesionesTotales,
              pctText: pctSemana + "%",
              subtitle: M(lang, "sesiones completadas", "sessions completed", "sessões concluídas"),
              deltaText: (deltaSemana >= 0 ? "+" : "") + deltaSemana + "% " + M(lang, "vs semana pasada", "vs last week", "vs semana passada"),
              deltaBg: deltaSemana >= 0 ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
              deltaColor: deltaSemana >= 0 ? C.green : C.red,
              progressPct: pctSemana,
              trackBg: darkMode ? "rgba(148,163,184,0.14)" : C.brd,
              insightTitle: M(lang, "Insight del día", "Today's insight", "Insight do dia"),
              insightText: diagnosticoPrincipal,
              insightColor: pctSemana >= objetivoSemanalPct ? C.green : C.yel,
              goalText: faltanObjetivo > 0
                ? M(lang, "Te faltan " + faltanObjetivo + " sesiones para el objetivo", faltanObjetivo + " sessions left for the target", "Faltam " + faltanObjetivo + " sessões para o objetivo")
                : M(lang, "Objetivo semanal alcanzado", "Weekly target reached", "Objetivo semanal alcançado"),
              primaryLabel: M(lang, "Acción recomendada", "Recommended action", "Ação recomendada"),
              secondaryLabel: M(lang, "Ver equipo", "View team", "Ver equipe"),
              onPrimary: accionPrincipalHandler,
              onSecondary: onRevisarAlumnos,
              gaugeOffset: 188.5 * (1 - pctSemana / 100),
              colors: C,
              type: T,
              dashCard: dashCard,
              dashBorder: dashBorder,
              dashCardSoft: dashCardSoft,
              dashMuted: dashMuted,
              blockGap: S.blockGap,
            }}
            desktopPerformanceProps={{
              title: M(lang, "Tu rendimiento", "Your performance", "Seu desempenho"),
              score: rendimientoScore,
              deltaText: (rendimientoDeltaPts >= 0 ? "+" : "") + rendimientoDeltaPts + " " + M(lang, "pts vs semana pasada", "pts vs last week", "pts vs semana passada"),
              metrics: [
                { label: M(lang, "Sesiones esta semana", "Sessions this week", "Sessões esta semana"), value: sesionesTotales },
                { label: M(lang, "Sesiones completadas", "Completed sessions", "Sessões concluídas"), value: sesionesCompletadas },
                { label: M(lang, "Racha actual", "Current streak", "Sequência atual"), value: rachaActual + " " + M(lang, "días", "days", "dias") },
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
          />

          <CoachActiveStudentsCard
            title={M(lang, "Alumnos activos", "Active athletes", "Alunos ativos")}
            seeAllLabel={M(lang, "Ver todos →", "See all →", "Ver todos →")}
            onSeeAll={onRevisarAlumnos}
            emptyText={M(
              lang,
              "Todavía no tenés alumnos cargados. Agregá alumnos desde Alumnos o con «Crear».",
              "No athletes yet. Add them from Athletes or «Create».",
              "Ainda não há alunos. Adicione em Alunos ou em «Criar»."
            )}
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
