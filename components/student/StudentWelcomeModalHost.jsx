import React from 'react';
import { WelcomeModal } from '../WelcomeModal.jsx';
import { estimateDayMinutes } from '../student-plan/studentPlanHelpers.js';
import { buildStudentWorkoutLabelTexts, inferStudentWorkoutLabels } from '../student-plan/studentWorkoutLabels.js';

export default function StudentWelcomeModalHost({
  routines,
  studentCurrentWeek,
  activeStudentRoutinePosition,
  allEx,
  sessionData,
  es,
  bgCard,
  border,
  textMain,
  textMuted,
  msg,
  images,
  videoOverrides,
  onOpenChange,
  onExerciseVideo,
  onStartWorkout,
}) {
  const welcomeRoutine = routines[0];
  const welcomeTotalDays = welcomeRoutine?.days?.length || 0;
  const welcomeCurrentWeek = studentCurrentWeek || 0;
  const welcomeCompletedDays = activeStudentRoutinePosition.completedDaysInWeek || 0;
  const welcomeDayIdx = welcomeCompletedDays < welcomeTotalDays ? welcomeCompletedDays : 0;
  const welcomeDay = welcomeRoutine?.days?.[welcomeDayIdx] || null;
  const welcomeExerciseCount = welcomeDay ? (welcomeDay.warmup || []).length + (welcomeDay.exercises || []).length : 0;
  const welcomeExerciseInfos = welcomeDay
    ? [].concat(welcomeDay.exercises || [], welcomeDay.warmup || []).map(function (ex) {
        return allEx.find(function (info) { return info.id === ex.id; }) || ex;
      }).filter(Boolean)
    : [];
  const welcomeWorkoutLabels = inferStudentWorkoutLabels({
    day: welcomeDay,
    exerciseInfos: welcomeExerciseInfos,
    dayIndex: welcomeDayIdx,
    labels: buildStudentWorkoutLabelTexts(msg),
  });

  return (
    <WelcomeModal
      open={true}
      onOpenChange={onOpenChange}
      routineId={welcomeRoutine?.id}
      userName={sessionData?.name}
      es={es}
      bgCard={bgCard}
      border={border}
      textMain={textMain}
      textMuted={textMuted}
      msg={msg}
      todayDay={welcomeDay}
      currentWeek={welcomeCurrentWeek}
      dayIndex={welcomeDayIdx}
      dayTitle={welcomeWorkoutLabels.title}
      typeBadgeText={welcomeWorkoutLabels.typeBadge}
      exerciseCount={welcomeExerciseCount}
      durationMinutes={estimateDayMinutes(welcomeDay, welcomeCurrentWeek)}
      allEx={allEx}
      images={images}
      videoOverrides={videoOverrides}
      onExerciseVideo={onExerciseVideo}
      onStartWorkout={function () {
        onStartWorkout({
          routine: welcomeRoutine,
          day: welcomeDay,
          dayIndex: welcomeDayIdx,
        });
      }}
    />
  );
}
