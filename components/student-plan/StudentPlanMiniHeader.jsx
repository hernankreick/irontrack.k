import React from "react";

export default function StudentPlanMiniHeader({
  msg,
  textMain,
  ALUMNO_HEADER_MINI_PX,
  firstName,
  showTrainButton,
  onTrainToday,
  showCompletedToday,
  headerRef,
  layerTransitionsEnabled,
}) {
  return (
    <div
      ref={headerRef}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: ALUMNO_HEADER_MINI_PX,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingLeft: 16,
        paddingRight: 16,
        paddingBottom: 8,
        zIndex: 1,
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        transition: layerTransitionsEnabled
          ? "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease"
          : "none",
      }}
    >
        <div style={{fontSize:15,fontWeight:700,color:textMain}}>
          {firstName}
        </div>
        {showTrainButton&&(
          <button className="hov"
            style={{background:"#2563EB",color:"#fff",border:"none",
              borderRadius:8,padding:"8px 14px",fontSize:13,
              fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}
            onClick={onTrainToday}>
            ⚡ {msg("Entrenar", "Train")}
          </button>
        )}
        {showCompletedToday&&<span style={{fontSize:13,color:"#22C55E",fontWeight:600}}>✅ {msg("Listo hoy", "Done today")}</span>}
      </div>
  );
}
