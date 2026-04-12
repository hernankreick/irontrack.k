import { useMemo } from "react";

const C_TEXT = '#ffffff';
const C_SECONDARY = '#e2e8f0';

const HEADER_BG = '#1f293a';
const CARD_BG_STATS = '#222834';
const CHART_BORDER = '#334155';
const BAR_BLUE = '#3b82f6';
const BADGE_KG_BG = '#374151';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function diasDesde(fecha) {
  if (!fecha) return null;
  return Math.floor((Date.now() - new Date(fecha)) / 86400000);
}

/** Valor y color (semáforo de adherencia) para la tarjeta Última sesión. */
function etiquetaUltimaSesion(dias) {
  if (dias === null) {
    return { v: "Sin registro", col: C_SECONDARY, valueFontSize: 20 };
  }
  if (dias === 0) {
    return { v: "Hoy", col: "#22c55e", valueFontSize: 20 };
  }
  if (dias === 1) {
    return { v: "Ayer", col: "#22c55e", valueFontSize: 20 };
  }
  if (dias >= 2 && dias <= 3) {
    return { v: `Hace ${dias} días`, col: C_TEXT, valueFontSize: 20 };
  }
  if (dias >= 4 && dias <= 6) {
    return { v: `Hace ${dias} días`, col: "#fb923c", valueFontSize: 20 };
  }
  return {
    v: `Inactivo (hace ${dias} días)`,
    col: "#ef4444",
    valueFontSize: 16,
  };
}

function agruparPorSemana(sesiones) {
  const semanas = [0, 0, 0, 0];
  const hoy = Date.now();
  sesiones.forEach(s => {
    const dias = Math.floor((hoy - new Date(s.created_at || s.fecha)) / 86400000);
    const idx  = Math.min(Math.floor(dias / 7), 3);
    const kg = s.sets?.reduce((acc, set) => acc + (parseFloat(set.kg) || 0), 0) || 0;
    semanas[3 - idx] += kg;
  });
  return semanas.map((kg, i) => ({ label: `S${i + 1}`, kg: Math.round(kg) }));
}

function registroDiaYTiempo(r) {
  if (r.created_at) {
    const d = new Date(r.created_at);
    if (!isNaN(d.getTime())) {
      return { dayKey: d.toISOString().slice(0, 10), sortTime: d.getTime() };
    }
  }
  if (r.fecha) {
    const f = String(r.fecha).trim();
    const d = new Date(f);
    if (!isNaN(d.getTime())) {
      return { dayKey: f, sortTime: d.getTime() };
    }
    return { dayKey: f || "__sin_parsear__", sortTime: 0 };
  }
  return { dayKey: "__sin_fecha__", sortTime: 0 };
}

/**
 * Max kg en la sesión más reciente vs la anterior (mismo ejercicio, filas de progreso).
 * Devuelve la diferencia solo si hubo suba; si no, null.
 */
function sesionDeltaKg(progreso, ejercicioId) {
  const rows = progreso.filter(r => r.ejercicio_id === ejercicioId);
  if (rows.length < 2) return null;

  const grupos = new Map();
  for (const r of rows) {
    const kg = parseFloat(r.kg) || 0;
    const { dayKey, sortTime } = registroDiaYTiempo(r);
    const prev = grupos.get(dayKey) || { maxKg: 0, sortTime: 0 };
    prev.maxKg = Math.max(prev.maxKg, kg);
    prev.sortTime = Math.max(prev.sortTime, sortTime);
    grupos.set(dayKey, prev);
  }

  const ordenados = [...grupos.entries()].sort((a, b) => b[1].sortTime - a[1].sortTime);
  if (ordenados.length < 2) return null;

  const maxUltima = ordenados[0][1].maxKg;
  const maxAnterior = ordenados[1][1].maxKg;
  if (maxUltima > maxAnterior) return maxUltima - maxAnterior;
  return null;
}

