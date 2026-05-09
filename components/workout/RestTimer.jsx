import React from 'react';

export default function RestTimer({
  active,
  remainingSeconds,
  totalSeconds,
  nextLabel,
  es,
  green,
  border2,
  textMain,
  textMuted,
  onSkip,
}) {
  if (!active) return null;

  return (
    <div style={{
      position:"absolute", inset:0, zIndex:90,
      background:"rgba(10,18,40,.96)",
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", gap:16,
    }}>
      <div style={{ fontSize:11, fontWeight:700, color:textMuted, letterSpacing:1.2, textTransform:"uppercase" }}>
        {es ? "Descanso" : "Rest"}
      </div>

      {/* SVG circular */}
      <div style={{ position:"relative", width:180, height:180 }}>
        <svg width="180" height="180" viewBox="0 0 180 180" style={{ transform:"rotate(-90deg)" }}>
          <circle cx="90" cy="90" r="80" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="10"/>
          <circle
            cx="90" cy="90" r="80" fill="none"
            stroke={remainingSeconds > totalSeconds * 0.5 ? green : remainingSeconds > totalSeconds * 0.25 ? "#F59E0B" : "#EF4444"}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 80}`}
            strokeDashoffset={`${2 * Math.PI * 80 * (1 - (totalSeconds - remainingSeconds) / Math.max(totalSeconds, 1))}`}
            style={{ transition:"stroke-dashoffset .1s linear, stroke .5s ease" }}
          />
        </svg>
        <div style={{
          position:"absolute", inset:0,
          display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center",
        }}>
          <div style={{ fontSize:44, fontWeight:900, color:textMain, lineHeight:1 }}>
            {Math.floor(remainingSeconds/60)}:{String(remainingSeconds%60).padStart(2,"0")}
          </div>
          <div style={{ fontSize:11, fontWeight:700, color:textMuted, letterSpacing:1, textTransform:"uppercase", marginTop:4 }}>
            {es ? "restante" : "remaining"}
          </div>
        </div>
      </div>

      {nextLabel && (
        <div style={{ fontSize:14, color:textMuted, textAlign:"center" }}>
          {es ? "PrÃ³ximo:" : "Next up:"}{" "}
          <strong style={{ color:textMain }}>{nextLabel}</strong>
        </div>
      )}

      <button
        className="hov"
        onClick={onSkip}
        style={{
          padding:"10px 28px", borderRadius:12,
          background:"transparent", border:`1px solid ${border2}`,
          color:textMain, fontSize:13, fontWeight:700,
          fontFamily:"inherit", cursor:"pointer",
        }}
      >
        {es ? "Saltar descanso â†’" : "Skip rest â†’"}
      </button>
    </div>
  );
}
