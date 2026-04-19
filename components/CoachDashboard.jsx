import React from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUp,
  Bell,
  CheckCircle,
  Clock,
  Eye,
  FilePlus,
  Info,
  MessageSquare,
  Star,
} from "lucide-react";
import GlobalCreateMenu from "./GlobalCreateMenu.jsx";
import GlobalSearch from "./GlobalSearch.jsx";
import ProgresoView from "./ProgresoView.jsx";
import { coachType as T, coachSpace as S } from "./coachUiScale.js";

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

const WEEK_BARS = [
  { d: "L", p: 100 },
  { d: "M", p: 100 },
  { d: "X", p: 75 },
  { d: "J", p: 100 },
  { d: "V", p: 50 },
  { d: "S", p: 0 },
  { d: "D", p: 0 },
];

const TEAM_MINI = [
  { num: "5", color: C.green, Icon: CheckCircle, label: "Cumpliendo", sub: ">70% sesiones" },
  { num: "2", color: C.yel, Icon: Clock, label: "En progreso", sub: "30% – 69%" },
  { num: "1", color: C.red, Icon: AlertTriangle, label: "Sin actividad", sub: "<30%" },
];

const QUICK = [
  {
    action: "message",
    bg: "#1e3a8a",
    border: "#2563eb33",
    Icon: MessageSquare,
    iconColor: C.blue,
    title: "Enviar mensaje",
    sub: "a tu equipo",
  },
  {
    action: "routine",
    bg: "#2e1065",
    border: "#7c3aed33",
    Icon: FilePlus,
    iconColor: "#a78bfa",
    title: "Crear rutina",
    sub: "personalizada",
  },
  {
    action: "review",
    bg: "#042f2e",
    border: "#0d947533",
    Icon: Eye,
    iconColor: "#34d399",
    title: "Revisar alumnos",
    sub: "que necesitan atención",
  },
];

function pctColor(p) {
  if (p >= 70) return C.green;
  if (p >= 30) return C.yel;
  return C.red;
}

function sesionColor(s) {
  if (s === "Hoy") return C.green;
  if (s === "Sin actividad" || s === "Sin rutina") return C.red;
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

function formatUltimaSesion(lastMs, es, sinRutina) {
  if (sinRutina) return es ? "Sin rutina" : "No routine";
  if (lastMs == null) return es ? "Sin actividad" : "No activity";
  var days = Math.floor((Date.now() - lastMs) / 86400000);
  if (days <= 0) return es ? "Hoy" : "Today";
  if (days === 1) return es ? "Ayer" : "Yesterday";
  if (days < 14) return es ? "Hace " + days + " días" : days + "d ago";
  if (days < 45) return es ? "Hace " + Math.floor(days / 7) + " sem." : Math.floor(days / 7) + "w ago";
  return es ? "Sin actividad" : "No activity";
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
function buildCoachAlerts(alumnos, catFn, sesionesGlobales, progresoGlobal, es) {
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
        badge: es ? "Sin rutina" : "No routine",
        bc: C.yel,
        bd: C.yelDim,
        desc: es ? "No tiene rutina asignada en el sistema." : "No routine assigned.",
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
        badge: es ? "Sin actividad reciente" : "Inactive",
        bc: C.red,
        bd: C.redDim,
        desc: es
          ? "Sin sesiones ni registros en las últimas 3 semanas."
          : "No sessions or logs in the last 3 weeks.",
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
        badge: es ? "Poca actividad" : "Low activity",
        bc: C.yel,
        bd: C.yelDim,
        desc: es
          ? "Sin sesiones ni registros en la última semana."
          : "No sessions or logs in the last week.",
        severity: 2,
      });
    }
  });
  out.sort(function (x, y) {
    if (x.severity !== y.severity) return x.severity - y.severity;
    return String(x.name).localeCompare(String(y.name), es ? "es" : "en");
  });
  return out.slice(0, 12);
}

