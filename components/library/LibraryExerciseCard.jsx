import React from 'react';

export default function LibraryExerciseCard({
  e,
  isCustom,
  nombre,
  muscleLine,
  ytUrl,
  patLabel,
  bgCard,
  cardBorder,
  _dm,
  bgSub,
  textMain,
  textMuted,
  border,
  libNarrow,
  Ic,
  msg,
  lang,
  onEdit,
  onDelete,
}) {
  void lang;

  return (
    <div
      className={"it-bib-ex-card min-w-0 " + (_dm ? "it-bib-ex-card-d" : "it-bib-ex-card-l")}
      style={{background:bgCard, border: "1px solid "+cardBorder, borderRadius: 17, padding: libNarrow ? "15px" : "17px", minWidth:0}}
    >
      <div style={{display:"flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap", flexDirection: libNarrow ? "column" : "row" }}>
        <div style={{flex: "1 1 8rem", minWidth:0}}>
          <div
            className="min-w-0"
            style={{fontSize: 17, fontWeight: 800, color: textMain, marginBottom: 7, lineHeight: 1.3, wordBreak: "break-word", overflowWrap: "anywhere"}}
          >
            {nombre}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span
              className="inline-flex"
              style={{
                background: _dm ? "rgba(22, 34, 52, 0.85)" : "rgba(226, 232, 240, 0.85)",
                color: textMuted,
                padding: "2px 8px",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 700,
                border: "1px solid " + cardBorder,
                letterSpacing: 0.2,
              }}
            >
              {patLabel(e.pattern)}
            </span>
            {muscleLine && (
              <span
                className="inline-flex"
                style={{
                  background: _dm ? "rgba(22, 34, 52, 0.5)" : "rgba(37, 99, 235, 0.08)",
                  color: _dm ? textMuted : "#0F1923",
                  padding: "2px 7px",
                  borderRadius: 8,
                  fontSize: 10,
                  fontWeight: 600,
                  border: "1px solid " + (_dm ? "rgba(45, 64, 87, 0.45)" : border),
                  maxWidth: "100%",
                }}
              >
                {muscleLine}
              </span>
            )}
          </div>
        </div>
        <div
          className="min-w-0"
          style={{
            display: "flex",
            gap: 8,
            flexShrink: 0,
            alignItems: "center",
            marginLeft: "auto",
            width: libNarrow ? "100%" : "auto",
            justifyContent: "flex-end",
          }}
        >
          {ytUrl && (
            <a href={ytUrl} target="_blank" rel="noreferrer" aria-label={msg("Ver video", "Watch video", "Ver vídeo")}
              style={{
                width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center",
                background: _dm ? "rgba(22, 34, 52, 0.6)" : bgSub,
                color: textMuted, border: "1px solid " + cardBorder, borderRadius: 12, textDecoration: "none", fontSize: 16, flexShrink: 0,
              }}>▶</a>
          )}
          <button
            type="button"
            onClick={onEdit}
            style={{
              width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center",
              background: _dm ? "rgba(22, 34, 52, 0.6)" : bgSub, color: textMuted, border: "1px solid " + cardBorder, borderRadius: 12, cursor: "pointer", fontSize: 15, flexShrink: 0,
              fontFamily: "inherit", padding: 0,
            }}
          >
            <Ic name="link" size={15}/>
          </button>
          {isCustom && (
            <button
              type="button"
              onClick={onDelete}
              style={{
                width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center",
                background: _dm ? "rgba(22, 34, 52, 0.6)" : bgSub, color: textMuted, border: "1px solid " + cardBorder, borderRadius: 12, cursor: "pointer", fontSize: 15, flexShrink: 0,
                fontFamily: "inherit", padding: 0,
              }}
            >
              <Ic name="trash-2" size={15}/>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
