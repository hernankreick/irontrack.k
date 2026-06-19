import React, { useRef } from "react";
import { resolveVideoUrl } from "../lib/exerciseResolve.js";
import { fmtP } from "../lib/timeFormat.js";
import { ExerciseVideoPlayButton } from "./ExerciseVideoPlayButton.jsx";
import { CurrentWorkoutHero } from "./student-plan/CurrentWorkoutHero.jsx";
import StudentPlanExerciseRows from "./student-plan/StudentPlanExerciseRows.jsx";

/**
 * Drawer de bienvenida del modo alumno.
 * Muestra el entrenamiento actual sin repetir la bienvenida generica anterior.
 */
export function WelcomeModal({
  open,
  onOpenChange,
  routineId,
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
  allEx,
  images,
  videoOverrides,
  onExerciseVideo,
  onStartWorkout,
}) {
  // Must be before the early return to comply with Rules of Hooks.
  // Stores the timestamp of when the modal last opened so the overlay
  // click-to-dismiss is ignored for the first 350ms (prevents click-through
  // from the login button firing on the newly-mounted overlay).
  const mountedAt = useRef(0);
  if (open && mountedAt.current === 0) mountedAt.current = Date.now();
  if (!open) { mountedAt.current = 0; return null; }

  const startLabel = msg ? msg("EMPEZAR", "START", "COMEÇAR") : es ? "EMPEZAR" : "START";
  const weekDayLine = msg
    ? msg("Semana", "Week", "Semana") + " " + (currentWeek + 1) + " · " + msg("Día", "Day", "Dia") + " " + (dayIndex + 1)
    : "Semana " + (currentWeek + 1) + " · Día " + (dayIndex + 1);
  const handleStart = () => {
    if (onStartWorkout) onStartWorkout();
    else onOpenChange?.(false);
  };

  function renderExerciseVideoButton(inf, ex, nombre) {
    var vUrl = resolveVideoUrl(inf || null, ex, videoOverrides || {});
    return (
      <ExerciseVideoPlayButton
        hasVideo={!!vUrl}
        onClick={function () { if (vUrl && onExerciseVideo) onExerciseVideo(nombre, vUrl); }}
        ariaLabel={msg ? msg("Ver video del ejercicio", "View exercise video") : "Ver video"}
        ariaLabelDisabled={msg ? msg("Video no disponible", "No video available") : "Sin video"}
      />
    );
  }

  return (
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
              <>
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
              </>
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
          </div>
        </div>
      </div>
    </>
  );
}
