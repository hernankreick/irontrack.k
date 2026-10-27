import React from 'react';
import {
  BLUE_GRAD,
  C,
} from '../../lib/onboardingTokens.js';
import {
  BtnBack,
  BtnPrimary,
  BtnRow,
  InfoSVG,
  OnboardingShell,
  Tag,
  UserGroupSVG,
  UserOneSVG,
  UserTeamSVG,
} from './OnboardingPrimitives.jsx';

/* ═══════════════════════════════════════════
   PASO 3 — ALUMNOS (solo entrenadores)
═══════════════════════════════════════════ */
const Step3Alumnos = ({onNext,onBack,alumnosRange,setAlumnosRange}) => {
  const [vis,setVis] = React.useState(false);
  React.useEffect(()=>{const t=setTimeout(()=>setVis(true),60);return()=>clearTimeout(t);},[]);

  const options = [
    {id:"1-5",  label:"1 — 5 alumnos",     desc:"Trabajo personalizado o estás empezando",  tag:"Personalizado",  icon:(s)=><UserOneSVG  color={s?"#3B82F6":"#64748B"} size={32}/>},
    {id:"5-10", label:"5 — 10 alumnos",    desc:"Grupo consolidado, buscás más organización", tag:"En crecimiento", icon:(s)=><UserGroupSVG color={s?"#3B82F6":"#64748B"} size={32}/>},
    {id:"10+",  label:"Más de 10 alumnos", desc:"Cartera amplia, necesitás escalar el sistema",tag:"Escala",         icon:(s)=><UserTeamSVG  color={s?"#3B82F6":"#64748B"} size={32}/>},
  ];

  return (
    <OnboardingShell
      enter={vis}
      justify="center"
      bottom={
        <BtnRow total={5} current={3}>
          <BtnBack onClick={onBack}/>
          <BtnPrimary onClick={onNext} disabled={!alumnosRange}>
            {alumnosRange?"Continuar":"Seleccioná una opción"}
          </BtnPrimary>
        </BtnRow>
      }
    >
      <Tag>Tu situación actual</Tag>
      <div style={{fontSize:"clamp(24px, 4vh, 30px)",fontWeight:900,color:C.text,lineHeight:1.1,letterSpacing:"-0.5px",marginBottom:6}}>
        ¿CUÁNTOS ALUMNOS<br/>TENÉS AHORA?
      </div>
      <div style={{fontSize:"clamp(13px, 1.9vh, 14px)",color:C.sub,lineHeight:1.45,marginBottom:"clamp(10px, 2vh, 16px)"}}>
        Esto nos ayuda a mostrarte las funciones más útiles para tu situación.
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:"clamp(8px, 1.5vh, 12px)",flex:"0 0 auto"}}>
        {options.map((opt,i)=>{
          const sel = alumnosRange===opt.id;
          return (
            <div
              key={opt.id}
              role="button"
              tabIndex={0}
              aria-pressed={sel}
              onClick={()=>setAlumnosRange(opt.id)}
              onKeyDown={(e)=>(e.key==="Enter"||e.key===" ")&&(e.preventDefault(),setAlumnosRange(opt.id))}
              style={{
                background:sel?"rgba(37,99,235,0.1)":C.bg2,
                border:`2px solid ${sel?C.blue:C.borderSub}`,
                borderRadius:18,padding:"clamp(10px, 1.8vh, 14px) 16px",cursor:"pointer",
                transition:"all .25s cubic-bezier(.16,1,.3,1)",
                boxShadow:sel?"0 0 0 1px rgba(37,99,235,0.3),0 0 28px rgba(37,99,235,0.22),0 0 52px rgba(37,99,235,0.08)":"none",
                position:"relative",overflow:"hidden",outline:"none",
                opacity:vis?1:0,transform:vis?"translateY(0)":"translateY(10px)",
                transitionDelay:`${60+i*55}ms`,
              }}
            >
              {/* Línea acento izquierda */}
              <div style={{position:"absolute",left:0,top:0,bottom:0,width:3,borderRadius:"2px 0 0 2px",background:sel?BLUE_GRAD:"transparent",transition:"background .25s"}}/>

              <div style={{display:"flex",alignItems:"center",gap:14}}>
                {/* Ícono SVG */}
                <div style={{width:"clamp(44px, 6.5vh, 54px)",height:"clamp(44px, 6.5vh, 54px)",borderRadius:14,flexShrink:0,background:sel?"rgba(37,99,235,0.14)":"rgba(255,255,255,0.04)",border:`1.5px solid ${sel?"rgba(37,99,235,0.3)":C.borderSub}`,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .25s"}}>
                  {opt.icon(sel)}
                </div>

                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3,flexWrap:"wrap"}}>
                    <span style={{fontSize:16,fontWeight:800,color:C.text}}>{opt.label}</span>
                    <span style={{fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:20,letterSpacing:"0.8px",textTransform:"uppercase",background:sel?"rgba(37,99,235,0.18)":"rgba(255,255,255,0.06)",color:sel?"#93C5FD":C.muted,transition:"all .25s"}}>
                      {opt.tag}
                    </span>
                  </div>
                  <div style={{fontSize:12,color:C.sub,lineHeight:1.4}}>{opt.desc}</div>
                </div>

                {/* Radio */}
                <div style={{width:24,height:24,borderRadius:"50%",flexShrink:0,border:`2px solid ${sel?C.blue:C.muted}`,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .25s",boxShadow:sel?"0 0 10px rgba(37,99,235,0.4)":"none"}}>
                  <div style={{width:11,height:11,borderRadius:"50%",background:C.blue,opacity:sel?1:0,transform:sel?"scale(1)":"scale(0)",transition:"all .25s cubic-bezier(.16,1,.3,1)"}}/>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Nota privacidad */}
      <div style={{display:"flex",alignItems:"center",gap:8,background:"rgba(37,99,235,0.06)",border:"1px solid rgba(37,99,235,0.12)",borderRadius:12,padding:"8px 12px",marginTop:"clamp(10px, 1.8vh, 14px)"}}>
        <InfoSVG color="#3B82F6" size={13}/>
        <span style={{fontSize:11,color:C.muted,lineHeight:1.4}}>Solo usamos esto para personalizar tu experiencia inicial.</span>
      </div>
    </OnboardingShell>
  );
};

export default Step3Alumnos;