function buildCoachActiveRows(alumnos, catFn, sesionesGlobales, progresoGlobal, es) {
  if (!Array.isArray(alumnos) || alumnos.length === 0) return [];
  return alumnos
    .map(function (a) {
      var cat = catFn(a);
      var pct = computeCompliancePct(a, cat, sesionesGlobales, progresoGlobal);
      var lastMs = getLastActivityMs(a, sesionesGlobales, progresoGlobal);
      var ult = formatUltimaSesion(lastMs, es, cat === "sin_rutina");
      return {
        id: a.id,
        initials: coachInitials(a),
        name: coachDisplayName(a) || (es ? "Alumno" : "Athlete"),
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
      return String(a.name).localeCompare(String(b.name), es ? "es" : "en");
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
  es = true,
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
      return buildCoachAlerts(alumnos, catFn, sesionesGlobales, progresoGlobal, es);
    },
    [alumnos, catFn, sesionesGlobales, progresoGlobal, es]
  );

  var coachActiveRows = React.useMemo(
    function () {
      return buildCoachActiveRows(alumnos, catFn, sesionesGlobales, progresoGlobal, es);
    },
    [alumnos, catFn, sesionesGlobales, progresoGlobal, es]
  );

  if (activeNav === "progreso") {
    return (
      <ProgresoView
        alumnos={alumnos}
        sesionesGlobales={sesionesGlobales}
        progresoGlobal={progresoGlobal}
        rutinasSBEntrenador={rutinasSBEntrenador}
        allEx={allEx}
        es={es}
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
        .cd-qcard { transition: transform 0.12s; }
        .cd-qcard:hover { transform: scale(1.03); }
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
              Buenas noches, Entrenador
            </h2>
            <p style={{ ...T.screenSubtitle, color: C.t2, margin: "6px 0 0 0" }}>
              Acá tenés el resumen de tu equipo
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <div
              style={{
                position: "relative",
                flex: 1,
                minWidth: 0,
                maxWidth: 440,
              }}
            >
              <GlobalSearch
                alumnos={globalSearchData.alumnos}
                rutinas={globalSearchData.rutinas}
                ejercicios={globalSearchData.ejercicios}
                sesiones={globalSearchData.sesiones}
                onNavigate={onGlobalSearchNavigate}
                placeholder="Buscar alumno, rutina, ejercicio..."
              />
            </div>
            <button
              type="button"
              style={{
                width: 36,
                height: 36,
                background: C.card,
                border: `1px solid ${C.brd}`,
                borderRadius: 7,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                position: "relative",
              }}
            >
              <Bell size={17} color="#94a3b8" strokeWidth={2} />
              <span
                style={{
                  position: "absolute",
                  top: 5,
                  right: 6,
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: C.red,
                  border: "1px solid #0d0d15",
                  boxSizing: "border-box",
                }}
              />
            </button>
            <GlobalCreateMenu
              onNuevoAlumno={onNuevoAlumno}
              onNuevaRutina={onNuevaRutina}
              onNuevoEjercicio={onNuevoEjercicio}
              alwaysShowDropdown={true}
              showChevron={false}
              plusSize={15}
              label="CREAR"
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
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 260px)", gap: S.gridGap, alignItems: "start" }}>
            <div
              style={{
                background: C.card,
                border: `1px solid ${C.brd}`,
                borderRadius: 12,
                padding: S.cardPadding,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: S.blockGap }}>
                <Info size={16} color={C.t2} strokeWidth={2} />
                <span style={{ ...T.cardTitleSemibold, color: C.t }}>
                  Cumplimiento semanal
                </span>
              </div>
              <div style={{ ...T.numberHero, color: C.t }}>
                16 / 24
              </div>
              <div style={{ ...T.subtitle, color: C.t2, marginTop: 6 }}>
                sesiones completadas
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
                Quedan 2 días para completar
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
                  {WEEK_BARS.map((row) => (
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

            <div style={{ display: "flex", flexDirection: "column", gap: S.gridGap, minWidth: 0 }}>
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
                    Equipo de un vistazo
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
                  >
                    Ver todo →
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {TEAM_MINI.map(({ num, color, Icon: Mi, label, sub }) => (
                    <div
                      key={label}
                      style={{
                        background: C.cardDark,
                        border: `1px solid ${C.brd}`,
                        borderRadius: 8,
                        padding: "10px 8px",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ ...T.numberStat, color: C.t }}>{num}</div>
                      <Mi
                        size={16}
                        color={color}
                        strokeWidth={2}
                        style={{ display: "block", margin: "6px auto 0 auto" }}
                      />
                      <div style={{ ...T.bodySemibold, color: C.t2, marginTop: 6 }}>
                        {label}
                      </div>
                      <div style={{ ...T.meta, color: C.t2, marginTop: 4 }}>
                        {sub}
                      </div>
                    </div>
                  ))}
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
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: S.blockGap }}>
                  <Info size={16} color={C.t2} strokeWidth={2} />
                  <span style={{ ...T.cardTitleSemibold, color: C.t }}>
                    Tu rendimiento
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
                      +8 pts vs semana pasada
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
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AlertCircle size={17} color={C.yel} strokeWidth={2} />
                <span style={{ ...T.cardTitleSemibold, color: C.t }}>
                  Alertas inteligentes
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
                Ver todas →
              </button>
            </div>
            {coachAlertsReal.length === 0 ? (
              <div
                style={{
                  padding: "22px 16px",
                  textAlign: "center",
                  borderRadius: 9,
                  background: C.cardDark,
                  border: `1px dashed ${C.brd}`,
                  ...T.body,
                  color: C.t2,
                }}
              >
                {es
                  ? "No hay alertas por ahora. Cuando un alumno necesite atención (sin rutina, inactividad o poca actividad semanal), aparecerá acá."
                  : "No alerts right now. When an athlete needs attention, it will show here."}
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
                          REVISAR
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
                          VER PERFIL
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
              ACCIONES RÁPIDAS
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 11 }}>
              {QUICK.map(({ action, bg, border, Icon: Qi, iconColor, title, sub }) => (
                <div
                  key={title}
                  role="button"
                  tabIndex={0}
                  className="cd-qcard"
                  style={{
                    background: bg,
                    border: `1px solid ${border}`,
                    borderRadius: 10,
                    padding: 15,
                    cursor: "pointer",
                  }}
                  onClick={function () {
                    runQuick(action);
                  }}
                  onKeyDown={function (ev) {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      runQuick(action);
                    }
                  }}
                >
                  <Qi size={22} color={iconColor} strokeWidth={2} />
                  <p style={{ ...T.bodyLg, color: "#fff", margin: "8px 0 0 0" }}>
                    {title}
                  </p>
                  <small
                    style={{
                      ...T.subtitle,
                      color: "#94a3b8",
                      display: "block",
                      marginTop: 4,
                    }}
                  >
                    {sub}
                  </small>
                </div>
              ))}
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
                Alumnos activos
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
                Ver todos →
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
                {es
                  ? "Todavía no tenés alumnos cargados. Agregá alumnos desde Alumnos o con «Crear»."
                  : "No athletes yet. Add them from Athletes or «Create»."}
              </div>
            ) : (
              <div style={{ maxHeight: 440, overflowY: "auto" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 165px 132px",
                    gap: 10,
                    paddingBottom: 8,
                    borderBottom: `1px solid #1e1e2e33`,
                  }}
                >
                  {["ALUMNO", "CUMPLIMIENTO", "ÚLTIMA SESIÓN"].map((h) => (
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
                        padding: "9px 0",
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
                      <div style={{ ...T.subtitle, color: sesionColor(row.ult) }}>
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
