import React from "react";

// Lienzo del grafico (unidades del viewBox). Los valores y la escala vienen de chartComputed (ProgresoView):
// aqui solo se reparten las posiciones visuales (columna por semana, margenes arriba/abajo).
var VB_W = 300;
var VB_H = 116;
var PLOT_TOP = 32; // deja sitio al anillo del maximo y a la etiqueta de valor sin recorte
var PLOT_BOTTOM = 82;
var AXIS_Y = 104; // marcadores de "sin registro" / "proxima": en el eje, nunca a altura de un valor

var SR_ONLY = {
  position: "absolute",
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

function round1(n) {
  return Math.round(n * 10) / 10;
}

/**
 * Estado visual de cada semana. SOLO PRESENTACION: no recalcula valores.
 *  - status "data": la semana tiene dato (v viene de chartComputed).
 *  - status "missing": semana pasada (o desconocida) sin dato. Nunca es 0.
 *  - status "future": indice > currentRoutineWeekIndex y sin dato. Si currentRoutineWeekIndex no es numerico, se trata como "missing".
 *  - isMax: mayor valor entre las semanas con dato (solo si hay >= 2 semanas con dato y no son todas iguales).
 *  - delta: resta de dos valores YA mostrados (semana i menos semana i-1), solo si AMBAS tienen dato; si no, null.
 */
export function buildLoadWeekModel(chartComputed, currentRoutineWeekIndex) {
  var pts = (chartComputed && chartComputed.chartPoints) || [];
  var known = typeof currentRoutineWeekIndex === "number" && isFinite(currentRoutineWeekIndex);
  var vals = [];
  pts.forEach(function (p) {
    if (p && p.hasData) vals.push(p.v);
  });
  var maxV = vals.length ? Math.max.apply(null, vals) : null;
  var minV = vals.length ? Math.min.apply(null, vals) : null;
  var markMax = vals.length >= 2 && maxV !== minV;
  return pts.map(function (p, i) {
    var hasData = !!(p && p.hasData);
    var status = hasData ? "data" : known && i > currentRoutineWeekIndex ? "future" : "missing";
    var prev = i > 0 ? pts[i - 1] : null;
    var delta = hasData && prev && prev.hasData ? round1(p.v - prev.v) : null;
    return {
      i: i,
      hasData: hasData,
      v: hasData ? p.v : null,
      yFrac: hasData ? p.y / 100 : null,
      status: status,
      isMax: hasData && markMax && p.v === maxV,
      delta: delta,
    };
  });
}

function fmtDelta(d) {
  var a = Math.abs(d);
  return (d > 0 ? "+" : "−") + a;
}

export default function ProgressLoadChart({
  chartComputed,
  weekLabels,
  alumnoColor,
  C,
  T,
  lang,
  M,
  currentRoutineWeekIndex,
}) {
  var weeks = buildLoadWeekModel(chartComputed, currentRoutineWeekIndex);
  var n = weeks.length || 1;
  var colW = VB_W / n;
  var labels = weekLabels || [];

  var tMax = M(lang, "Máx.", "Max", "Máx.");
  var tNone = M(lang, "Sin registro", "No record", "Sem registro");
  var tNext = M(lang, "Próxima", "Upcoming", "Próxima");
  var tSame = M(lang, "Igual", "Same", "Igual");
  var tWith = M(lang, "Con registro", "Logged", "Com registro");
  var tLegend = M(lang, "Leyenda", "Legend", "Legenda");

  var xs = weeks.map(function (w) {
    return (w.i + 0.5) * colW;
  });
  var ys = weeks.map(function (w) {
    return w.hasData ? PLOT_TOP + w.yFrac * (PLOT_BOTTOM - PLOT_TOP) : null;
  });

  var segments = [];
  for (var j = 0; j < weeks.length - 1; j++) {
    if (weeks[j].hasData && weeks[j + 1].hasData) {
      segments.push(xs[j] + "," + ys[j] + " " + xs[j + 1] + "," + ys[j + 1]);
    }
  }

  var summary = weeks
    .map(function (w) {
      var lbl = labels[w.i] || "";
      var what = w.hasData ? w.v + " kg" : w.status === "future" ? tNext : tNone;
      return lbl + ": " + what;
    })
    .join(", ");

  var hasMissing = weeks.some(function (w) {
    return w.status === "missing";
  });
  var hasFuture = weeks.some(function (w) {
    return w.status === "future";
  });
  var legendItem = { display: "inline-flex", alignItems: "center", gap: 5 };

  return (
    <>
      <p style={{ ...T.subtitle, color: C.t2, margin: "0 0 10px 0" }}>
        {M(
          lang,
          "Bloque actual (4 semanas, lun–dom). Máx. kg registrado por semana.",
          "Current block (4 weeks, Mon–Sun). Max kg logged per week.",
          "Bloco atual (4 semanas, seg–dom). Máx. kg registrado por semana."
        )}
      </p>
      <div
        data-qa-load-chart="1"
        role="group"
        aria-label={M(lang, "Evolución de carga por semana", "Weekly load progression", "Evolução de carga por semana") + ". " + summary}
        style={{ position: "relative", width: "100%", maxWidth: 440, margin: "0 auto" }}
      >
        <svg
          data-qa-load-svg="1"
          viewBox={"0 0 " + VB_W + " " + VB_H}
          width="100%"
          aria-hidden="true"
          focusable="false"
          style={{ display: "block", width: "100%", height: "auto" }}
        >
          <line x1={0} x2={VB_W} y1={AXIS_Y} y2={AXIS_Y} stroke={C.brd} strokeWidth={1} />
          {segments.map(function (seg, si) {
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
          {weeks.map(function (w) {
            var x = xs[w.i];
            if (w.hasData) {
              var y = ys[w.i];
              return (
                <g key={"pt-" + w.i}>
                  {w.isMax ? <circle r={9} cx={x} cy={y} fill="none" stroke={alumnoColor} strokeWidth={2} /> : null}
                  <circle r={5} cx={x} cy={y} fill={alumnoColor} stroke={C.card} strokeWidth={1.5} />
                  <text x={x} y={y - (w.isMax ? 15 : 11)} fill={C.t} fontSize={14} fontWeight={700} textAnchor="middle">
                    {w.v}
                  </text>
                </g>
              );
            }
            if (w.status === "future") {
              return (
                <circle
                  key={"pt-" + w.i}
                  r={4.5}
                  cx={x}
                  cy={AXIS_Y}
                  fill="none"
                  stroke={C.t2}
                  strokeWidth={1.5}
                  strokeDasharray="2.5 2.5"
                  opacity={0.7}
                />
              );
            }
            return <circle key={"pt-" + w.i} r={3.5} cx={x} cy={AXIS_Y} fill="none" stroke={C.t2} strokeWidth={1.5} opacity={0.6} />;
          })}
        </svg>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(" + n + ", minmax(0, 1fr))",
            marginTop: 6,
          }}
        >
          {weeks.map(function (w) {
            var d = w.delta;
            return (
              <div
                key={"wl-" + w.i}
                style={{
                  minWidth: 0,
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  padding: "0 2px",
                }}
              >
                <span style={{ ...T.labelMd, color: w.status === "data" ? C.t : C.t2, overflowWrap: "anywhere" }}>
                  {labels[w.i] || ""}
                </span>
                {w.hasData ? <span style={SR_ONLY}>{w.v + " kg"}</span> : null}
                {w.isMax ? (
                  <span
                    style={{
                      ...T.meta,
                      fontWeight: 700,
                      color: C.t,
                      background: C.cardDark,
                      border: "1px solid " + alumnoColor,
                      borderRadius: 99,
                      padding: "0 7px",
                      lineHeight: 1.5,
                    }}
                  >
                    {tMax}
                  </span>
                ) : null}
                {d != null ? (
                  <span style={{ ...T.meta, color: C.t, overflowWrap: "anywhere" }}>
                    <span aria-hidden="true" style={{ color: d > 0 ? C.green : d < 0 ? C.red : C.t2, fontWeight: 700 }}>
                      {d > 0 ? "\u2191" : d < 0 ? "\u2193" : "="}
                    </span>
                    {d !== 0 ? <span style={SR_ONLY}>{d > 0 ? M(lang, "Subió", "Up", "Subiu") : M(lang, "Bajó", "Down", "Baixou")}</span> : null}
                    {" " + (d === 0 ? tSame : fmtDelta(d) + " kg")}
                  </span>
                ) : null}
                {w.status === "missing" ? (
                  <span style={{ ...T.meta, color: C.t2 }}>{tNone}</span>
                ) : w.status === "future" ? (
                  <span style={{ ...T.meta, color: C.t2, fontStyle: "italic" }}>{tNext}</span>
                ) : null}
              </div>
            );
          })}
        </div>
        {hasMissing || hasFuture ? (
          <ul
            aria-label={tLegend}
            style={{
              listStyle: "none",
              margin: "10px 0 0",
              padding: 0,
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "4px 14px",
              ...T.meta,
              color: C.t2,
            }}
          >
            <li style={legendItem}>
              <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden="true" focusable="false">
                <circle cx={5} cy={5} r={4} fill={alumnoColor} />
              </svg>
              {tWith}
            </li>
            {hasMissing ? (
              <li style={legendItem}>
                <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden="true" focusable="false">
                  <circle cx={5} cy={5} r={3.5} fill="none" stroke={C.t2} strokeWidth={1.5} opacity={0.7} />
                </svg>
                {tNone}
              </li>
            ) : null}
            {hasFuture ? (
              <li style={legendItem}>
                <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden="true" focusable="false">
                  <circle cx={5} cy={5} r={3.5} fill="none" stroke={C.t2} strokeWidth={1.5} strokeDasharray="2 2" opacity={0.8} />
                </svg>
                {tNext}
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </>
  );
}
