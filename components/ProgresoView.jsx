import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart2,
  CheckCircle,
  ChevronDown,
  PieChart,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { buildCoachProgresoModel, getRoutineForAlumno } from "./coachProgresoMetrics.js";
import { coachType as T, coachSpace as S } from "./coachUiScale.js";

const C = {
  bg: "#0a0a0f",
  card: "#12121a",
  cardDark: "#0d0d15",
  brd: "#1e1e2e",
  t: "#ffffff",
  t2: "#71717a",
  blue: "#3b82f6",
  blueDim: "#1e3a8a",
  green: "#22c55e",
  greenDim: "#052e16",
  yel: "#eab308",
  yelDim: "#422006",
  red: "#ef4444",
  redDim: "#450a0a",
};

const PERIOD_OPTS = [
  { id: "semanas4", label: "4 semanas" },
  { id: "semanas8", label: "8 semanas" },
  { id: "meses3", label: "3 meses" },
];

var selectBaseStyle = Object.assign({}, T.control, {
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  color: "#ffffff",
  background: "#0d0d15",
  border: "1px solid #1e1e2e",
  borderRadius: 8,
  fontFamily: "inherit",
  cursor: "pointer",
  outline: "none",
});

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
function rankingSessionsLine(completed, planned, es) {
  var c = completed != null ? completed : 0;
  var p = planned != null ? planned : 0;
  if (p <= 0) {
    return es ? "Adherencia al plan" : "Plan adherence";
  }
  return (
    c +
    "/" +
    p +
    (es ? " sesiones completadas" : " sessions completed")
  );
}

function emptyBox(es, title) {
  return (
    <div
      style={{
        padding: "28px 16px",
        textAlign: "center",
        color: C.t2,
        border: "1px dashed " + C.brd,
        borderRadius: 10,
        background: C.cardDark,
        ...T.body,
      }}
    >
      {title}
      <div style={{ marginTop: 8, ...T.meta }}>{es ? "Sin datos suficientes" : "Not enough data"}</div>
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
 * }} props
 */
