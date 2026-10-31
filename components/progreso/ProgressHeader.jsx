import React from "react";
import { ChevronDown } from "lucide-react";
import { irontrackMsg as M } from "../../lib/irontrackMsg.js";
import { PeriodButton } from "./ProgressPeriodPicker.jsx";

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
 * El período (objeto { id, desde?, hasta? }) se muestra en un botón que abre la hoja «Período» (onOpenPeriodo).
 */
export default function ProgressHeader({ compact, safeTop, lang, C, P, alumnoName, alumnoInitials, alumnoSub, periodo, onOpenPeriodo, onOpenAlumnos, isUnder768 }) {
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
        <PeriodButton periodo={periodo} onOpen={onOpenPeriodo} compact={true} lang={lang} C={C} P={P} />
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
      {/* alumno y período en una sola fila (56 px): el período ocupa solo su texto, el alumno el resto */}
      <div style={{ display: "flex", gap: 8, alignItems: "stretch", maxWidth: isUnder768 ? "none" : 640 }}>
        <button
          type="button"
          onClick={onOpenAlumnos}
          aria-label={changeAlumno}
          data-qa="progreso-alumno-btn"
          style={{
            flex: "1 1 0",
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
        <PeriodButton periodo={periodo} onOpen={onOpenPeriodo} compact={false} short={isUnder768} lang={lang} C={C} P={P} />
      </div>
    </header>
  );
}
