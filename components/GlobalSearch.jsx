import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClipboardList, Dumbbell, FileText, Search, Users } from "lucide-react";
import { globalSearchTheme } from "./coachThemePalette.js";

const FILTERS = [
  { id: "todo", label: "Todo" },
  { id: "alumnos", label: "Alumnos" },
  { id: "rutinas", label: "Rutinas" },
  { id: "ejercicios", label: "Ejercicios" },
  { id: "sesiones", label: "Sesiones" },
];

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Resalta coincidencias del query en el texto. */
export function HighlightMatch({ text, query, highlightColor = "#60a5fa" }) {
  var q = (query || "").trim();
  if (!q || !text) return <>{text}</>;
  try {
    var parts = String(text).split(new RegExp("(" + escapeRegExp(q) + ")", "gi"));
    return (
      <>
        {parts.map(function (part, i) {
          if (part.toLowerCase() === q.toLowerCase()) {
            return (
              <span key={i} style={{ color: highlightColor, fontWeight: 600 }}>
                {part}
              </span>
            );
          }
          return <React.Fragment key={i}>{part}</React.Fragment>;
        })}
      </>
    );
  } catch (e) {
    return <>{text}</>;
  }
}

function initials(name) {
  var s = String(name || "?")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return s.map(function (w) {
    return w[0];
  }).join("").toUpperCase() || "?";
}

const BADGE_ALUMNO = {
  ok: { bg: "#052e16", color: "#22c55e", label: "OK" },
  riesgo: { bg: "#422006", color: "#f59e0b", label: "RIESGO" },
  inactivo: { bg: "#450a0a", color: "#ef4444", label: "INACTIVO" },
};

const BADGE_OTROS = {
  activa: { bg: "#1e3a8a", color: "#60a5fa", label: "ACTIVA" },
  compuesto: { bg: "#1e3a8a", color: "#60a5fa", label: "COMPUESTO" },
  aislado: { bg: "#1e3a8a", color: "#60a5fa", label: "AISLADO" },
  completada: { bg: "#052e16", color: "#22c55e", label: "COMPLETADA" },
  pendiente: { bg: "#422006", color: "#f59e0b", label: "PENDIENTE" },
};

/**
 * Búsqueda global inline (dropdown, sin página de resultados).
 *
 * Props — arrays normalizados:
 * - alumnos: { id, nombre, pctSemanal, sesionesCompletadas, estado }
 * - rutinas: { id, nombre, ejerciciosCount, semanaActual, alumnosAsignados }
 * - ejercicios: { id, nombre, grupoMuscular, tipo }
 * - sesiones: { id, alumnoNombre, tipoSesion, fechaLabel, estado, alumnoId? }
 */
