import React from "react";
import { ChevronDown } from "lucide-react";
import { irontrackMsg as M } from "../../lib/irontrackMsg.js";

function Avatar({ initials, size, P }) {
  return (
    <span
      aria-hidden="true"
      style={{
        flex: "none",
        width: size,
        height: size,
        borderRadius: size / 2,
        background: P.accentSoft,
        color: P.accentSoftText,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size >= 40 ? 15 : 12,
        fontWeight: 800,
      }}
    >
      {initials}
    </span>
  );
}

/**
 * Encabezado de Progreso: título, selector de alumno (abre la hoja de alumnos) y período.
 * `compact` = barra de 64 px que reemplaza visualmente al encabezado completo al desplazarse (ProgresoView decide cuándo);
 * `safeTop`: está pegada al borde superior de la pantalla (agrega el área segura).
 */
export default function ProgressHeader({ compact, safeTop, lang, C, P, alumnoName, alumnoInitials, alumnoSub, periodOpts, periodo, setPeriodo, onOpenAlumnos, isUnder768 }) {
  var periodLabel = M(lang, "Período", "Period", "Período");
  var changeAlumno = M(lang, "Cambiar alumno. Seleccionado: ", "Change athlete. Selected: ", "Trocar aluno. Selecionado: ") + alumnoName;

  if (compact) {
    return (
      <div
        data-qa="progreso-header-compacto"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: isUnder768 ? "8px 12px 8px 8px" : "8px 20px 8px 12px",
          // sin la barra superior de la app encima, la barra compacta respeta el área segura del iPhone (notch)
          paddingTop: safeTop ? "calc(8px + env(safe-area-inset-top, 0px))" : 8,
          background: C.bg,
          borderBottom: "1px solid " + C.brd,
          boxShadow: P.dark ? "0 6px 16px rgba(0,0,0,0.35)" : "0 4px 12px rgba(15,23,42,0.08)",
        }}
      >
        <button
          type="button"
          onClick={onOpenAlumnos}
          aria-label={changeAlumno}
          style={{ flex: "1 1 auto", minWidth: 0, display: "flex", alignItems: "center", gap: 10, minHeight: 48, padding: "0 8px", border: "none", borderRadius: 12, background: "transparent", color: C.t, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
        >
          <Avatar initials={alumnoInitials} size={32} P={P} />
          <span style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{alumnoName}</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: P.muted, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{alumnoSub}</span>
          </span>
          <ChevronDown size={16} color={P.muted} aria-hidden="true" style={{ flex: "none" }} />
        </button>
        <label style={{ flex: "none", position: "relative", display: "inline-flex" }}>
          <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>{periodLabel}</span>
          <select
            value={periodo}
            onChange={function (e) { setPeriodo(e.target.value); }}
            style={{
              appearance: "none",
              WebkitAppearance: "none",
              minHeight: 44,
              padding: "0 34px 0 14px",
              background: C.card,
              border: "1px solid " + P.line,
              borderRadius: 22,
              color: C.t,
              fontSize: 16,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            {periodOpts.map(function (o) {
              return <option key={o.id} value={o.id}>{o.short}</option>;
            })}
          </select>
          <ChevronDown size={14} color={P.muted} aria-hidden="true" style={{ position: "absolute", right: 14, top: 15, pointerEvents: "none" }} />
        </label>
      </div>
    );
  }

  return (
    <header
      style={{
        background: C.bg,
        borderBottom: "1px solid " + C.brd,
        padding: isUnder768 ? "20px 16px 14px" : "24px 24px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.2, color: C.t }}>
        {M(lang, "Progreso", "Progress", "Progresso")}
      </h1>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "stretch" }}>
        <button
          type="button"
          onClick={onOpenAlumnos}
          aria-label={changeAlumno}
          data-qa="progreso-alumno-btn"
          style={{
            flex: isUnder768 ? "1 1 100%" : "1 1 320px",
            maxWidth: isUnder768 ? "none" : 420,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: 12,
            minHeight: 56,
            padding: "8px 12px",
            boxSizing: "border-box",
            background: C.card,
            border: "1px solid " + P.line,
            borderRadius: 14,
            color: C.t,
            cursor: "pointer",
            textAlign: "left",
            fontFamily: "inherit",
          }}
        >
          <Avatar initials={alumnoInitials} size={40} P={P} />
          <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{alumnoName}</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: P.muted, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{alumnoSub}</span>
          </span>
          <ChevronDown size={20} color={P.muted} aria-hidden="true" style={{ flex: "none" }} />
        </button>
        <div
          role="group"
          aria-label={periodLabel}
          style={{
            flex: isUnder768 ? "1 1 100%" : "0 1 360px",
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 4,
            padding: 4,
            background: C.card,
            border: "1px solid " + C.brd,
            borderRadius: 12,
            boxSizing: "border-box",
          }}
        >
          {periodOpts.map(function (opt) {
            var active = periodo === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={active}
                onClick={function () { setPeriodo(opt.id); }}
                style={{
                  minHeight: 44,
                  border: "none",
                  borderRadius: 9,
                  background: active ? C.blue : "transparent",
                  color: active ? "#ffffff" : P.text2,
                  fontSize: 14,
                  fontWeight: active ? 700 : 600,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  padding: "0 6px",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
