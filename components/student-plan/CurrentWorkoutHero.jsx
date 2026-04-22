import React from "react";
import { Ic } from "../Ic.jsx";

/**
 * Card protagonista del entrenamiento del día (solo presentación).
 * Colores: mismos tokens que App (#2563EB, #F59E0B, textMain, textMuted, border).
 */
export function CurrentWorkoutHero({
  msg,
  textMain,
  textMuted,
  hoyBadgeText,
  semDiaLine,
  titleText,
  muscleChips,
  exerciseCount,
  durationMinutes,
  pendingPrCount,
  onStart,
  ctaLabel,
}) {
  const accent = "#2563EB";
  const prColor = "#F59E0B";

  return (
    <div
      className="plan-alumno-hero"
      style={{
        background: "rgba(37,99,235,.07)",
        borderRadius: 14,
        padding: "20px 18px 18px",
        marginBottom: 0,
        border: "1px solid rgba(37,99,235,.18)",
        position: "relative",
        overflow: "hidden",
        maxWidth: "100%",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: accent,
          borderRadius: "3px 0 0 3px",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div style={{ position: "relative", zIndex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: accent,
              background: "rgba(37,99,235,.14)",
              border: "1px solid rgba(37,99,235,.28)",
              borderRadius: 999,
              padding: "5px 10px",
              lineHeight: 1.2,
              maxWidth: "62%",
            }}
          >
            <span aria-hidden style={{ marginRight: 4 }}>
              •
            </span>
            {hoyBadgeText}
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: textMuted,
              letterSpacing: 0.5,
              textTransform: "uppercase",
              textAlign: "right",
              lineHeight: 1.35,
              flexShrink: 0,
              maxWidth: "48%",
            }}
          >
            {semDiaLine}
          </div>
        </div>

        <h2
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 900,
            lineHeight: 1.2,
            color: textMain,
            wordBreak: "break-word",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {titleText}
        </h2>

        {muscleChips.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginTop: 12,
            }}
          >
            {muscleChips.map(function (m) {
              return (
                <span
                  key={m}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: textMain,
                    background: "rgba(255,255,255,.06)",
                    border: "1px solid rgba(148,163,184,.22)",
                    borderRadius: 999,
                    padding: "4px 10px",
                    lineHeight: 1.2,
                    maxWidth: "100%",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m}
                </span>
              );
            })}
          </div>
        )}

        <div
          style={{
            height: 1,
            background: "rgba(148,163,184,.18)",
            margin: "16px 0 14px",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 16,
          }}
        >
          <PlanStat
            label={msg("Ejercicios", "Exercises")}
            value={String(exerciseCount)}
            icon="list"
            valueColor={textMain}
          />
          <PlanStat
            label={msg("Duración", "Duration")}
            value={"~" + durationMinutes + msg("min", "min")}
            icon="clock"
            valueColor={textMain}
          />
          <PlanStat
            label={msg("PRs pendientes", "PRs pending")}
            value={String(pendingPrCount)}
            icon="award"
            valueColor={prColor}
          />
        </div>

        <button
          type="button"
          className="hov plan-alumno-hero-cta"
          style={{
            width: "100%",
            height: 52,
            padding: "0 15px",
            background: accent,
            color: "#fff",
            border: "none",
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 800,
            cursor: "pointer",
            fontFamily: "inherit",
            letterSpacing: 0.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            touchAction: "manipulation",
            boxSizing: "border-box",
          }}
          onClick={onStart}
        >
          <Ic name="zap" size={16} color="#fff" />
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}

function PlanStat({ label, value, valueColor, icon }) {
  return (
    <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          color: "rgba(148,163,184,.95)",
          marginBottom: 4,
          lineHeight: 1.2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
        }}
      >
        {icon === "list" && (
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        )}
        {icon === "clock" && <Ic name="clock" size={12} color="currentColor" />}
        {icon === "award" && <Ic name="award" size={12} color="currentColor" />}
        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      </div>
      <div
        className="num"
        style={{
          fontSize: 17,
          fontWeight: 800,
          color: valueColor,
          lineHeight: 1.15,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}
