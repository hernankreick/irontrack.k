import React from 'react';
import { Ic } from '../Ic.jsx';

/** Bloques de la tarjeta de rutina: semana actual (con fechas) y anillo de dias completados, mas la barra de progreso. */
export default function StudentProgressSummary({
  alumno,
  rutinaAsignada,
  progresoSemanal,
  dias = [],
  diasCompletados,
  pctBar,
  semanaCiclo,
  semCalLabel,
  palette,
  darkMode,
  msg,
  textMain,
  textMuted,
  coachAluTrack,
}) {
  var P = palette || {};
  var track = P.track || coachAluTrack;
  var pct = Math.max(0, Math.min(100, Number(pctBar) || 0));
  var R = 19;
  var C = 2 * Math.PI * R;
  var box = {display:"flex",alignItems:"center",gap:8,minWidth:0,padding:"6px 8px",borderRadius:12,boxSizing:"border-box"};
  return (
    <div style={{marginBottom:8}}>
      <div className="it-ficha-stats" style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8,marginBottom:8}}>
        <div style={Object.assign({}, box, {background:P.blueSoft,border:"1px solid "+P.blueBorder})}>
          <span aria-hidden="true" style={{width:28,height:28,borderRadius:8,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:darkMode?"rgba(59,130,246,0.2)":"rgba(37,99,235,0.12)"}}>
            <Ic name="calendar" size={16} color={P.blueText}/>
          </span>
          <div style={{minWidth:0}}>
            <div data-qa-text style={{fontSize:13.5,fontWeight:700,color:P.blueText,lineHeight:1.25}}>{msg("Semana", "Week")} {semanaCiclo + "\u00a0" + msg("de", "of") + "\u00a04"}</div>
            {semCalLabel ? <div data-qa-text style={{fontSize:11.5,color:textMuted,fontWeight:500,lineHeight:1.25,marginTop:1}}>{semCalLabel}</div> : null}
          </div>
        </div>
        <div style={Object.assign({}, box, {background:P.inner,border:"1px solid "+P.border})}>
          <svg width="32" height="32" viewBox="0 0 46 46" role="img" aria-label={pct + "%"} style={{flexShrink:0}}>
            <circle cx="23" cy="23" r={R} fill="none" stroke={track} strokeWidth="5"/>
            <circle cx="23" cy="23" r={R} fill="none" stroke="#22c55e" strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} transform="rotate(-90 23 23)" style={{transition:"stroke-dashoffset .25s ease"}}/>
          </svg>
          <div style={{minWidth:0}}>
            <div data-qa-text style={{fontSize:13.5,fontWeight:700,color:textMain,lineHeight:1.25}}>{diasCompletados + "\u00a0" + msg("de", "of") + "\u00a0" + dias.length} {msg("días", "days")}</div>
            <div data-qa-text style={{fontSize:11.5,color:textMuted,fontWeight:500,lineHeight:1.25,marginTop:1}}>{pct}% {msg("completado", "completed")}</div>
          </div>
        </div>
      </div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={msg("Progreso de la semana", "Week progress")} style={{height:8,background:track,borderRadius:8,overflow:"hidden"}}>
        <div style={{width:pct+"%",height:"100%",background:"linear-gradient(90deg,#22c55e,#16a34a)",borderRadius:8,transition:"width .25s ease"}}/>
      </div>
    </div>
  );
}