export default function ProgresoView({
  alumnos = [],
  sesionesGlobales = [],
  progresoGlobal = {},
  rutinasSBEntrenador = [],
  allEx = [],
  es = true,
}) {
  const [periodo, setPeriodo] = useState("semanas4");
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
          return na.localeCompare(nb, es ? "es" : "en", { sensitivity: "base" });
        });
    },
    [alumnos, es]
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
        es: es,
      });
    },
    [alumnos, sesionesGlobales, progresoGlobal, rutinasSBEntrenador, allEx, periodo, alumnoSel, diaIdx, ejercicioSelId, es]
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
          <h2 style={{ ...T.screenTitle, color: C.t, margin: 0 }}>Progreso</h2>
        </header>
        <div style={{ padding: S.pagePadding }}>{emptyBox(es, es ? "No tenés alumnos cargados" : "No athletes yet")}</div>
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
            Progreso
          </h2>
          <p style={{ ...T.screenSubtitle, color: C.t2, margin: "6px 0 0 0" }}>
            Seguimiento de carga, adherencia y records personales
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PERIOD_OPTS.map(function (opt) {
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
                {es ? "Evolución de carga" : "Load progression"}
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
                {es ? "Alumno" : "Athlete"}
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
                  es,
                  es
                    ? "Este alumno no tiene una rutina con días cargados"
                    : "This athlete has no routine with training days"
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
                    {es ? "Día de entrenamiento" : "Training day"}
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
                        lbl = es ? "Día " + (i + 1) : "Day " + (i + 1);
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
                    {es
                      ? "Este día no tiene ejercicios en la rutina. Podés elegir otro día o revisar la rutina del alumno."
                      : "This day has no exercises in the routine. Pick another day or review the athlete's plan."}
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
                          {es ? "Calentamiento" : "Warm-up"}
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
                          {es ? "Principal" : "Main"}
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
                emptyBox(es, es ? "No hay registros de carga para este ejercicio" : "No load records for this exercise")
              ) : (
                <>
                  <p style={{ ...T.subtitle, color: C.t2, margin: "0 0 10px 0" }}>
                    {es
                      ? "Bloque actual (4 semanas, lun–dom). Máx. kg registrado por semana."
                      : "Current block (4 weeks, Mon–Sun). Max kg logged per week."}
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
              <CheckCircle size={16} color={C.green} strokeWidth={2} />
              <span style={{ ...T.cardTitle, color: C.t }}>
                {es ? "Adherencia al plan" : "Plan adherence"}
              </span>
            </div>
            {model.adherenciaRows.length === 0 ? (
              emptyBox(es, es ? "Ningún alumno tiene rutina asignada" : "No athletes with an assigned plan")
            ) : (
              model.adherenciaRows.map(function (row) {
                return (
                  <div
                    key={row.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        ...T.bodySemibold,
                        color: "#fff",
                        width: 128,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.n}
                    </div>
                    <div
                      style={{
                        flex: 1,
                        height: 10,
                        background: C.brd,
                        borderRadius: 5,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: row.p + "%",
                          height: "100%",
                          background: row.color,
                          borderRadius: 5,
                          transition: "width 0.5s ease",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        ...T.bodySemibold,
                        fontWeight: 700,
                        width: 40,
                        textAlign: "right",
                        fontFamily: "ui-monospace, monospace",
                        color: row.color,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {row.p}%
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: S.gridGapTight }}>
          <div
            style={{
              background: C.card,
              border: "1px solid " + C.brd,
              borderRadius: 12,
              padding: S.cardPadding,
              minWidth: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: S.blockGap }}>
              <Star size={16} color={C.yel} strokeWidth={2} />
              <span style={{ ...T.cardTitle, color: C.t }}>
                {es ? "PRs recientes" : "Recent PRs"}
              </span>
            </div>
            {model.prsRecientes.length === 0 ? (
              emptyBox(es, es ? "Todavía no hay PRs registrados" : "No PRs logged yet")
            ) : (
              model.prsRecientes.slice(0, 4).map(function (row, idx) {
                var list = model.prsRecientes.slice(0, 4);
                return (
                  <div
                    key={row.initials + row.ex + row.date + idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "11px 0",
                      borderBottom: idx < list.length - 1 ? "1px solid #1e1e2e44" : "none",
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: row.color + "22",
                        color: row.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {row.initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...T.bodySemibold, color: C.t }}>{row.n}</div>
                      <div style={{ ...T.subtitle, color: C.t2, marginTop: 2 }}>{row.ex}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ ...T.numberStatSm, color: C.green }}>{row.val}</div>
                      <div style={{ ...T.subtitle, color: C.green, marginTop: 2 }}>{row.delta}</div>
                      <div style={{ ...T.subtitle, color: C.t2, marginTop: 2 }}>{row.date}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div
            style={{
              background: C.card,
              border: "1px solid " + C.brd,
              borderRadius: 12,
              padding: S.cardPadding,
              minWidth: 0,
            }}
          >
            <div style={{ marginBottom: S.blockGap }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <BarChart2 size={16} color={C.blue} strokeWidth={2} />
                <span style={{ ...T.cardTitle, color: C.t }}>
                  {es ? "Volumen semanal (kg)" : "Weekly volume (kg)"}
                </span>
              </div>
              <p style={{ ...T.subtitle, color: C.t2, margin: "8px 0 0 0" }}>
                {es
                  ? "Bloque actual (4 semanas, lun–dom) · todos los alumnos"
                  : "Current block (4 weeks, Mon–Sun) · all athletes"}
              </p>
            </div>
            <div
              style={{
                marginTop: 10,
                display: "flex",
                justifyContent: "center",
                width: "100%",
                minHeight: 188,
                boxSizing: "border-box",
                padding: "4px 10px 0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  gap: 10,
                  width: "100%",
                  maxWidth: 420,
                  minHeight: 168,
                }}
              >
                {(model.volBars || []).map(function (bar, vidx) {
                  var chartBarMaxPx = 132;
                  var h =
                    maxV > 0 ? (bar.v / maxV) * chartBarMaxPx : 0;
                  if (maxV > 0 && bar.v <= 0) {
                    h = Math.max(h, 4);
                  } else if (maxV <= 0) {
                    h = 4;
                  }
                  var isCurrentWeek = vidx === 3;
                  var barOpacity = isCurrentWeek ? 1 : 0.42;
                  var volLabel =
                    bar.v > 0 ? formatWeeklyVolKgAbbrev(bar.v) : "0";
                  var prevVol =
                    vidx > 0 && model.volBars[vidx - 1]
                      ? model.volBars[vidx - 1].v
                      : null;
                  var diffVsPrev =
                    prevVol != null ? bar.v - prevVol : null;
                  var diffLine = "";
                  if (vidx === 0) {
                    diffLine = es ? "Inicio del bloque" : "Block start";
                  } else if (diffVsPrev != null) {
                    var sign = diffVsPrev > 0 ? "+" : "";
                    diffLine =
                      sign +
                      Math.round(diffVsPrev).toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      }) +
                      " kg " +
                      (es ? "vs anterior" : "vs prev.");
                  }
                  var barGrad =
                    "linear-gradient(180deg, #7dd3fc 0%, #3b82f6 42%, #1d4ed8 100%)";
                  var isHover = volBarHoverIdx === vidx;
                  return (
                    <div
                      key={"vol-bar-" + vidx}
                      style={{
                        flex: "1 1 0",
                        minWidth: 0,
                        maxWidth: 96,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        position: "relative",
                      }}
                      onMouseEnter={function () {
                        setVolBarHoverIdx(vidx);
                      }}
                      onMouseLeave={function () {
                        setVolBarHoverIdx(null);
                      }}
                    >
                      <div
                        style={{
                          ...T.bodySemibold,
                          fontWeight: 700,
                          color: bar.v > 0 ? C.t : C.t2,
                          letterSpacing: 0.2,
                          marginBottom: 8,
                          textAlign: "center",
                          minHeight: 18,
                        }}
                      >
                        {volLabel}
                      </div>
                      <div
                        style={{
                          width: "100%",
                          flex: 1,
                          minHeight: chartBarMaxPx + 8,
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "flex-end",
                          alignItems: "center",
                          position: "relative",
                        }}
                      >
                        {isHover ? (
                          <div
                            style={{
                              position: "absolute",
                              bottom: "calc(100% + 6px)",
                              left: "50%",
                              transform: "translateX(-50%)",
                              zIndex: 5,
                              pointerEvents: "none",
                              whiteSpace: "nowrap",
                              background: "#0f172a",
                              border: "1px solid " + C.brd,
                              borderRadius: 8,
                              padding: "8px 10px",
                              boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
                              fontSize: 11,
                              lineHeight: 1.45,
                              color: C.t,
                              textAlign: "left",
                            }}
                          >
                            <div style={{ fontWeight: 700, marginBottom: 4 }}>
                              {formatWeeklyVolKgFull(bar.v)}
                            </div>
                            <div style={{ color: C.t2, fontWeight: 500 }}>
                              {diffLine}
                            </div>
                          </div>
                        ) : null}
                        <div
                          style={{
                            width: isCurrentWeek ? "78%" : "68%",
                            maxWidth: 56,
                            height: Math.max(0, h) + "px",
                            minHeight: maxV <= 0 ? 4 : 0,
                            borderRadius: 8,
                            backgroundImage:
                              maxV <= 0 || bar.v <= 0 ? "none" : barGrad,
                            backgroundColor:
                              maxV <= 0 || bar.v <= 0 ? "#2a2a3a" : "transparent",
                            opacity:
                              maxV <= 0 && bar.v <= 0 ? 0.35 : barOpacity,
                            boxShadow: isCurrentWeek
                              ? "0 0 0 1px rgba(59,130,246,0.45), 0 6px 18px rgba(37,99,235,0.35)"
                              : "none",
                            transition:
                              "opacity 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease",
                            transform: isHover ? "scaleY(1.02)" : "none",
                            transformOrigin: "bottom center",
                          }}
                        />
                      </div>
                      <span
                        style={{
                          ...T.labelMd,
                          color: isCurrentWeek ? C.blue : C.t2,
                          textAlign: "center",
                          marginTop: 10,
                        }}
                      >
                        {bar.s}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            {maxV <= 0 ? (
              <p style={{ ...T.subtitle, color: C.t2, margin: "12px 0 0 0", textAlign: "center" }}>
                {es ? "Sin volumen registrado en este bloque." : "No volume logged in this block."}
              </p>
            ) : null}
          </div>

          <div
            style={{
              background: "linear-gradient(165deg, #14141c 0%, " + C.card + " 45%, #101018 100%)",
              border: "1px solid " + C.brd,
              borderRadius: 14,
            padding: S.cardPaddingTight,
            minWidth: 0,
            boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 40px rgba(0,0,0,0.35)",
          }}
        >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 16,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 11,
                    background: "linear-gradient(145deg, rgba(59,130,246,0.25) 0%, rgba(59,130,246,0.08) 100%)",
                    border: "1px solid rgba(59,130,246,0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Users size={20} color={C.blue} strokeWidth={2} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ ...T.cardTitle, fontWeight: 800, color: C.t }}>
                    {es ? "Ranking de progreso" : "Progress ranking"}
                  </div>
                  <div style={{ ...T.subtitle, color: C.t2, marginTop: 4 }}>
                    {es ? "Bloque actual · 4 semanas" : "Current block · 4 weeks"}
                  </div>
                </div>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 0.06,
                  textTransform: "uppercase",
                  color: "#93c5fd",
                  background: "rgba(59,130,246,0.12)",
                  border: "1px solid rgba(59,130,246,0.35)",
                  padding: "5px 10px",
                  borderRadius: 999,
                  flexShrink: 0,
                  alignSelf: "flex-start",
                }}
              >
                {es ? "Adherencia" : "Adherence"}
              </span>
            </div>
            {model.ranking.length === 0 ? (
              emptyBox(es, es ? "Sin métricas de adherencia" : "No adherence metrics")
            ) : (
              <div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {rankingTop3.map(function (row, idx) {
                    var medals = ["🥇", "🥈", "🥉"];
                    var topTint = [
                      "linear-gradient(135deg, rgba(234,179,8,0.14) 0%, rgba(234,179,8,0.03) 55%, transparent 100%)",
                      "linear-gradient(135deg, rgba(148,163,184,0.18) 0%, rgba(148,163,184,0.04) 55%, transparent 100%)",
                      "linear-gradient(135deg, rgba(180,83,9,0.16) 0%, rgba(180,83,9,0.04) 55%, transparent 100%)",
                    ];
                    var topBorder = [
                      "1px solid rgba(234,179,8,0.35)",
                      "1px solid rgba(148,163,184,0.35)",
                      "1px solid rgba(180,83,9,0.35)",
                    ];
                    return (
                      <div
                        key={row.id + "-top"}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "14px 14px",
                          borderRadius: 12,
                          background: topTint[idx] || topTint[2],
                          border: topBorder[idx] || topBorder[2],
                          boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
                        }}
                      >
                        <div
                          style={{
                            width: 36,
                            textAlign: "center",
                            fontSize: 22,
                            lineHeight: 1,
                            flexShrink: 0,
                          }}
                          aria-hidden
                        >
                          {medals[idx] || String(idx + 1)}
                        </div>
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: "50%",
                            background: row.color + "28",
                            color: row.color,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 13,
                            fontWeight: 800,
                            flexShrink: 0,
                            border: "2px solid " + row.color + "44",
                            boxShadow: "0 4px 14px " + row.color + "22",
                          }}
                        >
                          {row.initials}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 15,
                              fontWeight: 700,
                              color: C.t,
                              lineHeight: 1.25,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {row.n}
                          </div>
                          <div style={{ fontSize: 12, color: C.t2, marginTop: 4, lineHeight: 1.35 }}>
                            {rankingSessionsLine(row.completed, row.planned, es)}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div
                            style={{
                              fontSize: 22,
                              fontWeight: 900,
                              color: row.color,
                              lineHeight: 1.1,
                              fontVariantNumeric: "tabular-nums",
                              letterSpacing: -0.02,
                            }}
                          >
                            {row.p}%
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {rankingRest.length > 0 ? (
                  <div
                    style={{
                      marginTop: 14,
                      paddingTop: 12,
                      borderTop: "1px solid rgba(30,30,46,0.9)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: 0.08,
                        textTransform: "uppercase",
                        color: C.t2,
                        marginBottom: 8,
                        paddingLeft: 2,
                      }}
                    >
                      {es ? "Resto del ranking" : "Rest of leaderboard"}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {rankingRest.map(function (row, j) {
                        var pos = j + 4;
                        return (
                          <div
                            key={row.id + "-rest"}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "7px 10px",
                              borderRadius: 8,
                              transition: "background 0.15s ease",
                              cursor: "default",
                            }}
                            onMouseEnter={function (e) {
                              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                            }}
                            onMouseLeave={function (e) {
                              e.currentTarget.style.background = "transparent";
                            }}
                          >
                            <div
                              style={{
                                width: 22,
                                fontSize: 12,
                                fontWeight: 800,
                                color: C.t2,
                                textAlign: "center",
                                fontVariantNumeric: "tabular-nums",
                                flexShrink: 0,
                              }}
                            >
                              {pos}
                            </div>
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                background: row.color + "20",
                                color: row.color,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 10,
                                fontWeight: 800,
                                flexShrink: 0,
                              }}
                            >
                              {row.initials}
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                flex: 1,
                                minWidth: 0,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                color: C.t,
                              }}
                            >
                              {row.n}
                            </div>
                            <div
                              style={{
                                width: 56,
                                height: 5,
                                background: "#252536",
                                borderRadius: 3,
                                overflow: "hidden",
                                flexShrink: 0,
                              }}
                            >
                              <div
                                style={{
                                  width: row.p + "%",
                                  height: "100%",
                                  background:
                                    "linear-gradient(90deg, " + row.color + "aa, " + row.color + ")",
                                  borderRadius: 3,
                                }}
                              />
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 800,
                                width: 34,
                                textAlign: "right",
                                fontFamily: "ui-monospace, monospace",
                                color: row.color,
                                fontVariantNumeric: "tabular-nums",
                                flexShrink: 0,
                              }}
                            >
                              {row.p}%
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            background: C.card,
            border: "1px solid " + C.brd,
            borderRadius: 12,
            padding: S.cardPadding,
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <div style={{ marginBottom: S.blockGapLoose }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <PieChart size={16} color={C.blue} strokeWidth={2} />
              <span style={{ ...T.cardTitle, color: C.t }}>
                {es ? "Volumen por patrón muscular" : "Volume by movement pattern"}
              </span>
            </div>
            <p style={{ ...T.subtitle, color: C.t2, margin: 0, paddingLeft: 26 }}>
              {es ? "Bloque actual · 4 semanas" : "Current block · 4 weeks"}
            </p>
          </div>
          {(model.patronTotalVol == null ? 0 : model.patronTotalVol) <= 0 ? (
            <p
              style={{
                ...T.subtitle,
                color: C.t2,
                margin: "0 0 14px 0",
                padding: "10px 12px",
                background: C.cardDark,
                borderRadius: 8,
                border: "1px solid " + C.brd,
              }}
            >
              {es
                ? "Sin volumen registrado en el bloque para estos patrones (últimas 4 semanas)."
                : "No volume logged in this block for these patterns (last 4 weeks)."}
            </p>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: S.blockGapLoose }}>
            {(model.patronPatterns || []).map(function (g) {
              var totalV = model.patronTotalVol != null ? model.patronTotalVol : 0;
              var fillPct =
                totalV > 0 ? Math.min(100, (100 * g.vol) / totalV) : 0;
              var isOpen = !!patronExpanded[g.key];
              return (
                <div key={g.key}>
                  <button
                    type="button"
                    onClick={function () {
                      togglePatronRow(g.key);
                    }}
                    style={{
                      width: "100%",
                      margin: 0,
                      padding: 0,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      textAlign: "left",
                      color: "inherit",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        flexWrap: "wrap",
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          minWidth: 0,
                          flex: "1 1 140px",
                        }}
                      >
                        <ChevronDown
                          size={18}
                          color={C.t2}
                          strokeWidth={2}
                          style={{
                            flexShrink: 0,
                            transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)",
                            transition: "transform 0.18s ease",
                          }}
                        />
                        <span style={{ ...T.bodySemibold, fontWeight: 700, color: C.t, letterSpacing: 0.02 }}>
                          {g.label}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: 10,
                          flexShrink: 0,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        <span style={{ ...T.bodySemibold, fontWeight: 700, color: C.t }}>
                          {formatWeeklyVolKgAbbrev(g.vol)}
                        </span>
                        <span
                          style={{
                            ...T.bodySemibold,
                            fontWeight: 700,
                            color: g.color,
                            minWidth: 44,
                            textAlign: "right",
                          }}
                        >
                          {g.p}%
                        </span>
                      </div>
                    </div>
                    <div
                      style={{
                        height: 10,
                        background: "#15151f",
                        borderRadius: 6,
                        overflow: "hidden",
                        border: "1px solid #252536",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                      }}
                    >
                      <div
                        style={{
                          width: fillPct + "%",
                          height: "100%",
                          borderRadius: 6,
                          background:
                            "linear-gradient(90deg, " + g.color + "99 0%, " + g.color + " 55%, " + g.color + "dd 100%)",
                          boxShadow: "0 0 12px " + g.color + "33",
                        }}
                      />
                    </div>
                  </button>
                  {isOpen ? (
                    <div
                      style={{
                        marginTop: 10,
                        marginLeft: 26,
                        paddingLeft: 12,
                        borderLeft: "2px solid " + C.brd,
                      }}
                    >
                      {(g.exercises || []).length === 0 ? (
                        <div style={{ ...T.subtitle, color: C.t2 }}>
                          {es ? "Sin series registradas en este bloque." : "No sets logged in this block."}
                        </div>
                      ) : (
                        (g.exercises || []).map(function (ex, exi) {
                          var exList = g.exercises || [];
                          return (
                            <div
                              key={g.key + "-" + ex.ejercicio_id}
                              style={{
                                display: "flex",
                                alignItems: "baseline",
                                justifyContent: "space-between",
                                gap: 10,
                                padding: "6px 0",
                                borderBottom:
                                  exi < exList.length - 1 ? "1px solid #1e1e2e44" : "none",
                              }}
                            >
                              <span
                                style={{
                                  ...T.subtitle,
                                  color: C.t,
                                  flex: 1,
                                  minWidth: 0,
                                }}
                              >
                                {ex.name}
                              </span>
                              <span
                                style={{
                                  ...T.labelMd,
                                  color: C.t2,
                                  whiteSpace: "nowrap",
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                {ex.series}{" "}
                                {es ? (ex.series === 1 ? "serie" : "series") : ex.series === 1 ? "set" : "sets"}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
