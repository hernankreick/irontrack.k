import React from 'react';
import CoachWelcomeModalHost from './CoachWelcomeModalHost.jsx';
import RecordatoriosPanel from './student/RecordatoriosPanel.jsx';
import StudentProfileModalHost from './student/StudentProfileModalHost.jsx';
import AlumnoSettingsModal from './student/AlumnoSettingsModal.jsx';
import SettingsPage from './settings/SettingsPage.jsx';

export default function AppShellModals({
  welcomeProps,
  profileProps,
  settingsOpen,
  esAlumno,
  sessionData,
  tab,
  coachSettingsProps,
  alumnoSettingsProps,
}) {
  return (
    <>
      <CoachWelcomeModalHost {...welcomeProps} />
      <StudentProfileModalHost {...profileProps} />
      {settingsOpen && !esAlumno && sessionData && tab !== "settings" && tab !== "perfil" && (
        <SettingsPage {...coachSettingsProps} />
      )}
      {settingsOpen && esAlumno && (
        <AlumnoSettingsModal
          {...alumnoSettingsProps}
          RecordatoriosPanel={RecordatoriosPanel}
        />
      )}
    </>
  );
}
