import React from 'react';
import Step0 from './OnboardingStep0.jsx';
import StepFinal from './OnboardingStepFinal.jsx';
import Step3Alumnos from './OnboardingStep3Alumnos.jsx';
import Step1ProfileName from './OnboardingStep1ProfileName.jsx';

// Pasos internos: 0 landing, 1 perfil+nombre, 2 alumnos (solo coach), 3 final.
// Total de pasos visibles: coach = 4 (landing, perfil+nombre, alumnos, final);
// atleta = 3 (landing, perfil+nombre, final) — el paso 2 se salta.
const LANDING_TOTAL_PLACEHOLDER = 4; // rol aún no elegido en el landing; se usa el total del flujo coach

function OnboardingScreen({es, darkMode, onDone}) {

  const [step, setStep]                 = React.useState(0);
  const [role, setRole]                 = React.useState(null);
  const [name, setName]                 = React.useState("");
  const [alumnosRange, setAlumnosRange] = React.useState(null);

  const isCoach = role === "entrenador";
  const totalSteps = isCoach ? 4 : 3;
  const currentStepNumber = step === 3 ? totalSteps : step + 1;

  const next = () => {
    if (step === 1 && !isCoach) setStep(3);
    else setStep(s => s + 1);
  };

  const back = () => {
    if (step === 3 && !isCoach) setStep(1);
    else setStep(s => s - 1);
  };

  const restart = () => { setStep(0); setRole(null); setName(""); setAlumnosRange(null); };

  const screens = {
    0: <Step0             es={es} onNext={next}   onYaTengoCuenta={onDone} total={LANDING_TOTAL_PLACEHOLDER} current={1}/>,
    1: <Step1ProfileName  onNext={next}   onBack={back} role={role} setRole={setRole} name={name} setName={setName} total={totalSteps} current={currentStepNumber}/>,
    2: <Step3Alumnos      onNext={next}   onBack={back} alumnosRange={alumnosRange} setAlumnosRange={setAlumnosRange} total={totalSteps} current={currentStepNumber}/>,
    3: <StepFinal         onDone={onDone} onBack={back} role={role} name={name} alumnosRange={alumnosRange} total={totalSteps} current={currentStepNumber}/>,
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        width: "100%",
        background: "#0A1120",
        fontFamily: "system-ui,sans-serif",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        boxSizing: "border-box",
      }}
    >
      {screens[step]}
    </div>
  );
}

export default OnboardingScreen;
