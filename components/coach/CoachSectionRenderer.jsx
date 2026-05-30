import React from 'react';
import CoachDashboardMain from './CoachDashboardMain.jsx';
import CoachExercisesMain from './CoachExercisesMain.jsx';
import CoachRoutinesMain from './CoachRoutinesMain.jsx';
import CoachStudentsMain from './CoachStudentsMain.jsx';
import CoachCalendar from '../CoachCalendar.jsx';
import CoachMobileDrawer from '../layout/CoachMobileDrawer.jsx';
import SettingsPage from '../settings/SettingsPage.jsx';
import ScannerRutina from '../scanner/ScannerRutina.jsx';
import CoachMessagesMain from './CoachMessagesMain.jsx';

export default function CoachSectionRenderer({
  tab,
  esAlumno,
  sessionData,
  showCoachDesktopShell,
  coachDesktop1024,
  dashboardProps,
  calendarProps,
  routinesProps,
  studentsProps,
  exercisesProps,
  settingsProps,
  messagesProps,
  mobileDrawerProps,
  scannerProps,
}) {
  const isCoach = sessionData?.role === "entrenador" && !esAlumno;

  return (
    <>
      {/* Main coach sections */}
      {(tab === "plan" || tab === "progress") && isCoach && (
        <CoachDashboardMain
          activeNav={tab === "progress" ? "progreso" : "dashboard"}
          {...dashboardProps}
        />
      )}

      {tab === "calendar" && isCoach && (
        <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-y-auto">
          <CoachCalendar {...calendarProps} />
        </div>
      )}

      {tab === "routines" && !esAlumno && (
        <CoachRoutinesMain {...routinesProps} />
      )}

      {tab === "alumnos" && sessionData?.role === "entrenador" && (
        <CoachStudentsMain {...studentsProps} />
      )}

      {tab === "mensajes" && isCoach && (
        <CoachMessagesMain {...messagesProps} />
      )}

      {/* Exercise library aliases */}
      {tab === "library" && !esAlumno && (
        <CoachExercisesMain {...exercisesProps} />
      )}

      {tab === "biblioteca" && !esAlumno && (
        <CoachExercisesMain {...exercisesProps} />
      )}

      {/* Coach shell/support views */}
      {(tab === "settings" || tab === "perfil") && showCoachDesktopShell && isCoach && sessionData && (
        <SettingsPage
          key={tab}
          embedInMainColumn
          coach={sessionData}
          initialSection={tab === "perfil" ? "perfil" : "preferencias"}
          {...settingsProps}
        />
      )}

      {showCoachDesktopShell && !coachDesktop1024 && (
        <CoachMobileDrawer {...mobileDrawerProps} />
      )}

      {tab === "scanner" && !esAlumno && (
        <div className="min-w-0 max-w-full">
          <ScannerRutina {...scannerProps} />
        </div>
      )}
    </>
  );
}
