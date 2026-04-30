import React from "react";
import {
  AlertCircle,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  FilePlus,
  Info,
  MessageSquare,
  Star,
  Target,
} from "lucide-react";
import GlobalCreateMenu from "./GlobalCreateMenu.jsx";
import GlobalSearch from "./GlobalSearch.jsx";
import CoachNotificationCenter from "./CoachNotificationCenter.jsx";
import ProgresoView from "./ProgresoView.jsx";
import { coachType as T, coachSpace as S, coachFirstNameFromFullName } from "./coachUiScale.js";
import { irontrackMsg as M, localeForSort } from "../lib/irontrackMsg.js";
import { coachThemePalette } from "./coachThemePalette.js";

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

/** Barras semana demo: letras según locale (LMXJVSD / MTWTFSS / STQQSSD). */
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
  if (!rutinasSBEntrenador.some(function (r) { return r.alumno_id === a.id; })) return "sin_rutina";
  var cutoff = Date.now() - 21 * 24 * 60 * 60 * 1000;
  var ses = sesionesGlobales || [];
  for (var i = 0; i < ses.length; i++) {
    if (ses[i].alumno_id !== a.id) continue;
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
    if (s.alumno_id !== a.id) return;
    var t = parseDateMs(s.created_at || s.fecha);
    if (t != null && (best == null || t > best)) best = t;
  });
  (progresoGlobal[a.id] || []).forEach(function (r) {
    var t = parseDateMs(r.fecha);
    if (t != null && (best == null || t > best)) best = t;
  });
  return best;
}

function countSesionesSince(a, sesionesGlobales, sinceMs) {
  return (sesionesGlobales || []).filter(function (s) {
    if (s.alumno_id !== a.id) return false;
    var t = parseDateMs(s.created_at || s.fecha);
    return t != null && t >= sinceMs;
  }).length;
}

