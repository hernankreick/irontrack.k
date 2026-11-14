import React, { useState } from "react";
import { coachThemePalette } from "../coachThemePalette.js";
import { irontrackMsg as M } from "../../lib/irontrackMsg.js";
import { etiquetaEstado, explicacionEstado, tituloSemana, estadoResumen, textoPorcentaje, textoVariable, nombreVariable, estadoEjercicio } from "../../lib/prescritoEjecutadoTextos.js";

// Presentacion pura de "Prescrito vs. ejecutado". Sin lecturas: recibe { estado, resultado }. Pensada para iPhone: una columna, objetivos tactiles >= 44 px,
// texto >= 13 px, sin scroll horizontal (overflow-wrap), contraste AA en claro y oscuro y NUNCA solo color (cada resultado lleva icono y palabra).
function paleta(dark) {
  var P = coachThemePalette(dark);
  return dark
    ? { card: P.card, sub: P.cardDark, brd: P.brd, t: P.t, m: "#a1a1aa", ok: "#4ade80", warn: "#facc15", bad: "#f87171", acc: "#60a5fa", okBg: "#052e16", warnBg: "#422006", badBg: "#450a0a" }
    : { card: P.card, sub: P.cardDark, brd: P.brd, t: P.t, m: "#475569", ok: "#15803d", warn: "#854d0e", bad: "#b91c1c", acc: "#1d4ed8", okBg: "#dcfce7", warnBg: "#fef9c3", badBg: "#fee2e2" };
}
var base = { margin: 0, minWidth: 0, overflowWrap: "anywhere" };
function colorDe(res, C) { return res === "cumple" || res === "por_encima" ? [C.ok, C.okBg] : res === "por_debajo" ? [C.bad, C.badBg] : res === "mixto" ? [C.warn, C.warnBg] : [C.m, C.sub]; }