function fmtDeltaKg(x) {
  const r = Math.round(x * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

function topEjercicios(progreso, customEx = []) {
  const map = {};
  progreso.forEach(r => {
    const id = r.ejercicio_id;
    const kg = parseFloat(r.kg) || 0;
    const reps = parseInt(r.reps) || 0;
    const sets = parseInt(r.sets) || 0;
    if (!map[id]) map[id] = { id, kg, reps, sets, fecha: r.fecha };
    if (kg > map[id].kg) { map[id].kg = kg; map[id].reps = reps; map[id].sets = sets; }
  });
  return Object.values(map)
    .sort((a, b) => b.kg - a.kg)
    .slice(0, 4)
    .map(e => ({
      ...e,
      nombre: (() => {
        const c = customEx.find(x => x.id === e.id);
        const n = c && (c.name || c.nombre);
        return (n && String(n).trim()) || `Ejercicio ${String(e.id).slice(-4)}`;
      })(),
      deltaSesion: sesionDeltaKg(progreso, e.id),
    }));
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function Divider() {
  return <div style={{ height: "0.5px", background: "#16191e", margin: "0 0 24px" }} />;
}

function SecLabel({ children, style }) {
  return (
    <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: ".12em", color: C_SECONDARY,
      textTransform: "uppercase", margin: "0 0 12px", ...style }}>
      {children}
    </p>
  );
}

function BarrasSemanas({ semanas }) {
  const max = Math.max(...semanas.map(s => s.kg), 1);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 8, height: 56 }}>
      {semanas.map((s, i) => {
        const h = Math.max(Math.round((s.kg / max) * 44), s.kg > 0 ? 4 : 2);
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 9, color: C_TEXT, fontWeight: 700 }}>
              {s.kg > 0 ? `${s.kg}` : "—"}
            </span>
            <div style={{
              width: "100%",
              height: h,
              borderRadius: "3px 3px 0 0",
              background: BAR_BLUE,
              opacity: s.kg > 0 ? 1 : 0.35,
            }} />
            <span style={{ fontSize: 9, color: C_SECONDARY, fontWeight: 600 }}>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function FilaEjercicio({ ej, index }) {
  const alt = index % 2 === 0;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 10,
        marginBottom: 8,
        background: alt ? CARD_BG_STATS : "#1b2130",
        border: "1px solid #2d3748",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, color: C_SECONDARY, fontWeight: 700, margin: "0 0 4px" }}>
          {ej.nombre}
        </p>
        <span style={{ fontSize: 11, color: C_SECONDARY, fontWeight: 600, opacity: 0.9 }}>
          {ej.sets > 0 ? `${ej.sets}×${ej.reps}` : "—"}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 8,
          flexShrink: 0,
          marginLeft: "auto",
        }}
      >
        {typeof ej.deltaSesion === "number" && ej.deltaSesion > 0 && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: "#22c55e",
              whiteSpace: "nowrap",
            }}
          >
            +{fmtDeltaKg(ej.deltaSesion)}kg
          </span>
        )}
        <span
          style={{
            background: BADGE_KG_BG,
            color: C_TEXT,
            fontWeight: 800,
            fontSize: 13,
            padding: "6px 12px",
            borderRadius: 8,
            letterSpacing: "0.02em",
          }}
        >
          {ej.kg}kg
        </span>
      </div>
    </div>
  );
}