function countProgresoSince(a, progresoGlobal, sinceMs) {
  return (progresoGlobal[a.id] || []).filter(function (r) {
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

function computeCompliancePct(a, cat, sesionesGlobales, progresoGlobal) {
  if (cat === "sin_rutina") return 0;
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
 * Prioridad: sin rutina > inactivo > poca actividad en la semana (con rutina).
 */
function buildCoachAlerts(alumnos, catFn, sesionesGlobales, progresoGlobal, lang, P) {
  if (!Array.isArray(alumnos) || alumnos.length === 0) return [];
  var ses = sesionesGlobales || [];
  var out = [];
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
    return String(x.name).localeCompare(String(y.name), localeForSort(lang));
  });
  return out.slice(0, 12);
}

function buildCoachActiveRows(alumnos, catFn, sesionesGlobales, progresoGlobal, lang) {
  if (!Array.isArray(alumnos) || alumnos.length === 0) return [];
  return alumnos
    .map(function (a) {
      var cat = catFn(a);
      var pct = computeCompliancePct(a, cat, sesionesGlobales, progresoGlobal);
      var lastMs = getLastActivityMs(a, sesionesGlobales, progresoGlobal);
      var ult = formatUltimaSesion(lastMs, lang, cat === "sin_rutina");
      return {
        id: a.id,
        initials: coachInitials(a),
        name: coachDisplayName(a) || M(lang, "Alumno", "Athlete", "Aluno"),
        pct: pct,
        ult: ult,
        cat: cat,
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
  /** Nombre del entrenador (session) para saludo e iniciales en la shell. */
  coachName = "",
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
      return buildCoachAlerts(alumnos, catFn, sesionesGlobales, progresoGlobal, lang, C);
    },
    [alumnos, catFn, sesionesGlobales, progresoGlobal, lang, C]
  );

  var coachActiveRows = React.useMemo(
    function () {
      return buildCoachActiveRows(alumnos, catFn, sesionesGlobales, progresoGlobal, lang);
    },
    [alumnos, catFn, sesionesGlobales, progresoGlobal, lang]
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

  /** Resumen stats (mock alineado al dashboard) — solo layout mobile vs desktop. */
  var nowMs = Date.now();
  var weekStartMs = nowMs - 7 * 86400000;
  var prevWeekStartMs = nowMs - 14 * 86400000;
  var sesionesCompletadas = sesionesBetween(sesionesGlobales, weekStartMs, nowMs);
  var sesionesPrevias = sesionesBetween(sesionesGlobales, prevWeekStartMs, weekStartMs);
  var sesionesTotales = weeklyTargetFromRutinas(alumnos, rutinasSBEntrenador);
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
      ? M(lang, "Vas bien, pero podés mejorar", "You're doing well, but can improve", "VocÃª vai bem, mas pode melhorar")
      : M(lang, "Necesita atención esta semana", "Needs attention this week", "Precisa de atenÃ§Ã£o esta semana");

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
          faltanObjetivo + " sessÃµes para chegar ao objetivo semanal"
        )
      : M(lang, "Objetivo semanal alcanzado", "Weekly target reached", "Objetivo semanal alcanÃ§ado");
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
              alumnos={alumnos}
              onRevisarAlumno={onRevisar}
              onIrAlumnos={onRevisarAlumnos}
              onIrProgreso={onIrProgreso}
              onAbrirChatAlumno={onAbrirChatAlumno}
              useFixedMobilePanel={isMobile}
              darkMode={darkMode}
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
          <div
            className="cd-card"
            style={{
              background: dashCard,
              border: `1px solid ${dashBorder}`,
              borderRadius: 16,
              padding: isMobile ? 14 : 18,
              boxSizing: "border-box",
              boxShadow: darkMode ? "0 14px 40px rgba(0,0,0,0.18)" : "0 12px 32px rgba(15,23,42,0.06)",
            }}
          >
            <div style={{ ...T.sectionEyebrow, color: dashMuted, marginBottom: 14 }}>
              {M(lang, "ATENCIÓN HOY", "TODAY'S ATTENTION", "ATENÇÃO HOJE")}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
                gap: isMobile ? 10 : 14,
              }}
            >
              {[
                {
                  key: "sin-rutina",
                  Icon: Target,
                  count: sinRutinaCount,
                  color: C.red,
                  bg: C.redDim,
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
                  bg: C.yelDim,
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
                  bg: C.yelDim,
                  cta: M(lang, "Ver y revisar", "View and review", "Ver e revisar"),
                  onClick: onRevisarAlumnos,
                  title: M(lang, "alumnos con baja actividad", "athletes with low activity", "alunos com baixa atividade"),
                  sub: M(lang, "Menos del 30% de cumplimiento", "Under 30% compliance", "Menos de 30% de cumprimento"),
                },
              ].map(function (item) {
                var Icon = item.Icon;
                return (
                  <div
                    key={item.key}
                    className="cd-attention-block"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "44px minmax(0, 1fr)",
                      gap: 12,
                      alignItems: "center",
                      minWidth: 0,
                      padding: 12,
                      borderRadius: 13,
                      border: "1px solid " + dashBorder,
                      background: dashCardSoft,
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: "transparent",
                        border: "1px solid " + dashBorder,
                        color: item.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={20} color={item.color} strokeWidth={2.25} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ ...T.bodyLg, color: C.t, fontWeight: 800 }}>
                        {item.count} {item.title}
                      </div>
                      <div style={{ ...T.body, color: C.t2, marginTop: 3 }}>
                        {item.sub}
                      </div>
                      <button
                        type="button"
                        className="cd-btn"
                        style={{
                          marginTop: 10,
                          height: 32,
                          padding: "0 12px",
                          borderRadius: 8,
                          border: "1px solid " + dashBorder,
                          background: "transparent",
                          color: C.blue,
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: typeof item.onClick === "function" ? "pointer" : "default",
                        }}
                        onClick={function () {
                          if (typeof item.onClick === "function") item.onClick();
                        }}
                      >
                        {item.cta}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {isMobile ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: 10,
                alignItems: "stretch",
              }}
            >
              <div
                className="cd-card"
                style={{
                  background: dashCard,
                  border: `1px solid ${dashBorder}`,
                  borderRadius: 16,
                  padding: 20,
                  minWidth: 0,
                  boxSizing: "border-box",
                  alignSelf: "stretch",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ ...T.sectionEyebrow, color: dashMuted, marginBottom: 14 }}>
                  {M(lang, "RECOMENDACIÃ“N PRINCIPAL", "MAIN RECOMMENDATION", "RECOMENDAÃ‡ÃƒO PRINCIPAL")}
                </div>
                <div style={{ fontSize: 24, lineHeight: 1.12, fontWeight: 850, color: C.t, letterSpacing: -0.2 }}>
                  {accionRecomendada}
                </div>
                <div style={{ ...T.body, color: dashMuted, marginTop: 10, lineHeight: 1.5 }}>
                  {diagnosticoPrincipal}
                </div>
                <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid " + dashBorder }}>
                  <div style={{ ...T.sectionEyebrow, color: dashMuted, marginBottom: 8 }}>
                    {M(lang, "IMPACTO ESTIMADO", "ESTIMATED IMPACT", "IMPACTO ESTIMADO")}
                  </div>
                  <div style={{ ...T.bodySemibold, color: C.t, lineHeight: 1.45 }}>
                    {impactoEstimado}
                  </div>
                </div>
                <button
                  type="button"
                  className="cd-btn"
                  style={{
                    width: "100%",
                    minHeight: 42,
                    marginTop: "auto",
                    border: "none",
                    borderRadius: 10,
                    background: C.blue,
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 850,
                    cursor: "pointer",
                  }}
                  onClick={function () {
                    if (typeof accionPrincipalHandler === "function") accionPrincipalHandler();
                  }}
                >
                  {accionRecomendada}
                </button>
              </div>

              <div
                style={{
                  background: C.mobileStatBg,
                  border: "1px solid " + C.mobileStatBorder,
                  borderRadius: 14,
                  padding: 14,
                  minWidth: 0,
                  boxSizing: "border-box",
                  borderLeft: "3px solid #2563EB",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <span style={{ ...T.labelMd, color: C.mobileStatMuted }}>{M(lang, "Esta semana", "This week", "Esta semana")}</span>
                <div
                  style={{
                    ...T.numberStat,
                    color: C.mobileStatText,
                    marginTop: 6,
                    letterSpacing: -0.02,
                  }}
                >
                  {sesionesCompletadas}/{sesionesTotales}
                </div>
                <div style={{ ...T.subtitle, color: C.mobileStatMuted, marginTop: 4 }}>
                  {M(lang, "sesiones completadas", "sessions completed", "sessões concluídas")}
                </div>
                <div style={{ flex: 1, minHeight: S.blockGap }} />
                <div
                  style={{
                    height: 6,
                    background: C.mobileTrack,
                    borderRadius: 3,
                    overflow: "hidden",
                    marginTop: S.blockGap,
                  }}
                >
                  <div
                    style={{
                      width: pctSemana + "%",
                      height: "100%",
                      background: "#2563EB",
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>
              <div
                style={{
                  background: C.mobileStatBg,
                  border: "1px solid " + C.mobileStatBorder,
                  borderRadius: 14,
                  padding: 14,
                  minWidth: 0,
                  boxSizing: "border-box",
                  borderLeft: "3px solid #22C55E",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <span style={{ ...T.labelMd, color: C.mobileStatMuted }}>{M(lang, "Rendimiento", "Performance", "Desempenho")}</span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                  <span style={{ ...T.numberStat, color: C.mobileStatText }}>{rendimientoScore}</span>
                  <span style={{ ...T.cardTitleSemibold, color: C.mobileStatMuted, fontSize: 15 }}>/100</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 6,
                    ...T.meta,
                    color: "#22C55E",
                    fontWeight: 600,
                  }}
                >
                  <ArrowUp size={13} strokeWidth={2.5} />
                  +{rendimientoDeltaPts} {M(lang, "pts vs sem. ant.", "pts vs last wk", "pts vs sem. ant.")}
                </div>
                <div style={{ flex: 1, minHeight: S.blockGap }} />
                <div
                  style={{
                    height: 6,
                    background: C.mobileTrack,
                    borderRadius: 3,
                    overflow: "hidden",
                    marginTop: S.blockGap,
                  }}
                >
                  <div
                    style={{
                      width: rendimientoScore + "%",
                      height: "100%",
                      background: "#22C55E",
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 2fr) minmax(240px, 1fr) minmax(240px, 1fr)",
                gap: S.gridGap,
                alignItems: "stretch",
              }}
            >
              <div
                className="cd-card"
                style={{
                  background: dashCard,
                  border: `1px solid ${dashBorder}`,
                  borderRadius: 16,
                  padding: 22,
                  minWidth: 0,
                  boxSizing: "border-box",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: S.blockGap }}>
                  <Info size={16} color={C.t2} strokeWidth={2} />
                  <span style={{ ...T.cardTitleSemibold, color: C.t }}>
                    {M(lang, "Cumplimiento semanal", "Weekly completion", "Cumprimento semanal")}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
                  <div style={{ ...T.numberHero, color: C.t }}>
                    {sesionesCompletadas} / {sesionesTotales}
                  </div>
                  <div style={{ fontSize: 34, lineHeight: 1, fontWeight: 850, color: C.t }}>
                    {pctSemana}%
                  </div>
                </div>
                <div style={{ ...T.subtitle, color: C.t2, marginTop: 6 }}>
                  {M(lang, "sesiones completadas", "sessions completed", "sessões concluídas")}
                </div>
                <div
                  style={{
                    marginTop: S.blockGap,
                    display: "inline-block",
                    background: deltaSemana >= 0 ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                    color: deltaSemana >= 0 ? C.green : C.red,
                    borderRadius: 99,
                    padding: "5px 12px",
                    ...T.bodySemibold,
                  }}
                >
                  {deltaSemana >= 0 ? "+" : ""}{deltaSemana}% {M(lang, "vs semana pasada", "vs last week", "vs semana passada")}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 14,
                    alignItems: "flex-start",
                    marginTop: 10,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{height:10,background:darkMode ? "rgba(148,163,184,0.14)" : C.brd,borderRadius:999,overflow:"hidden",marginBottom:14}}>
                      <div className="cd-progress-fill" style={{width:pctSemana+"%",height:"100%",background:C.blue,borderRadius:999}} />
                    </div>
                    <div style={{background:dashCardSoft,border:"1px solid "+dashBorder,borderRadius:14,padding:"14px 16px",marginBottom:10}}>
                      <div style={{...T.sectionEyebrow,color:dashMuted,marginBottom:8,letterSpacing:1.4}}>
                        {M(lang, "Insight del dÃ­a", "Today's insight", "Insight do dia")}
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8,...T.bodySemibold,color:pctSemana >= objetivoSemanalPct ? C.green : C.yel}}>
                        <Star size={16} color={C.blue} strokeWidth={2}/>
                        {diagnosticoPrincipal}
                      </div>
                      <div style={{...T.body,color:C.t2,marginTop:6}}>
                        {faltanObjetivo > 0
                          ? M(lang, "Te faltan " + faltanObjetivo + " sesiones para el objetivo", faltanObjetivo + " sessions left for the target", "Faltam " + faltanObjetivo + " sessões para o objetivo")
                          : M(lang, "Objetivo semanal alcanzado", "Weekly target reached", "Objetivo semanal alcançado")}
                      </div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      <button className="cd-btn" type="button" onClick={accionPrincipalHandler} style={{background:C.blue,color:"#fff",border:"none",borderRadius:8,padding:"10px 12px",fontSize:13,fontWeight:800,cursor:"pointer"}}>
                        {M(lang, "AcciÃ³n recomendada", "Recommended action", "AÃ§Ã£o recomendada")}
                      </button>
                      <button className="cd-btn" type="button" onClick={onRevisarAlumnos} style={{background:"transparent",color:C.t,border:"1px solid "+dashBorder,borderRadius:8,padding:"10px 12px",fontSize:13,fontWeight:800,cursor:"pointer"}}>
                        {M(lang, "Ver equipo", "View team", "Ver equipe")}
                      </button>
                    </div>
                  </div>
                  <div style={{ position: "relative", width: 88, height: 88, flexShrink: 0 }}>
                    <svg width={88} height={88} viewBox="0 0 80 80" style={{ display: "block" }}>
                      <circle r={30} cx={40} cy={40} stroke={C.brd} strokeWidth={8} fill="none" />
                      <circle
                        r={30}
                        cx={40}
                        cy={40}
                        stroke={C.blue}
                        strokeWidth={8}
                        fill="none"
                        strokeDasharray="188.5"
                        strokeDashoffset={188.5 * (1 - pctSemana / 100)}
                        strokeLinecap="round"
                        transform="rotate(-90 40 40)"
                      />
                    </svg>
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        ...T.numberGauge,
                        color: C.t,
                        pointerEvents: "none",
                      }}
                    >
                      {pctSemana}%
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="cd-card"
                style={{
                  background: dashCard,
                  border: `1px solid ${dashBorder}`,
                  borderRadius: 16,
                  padding: 20,
                  minWidth: 0,
                  boxSizing: "border-box",
                  alignSelf: "stretch",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ ...T.sectionEyebrow, color: dashMuted, marginBottom: 14 }}>
                  {M(lang, "RECOMENDACIÃ“N PRINCIPAL", "MAIN RECOMMENDATION", "RECOMENDAÃ‡ÃƒO PRINCIPAL")}
                </div>
                <div style={{ fontSize: 24, lineHeight: 1.12, fontWeight: 850, color: C.t, letterSpacing: -0.2 }}>
                  {accionRecomendada}
                </div>
                <div style={{ ...T.body, color: dashMuted, marginTop: 10, lineHeight: 1.5 }}>
                  {diagnosticoPrincipal}
                </div>
                <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid " + dashBorder }}>
                  <div style={{ ...T.sectionEyebrow, color: dashMuted, marginBottom: 8 }}>
                    {M(lang, "IMPACTO ESTIMADO", "ESTIMATED IMPACT", "IMPACTO ESTIMADO")}
                  </div>
                  <div style={{ ...T.bodySemibold, color: C.t, lineHeight: 1.45 }}>
                    {impactoEstimado}
                  </div>
                </div>
                <button
                  type="button"
                  className="cd-btn"
                  style={{
                    width: "100%",
                    minHeight: 42,
                    marginTop: "auto",
                    border: "none",
                    borderRadius: 10,
                    background: C.blue,
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 850,
                    cursor: "pointer",
                  }}
                  onClick={function () {
                    if (typeof accionPrincipalHandler === "function") accionPrincipalHandler();
                  }}
                >
                  {accionRecomendada}
                </button>
              </div>

              <div
                className="cd-card"
                style={{
                  background: dashCard,
                  border: `1px solid ${dashBorder}`,
                  borderRadius: 16,
                  padding: 20,
                  minWidth: 0,
                  boxSizing: "border-box",
                  alignSelf: "stretch",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: S.blockGap }}>
                  <Info size={16} color={C.t2} strokeWidth={2} />
                  <span style={{ ...T.cardTitleSemibold, color: C.t }}>
                    {M(lang, "Tu rendimiento", "Your performance", "Seu desempenho")}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                      <Star size={18} color="#eab308" fill="#eab308" strokeWidth={1.5} />
                      <span style={{ ...T.numberScore, color: C.t }}>
                        {rendimientoScore}
                      </span>
                      <span style={{ ...T.cardTitleSemibold, color: C.t2 }}>/100</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginTop: S.blockGap,
                        ...T.body,
                        color: C.green,
                      }}
                    >
                      <ArrowUp size={14} strokeWidth={2.5} />
                      {rendimientoDeltaPts >= 0 ? "+" : ""}{rendimientoDeltaPts} {M(lang, "pts vs semana pasada", "pts vs last week", "pts vs semana passada")}
                    </div>
                  </div>
                  <div style={{ position: "relative", width: 68, height: 68, flexShrink: 0 }}>
                    <svg width={68} height={68} viewBox="0 0 60 60" style={{ display: "block" }}>
                      <circle r={23} cx={30} cy={30} stroke={C.brd} strokeWidth={7} fill="none" />
                      <circle
                        r={23}
                        cx={30}
                        cy={30}
                        stroke={C.blue}
                        strokeWidth={7}
                        fill="none"
                        strokeDasharray="144.51"
                        strokeDashoffset={144.51 * (1 - rendimientoScore / 100)}
                        strokeLinecap="round"
                        transform="rotate(-90 30 30)"
                      />
                    </svg>
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        ...T.numberStat,
                        color: C.t,
                        pointerEvents: "none",
                      }}
                    >
                      {rendimientoScore}%
                    </div>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr",gap:8,marginTop:18,borderTop:"1px solid "+C.rowDivider,paddingTop:12}}>
                  {[
                    {label:M(lang,"Sesiones esta semana","Sessions this week","Sessões esta semana"), value:sesionesTotales},
                    {label:M(lang,"Sesiones completadas","Completed sessions","Sessões concluídas"), value:sesionesCompletadas},
                    {label:M(lang,"Racha actual","Current streak","Sequência atual"), value:rachaActual + " " + M(lang,"días","days","dias")},
                  ].map(function (m) {
                    return (
                      <div key={m.label} style={{display:"flex",justifyContent:"space-between",gap:10,...T.body,color:C.t}}>
                        <span style={{color:C.t2}}>{m.label}</span>
                        <strong style={{fontWeight:800}}>{m.value}</strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

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
                            if (!alumId || typeof onRevisar !== "function") return;
                            onRevisar(alumId);
                          }}
                        >
                          {M(lang, "REVISAR", "REVIEW", "REVISAR")}
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
                            if (!alumId || typeof onVerPerfil !== "function") return;
                            onVerPerfil(alumId);
                          }}
                        >
                          {M(lang, "VER PERFIL", "VIEW PROFILE", "VER PERFIL")}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div
              style={{
                ...T.sectionEyebrow,
                color: dashMuted,
                marginBottom: S.blockGap,
              }}
            >
              {M(lang, "ACCIONES RÁPIDAS", "QUICK ACTIONS", "AÇÕES RÁPIDAS")}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 14,
              }}
            >
              {quickActions.map(function (item) {
                var Qi = item.Icon;
                var cta = M(lang, "Abrir", "Open", "Abrir");
                return (
                  <div
                    key={item.action}
                    role="button"
                    tabIndex={0}
                    className="cd-quick-card"
                    style={{
                      ["--cd-q-sh"]: item.shadow,
                      ["--cd-q-sh-h"]: item.shadowHover,
                      position: "relative",
                      overflow: "hidden",
                      minHeight: 96,
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "18px 18px",
                      borderRadius: 14,
                      cursor: "pointer",
                      boxSizing: "border-box",
                      background: dashCard,
                      border: "1px solid " + dashBorder,
                      boxShadow: "none",
                    }}
                    onClick={function () {
                      runQuick(item.action);
                    }}
                    onKeyDown={function (ev) {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault();
                        runQuick(item.action);
                      }
                    }}
                  >
                    <div
                      aria-hidden
                      style={{
                        display: "none",
                        position: "absolute",
                        top: -40,
                        right: -30,
                        width: 140,
                        height: 140,
                        borderRadius: "50%",
                        background: "radial-gradient(circle, rgba(255,255,255,0.14) 0%, transparent 70%)",
                        pointerEvents: "none",
                      }}
                    />
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 14,
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: dashCardSoft,
                        border: "1px solid " + dashBorder,
                        boxShadow: "none",
                      }}
                    >
                      <Qi size={24} color={C.blue} strokeWidth={2.1} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 15,
                          fontWeight: 800,
                          lineHeight: 1.25,
                          color: C.t,
                        }}
                      >
                        {item.title}
                      </p>
                      <p
                        style={{
                          margin: "5px 0 0 0",
                          fontSize: 13,
                          fontWeight: 500,
                          lineHeight: 1.35,
                          color: C.t2,
                          maxWidth: "100%",
                        }}
                      >
                        {item.sub}
                      </p>
                    </div>
                    <div
                      className="cd-quick-cta"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        marginTop: 0,
                        paddingTop: 0,
                        borderTop: "none",
                        fontSize: 13,
                        fontWeight: 600,
                        letterSpacing: 0.02,
                        color: C.blue,
                        background: C.blueDim,
                        flexShrink: 0,
                      }}
                    >
                      <span style={{ display: "none" }}>{cta}</span>
                      <ArrowRight size={18} color="currentColor" strokeWidth={2.25} style={{ flexShrink: 0 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className="cd-card"
            style={{
              background: dashCard,
              border: `1px solid ${dashBorder}`,
              borderRadius: 16,
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
              <span style={{ ...T.cardTitleSemibold, color: C.t }}>
                {M(lang, "Alumnos activos", "Active athletes", "Alunos ativos")}
              </span>
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
                {M(lang, "Ver todos →", "See all →", "Ver todos →")}
              </button>
            </div>
            {coachActiveRows.length === 0 ? (
              <div
                style={{
                  padding: "22px 12px",
                  textAlign: "center",
                  ...T.body,
                  color: C.t2,
                  borderRadius: 8,
                  background: C.cardDark,
                  border: `1px dashed ${C.brd}`,
                }}
              >
                {M(
                  lang,
                  "Todavía no tenés alumnos cargados. Agregá alumnos desde Alumnos o con «Crear».",
                  "No athletes yet. Add them from Athletes or «Create».",
                  "Ainda não há alunos. Adicione em Alunos ou em «Criar»."
                )}
              </div>
            ) : isMobile ? (
              <div style={{ maxHeight: 440, overflowY: "auto" }}>
                {coachActiveRows.map(function (row, idx) {
                  var br = pctBracketColor(row.pct);
                  var estadoCol = estadoTextColor(row, lang, C.t2);
                  var status = rowStatusConfig(row, lang, C);
                  return (
                    <div
                      key={String(row.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 14px",
                        boxSizing: "border-box",
                        borderBottom: idx < coachActiveRows.length - 1 ? "1px solid " + C.rowDivider : "none",
                        cursor: typeof onVerPerfil === "function" ? "pointer" : "default",
                      }}
                      onClick={function () {
                        if (typeof onVerPerfil === "function") onVerPerfil(row.id);
                      }}
                      role={typeof onVerPerfil === "function" ? "button" : undefined}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: br + "33",
                          color: C.t,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 13,
                          fontWeight: 700,
                          flexShrink: 0,
                          fontFamily: "DM Sans, system-ui, sans-serif",
                        }}
                      >
                        {row.initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            ...T.body,
                            color: C.t,
                            fontWeight: 600,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {row.name}
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: estadoCol,
                            marginTop: 2,
                            fontFamily: "DM Sans, system-ui, sans-serif",
                          }}
                        >
                          {row.ult}
                        </div>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            width: "fit-content",
                            marginTop: 6,
                            padding: "3px 8px",
                            borderRadius: 999,
                            background: status.bg,
                            color: status.color,
                            fontSize: 11,
                            fontWeight: 800,
                            lineHeight: 1.2,
                            fontFamily: "DM Sans, system-ui, sans-serif",
                          }}
                        >
                          {status.label}
                        </div>
                        <div
                          style={{
                            height: 3,
                            borderRadius: 2,
                            marginTop: 4,
                            background: C.brd,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: row.pct + "%",
                              height: "100%",
                              background: br,
                              borderRadius: 2,
                            }}
                          />
                        </div>
                      </div>
                      <div
                        style={{
                          minWidth: 44,
                          textAlign: "right",
                          fontFamily: "DM Mono, ui-monospace, monospace",
                          fontSize: 14,
                          fontWeight: 700,
                          color: br,
                          flexShrink: 0,
                        }}
                      >
                        {row.pct}%
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ maxHeight: 440, overflowY: "auto" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(180px,1.2fr) 150px 150px 150px 230px",
                    gap: 10,
                    padding: "10px 12px 8px",
                    boxSizing: "border-box",
                    borderBottom: "1px solid " + C.rowDivider,
                  }}
                >
                  {[M(lang, "ALUMNO", "ATHLETE", "ALUNO"), M(lang, "CUMPLIMIENTO", "COMPLIANCE", "CUMPRIMENTO"), M(lang, "ÚLTIMA SESIÓN", "LAST SESSION", "ÚLTIMA SESSÃO")].map((h) => (
                    <div
                      key={h}
                      style={{
                        ...T.tableHeader,
                        color: C.t2,
                        letterSpacing: 0.08,
                      }}
                    >
                      {h}
                    </div>
                  ))}
                  <div
                    style={{
                      ...T.tableHeader,
                      color: C.t2,
                      letterSpacing: 0.08,
                    }}
                  >
                    {M(lang, "ESTADO", "STATUS", "ESTADO")}
                  </div>
                  <div
                    style={{
                      ...T.tableHeader,
                      color: C.t2,
                      letterSpacing: 0.08,
                    }}
                  >
                    {M(lang, "ACCIÃ“N", "ACTION", "AÃ‡ÃƒO")}
                  </div>
                </div>
                {coachActiveRows.map(function (row, idx) {
                  var col = pctColor(row.pct);
                  var status = rowStatusConfig(row, lang, C);
                  return (
                    <div
                      key={String(row.id)}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(180px,1.2fr) 150px 150px 150px 230px",
                        gap: 10,
                        alignItems: "center",
                        padding: NAV_ITEM_PAD,
                        boxSizing: "border-box",
                        borderBottom: idx < coachActiveRows.length - 1 ? "1px solid " + dashBorder : "none",
                        cursor: typeof onVerPerfil === "function" ? "pointer" : "default",
                      }}
                      onClick={function () {
                        if (typeof onVerPerfil === "function") onVerPerfil(row.id);
                      }}
                      role={typeof onVerPerfil === "function" ? "button" : undefined}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            background: col + "22",
                            color: col,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {row.initials}
                        </div>
                        <span
                          style={{
                            ...T.body,
                            color: C.t,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {row.name}
                        </span>
                      </div>
                      <div>
                        <div style={{ ...T.bodySemibold, color: col, fontWeight: 700 }}>
                          {row.pct}%
                        </div>
                        <div
                          style={{
                            height: 7,
                            background: C.brd,
                            borderRadius: 3,
                            marginTop: 5,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: row.pct + "%",
                              height: "100%",
                              background: col,
                              borderRadius: 3,
                            }}
                          />
                        </div>
                      </div>
                      <div style={{ ...T.subtitle, color: sesionColor(row.ult, lang, C.t2) }}>
                        {row.ult}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            maxWidth: 92,
                            padding: "4px 8px",
                            borderRadius: 999,
                            background: status.bg,
                            color: status.color,
                            fontSize: 11,
                            fontWeight: 800,
                            lineHeight: 1.2,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {status.label}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        {[
                          { key: "assign", label: M(lang, "Asignar", "Assign", "Atribuir"), onClick: onRevisar, primary: status.primary },
                          { key: "profile", label: M(lang, "Perfil", "Profile", "Perfil"), onClick: onVerPerfil },
                          { key: "message", label: M(lang, "Mensaje", "Message", "Mensagem"), onClick: onAbrirChatAlumno },
                        ].map(function (action) {
                          return (
                            <button
                              key={action.key}
                              type="button"
                              className="cd-btn"
                              style={{
                                height: 30,
                                padding: "0 8px",
                                borderRadius: 8,
                                border: "1px solid " + (action.primary ? C.blue : dashBorder),
                                background: action.primary ? C.blue : "transparent",
                                color: action.primary ? "#fff" : C.t,
                                fontSize: 11,
                                fontWeight: 800,
                                cursor: typeof action.onClick === "function" ? "pointer" : "default",
                                whiteSpace: "nowrap",
                              }}
                              onClick={function (ev) {
                                ev.stopPropagation();
                                if (typeof action.onClick === "function") action.onClick(row.id);
                              }}
                            >
                              {action.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

    </>
  );
}
