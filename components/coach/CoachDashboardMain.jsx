import React from 'react';
import CoachDashboard from '../CoachDashboard.jsx';

export default function CoachDashboardMain({
  activeNav,
  alumnos,
  sesionesGlobales,
  progresoGlobal,
  rutinasSBEntrenador,
  allEx,
  lang,
  darkMode,
  currentWeek,
  coachName,
  onEnviarMensaje,
  onCrearRutina,
  onRevisarAlumnos,
  onRevisar,
  onVerPerfil,
  onNuevoAlumno,
  onNuevaRutina,
  onNuevoEjercicio,
  onIrProgreso,
  onAbrirChatAlumno,
  globalSearchData,
  onGlobalSearchNavigate,
  getAlumnoCategoria,
}) {
  return (
    <CoachDashboard
      activeNav={activeNav}
      alumnos={alumnos}
      sesionesGlobales={sesionesGlobales}
      progresoGlobal={progresoGlobal}
      rutinasSBEntrenador={rutinasSBEntrenador}
      allEx={allEx}
      lang={lang}
      darkMode={darkMode}
      currentWeek={currentWeek}
      coachName={coachName}
      onEnviarMensaje={onEnviarMensaje}
      onCrearRutina={onCrearRutina}
      onRevisarAlumnos={onRevisarAlumnos}
      onRevisar={onRevisar}
      onVerPerfil={onVerPerfil}
      onNuevoAlumno={onNuevoAlumno}
      onNuevaRutina={onNuevaRutina}
      onNuevoEjercicio={onNuevoEjercicio}
      onIrProgreso={onIrProgreso}
      onAbrirChatAlumno={onAbrirChatAlumno}
      globalSearchData={globalSearchData}
      onGlobalSearchNavigate={onGlobalSearchNavigate}
      getAlumnoCategoria={getAlumnoCategoria}
    />
  );
}
