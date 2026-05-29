import React from 'react';

export default function WorkoutHeader({
  bgCard,
  blue,
  border2,
  textMuted,
  textMain,
  isCompact,
  showHeader,
  lastScrollY,
  es,
  activeR,
  activeDay,
  session,
  totalExDone,
  exercises,
  pct,
  darkModeResolved,
  onBack,
}) {
  return (
    <div style={{
      position:"fixed",
      top:0,
      left:0,
      right:0,
      zIndex:85,
      background:bgCard,
      borderBottom:`2px solid ${blue}`,
      paddingTop:"calc(env(safe-area-inset-top, 0px) + 10px)",
      paddingRight:16,
      paddingBottom:isCompact ? 7 : 10,
      paddingLeft:16,
      flexShrink:0,
      transform:showHeader ? "translateY(0)" : "translateY(-100%)",
      opacity:showHeader ? 1 : 0,
      boxShadow:lastScrollY > 0 ? "0 10px 28px rgba(2,6,23,.18)" : "none",
      transition:"transform 0.25s ease, opacity 0.2s ease",
      willChange:"transform, opacity",
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:isCompact ? 6 : 8 }}>
        <button
          className="hov"
          onClick={onBack}
          style={{
            background:"transparent", border:`1px solid ${border2}`,
            borderRadius:10, width:44, height:44, minWidth:44, minHeight:44,
            display:"flex", alignItems:"center", justifyContent:"center",
            cursor:"pointer", color:textMuted, flexShrink:0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M10 3L5 8L10 13"/>
          </svg>
        </button>

        <div style={{ flex:1 }}>
          <div style={{ fontSize:isCompact ? 9 : 10, fontWeight:700, color:blue, letterSpacing:1.5, textTransform:"uppercase" }}>
            {es ? "Entrenando" : "Training"}
          </div>
          <div style={{ fontSize:isCompact ? 13 : 15, fontWeight:900, color:textMain, lineHeight:1.15 }}>
            {activeR?.name} — {activeDay.label || ("Día " + (session.dIdx+1))}
          </div>
        </div>

        <div style={{
          fontSize:isCompact ? 12 : 13, fontWeight:800, color:blue,
          background:"rgba(37,99,235,.12)", border:`1px solid rgba(37,99,235,.2)`,
          borderRadius:20, padding:isCompact ? "3px 10px" : "4px 12px",
        }}>
          {totalExDone}/{exercises.length}
        </div>
      </div>

      {/* Barra de progreso */}
      <div style={{ height:isCompact ? 3 : 4, background:darkModeResolved?"rgba(45,64,87,.6)":"#E2E8F0", borderRadius:2, overflow:"hidden" }}>
        <div style={{ height:"100%", width:pct+"%", background:blue, borderRadius:2, transition:"width .5s ease" }}/>
      </div>
    </div>
  );
}
