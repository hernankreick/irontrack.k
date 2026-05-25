import React from "react";
import CoachWelcomeOverlay from "./CoachWelcomeOverlay.jsx";
import { buildCoachWelcomeSteps } from "./coach/coachWelcomeSteps.js";
import StudentWelcomeModalHost from "./student/StudentWelcomeModalHost.jsx";

export default function CoachWelcomeModalHost({
  open,
  sessionData,
  routines,
  alumnos,
  onboardStep,
  studentCurrentWeek,
  activeStudentRoutinePosition,
  allEx,
  es,
  bgCard,
  border,
  textMain,
  textMuted,
  msg,
  images,
  videoOverrides,
  onStudentOpenChange,
  onStudentExerciseVideo,
  onStudentStartWorkout,
  onCoachStart,
  onCoachRoutine,
  onCoachSkipRoutine,
  onCoachAlumno,
  onCoachSkipAlumno,
  onCoachFinish,
}) {
  if (!open) return null;

  const isCoach = sessionData?.role === "entrenador";
  if (!isCoach) {
    return (
      <StudentWelcomeModalHost
        routines={routines}
        studentCurrentWeek={studentCurrentWeek}
        activeStudentRoutinePosition={activeStudentRoutinePosition}
        allEx={allEx}
        sessionData={sessionData}
        es={es}
        bgCard={bgCard}
        border={border}
        textMain={textMain}
        textMuted={textMuted}
        msg={msg}
        images={images}
        videoOverrides={videoOverrides}
        onOpenChange={onStudentOpenChange}
        onExerciseVideo={onStudentExerciseVideo}
        onStartWorkout={onStudentStartWorkout}
      />
    );
  }

  const obStep = onboardStep || 0;
  const routinesReady = routines.length > 0;
  const alumnosReady = alumnos.length > 0;
  const steps = buildCoachWelcomeSteps({
    msg,
    routinesReady,
    alumnosReady,
    actions: {
      start: onCoachStart,
      routine: function () { onCoachRoutine(routinesReady); },
      skipRoutine: onCoachSkipRoutine,
      alumno: function () { onCoachAlumno(alumnosReady); },
      skipAlumno: onCoachSkipAlumno,
      finish: onCoachFinish,
    },
  });
  const step = steps[Math.min(obStep, steps.length - 1)];

  return (
    <CoachWelcomeOverlay
      isCoach={isCoach}
      steps={steps}
      obStep={obStep}
      step={step}
      bgCard={bgCard}
      border={border}
      textMain={textMain}
      textMuted={textMuted}
      msg={msg}
    />
  );
}
