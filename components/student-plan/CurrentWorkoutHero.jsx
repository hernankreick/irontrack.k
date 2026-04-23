import React from "react";
import { Ic } from "../Ic.jsx";

/**
 * Card protagonista del entrenamiento del día (solo presentación).
 * Tema dark + acento #2563EB, métricas y barra de progreso.
 */
export function CurrentWorkoutHero({
  msg,
  textMain,
  textMuted,
  hoyBadgeText,
  semDiaLine,
  dayTitle,
  exerciseCount,
  durationMinutes,
  completedExercises,
  totalExercises,
  progressStatusText,
  onStart,
  ctaLabel,
}) {
  const accent = "#2563EB";
  const track = "rgba(255,255,255,.08)";
  const totalRaw = typeof totalExercises === "number" ? totalExercises : 0;
  const done = typeof completedExercises === "number" ? Math.max(0, completedExercises) : 0;
  const pct = totalRaw > 0 ? Math.min(100, Math.round((100 * done) / totalRaw)) : 0;
  const doneOut = done;
  const totalOut = totalRaw;

  return (
    <div
      className="plan-alumno-hero"
      style={{
        background: "rgba(15,23,42,0.65)",
        borderRadius: 16,
        padding: "20px 18px 20px",
        marginBottom: 0,
        border: "1px solid rgba(148,163,184,0.14)",
        position: "relative",
        overflow: "hidden",
        maxWidth: "100%",
        boxShadow: "0 12px 32px rgba(0,0,0,.2)",
      }}
    >
      <div style={{ position: "relative", zIndex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 10,
            minHeight: 28,
          }}
        >
          {hoyBadgeText ? (
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: 0.55,
                textTransform: "uppercase",
                color: "#E8F0FF",
                background: "rgba(37,99,235,0.35)",
                border: "1px solid rgba(96,165,250,0.35)",
                borderRadius: 999,
                padding: "4px 11px",
                lineHeight: 1.2,
                flexShrink: 0,
              }}
            >
              {hoyBadgeText}
            </div>
          ) : (
            <div />
          )}
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: textMuted,
              textAlign: "right",
              lineHeight: 1.35,
              flexShrink: 0,
              maxWidth: "56%",
            }}
          >
            {semDiaLine}
          </div>
        </div>

        <h2
          style={{
            margin: 0,
            fontSize: 30,
            fontWeight: 900,
            lineHeight: 1.1,
            color: textMain,
            letterSpacing: 0.4,
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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            columnGap: 0,
            marginTop: 22,
            marginBottom: 18,
          }}
        >
          <HeroStat
            colIndex={0}
            icon="calendar"
            value={String(exerciseCount)}
            label={msg("ejercicios", "exercises")}
            textMain={textMain}
            textMuted={textMuted}
            accent={accent}
          />
          <HeroStat
            colIndex={1}
            icon="clock"
            value={String(durationMinutes)}
            label={msg("minutos", "minutes")}
            textMain={textMain}
            textMuted={textMuted}
            accent={accent}
          />
          <HeroStat
            colIndex={2}
            icon="check"
            value={totalOut > 0 ? doneOut + "/" + totalOut : "0/0"}
            label={msg("completados", "completed")}
            textMain={textMain}
            textMuted={textMuted}
            accent={accent}
          />
        </div>

        <div style={{ marginBottom: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              marginBottom: 6,
            }}
          >
            <span
              className="num"
              style={{ fontSize: 13, fontWeight: 800, color: textMain, minWidth: 40 }}
            >
              {pct}%
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: textMuted,
                textAlign: "right",
                flex: 1,
                lineHeight: 1.3,
              }}
            >
              {progressStatusText}
            </span>
          </div>
          <div
            style={{
              height: 4,
              borderRadius: 999,
              background: track,
              overflow: "hidden",
            }}
            aria-hidden
          >
            <div
              style={{
                width: pct + "%",
                height: "100%",
                borderRadius: 999,
                background: "linear-gradient(90deg, #1D4ED8, " + accent + ")",
                transition: "width 0.3s ease",
              }}
            />
          </div>
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
            borderRadius: 14,
            fontSize: 15,
            fontWeight: 800,
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
            boxShadow: "0 10px 24px rgba(37,99,235,0.35)",
          }}
          onClick={onStart}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }} aria-hidden>
            ⚡
          </span>
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}

function HeroStat({ colIndex, icon, value, label, textMain, textMuted, accent }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        minWidth: 0,
        padding: "0 4px",
        borderLeft: colIndex > 0 ? "1px solid rgba(148,163,184,0.14)" : "none",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          minWidth: 0,
        }}
      >
        <div style={{ color: accent, flexShrink: 0, display: "flex" }}>
          {icon === "calendar" && <Ic name="calendar" size={16} color={accent} strokeWidth={2.2} />}
          {icon === "clock" && <Ic name="clock" size={16} color={accent} strokeWidth={2.2} />}
          {icon === "check" && <Ic name="check-sm" size={16} color={accent} strokeWidth={2.5} />}
        </div>
        <div
          className="num"
          style={{
            fontSize: 20,
            fontWeight: 900,
            color: textMain,
            lineHeight: 1.1,
            wordBreak: "break-word",
            minWidth: 0,
          }}
        >
          {value}
        </div>
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.35,
          textTransform: "uppercase",
          color: textMuted,
          lineHeight: 1.2,
        }}
      >
        {label}
      </div>
    </div>
  );
}