function UltimaSesion({ sesion }) {
  if (!sesion) return null;
  const dias = diasDesde(sesion.created_at || sesion.fecha);
  const sets  = sesion.sets || [];

  return (
    <div style={{ marginBottom: 28 }}>
      <SecLabel>Última sesión</SecLabel>
      <p style={{ fontSize: 10, color: C_SECONDARY, fontWeight: 600, margin: "0 0 8px" }}>
        {dias === 0 ? "Hoy" : dias === 1 ? "Ayer" : `Hace ${dias} días`}
      </p>
      {sets.slice(0, 4).map((set, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8,
          padding: "6px 0", borderBottom: "0.5px solid #16191e" }}>
          <span style={{ fontSize: 12, color: C_SECONDARY, flex: 1, fontWeight: 600 }}>
            {set.ejercicio || `Set ${i + 1}`}
          </span>
          <span style={{ fontSize: 11, color: C_TEXT, fontWeight: 600 }}>
            {set.sets || set.series}×{set.reps} · {set.kg}kg
          </span>
        </div>
      ))}
      {sets.length === 0 && (
        <p style={{ fontSize: 12, color: C_SECONDARY, fontWeight: 600 }}>Sin datos de sets</p>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function PerfilAlumno({
  alumno,
  sesiones     = [],
  progreso     = [],
  routines     = [],
  customEx     = [],
  onVolver,
  onMensaje,
  onEditarRutina,
}) {
  if (!alumno) return null;

  const nombre      = alumno.nombre || alumno.email || "Alumno";
  const tituloEsEmail = !alumno.nombre && !!alumno.email;
  const emailLine   = alumno.nombre && alumno.email ? alumno.email : null;
  const rutina      = routines[0];
  const rutinaLabel = rutina ? `${rutina.nombre || "Rutina"} · Sem ${rutina.semana_actual || 1} de ${rutina.semanas || 4}` : "Sin rutina asignada";

  const ultimaSesion = [...sesiones].sort(
    (a, b) => new Date(b.created_at || b.fecha) - new Date(a.created_at || a.fecha)
  )[0];

  const dias          = diasDesde(ultimaSesion?.created_at || ultimaSesion?.fecha);
  const semanas       = useMemo(() => agruparPorSemana(sesiones), [sesiones]);
  const ejerciciosClave = useMemo(() => topEjercicios(progreso, customEx), [progreso, customEx]);

  const deltaCarga = (() => {
    if (semanas[3].kg === 0 || semanas[0].kg === 0) return null;
    return Math.round(((semanas[3].kg - semanas[0].kg) / semanas[0].kg) * 100);
  })();

  const ultimaSesionStat = etiquetaUltimaSesion(dias);

  const statsItems = [
    {
      v: ultimaSesionStat.v,
      l: "Última Sesión",
      col: ultimaSesionStat.col,
      valueFontSize: ultimaSesionStat.valueFontSize,
    },
    { v: sesiones.length, l: "sesiones", valueFontSize: 20 },
    {
      v: deltaCarga !== null ? `${deltaCarga > 0 ? "+" : ""}${deltaCarga}%` : "—",
      l: "carga mes",
      col: deltaCarga > 0 ? "#22c55e" : deltaCarga < 0 ? "#ef4444" : C_TEXT,
      valueFontSize: 20,
    },
  ];

  return (
    <div style={{ paddingBottom: 40 }}>

      {/* Header del perfil */}
      <div
        style={{
          background: HEADER_BG,
          borderRadius: 16,
          padding: "20px 20px 22px",
          marginBottom: 20,
          border: "1px solid #334155",
        }}
      >
        <p
          onClick={onVolver}
          style={{
            fontSize: 11,
            color: C_SECONDARY,
            fontWeight: 700,
            margin: "0 0 16px",
            cursor: "pointer",
            letterSpacing: "0.04em",
          }}
        >
          ← Dashboard
        </p>
        <p style={{
          fontSize: 22,
          fontWeight: 800,
          color: C_TEXT,
          margin: "0 0 6px",
          lineHeight: 1.2,
          ...(tituloEsEmail ? { wordBreak: "break-all" } : {}),
        }}>{nombre}</p>
        {emailLine && (
          <p style={{
            fontSize: 13,
            color: C_SECONDARY,
            fontWeight: 700,
            margin: "0 0 10px",
            wordBreak: "break-all",
          }}>
            {emailLine}
          </p>
        )}
        <p style={{
          fontSize: 12,
          color: C_SECONDARY,
          fontWeight: 600,
          margin: 0,
          opacity: 0.95,
        }}>{rutinaLabel}</p>
      </div>

      {/* Stats — tres tarjetas */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        {statsItems.map((st, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              minWidth: 0,
              background: CARD_BG_STATS,
              borderRadius: 12,
              padding: "14px 12px",
              border: "1px solid #2d3748",
            }}
          >
            <p style={{
              fontSize: st.valueFontSize ?? 20,
              fontWeight: 700,
              color: st.col || C_TEXT,
              margin: "0 0 8px",
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
              wordBreak: "break-word",
            }}>
              {st.v}
            </p>
            <p style={{
              fontSize: 9,
              color: C_SECONDARY,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: (st.l === "sesiones" || st.l === "carga mes") ? "uppercase" : "none",
              margin: 0,
              opacity: 0.92,
            }}>{st.l}</p>
          </div>
        ))}
      </div>

      <Divider />

      {/* Carga semanal — contenedor con borde */}
      <div
        style={{
          border: `1px solid ${CHART_BORDER}`,
          borderRadius: 14,
          padding: "16px 16px 12px",
          marginBottom: 24,
          background: "#181c24",
        }}
      >
        <SecLabel style={{ marginTop: 0 }}>Carga semanal</SecLabel>
        <BarrasSemanas semanas={semanas} />
      </div>

      <Divider />

      {ejerciciosClave.length > 0 && (
        <>
          <SecLabel>Ejercicios clave</SecLabel>
          <div style={{ marginBottom: 28 }}>
            {ejerciciosClave.map((e, i) => (
              <FilaEjercicio key={e.id ?? i} ej={e} index={i} />
            ))}
          </div>
          <Divider />
        </>
      )}

      <UltimaSesion sesion={ultimaSesion} />

      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          onClick={() => onEditarRutina?.(alumno)}
          style={btnStyle("transparent", C_SECONDARY, "#475569")}
        >
          Editar rutina
        </button>
        <button
          type="button"
          onClick={() => onMensaje?.(alumno)}
          style={btnStyle("#1d4ed8", C_TEXT, "#1d4ed8")}
        >
          Enviar mensaje
        </button>
      </div>
    </div>
  );
}

function btnStyle(bg, color, border) {
  return {
    flex: 1, background: bg, color, border: `1px solid ${border}`,
    borderRadius: 8, padding: "10px 0", fontSize: 10, fontWeight: 700,
    letterSpacing: ".04em", cursor: "pointer", textTransform: "uppercase",
    fontFamily: "inherit",
  };
}
