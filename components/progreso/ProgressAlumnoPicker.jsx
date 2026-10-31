import React, { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { irontrackMsg as M } from "../../lib/irontrackMsg.js";
import { initialsFromName } from "../coachProgresoMetrics.js";

function norm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Contenido de la hoja «Elegir alumno»: buscador, «Estancados» (model.stalledIds) y todos de la A a la Z con su adherencia del
 * período (model.adherenciaRows) o «Sin rutina asignada». No calcula nada: solo filtra y ordena lo que ya trae el modelo.
 */
export default function ProgressAlumnoPicker({ alumnos, selectedId, stalledIds, adherenciaRows, routineNameFor, onSelect, lang, C, P }) {
  var [query, setQuery] = useState("");
  var adhById = useMemo(function () {
    var m = {};
    (adherenciaRows || []).forEach(function (r) { m[String(r.id)] = r.p; });
    return m;
  }, [adherenciaRows]);
  var stalled = useMemo(function () {
    var m = {};
    (stalledIds || []).forEach(function (id) { m[String(id)] = true; });
    return m;
  }, [stalledIds]);
  var q = norm(query).trim();
  var list = (alumnos || []).filter(function (a) {
    return !q || norm(a.nombre || a.email).indexOf(q) >= 0;
  });
  var atencion = q ? [] : list.filter(function (a) { return stalled[String(a.id)]; });
  var inputId = "progreso-buscar-alumno";

  function pctColor(p) {
    return p >= 70 ? P.good : p >= 30 ? P.warn : P.bad;
  }

  function row(a, sub, key) {
    var sel = String(a.id) === String(selectedId);
    var name = a.nombre || a.email || "—";
    var p = adhById[String(a.id)];
    return (
      <button
        key={key}
        type="button"
        aria-current={sel ? "true" : undefined}
        onClick={function () { onSelect(a.id); }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          width: "100%",
          minHeight: 64,
          padding: "0 8px",
          border: "none",
          borderRadius: 12,
          background: sel ? (P.dark ? "#172554" : "#eff6ff") : "transparent",
          color: C.t,
          textAlign: "left",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <span aria-hidden="true" style={{ flex: "none", width: 40, height: 40, borderRadius: 20, background: P.accentSoft, color: P.accentSoftText, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800 }}>
          {initialsFromName(a.nombre, a.email)}
        </span>
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 16, fontWeight: sel ? 700 : 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
          <span style={{ fontSize: 13, color: sel ? P.accentSoftText : P.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</span>
        </span>
        {sel ? <Check size={20} color={P.accentText} strokeWidth={2.5} aria-hidden="true" style={{ flex: "none" }} /> : null}
        {!sel && p != null ? <span style={{ flex: "none", fontSize: 14, fontWeight: 800, color: pctColor(p) }}>{p + "%"}</span> : null}
      </button>
    );
  }

  function subFor(a) {
    var rn = routineNameFor(a.id);
    return rn == null ? M(lang, "Sin rutina asignada", "No routine assigned", "Sem rotina atribuída") : rn || M(lang, "Rutina asignada", "Routine assigned", "Rotina atribuída");
  }

  function heading(text) {
    return <h3 style={{ margin: "14px 8px 4px", fontSize: 13, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: P.muted }}>{text}</h3>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <label htmlFor={inputId} style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>
        {M(lang, "Buscar alumno", "Search athlete", "Buscar aluno")}
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 48, padding: "0 12px", background: P.dark ? C.cardDark : C.card, border: "1px solid " + P.line, borderRadius: 12 }}>
        <Search size={18} color={P.muted} aria-hidden="true" />
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={function (e) { setQuery(e.target.value); }}
          placeholder={M(lang, "Buscar por nombre", "Search by name", "Buscar por nome")}
          autoComplete="off"
          style={{ flex: 1, minWidth: 0, minHeight: 44, background: "transparent", border: "none", outline: "none", color: C.t, fontSize: 16, fontFamily: "inherit" }}
        />
      </div>
      {atencion.length ? heading(M(lang, "Estancados · sin PR en 3 semanas", "Stalled · no PR in 3 weeks", "Estagnados · sem PR em 3 semanas")) : null}
      {atencion.map(function (a) { return row(a, subFor(a), "st-" + a.id); })}
      {heading(q ? M(lang, "Resultados", "Results", "Resultados") : M(lang, "Todos · A–Z", "All · A–Z", "Todos · A–Z"))}
      {list.length === 0 ? (
        <p role="status" style={{ margin: "4px 8px", fontSize: 14, color: P.muted }}>
          {M(lang, "Ningún alumno coincide con «" + query + "».", "No athlete matches “" + query + "”.", "Nenhum aluno corresponde a «" + query + "».")}
        </p>
      ) : null}
      {list.map(function (a) { return row(a, subFor(a), "al-" + a.id); })}
    </div>
  );
}
