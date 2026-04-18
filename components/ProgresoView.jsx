import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart2,
  CheckCircle,
  PieChart,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { buildCoachProgresoModel, getRoutineForAlumno } from "./coachProgresoMetrics.js";

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

var selectBaseStyle = {
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
  padding: "8px 10px",
  fontSize: 12,
  fontWeight: 600,
  color: "#ffffff",
  background: "#0d0d15",
  border: "1px solid #1e1e2e",
  borderRadius: 8,
  fontFamily: "inherit",
  cursor: "pointer",
  outline: "none",
};

function medalColor(pos) {
  if (pos === 1) return "#f59e0b";
  if (pos === 2) return "#94a3b8";
  if (pos === 3) return "#b45309";
  return C.t2;
}

function emptyBox(es, title) {
  return (
    <div
      style={{
        padding: "28px 16px",
        textAlign: "center",
        color: C.t2,
        fontSize: 12,
        lineHeight: 1.45,
        border: "1px dashed " + C.brd,
        borderRadius: 10,
        background: C.cardDark,
      }}
    >
      {title}
      <div style={{ marginTop: 6, fontSize: 11 }}>{es ? "Sin datos suficientes" : "Not enough data"}</div>
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
      var pts = [];
      for (var i = 0; i < series.length; i++) {
        if (series[i] == null) continue;
        var x = series.length <= 1 ? 150 : (i / (series.length - 1)) * 300;
        var v = series[i];
        pts.push({ x: x, y: 0, v: v, idx: i });
      }
      if (!pts.length) {
        return { points: [], poly: "", empty: true };
      }
      var vals = pts.map(function (p) {
        return p.v;
      });
      var min = Math.min.apply(null, vals) - 5;
      var max = Math.max.apply(null, vals) + 5;
      var range = max - min || 1;
      pts.forEach(function (p) {
        p.y = 100 - ((p.v - min) / range) * 100;
      });
      var poly = pts
        .map(function (pt) {
          return pt.x + "," + pt.y;
        })
        .join(" ");
      return { points: pts, poly: poly, empty: false };
    },
    [model.chartSeries]
  );

  var maxV = Math.max.apply(
    null,
    (model.volBars || []).map(function (x) {
      return x.v;
    }).concat([0])
  );

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
            padding: "14px 18px",
            borderBottom: "1px solid " + C.brd,
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, color: C.t, margin: 0 }}>Progreso</h2>
        </header>
        <div style={{ padding: 24 }}>{emptyBox(es, es ? "No tenés alumnos cargados" : "No athletes yet")}</div>
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
          padding: "14px 18px",
          borderBottom: "1px solid " + C.brd,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: C.t, margin: 0, lineHeight: 1.25 }}>
            Progreso
          </h2>
          <p style={{ fontSize: 11, color: C.t2, margin: "4px 0 0 0", lineHeight: 1.35 }}>
            Seguimiento de carga, adherencia y records personales
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "6px 12px",
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
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
          {model.summaryChips.map(function (c) {
            return (
              <div
                key={c.label}
                style={{
                  background: C.cardDark,
                  border: "1px solid " + C.brd,
                  borderRadius: 8,
                  padding: "8px 12px",
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1, color: c.color }}>{c.val}</div>
                <div style={{ fontSize: 10, color: C.t2, marginTop: 2 }}>{c.label}</div>
                <div style={{ fontSize: 10, color: c.deltaColor, marginTop: 3 }}>{c.delta}</div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div
            style={{
              background: C.card,
              border: "1px solid " + C.brd,
              borderRadius: 12,
              padding: 16,
              minWidth: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <TrendingUp size={13} color={C.blue} strokeWidth={2} />
              <span style={{ fontSize: 14, fontWeight: 600, color: C.t }}>
                {es ? "Evolución de carga" : "Load progression"}
              </span>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ display: "block", fontSize: 10, color: C.t2, marginBottom: 4, fontWeight: 600 }}>
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
              <div style={{ marginBottom: 10 }}>
                {emptyBox(
                  es,
                  es
                    ? "Este alumno no tiene una rutina con días cargados"
                    : "This athlete has no routine with training days"
                )}
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: "block", fontSize: 10, color: C.t2, marginBottom: 4, fontWeight: 600 }}>
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
                  <div style={{ fontSize: 11, color: C.t2, marginBottom: 10, lineHeight: 1.4 }}>
                    {es
                      ? "Este día no tiene ejercicios en la rutina. Podés elegir otro día o revisar la rutina del alumno."
                      : "This day has no exercises in the routine. Pick another day or review the athlete's plan."}
                  </div>
                ) : (
                  <>
                    {(model.exerciseOptions || []).some(function (o) {
                      return o.section === "warmup";
                    }) ? (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 10, color: C.t2, marginBottom: 6, fontWeight: 600, letterSpacing: 0.3 }}>
                          {es ? "Calentamiento" : "Warm-up"}
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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
                                    fontSize: 11,
                                    fontWeight: 600,
                                    padding: "5px 10px",
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
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, color: C.t2, marginBottom: 6, fontWeight: 600, letterSpacing: 0.3 }}>
                          {es ? "Principal" : "Main"}
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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
                                    fontSize: 11,
                                    fontWeight: 600,
                                    padding: "5px 10px",
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
                  <svg viewBox="0 0 300 100" width="100%" height={110} style={{ display: "block" }}>
                    <polyline
                      fill="none"
                      stroke={alumnoColor}
                      strokeWidth={2.5}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      points={chartComputed.poly}
                    />
                    {chartComputed.points.map(function (pt, i) {
                      return (
                        <g key={"pt-" + i}>
                          <circle r={3.5} cx={pt.x} cy={pt.y} fill={alumnoColor} />
                          <text x={pt.x} y={pt.y - 8} fill={C.t} fontSize={8} fontWeight={700} textAnchor="middle">
                            {pt.v}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: 4,
                      fontSize: 9,
                      color: C.t2,
                    }}
                  >
                    {(model.chartWeekLabels || []).map(function (s) {
                      return (
                        <span key={s}>
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
              padding: 16,
              minWidth: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <CheckCircle size={13} color={C.green} strokeWidth={2} />
              <span style={{ fontSize: 14, fontWeight: 600, color: C.t }}>
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
                      gap: 10,
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: "#fff",
                        width: 110,
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
                        height: 8,
                        background: C.brd,
                        borderRadius: 4,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: row.p + "%",
                          height: "100%",
                          background: row.color,
                          borderRadius: 4,
                          transition: "width 0.5s ease",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        width: 32,
                        textAlign: "right",
                        fontFamily: "ui-monospace, monospace",
                        color: row.color,
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div
            style={{
              background: C.card,
              border: "1px solid " + C.brd,
              borderRadius: 12,
              padding: 16,
              minWidth: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Star size={13} color={C.yel} strokeWidth={2} />
              <span style={{ fontSize: 14, fontWeight: 600, color: C.t }}>{es ? "PRs recientes" : "Recent PRs"}</span>
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
                      gap: 10,
                      padding: "8px 0",
                      borderBottom: idx < list.length - 1 ? "1px solid #1e1e2e44" : "none",
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: row.color + "22",
                        color: row.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {row.initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.t }}>{row.n}</div>
                      <div style={{ fontSize: 10, color: C.t2 }}>{row.ex}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: C.green }}>{row.val}</div>
                      <div style={{ fontSize: 10, color: C.green }}>{row.delta}</div>
                      <div style={{ fontSize: 10, color: C.t2 }}>{row.date}</div>
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
              padding: 16,
              minWidth: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <BarChart2 size={13} color={C.blue} strokeWidth={2} />
              <span style={{ fontSize: 14, fontWeight: 600, color: C.t }}>
                {es ? "Volumen semanal (kg)" : "Weekly volume (kg)"}
              </span>
            </div>
            {maxV <= 0 ? (
              emptyBox(es, es ? "Sin volumen registrado en las últimas semanas" : "No volume in recent weeks")
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 5,
                  height: 90,
                  marginTop: 8,
                }}
              >
                {model.volBars.map(function (bar) {
                  var h = maxV > 0 ? (bar.v / maxV) * 80 : 0;
                  var barColor =
                    maxV <= 0 ? C.blue : bar.v >= 0.85 * maxV ? C.green : bar.v >= 0.5 * maxV ? C.blue : C.yel;
                  return (
                    <div
                      key={bar.s}
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 3,
                        minWidth: 0,
                      }}
                    >
                      <span style={{ fontSize: 9, color: C.blue, fontWeight: 600 }}>
                        {(bar.v / 1000).toFixed(1) + "t"}
                      </span>
                      <div
                        style={{
                          width: "100%",
                          height: h + "px",
                          background: barColor,
                          borderRadius: "3px 3px 0 0",
                        }}
                      />
                      <span style={{ fontSize: 9, color: C.t2 }}>{bar.s}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div
            style={{
              background: C.card,
              border: "1px solid " + C.brd,
              borderRadius: 12,
              padding: 16,
              minWidth: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Users size={13} color={C.blue} strokeWidth={2} />
              <span style={{ fontSize: 14, fontWeight: 600, color: C.t }}>{es ? "Ranking de progreso" : "Progress ranking"}</span>
            </div>
            {model.ranking.length === 0 ? (
              emptyBox(es, es ? "Sin métricas de adherencia" : "No adherence metrics")
            ) : (
              model.ranking.map(function (row, idx) {
                var pos = idx + 1;
                return (
                  <div
                    key={row.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "7px 0",
                      borderBottom: idx < model.ranking.length - 1 ? "1px solid #1e1e2e33" : "none",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        width: 18,
                        color: medalColor(pos),
                      }}
                    >
                      {pos}
                    </div>
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: row.color + "22",
                        color: row.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 9,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {row.initials}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        flex: 1,
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
                        width: 70,
                        height: 6,
                        background: C.brd,
                        borderRadius: 3,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: row.p + "%",
                          height: "100%",
                          background: row.color,
                        }}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        width: 30,
                        textAlign: "right",
                        fontFamily: "ui-monospace, monospace",
                        color: row.color,
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

        <div
          style={{
            background: C.card,
            border: "1px solid " + C.brd,
            borderRadius: 12,
            padding: 16,
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <PieChart size={13} color={C.blue} strokeWidth={2} />
              <span style={{ fontSize: 14, fontWeight: 600, color: C.t }}>{es ? "Grupos musculares" : "Muscle groups"}</span>
            </div>
            <span style={{ fontSize: 10, color: C.t2 }}>{model.muscleSubtitle}</span>
          </div>
          {model.grupos.length === 0 || model.gruposTotalVol <= 0 ? (
            emptyBox(es, es ? "Sin volumen por grupo en el período" : "No per-group volume in this period")
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                columnGap: 8,
                rowGap: 24,
              }}
            >
              {model.grupos.map(function (g) {
                return (
                  <div
                    key={g.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 7,
                    }}
                  >
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        background: g.color,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 11, color: "#fff", flex: 1 }}>{g.n}</span>
                    <div
                      style={{
                        width: 100,
                        height: 5,
                        background: C.brd,
                        borderRadius: 3,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: g.p + "%",
                          height: "100%",
                          background: g.color,
                        }}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        width: 30,
                        textAlign: "right",
                        fontFamily: "ui-monospace, monospace",
                        color: g.color,
                      }}
                    >
                      {g.p}%
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
