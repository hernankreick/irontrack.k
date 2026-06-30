import React, { useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
} from "lucide-react";
import { buildCoachProgresoModel, getRoutineForAlumno } from "./coachProgresoMetrics.js";
import { coachType as T, coachSpace as S } from "./coachUiScale.js";
import ProgressAdherenceCard from "./progreso/ProgressAdherenceCard.jsx";
import ProgressLoadChart from "./progreso/ProgressLoadChart.jsx";
import ProgressLoadControls from "./progreso/ProgressLoadControls.jsx";
import ProgressMovementPatternVolumeCard from "./progreso/ProgressMovementPatternVolumeCard.jsx";
import ProgressRankingCard from "./progreso/ProgressRankingCard.jsx";
import ProgressRecentPrsCard from "./progreso/ProgressRecentPrsCard.jsx";
import ProgressWeeklyVolumeCard from "./progreso/ProgressWeeklyVolumeCard.jsx";
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

/** Número completo para tooltip */
function formatWeeklyVolKgFull(v) {
  var n = Number(v) || 0;
  if (n <= 0) return "0 kg";
  return (
    Math.round(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) + " kg"
  );
}

/** Texto secundario leaderboard: sesiones completadas vs planificadas (misma ventana que el ranking) */
function rankingSessionsLine(completed, planned, lang) {
  var c = completed != null ? completed : 0;
  var p = planned != null ? planned : 0;
  if (p <= 0) {
    return M(lang, "Adherencia al plan", "Plan adherence", "Aderência ao plano");
  }
  return (
    c +
    "/" +
    p +
    M(lang, " sesiones completadas", " sessions completed", " sessões concluídas")
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
        padding: "28px 16px",
        textAlign: "center",
        color: P.t2,
        border: "1px dashed " + P.brd,
        borderRadius: 10,
        background: P.cardDark,
        ...T.body,
      }}
    >
      {title}
      <div style={{ marginTop: 8, ...T.meta }}>{M(lang, "Sin datos suficientes", "Not enough data", "Dados insuficientes")}</div>
    </div>
  );
}

