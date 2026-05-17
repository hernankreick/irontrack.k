import React from 'react';
import PagoAlumno from './PagoAlumno.jsx';
import LibraryAlumno from './LibraryAlumno.jsx';
import StudentProgressSection from '../student-progress/StudentProgressSection.jsx';

export default function StudentMainView({
  tab,
  planScrollDiag,
  aliasData,
  es,
  darkMode,
  toast2,
  msg,
  planView,
  allEx,
  routines,
  videoOverrides,
  setVideoModal,
  showAlumnoProgressStack,
  progress,
  EX,
  sesiones,
  sessionData,
  sb,
  sharedParam,
  routineDaysCount,
  onRegistrarPrimerEntrenamiento,
}) {
  return (
    <>
      {tab==="plan"&&planScrollDiag.pagoAlumnoBanner&&aliasData?.alias&&<PagoAlumno aliasData={aliasData} es={es} darkMode={darkMode} toast2={toast2} msg={msg}/>}
      {tab==="plan"&&planView}
      {tab==="library"&&(
        <div className="mx-auto w-full max-w-[32rem] pt-4">
          <LibraryAlumno allEx={allEx} darkMode={darkMode} es={es} routines={routines} videoOverrides={videoOverrides} setVideoModal={setVideoModal} msg={msg}/>
        </div>
      )}
      {tab==="progress"&&showAlumnoProgressStack&&(
        <StudentProgressSection
          progress={progress}
          EX={EX}
          allEx={allEx}
          sesiones={sesiones}
          sessionData={sessionData}
          sb={sb}
          sharedParam={sharedParam||btoa(JSON.stringify({alumnoId:sessionData?.alumnoId}))}
          es={es}
          expectedDaysPerWeek={routineDaysCount}
          onRegistrarPrimerEntrenamiento={onRegistrarPrimerEntrenamiento}
          esEntrenador={false}
        />
      )}
    </>
  );
}
