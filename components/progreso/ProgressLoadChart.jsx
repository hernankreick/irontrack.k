import React from "react";

// Lienzo del grafico (unidades del viewBox). Los valores vienen de chartComputed (ProgresoView) y NO se modifican:
// aqui solo se calcula la escala vertical VISUAL (min/max con margen) y las posiciones de cada semana.
var VB_W = 300;
var VB_H = 132;
var PAD_L = 34; // sitio para las marcas del eje Y ("102.5")
var PAD_R = 6;
var PLOT_TOP = 24; // deja sitio al anillo del maximo y a la etiqueta de valor sin recorte
var PLOT_BOTTOM = 94;
var AXIS_Y = 116; // marcadores de "sin registro" / "proxima": en el eje, nunca a altura de un valor
var HIT = 44; // area tactil de cada punto (px), independiente del circulo visible

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

function cleanNum(n) {
  return Math.round(n * 10000) / 10000;
}

/**
 * Escala vertical VISUAL (no toca los valores): dominio = [min, max] de los valores con dato mas ~25% de margen.
 * Con un solo valor o valores iguales se crea un rango artificial centrado (nunca se divide por cero). No se asume base 0.
 * Devuelve { d0, d1, ticks } con 2 a 4 marcas de valores "redondos" (paso 1/2/2.5/5 x 10^k) dentro del dominio.
 */
export function buildYScale(values) {
  var vals = (values || []).filter(function (v) {
    return typeof v === "number" && isFinite(v);
  });
  if (!vals.length) return { d0: 0, d1: 1, ticks: [] };
  var lo = Math.min.apply(null, vals);
  var hi = Math.max.apply(null, vals);
  var pad = hi === lo ? Math.max(Math.abs(hi) * 0.1, 2.5) : (hi - lo) * 0.25;
  var d0 = lo - pad;
  var d1 = hi + pad;
  var raw = (d1 - d0) / 3;
  var mag = Math.pow(10, Math.floor(Math.log10(raw)));
  var mults = [1, 2, 2.5, 5, 10, 20];
  var ticks = [];
  for (var k = 0; k < mults.length; k++) {
    var step = mults[k] * mag;
    var first = Math.ceil(d0 / step - 1e-9);
    var last = Math.floor(d1 / step + 1e-9);
    if (last - first + 1 <= 4 && last - first + 1 >= 2) {
      for (var t = first; t <= last; t++) ticks.push(cleanNum(t * step));
      break;
    }
  }
  if (!ticks.length) ticks = lo === hi ? [cleanNum(lo)] : [cleanNum(lo), cleanNum(hi)];
  return { d0: d0, d1: d1, ticks: ticks };
}

// Posicion vertical (unidades del viewBox) de un valor segun la escala; mayor valor = mas arriba.
export function yPos(v, scale, top, bottom) {
  var span = scale.d1 - scale.d0 || 1;
  return bottom - ((v - scale.d0) / span) * (bottom - top);
}

// Pares [i, i+1] a unir con linea: SOLO semanas consecutivas con dato ambas. Nunca atraviesa un hueco.
export function buildLineSegments(weeks) {
  var out = [];
  for (var j = 0; j < (weeks || []).length - 1; j++) {
    if (weeks[j].hasData && weeks[j + 1].hasData) out.push([j, j + 1]);
  }
  return out;
}

// Seleccion por defecto: la ULTIMA semana con dato (la mas reciente). null si no hay ninguna.
export function defaultSelectedWeek(weeks) {
  var sel = null;
  (weeks || []).forEach(function (w) {
    if (w.hasData) sel = w.i;
  });
  return sel;
}