/**
 * @param {{
 *  alumnos?: array,
 *  sesionesGlobales?: array,
 *  progresoGlobal?: object,
 *  rutinasSBEntrenador?: array,
 *  allEx?: array,
 *  es?: boolean,
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
}) {
  const { lang } = useIronTrackI18n();
  const isUnder768 = useIsUnder768();
  const [periodo, setPeriodo] = useState("semanas4");

  var C = useMemo(
    function () {
      return coachThemePalette(darkMode);
    },
    [darkMode]
  );

  var selectBaseStyle = useMemo(
    function () {
      return Object.assign({}, T.control, {
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        padding: "10px 12px",
        color: C.t,
        background: C.cardDark,
        border: "1px solid " + C.brd,
        borderRadius: 8,
        fontFamily: "inherit",
        cursor: "pointer",
        outline: "none",
      });
    },
    [C]
  );

  /** Tarjeta «Ranking de progreso»: modo día = superficie clara, sin gradiente nocturno. */
  var rankingCardUi = useMemo(
    function () {
      var dm = darkMode !== false;
      if (dm) {
        return {
          wrapBg:
            "linear-gradient(165deg, #14141c 0%, " + C.card + " 45%, #101018 100%)",
          wrapShadow:
            "0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 40px rgba(0,0,0,0.35)",
          topRowShadow: "0 8px 24px rgba(0,0,0,0.25)",
          restBorderTop: "1px solid rgba(30,30,46,0.9)",
          miniBarTrack: "#252536",
          restRowHover: "rgba(255,255,255,0.04)",
          adherBadgeColor: "#93c5fd",
          adherBadgeBg: "rgba(59,130,246,0.12)",
          adherBadgeBorder: "1px solid rgba(59,130,246,0.35)",
        };
      }
      return {
        wrapBg:
          "linear-gradient(165deg, #ffffff 0%, " + C.cardDark + " 42%, #f1f5f9 100%)",
        wrapShadow:
          "0 1px 2px rgba(15,23,42,0.06), 0 10px 36px rgba(15,23,42,0.07)",
        topRowShadow: "0 2px 14px rgba(15,23,42,0.07)",
        restBorderTop: "1px solid " + C.brd,
        miniBarTrack: "#e2e8f0",
        restRowHover: "rgba(15,23,42,0.06)",
        adherBadgeColor: "#1d4ed8",
        adherBadgeBg: "rgba(37,99,235,0.08)",
        adherBadgeBorder: "1px solid rgba(37,99,235,0.28)",
      };
    },
    [darkMode, C]
  );

  var periodOpts = useMemo(
    function () {
      return [
        { id: "semanas4", label: M(lang, "4 semanas", "4 weeks", "4 semanas") },
        { id: "semanas8", label: M(lang, "8 semanas", "8 weeks", "8 semanas") },
        { id: "meses3", label: M(lang, "3 meses", "3 months", "3 meses") },
      ];
    },
    [lang]
  );
  const [alumnoSel, setAlumnoSel] = useState(null);
  const [diaIdx, setDiaIdx] = useState(0);
  const [ejercicioSelId, setEjercicioSelId] = useState(null);
  const [volBarHoverIdx, setVolBarHoverIdx] = useState(null);
  const [patronExpanded, setPatronExpanded] = useState({});

  function togglePatronRow(key) {
    setPatronExpanded(function (prev) {
      var n = Object.assign({}, prev);
      n[key] = !n[key];
      return n;
    });
  }

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

  var model = useMemo(
    function () {
      return buildCoachProgresoModel({
        alumnos: alumnos,
        sesionesGlobales: sesionesGlobales,
        progresoGlobal: progresoGlobal,
        rutinasSBEntrenador: rutinasSBEntrenador,
        allEx: allEx,
        periodId: periodo,
        alumnoSel: alumnoSel,
        diaIdx: diaIdx,
        ejercicioSelId: ejercicioSelId,
        lang: lang,
      });
    },
    [alumnos, sesionesGlobales, progresoGlobal, rutinasSBEntrenador, allEx, periodo, alumnoSel, diaIdx, ejercicioSelId, lang]
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

  var maxV = Math.max.apply(
    null,
    (model.volBars || []).map(function (x) {
      return x.v;
    }).concat([0])
  );

  var rankingTop3 = (model.ranking || []).slice(0, 3);
  var rankingRest = (model.ranking || []).slice(3);

  if (!alumnos.length) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          width: "100%",
          boxSizing: "border-box",
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          background: C.bg,
        }}
      >
        <header
          style={{
            padding: S.headerPadding,
            borderBottom: "1px solid " + C.brd,
          }}
        >
          <h2 style={{ ...T.screenTitle, color: C.t, margin: 0 }}>{M(lang, "Progreso", "Progress", "Progresso")}</h2>
        </header>
        <div style={{ padding: S.pagePadding }}>{emptyBox(lang, M(lang, "No tenés alumnos cargados", "No athletes yet", "Não há alunos carregados"), C)}</div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        width: "100%",
        boxSizing: "border-box",
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        background: C.bg,
      }}
    >
      <header
        style={{
          padding: S.headerPadding,
          borderBottom: "1px solid " + C.brd,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: S.gridGapTight,
        }}
      >
        <div>
          <h2 style={{ ...T.screenTitle, color: C.t, margin: 0 }}>
            {M(lang, "Progreso", "Progress", "Progresso")}
          </h2>
          <p style={{ ...T.screenSubtitle, color: C.t2, margin: "6px 0 0 0" }}>
            {M(
              lang,
              "Seguimiento de carga, adherencia y records personales",
              "Load tracking, adherence, and personal records",
              "Acompanhamento de carga, aderência e recordes pessoais"
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {periodOpts.map(function (opt) {
            var active = periodo === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={function () {
                  setPeriodo(opt.id);
                }}
                style={{
                  border: "1px solid " + (active ? C.blue : C.brd),
                  background: active ? "#1e3a8a22" : "transparent",
                  color: active ? C.blue : C.t2,
                  ...T.periodTab,
                  padding: "8px 14px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </header>

      <div
        style={{
          padding: S.pagePadding,
          display: "flex",
          flexDirection: "column",
          gap: S.pageGap,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: S.chipGridGap }}>
          {model.summaryChips.map(function (c) {
            return (
              <div
                key={c.label}
                style={{
                  background: C.cardDark,
                  border: "1px solid " + C.brd,
                  borderRadius: 8,
                  padding: "12px 14px",
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <div style={{ ...T.numberStat, color: c.color }}>{c.val}</div>
                <div style={{ ...T.meta, color: C.t2, marginTop: 4 }}>{c.label}</div>
                <div style={{ ...T.meta, color: c.deltaColor, marginTop: 4 }}>{c.delta}</div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isUnder768 ? "1fr" : "1fr 1fr", gap: S.gridGap }}>
          <div
            style={{
              background: C.card,
              border: "1px solid " + C.brd,
              borderRadius: 12,
              padding: S.cardPadding,
              minWidth: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: S.blockGapLoose }}>
              <TrendingUp size={16} color={C.blue} strokeWidth={2} />
              <span style={{ ...T.cardTitle, color: C.t }}>
                {M(lang, "Evolución de carga", "Load progression")}
              </span>
            </div>
            <ProgressLoadControls
              alumnosSorted={alumnosSorted}
              alumnoSel={alumnoSel}
              setAlumnoSel={setAlumnoSel}
              diasRutina={diasRutina}
              diaIdx={diaIdx}
              setDiaIdx={setDiaIdx}
              ejercicioSelId={ejercicioSelId}
              setEjercicioSelId={setEjercicioSelId}
              exerciseOptions={model.exerciseOptions}
              alumnoColor={alumnoColor}
              rutinaActiva={rutinaActiva}
              selectBaseStyle={selectBaseStyle}
              C={C}
              T={T}
              S={S}
              lang={lang}
              M={M}
              emptyBox={emptyBox}
            />

            {rutinaActiva && diasRutina.length > 0 && (model.exerciseOptions || []).length > 0 ? (
              !model.hasChartData || chartComputed.empty ? (
                emptyBox(lang, M(lang, "No hay registros de carga para este ejercicio", "No load records for this exercise", "Sem registros de carga para este exercício"), C)
              ) : (
                <ProgressLoadChart
                  chartComputed={chartComputed}
                  weekLabels={model.chartWeekLabels}
                  alumnoColor={alumnoColor}
                  C={C}
                  T={T}
                  lang={lang}
                  M={M}
                />
              )
            ) : null}
          </div>

          <ProgressAdherenceCard
            rows={model.adherenciaRows}
            C={C}
            lang={lang}
            emptyBox={emptyBox}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isUnder768 ? "1fr" : "1fr 1fr 1fr", gap: S.gridGapTight }}>
          <ProgressRecentPrsCard
            prs={model.prsRecientes}
            C={C}
            lang={lang}
            emptyBox={emptyBox}
            isUnder768={isUnder768}
          />

          <ProgressWeeklyVolumeCard
            volBars={model.volBars}
            currentRoutineWeekIndex={model.currentRoutineWeekIndex != null ? model.currentRoutineWeekIndex : 0}
            maxV={maxV}
            volBarHoverIdx={volBarHoverIdx}
            setVolBarHoverIdx={setVolBarHoverIdx}
            C={C}
            lang={lang}
            formatWeeklyVolKgAbbrev={formatWeeklyVolKgAbbrev}
            formatWeeklyVolKgFull={formatWeeklyVolKgFull}
            isUnder768={isUnder768}
          />

          <ProgressRankingCard
            ranking={model.ranking}
            rankingTop3={rankingTop3}
            rankingRest={rankingRest}
            rankingCardUi={rankingCardUi}
            rankingSessionsLine={rankingSessionsLine}
            C={C}
            lang={lang}
            emptyBox={emptyBox}
            isUnder768={isUnder768}
          />
        </div>

        <ProgressMovementPatternVolumeCard
          patterns={model.patronPatterns}
          totalVol={model.patronTotalVol}
          patronExpanded={patronExpanded}
          togglePatronRow={togglePatronRow}
          C={C}
          lang={lang}
          formatWeeklyVolKgAbbrev={formatWeeklyVolKgAbbrev}
        />
      </div>
    </div>
  );
}
