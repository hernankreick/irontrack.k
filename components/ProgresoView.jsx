import React, { useMemo, useState } from "react";
import {
  BarChart2,
  CheckCircle,
  PieChart,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";

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

const SUMMARY_CHIPS = [
  {
    val: "68%",
    color: C.blue,
    label: "Adherencia promedio",
    delta: "↑ +6% vs período anterior",
    deltaColor: C.green,
  },
  {
    val: "12",
    color: C.green,
    label: "PRs este período",
    delta: "↑ +3 vs período anterior",
    deltaColor: C.green,
  },
  {
    val: "2.4t",
    color: C.yel,
    label: "Volumen semanal prom.",
    delta: "↑ +0.3t vs período anterior",
    deltaColor: C.green,
  },
  {
    val: "1",
    color: C.red,
    label: "Alumno estancado",
    delta: "↓ Sin mejora en 3 semanas",
    deltaColor: C.red,
  },
];

const ALUMNOS = [
  { i: "JL", n: "Julieta", color: "#22c55e" },
  { i: "AT", n: "Agustín", color: "#f59e0b" },
  { i: "MS", n: "Martín", color: "#3b82f6" },
  { i: "LP", n: "Lucas", color: "#a78bfa" },
];

const EJERCICIOS = ["Sentadilla", "Press banca", "Peso muerto", "Dominadas"];

const SERIES_DATA = {
  "JL-Sentadilla": [70, 75, 75, 80, 80, 85, 90, 95],
  "JL-Press banca": [50, 52, 55, 55, 57, 60, 62, 65],
  "AT-Sentadilla": [80, 80, 82, 85, 85, 85, 83, 85],
  "AT-Press banca": [60, 62, 65, 65, 67, 70, 70, 72],
  "MS-Sentadilla": [90, 95, 100, 100, 105, 107, 110, 115],
  "MS-Press banca": [70, 72, 75, 77, 80, 82, 85, 87],
  "LP-Sentadilla": [60, 65, 67, 70, 72, 75, 78, 80],
  "LP-Press banca": [45, 47, 50, 52, 55, 57, 60, 62],
};

const FALLBACK_SERIES = [60, 65, 68, 70, 72, 75, 78, 80];

const ADHERENCIA_ROWS = [
  { n: "Lucas Peralta", p: 91, color: "#22c55e" },
  { n: "Julieta Laroze", p: 82, color: "#22c55e" },
  { n: "Martín Sosa", p: 67, color: "#eab308" },
  { n: "Agustín Torres", p: 45, color: "#eab308" },
  { n: "Hernán Kreick", p: 0, color: "#ef4444" },
];

const PRS_RECIENTES = [
  {
    i: "MS",
    n: "Martín",
    ex: "Sentadilla",
    val: "115kg",
    delta: "+5kg",
    date: "Hoy",
    color: "#3b82f6",
  },
  {
    i: "JL",
    n: "Julieta",
    ex: "Press banca",
    val: "65kg",
    delta: "+3kg",
    date: "Ayer",
    color: "#22c55e",
  },
  {
    i: "LP",
    n: "Lucas",
    ex: "Peso muerto",
    val: "140kg",
    delta: "+10kg",
    date: "Hace 2d",
    color: "#a78bfa",
  },
  {
    i: "AT",
    n: "Agustín",
    ex: "Dominadas",
    val: "BW+25",
    delta: "+5kg",
    date: "Hace 3d",
    color: "#f59e0b",
  },
];

const VOLUMEN_SEM = [
  { s: "S1", v: 1800 },
  { s: "S2", v: 2100 },
  { s: "S3", v: 2050 },
  { s: "S4", v: 2400 },
  { s: "S5", v: 2200 },
  { s: "S6", v: 2600 },
  { s: "S7", v: 2450 },
  { s: "S8", v: 2800 },
];

const RANKING = [
  { i: "LP", n: "Lucas Peralta", p: 91, color: "#22c55e" },
  { i: "JL", n: "Julieta Laroze", p: 82, color: "#22c55e" },
  { i: "MS", n: "Martín Sosa", p: 67, color: "#eab308" },
  { i: "AT", n: "Agustín Torres", p: 45, color: "#eab308" },
  { i: "HK", n: "Hernán Kreick", p: 0, color: "#ef4444" },
];

const GRUPOS = [
  { n: "Pierna", p: 34, color: "#3b82f6" },
  { n: "Empuje", p: 24, color: "#a78bfa" },
  { n: "Tirón", p: 22, color: "#22c55e" },
  { n: "Core", p: 12, color: "#eab308" },
  { n: "Aeróbico", p: 5, color: "#f59e0b" },
  { n: "Movilidad", p: 3, color: "#64748b" },
];

const PERIOD_OPTS = [
  { id: "semanas4", label: "4 semanas" },
  { id: "semanas8", label: "8 semanas" },
  { id: "meses3", label: "3 meses" },
];

function medalColor(pos) {
  if (pos === 1) return "#f59e0b";
  if (pos === 2) return "#94a3b8";
  if (pos === 3) return "#b45309";
  return C.t2;
}

export default function ProgresoView() {
  const [periodo, setPeriodo] = useState("semanas4");
  const [alumnoSel, setAlumnoSel] = useState("JL");
  const [ejercicioSel, setEjercicioSel] = useState("Sentadilla");

  const alumnoColor = useMemo(function () {
    var f = ALUMNOS.find(function (a) {
      return a.i === alumnoSel;
    });
    return f ? f.color : C.blue;
  }, [alumnoSel]);

  const chartComputed = useMemo(
    function () {
      var key = alumnoSel + "-" + ejercicioSel;
      var data = SERIES_DATA[key] || FALLBACK_SERIES;
      var n = data.length;
      var min = Math.min.apply(null, data) - 5;
      var max = Math.max.apply(null, data) + 5;
      var range = max - min || 1;
      var points = data.map(function (v, i) {
        var x = n <= 1 ? 150 : (i / (n - 1)) * 300;
        var y = 100 - ((v - min) / range) * 100;
        return { x: x, y: y, v: v };
      });
      var poly = points
        .map(function (pt) {
          return pt.x + "," + pt.y;
        })
        .join(" ");
      return { points: points, poly: poly, min: min, max: max };
    },
    [alumnoSel, ejercicioSel]
  );

  var maxV = Math.max.apply(
    null,
    VOLUMEN_SEM.map(function (x) {
      return x.v;
    })
  );

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
        {/* Bloque 1 — chips */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {SUMMARY_CHIPS.map(function (c) {
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

        {/* Bloque 2 */}
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
              <span style={{ fontSize: 14, fontWeight: 600, color: C.t }}>Evolución de carga</span>
            </div>

            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
              {ALUMNOS.map(function (a) {
                var act = alumnoSel === a.i;
                return (
                  <button
                    key={a.i}
                    type="button"
                    onClick={function () {
                      setAlumnoSel(a.i);
                    }}
                    style={{
                      border: "1px solid " + (act ? C.blue : C.brd),
                      background: act ? "#1e3a8a22" : "transparent",
                      color: act ? a.color : C.t2,
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "5px 10px",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {a.n}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
              {EJERCICIOS.map(function (ex) {
                var act = ejercicioSel === ex;
                return (
                  <button
                    key={ex}
                    type="button"
                    onClick={function () {
                      setEjercicioSel(ex);
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
                    }}
                  >
                    {ex}
                  </button>
                );
              })}
            </div>

            <svg
              viewBox="0 0 300 100"
              width="100%"
              height={110}
              style={{ display: "block" }}
            >
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
                    <text
                      x={pt.x}
                      y={pt.y - 8}
                      fill={C.t}
                      fontSize={8}
                      fontWeight={700}
                      textAnchor="middle"
                    >
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
              {["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"].map(function (s) {
                return (
                  <span key={s}>
                    {s}
                  </span>
                );
              })}
            </div>
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
              <span style={{ fontSize: 14, fontWeight: 600, color: C.t }}>Adherencia al plan</span>
            </div>
            {ADHERENCIA_ROWS.map(function (row) {
              return (
                <div
                  key={row.n}
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
            })}
          </div>
        </div>

        {/* Bloque 3 */}
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
              <span style={{ fontSize: 14, fontWeight: 600, color: C.t }}>PRs recientes</span>
            </div>
            {PRS_RECIENTES.map(function (row, idx) {
              return (
                <div
                  key={row.i + row.ex + row.date}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 0",
                    borderBottom: idx < PRS_RECIENTES.length - 1 ? "1px solid #1e1e2e44" : "none",
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
                    {row.i}
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
            })}
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
              <span style={{ fontSize: 14, fontWeight: 600, color: C.t }}>Volumen semanal (kg)</span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 5,
                height: 90,
                marginTop: 8,
              }}
            >
              {VOLUMEN_SEM.map(function (bar) {
                var h = (bar.v / maxV) * 80;
                var barColor = bar.v >= 2500 ? C.green : bar.v >= 2000 ? C.blue : C.yel;
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
              <span style={{ fontSize: 14, fontWeight: 600, color: C.t }}>Ranking de progreso</span>
            </div>
            {RANKING.map(function (row, idx) {
              var pos = idx + 1;
              return (
                <div
                  key={row.i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 0",
                    borderBottom: idx < RANKING.length - 1 ? "1px solid #1e1e2e33" : "none",
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
                    {row.i}
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
            })}
          </div>
        </div>

        {/* Bloque 4 */}
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
              <span style={{ fontSize: 14, fontWeight: 600, color: C.t }}>Grupos musculares</span>
            </div>
            <span style={{ fontSize: 10, color: C.t2 }}>Últimas 4 semanas · todos los alumnos</span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              columnGap: 8,
              rowGap: 24,
            }}
          >
            {GRUPOS.map(function (g) {
              return (
                <div
                  key={g.n}
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
        </div>
      </div>
    </div>
  );
}
