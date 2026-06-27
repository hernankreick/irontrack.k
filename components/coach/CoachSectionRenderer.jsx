import React from 'react';
import CoachDashboardMain from './CoachDashboardMain.jsx';

function useIsUnder768() {
  const [v, setV] = React.useState(typeof window !== 'undefined' && window.innerWidth < 768);
  React.useEffect(function() {
    var mq = window.matchMedia('(max-width: 767px)');
    function onChange() { setV(mq.matches); }
    mq.addEventListener('change', onChange);
    return function() { mq.removeEventListener('change', onChange); };
  }, []);
  return v;
}
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
  const isUnder768 = useIsUnder768();
  const mobilePad = isUnder768 ? { paddingTop: 20, paddingLeft: 16, paddingRight: 16 } : {};

  return (
    <>
      {/* Main coach sections */}
      {(tab === "plan" || tab === "progress") && isCoach && (
        <div style={mobilePad}>
          <CoachDashboardMain
            activeNav={tab === "progress" ? "progreso" : "dashboard"}
            {...dashboardProps}
          />
        </div>
      )}

      {tab === "calendar" && isCoach && (
        <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-y-auto">
          <CoachCalendar {...calendarProps} />
        </div>
      )}

      {tab === "routines" && !esAlumno && (
        <div style={mobilePad}>
          <CoachRoutinesMain {...routinesProps} />
        </div>
      )}

      {tab === "alumnos" && sessionData?.role === "entrenador" && (
        <div style={mobilePad}>
          <CoachStudentsMain {...studentsProps} />
        </div>
      )}

      {tab === "mensajes" && isCoach && (
        <CoachMessagesMain {...messagesProps} />
      )}

      {/* Exercise library aliases */}
      {tab === "library" && !esAlumno && (
        <div style={mobilePad}>
          <CoachExercisesMain {...exercisesProps} />
        </div>
      )}

      {tab === "biblioteca" && !esAlumno && (
        <div style={mobilePad}>
          <CoachExercisesMain {...exercisesProps} />
        </div>
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
