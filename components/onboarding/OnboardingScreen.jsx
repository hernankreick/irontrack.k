import React from 'react';
import Step0 from './OnboardingStep0.jsx';
import StepFinal from './OnboardingStepFinal.jsx';
import Step3Alumnos from './OnboardingStep3Alumnos.jsx';
import Step1 from './OnboardingStep1.jsx';
import Step2Name from './OnboardingStep2Name.jsx';

function OnboardingScreen({es, darkMode, onDone}) {

  const [step, setStep]                 = React.useState(0);
  const [role, setRole]                 = React.useState(null);
  const [name, setName]                 = React.useState("");
  const [alumnosRange, setAlumnosRange] = React.useState(null);

  const isCoach = role === "entrenador";

  const next = () => {
    if (step === 2 && !isCoach) setStep(4);
    else setStep(s => s + 1);
  };

  const back = () => {
    if (step === 4 && !isCoach) setStep(2);
    else setStep(s => s - 1);
  };

  const restart = () => { setStep(0); setRole(null); setName(""); setAlumnosRange(null); };

  const screens = {
    0: <Step0        es={es} onNext={next}    onYaTengoCuenta={onDone}/>,
    1: <Step1        onNext={next}    onBack={back} role={role} setRole={setRole}/>,
    2: <Step2Name    onNext={next}    onBack={back} role={role} name={name} setName={setName}/>,
    3: <Step3Alumnos onNext={next}    onBack={back} alumnosRange={alumnosRange} setAlumnosRange={setAlumnosRange}/>,
    4: <StepFinal    onDone={onDone}  onBack={back} role={role} name={name} alumnosRange={alumnosRange}/>,
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
      <style>{`
        .ob-btn-primary,.ob-btn-back{transition:transform 150ms ease,box-shadow 150ms ease,filter 150ms ease}
        .ob-btn-primary:hover:not(:disabled){transform:translateY(-1px);filter:brightness(1.08)}
        .ob-btn-primary:active:not(:disabled){transform:translateY(0) scale(0.98)}
        .ob-btn-back:hover{background:rgba(255,255,255,0.05) !important;border-color:rgba(255,255,255,0.22) !important}
        .ob-btn-back:active{transform:scale(0.98)}
        .ob-btn-primary:focus-visible,.ob-btn-back:focus-visible,.ob-link-btn:focus-visible{outline:2px solid rgba(96,165,250,.85);outline-offset:2px}
        .ob-card-select{transition:transform 150ms ease,border-color 150ms ease,box-shadow 150ms ease}
        .ob-card-select:hover{transform:translateY(-2px) !important}
        .ob-card-select:focus-visible{outline:2px solid rgba(96,165,250,.85);outline-offset:2px}
        @media (prefers-reduced-motion: reduce){
          .ob-btn-primary,.ob-btn-back,.ob-card-select{transition:none !important}
          .ob-btn-primary:hover:not(:disabled),.ob-card-select:hover{transform:none !important}
        }
      `}</style>
      {screens[step]}
    </div>
  );
}

export default OnboardingScreen;
