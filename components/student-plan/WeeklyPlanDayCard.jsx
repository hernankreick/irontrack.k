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
  isFuture,
  dayNumberDisplay,
  titleNode,
  metaLine,
  hoyBadgeText,
  rightProgress,
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
  const futureTone = !!isFuture && !isDayDone;
  const rowBg = highlight ? "rgba(37,99,235,0.09)" : bgCard;
  const rowBorder = highlight
    ? "1px solid rgba(59,130,246,0.55)"
    : "1px solid " + (isDayDone ? "rgba(34,197,94,0.28)" : border);

  return (
    <div
      style={{
        background: rowBg,
        border: rowBorder,
        borderRadius: 14,
        marginBottom: 12,
        overflow: "hidden",
        maxWidth: "100%",
        boxShadow: highlight
          ? "0 0 0 1px rgba(37,99,235,0.2), 0 8px 20px rgba(0,0,0,0.2)"
          : "none",
        opacity: futureTone && !highlight ? 0.58 : 1,
        transition: "opacity 0.2s ease",
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
          gap: 12,
          padding: "16px 14px",
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
            width: 46,
            minWidth: 46,
            height: 46,
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 15,
            fontWeight: 800,
            flexShrink: 0,
            alignSelf: "center",
            background: isDayDone ? success + "24" : highlight ? accent + "2a" : bgSub,
            color: isDayDone ? success : highlight ? accent : textMuted,
            border: "1px solid " + (isDayDone ? success + "55" : highlight ? accent + "55" : border),
            letterSpacing: 0.2,
            textTransform: "uppercase",
            fontFamily: "Barlow Condensed, DM Sans, system-ui, sans-serif",
          }}
        >
          {isDayDone ? (
            <Ic name="check-sm" size={22} color={success} strokeWidth={2.5} />
          ) : (
            <span className="num">{dayNumberDisplay}</span>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 5 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: textMain,
                lineHeight: 1.2,
                letterSpacing: 0.35,
                textTransform: "uppercase",
                fontFamily: "Barlow Condensed, DM Sans, system-ui, sans-serif",
              }}
            >
              {titleNode}
            </span>
            {hoyBadgeText ? (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  color: "#E8F0FF",
                  background: "rgba(37,99,235,0.38)",
                  border: "1px solid rgba(96,165,250,0.4)",
                  borderRadius: 999,
                  padding: "3px 8px",
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
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: textMuted,
              lineHeight: 1.4,
            }}
          >
            {metaLine}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            justifyContent: "center",
            flexShrink: 0,
            alignSelf: "center",
            gap: 2,
            minWidth: 52,
          }}
        >
          {rightProgress ? (
            <span
              className="num"
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: highlight ? textMain : textMuted,
                lineHeight: 1.1,
                letterSpacing: 0.2,
              }}
            >
              {rightProgress}
            </span>
          ) : null}
          <Ic
            name="chevron-right"
            size={18}
            color={textMuted}
            style={{ opacity: isOpen ? 0.9 : 0.45, marginTop: 2 }}
          />
        </div>
      </button>

      {isOpen && children ? <div style={{ borderTop: "1px solid " + border, padding: "0 16px 18px" }}>{children}</div> : null}
    </div>
  );
}
