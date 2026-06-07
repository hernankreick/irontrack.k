import React, { useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
} from "lucide-react";
import { buildCoachProgresoModel, getRoutineForAlumno } from "./coachProgresoMetrics.js";
import { coachType as T, coachSpace as S } from "./coachUiScale.js";
import ProgressAdherenceCard from "./progreso/ProgressAdherenceCard.jsx";
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: S.gridGap }}>
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

            <div style={{ marginBottom: S.blockGapLoose }}>
              <label
                style={{
                  display: "block",
                  ...T.labelMd,
                  color: C.t2,
                  marginBottom: 6,
                }}
              >
                {M(lang, "Alumno", "Athlete")}
              </label>
              <select
                value={alumnoSel != null ? String(alumnoSel) : ""}
                onChange={function (e) {
                  var v = e.target.value;
                  setAlumnoSel(v || null);
                }}
                style={selectBaseStyle}
              >
                {alumnosSorted.map(function (a) {
                  return (
                    <option key={String(a.id)} value={String(a.id)}>
                      {a.nombre || a.email || "—"}
                    </option>
                  );
                })}
              </select>
            </div>

            {!rutinaActiva || diasRutina.length === 0 ? (
              <div style={{ marginBottom: S.blockGapLoose }}>
                {emptyBox(
                  lang,
                  M(
                    lang,
                    "Este alumno no tiene una rutina con días cargados",
                    "This athlete has no routine with training days",
                    "Este aluno não tem rotina com dias de treino carregados"
                  ),
                  C
                )}
              </div>
            ) : (
              <>
                <div style={{ marginBottom: S.blockGapLoose }}>
                  <label
                    style={{
                      display: "block",
                      ...T.labelMd,
                      color: C.t2,
                      marginBottom: 6,
                    }}
                  >
                    {M(lang, "Día de entrenamiento", "Training day")}
                  </label>
                  <select
                    value={String(Math.min(diaIdx, Math.max(0, diasRutina.length - 1)))}
                    onChange={function (e) {
                      setDiaIdx(parseInt(e.target.value, 10) || 0);
                    }}
                    style={selectBaseStyle}
                  >
                    {diasRutina.map(function (d, i) {
                      var lbl = d && d.label ? String(d.label).trim() : "";
                      if (!lbl) {
                        lbl = M(lang, "Día " + (i + 1), "Day " + (i + 1), "Dia " + (i + 1));
                      }
                      return (
                        <option key={"dia-rut-" + i} value={String(i)}>
                          {lbl}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {(model.exerciseOptions || []).length === 0 ? (
                  <div style={{ ...T.subtitle, color: C.t2, marginBottom: S.blockGapLoose }}>
                    {M(
                      lang,
                      "Este día no tiene ejercicios en la rutina. Podés elegir otro día o revisar la rutina del alumno.",
                      "This day has no exercises in the routine. Pick another day or review the athlete's plan.",
                      "Este dia não tem exercícios na rotina. Escolha outro dia ou revise o plano do aluno."
                    )}
                  </div>
                ) : (
                  <>
                    {(model.exerciseOptions || []).some(function (o) {
                      return o.section === "warmup";
                    }) ? (
                      <div style={{ marginBottom: S.blockGap }}>
                        <div
                          style={{
                            ...T.labelMd,
                            color: C.t2,
                            marginBottom: 8,
                            letterSpacing: 0.3,
                          }}
                        >
                          {M(lang, "Calentamiento", "Warm-up")}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {(model.exerciseOptions || [])
                            .filter(function (ex) {
                              return ex.section === "warmup";
                            })
                            .map(function (ex) {
                              var act = String(ejercicioSelId) === String(ex.id);
                              return (
                                <button
                                  key={"w-" + ex.id}
                                  type="button"
                                  onClick={function () {
                                    setEjercicioSelId(ex.id);
                                  }}
                                  style={{
                                    border: "1px solid " + (act ? C.blue : C.brd),
                                    background: act ? "#1e3a8a22" : "transparent",
                                    color: act ? alumnoColor : C.t2,
                                    ...T.bodySemibold,
                                    padding: "7px 12px",
                                    borderRadius: 8,
                                    cursor: "pointer",
                                    fontFamily: "inherit",
                                    maxWidth: "100%",
                                  }}
                                >
                                  {ex.name}
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    ) : null}
                    {(model.exerciseOptions || []).some(function (o) {
                      return o.section === "main";
                    }) ? (
                      <div style={{ marginBottom: S.blockGapLoose }}>
                        <div
                          style={{
                            ...T.labelMd,
                            color: C.t2,
                            marginBottom: 8,
                            letterSpacing: 0.3,
                          }}
                        >
                          {M(lang, "Principal", "Main")}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {(model.exerciseOptions || [])
                            .filter(function (ex) {
                              return ex.section === "main";
                            })
                            .map(function (ex) {
                              var act = String(ejercicioSelId) === String(ex.id);
                              return (
                                <button
                                  key={"m-" + ex.id}
                                  type="button"
                                  onClick={function () {
                                    setEjercicioSelId(ex.id);
                                  }}
                                  style={{
                                    border: "1px solid " + (act ? C.blue : C.brd),
                                    background: act ? "#1e3a8a22" : "transparent",
                                    color: act ? alumnoColor : C.t2,
                                    ...T.bodySemibold,
                                    padding: "7px 12px",
                                    borderRadius: 8,
                                    cursor: "pointer",
                                    fontFamily: "inherit",
                                    maxWidth: "100%",
                                  }}
                                >
                                  {ex.name}
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </>
            )}

            {rutinaActiva && diasRutina.length > 0 && (model.exerciseOptions || []).length > 0 ? (
              !model.hasChartData || chartComputed.empty ? (
                emptyBox(lang, M(lang, "No hay registros de carga para este ejercicio", "No load records for this exercise", "Sem registros de carga para este exercício"), C)
              ) : (
                <>
                  <p style={{ ...T.subtitle, color: C.t2, margin: "0 0 10px 0" }}>
                    {M(
                      lang,
                      "Bloque actual (4 semanas, lun–dom). Máx. kg registrado por semana.",
                      "Current block (4 weeks, Mon–Sun). Max kg logged per week.",
                      "Bloco atual (4 semanas, seg–dom). Máx. kg registrado por semana."
                    )}
                  </p>
                  <svg viewBox="0 0 300 100" width="100%" height={124} style={{ display: "block" }}>
                    {(chartComputed.polySegments || []).map(function (seg, si) {
                      return (
                        <polyline
                          key={"seg-" + si}
                          fill="none"
                          stroke={alumnoColor}
                          strokeWidth={2.5}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          points={seg}
                        />
                      );
                    })}
                    {(chartComputed.chartPoints || []).map(function (pt, i) {
                      return (
                        <g key={"pt-" + i}>
                          {pt.hasData ? (
                            <>
                              <circle r={4} cx={pt.x} cy={pt.y} fill={alumnoColor} />
                              <text x={pt.x} y={pt.y - 9} fill={C.t} fontSize={14} fontWeight={700} textAnchor="middle">
                                {pt.v}
                              </text>
                            </>
                          ) : (
                            <text x={pt.x} y={93} fill={C.t2} fontSize={12} fontWeight={600} textAnchor="middle">
                              —
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: 8,
                      ...T.labelMd,
                      color: C.t2,
                    }}
                  >
                    {(model.chartWeekLabels || []).map(function (s, idx) {
                      return (
                        <span key={"wl-" + idx}>
                          {s}
                        </span>
                      );
                    })}
                  </div>
                </>
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: S.gridGapTight }}>
          <ProgressRecentPrsCard
            prs={model.prsRecientes}
            C={C}
            lang={lang}
            emptyBox={emptyBox}
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