// Tocar un punto lo selecciona; tocar el seleccionado lo cierra. Solo semanas con dato son seleccionables.
export function nextSelectedWeek(current, i, weeks) {
  if (!weeks || !weeks[i] || !weeks[i].hasData) return current;
  return current === i ? null : i;
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
  var plotW = VB_W - PAD_L - PAD_R;
  var colW = plotW / n;
  var labels = weekLabels || [];

  var tMax = M(lang, "Máx.", "Max", "Máx.");
  var tNone = M(lang, "Sin registro", "No record", "Sem registro");
  var tNext = M(lang, "Próxima", "Upcoming", "Próxima");
  var tSame = M(lang, "Igual", "Same", "Igual");
  var tWith = M(lang, "Con registro", "Logged", "Com registro");
  var tLegend = M(lang, "Leyenda", "Legend", "Legenda");
  var tWeek = M(lang, "Semana", "Week", "Semana");
  var tHint = M(lang, "Toca un punto para ver el detalle", "Tap a point to see the details", "Toque em um ponto para ver o detalhe");
  var tVs = M(lang, "vs", "vs", "vs");

  var weekName = function (i) {
    return labels[i] || tWeek + " " + (i + 1);
  };
  var xs = weeks.map(function (w) {
    return PAD_L + (w.i + 0.5) * colW;
  });
  var scale = buildYScale(
    weeks
      .filter(function (w) {
        return w.hasData;
      })
      .map(function (w) {
        return w.v;
      })
  );
  var ys = weeks.map(function (w) {
    return w.hasData ? yPos(w.v, scale, PLOT_TOP, PLOT_BOTTOM) : null;
  });
  var segments = buildLineSegments(weeks);

  // Seleccion: undefined = por defecto (ultima semana con dato), null = cerrada, numero = semana tocada.
  var sig = weeks
    .map(function (w) {
      return w.hasData ? w.v : "-";
    })
    .join("|");
  var selState = React.useState(undefined);
  var userSel = selState[0];
  var setUserSel = selState[1];
  var rootRef = React.useRef(null);
  React.useEffect(
    function () {
      setUserSel(undefined);
    },
    [sig]
  );
  React.useEffect(function () {
    function onDown(e) {
      if (rootRef.current && e.target && !rootRef.current.contains(e.target)) setUserSel(null);
    }
    document.addEventListener("pointerdown", onDown);
    return function () {
      document.removeEventListener("pointerdown", onDown);
    };
  }, []);
  var selected = userSel === undefined ? defaultSelectedWeek(weeks) : userSel;
  if (selected != null && !(weeks[selected] && weeks[selected].hasData)) selected = defaultSelectedWeek(weeks);
  var selW = selected != null ? weeks[selected] : null;

  var summary = weeks
    .map(function (w) {
      var what = w.hasData ? w.v + " kg" : w.status === "future" ? tNext : tNone;
      return weekName(w.i) + ": " + what;
    })
    .join(", ");

  var hasMissing = weeks.some(function (w) {
    return w.status === "missing";
  });
  var hasFuture = weeks.some(function (w) {
    return w.status === "future";
  });
  var legendItem = { display: "inline-flex", alignItems: "center", gap: 5 };
  var pct = function (v, total) {
    return (v / total) * 100 + "%";
  };

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
        ref={rootRef}
        data-qa-load-chart="1"
        role="group"
        aria-label={M(lang, "Evolución de carga por semana", "Weekly load progression", "Evolução de carga por semana") + ". " + summary}
        onKeyDown={function (e) {
          if (e.key === "Escape") setUserSel(null);
        }}
        style={{ position: "relative", width: "100%", maxWidth: 480, margin: "0 auto" }}
      >
        <div
          data-qa-load-detail="1"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{
            margin: "0 0 8px",
            minHeight: 58,
            boxSizing: "border-box",
            padding: "7px 12px",
            borderRadius: 12,
            background: C.cardDark,
            border: "1px solid " + C.brd,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 2,
            minWidth: 0,
          }}
        >
          {selW ? (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: 10, minWidth: 0 }}>
                <span style={{ ...T.labelMd, color: C.t2, overflowWrap: "anywhere" }}>{weekName(selW.i)}</span>
                <span style={{ ...T.cardTitle, color: C.t, overflowWrap: "anywhere" }}>{selW.v + " kg"}</span>
              </div>
              <div style={{ ...T.meta, color: C.t, overflowWrap: "anywhere", minHeight: 16 }}>
                {selW.delta != null ? (
                  <>
                    <span aria-hidden="true" style={{ color: selW.delta > 0 ? C.green : selW.delta < 0 ? C.red : C.t2, fontWeight: 700 }}>
                      {selW.delta > 0 ? "\u2191" : selW.delta < 0 ? "\u2193" : "="}
                    </span>
                    {selW.delta !== 0 ? <span style={SR_ONLY}>{selW.delta > 0 ? M(lang, "Subió", "Up", "Subiu") : M(lang, "Bajó", "Down", "Baixou")}</span> : null}
                    {" " + (selW.delta === 0 ? tSame : fmtDelta(selW.delta) + " kg") + " " + tVs + " " + weekName(selW.i - 1)}
                  </>
                ) : null}
                {selW.isMax ? <span style={{ fontWeight: 700 }}>{(selW.delta != null ? " · " : "") + tMax}</span> : null}
              </div>
            </>
          ) : (
            <span style={{ ...T.meta, color: C.t2 }}>{tHint}</span>
          )}
        </div>
        <div style={{ position: "relative", width: "100%" }}>
          <svg
            data-qa-load-svg="1"
            viewBox={"0 0 " + VB_W + " " + VB_H}
            width="100%"
            aria-hidden="true"
            focusable="false"
            style={{ display: "block", width: "100%", height: "auto" }}
          >
            {scale.ticks.map(function (tv) {
              var ty = yPos(tv, scale, PLOT_TOP, PLOT_BOTTOM);
              return (
                <g key={"tick-" + tv} data-qa-load-tick="1">
                  <line x1={PAD_L} x2={VB_W - PAD_R} y1={ty} y2={ty} stroke={C.brd} strokeWidth={1} opacity={0.55} />
                  <text x={PAD_L - 5} y={ty + 3.5} fill={C.t2} fontSize={10.5} textAnchor="end">
                    {tv}
                  </text>
                </g>
              );
            })}
            <line x1={PAD_L} x2={VB_W - PAD_R} y1={AXIS_Y} y2={AXIS_Y} stroke={C.brd} strokeWidth={1} />
            {segments.map(function (seg) {
              return (
                <polyline
                  key={"seg-" + seg[0]}
                  data-qa-load-seg="1"
                  fill="none"
                  stroke={alumnoColor}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={xs[seg[0]] + "," + ys[seg[0]] + " " + xs[seg[1]] + "," + ys[seg[1]]}
                />
              );
            })}
            {weeks.map(function (w) {
              var x = xs[w.i];
              if (w.hasData) {
                var y = ys[w.i];
                var isSel = selected === w.i;
                return (
                  <g key={"pt-" + w.i}>
                    {w.isMax ? <circle r={10} cx={x} cy={y} fill="none" stroke={alumnoColor} strokeWidth={2} /> : null}
                    {isSel ? <circle r={8} cx={x} cy={y} fill="none" stroke={C.t} strokeWidth={2} /> : null}
                    <circle r={isSel ? 5.5 : 4.5} cx={x} cy={y} fill={alumnoColor} stroke={C.card} strokeWidth={1.5} />
                    <text x={x} y={y - (w.isMax ? 15 : 12)} fill={C.t} fontSize={12} fontWeight={isSel ? 800 : 700} textAnchor="middle">
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
          {weeks.map(function (w) {
            if (!w.hasData) return null;
            return (
              <button
                key={"hit-" + w.i}
                type="button"
                data-qa-load-point={w.i}
                aria-label={weekName(w.i) + ": " + w.v + " kg"}
                aria-pressed={selected === w.i}
                onClick={function () {
                  setUserSel(nextSelectedWeek(selected, w.i, weeks));
                }}
                style={{
                  position: "absolute",
                  left: pct(xs[w.i], VB_W),
                  top: pct(ys[w.i], VB_H),
                  width: HIT,
                  height: HIT,
                  transform: "translate(-50%, -50%)",
                  padding: 0,
                  margin: 0,
                  border: 0,
                  borderRadius: "50%",
                  background: "transparent",
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                }}
              />
            );
          })}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(" + n + ", minmax(0, 1fr))",
            marginTop: 4,
            marginLeft: pct(PAD_L, VB_W),
            marginRight: pct(PAD_R, VB_W),
          }}
        >
          {weeks.map(function (w) {
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
                  padding: "0 1px",
                }}
              >
                <span style={{ ...T.labelMd, fontSize: 12, whiteSpace: "nowrap", color: w.status === "data" ? C.t : C.t2 }}>{weekName(w.i)}</span>
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
                {w.status === "missing" ? (
                  <span style={{ ...T.meta, color: C.t2, overflowWrap: "anywhere" }}>{tNone}</span>
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
