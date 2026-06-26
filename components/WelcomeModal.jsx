import React, { useRef } from "react";
import { createPortal } from "react-dom";
import { CurrentWorkoutHero } from "./student-plan/CurrentWorkoutHero.jsx";

/**
 * Drawer de bienvenida del modo alumno.
 * Usa createPortal para montarse directamente en document.body y evitar
 * problemas de stacking context con AppMainScroll (z-index: 0, overflow-y: auto).
 */
export function WelcomeModal({
  open,
  onOpenChange,
  es,
  bgCard,
  border,
  textMain,
  textMuted,
  msg,
  todayDay,
  currentWeek,
  dayIndex,
  dayTitle,
  typeBadgeText,
  exerciseCount,
  durationMinutes,
  onStartWorkout,
}) {
  // Must be before the early return to comply with Rules of Hooks.
  // Grace period: ignore overlay clicks for 350ms after mount to prevent
  // the login button's mouseup from immediately closing the modal.
  const mountedAt = useRef(0);
  if (open && mountedAt.current === 0) mountedAt.current = Date.now();
  if (!open) { mountedAt.current = 0; return null; }
  if (typeof document === "undefined") return null;

  const startLabel = msg ? msg("EMPEZAR", "START", "COMEÇAR") : es ? "EMPEZAR" : "START";
  const weekDayLine = msg
    ? msg("Semana", "Week", "Semana") + " " + (currentWeek + 1) + " · " + msg("Día", "Day", "Dia") + " " + (dayIndex + 1)
    : "Semana " + (currentWeek + 1) + " · Día " + (dayIndex + 1);
  const handleStart = () => {
    if (onStartWorkout) onStartWorkout();
    else onOpenChange?.(false);
  };

  return createPortal(
    <>
      <div
        className="it-welcome-overlay"
        onClick={() => { if (Date.now() - mountedAt.current > 350) onOpenChange?.(false); }}
        role="presentation"
      >
        <div
          className="it-welcome-panel"
          style={{
            background: bgCard,
            border: "1px solid " + border,
            boxShadow: "0 12px 40px rgba(0,0,0,.35)",
          }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-modal-title"
        >
          <div className="it-welcome-body" style={{ padding: "12px 16px max(18px, env(safe-area-inset-bottom, 0px))" }}>
            <div
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                background: "#2563EB",
                margin: "0 auto 16px",
                opacity: 0.9,
              }}
            />
            <div id="welcome-modal-title" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
              {msg ? msg("Entrenamiento de hoy", "Today's workout", "Treino de hoje") : "Entrenamiento de hoy"}
            </div>
            {todayDay ? (
              <CurrentWorkoutHero
                msg={msg}
                textMain={textMain}
                textMuted={textMuted}
                hoyBadgeText={msg("HOY TOCA", "TODAY", "HOJE")}
                semDiaLine={weekDayLine}
                dayTitle={dayTitle}
                typeBadgeText={typeBadgeText}
                exerciseCount={exerciseCount}
                durationMinutes={durationMinutes}
                ctaLabel={startLabel}
                onStart={handleStart}
              />
            ) : (
              <CurrentWorkoutHero
                msg={msg}
                textMain={textMain}
                textMuted={textMuted}
                hoyBadgeText={msg("HOY TOCA", "TODAY", "HOJE")}
                semDiaLine={weekDayLine}
                dayTitle={msg("Día", "Day", "Dia") + " " + (dayIndex + 1)}
                typeBadgeText={msg("Entrenamiento", "Workout", "Treino")}
                exerciseCount={0}
                durationMinutes={0}
                ctaLabel={startLabel}
                onStart={handleStart}
              />
            )}
            <button
              type="button"
              onClick={() => onOpenChange?.(false)}
              style={{
                display: "block",
                width: "100%",
                marginTop: 8,
                padding: "10px 16px",
                background: "transparent",
                border: "1px solid #1E293B",
                borderRadius: 12,
                color: textMuted,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                textAlign: "center",
                letterSpacing: 0.2,
              }}
            >
              {msg ? msg("Ver rutina completa", "View full routine", "Ver rotina completa") : es ? "Ver rutina completa" : "View full routine"}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
