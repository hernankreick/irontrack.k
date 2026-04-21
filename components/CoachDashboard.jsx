import React from "react";
import {
  AlertCircle,
  ArrowRight,
  ArrowUp,
  Eye,
  FilePlus,
  Info,
  MessageSquare,
  Star,
} from "lucide-react";
import GlobalCreateMenu from "./GlobalCreateMenu.jsx";
import GlobalSearch from "./GlobalSearch.jsx";
import CoachNotificationCenter from "./CoachNotificationCenter.jsx";
import ProgresoView from "./ProgresoView.jsx";
import { coachType as T, coachSpace as S } from "./coachUiScale.js";
import { irontrackMsg as M, localeForSort } from "../lib/irontrackMsg.js";

const C = {
  card: "#12121a",
  cardDark: "#0d0d15",
  brd: "#1e1e2e",
  t: "#ffffff",
  t2: "#71717a",
  blue: "#3b82f6",
  green: "#22c55e",
  greenDim: "#052e16",
  yel: "#eab308",
  yelDim: "#422006",
  red: "#ef4444",
  redDim: "#450a0a",
};

/** Padding/gap base compartidos con `navItemStyle` (tablas, listas). */
export const NAV_ITEM_PAD = "10px 12px";

/** Estilo unificado para filas tipo nav (icono + texto) dentro del dashboard */
export function navItemStyle(isActive) {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: NAV_ITEM_PAD,
    borderRadius: 8,
    cursor: "pointer",
    backgroundColor: isActive ? "#1E3A5F" : "transparent",
    color: isActive ? "#3B82F6" : "#94A3B8",
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
const QUICK_VISUAL = {
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
  },
};

function buildQuickActions(lang) {
  var v = QUICK_VISUAL;
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
  if (p >= 70) return C.green;
  if (p >= 30) return C.yel;
  return C.red;
}

/** Color del % en lista mobile: menor a 30 rojo, 30–79 ámbar, 80+ verde */
function pctBracketColor(p) {
  if (p < 30) return "#EF4444";
  if (p < 80) return "#F59E0B";
  return "#22C55E";
}

function estadoTextColor(row, lang) {
  if (row.cat === "sin_rutina") return "#EF4444";
  if (row.cat === "inactivo") return "#F59E0B";
  return sesionColor(row.ult, lang);
}

