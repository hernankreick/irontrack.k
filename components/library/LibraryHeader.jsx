import React from 'react';

export default function LibraryHeader({
  libNarrow,
  textMain,
  textMuted,
  msg,
  setTab,
}) {
  return (
    <div
      className="min-w-0"
      style={{
        display:"flex",
        flexDirection: libNarrow ? "column" : "row",
        alignItems: libNarrow ? "stretch" : "flex-start",
        justifyContent:"space-between",
        gap: libNarrow ? 12 : 20,
        marginBottom: 4,
      }}
    >
      <div className="min-w-0" style={{flex: libNarrow ? "none" : 1, minWidth:0}}>
        <h2
          className="min-w-0"
          style={{fontSize: libNarrow ? 22 : 24, fontWeight: 800, color: textMain, lineHeight: 1.2, margin: 0, marginBottom: 6, letterSpacing: 0.2}}
        >
          {msg("Ejercicios", "Exercises", "Exercícios")}
        </h2>
        <p style={{fontSize: 14, lineHeight: 1.5, color: textMuted, margin: 0, maxWidth: 480}}>
          {msg("Gestioná tu biblioteca de movimientos, videos y categorías.", "Manage your library of movements, videos, and categories.", "Gerencie sua biblioteca de movimentos, vídeos e categorias.")}
        </p>
      </div>
      <button
        type="button"
        onClick={function () { setTab(1); }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: "10px 18px",
          borderRadius: 12,
          border: "none",
          background: "#2563EB",
          color: "#fff",
          fontFamily: "inherit",
          fontSize: 14,
          fontWeight: 800,
          cursor: "pointer",
          flexShrink: 0,
          minHeight: 44,
          width: libNarrow ? "100%" : "auto",
        }}
      >
        {msg("+ Nuevo ejercicio", "+ New exercise", "+ Novo exercício")}
      </button>
    </div>
  );
}
