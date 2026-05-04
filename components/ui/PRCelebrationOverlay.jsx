import React from 'react';

function PRCelebrationOverlay({ prCelebration, setPrCelebration, msg }) {
  return prCelebration&&(
        <div onClick={()=>setPrCelebration(null)} style={{
          position:"fixed",inset:0,zIndex:500,
          display:"flex",alignItems:"center",justifyContent:"center",
          background:"rgba(0,0,0,0.92)",
          animation:"fadeIn .2s ease",cursor:"pointer"
        }}>
          <div style={{
            textAlign:"center",padding:"48px 32px",
            background:"linear-gradient(135deg,#1a1a1a,#2a1f00)",
            borderRadius:28,border:"2px solid #f59e0b55",
            maxWidth:340,width:"90%",
            boxShadow:"0 0 80px #f59e0b44",
            animation:"fadeIn .3s ease"
          }}>
            <div style={{fontSize:64,marginBottom:12,filter:"drop-shadow(0 0 24px #f59e0b)",animation:"pulse 1s infinite"}}>🏆</div>
            <div style={{fontSize:15,fontWeight:900,color:"#fbbf24",letterSpacing:4,marginBottom:12,textTransform:"uppercase"}}>
              {msg("¡NUEVO PR!", "NEW PR!")}
            </div>
            <div style={{fontSize:24,fontWeight:900,color:"#FFFFFF",marginBottom:8,lineHeight:1.2}}>
              {prCelebration.ejercicio}
            </div>
            <div style={{fontSize:56,fontWeight:900,color:"#fbbf24",letterSpacing:1,lineHeight:1}}>
              {prCelebration.kg} kg
            </div>
            {prCelebration.diff>0&&(
              <div style={{marginTop:12,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <span style={{background:"#22C55E22",border:"1px solid #22C55E44",borderRadius:8,padding:"4px 12px",fontSize:15,fontWeight:800,color:"#22C55E"}}>
                  +{prCelebration.diff}kg
                </span>
                <span style={{fontSize:13,color:"#8B9AB2"}}>
                  vs {prCelebration.prevKg}kg
                </span>
              </div>
            )}
            <div style={{fontSize:12,color:"#8B9AB244",marginTop:16}}>
              {msg("Tocá para cerrar", "Tap to close")}
            </div>
          </div>
        </div>
  );
}

export default PRCelebrationOverlay;