export default function GlobalSearch({
  alumnos = [],
  rutinas = [],
  ejercicios = [],
  sesiones = [],
  onNavigate,
  placeholder = "Buscar alumno, rutina, ejercicio...",
  /** Coach dashboard: sin control extra a la derecha del input (menos padding). */
  compactInputEnd = false,
  darkMode = true,
}) {
  var th = useMemo(
    function () {
      return globalSearchTheme(darkMode);
    },
    [darkMode]
  );
  var wrapRef = useRef(null);
  var inputRef = useRef(null);
  var [focused, setFocused] = useState(false);
  /** El panel debe seguir abierto al interactuar con chips/resultados aunque el input pierda foco por blur. */
  var [panelOpen, setPanelOpen] = useState(false);
  var [q, setQ] = useState("");
  var [filter, setFilter] = useState("todo");
  var [hlIdx, setHlIdx] = useState(0);

  useEffect(function () {
    var id = "irontrack-global-search-fonts";
    if (typeof document === "undefined" || document.getElementById(id)) return;
    var link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=DM+Mono:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap";
    document.head.appendChild(link);
  }, []);

  var query = q.trim();

  function matches(hay, needle) {
    if (!needle) return true;
    return String(hay || "")
      .toLowerCase()
      .includes(needle.toLowerCase());
  }

  var filteredSections = useMemo(
    function () {
      var needle = query;
      var secAl = filter === "todo" || filter === "alumnos";
      var secRu = filter === "todo" || filter === "rutinas";
      var secEj = filter === "todo" || filter === "ejercicios";
      var secSe = filter === "todo" || filter === "sesiones";

      var out = [];
      if (secAl && alumnos.length) {
        var fa = alumnos.filter(function (a) {
          return (
            matches(a.nombre, needle) ||
            matches(String(a.pctSemanal), needle) ||
            matches(String(a.sesionesCompletadas), needle)
          );
        });
        if (fa.length) out.push({ key: "alumnos", label: "Alumnos", rows: fa, kind: "alumno" });
      }
      if (secRu && rutinas.length) {
        var fr = rutinas.filter(function (r) {
          return (
            matches(r.nombre, needle) ||
            matches(String(r.ejerciciosCount), needle) ||
            matches(String(r.semanaActual), needle) ||
            matches(r.alumnosAsignados, needle)
          );
        });
        if (fr.length) out.push({ key: "rutinas", label: "Rutinas", rows: fr, kind: "rutina" });
      }
      if (secEj && ejercicios.length) {
        var fe = ejercicios.filter(function (e) {
          return (
            matches(e.nombre, needle) ||
            matches(e.grupoMuscular, needle) ||
            matches(e.tipo, needle)
          );
        });
        if (fe.length) out.push({ key: "ejercicios", label: "Ejercicios", rows: fe, kind: "ejercicio" });
      }
      if (secSe && sesiones.length) {
        var fs = sesiones.filter(function (s) {
          return (
            matches(s.alumnoNombre, needle) ||
            matches(s.tipoSesion, needle) ||
            matches(s.fechaLabel, needle)
          );
        });
        if (fs.length) out.push({ key: "sesiones", label: "Sesiones", rows: fs, kind: "sesion" });
      }
      return out;
    },
    [alumnos, rutinas, ejercicios, sesiones, query, filter]
  );

  var flatNav = useMemo(
    function () {
      var list = [];
      filteredSections.forEach(function (sec) {
        sec.rows.forEach(function (row) {
          list.push({ kind: sec.kind, row: row });
        });
      });
      return list;
    },
    [filteredSections]
  );

  useEffect(
    function () {
      setHlIdx(0);
    },
    [query, filter, flatNav.length]
  );

  useEffect(
    function () {
      if (hlIdx >= flatNav.length) setHlIdx(Math.max(0, flatNav.length - 1));
    },
    [flatNav.length, hlIdx]
  );

  var showDropdown = panelOpen && (query.length >= 1 || filter !== "todo");

  useEffect(
    function () {
      if (!panelOpen) return undefined;
      function onDoc(e) {
        if (wrapRef.current && !wrapRef.current.contains(e.target)) {
          setPanelOpen(false);
          setFocused(false);
        }
      }
      document.addEventListener("mousedown", onDoc);
      return function () {
        document.removeEventListener("mousedown", onDoc);
      };
    },
    [panelOpen]
  );

  var runNavigate = useCallback(
    function (kind, row) {
      if (typeof onNavigate !== "function") return;
      if (kind === "alumno") onNavigate("alumnos", row.id);
      else if (kind === "rutina") onNavigate("rutinas", row.id);
      else if (kind === "ejercicio") onNavigate("ejercicios", row.id);
      else if (kind === "sesion")
        onNavigate("sesiones", row.alumnoId != null ? row.alumnoId : row.id);
      setPanelOpen(false);
      setFocused(false);
      inputRef.current && inputRef.current.blur();
    },
    [onNavigate]
  );

  var onKeyDown = useCallback(
    function (e) {
      if (e.key === "Escape") {
        e.preventDefault();
        setPanelOpen(false);
        setFocused(false);
        return;
      }
      if (!showDropdown || flatNav.length === 0) {
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHlIdx(function (i) {
          return (i + 1) % flatNav.length;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHlIdx(function (i) {
          return (i - 1 + flatNav.length) % flatNav.length;
        });
      } else if (e.key === "Enter") {
        e.preventDefault();
        var cur = flatNav[hlIdx];
        if (cur) runNavigate(cur.kind, cur.row);
      }
    },
    [showDropdown, flatNav, hlIdx, runNavigate]
  );

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", maxWidth: 440, minWidth: 200 }}>
      <div style={{ position: "relative" }}>
        <Search
          size={18}
          strokeWidth={2}
          aria-hidden
          style={{
            position: "absolute",
            left: 14,
            top: "50%",
            transform: "translateY(-50%)",
            color: th.chipColor,
            pointerEvents: "none",
          }}
        />
        <input
          ref={inputRef}
          type="search"
          value={q}
          placeholder={placeholder}
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          onChange={function (e) {
            setQ(e.target.value);
          }}
          onFocus={function () {
            setFocused(true);
            setPanelOpen(true);
          }}
          onBlur={function () {
            setFocused(false);
          }}
          onKeyDown={onKeyDown}
          style={{
            width: "100%",
            height: 44,
            boxSizing: "border-box",
            background: th.inputBg,
            border: focused || panelOpen ? "1px solid #2563EB" : "1px solid " + th.inputBorder,
            borderRadius: 12,
            padding: compactInputEnd ? "0 16px 0 44px" : "0 48px 0 44px",
            color: th.inputText,
            fontSize: 15,
            fontFamily: "'DM Sans', system-ui, sans-serif",
            outline: "none",
          }}
        />
      </div>

      {showDropdown ? (
        <div
          role="listbox"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            marginTop: 6,
            background: th.panelBg,
            border: "1px solid " + th.panelBorder,
            borderRadius: 14,
            zIndex: 50,
            maxHeight: "min(70vh, 420px)",
            overflowY: "auto",
            boxShadow: th.panelShadow,
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              padding: "10px 12px 8px",
              borderBottom: "1px solid " + th.panelBorder,
            }}
          >
            {FILTERS.map(function (f) {
              var sel = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onMouseDown={function (e) {
                    e.preventDefault();
                  }}
                  onClick={function () {
                    setPanelOpen(true);
                    setFilter(f.id);
                    if (inputRef.current) inputRef.current.focus();
                  }}
                  style={{
                    border: sel ? "1px solid #2563EB" : "1px solid " + th.chipBorder,
                    background: sel ? th.chipSelBg : "transparent",
                    color: sel ? th.chipSelColor : th.chipColor,
                    borderRadius: 999,
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {filteredSections.length === 0 ? (
            <div style={{ padding: "20px 16px", color: th.chipColor, fontSize: 14, fontFamily: "'DM Sans',sans-serif" }}>
              Sin resultados
            </div>
          ) : (
            filteredSections.map(function (sec, secIdx) {
              var rowOffset = 0;
              for (var si = 0; si < secIdx; si++) {
                rowOffset += filteredSections[si].rows.length;
              }
              return (
                <div key={sec.key}>
                  <div
                    style={{
                      fontSize: 10,
                      color: th.sectionLabel,
                      textTransform: "uppercase",
                      letterSpacing: "1.5px",
                      padding: "10px 16px 6px",
                      fontFamily: "'DM Mono', ui-monospace, monospace",
                    }}
                  >
                    {sec.label}
                  </div>
                  {sec.rows.map(function (row, ri) {
                    var idx = rowOffset + ri;
                    var active = hlIdx === idx;
                    return (
                      <button
                        key={sec.kind + "-" + row.id}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onMouseEnter={function () {
                          setHlIdx(idx);
                        }}
                        onClick={function () {
                          runNavigate(sec.kind, row);
                        }}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 16px",
                          border: "none",
                          background: active ? th.rowHover : "transparent",
                          cursor: "pointer",
                          textAlign: "left",
                          boxSizing: "border-box",
                        }}
                      >
                        {sec.kind === "alumno" ? (
                          <>
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: "50%",
                                background: th.avatarBg,
                                color: th.avatarColor,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 11,
                                fontWeight: 700,
                                flexShrink: 0,
                                fontFamily: "'DM Mono', monospace",
                              }}
                            >
                              {initials(row.nombre)}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 14,
                                  fontWeight: 600,
                                  color: th.rowText,
                                  fontFamily: "'DM Sans',sans-serif",
                                }}
                              >
                                <HighlightMatch text={row.nombre} query={query} highlightColor={th.highlight} />
                              </div>
                              <div style={{ fontSize: 12, color: th.rowMuted, marginTop: 2 }}>
                                {row.pctSemanal}% semanal · {row.sesionesCompletadas} sesiones
                              </div>
                            </div>
                            {(() => {
                              var st = BADGE_ALUMNO[row.estado] || BADGE_ALUMNO.ok;
                              return (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontFamily: "'DM Mono',monospace",
                                    padding: "3px 8px",
                                    borderRadius: 6,
                                    background: st.bg,
                                    color: st.color,
                                    flexShrink: 0,
                                  }}
                                >
                                  {st.label}
                                </span>
                              );
                            })()}
                          </>
                        ) : null}

                        {sec.kind === "rutina" ? (
                          <>
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: 9,
                                background: th.avatarBg,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              <ClipboardList size={18} color={th.highlight} strokeWidth={2} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: th.rowText }}>
                                <HighlightMatch text={row.nombre} query={query} highlightColor={th.highlight} />
                              </div>
                              <div style={{ fontSize: 12, color: th.rowMuted, marginTop: 2 }}>
                                {row.ejerciciosCount} ej. · Sem. {row.semanaActual} · {row.alumnosAsignados}
                              </div>
                            </div>
                            <span
                              style={{
                                fontSize: 10,
                                fontFamily: "'DM Mono',monospace",
                                padding: "3px 8px",
                                borderRadius: 6,
                                background: BADGE_OTROS.activa.bg,
                                color: BADGE_OTROS.activa.color,
                              }}
                            >
                              {BADGE_OTROS.activa.label}
                            </span>
                          </>
                        ) : null}

                        {sec.kind === "ejercicio" ? (
                          <>
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: 9,
                                background: th.avatarBg,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              <Dumbbell size={18} color={th.highlight} strokeWidth={2} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: th.rowText }}>
                                <HighlightMatch text={row.nombre} query={query} highlightColor={th.highlight} />
                              </div>
                              <div style={{ fontSize: 12, color: th.rowMuted, marginTop: 2 }}>
                                {row.grupoMuscular}
                              </div>
                            </div>
                            <span
                              style={{
                                fontSize: 10,
                                fontFamily: "'DM Mono',monospace",
                                padding: "3px 8px",
                                borderRadius: 6,
                                background: BADGE_OTROS[row.tipo === "aislado" ? "aislado" : "compuesto"].bg,
                                color: BADGE_OTROS[row.tipo === "aislado" ? "aislado" : "compuesto"].color,
                              }}
                            >
                              {BADGE_OTROS[row.tipo === "aislado" ? "aislado" : "compuesto"].label}
                            </span>
                          </>
                        ) : null}

                        {sec.kind === "sesion" ? (
                          <>
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: 9,
                                background: th.avatarBg,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              <FileText size={18} color={th.highlight} strokeWidth={2} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: th.rowText }}>
                                <HighlightMatch text={row.alumnoNombre + " · " + row.tipoSesion} query={query} highlightColor={th.highlight} />
                              </div>
                              <div style={{ fontSize: 12, color: th.rowMuted, marginTop: 2 }}>{row.fechaLabel}</div>
                            </div>
                            <span
                              style={{
                                fontSize: 10,
                                fontFamily: "'DM Mono',monospace",
                                padding: "3px 8px",
                                borderRadius: 6,
                                background:
                                  row.estado === "pendiente" ? BADGE_OTROS.pendiente.bg : BADGE_OTROS.completada.bg,
                                color:
                                  row.estado === "pendiente" ? BADGE_OTROS.pendiente.color : BADGE_OTROS.completada.color,
                              }}
                            >
                              {row.estado === "pendiente" ? "PENDIENTE" : "COMPLETADA"}
                            </span>
                          </>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "8px 12px",
              borderTop: "1px solid " + th.footerBorder,
              fontSize: 11,
              color: th.sectionLabel,
              fontFamily: "'DM Sans',sans-serif",
            }}
          >
            <kbd
              style={{
                background: th.kbdBg,
                border: "1px solid " + th.kbdBorder,
                borderRadius: 4,
                padding: "2px 6px",
                fontSize: 10,
                fontFamily: "'DM Mono',monospace",
              }}
            >
              ↑↓
            </kbd>
            <kbd
              style={{
                background: th.kbdBg,
                border: "1px solid " + th.kbdBorder,
                borderRadius: 4,
                padding: "2px 6px",
                fontSize: 10,
                fontFamily: "'DM Mono',monospace",
              }}
            >
              ↵
            </kbd>
            <kbd
              style={{
                background: th.kbdBg,
                border: "1px solid " + th.kbdBorder,
                borderRadius: 4,
                padding: "2px 6px",
                fontSize: 10,
                fontFamily: "'DM Mono',monospace",
              }}
            >
              Esc
            </kbd>
          </div>
        </div>
      ) : null}
    </div>
  );
}
