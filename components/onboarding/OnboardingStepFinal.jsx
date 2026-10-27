import React from 'react';
import {
  BLUE_GRAD,
  BTN_H,
  C,
  GLOW,
  GLOW_G,
  GREEN_GRAD,
} from '../../lib/onboardingTokens.js';
import {
  BtnPrimary,
  CalSVG,
  ChartSVG,
  CheckSVG,
  CoachSVG,
  Dots,
  InfoSVG,
  OnboardingShell,
  TrendSVG,
} from './OnboardingPrimitives.jsx';

/* ═══════════════════════════════════════════
   PASO FINAL — Dashboard preview
═══════════════════════════════════════════ */
const StepFinal = ({onDone,onBack,role,name,alumnosRange}) => {
  const isCoach = role==="entrenador";
  const [done,setDone] = React.useState(false);
  const finish = ()=>{ setDone(true); setTimeout(onDone,950); };

  const rangeLabel = alumnosRange==="1-5"?"1 a 5":alumnosRange==="5-10"?"5 a 10":"más de 10";
  const totalDots  = isCoach ? 5 : 4;
  const currentDot = isCoach ? 4 : 3;

  const steps = isCoach
    ? [
        {icon:<CoachSVG  color="#3B82F6" size={14}/>, label:"Agregar tu primer alumno",  status:"pendiente",  c:"#3B82F6"},
        {icon:<CalSVG    color="#22C55E" size={14}/>, label:"Crear tu primera rutina",    status:"pendiente",  c:"#22C55E"},
        {icon:<ChartSVG  color="#94A3B8" size={14}/>, label:"Ver el panel de progreso",   status:"disponible", c:"#94A3B8"},
      ]
    : [
        {icon:<CalSVG    color="#3B82F6" size={14}/>, label:"Tu plan ya está disponible", status:"listo",      c:"#3B82F6"},
        {icon:<ChartSVG  color="#22C55E" size={14}/>, label:"Registrá tu primera sesión", status:"pendiente",  c:"#22C55E"},
        {icon:<TrendSVG  color="#94A3B8" size={14}/>, label:"Ver tu historial de PRs",    status:"disponible", c:"#94A3B8"},
      ];

  return (
    <OnboardingShell
      justify="center"
      backdrop={<div style={{position:"absolute",top:-80,left:"50%",transform:"translateX(-50%)",width:420,height:420,borderRadius:"50%",background:done?"radial-gradient(circle,rgba(34,197,94,0.14) 0%,transparent 65%)":"radial-gradient(circle,rgba(37,99,235,0.12) 0%,transparent 65%)",pointerEvents:"none",transition:"background .6s"}}/>}
      bottom={
        <>
          <Dots total={totalDots} current={currentDot} marginBottom={10}/>
          {/* Fila flex: el CTA ocupa todo el ancho del contenedor, centrado y con el mismo alto (BTN_H) que el resto de pasos */}
          <div style={{display:"flex",flexDirection:"row",width:"100%",height:BTN_H}}>
            <BtnPrimary onClick={finish} done={done}>
              {done?"Redirigiendo...":"Ir a mi panel"}
            </BtnPrimary>
          </div>
          {!done&&(
            <button onClick={onBack} style={{display:"block",width:"100%",marginTop:4,background:"none",border:"none",color:C.muted,fontSize:12,fontWeight:600,letterSpacing:"1px",textTransform:"uppercase",cursor:"pointer",fontFamily:"system-ui,sans-serif",height:44}}>
              Atrás
            </button>
          )}
        </>
      }
    >
      {/* Checkmark */}
      <div style={{display:"flex",justifyContent:"center",marginBottom:"clamp(8px, 1.6vh, 12px)"}}>
        <div style={{width:"clamp(52px, 8vh, 68px)",height:"clamp(52px, 8vh, 68px)",borderRadius:20,background:done?GREEN_GRAD:BLUE_GRAD,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:done?GLOW_G:GLOW,transition:"all .5s"}}>
          <CheckSVG size={30}/>
        </div>
      </div>

      <div style={{textAlign:"center",marginBottom:"clamp(10px, 2vh, 16px)"}}>
        <div style={{fontSize:"clamp(24px, 4.2vh, 32px)",fontWeight:900,color:C.text,lineHeight:1.1,marginBottom:6}}>
          Todo listo,<br/>{name||"Hernan"}
        </div>
        <div style={{fontSize:"clamp(13px, 1.9vh, 14px)",color:C.sub,lineHeight:1.45}}>
          {isCoach?"Tu cuenta está lista. Empezá agregando tu primer alumno.":"Tu perfil está activo. Tu coach puede asignarte rutinas."}
        </div>
      </div>

      {/* Dashboard preview */}
      <div style={{background:C.bg2,borderRadius:18,padding:"14px",border:`1px solid ${C.border}`}}>
        <div style={{fontSize:9,fontWeight:700,letterSpacing:"2px",color:C.muted,textTransform:"uppercase",marginBottom:10}}>Tu panel en IronTrack</div>
        <div style={{marginBottom:10}}>
          <div style={{fontSize:11,color:C.muted,marginBottom:2}}>Buenos días,</div>
          <div style={{fontSize:20,fontWeight:900,color:C.text}}>{name||"Hernan"}</div>
        </div>

        {/* Chip con dato de alumnos capturado */}
        {isCoach && alumnosRange && (
          <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(37,99,235,0.1)",border:"1px solid rgba(37,99,235,0.2)",borderRadius:20,padding:"4px 12px",marginBottom:10}}>
            <CoachSVG color="#3B82F6" size={11}/>
            <span style={{fontSize:11,fontWeight:600,color:"#93C5FD"}}>{rangeLabel} alumnos</span>
          </div>
        )}

        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:10}}>
          {steps.map((s,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",background:C.bg3,borderRadius:10,border:"1px solid rgba(255,255,255,0.04)"}}>
              <div style={{width:28,height:28,borderRadius:8,background:`${s.c}12`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{s.icon}</div>
              <span style={{fontSize:12,color:C.sub,flex:1}}>{s.label}</span>
              <span style={{fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:20,background:`${s.c}14`,color:s.c,letterSpacing:"0.5px",textTransform:"uppercase"}}>{s.status}</span>
            </div>
          ))}
        </div>

        <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(37,99,235,0.07)",borderRadius:10,padding:"8px 12px",border:"1px solid rgba(37,99,235,0.14)"}}>
          <InfoSVG color="#3B82F6" size={12}/>
          <span style={{fontSize:11,color:"#60A5FA"}}>Así va a verse tu panel. Todo listo para empezar.</span>
        </div>
      </div>
    </OnboardingShell>
  );
};

export default StepFinal;
