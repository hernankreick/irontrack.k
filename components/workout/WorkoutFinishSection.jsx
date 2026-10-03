import React from 'react';

export default function WorkoutFinishSection({
  es,
  blue,
  onFinish,
  saving,
  errorMessage,
}) {
  return (
    <div style={{ padding:"10px 0 calc(24px + env(safe-area-inset-bottom, 0px))" }}>
      <button
        className="hov"
        onClick={onFinish}
        disabled={!!saving}
        style={{
          width:"100%", padding:"16px",
          background:blue, color:"#fff",
          border:"none", borderRadius:14,
          fontSize:16, fontWeight:900,
          cursor:saving?"default":"pointer", fontFamily:"inherit",
          opacity:saving?0.7:1,
          letterSpacing:.5, textTransform:"uppercase",
          display:"flex", alignItems:"center", justifyContent:"center", gap:8,
          minHeight:56,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        {saving ? (es ? "GUARDANDO..." : "SAVING...") : (es ? "FINALIZAR ENTRENAMIENTO" : "FINISH WORKOUT")}
      </button>
      {errorMessage ? (
        <div role="alert" style={{ marginTop:10, fontSize:13, fontWeight:600, color:"#EF4444", textAlign:"center", lineHeight:1.4 }}>{errorMessage}</div>
      ) : null}
    </div>
  );
}
