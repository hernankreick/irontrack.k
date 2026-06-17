import React from "react";
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
  if (!open) return null;

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
      <style>{`
        .it-welcome-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,.93);
          z-index: 300;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: calc(4rem + env(safe-area-inset-top, 0px)) 16px env(safe-area-inset-bottom, 0px);
          box-sizing: border-box;
        }
        @media (min-width: 1024px) {
          .it-welcome-overlay {
            align-items: center;
            padding: 2rem 24px;
          }
        }
        .it-welcome-panel {
          width: 100%;
          max-width: 480px;
          max-height: min(78vh, 720px);
          display: flex;
          flex-direction: column;
          border-radius: 20px;
          overflow: hidden;
          animation: slideUpFade 0.35s ease;
          box-sizing: border-box;
        }
        .it-welcome-body {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }
      `}</style>
      <div
        className="it-welcome-overlay"
        onClick={() => onOpenChange?.(false)}
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
                <section style={{ marginTop: 18, paddingBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.1, color: textMain, textTransform: "uppercase", marginBottom: 10 }}>
                    {msg ? msg("TU ENTRENAMIENTO DE HOY", "TODAY'S WORKOUT", "SEU TREINO DE HOJE") : "TU ENTRENAMIENTO DE HOY"}
                  </div>
                  <div style={{ background: "rgba(13,20,36,0.84)", border: "1px solid " + border, borderRadius: 14, overflow: "hidden", padding: "0 12px" }}>
                    <StudentPlanExerciseRows
                      day={todayDay}
                      routineId={routineId || "welcome"}
                      dayIndex={dayIndex}
                      allEx={allEx || []}
                      currentWeekForRoutine={currentWeek}
                      border={border}
                      textMain={textMain}
                      msg={msg}
                      es={es}
                      fmtP={fmtP}
                      images={images}
                      renderExerciseVideoButton={renderExerciseVideoButton}
                    />
                  </div>
                </section>
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
