import React from 'react';
import {
  BLUE_GRAD,
  C,
  ONBOARD_CONTENT_WRAP,
} from '../../lib/onboardingTokens.js';
import {
  BtnBack,
  BtnPrimary,
  BtnRow,
  InfoSVG,
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
    <div style={{
      flex:1,
      minHeight:0,
      width:"100%",
      display:"flex",flexDirection:"column",
      background:C.bg,
      boxSizing:"border-box",
      opacity:vis?1:0,transform:vis?"translateY(0)":"translateY(20px)",
      transition:"all .5s cubic-bezier(.16,1,.3,1)",
    }}>
      <div style={{...ONBOARD_CONTENT_WRAP,padding:"20px 24px 0",flex:"0 1 auto",display:"flex",flexDirection:"column",minHeight:0}}>
      <Tag>Tu situación actual</Tag>
      <div style={{fontSize:32,fontWeight:900,color:C.text,lineHeight:1.05,letterSpacing:"-0.5px",marginBottom:8}}>
        ¿CUÁNTOS ALUMNOS<br/>TENÉS AHORA?
      </div>
      <div style={{fontSize:14,color:C.sub,lineHeight:1.6,marginBottom:20}}>
        Esto nos ayuda a mostrarte las funciones más útiles para tu situación.
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:12,flex:"0 0 auto"}}>
        {options.map((opt,i)=>{
          const sel = alumnosRange===opt.id;
          return (
            <div
              key={opt.id}
              onClick={()=>setAlumnosRange(opt.id)}
              style={{
                background:sel?"rgba(37,99,235,0.1)":C.bg2,
                border:`2px solid ${sel?C.blue:C.borderSub}`,
                borderRadius:20,padding:"18px 20px",cursor:"pointer",
                transition:"all .25s cubic-bezier(.16,1,.3,1)",
                boxShadow:sel?"0 0 0 1px rgba(37,99,235,0.3),0 0 28px rgba(37,99,235,0.22),0 0 52px rgba(37,99,235,0.08)":"none",
                position:"relative",overflow:"hidden",
                opacity:vis?1:0,transform:vis?"translateY(0)":"translateY(10px)",
                transitionDelay:`${60+i*55}ms`,
              }}
            >
              {/* Línea acento izquierda */}
              <div style={{position:"absolute",left:0,top:0,bottom:0,width:3,borderRadius:"2px 0 0 2px",background:sel?BLUE_GRAD:"transparent",transition:"background .25s"}}/>

              <div style={{display:"flex",alignItems:"center",gap:16}}>
                {/* Ícono SVG */}
                <div style={{width:60,height:60,borderRadius:16,flexShrink:0,background:sel?"rgba(37,99,235,0.14)":"rgba(255,255,255,0.04)",border:`1.5px solid ${sel?"rgba(37,99,235,0.3)":C.borderSub}`,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .25s"}}>
                  {opt.icon(sel)}
                </div>

                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                    <span style={{fontSize:16,fontWeight:800,color:C.text}}>{opt.label}</span>
                    <span style={{fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:20,letterSpacing:"0.8px",textTransform:"uppercase",background:sel?"rgba(37,99,235,0.18)":"rgba(255,255,255,0.06)",color:sel?"#93C5FD":C.muted,transition:"all .25s"}}>
                      {opt.tag}
                    </span>
                  </div>
                  <div style={{fontSize:12,color:C.sub,lineHeight:1.5}}>{opt.desc}</div>
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
      <div style={{display:"flex",alignItems:"center",gap:8,background:"rgba(37,99,235,0.06)",border:"1px solid rgba(37,99,235,0.12)",borderRadius:12,padding:"10px 14px",marginTop:16}}>
        <InfoSVG color="#3B82F6" size={13}/>
        <span style={{fontSize:11,color:C.muted,lineHeight:1.45}}>Solo usamos esto para personalizar tu experiencia inicial.</span>
      </div>
      </div>

      <BtnRow total={5} current={3}>
        <BtnBack onClick={onBack}/>
        <BtnPrimary onClick={onNext} disabled={!alumnosRange}>
          {alumnosRange?"Continuar":"Seleccioná una opción"}
        </BtnPrimary>
      </BtnRow>
    </div>
  );
};

export default Step3Alumnos;
