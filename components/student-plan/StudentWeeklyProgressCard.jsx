import React from 'react';

function StudentWeeklyProgressCard({
  msg,
  bgCard,
  border,
  textMuted,
  darkMode,
  currentWeek,
  daysCompletedThisWeek,
  totalDays,
  weeklyPct,
  nextDayIdx,
}) {
  return (
    <div style={{background:bgCard,borderRadius:14,padding:"12px 16px 13px",marginBottom:10,border:"1px solid "+border}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:6}}>
        <span style={{fontSize:11,fontWeight:700,color:textMuted,letterSpacing:1,textTransform:"uppercase",lineHeight:1.2}}>{msg("Esta semana", "This week")}</span>
        <span style={{fontSize:12,fontWeight:700,color:"#2563EB",whiteSpace:"nowrap",lineHeight:1.2}}>{msg("Semana", "Week")} {currentWeek+1}/4</span>
      </div>
      <div style={{fontSize:12,color:textMuted,fontWeight:600,marginBottom:8,lineHeight:1.25}}>
        {daysCompletedThisWeek} {msg("de", "of")} {totalDays} {msg("días completados", "days completed")}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{flex:1,height:8,borderRadius:999,overflow:"hidden",background:darkMode?"rgba(148,163,184,.18)":"rgba(15,23,42,.12)"}}>
          <div style={{height:"100%",width:weeklyPct+"%",borderRadius:999,background:"linear-gradient(90deg,#2563EB,#22D3EE)",transition:"width .25s ease"}}/>
        </div>
        <span style={{minWidth:34,textAlign:"right",fontSize:12,fontWeight:800,color:"#2563EB",fontVariantNumeric:"tabular-nums",lineHeight:1.2}}>
          {weeklyPct}%
        </span>
      </div>
      {nextDayIdx !== null && (
        <div style={{fontSize:12,color:textMuted,fontWeight:600,marginTop:8,lineHeight:1.25}}>
          {"\u2022"} {msg("Hoy:", "Today:")}{" "}
          <span style={{color:"#2563EB",fontWeight:800}}>{msg("Día", "Day")} {nextDayIdx+1}</span>
        </div>
      )}
    </div>
  );
}

export default StudentWeeklyProgressCard;
