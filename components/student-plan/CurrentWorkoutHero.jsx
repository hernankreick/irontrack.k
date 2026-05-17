import React from "react";

/**
 * Card protagonista del entrenamiento del dia (solo presentacion).
 * Tema dark + acento #2563EB.
 */
export function CurrentWorkoutHero({
  msg,
  textMain,
  textMuted,
  hoyBadgeText,
  semDiaLine,
  dayTitle,
  typeBadgeText,
  exerciseCount,
  durationMinutes,
  onStart,
  ctaLabel,
}) {
  const accent = "#2563EB";
  const minutesText =
    typeof durationMinutes === "number" && durationMinutes > 0
      ? durationMinutes + " " + msg("min", "min", "min")
      : "-- " + msg("min", "min", "min");
  const exercisesText =
    String(exerciseCount || 0) + " " + msg("ejercicios", "exercises", "exercicios");
  const metaLine = [semDiaLine, minutesText, exercisesText].filter(Boolean).join(" | ");

  return (
    <div
      className="plan-alumno-hero"
      style={{
        background: "linear-gradient(180deg, rgba(13,20,36,0.98), rgba(10,15,26,0.98))",
        borderRadius: 16,
        padding: "22px 18px 18px",
        marginBottom: 0,
        border: "1px solid rgba(96,165,250,0.26)",
        position: "relative",
        overflow: "hidden",
        maxWidth: "100%",
        boxShadow: "0 18px 42px rgba(0,0,0,.34), 0 0 34px rgba(37,99,235,.16)",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: "-40% -15% auto auto",
          width: 180,
          height: 180,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(37,99,235,.24), rgba(37,99,235,0) 68%)",
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative", zIndex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: accent,
            lineHeight: 1.1,
            marginBottom: 8,
          }}
        >
          {hoyBadgeText || msg("HOY TOCA", "TODAY", "HOJE")}
        </div>

        <h2
          style={{
            margin: 0,
            fontSize: 44,
            fontWeight: 900,
            lineHeight: 0.95,
            color: textMain,
            letterSpacing: 0,
            textTransform: "uppercase",
            fontFamily: "Barlow Condensed, DM Sans, system-ui, sans-serif",
            wordBreak: "break-word",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {dayTitle}
        </h2>

        <div style={{ display: "inline-flex", alignItems: "center", marginTop: 12, marginBottom: 14, maxWidth: "100%" }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 0.35,
              color: "#E8F0FF",
              background: "rgba(37,99,235,0.22)",
              border: "1px solid rgba(96,165,250,0.35)",
              borderRadius: 999,
              padding: "5px 12px",
              lineHeight: 1.2,
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {typeBadgeText || msg("Entrenamiento", "Workout", "Treino")}
          </span>
        </div>

        <div
          style={{
            fontSize: 13,
            color: textMuted,
            fontWeight: 700,
            lineHeight: 1.4,
            marginBottom: 8,
          }}
        >
          {metaLine}
        </div>

        <div
          style={{
            fontSize: 15,
            color: textMain,
            fontWeight: 700,
            lineHeight: 1.35,
            marginBottom: 18,
          }}
        >
          {msg(
            "Preparado para romper tus marcas.",
            "Ready to break your records.",
            "Preparado para quebrar suas marcas."
          )}
        </div>

        <button
          type="button"
          className="hov plan-alumno-hero-cta"
          style={{
            width: "100%",
            minHeight: 52,
            padding: "0 16px",
            background: accent,
            color: "#fff",
            border: "none",
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 900,
            cursor: "pointer",
            fontFamily: "inherit",
            letterSpacing: 0.6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            textTransform: "uppercase",
            whiteSpace: "normal",
            textAlign: "center",
            lineHeight: 1.2,
            touchAction: "manipulation",
            boxSizing: "border-box",
            boxShadow: "0 12px 26px rgba(37,99,235,0.38)",
          }}
          onClick={onStart}
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}