function sesionColor(s, lang) {
  if (s == null || s === "") return C.t2;
  var today = M(lang, "Hoy", "Today", "Hoje");
  var noAct = M(lang, "Sin actividad", "No activity", "Sem atividade");
  var noRut = M(lang, "Sin rutina", "No routine", "Sem rotina");
  if (s === today) return C.green;
  if (s === noAct || s === noRut) return C.red;
  return C.t2;
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

/**
 * Alertas derivadas solo de datos reales (sin inventar alumnos).
 * Prioridad: sin rutina > inactivo > poca actividad en la semana (con rutina).
 */
function buildCoachAlerts(alumnos, catFn, sesionesGlobales, progresoGlobal, lang) {
  if (!Array.isArray(alumnos) || alumnos.length === 0) return [];
  var ses = sesionesGlobales || [];
  var out = [];
  var now = Date.now();
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
        bc: C.yel,
        bd: C.yelDim,
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
        bc: C.red,
        bd: C.redDim,
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
        bc: C.yel,
        bd: C.yelDim,
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
}) {
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
      return buildCoachAlerts(alumnos, catFn, sesionesGlobales, progresoGlobal, lang);
    },
    [alumnos, catFn, sesionesGlobales, progresoGlobal, lang]
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
      return buildQuickActions(lang);
    },
    [lang]
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

  /** Resumen stats (mock alineado al dashboard) — solo layout mobile vs desktop. */
  var sesionesCompletadas = 16;
  var sesionesTotales = 24;
  var pctSemana =
    sesionesTotales > 0 ? Math.round((sesionesCompletadas / sesionesTotales) * 100) : 0;
  var rendimientoScore = 72;
  var rendimientoDeltaPts = 8;

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
      />
    );
  }

  function runQuick(action) {
    if (action === "message" && typeof onEnviarMensaje === "function") onEnviarMensaje();
    else if (action === "routine" && typeof onCrearRutina === "function") onCrearRutina();
    else if (action === "review" && typeof onRevisarAlumnos === "function") onRevisarAlumnos();
  }

  return (
    <>
      <style>{`
        .cd-quick-card {
          --cd-q-sh: 0 6px 28px rgba(0,0,0,0.4);
          --cd-q-sh-h: 0 16px 40px rgba(0,0,0,0.45);
          transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
          transform: translateY(0);
        }
        .cd-quick-card:hover {
          transform: translateY(-5px);
          box-shadow: var(--cd-q-sh-h) !important;
          border-color: rgba(255,255,255,0.16) !important;
        }
        .cd-quick-card:focus-visible {
          outline: 2px solid rgba(59,130,246,0.7);
          outline-offset: 2px;
        }
        .cd-quick-card .cd-quick-cta { transition: color 0.2s ease; }
        .cd-quick-card:hover .cd-quick-cta { color: rgba(255,255,255,0.95) !important; }
        .cd-quick-card .cd-quick-cta svg { transition: transform 0.2s ease; }
        .cd-quick-card:hover .cd-quick-cta svg { transform: translateX(3px); }
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
              {M(lang, ", Entrenador", ", Coach", ", Treinador")}
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
            gap: S.pageGap,
            padding: S.pagePadding,
          }}
        >
          {isMobile ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                alignItems: "stretch",
              }}
            >
              <div
                style={{
                  background: "#111827",
                  border: "1px solid #1A2535",
                  borderRadius: 14,
                  padding: 14,
                  minWidth: 0,
                  boxSizing: "border-box",
                  borderLeft: "3px solid #2563EB",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <span style={{ ...T.labelMd, color: "#9CA3AF" }}>{M(lang, "Esta semana", "This week", "Esta semana")}</span>
                <div
                  style={{
                    ...T.numberStat,
                    color: "#F9FAFB",
                    marginTop: 6,
                    letterSpacing: -0.02,
                  }}
                >
                  {sesionesCompletadas}/{sesionesTotales}
                </div>
                <div style={{ ...T.subtitle, color: "#9CA3AF", marginTop: 4 }}>
                  {M(lang, "sesiones completadas", "sessions completed", "sessões concluídas")}
                </div>
                <div style={{ flex: 1, minHeight: S.blockGap }} />
                <div
                  style={{
                    height: 6,
                    background: "#1A2535",
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
                  background: "#111827",
                  border: "1px solid #1A2535",
                  borderRadius: 14,
                  padding: 14,
                  minWidth: 0,
                  boxSizing: "border-box",
                  borderLeft: "3px solid #22C55E",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <span style={{ ...T.labelMd, color: "#9CA3AF" }}>{M(lang, "Rendimiento", "Performance", "Desempenho")}</span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                  <span style={{ ...T.numberStat, color: "#F9FAFB" }}>{rendimientoScore}</span>
                  <span style={{ ...T.cardTitleSemibold, color: "#9CA3AF", fontSize: 15 }}>/100</span>
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
                    background: "#1A2535",
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
                gridTemplateColumns: "minmax(0, 1fr) minmax(0, 280px)",
                gap: S.gridGap,
                alignItems: "stretch",
              }}
            >
              <div
                style={{
                  background: C.card,
                  border: `1px solid ${C.brd}`,
                  borderRadius: 12,
                  padding: S.cardPadding,
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
                <div style={{ ...T.numberHero, color: C.t }}>
                  16 / 24
                </div>
                <div style={{ ...T.subtitle, color: C.t2, marginTop: 6 }}>
                  {M(lang, "sesiones completadas", "sessions completed", "sessões concluídas")}
                </div>
                <div
                  style={{
                    marginTop: S.blockGap,
                    display: "inline-block",
                    background: C.greenDim,
                    color: C.green,
                    borderRadius: 99,
                    padding: "5px 12px",
                    ...T.bodySemibold,
                  }}
                >
                  {M(lang, "Quedan 2 días para completar", "2 days left to complete", "Faltam 2 dias para concluir")}
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
                    {weekBars.map((row) => (
                      <div
                        key={row.d}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 6,
                        }}
                      >
                        <span
                          style={{
                            ...T.labelMd,
                            color: C.t2,
                            width: 15,
                            fontFamily: "ui-monospace, monospace",
                          }}
                        >
                          {row.d}
                        </span>
                        <div
                          style={{
                            flex: 1,
                            height: 7,
                            background: C.brd,
                            borderRadius: 3,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: row.p + "%",
                              height: "100%",
                              background: row.p > 0 ? C.blue : C.brd,
                              borderRadius: 3,
                            }}
                          />
                        </div>
                        <span
                          style={{
                            ...T.labelMd,
                            color: C.t2,
                            width: 34,
                            textAlign: "right",
                          }}
                        >
                          {row.p}%
                        </span>
                      </div>
                    ))}
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
                        strokeDashoffset={60.32}
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
                      67%
                    </div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: C.card,
                  border: `1px solid ${C.brd}`,
                  borderRadius: 12,
                  padding: S.cardPadding,
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
                        72
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
                      +8 {M(lang, "pts vs semana pasada", "pts vs last week", "pts vs semana passada")}
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
                        strokeDashoffset={40.46}
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
                      72%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div
            style={{
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
                          <div style={{ ...T.bodyLg, color: "#fff" }}>{a.name}</div>
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
                            color: a.bc === C.yel ? "#0a0a0f" : "#fff",
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
                color: C.t2,
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
                      minHeight: 168,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "stretch",
                      padding: "22px 20px 18px",
                      borderRadius: 16,
                      cursor: "pointer",
                      boxSizing: "border-box",
                      background: item.gradient,
                      border: "1px solid " + item.border,
                      boxShadow: item.shadow,
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
                        borderRadius: "50%",
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: item.orbBg,
                        border: "1px solid " + item.orbBorder,
                        boxShadow: item.orbShadow,
                      }}
                    >
                      <Qi size={24} color={item.iconColor} strokeWidth={2.1} />
                    </div>
                    <p
                      style={{
                        margin: "16px 0 0 0",
                        fontSize: 17,
                        fontWeight: 700,
                        lineHeight: 1.25,
                        letterSpacing: -0.02,
                        color: "#fff",
                      }}
                    >
                      {item.title}
                    </p>
                    <p
                      style={{
                        margin: "8px 0 0 0",
                        fontSize: 14,
                        fontWeight: 500,
                        lineHeight: 1.45,
                        color: "rgba(255,255,255,0.72)",
                        maxWidth: "100%",
                      }}
                    >
                      {item.sub}
                    </p>
                    <div style={{ flex: 1, minHeight: 8 }} />
                    <div
                      className="cd-quick-cta"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginTop: 18,
                        paddingTop: 14,
                        borderTop: "1px solid rgba(255,255,255,0.1)",
                        fontSize: 13,
                        fontWeight: 600,
                        letterSpacing: 0.02,
                        color: "rgba(255,255,255,0.58)",
                      }}
                    >
                      <span>{cta}</span>
                      <ArrowRight size={18} color="currentColor" strokeWidth={2.25} style={{ flexShrink: 0 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            style={{
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
                  var estadoCol = estadoTextColor(row, lang);
                  return (
                    <div
                      key={String(row.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 14px",
                        boxSizing: "border-box",
                        borderBottom: idx < coachActiveRows.length - 1 ? "1px solid #1e1e2e33" : "none",
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
                          color: "#F9FAFB",
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
                    gridTemplateColumns: "1fr 165px 132px",
                    gap: 10,
                    padding: "10px 12px 8px",
                    boxSizing: "border-box",
                    borderBottom: `1px solid #1e1e2e33`,
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
                </div>
                {coachActiveRows.map(function (row, idx) {
                  var col = pctColor(row.pct);
                  return (
                    <div
                      key={String(row.id)}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 165px 132px",
                        gap: 10,
                        alignItems: "center",
                        padding: NAV_ITEM_PAD,
                        boxSizing: "border-box",
                        borderBottom: idx < coachActiveRows.length - 1 ? "1px solid #1e1e2e33" : "none",
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
                      <div style={{ ...T.subtitle, color: sesionColor(row.ult, lang) }}>
                        {row.ult}
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
