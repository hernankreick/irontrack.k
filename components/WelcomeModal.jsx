import React, { useRef } from "react";
import { createPortal } from "react-dom";
import { CurrentWorkoutHero } from "./student-plan/CurrentWorkoutHero.jsx";
import { getWorkoutHeroLabels, STUDENT_WORKOUT_STATE } from "./student-plan/studentWorkoutState.js";
import { getWeekGateTexts } from "./student-plan/weekGateTexts.js";

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
  workoutState,
  weekGate,
}) {
  // Must be before the early return to comply with Rules of Hooks.
  // Grace period: ignore overlay clicks for 350ms after mount to prevent
  // the login button's mouseup from immediately closing the modal.
  const mountedAt = useRef(0);
  if (open && mountedAt.current === 0) mountedAt.current = Date.now();
  if (!open) { mountedAt.current = 0; return null; }
  if (typeof document === "undefined") return null;

  // Etiquetas segun el estado del dia (misma fuente que el hero del plan). Sin estado -> SIN INICIAR.
  const heroLabels = msg ? getWorkoutHeroLabels(workoutState || STUDENT_WORKOUT_STATE.NOT_STARTED, msg) : null;
  const startLabel = heroLabels ? heroLabels.cta : es ? "EMPEZAR" : "START";
  const weekDayLine = msg
    ? msg("Semana", "Week", "Semana") + " " + (currentWeek + 1) + " · " + msg("Día", "Day", "Dia") + " " + (dayIndex + 1)
    : "Semana " + (currentWeek + 1) + " · Día " + (dayIndex + 1);
  const handleStart = () => {
    if (weekGate && weekGate.active) { onOpenChange?.(false); return; }
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
            {weekGate && weekGate.active ? (
              // Semana completada: la siguiente semana aun no esta disponible. Sin HOY TOCA ni EMPEZAR.
              (() => {
                const t = getWeekGateTexts(weekGate, msg);
                return (
                  <div style={{ textAlign: "center", padding: "6px 4px 2px" }}>
                    <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2, color: "#22C55E" }}>{t.badge}</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: textMain, margin: "6px 0 4px", letterSpacing: -0.3 }}>{t.daysLine}</div>
                    <div style={{ fontSize: 14, color: textMuted, lineHeight: 1.4 }}>{t.body}</div>
                    <div style={{ marginTop: 14, fontSize: 12, color: textMuted, fontWeight: 700, letterSpacing: 0.4 }}>{t.nextLine}</div>
                    <div style={{ fontSize: 15, color: textMain, fontWeight: 800, marginTop: 2 }}>{t.available}</div>
                    <button
                      type="button"
                      onClick={() => onOpenChange?.(false)}
                      style={{ display: "block", width: "100%", marginTop: 16, padding: "14px 16px", background: "#2563EB", color: "#fff", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 900, letterSpacing: 0.6, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      {t.viewRoutine}
                    </button>
                  </div>
                );
              })()
            ) : (
              <>
            {todayDay ? (
              <CurrentWorkoutHero
                msg={msg}
                textMain={textMain}
                textMuted={textMuted}
                hoyBadgeText={heroLabels ? heroLabels.badge : "HOY TOCA"}
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
                hoyBadgeText={heroLabels ? heroLabels.badge : "HOY TOCA"}
                semDiaLine={weekDayLine}
                dayTitle={msg("Día", "Day", "Dia") + " " + (dayIndex + 1)}
                typeBadgeText={msg("Entrenamiento", "Workout", "Treino")}
                exerciseCount={0}
                durationMinutes={0}
                ctaLabel={startLabel}
                onStart={handleStart}
              />
            )}
              </>
            )}
            {!(weekGate && weekGate.active) && (
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
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
