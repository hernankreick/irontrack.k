import React, { useMemo, useState } from "react";
import { irontrackMsg as M } from "../../lib/irontrackMsg.js";
import { historialPorDia, mejoresMarcas, parseFechaDMY, tipoDeCarga, TIPO_CARGA, volumenDeSerie } from "../../lib/metricas/index.js";
import { fmtKg, fmtNum } from "../progreso/progresoTone.js";

var DAY_MS = 86400000;
var PREVIEW = 5;

function fechaDia(dia, lang, weekday) {
  var u = new Date(dia * DAY_MS);
  var d = new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate());
  var l = lang === "es" ? "es-AR" : lang === "pt" ? "pt-BR" : "en-US";
  var opts = weekday ? { weekday: "short", day: "numeric", month: "short" } : { day: "numeric", month: "short" };
  var s = d.toLocaleDateString(l, opts).replace(/\./g, "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Sesiones de UN ejercicio (filas de progreso agrupadas por día, más reciente primero), con su clase según el núcleo:
 * historialPorDia (lib/metricas/pr.js) da la mejor serie del día y si es primera marca, PR o igualación del récord anterior.
 * La comparación con la sesión anterior es la diferencia entre dos mejores series ya mostradas (no es una métrica nueva).
 */
export function buildExerciseSessions(rows, ejercicioId, indiceTiempo) {
  var id = String(ejercicioId);
  var porDia = {};
  (rows || []).forEach(function (r) {
    if (!r || String(r.ejercicio_id) !== id) return;
    var dia = parseFechaDMY(r.fecha);
    if (dia == null) return;
    (porDia[dia] = porDia[dia] || []).push(r);
  });
  var clases = {};
  historialPorDia(rows, id, { indiceTiempo: indiceTiempo }).forEach(function (h) { clases[h.dia] = h; });
  var dias = Object.keys(porDia).map(Number).sort(function (a, b) { return a - b; });
  var prevBest = null;
  var prevSes = null;
  var asc = dias.map(function (dia) {
    // las filas llegan por created_at desc: se invierten para listar las series en orden de ejecución
    var sets = porDia[dia].slice().reverse();
    var vol = 0;
    sets.forEach(function (r) { vol += volumenDeSerie(r, indiceTiempo); });
    var h = clases[dia] || null;
    var first = sets[0] || {};
    var ciclo = first.ciclo != null && first.ciclo !== "" ? Number(first.ciclo) : null;
    var rutinaId = first.rutina_id != null && first.rutina_id !== "" ? String(first.rutina_id) : null;
    var ses = {
      dia: dia,
      sets: sets,
      vol: vol,
      best: h,
      vsAnterior: h && prevBest ? Math.round((h.kg - prevBest.kg) * 100) / 100 : null,
      semana: first.semana != null && first.semana !== "" && Number.isInteger(Number(first.semana)) ? Number(first.semana) + 1 : null,
      rutinaId: rutinaId,
      inicioCiclo: !!(prevSes && ciclo != null && prevSes.ciclo != null && rutinaId && rutinaId === prevSes.rutinaId && ciclo > prevSes.ciclo),
      ciclo: ciclo,
    };
    if (h) prevBest = h;
    prevSes = ses;
    return ses;
  });
  return asc.reverse();
}

function Badge({ children, tone, P }) {
  var solid = tone === "pr";
  var color = solid ? P.prText : tone === "iguala" ? P.warn : tone === "ciclo" ? P.accentSoftText : P.text2;
  var border = solid ? P.prBorder : tone === "iguala" ? (P.dark ? "#a16207" : "#eab308") : tone === "ciclo" ? (P.dark ? "#1e3a8a" : "#93c5fd") : P.line;
  return (
    <span style={{ flex: "none", fontSize: 12, fontWeight: solid ? 800 : 700, color: color, background: solid ? P.prBg : "transparent", border: "1px solid " + border, borderRadius: 6, padding: "2px 7px", whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

export default function EjercicioHistorialCoach({ alumnoId, ejercicioId, progresoGlobal, indiceTiempo, rutinasSBEntrenador, currentRoutineId, lang, C, P }) {
  var [all, setAll] = useState(false);
  var rows = (progresoGlobal && progresoGlobal[alumnoId]) || [];
  var esTiempo = tipoDeCarga(ejercicioId, indiceTiempo) === TIPO_CARGA.TIEMPO;
  var sessions = useMemo(function () { return buildExerciseSessions(rows, ejercicioId, indiceTiempo); }, [rows, ejercicioId, indiceTiempo]);
  var record = useMemo(function () {
    var own = rows.filter(function (r) { return r && String(r.ejercicio_id) === String(ejercicioId); });
    return mejoresMarcas(own, { indiceTiempo: indiceTiempo })[String(ejercicioId)] || null;
  }, [rows, ejercicioId, indiceTiempo]);
  var nombresRutina = useMemo(function () {
    var m = {};
    (rutinasSBEntrenador || []).forEach(function (r) { if (r && r.id != null) m[String(r.id)] = String(r.nombre || r.name || ""); });
    return m;
  }, [rutinasSBEntrenador]);

  if (!sessions.length) {
    return <p role="status" style={{ margin: "8px 0", fontSize: 14, color: P.muted, lineHeight: 1.45 }}>{M(lang, "Sin registros de este ejercicio.", "No records for this exercise.", "Sem registros deste exercício.")}</p>;
  }

  var shown = all ? sessions : sessions.slice(0, PREVIEW);
  var bests = sessions.filter(function (s) { return s.best; }).slice().reverse();
  var stat = function (label, value, sub) {
    return (
      <div style={{ background: P.dark ? C.cardDark : "#f8fafc", border: "1px solid " + C.brd, borderRadius: 12, padding: 10, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: P.muted }}>{label}</span>
        <span style={{ fontSize: 18, fontWeight: 800, color: C.t, overflowWrap: "anywhere" }}>{value}</span>
        <span style={{ fontSize: 12, color: P.text2 }}>{sub}</span>
      </div>
    );
  };

  function routineLabel(s) {
    if (!s.rutinaId) return "";
    if (currentRoutineId && s.rutinaId === String(currentRoutineId)) return nombresRutina[s.rutinaId] || M(lang, "Rutina actual", "Current routine", "Rotina atual");
    return M(lang, "Rutina anterior", "Previous routine", "Rotina anterior") + (nombresRutina[s.rutinaId] ? " (" + nombresRutina[s.rutinaId] + ")" : "");
  }

  function setLabel(r) {
    var kg = parseFloat(r.kg);
    var reps = parseInt(r.reps, 10);
    if (esTiempo) return (kg > 0 ? fmtKg(kg, lang) + " · " : "") + (reps > 0 ? reps + " s" : "—");
    return (kg > 0 ? fmtNum(kg, lang) : "0") + " × " + (reps > 0 ? reps : "0");
  }

  // Mini gráfico: mejor serie de cada sesión con carga (historial completo), escala visual con margen
  var spark = null;
  if (!esTiempo && bests.length >= 2) {
    var vals = bests.map(function (s) { return s.best.kg; });
    var lo = Math.min.apply(null, vals);
    var hi = Math.max.apply(null, vals);
    var span = hi - lo || 1;
    var W = 320;
    var pts = bests.map(function (s, i) {
      return { x: 6 + (i / (bests.length - 1)) * (W - 12), y: 70 - ((s.best.kg - lo) / span) * 56, kg: s.best.kg };
    });
    var last = pts[pts.length - 1];
    spark = (
      <div style={{ padding: 12, background: P.dark ? C.cardDark : "#f8fafc", border: "1px solid " + C.brd, borderRadius: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.t }}>{M(lang, "Mejor serie por sesión", "Best set per session", "Melhor série por sessão")}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: P.muted }}>{M(lang, "kg · historial completo", "kg · full history", "kg · histórico completo")}</span>
        </div>
        <svg
          role="img"
          aria-label={M(lang, "Mejor serie de cada sesión, de ", "Best set per session, from ", "Melhor série de cada sessão, de ") + fmtKg(bests[0].best.kg, lang) + " (" + fechaDia(bests[0].dia, lang) + ") " + M(lang, "a ", "to ", "a ") + fmtKg(last.kg, lang) + " (" + fechaDia(bests[bests.length - 1].dia, lang) + ")"}
          viewBox={"0 0 " + W + " 96"}
          style={{ width: "100%", height: "auto", display: "block" }}
        >
          <line x1="0" y1="78" x2={W} y2="78" stroke={P.track} strokeWidth="1" />
          <polyline points={pts.map(function (p) { return p.x + "," + p.y; }).join(" ")} fill="none" stroke={C.blue} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {pts.map(function (p, i) {
            return p.kg === hi ? <circle key={"sp-" + i} cx={p.x} cy={p.y} r="4.5" fill={P.prDot} /> : null;
          })}
          <text x="0" y="94" fill={P.muted} fontSize="12" fontWeight="600">{fechaDia(bests[0].dia, lang) + " · " + fmtNum(bests[0].best.kg, lang)}</text>
          <text x={W} y="94" fill={C.t} fontSize="12" fontWeight="700" textAnchor="end">{fechaDia(bests[bests.length - 1].dia, lang) + " · " + fmtNum(last.kg, lang)}</text>
        </svg>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }} data-qa="historial-ejercicio">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
        {esTiempo
          ? stat(M(lang, "Tipo", "Type", "Tipo"), M(lang, "Tiempo", "Time", "Tempo"), M(lang, "sin récord de carga", "no load record", "sem recorde de carga"))
          : stat(M(lang, "Récord", "Record", "Recorde"), record ? fmtKg(record.kg, lang) : "—", record ? "× " + record.reps + " · " + fechaDia(record.dia, lang) : M(lang, "sin series con carga", "no loaded sets", "sem séries com carga"))}
        {stat(M(lang, "Sesiones", "Sessions", "Sessões"), String(sessions.length), M(lang, "desde ", "since ", "desde ") + fechaDia(sessions[sessions.length - 1].dia, lang))}
        {stat(M(lang, "Volumen", "Volume", "Volume"), esTiempo ? "—" : fmtNum(sessions[0].vol, lang), esTiempo ? M(lang, "no aplica", "not applicable", "não se aplica") : M(lang, "kg · última sesión", "kg · last session", "kg · última sessão"))}
      </div>
      {spark}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, borderTop: "1px solid " + C.brd, paddingTop: 12 }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: P.muted }}>{M(lang, "Sesiones", "Sessions", "Sessões")}</h3>
        {!esTiempo ? <span style={{ fontSize: 12, fontWeight: 600, color: P.muted }}>{M(lang, "Se compara la mejor serie", "Best set is compared", "Compara-se a melhor série")}</span> : null}
      </div>
      <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
        {shown.map(function (s) {
          var b = s.best;
          var badge = null;
          var line = null;
          if (b && b.clase === "pr") {
            badge = <Badge tone="pr" P={P}>{"PR · +" + fmtKg(Math.round((b.kg - b.recordPrevio) * 100) / 100, lang)}</Badge>;
            line = M(lang, "Supera el récord anterior (", "Beats the previous record (", "Supera o recorde anterior (") + fmtKg(b.recordPrevio, lang) + ")";
          } else if (b && b.clase === "iguala") {
            badge = <Badge tone="iguala" P={P}>{M(lang, "Iguala el récord", "Ties the record", "Iguala o recorde")}</Badge>;
            line = fmtKg(b.kg, lang) + M(lang, " = récord: igualar no es PR", " = record: tying is not a PR", " = recorde: igualar não é PR");
          } else if (b && b.clase === "primera") {
            badge = <Badge tone="primera" P={P}>{M(lang, "Primera marca", "First mark", "Primeira marca")}</Badge>;
            line = M(lang, "Primer registro: es la base, no cuenta como PR", "First record: it is the baseline, not a PR", "Primeiro registro: é a base, não conta como PR");
          } else if (b) {
            line = fmtKg(Math.round((b.recordPrevio - b.kg) * 100) / 100, lang) + M(lang, " por debajo del récord", " below the record", " abaixo do recorde");
          } else if (!esTiempo) {
            line = M(lang, "Sin series con carga: no se compara", "No loaded sets: not compared", "Sem séries com carga: não se compara");
          }
          var vs = s.vsAnterior == null ? "" : s.vsAnterior === 0 ? M(lang, " · = vs sesión anterior", " · = vs previous session", " · = vs sessão anterior") : " · " + (s.vsAnterior > 0 ? "+" : "−") + fmtKg(Math.abs(s.vsAnterior), lang) + M(lang, " vs sesión anterior", " vs previous session", " vs sessão anterior");
          var meta = [
            esTiempo ? null : fmtNum(s.vol, lang) + M(lang, " kg de volumen", " kg volume", " kg de volume"),
            routineLabel(s) || null,
            s.semana != null ? M(lang, "Sem ", "Wk ", "Sem ") + s.semana : null,
          ].filter(Boolean).join(" · ");
          return (
            <li key={"ses-" + s.dia} style={{ background: P.dark ? C.cardDark : C.card, border: "1px solid " + C.brd, borderRadius: 14, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: C.t }}>{fechaDia(s.dia, lang, true)}</span>
                {s.inicioCiclo ? <Badge tone="ciclo" P={P}>{M(lang, "Inicio de ciclo", "Cycle start", "Início de ciclo")}</Badge> : null}
                {badge}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {s.sets.map(function (r, i) {
                  var isBest = b && parseFloat(r.kg) === b.kg && parseInt(r.reps, 10) === b.reps;
                  return (
                    <span key={"set-" + i} style={{ fontSize: 14, fontWeight: isBest ? 800 : 600, background: isBest ? P.accentSoft : P.track, color: isBest ? P.accentSoftText : C.t, borderRadius: 8, padding: "6px 10px" }}>
                      {setLabel(r)}
                    </span>
                  );
                })}
              </div>
              {line || vs ? <span style={{ fontSize: 12, fontWeight: 500, color: P.text2, lineHeight: 1.4 }}>{(line || "") + (line ? vs : vs.replace(/^ · /, ""))}</span> : null}
              {meta ? <span style={{ fontSize: 12, fontWeight: 500, color: P.muted, lineHeight: 1.4 }}>{meta}</span> : null}
            </li>
          );
        })}
      </ol>
      {sessions.length > PREVIEW ? (
        <button
          type="button"
          aria-expanded={all}
          onClick={function () { setAll(!all); }}
          style={{ minHeight: 44, border: "1px solid " + P.line, borderRadius: 12, background: "transparent", color: P.accentText, fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}
        >
          {all ? M(lang, "Ver menos", "Show less", "Ver menos") : M(lang, "Ver " + (sessions.length - PREVIEW) + " sesiones más", "See " + (sessions.length - PREVIEW) + " more sessions", "Ver mais " + (sessions.length - PREVIEW) + " sessões")}
        </button>
      ) : null}
      <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: P.muted, lineHeight: 1.45 }}>
        {esTiempo
          ? M(lang, "Ejercicio por tiempo: las repeticiones son segundos, sin volumen ni récord de carga.", "Time-based exercise: reps are seconds, no volume or load record.", "Exercício por tempo: as repetições são segundos, sem volume nem recorde de carga.")
          : M(lang, "PR = la mejor serie del día supera la carga máxima de todo el historial. Igualarla, las repeticiones o la primera marca no cuentan.", "PR = the day's best set beats the highest load in the whole history. Tying it, reps or the first mark do not count.", "PR = a melhor série do dia supera a carga máxima de todo o histórico. Igualá-la, as repetições ou a primeira marca não contam.")}
      </p>
    </div>
  );
}
