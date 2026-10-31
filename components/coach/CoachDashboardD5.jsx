import React from "react";
import { AlertCircle, BarChart3, CheckCircle2, ChevronRight, ClipboardList, Clock3, Search, Target, UserPlus, Users } from "lucide-react";
import GlobalSearch from "../GlobalSearch.jsx";
import { coachFirstNameFromFullName } from "../coachUiScale.js";

/**
 * Dashboard del entrenador (D5, rediseno aprobado). Presentacion pura: recibe el modelo de coachDashboardModelo.js (metricas reales de
 * E1/E2, D3 y D4; nada se inventa aqui) y los handlers de navegacion de D4 (components/coach/coachDashboardNav.js, via App.jsx).
 *
 * Jerarquia movil: encabezado compacto -> resumen del equipo (4 datos) -> requieren seguimiento -> actividad reciente -> acciones rapidas.
 * Escritorio (>= 1024 px): resumen en una fila; seguimiento y actividad lado a lado; acciones en una fila.
 */

export function paletaD5(dark) {
  return dark
    ? { bg: "#0A0F1A", card: "#0D1424", soft: "#101A2D", brd: "rgba(148,163,184,0.18)", t: "#F8FAFC", mut: "#94A3B8", blue: "#3B82F6", blueTxt: "#93C5FD", blueBg: "rgba(59,130,246,0.16)", green: "#22C55E", greenBg: "rgba(34,197,94,0.14)", yel: "#EAB308", yelBg: "rgba(234,179,8,0.14)", red: "#F87171", redBg: "rgba(239,68,68,0.14)", neuBg: "rgba(148,163,184,0.14)" }
    : { bg: "#F1F5F9", card: "#FFFFFF", soft: "#F8FAFC", brd: "#E2E8F0", t: "#0F172A", mut: "#475569", blue: "#2563EB", blueTxt: "#1D4ED8", blueBg: "rgba(37,99,235,0.10)", green: "#15803D", greenBg: "rgba(22,163,74,0.12)", yel: "#A16207", yelBg: "rgba(202,138,4,0.14)", red: "#B91C1C", redBg: "rgba(220,38,38,0.10)", neuBg: "rgba(100,116,139,0.12)" };
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** «Sábado 31 de octubre»: fecha local, solo la primera letra en mayuscula. */
export function fechaLargaD5(d) { var t = DIAS[d.getDay()] + " " + d.getDate() + " de " + MESES[d.getMonth()]; return t.charAt(0).toUpperCase() + t.slice(1); }
function fechaDia(dia) { var d = new Date(dia * 86400000); return d.getUTCDate() + "/" + (d.getUTCMonth() + 1); }
function hace(n) { return n <= 0 ? "Hoy" : n === 1 ? "Ayer" : "Hace " + n + " días"; }
function iniciales(nombre) {
  return String(nombre || "?").split(/\s+/).map(function (p) { return p.charAt(0); }).join("").slice(0, 2).toUpperCase();
}
function nombreDe(a) { var n = String((a && a.nombre) || "").trim(); return n || String((a && a.email) || "Alumno"); }
function useEsEscritorio() {
  var _s = React.useState(function () { return typeof window !== "undefined" && window.innerWidth >= 1024; });
  React.useEffect(function () {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    var mq = window.matchMedia("(min-width: 1024px)");
    function u() { _s[1](mq.matches); }
    u();
    mq.addEventListener("change", u);
    return function () { mq.removeEventListener("change", u); };
  }, []);
  return _s[0];
}

function Card({ P, children, style, qa, titulo, accion }) {
  return (
    <section data-qa={qa} aria-label={titulo || undefined} style={Object.assign({ background: P.card, border: "1px solid " + P.brd, borderRadius: 16, padding: 16, minWidth: 0, boxSizing: "border-box" }, style || {})}>
      {titulo ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10, minHeight: accion ? 44 : undefined }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 750, color: P.t, letterSpacing: -0.1 }}>{titulo}</h2>
          {accion}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function Stat({ P, label, value, sub, subColor, qa, onClick, tono }) {
  var color = tono === "alerta" ? P.red : P.t;
  var cuerpo = (
    <>
      <span style={{ fontSize: 12, fontWeight: 650, color: P.mut, letterSpacing: 0.2 }}>{label}</span>
      <span style={{ fontSize: 26, lineHeight: 1.1, fontWeight: 800, color: color, fontVariantNumeric: "tabular-nums" }}>{value}</span>
      {sub ? <span style={{ fontSize: 12, fontWeight: 600, color: subColor || P.mut, lineHeight: 1.25 }}>{sub}</span> : null}
    </>
  );
  var base = { display: "flex", flexDirection: "column", gap: 3, minWidth: 0, minHeight: 76, padding: "10px 12px", borderRadius: 12, background: P.soft, border: "1px solid " + P.brd, boxSizing: "border-box", textAlign: "left", fontFamily: "inherit" };
  if (typeof onClick === "function") {
    return <button type="button" data-qa={qa} onClick={onClick} style={Object.assign({}, base, { cursor: "pointer" })}>{cuerpo}</button>;
  }
  return <div data-qa={qa} style={base}>{cuerpo}</div>;
}

function FilaGrupo({ P, Icon, color, bg, titulo, nombres, n, onClick, qa }) {
  return (
    <button type="button" data-qa={qa} onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 56, padding: "8px 10px", border: "1px solid " + P.brd, borderRadius: 12, background: P.soft, color: P.t, cursor: "pointer", textAlign: "left", fontFamily: "inherit", boxSizing: "border-box" }}>
      <span aria-hidden="true" style={{ width: 36, height: 36, flex: "none", borderRadius: 10, background: bg, color: color, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={18} strokeWidth={2.25} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 15, fontWeight: 700 }}>{titulo}</span>
        <span style={{ display: "block", fontSize: 13, color: P.mut, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nombres}</span>
      </span>
      <span style={{ minWidth: 28, height: 28, padding: "0 8px", borderRadius: 999, background: bg, color: color, fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }}>{n}</span>
      <ChevronRight size={18} color={P.mut} aria-hidden="true" />
    </button>
  );
}

