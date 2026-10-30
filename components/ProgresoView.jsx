import React, { useEffect, useMemo, useRef, useState } from "react";
import { buildCoachProgresoModel, getRoutineForAlumno, initialsFromName } from "./coachProgresoMetrics.js";
import { coachType as T, coachSpace as S0 } from "./coachUiScale.js";
import ProgressLoadChart from "./progreso/ProgressLoadChart.jsx";
import ProgressLoadControls from "./progreso/ProgressLoadControls.jsx";
import ProgressMovementPatternVolumeCard from "./progreso/ProgressMovementPatternVolumeCard.jsx";
import { PatternDrilldownContext } from "./progreso/ProgressMovementPatternRow.jsx";
import ProgressRecentPrsCard from "./progreso/ProgressRecentPrsCard.jsx";
import ProgressWeeklyVolumeCard from "./progreso/ProgressWeeklyVolumeCard.jsx";
import ProgressHeader from "./progreso/ProgressHeader.jsx";
import ProgressSummaryCards from "./progreso/ProgressSummaryCards.jsx";
import ProgressExercisesCard, { ProgressExerciseList } from "./progreso/ProgressExercisesCard.jsx";
import ProgressTeamSection from "./progreso/ProgressTeamSection.jsx";
import ProgressAlumnoPicker from "./progreso/ProgressAlumnoPicker.jsx";
import ProgressSheet from "./progreso/ProgressSheet.jsx";
import { PeriodSheetContent, periodLabel } from "./progreso/ProgressPeriodPicker.jsx";
import { progresoTone } from "./progreso/progresoTone.js";
import EjercicioHistorialCoach from "./coach/EjercicioHistorialCoach.jsx";
import { useIronTrackI18n } from "../contexts/IronTrackI18nContext.jsx";
import { irontrackMsg as M, localeForSort } from "../lib/irontrackMsg.js";
import { coachThemePalette } from "./coachThemePalette.js";

/** Volumen en kg abreviado tipo SaaS: 12400 → "12.4k kg", 850 → "850 kg" */
function formatWeeklyVolKgAbbrev(v) {
  var n = Number(v) || 0;
  if (n <= 0) return "0";
  if (n >= 1000) {
    var k = n / 1000;
    var s;
    if (k >= 100) {
      s = String(Math.round(k));
    } else {
      s = (Math.round(k * 10) / 10).toFixed(1);
      if (s.slice(-2) === ".0") s = s.slice(0, -2);
    }
    return s + "k kg";
  }
  return Math.round(n) + " kg";
}

/** Texto secundario leaderboard: sesiones completadas vs planificadas (misma ventana que el ranking); aparte, las validadas por el entrenador. */
function rankingSessionsLine(completed, planned, lang, validadas) {
  var c = completed != null ? completed : 0;
  var p = planned != null ? planned : 0;
  if (p <= 0) {
    return M(lang, "Adherencia al plan", "Plan adherence", "Aderência ao plano");
  }
  return (
    c +
    "/" +
    p +
    M(lang, " sesiones completadas", " sessions completed", " sessões concluídas") +
    (validadas > 0 ? M(lang, " · " + validadas + " validadas por vos", " · " + validadas + " validated by you", " · " + validadas + " validadas por você") : "")
  );
}

function useIsUnder768() {
  const [v, setV] = useState(
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(max-width: 767px)").matches
      : false
  );
  useEffect(function () {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    var mq = window.matchMedia("(max-width: 767px)");
    var fn = function () { setV(mq.matches); };
    mq.addEventListener("change", fn);
    return function () { mq.removeEventListener("change", fn); };
  }, []);
  return v;
}

function emptyBox(lang, title, palette) {
  var P = palette || coachThemePalette(true);
  return (
    <div
      style={{
        padding: "24px 16px",
        textAlign: "center",
        color: P.t2,
        border: "1px dashed " + P.brd,
        borderRadius: 12,
        background: P.cardDark,
        ...T.body,
      }}
    >
      {title}
      <div style={{ marginTop: 8, ...T.meta }}>{M(lang, "Sin datos suficientes", "Not enough data", "Dados insuficientes")}</div>
    </div>
  );
}

