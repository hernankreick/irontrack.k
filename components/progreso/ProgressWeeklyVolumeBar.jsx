import React from "react";
import { coachType as _T, coachTypeMobile } from "../coachUiScale.js";
import { irontrackMsg as M } from "../../lib/irontrackMsg.js";

export default function ProgressWeeklyVolumeBar({
  bar,
  index,
  previousBar,
  maxV,
  currentRoutineWeekIndex,
  isHover,
  onHover,
  onLeave,
  C,
  lang,
  formatWeeklyVolKgAbbrev,
  formatWeeklyVolKgFull,
  isUnder768,
}) {
  const T = isUnder768 ? coachTypeMobile : _T;
  var chartBarMaxPx = isUnder768 ? 90 : 132;
  var h = maxV > 0 ? (bar.v / maxV) * chartBarMaxPx : 0;
  if (maxV > 0 && bar.v <= 0) {
    h = Math.max(h, 4);
  } else if (maxV <= 0) {
    h = 4;
  }
  var isCurrentWeek = index === currentRoutineWeekIndex;
  var barOpacity = isCurrentWeek ? 1 : 0.42;
  var volLabel = bar.v > 0 ? formatWeeklyVolKgAbbrev(bar.v) : "0";
  var prevVol = index > 0 && previousBar ? previousBar.v : null;
  var diffVsPrev = prevVol != null ? bar.v - prevVol : null;
  var diffLine = "";
  if (index === 0) {
    diffLine = M(lang, "Inicio del bloque", "Block start");
  } else if (diffVsPrev != null) {
    var sign = diffVsPrev > 0 ? "+" : "";
    diffLine =
      sign +
      Math.round(diffVsPrev).toLocaleString(undefined, {
        maximumFractionDigits: 0,
      }) +
      " kg " +
      M(lang, "vs anterior", "vs prev.");
  }
  var barGrad = "linear-gradient(180deg, #7dd3fc 0%, #3b82f6 42%, #1d4ed8 100%)";

  return (
    <div
      style={{
        flex: "1 1 0",
        minWidth: 0,
        maxWidth: isUnder768 ? 64 : 96,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
        position: "relative",
      }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <div
        style={{
          ...T.bodySemibold,
          fontWeight: 700,
          color: bar.v > 0 ? C.t : C.t2,
          letterSpacing: 0.2,
          marginBottom: 8,
          textAlign: "center",
          minHeight: 18,
        }}
      >
        {volLabel}
      </div>
      <div
        style={{
          width: "100%",
          flex: 1,
          minHeight: chartBarMaxPx + 8,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          alignItems: "center",
          position: "relative",
        }}
      >
        {isHover ? (
          <div
            style={{
              position: "absolute",
              bottom: "calc(100% + 6px)",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 5,
              pointerEvents: "none",
              whiteSpace: "nowrap",
              background: "#0f172a",
              border: "1px solid " + C.brd,
              borderRadius: 8,
              padding: "8px 10px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
              fontSize: 11,
              lineHeight: 1.45,
              color: C.t,
              textAlign: "left",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              {formatWeeklyVolKgFull(bar.v)}
            </div>
            <div style={{ color: C.t2, fontWeight: 500 }}>
              {diffLine}
            </div>
          </div>
        ) : null}
        <div
          style={{
            width: isCurrentWeek ? "78%" : "68%",
            maxWidth: isUnder768 ? 38 : 56,
            height: Math.max(0, h) + "px",
            minHeight: maxV <= 0 ? 4 : 0,
            borderRadius: 8,
            backgroundImage: maxV <= 0 || bar.v <= 0 ? "none" : barGrad,
            backgroundColor: maxV <= 0 || bar.v <= 0 ? "#2a2a3a" : "transparent",
            opacity: maxV <= 0 && bar.v <= 0 ? 0.35 : barOpacity,
            boxShadow: isCurrentWeek
              ? "0 0 0 1px rgba(59,130,246,0.45), 0 6px 18px rgba(37,99,235,0.35)"
              : "none",
            transition: "opacity 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease",
            transform: isHover ? "scaleY(1.02)" : "none",
            transformOrigin: "bottom center",
          }}
        />
      </div>
      <span
        style={{
          ...T.labelMd,
          color: isCurrentWeek ? C.blue : C.t2,
          textAlign: "center",
          marginTop: 10,
        }}
      >
        {bar.s}
      </span>
    </div>
  );
}
