import React, { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { irontrackMsg as M } from "../../lib/irontrackMsg.js";
import { fmtKg } from "./progresoTone.js";
import { rowButtonStyle } from "./ProgressRecentPrsCard.jsx";

var PREVIEW = 3;

function norm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Filtra la lista del modelo (model.ejerciciosRegistrados) por modo ("rutina" | "todos") y texto, sin acentos ni mayúsculas. */
export function filterExercises(list, mode, query) {
  var q = norm(query).trim();
  return (list || []).filter(function (e) {
    if (mode === "rutina" && !e.enRutina) return false;
    return !q || norm(e.name).indexOf(q) >= 0;
  });
}

export function exerciseLastLine(e, lang) {
  var pre = M(lang, "Última: ", "Last: ", "Última: ");
  if (e.esTiempo) {
    return pre + (e.ultimaSegundos != null ? e.ultimaSegundos + " s · " : "") + e.ultimaFecha + M(lang, " · por tiempo", " · time-based", " · por tempo");
  }
  if (e.ultimaKg != null) return pre + fmtKg(e.ultimaKg, lang) + " × " + e.ultimaReps + " · " + e.ultimaFecha;
  return pre + e.ultimaFecha + M(lang, " · sin carga", " · no load", " · sem carga");
}

function ExerciseRow({ e, onOpen, lang, C, P }) {
  return (
    <button
      type="button"
      onClick={function () { onOpen(e.id, e.name); }}
      aria-label={e.name + ". " + exerciseLastLine(e, lang) + (e.ultimaClase === "pr" ? ". PR" : "") + ". " + M(lang, "Ver historial", "See history", "Ver histórico")}
      style={Object.assign(rowButtonStyle(C), { minHeight: 56 })}
    >
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
        <span style={{ fontSize: 12, fontWeight: 500, color: P.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {exerciseLastLine(e, lang)}
        </span>
      </span>
      {e.ultimaClase === "pr" ? (
        <span aria-hidden="true" style={{ flex: "none", fontSize: 12, fontWeight: 800, color: P.prText, background: P.prBg, border: "1px solid " + P.prBorder, borderRadius: 6, padding: "2px 7px" }}>PR</span>
      ) : null}
      <ChevronRight size={16} color={P.muted} aria-hidden="true" style={{ flex: "none" }} />
    </button>
  );
}

function Segmented({ mode, setMode, nRutina, nTodos, lang, C, P }) {
  var opts = [
    { id: "rutina", label: M(lang, "Rutina actual", "Current routine", "Rotina atual") + " · " + nRutina },
    { id: "todos", label: M(lang, "Todos", "All", "Todos") + " · " + nTodos },
  ];
  return (
    <div role="group" aria-label={M(lang, "Qué ejercicios mostrar", "Which exercises to show", "Quais exercícios mostrar")} style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 4, padding: 4, background: P.dark ? C.cardDark : "#f1f5f9", border: "1px solid " + C.brd, borderRadius: 12 }}>
      {opts.map(function (o) {
        var active = mode === o.id;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={active}
            onClick={function () { setMode(o.id); }}
            style={{
              minHeight: 44,
              border: "none",
              borderRadius: 9,
              background: active ? (P.dark ? P.accentSoft : C.card) : "transparent",
              color: active ? (P.dark ? "#ffffff" : P.accentSoftText) : P.text2,
              boxShadow: active && !P.dark ? "0 1px 2px rgba(15,23,42,0.12)" : "none",
              fontSize: 14,
              fontWeight: active ? 700 : 600,
              fontFamily: "inherit",
              cursor: "pointer",
              padding: "0 6px",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Tarjeta de la pantalla: tres ejercicios del modo elegido y acceso a la lista completa con buscador. */
export default function ProgressExercisesCard({ ejercicios, onOpenExercise, onOpenList, lang, C, P }) {
  var list = ejercicios || [];
  var nRutina = list.filter(function (e) { return e.enRutina; }).length;
  var [mode, setMode] = useState(nRutina > 0 ? "rutina" : "todos");
  var shown = filterExercises(list, mode, "");
  return (
    <section
      aria-labelledby="progreso-ej-titulo"
      data-qa="historial-por-ejercicio"
      style={{ background: C.card, border: "1px solid " + C.brd, borderRadius: 16, padding: "8px 16px 12px", display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "10px 0 6px" }}>
        <h2 id="progreso-ej-titulo" style={{ margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: -0.2, color: C.t }}>
          {M(lang, "Historial por ejercicio", "History by exercise", "Histórico por exercício")}
        </h2>
        <span style={{ fontSize: 13, fontWeight: 500, color: P.muted }}>{M(lang, "Tocá uno para ver todas sus sesiones", "Tap one to see all its sessions", "Toque em um para ver todas as sessões")}</span>
      </div>
      {list.length === 0 ? (
        <p style={{ margin: "4px 0 4px", padding: 12, fontSize: 13, lineHeight: 1.45, color: P.muted, border: "1px dashed " + P.line, borderRadius: 12 }}>
          {M(lang, "Todavía no registró series de ningún ejercicio.", "No sets logged for any exercise yet.", "Ainda não registrou séries de nenhum exercício.")}
        </p>
      ) : (
        <>
          <div style={{ marginBottom: 6 }}>
            <Segmented mode={mode} setMode={setMode} nRutina={nRutina} nTodos={list.length} lang={lang} C={C} P={P} />
          </div>
          {shown.length === 0 ? (
            <p style={{ margin: "4px 0", fontSize: 13, color: P.muted, lineHeight: 1.45 }}>
              {M(lang, "Ningún ejercicio de la rutina actual tiene registros todavía.", "No exercise of the current routine has records yet.", "Nenhum exercício da rotina atual tem registros ainda.")}
            </p>
          ) : (
            shown.slice(0, PREVIEW).map(function (e) {
              return <ExerciseRow key={e.id} e={e} onOpen={onOpenExercise} lang={lang} C={C} P={P} />;
            })
          )}
          <button
            type="button"
            data-qa="ver-ejercicios"
            onClick={function () { onOpenList(mode); }}
            style={{ marginTop: 6, minHeight: 44, border: "1px solid " + P.line, borderRadius: 12, background: "transparent", color: P.accentText, fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}
          >
            {M(lang, "Ver y buscar ejercicios (" + list.length + ")", "See and search exercises (" + list.length + ")", "Ver e buscar exercícios (" + list.length + ")")}
          </button>
        </>
      )}
    </section>
  );
}

/** Contenido de la hoja «Historial por ejercicio»: buscador y dos grupos (en la rutina actual / ya no están en la rutina). */
export function ProgressExerciseList({ ejercicios, initialMode, onOpenExercise, lang, C, P }) {
  var list = ejercicios || [];
  var [mode, setMode] = useState(initialMode || "todos");
  var [query, setQuery] = useState("");
  var filtered = useMemo(function () { return filterExercises(list, mode, query); }, [list, mode, query]);
  var enRut = filtered.filter(function (e) { return e.enRutina; });
  var fuera = filtered.filter(function (e) { return !e.enRutina; });
  var inputId = "progreso-buscar-ejercicio";
  function group(title, items, qa) {
    if (!items.length) return null;
    return (
      <div data-qa={qa}>
        <h3 style={{ margin: "14px 0 2px", fontSize: 13, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: P.muted }}>{title + " · " + items.length}</h3>
        {items.map(function (e) {
          return <ExerciseRow key={e.id} e={e} onOpen={onOpenExercise} lang={lang} C={C} P={P} />;
        })}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Segmented mode={mode} setMode={setMode} nRutina={list.filter(function (e) { return e.enRutina; }).length} nTodos={list.length} lang={lang} C={C} P={P} />
      <label htmlFor={inputId} style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>
        {M(lang, "Buscar ejercicio", "Search exercise", "Buscar exercício")}
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 48, padding: "0 12px", background: P.dark ? C.cardDark : C.card, border: "1px solid " + P.line, borderRadius: 12 }}>
        <Search size={18} color={P.muted} aria-hidden="true" />
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={function (e) { setQuery(e.target.value); }}
          placeholder={M(lang, "Buscar ejercicio", "Search exercise", "Buscar exercício")}
          autoComplete="off"
          style={{ flex: 1, minWidth: 0, minHeight: 44, background: "transparent", border: "none", outline: "none", color: C.t, fontSize: 16, fontFamily: "inherit" }}
        />
      </div>
      {filtered.length === 0 ? (
        <p role="status" style={{ margin: "8px 0", fontSize: 14, color: P.muted, lineHeight: 1.45 }}>
          {query
            ? M(lang, "Ningún ejercicio coincide con «" + query + "».", "No exercise matches “" + query + "”.", "Nenhum exercício corresponde a «" + query + "».")
            : M(lang, "Sin ejercicios para mostrar.", "No exercises to show.", "Sem exercícios para mostrar.")}
        </p>
      ) : null}
      {group(M(lang, "En la rutina actual", "In the current routine", "Na rotina atual"), enRut, "grupo-rutina")}
      {group(M(lang, "Ya no están en la rutina", "No longer in the routine", "Não estão mais na rotina"), fuera, "grupo-fuera")}
      <p style={{ margin: "6px 0 0", fontSize: 12, color: P.muted, lineHeight: 1.45 }}>
        {M(lang, "Ordenados por última sesión. Incluye rutinas y ciclos anteriores.", "Sorted by last session. Includes previous routines and cycles.", "Ordenados pela última sessão. Inclui rotinas e ciclos anteriores.")}
      </p>
    </div>
  );
}