function pillEstado(P, fila) {
  if (!fila) return null;
  if (fila.seguimiento === "baja") return { t: "Baja actividad", c: P.yel, bg: P.yelBg };
  if (fila.seguimiento === "rutina_nueva") return { t: "Rutina nueva", c: P.blueTxt, bg: P.blueBg };
  if (fila.planState !== "ok") return { t: fila.cat === "sin_rutina" ? "Sin rutina" : "Sin plan", c: P.mut, bg: P.neuBg };
  return { t: "Al día", c: P.green, bg: P.greenBg };
}

/**
 * Props: modelo (coachDashboardModelo), darkMode, coachName, ahora?, campana (nodo: CoachNotificationCenter real), globalSearchData,
 * onGlobalSearchNavigate, alumnosRefreshFailed, maxRecientes?, y los handlers: onVerSinRutina / onVerInactivos / onVerBajaActividad
 * (si faltan, onRevisarAlumnos), onVerPerfil, onRevisarAlumnos, onNuevoAlumno, onNuevaRutina, onIrProgreso.
 */
export default function CoachDashboardD5(props) {
  var m = props.modelo;
  var P = paletaD5(props.darkMode !== false);
  var desk = useEsEscritorio();
  var _b = React.useState(false);
  var buscarAbierto = _b[0];
  var setBuscarAbierto = _b[1];
  var e = m.equipo;
  var cargando = m.estado === "cargando";
  var sinAlumnos = m.estado === "sin_alumnos";
  var conError = m.estado === "error";
  var sinLista = sinAlumnos || conError;
  var seg = m.seguimiento;
  var periodo = "lun " + fechaDia(m.semanas.actual.desde) + " – hoy";
  var dash = "—";
  var primerNombre = coachFirstNameFromFullName(props.coachName);
  var gsd = props.globalSearchData || { alumnos: [], rutinas: [], ejercicios: [], sesiones: [] };
  var irSinRutina = typeof props.onVerSinRutina === "function" ? props.onVerSinRutina : props.onRevisarAlumnos;
  var irInactivos = typeof props.onVerInactivos === "function" ? props.onVerInactivos : props.onRevisarAlumnos;
  var irBaja = typeof props.onVerBajaActividad === "function" ? props.onVerBajaActividad : props.onRevisarAlumnos;

  var adhSub = cargando ? "Cargando…"
    : e.adherenciaPct == null ? "Sin plan semanal"
      : e.adherenciaDelta == null ? (e.motivoSinDelta === "historial_incompleto" ? "Sin comparación (historial incompleto)" : "Sin comparación")
        : (e.adherenciaDelta >= 0 ? "+" : "") + e.adherenciaDelta + " pts vs sem. pasada";
  var adhSubColor = e.adherenciaDelta == null ? P.mut : e.adherenciaDelta >= 0 ? P.green : P.red;

  var irSeguimiento = function () {
    var el = typeof document !== "undefined" && document.getElementById("d5-seguimiento");
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  var buscador = (
    <div className="coach-search-wrap" style={{ width: "100%", minWidth: 0 }}>
      <GlobalSearch
        alumnos={gsd.alumnos}
        rutinas={gsd.rutinas}
        ejercicios={gsd.ejercicios}
        sesiones={gsd.sesiones}
        onNavigate={props.onGlobalSearchNavigate}
        placeholder={desk ? "Buscar alumno, rutina, ejercicio..." : "Buscar…"}
        compactInputEnd
        darkMode={props.darkMode !== false}
      />
    </div>
  );

  var encabezado = (
    <header data-qa="d5-encabezado" style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: desk ? 26 : 22, lineHeight: 1.15, fontWeight: 800, color: P.t, letterSpacing: -0.3 }}>Hola, {primerNombre || "Entrenador"}</h1>
        <p data-qa="d5-fecha" style={{ margin: "2px 0 0", fontSize: 13, color: P.mut }}>{fechaLargaD5(props.ahora || new Date())}</p>
      </div>
      {desk ? <div data-qa="d5-buscar-inline" style={{ flex: "0 1 360px", minWidth: 0 }}>{buscador}</div> : (
        <button type="button" aria-label="Buscar" aria-expanded={buscarAbierto} data-qa="d5-buscar" onClick={function () { setBuscarAbierto(!buscarAbierto); }} style={{ width: 44, height: 44, flex: "none", borderRadius: 12, border: "1px solid " + P.brd, background: P.card, color: P.t, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Search size={20} aria-hidden="true" />
        </button>
      )}
      {props.campana ? <div data-qa="d5-campana" style={{ flex: "none", display: "flex", alignItems: "center" }}>{props.campana}</div> : null}
    </header>
  );
  var buscadorMovil = !desk && buscarAbierto ? <div data-qa="d5-buscar-panel" style={{ minWidth: 0 }}>{buscador}</div> : null;

  var avisoActualizacion = props.alumnosRefreshFailed && !sinLista ? (
    <div role="status" data-qa="d5-actualizacion-fallida" style={{ fontSize: 13, lineHeight: 1.35, color: P.mut, background: P.neuBg, border: "1px solid " + P.brd, borderRadius: 12, padding: "10px 12px" }}>
      No pudimos actualizar tus alumnos. Reintentamos automáticamente; mostramos los últimos datos.
    </div>
  ) : null;
  var aviso = !sinLista && !cargando && e.historialIncompleto ? (
    <div role="status" data-qa="d5-historial-incompleto" style={{ fontSize: 13, lineHeight: 1.35, color: P.yel, background: P.yelBg, border: "1px solid " + P.brd, borderRadius: 12, padding: "10px 12px" }}>
      Historial incompleto: puede faltar actividad antigua y las comparaciones con la semana pasada se desactivan.
    </div>
  ) : null;

  var resumen = sinAlumnos ? (
    <Card P={P} qa="d5-sin-alumnos" titulo="Tu equipo">
      <p style={{ margin: "0 0 12px", fontSize: 14, color: P.mut, lineHeight: 1.4 }}>Todavía no tenés alumnos. Cuando agregues el primero, acá vas a ver su actividad y quién necesita seguimiento.</p>
      <button type="button" data-qa="d5-agregar-alumno" onClick={props.onNuevoAlumno} style={{ minHeight: 44, padding: "0 16px", borderRadius: 12, border: "none", background: P.blue, color: "#fff", fontSize: 15, fontWeight: 750, cursor: "pointer", fontFamily: "inherit" }}>Agregar alumno</button>
    </Card>
  ) : conError ? (
    <Card P={P} qa="d5-error" titulo="Tu equipo">
      <p role="alert" style={{ margin: "0 0 12px", fontSize: 14, color: P.mut, lineHeight: 1.4 }}>No pudimos cargar tus alumnos. Reintentá desde Alumnos.</p>
      <button type="button" data-qa="d5-error-alumnos" onClick={props.onRevisarAlumnos} style={{ minHeight: 44, padding: "0 16px", borderRadius: 12, border: "none", background: P.blue, color: "#fff", fontSize: 15, fontWeight: 750, cursor: "pointer", fontFamily: "inherit" }}>Ir a Alumnos</button>
    </Card>
  ) : (
    <Card P={P} qa="d5-resumen" titulo="Esta semana" accion={<span style={{ fontSize: 12, color: P.mut, fontWeight: 600 }}>{periodo}</span>}>
      <div style={{ display: "grid", gridTemplateColumns: desk ? "repeat(4, minmax(0, 1fr))" : "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        <Stat P={P} qa="d5-stat-total" label="Alumnos" value={cargando ? dash : e.total} />
        <Stat P={P} qa="d5-stat-entrenaron" label="Entrenaron" value={cargando ? dash : e.entrenaronSemana + " / " + e.total} sub={cargando ? "Cargando…" : "con al menos 1 sesión"} />
        <Stat P={P} qa="d5-stat-adherencia" label="Adherencia" value={cargando || e.adherenciaPct == null ? dash : e.adherenciaPct + "%"} sub={adhSub} subColor={adhSubColor} />
        <Stat P={P} qa="d5-stat-seguimiento" label="Seguimiento" value={cargando ? dash : e.requierenSeguimiento} tono={!cargando && e.requierenSeguimiento > 0 ? "alerta" : null}
          sub={cargando ? "Cargando…" : e.requierenSeguimiento > 0 ? "requieren atención" : "nadie por ahora"} onClick={!cargando && e.requierenSeguimiento > 0 ? irSeguimiento : undefined} />
      </div>
    </Card>
  );

  var grupos = [
    { k: "sin_rutina", Icon: Target, c: P.red, bg: P.redBg, t: "Sin rutina", lista: seg.sinRutina, on: irSinRutina },
    { k: "inactivos", Icon: Clock3, c: P.yel, bg: P.yelBg, t: "Inactivos", pre: "Más de 21 días · ", lista: seg.inactivos, on: irInactivos },
    { k: "baja", Icon: AlertCircle, c: P.yel, bg: P.yelBg, t: "Baja actividad", lista: seg.baja, on: irBaja },
  ].filter(function (g) { return g.lista.length > 0; });

  var seguimiento = sinLista ? null : (
    <div id="d5-seguimiento" style={{ scrollMarginTop: 120, minWidth: 0 }}>
      <Card P={P} qa="d5-seguimiento" titulo="Requieren seguimiento">
        {cargando ? (
          <p role="status" style={{ margin: 0, fontSize: 14, color: P.mut }}>Cargando datos del equipo…</p>
        ) : grupos.length === 0 ? (
          <div data-qa="d5-todo-al-dia" style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, color: P.green, fontSize: 14, fontWeight: 650 }}>
            <CheckCircle2 size={20} aria-hidden="true" /> Nadie requiere seguimiento esta semana.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {grupos.map(function (g) {
              return <FilaGrupo key={g.k} qa={"d5-grupo-" + g.k} P={P} Icon={g.Icon} color={g.c} bg={g.bg} titulo={g.t} n={g.lista.length}
                nombres={(g.pre || "") + g.lista.map(nombreDe).join(", ")} onClick={g.on} />;
            })}
          </div>
        )}
      </Card>
    </div>
  );

  var verAlumnos = (
    <button type="button" onClick={props.onRevisarAlumnos} data-qa="d5-ver-alumnos" style={{ minHeight: 44, minWidth: 44, padding: "0 4px", background: "none", border: "none", color: P.blueTxt, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Ver alumnos</button>
  );
  var recientes = sinLista ? null : (
    <Card P={P} qa="d5-recientes" titulo="Actividad reciente" accion={verAlumnos}>
      {cargando ? (
        <p role="status" style={{ margin: 0, fontSize: 14, color: P.mut }}>Cargando…</p>
      ) : m.recientes.length === 0 ? (
        <p style={{ margin: 0, fontSize: 14, color: P.mut, lineHeight: 1.4 }}>Nadie entrenó en los últimos 14 días.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
          {m.recientes.slice(0, props.maxRecientes || 5).map(function (r, i) {
            var pill = pillEstado(P, r.fila);
            return (
              <li key={r.alumno.id} style={{ borderTop: i ? "1px solid " + P.brd : "none" }}>
                <button type="button" data-qa="d5-reciente" data-alumno-id={String(r.alumno.id)} onClick={function () { if (typeof props.onVerPerfil === "function") props.onVerPerfil(r.alumno.id); }} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 56, padding: "6px 0", background: "none", border: "none", color: P.t, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                  <span aria-hidden="true" style={{ width: 36, height: 36, flex: "none", borderRadius: "50%", background: P.blueBg, color: P.blueTxt, fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{iniciales(nombreDe(r.alumno))}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nombreDe(r.alumno)}</span>
                    <span style={{ display: "block", fontSize: 13, color: P.mut }}>{hace(r.haceDias)}{r.fila && r.fila.pct != null ? " · " + r.fila.pct + "% esta semana" : ""}</span>
                  </span>
                  {pill ? <span style={{ flex: "none", fontSize: 12, fontWeight: 750, padding: "4px 8px", borderRadius: 999, color: pill.c, background: pill.bg }}>{pill.t}</span> : null}
                  <ChevronRight size={18} color={P.mut} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );

  var acciones = [
    { k: "nuevo", Icon: UserPlus, t: "Nuevo alumno", on: props.onNuevoAlumno },
    { k: "rutina", Icon: ClipboardList, t: "Crear rutina", on: props.onNuevaRutina },
    { k: "alumnos", Icon: Users, t: "Ver alumnos", on: props.onRevisarAlumnos },
    { k: "progreso", Icon: BarChart3, t: "Progreso", on: props.onIrProgreso },
  ];
  var rapidas = (
    <Card P={P} qa="d5-acciones" titulo="Acciones rápidas">
      <div style={{ display: "grid", gridTemplateColumns: desk ? "repeat(4, minmax(0, 1fr))" : "repeat(2, minmax(0, 1fr))", gap: 8 }}>
        {acciones.map(function (a) {
          return (
            <button key={a.k} type="button" data-qa={"d5-accion-" + a.k} onClick={a.on} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 52, padding: "0 12px", borderRadius: 12, border: "1px solid " + P.brd, background: P.soft, color: P.t, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textAlign: "left", minWidth: 0 }}>
              <a.Icon size={18} color={P.blueTxt} aria-hidden="true" style={{ flex: "none" }} />
              <span style={{ minWidth: 0 }}>{a.t}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );

  return (
    <div data-qa="d5-dashboard" style={{ background: P.bg, color: P.t, minWidth: 0, width: "100%", padding: desk ? "24px 28px 40px" : "16px 16px 32px", boxSizing: "border-box", fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", flexDirection: "column", gap: desk ? 20 : 14 }}>
        {encabezado}
        {buscadorMovil}
        {avisoActualizacion}
        {aviso}
        {resumen}
        {desk && !sinLista ? (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.35fr)", gap: 20, alignItems: "start" }}>
            {seguimiento}
            {recientes}
          </div>
        ) : (
          <>
            {seguimiento}
            {recientes}
          </>
        )}
        {rapidas}
      </div>
    </div>
  );
}