function Chip({ children, fg, bg, C }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999, fontSize: 13, fontWeight: 600, color: fg, background: bg, border: "1px solid " + C.brd, ...base }}>{children}</span>;
}
function Tarjeta({ titulo, p, lang, C }) {
  var t = textoPorcentaje(p, lang);
  return (
    <div style={{ background: C.sub, border: "1px solid " + C.brd, borderRadius: 12, padding: "10px 12px", minWidth: 0 }}>
      <div style={{ fontSize: 13, color: C.m, ...base }}>{titulo}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: C.t, ...base }} aria-label={titulo + ": " + t.texto}>{t.texto}</div>
      {t.nota ? <div style={{ fontSize: 13, color: C.m, lineHeight: 1.35, ...base }}>{t.nota}</div> : null}
    </div>
  );
}
function Resumen({ r, lang, C }) {
  var ej = r.ejercicios;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
        <Tarjeta titulo={M(lang, "Sesiones comparadas", "Sessions compared", "Sessões comparadas")} p={r.porcentajes.cobertura_sesiones} lang={lang} C={C} />
        <Tarjeta titulo={M(lang, "Ejercicios con todas las series", "Exercises with all sets", "Exercícios com todas as séries")} p={r.porcentajes.series} lang={lang} C={C} />
        <Tarjeta titulo={M(lang, "Repeticiones en objetivo", "Reps on target", "Repetições no alvo")} p={r.porcentajes.reps} lang={lang} C={C} />
        <Tarjeta titulo={M(lang, "Cargas en objetivo", "Loads on target", "Cargas no alvo")} p={r.porcentajes.kg} lang={lang} C={C} />
      </div>
      {r.sesiones_verificables === 0 ? (
        <p style={{ ...base, fontSize: 14, color: C.m, lineHeight: 1.45 }}>{M(lang, "No hay ejercicios que contar: ninguna sesión tiene datos suficientes para comparar.", "There are no exercises to count: no session has enough data to compare.", "Não há exercícios para contar: nenhuma sessão tem dados suficientes para comparar.")}</p>
      ) : (<>
      <p style={{ ...base, fontSize: 14, color: C.t, lineHeight: 1.45 }}>
        {M(lang, "Ejercicios: ", "Exercises: ", "Exercícios: ")}
        <strong>{ej.completos}</strong> {M(lang, "completos", "completed", "completos")} · <strong>{ej.parciales}</strong> {M(lang, "parciales", "partial", "parciais")} · <strong>{ej.omitidos}</strong> {M(lang, "omitidos", "skipped", "omitidos")}
        {ej.sin_evidencia_de_omision > 0 ? " · " + ej.sin_evidencia_de_omision + " " + M(lang, "sin evidencia de si se hicieron", "unknown whether done", "sem evidência se foram feitos") : ""}
        {ej.no_comparables > 0 ? " · " + ej.no_comparables + " " + M(lang, "no comparables", "not comparable", "não comparáveis") : ""}
      </p>
      <p style={{ ...base, fontSize: 13, color: C.m, lineHeight: 1.4 }}>
        {M(lang, "Series: ", "Sets: ", "Séries: ")}{r.series.ejecutadas} {M(lang, "hechas de", "done of", "feitas de")} {r.series.prescritas_minimo} {M(lang, "prescritas (mínimo) en los ejercicios comparables.", "prescribed (minimum) in comparable exercises.", "prescritas (mínimo) nos exercícios comparáveis.")}
      </p>
      </>)}
    </div>
  );
}
function Ejercicio({ e, lang, C }) {
  return (
    <li style={{ listStyle: "none", border: "1px solid " + C.brd, borderRadius: 10, padding: "10px 12px", background: C.card, minWidth: 0 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 6, alignItems: "baseline" }}>
        <strong style={{ ...base, fontSize: 15, color: C.t }}>{e.nombre || e.ejercicio_id}</strong>
        <span style={{ ...base, fontSize: 13, color: C.m }}>{(e.bloque === "warmup" ? M(lang, "Calentamiento", "Warm-up", "Aquecimento") : M(lang, "Principal", "Main", "Principal")) + " · " + estadoEjercicio(e, lang)}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
        {["series", "reps", "kg"].map(function (k) {
          var v = textoVariable(k, e.variables[k], lang); var col = colorDe(v.resultado.clave, C);
          return (
            <div key={k} style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <span style={{ ...base, fontSize: 13, color: C.m, minWidth: 92 }}>{nombreVariable(k, lang)}</span>
              <span style={{ ...base, fontSize: 14, color: C.t }}>{M(lang, "prescrito ", "prescribed ", "prescrito ")}<strong>{v.prescrito}</strong> · {M(lang, "hecho ", "done ", "feito ")}<strong>{v.ejecutado}</strong></span>
              <Chip fg={col[0]} bg={col[1]} C={C}><span aria-hidden="true">{v.resultado.icono}</span>{v.resultado.texto}</Chip>
              {v.motivo ? <span style={{ ...base, fontSize: 13, color: C.m, flexBasis: "100%" }}>{v.motivo}</span> : null}
            </div>
          );
        })}
      </div>
    </li>
  );
}
function Sesion({ s, lang, C, abierto0 }) {
  var [abierto, setAbierto] = useState(!!abierto0); var cmp = s.comparacion; var id = "pe-ses-" + (s.sesion_id || "x");
  var ver = cmp.verificable; var primerMotivo = cmp.motivos && cmp.motivos[0];
  return (
    <li style={{ listStyle: "none", border: "1px solid " + C.brd, borderRadius: 12, background: C.sub, minWidth: 0 }}>
      <button type="button" aria-expanded={abierto} aria-controls={id} onClick={function () { setAbierto(!abierto); }}
        style={{ width: "100%", minHeight: 48, padding: "10px 12px", display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", justifyContent: "space-between", textAlign: "left", background: "transparent", border: "none", color: C.t, fontFamily: "inherit", fontSize: 15, cursor: "pointer" }}>
        <span style={{ ...base, fontWeight: 700 }}>{(s.fecha || "") + (s.dia_idx != null ? " · " + M(lang, "Día ", "Day ", "Dia ") + (Number(s.dia_idx) + 1) : "")}</span>
        <Chip fg={ver ? C.ok : C.warn} bg={ver ? C.okBg : C.warnBg} C={C}><span aria-hidden="true">{ver ? "✓" : "!"}</span>{etiquetaEstado(cmp.estado, lang)}</Chip>
      </button>
      {abierto ? (
        <div id={id} style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ ...base, fontSize: 14, color: C.m, lineHeight: 1.45 }}>{explicacionEstado(cmp.estado, lang)}{primerMotivo && primerMotivo.estado !== cmp.estado ? "" : ""}</p>
          {ver ? <ul style={{ margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>{cmp.ejercicios.map(function (e) { return <Ejercicio key={e.orden} e={e} lang={lang} C={C} />; })}</ul> : null}
        </div>
      ) : null}
    </li>
  );
}
function Semana({ w, sesiones, lang, C, abierto0 }) {
  var [abierto, setAbierto] = useState(!!abierto0); var id = "pe-sem-" + w.ciclo + "-" + w.semana;
  return (
    <li style={{ listStyle: "none", border: "1px solid " + C.brd, borderRadius: 14, background: C.card, minWidth: 0 }}>
      <button type="button" aria-expanded={abierto} aria-controls={id} onClick={function () { setAbierto(!abierto); }}
        style={{ width: "100%", minHeight: 52, padding: "12px", display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", justifyContent: "space-between", textAlign: "left", background: "transparent", border: "none", color: C.t, fontFamily: "inherit", fontSize: 16, cursor: "pointer" }}>
        <span style={{ ...base, fontWeight: 800 }}>{tituloSemana(w, lang)}</span>
        <span style={{ ...base, fontSize: 13, color: C.m }}>{estadoResumen(w.estado, lang)} · {w.sesiones_verificables}/{w.sesiones_total}</span>
      </button>
      {abierto ? (
        <div id={id} style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
          <Resumen r={w} lang={lang} C={C} />
          <ul style={{ margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>{sesiones.map(function (s) { return <Sesion key={s.sesion_id} s={s} lang={lang} C={C} abierto0={abierto0} />; })}</ul>
        </div>
      ) : null}
    </li>
  );
}

/**
 * @param {{ estado: "cargando"|"ok"|"error"|"sin_tabla"|"sin_alumno", resultado?: object, cobertura?: object, onReintentar?: Function, darkMode?: boolean, lang?: string, abiertoInicial?: boolean }} props
 */
export default function PrescritoEjecutadoVista({ estado, resultado, cobertura, onReintentar, darkMode = true, lang = "es", abiertoInicial = false }) {
  var C = paleta(darkMode !== false);
  var caja = { background: C.card, border: "1px solid " + C.brd, borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 10, minWidth: 0, color: C.t };
  var cuerpo;
  if (estado === "cargando") cuerpo = <p role="status" aria-live="polite" style={{ ...base, fontSize: 15, color: C.m }}>{M(lang, "Cargando la comparación…", "Loading the comparison…", "Carregando a comparação…")}</p>;
  else if (estado === "error") cuerpo = (
    <div role="alert" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ ...base, fontSize: 15, color: C.t }}>{M(lang, "No pudimos cargar la comparación. Revisá la conexión; no se mostró ningún dato incompleto.", "We couldn't load the comparison. Check your connection; no incomplete data was shown.", "Não foi possível carregar a comparação. Verifique a conexão; nenhum dado incompleto foi exibido.")}</p>
      {onReintentar ? <button type="button" onClick={onReintentar} style={{ minHeight: 44, padding: "0 16px", borderRadius: 10, border: "1px solid " + C.acc, background: "transparent", color: C.acc, fontSize: 15, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", alignSelf: "flex-start" }}>{M(lang, "Reintentar", "Retry", "Tentar de novo")}</button> : null}
    </div>
  );
  else if (estado === "sin_tabla") cuerpo = <p style={{ ...base, fontSize: 15, color: C.m, lineHeight: 1.45 }}>{M(lang, "Esta comparación todavía no está habilitada en la base de datos. Los entrenamientos se siguen guardando normalmente.", "This comparison is not enabled in the database yet. Workouts keep saving normally.", "Esta comparação ainda não está habilitada no banco. Os treinos continuam sendo salvos normalmente.")}</p>;
  else if (estado === "ok" && resultado) {
    var g = resultado.global;
    if (g.sesiones_total === 0) cuerpo = <p style={{ ...base, fontSize: 15, color: C.m }}>{M(lang, "Todavía no hay sesiones terminadas para comparar.", "There are no finished sessions to compare yet.", "Ainda não há sessões encerradas para comparar.")}</p>;
    else {
      var porSemana = {}; resultado.sesiones.forEach(function (s) { var k = s.ciclo + ":" + s.semana; (porSemana[k] = porSemana[k] || []).push(s); });
      cuerpo = (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ ...base, fontSize: 14, color: C.m }}><strong style={{ color: C.t }}>{estadoResumen(g.estado, lang)}</strong> · {g.sesiones_verificables}/{g.sesiones_total} {M(lang, "sesiones comparables", "comparable sessions", "sessões comparáveis")}</p>
          {resultado.semanas.length > 1 ? <Resumen r={g} lang={lang} C={C} /> : null}
          {cobertura && cobertura.historial_completo === false ? <p role="note" style={{ ...base, fontSize: 13, color: C.warn }}>{M(lang, "El historial de series está incompleto: no se afirma que un ejercicio se omitió.", "The set history is incomplete: no exercise is reported as skipped.", "O histórico de séries está incompleto: nenhum exercício é dado como omitido.")}</p> : null}
          <ul style={{ margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {resultado.semanas.map(function (w) { return <Semana key={w.ciclo + ":" + w.semana} w={w} sesiones={porSemana[w.ciclo + ":" + w.semana] || []} lang={lang} C={C} abierto0={abiertoInicial} />; })}
          </ul>
        </div>
      );
    }
  } else cuerpo = null;
  return (
    <section aria-labelledby="pe-titulo" data-qa="prescrito-ejecutado" style={caja}>
      <div>
        <h3 id="pe-titulo" style={{ ...base, fontSize: 17, fontWeight: 800, color: C.t }}>{M(lang, "Prescrito vs. ejecutado", "Prescribed vs. performed", "Prescrito vs. executado")}</h3>
        <p style={{ ...base, fontSize: 13, color: C.m, lineHeight: 1.4 }}>{M(lang, "Compara cada sesión con lo que se prescribió ese día, no con la rutina actual.", "Compares each session with what was prescribed that day, not with the current routine.", "Compara cada sessão com o que foi prescrito naquele dia, não com a rotina atual.")}</p>
      </div>
      {cuerpo}
    </section>
  );
}
