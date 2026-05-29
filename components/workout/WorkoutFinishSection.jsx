import React from 'react';

export default function WorkoutFinishSection({
  es,
  blue,
  onFinish,
}) {
  return (
    <div style={{ padding:"10px 0 calc(24px + env(safe-area-inset-bottom, 0px))" }}>
      <button
        className="hov"
        onClick={onFinish}
        style={{
          width:"100%", padding:"16px",
          background:blue, color:"#fff",
          border:"none", borderRadius:14,
          fontSize:16, fontWeight:900,
          cursor:"pointer", fontFamily:"inherit",
          letterSpacing:.5, textTransform:"uppercase",
          display:"flex", alignItems:"center", justifyContent:"center", gap:8,
          minHeight:56,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        {es ? "FINALIZAR ENTRENAMIENTO" : "FINISH WORKOUT"}
      </button>
    </div>
  );
}