/** Título de bloque en mayúsculas pequeñas con su aclaración (qué datos entran). */
function blockHeading(id, title, sub, P) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <h2 id={id} style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: P.muted }}>{title}</h2>
      {sub ? <span style={{ fontSize: 13, fontWeight: 500, color: P.muted, lineHeight: 1.4 }}>{sub}</span> : null}
    </div>
  );
}

/**
 * Progreso del entrenador (E3). Todas las cifras salen de buildCoachProgresoModel (núcleo lib/metricas, E1/E2); esta vista solo
 * las presenta: encabezado (completo y compacto al desplazarse), período (4 tarjetas), bloque actual (carga, volumen por semana,
 * patrones), PRs, historial por ejercicio y Equipo colapsado.
 * @param {{
 *  alumnos?: array,
 *  sesionesGlobales?: array,
 *  progresoGlobal?: object,
 *  rutinasSBEntrenador?: array,
 *  allEx?: array,
 *  historiaCompleta?: { sesiones: boolean, progreso: boolean } | null,  // false => historial truncado (lib/coachHistoryLoader.js)
 *  darkMode?: boolean,
 * }} props
 */
export default function ProgresoView({
  alumnos = [],
  sesionesGlobales = [],
  progresoGlobal = {},
  rutinasSBEntrenador = [],
  allEx = [],
  darkMode = true,
  historiaCompleta = null,
}) {
  const { lang } = useIronTrackI18n();
  const isUnder768 = useIsUnder768();
  // Movil: margen lateral de 16 px, igual que el resto de pantallas del coach (antes 20 px).
  const S = isUnder768 ? Object.assign({}, S0, { pagePadding: 16, headerPadding: "16px 16px" }) : S0;
  /** Período elegido: { id } o { id: "custom", desde, hasta } (números de día). 4 semanas al entrar; no cambia al cambiar de alumno. */
  const [periodo, setPeriodo] = useState({ id: "semanas4" });

  var C = useMemo(
    function () {
      return coachThemePalette(darkMode);
    },
    [darkMode]
  );
  var P = useMemo(function () { return progresoTone(C, darkMode); }, [C, darkMode]);
  /** Paleta para los componentes reutilizados: el gris secundario legible (4,5:1) en lugar de C.t2. */
  var Cx = useMemo(function () { return Object.assign({}, C, { t2: P.muted }); }, [C, P]);

  var selectBaseStyle = useMemo(
    function () {
      return Object.assign({}, T.control, {
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        minHeight: 44,
        padding: "10px 12px",
        color: C.t,
        background: C.cardDark,
        border: "1px solid " + P.line,
        borderRadius: 12,
        fontFamily: "inherit",
        cursor: "pointer",
        outline: "none",
      });
    },
    [C, P]
  );

  // Primer alumno (A–Z) desde el primer render: sin un cuadro intermedio de «sin alumno».
  const [alumnoSel, setAlumnoSel] = useState(function () {
    var first = (alumnos || []).slice().sort(function (a, b) {
      return String(a.nombre || a.email || "").toLowerCase().localeCompare(String(b.nombre || b.email || "").toLowerCase(), localeForSort(lang), { sensitivity: "base" });
    })[0];
    return first ? first.id : null;
  });
  const [diaIdx, setDiaIdx] = useState(0);
  const [ejercicioSelId, setEjercicioSelId] = useState(null);
  const [patronExpanded, setPatronExpanded] = useState({});
  /** Hoja abierta: { type: "alumnos" } | { type: "ejercicios", mode } | { type: "historial", ejercicioId, nombre } | null */
  const [sheet, setSheet] = useState(null);
  /**
   * Barra compacta: visible cuando el encabezado completo ya pasó por debajo de la barra superior de la app. Es `fixed` (no sticky):
   * el contenedor con overflow del layout del entrenador no siempre es el que desplaza, y `sticky` quedaría atado a él.
   * top = borde inferior de la barra superior móvil si está en pantalla (si no, 0); left/width = los de Progreso (sidebar en escritorio).
   */
  const [bar, setBar] = useState({ compact: false, top: 0, left: 0, width: 0 });
  var sentinelRef = useRef(null);
  var rootRef = useRef(null);
  /** Primera carga del historial: si a los 10 s sigue sin respuesta, se dice que no se pudo (el cargador reintenta solo). */
  var cargando = historiaCompleta == null && !(sesionesGlobales || []).length && !Object.keys(progresoGlobal || {}).length;
  const [cargaLenta, setCargaLenta] = useState(false);
  useEffect(
    function () {
      if (!cargando) {
        setCargaLenta(false);
        return undefined;
      }
      var t = setTimeout(function () { setCargaLenta(true); }, 10000);
      return function () { clearTimeout(t); };
    },
    [cargando]
  );

  function togglePatronRow(key) {
    setPatronExpanded(function (prev) {
      var n = Object.assign({}, prev);
      n[key] = !n[key];
      return n;
    });
  }

  function openHistorial(ejercicioId, nombre) {
    if (ejercicioId == null) return;
    setSheet({ type: "historial", ejercicioId: String(ejercicioId), nombre: nombre || "" });
  }

  var patternDrilldownCtx = useMemo(
    function () {
      return {
        alumnoId: alumnoSel,
        onOpenExercise: function (payload) {
          openHistorial(payload.ejercicioId, payload.ejercicioNombre);
        },
      };
    },
    [alumnoSel]
  );

  var alumnosSorted = useMemo(
    function () {
      return (alumnos || [])
        .slice()
        .sort(function (a, b) {
          var na = String(a.nombre || a.email || "").toLowerCase();
          var nb = String(b.nombre || b.email || "").toLowerCase();
          return na.localeCompare(nb, localeForSort(lang), { sensitivity: "base" });
        });
    },
    [alumnos, lang]
  );

  var rutinaActiva = useMemo(
    function () {
      return getRoutineForAlumno(rutinasSBEntrenador, alumnoSel);
    },
    [rutinasSBEntrenador, alumnoSel]
  );

  var diasRutina = rutinaActiva && rutinaActiva.datos ? rutinaActiva.datos.days || [] : [];

  useEffect(
    function () {
      if (!alumnosSorted.length) {
        if (alumnoSel !== null) setAlumnoSel(null);
        return;
      }
      var exists = alumnosSorted.some(function (a) {
        return String(a.id) === String(alumnoSel);
      });
      if (!exists) {
        setAlumnoSel(alumnosSorted[0].id);
      }
    },
    [alumnosSorted, alumnoSel]
  );

  useEffect(
    function () {
      setDiaIdx(0);
      // Nada del alumno anterior debe quedar visible: historial y lista de ejercicios abiertos, patrones desplegados.
      setPatronExpanded({});
      setSheet(function (cur) {
        return cur && (cur.type === "historial" || cur.type === "ejercicios") ? null : cur;
      });
    },
    [alumnoSel]
  );

  useEffect(
    function () {
      if (diasRutina.length === 0) {
        if (diaIdx !== 0) setDiaIdx(0);
        return;
      }
      if (diaIdx >= diasRutina.length) {
        setDiaIdx(0);
      }
    },
    [diasRutina.length, diaIdx, alumnoSel]
  );

  // Mide en cada desplazamiento de cualquier contenedor (scroll en captura) y al cambiar el tamaño, una vez por cuadro.
  useEffect(
    function () {
      if (typeof window === "undefined") return undefined;
      var raf = 0;
      function measure() {
        raf = 0;
        var s = sentinelRef.current;
        var r = rootRef.current;
        if (!s || !r) return;
        var tb = document.querySelector("[data-coach-topbar]");
        var top = 0;
        if (tb) {
          var b = tb.getBoundingClientRect().bottom;
          if (b > 0) top = Math.round(b);
        }
        var rr = r.getBoundingClientRect();
        var next = { compact: s.getBoundingClientRect().top < top, top: top, left: Math.round(rr.left), width: Math.round(rr.width) };
        setBar(function (prev) {
          return prev.compact === next.compact && prev.top === next.top && prev.left === next.left && prev.width === next.width ? prev : next;
        });
      }
      function schedule() {
        if (!raf) raf = window.requestAnimationFrame(measure);
      }
      measure();
      window.addEventListener("scroll", schedule, { capture: true, passive: true });
      window.addEventListener("resize", schedule);
      return function () {
        window.removeEventListener("scroll", schedule, { capture: true });
        window.removeEventListener("resize", schedule);
        if (raf) window.cancelAnimationFrame(raf);
      };
    },
    [alumnos.length]
  );

  var model = useMemo(
    function () {
      return buildCoachProgresoModel({
        alumnos: alumnos,
        sesionesGlobales: sesionesGlobales,
        progresoGlobal: progresoGlobal,
        rutinasSBEntrenador: rutinasSBEntrenador,
        allEx: allEx,
        periodId: periodo.id,
        periodCustom: periodo.id === "custom" ? { desde: periodo.desde, hasta: periodo.hasta } : null,
        alumnoSel: alumnoSel,
        diaIdx: diaIdx,
        ejercicioSelId: ejercicioSelId,
        lang: lang,
        historiaCompleta: historiaCompleta,
      });
    },
    [alumnos, sesionesGlobales, progresoGlobal, rutinasSBEntrenador, allEx, periodo, alumnoSel, diaIdx, ejercicioSelId, lang, historiaCompleta]
  );

  var exerciseOptKey = useMemo(
    function () {
      return String(diaIdx) + "|" + (model.exerciseOptions || []).map(function (o) {
        return o.id;
      }).join(",");
    },
    [diaIdx, model.exerciseOptions]
  );

  useEffect(
    function () {
      var opts = model.exerciseOptions || [];
      if (!opts.length) {
        if (ejercicioSelId !== null) setEjercicioSelId(null);
        return;
      }
      var ok = opts.some(function (o) {
        return String(o.id) === String(ejercicioSelId);
      });
      if (!ok) {
        setEjercicioSelId(opts[0].id);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- exerciseOptKey resume la lista de ejercicios
    [exerciseOptKey, ejercicioSelId]
  );

  var alumnoColor = useMemo(
    function () {
      var row = model.alumnoRows.find(function (r) {
        return String(r.id) === String(alumnoSel);
      });
      return row ? row.color : C.blue;
    },
    [model.alumnoRows, alumnoSel]
  );

  var chartComputed = useMemo(
    function () {
      var series = model.chartSeries || [];
      var n = series.length;
      if (n === 0) {
        return { chartPoints: [], polySegments: [], empty: true };
      }
      var vals = [];
      for (var vi = 0; vi < series.length; vi++) {
        if (series[vi] != null) vals.push(series[vi]);
      }
      if (vals.length === 0) {
        return { chartPoints: [], polySegments: [], empty: true };
      }
      var min = Math.min.apply(null, vals) - 5;
      var max = Math.max.apply(null, vals) + 5;
      var range = max - min || 1;
      var chartPoints = [];
      for (var i = 0; i < n; i++) {
        var x = n <= 1 ? 150 : (i / (n - 1)) * 300;
        if (series[i] == null) {
          chartPoints.push({ x: x, y: null, v: null, hasData: false });
        } else {
          var y = 100 - ((series[i] - min) / range) * 100;
          chartPoints.push({ x: x, y: y, v: series[i], hasData: true });
        }
      }
      var polySegments = [];
      for (var j = 0; j < n - 1; j++) {
        if (series[j] != null && series[j + 1] != null) {
          var a = chartPoints[j];
          var b = chartPoints[j + 1];
          polySegments.push(a.x + "," + a.y + " " + b.x + "," + b.y);
        }
      }
      return { chartPoints: chartPoints, polySegments: polySegments, empty: false };
    },
    [model.chartSeries]
  );

  var alumnoObj = alumnosSorted.find(function (x) {
    return String(x.id) === String(alumnoSel);
  });
  var alumnoName = alumnoObj ? alumnoObj.nombre || alumnoObj.email || "—" : "—";
  var alumnoInitials = alumnoObj ? initialsFromName(alumnoObj.nombre, alumnoObj.email) : "?";
  var semanaActual = Math.min(4, Math.max(1, model.semanaDetectada || 1));
  var alumnoSub = model.tieneRutina
    ? (model.rutinaNombre || M(lang, "Rutina", "Routine", "Rotina")) + " · " + M(lang, "Semana " + semanaActual + " de 4", "Week " + semanaActual + " of 4", "Semana " + semanaActual + " de 4")
    : M(lang, "Sin rutina asignada", "No routine assigned", "Sem rotina atribuída");

  var routineNameFor = function (aid) {
    var r = getRoutineForAlumno(rutinasSBEntrenador, aid);
    return r ? String(r.nombre || r.name || "") : null;
  };

  var rootStyle = {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    width: "100%",
    boxSizing: "border-box",
    fontFamily: '-apple-system, "SF Pro Text", system-ui, "Segoe UI", Roboto, sans-serif',
    background: C.bg,
    color: C.t,
    minHeight: "100%",
  };

  if (!alumnos.length) {
    return (
      <div style={rootStyle}>
        <header style={{ padding: isUnder768 ? "20px 16px 14px" : "24px 24px 16px", borderBottom: "1px solid " + C.brd }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: -0.5, color: C.t }}>{M(lang, "Progreso", "Progress", "Progresso")}</h1>
        </header>
        <div style={{ padding: S.pagePadding }}>
          <div data-qa="progreso-sin-alumnos" style={{ background: C.card, border: "1px solid " + C.brd, borderRadius: 16, padding: "28px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.t }}>{M(lang, "Todavía no hay estadísticas", "No statistics yet", "Ainda não há estatísticas")}</h2>
            <p style={{ margin: 0, fontSize: 13, color: P.muted, lineHeight: 1.45 }}>
              {M(lang, "Agregá tu primer alumno y asignale una rutina para ver su progreso acá.", "Add your first athlete and assign a routine to see their progress here.", "Adicione seu primeiro aluno e atribua uma rotina para ver o progresso aqui.")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  var incompleto = historiaCompleta && (!historiaCompleta.sesiones || !historiaCompleta.progreso);
  var periodoLabel = periodLabel(periodo, lang, false);
  var periodoSub = !model.periodo || model.periodo.tienePrevio
    ? M(lang, "Todo el historial · comparado con el período anterior", "Whole history · compared with the previous period", "Todo o histórico · comparado com o período anterior")
    : M(lang, "Desde el primer registro · sin período anterior para comparar", "Since the first record · no previous period to compare", "Desde o primeiro registro · sem período anterior para comparar");
  if (incompleto) periodoSub += M(lang, " · puede faltar historial antiguo", " · older history may be missing", " · pode faltar histórico antigo");
  function openPeriodo() {
    setSheet({ type: "periodo" });
  }

  var loadHasChartScope = rutinaActiva && diasRutina.length > 0 && (model.exerciseOptions || []).length > 0;
  var loadBody = (
    <>
      <ProgressLoadControls
        diasRutina={diasRutina}
        diaIdx={diaIdx}
        setDiaIdx={setDiaIdx}
        ejercicioSelId={ejercicioSelId}
        setEjercicioSelId={setEjercicioSelId}
        exerciseOptions={model.exerciseOptions}
        rutinaActiva={rutinaActiva}
        selectBaseStyle={selectBaseStyle}
        C={Cx}
        T={T}
        S={S}
        lang={lang}
        M={M}
        emptyBox={emptyBox}
        compact={isUnder768}
      />
      {loadHasChartScope ? (
        !model.hasChartData || chartComputed.empty ? (
          emptyBox(lang, M(lang, "No hay registros de carga para este ejercicio en el bloque", "No load records for this exercise in the block", "Sem registros de carga para este exercício no bloco"), Cx)
        ) : (
          <ProgressLoadChart
            chartComputed={chartComputed}
            weekLabels={model.chartWeekLabels}
            mixedDays={model.chartMixedDays}
            alumnoColor={alumnoColor}
            C={Cx}
            T={T}
            lang={lang}
            M={M}
            currentRoutineWeekIndex={model.currentRoutineWeekIndex}
          />
        )
      ) : null}
    </>
  );

  var selExerciseName = (function () {
    var opt = (model.exerciseOptions || []).find(function (o) {
      return String(o.id) === String(ejercicioSelId);
    });
    return opt ? opt.name : "";
  })();

  var cardStyle = { background: C.card, border: "1px solid " + C.brd, borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 14, minWidth: 0, boxSizing: "border-box" };

  return (
    <div ref={rootRef} style={rootStyle} data-qa="progreso-coach">
      <ProgressHeader
        compact={false}
        lang={lang}
        C={C}
        P={P}
        alumnoName={alumnoName}
        alumnoInitials={alumnoInitials}
        alumnoSub={alumnoSub}
        periodo={periodo}
        onOpenPeriodo={openPeriodo}
        onOpenAlumnos={function () { setSheet({ type: "alumnos" }); }}
        isUnder768={isUnder768}
      />
      <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />
      {/* Barra compacta (64 px): fija debajo de la barra superior móvil cuando el encabezado completo ya no se ve. */}
      <div
        aria-hidden={bar.compact ? undefined : "true"}
        style={{ position: "fixed", top: bar.top, left: bar.left, width: bar.width || "100%", zIndex: 40, visibility: bar.compact ? "visible" : "hidden", opacity: bar.compact ? 1 : 0, transition: "opacity 120ms ease" }}
      >
        <ProgressHeader
          compact={true}
          safeTop={bar.top === 0}
          lang={lang}
          C={C}
          P={P}
          alumnoName={alumnoName}
          alumnoInitials={alumnoInitials}
          alumnoSub={alumnoSub}
          periodo={periodo}
          onOpenPeriodo={openPeriodo}
          onOpenAlumnos={function () { setSheet({ type: "alumnos" }); }}
          isUnder768={isUnder768}
        />
      </div>

      <main style={{ padding: isUnder768 ? "20px 16px 32px" : "24px 24px 40px", display: "flex", flexDirection: "column", gap: 28, width: "100%", maxWidth: 1180, margin: "0 auto", boxSizing: "border-box" }}>
        {cargando ? (
          <div role="status" data-qa="progreso-cargando" style={{ fontSize: 13, fontWeight: 600, color: P.muted, display: "flex", alignItems: "center", gap: 8, lineHeight: 1.45 }}>
            <span aria-hidden="true" style={{ flex: "none", width: 8, height: 8, borderRadius: 4, background: cargaLenta ? P.warn : C.blue }} />
            {cargaLenta
              ? M(lang, "Todavía no se pudo cargar el historial de tus alumnos. Se reintenta automáticamente.", "Your athletes' history could not be loaded yet. It retries automatically.", "Ainda não foi possível carregar o histórico dos seus alunos. Tenta novamente automaticamente.")
              : M(lang, "Cargando el historial de tus alumnos…", "Loading your athletes' history…", "Carregando o histórico dos seus alunos…")}
          </div>
        ) : null}
        {incompleto ? (
          <div
            role="status"
            data-qa="historial-incompleto"
            style={{ display: "flex", flexDirection: "column", gap: 4, background: P.banner.bg, border: "1px solid " + P.banner.brd, borderRadius: 14, padding: "12px 14px" }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: P.banner.title }}>{M(lang, "Faltan datos del historial", "Some history is missing", "Faltam dados do histórico")}</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: P.banner.text, lineHeight: 1.45 }}>
              {M(
                lang,
                "No se pudo cargar todo el historial de tus alumnos. Mostramos el período, pero sin compararlo con el anterior; se reintentará automáticamente.",
                "Your athletes' full history could not be loaded. The period is shown, but not compared with the previous one; it will retry automatically.",
                "Não foi possível carregar todo o histórico dos seus alunos. Mostramos o período, sem compará-lo com o anterior; será tentado novamente."
              )}
            </span>
          </div>
        ) : null}

        {/* ===== ALUMNO SELECCIONADO: todo lo de esta sección depende de alumnoSel ===== */}
        <section data-section="alumno" style={{ display: "flex", flexDirection: "column", gap: 28, minWidth: 0 }}>
          <section aria-labelledby="progreso-periodo" data-qa="seccion-periodo" style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
            {blockHeading(
              "progreso-periodo",
              M(lang, "Período · ", "Period · ", "Período · ") + periodoLabel,
              periodoSub,
              P
            )}
            <ProgressSummaryCards chips={model.alumnoChips} ultimaSesion={model.ultimaSesion} lang={lang} C={C} P={P} isUnder768={isUnder768} />
          </section>

          <section aria-labelledby="progreso-bloque" data-qa="seccion-bloque" style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
            {blockHeading(
              "progreso-bloque",
              M(lang, "Bloque actual", "Current block", "Bloco atual") + (model.rutinaNombre ? " · " + model.rutinaNombre : ""),
              model.tieneRutina
                ? M(lang, "Solo la rutina activa, semanas 1 a 4 · vas en la semana " + semanaActual, "Active routine only, weeks 1 to 4 · now in week " + semanaActual, "Só a rotina ativa, semanas 1 a 4 · na semana " + semanaActual)
                : null,
              P
            )}
            {!model.tieneRutina ? (
              <div data-qa="alumno-sin-rutina" style={{ background: C.card, border: "1px solid " + C.brd, borderRadius: 16, padding: "24px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
                <span aria-hidden="true" style={{ width: 48, height: 48, borderRadius: 24, background: P.track, color: P.text2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800 }}>{alumnoInitials}</span>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.t }}>{M(lang, alumnoName + " no tiene rutina asignada", alumnoName + " has no routine assigned", alumnoName + " não tem rotina atribuída")}</h3>
                <p style={{ margin: 0, fontSize: 13, color: P.muted, lineHeight: 1.45 }}>
                  {M(lang, "Sin rutina no hay bloque ni adherencia que medir. Sus PRs y su volumen aparecen igual si registra entrenamientos.", "Without a routine there is no block or adherence to measure. PRs and volume still show if they log workouts.", "Sem rotina não há bloco nem aderência para medir. PRs e volume aparecem se registrar treinos.")}
                </p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: isUnder768 ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))", gap: 12, alignItems: "start" }}>
                <article data-qa="bloque-carga" style={cardStyle}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: -0.2, color: C.t }}>{M(lang, "Evolución de carga", "Load progression", "Evolução de carga")}</h3>
                    {ejercicioSelId != null && alumnoSel != null ? (
                      <button
                        type="button"
                        onClick={function () { openHistorial(ejercicioSelId, selExerciseName); }}
                        style={{ minHeight: 44, padding: "0 6px", border: "none", background: "transparent", color: P.accentText, fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}
                      >
                        {M(lang, "Historial", "History", "Histórico")}
                      </button>
                    ) : null}
                  </div>
                  {loadBody}
                </article>
                <ProgressWeeklyVolumeCard volBars={model.volBars} currentRoutineWeekIndex={model.currentRoutineWeekIndex} lang={lang} C={C} P={P} />
                <PatternDrilldownContext.Provider value={patternDrilldownCtx}>
                  <ProgressMovementPatternVolumeCard
                    patterns={model.patronPatterns}
                    totalVol={model.patronTotalVol}
                    weekNumber={(model.currentRoutineWeekIndex != null ? model.currentRoutineWeekIndex : 0) + 1}
                    patronExpanded={patronExpanded}
                    togglePatronRow={togglePatronRow}
                    C={Cx}
                    lang={lang}
                    formatWeeklyVolKgAbbrev={formatWeeklyVolKgAbbrev}
                  />
                </PatternDrilldownContext.Provider>
              </div>
            )}
          </section>

          <div style={{ display: "grid", gridTemplateColumns: isUnder768 ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))", gap: isUnder768 ? 28 : 12, alignItems: "start" }}>
            <ProgressRecentPrsCard prs={model.prsRecientes} onOpenExercise={openHistorial} lang={lang} C={C} P={P} />
            <ProgressExercisesCard
              key={"ej-" + String(alumnoSel)}
              ejercicios={model.ejerciciosRegistrados}
              onOpenExercise={openHistorial}
              onOpenList={function (mode) { setSheet({ type: "ejercicios", mode: mode }); }}
              lang={lang}
              C={C}
              P={P}
            />
          </div>
        </section>

        {/* ===== EQUIPO: global, no depende de alumnoSel; colapsado por defecto ===== */}
        <ProgressTeamSection teamChips={model.teamChips} ranking={model.ranking} rankingSessionsLine={rankingSessionsLine} lang={lang} C={C} P={P} />
      </main>

      {sheet && sheet.type === "periodo" ? (
        <ProgressSheet
          title={M(lang, "Período", "Period", "Período")}
          subtitle={periodLabel(periodo, lang, false)}
          onClose={function () { setSheet(null); }}
          closeLabel={M(lang, "Cerrar", "Close", "Fechar")}
          C={C}
          P={P}
          isUnder768={isUnder768}
          qa="periodo"
        >
          <PeriodSheetContent
            periodo={periodo}
            historiaIncompleta={!!incompleto}
            onSelect={function (p) { setPeriodo(p); setSheet(null); }}
            lang={lang}
            C={C}
            P={P}
          />
        </ProgressSheet>
      ) : null}
      {sheet && sheet.type === "alumnos" ? (
        <ProgressSheet
          title={M(lang, "Elegir alumno", "Choose athlete", "Escolher aluno")}
          onClose={function () { setSheet(null); }}
          closeLabel={M(lang, "Cerrar", "Close", "Fechar")}
          C={C}
          P={P}
          isUnder768={isUnder768}
          qa="alumnos"
        >
          <ProgressAlumnoPicker
            alumnos={alumnosSorted}
            selectedId={alumnoSel}
            stalledIds={model.stalledIds}
            adherenciaRows={model.adherenciaRows}
            routineNameFor={routineNameFor}
            onSelect={function (id) { setAlumnoSel(id); setSheet(null); }}
            lang={lang}
            C={C}
            P={P}
          />
        </ProgressSheet>
      ) : null}
      {sheet && sheet.type === "ejercicios" ? (
        <ProgressSheet
          title={M(lang, "Historial por ejercicio", "History by exercise", "Histórico por exercício")}
          subtitle={alumnoName + " · " + M(lang, (model.ejerciciosRegistrados || []).length + " ejercicios registrados", (model.ejerciciosRegistrados || []).length + " logged exercises", (model.ejerciciosRegistrados || []).length + " exercícios registrados")}
          onClose={function () { setSheet(null); }}
          closeLabel={M(lang, "Cerrar", "Close", "Fechar")}
          C={C}
          P={P}
          isUnder768={isUnder768}
          qa="ejercicios"
        >
          <ProgressExerciseList ejercicios={model.ejerciciosRegistrados} initialMode={sheet.mode} onOpenExercise={openHistorial} lang={lang} C={C} P={P} />
        </ProgressSheet>
      ) : null}
      {sheet && sheet.type === "historial" ? (
        <ProgressSheet
          title={sheet.nombre || M(lang, "Ejercicio", "Exercise", "Exercício")}
          subtitle={alumnoName + " · " + M(lang, "todas las rutinas y ciclos", "all routines and cycles", "todas as rotinas e ciclos")}
          onClose={function () { setSheet(null); }}
          closeLabel={M(lang, "Cerrar", "Close", "Fechar")}
          C={C}
          P={P}
          isUnder768={isUnder768}
          qa="historial"
        >
          <EjercicioHistorialCoach
            alumnoId={alumnoSel}
            ejercicioId={sheet.ejercicioId}
            progresoGlobal={progresoGlobal}
            indiceTiempo={model.indiceTiempo}
            rutinasSBEntrenador={rutinasSBEntrenador}
            currentRoutineId={rutinaActiva ? rutinaActiva.id : null}
            lang={lang}
            C={C}
            P={P}
          />
        </ProgressSheet>
      ) : null}
    </div>
  );
}
