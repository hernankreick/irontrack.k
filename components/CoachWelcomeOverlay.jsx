import React from 'react';

export default function CoachWelcomeOverlay({
  isCoach,
  steps,
  obStep,
  step,
  bgCard,
  border,
  textMain,
  textMuted,
  msg,
}) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.93)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:bgCard,borderRadius:"20px 20px 0 0",padding:"28px 24px 40px",width:"100%",maxWidth:480,animation:"slideUpFade 0.35s ease"}}
        onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:24}}>
          {steps.map((_,i)=>(
            <div key={(isCoach?"coach":"alumno")+"-welcome-dot-"+i} style={{height:4,borderRadius:2,transition:"all .35s ease",
              width:i===obStep?32:8,
              background:i<obStep?"#22C55E":i===obStep?"#2563EB":border}}/>
          ))}
        </div>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:48,marginBottom:8}}>{step.icon}</div>
          <div style={{fontSize:11,fontWeight:800,letterSpacing:2,color:"#2563EB",marginBottom:4,textTransform:"uppercase"}}>{step.subtitle}</div>
          <div style={{fontSize:28,fontWeight:900,color:textMain,marginBottom:step.body?8:0}}>{step.title}</div>
          {step.body&&<div style={{fontSize:15,color:textMuted,lineHeight:1.6,marginTop:8}}>{step.body}</div>}
        </div>
        {step.items&&(
          <div style={{marginBottom:24}}>
            {step.items.map((item,i)=>(
              <div key={"welcome-item-"+(item.n ?? i)} style={{display:"flex",alignItems:"center",gap:12,marginBottom:12,opacity:item.done?0.6:1}}>
                <div style={{width:36,height:36,borderRadius:"50%",flexShrink:0,
                  background:item.done?"#22C55E22":"#2563EB22",
                  border:"2px solid "+(item.done?"#22C55E":"#2563EB"),
                  color:item.done?"#22C55E":"#2563EB",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:item.done?18:15,fontWeight:900,
                  animation:item.done?"checkPop 0.4s ease":undefined}}>
                  {item.done?"✓":item.n}
                </div>
                <div style={{fontSize:18,fontWeight:700,color:item.done?textMuted:textMain}}>{item.text}</div>
              </div>
            ))}
          </div>
        )}
        <button className="hov" onClick={step.action}
          style={{width:"100%",padding:"16px",background:"#2563EB",color:"#fff",
            border:"none",borderRadius:12,fontSize:18,fontWeight:900,cursor:"pointer",
            fontFamily:"inherit",letterSpacing:1,boxShadow:"0 4px 20px rgba(37,99,235,0.35)",
            marginBottom:step.skip?8:0}}>
          {step.cta}
        </button>
        {step.skip&&(
          <button className="hov" onClick={step.skip}
            style={{width:"100%",padding:"12px",background:"transparent",color:textMuted,
              border:"none",fontSize:15,cursor:"pointer",fontFamily:"inherit"}}>
            {msg("Saltar este paso", "Skip this step")}
          </button>
        )}
      </div>
    </div>
  );
}
