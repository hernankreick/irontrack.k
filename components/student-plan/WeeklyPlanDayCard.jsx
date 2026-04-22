import React from "react";
import { Ic } from "../Ic.jsx";

/**
 * Fila/card de un día en "Plan de la semana" (cabecera + contenido expandible).
 * Misma interacción que antes: click en cabecera alterna expandido.
 */
export function WeeklyPlanDayCard({
  onHeaderClick,
  isOpen,
  isDayDone,
  isNextDay,
  dayNumberDisplay,
  titleNode,
  muscleLine,
  metaLine,
  hoyBadgeText,
  doneLabel,
  nextLabel,
  textMain,
  textMuted,
  border,
  bgCard,
  bgSub,
  accent,
  success,
  children,
}) {
  const highlight = isNextDay && !isDayDone;
  const rowBg = highlight ? "rgba(37,99,235,.06)" : bgCard;
  const rowBorder = highlight ? "1px solid rgba(37,99,235,.35)" : "1px solid " + (isDayDone ? "rgba(34,197,94,0.28)" : border);

  return (
    <div
      style={{
        background: rowBg,
        border: rowBorder,
        borderRadius: 14,
        marginBottom: 12,
        overflow: "hidden",
        maxWidth: "100%",
      }}
    >
      <button
        type="button"
        className="hov"
        onClick={onHeaderClick}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "stretch",
          gap: 14,
          padding: "16px 16px",
          cursor: "pointer",
          fontFamily: "inherit",
          border: "none",
          background: "transparent",
          color: "inherit",
          textAlign: "left",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            width: 44,
            minWidth: 44,
            height: 44,
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 15,
            fontWeight: 800,
            flexShrink: 0,
            alignSelf: "center",
            background: isDayDone ? success + "22" : highlight ? accent + "22" : bgSub,
            color: isDayDone ? success : highlight ? accent : textMuted,
            border: "1px solid " + (isDayDone ? success + "44" : highlight ? accent + "44" : border),
          }}
        >
          {isDayDone ? (
            <Ic name="check-sm" size={22} color={success} strokeWidth={2.5} />
          ) : (
            <span className="num">{dayNumberDisplay}</span>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: textMain, lineHeight: 1.25 }}>{titleNode}</span>
            {hoyBadgeText ? (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 0.4,
                  textTransform: "uppercase",
                  color: accent,
                  background: "rgba(37,99,235,.14)",
                  border: "1px solid rgba(37,99,235,.28)",
                  borderRadius: 6,
                  padding: "2px 8px",
                  lineHeight: 1.2,
                }}
              >
                {hoyBadgeText}
              </span>
            ) : null}
            {doneLabel ? (
              <span style={{ fontSize: 11, fontWeight: 700, color: success, flexShrink: 0 }}>{doneLabel}</span>
            ) : null}
            {nextLabel ? (
              <span style={{ fontSize: 11, fontWeight: 700, color: accent, flexShrink: 0 }}>{nextLabel}</span>
            ) : null}
          </div>
          {muscleLine ? (
            <div
              style={{
                fontSize: 12,
                color: textMuted,
                lineHeight: 1.35,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {muscleLine}
            </div>
          ) : null}
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: textMuted,
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
              marginTop: 2,
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Ic name="activity" size={13} color={textMuted} />
              {metaLine}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", flexShrink: 0, alignSelf: "center" }}>
          <Ic name="chevron-right" size={20} color={textMuted} style={{ opacity: isOpen ? 0.95 : 0.65 }} />
        </div>
      </button>

      {isOpen && children ? (
        <div style={{ borderTop: "1px solid " + border, padding: "0 16px 18px" }}>{children}</div>
      ) : null}
    </div>
  );
}
