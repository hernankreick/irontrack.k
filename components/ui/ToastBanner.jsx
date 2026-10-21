import React from 'react';

function ToastBanner({ toast, darkMode, border, textMain }) {
  // El contenedor live siempre está montado: los lectores de pantalla solo anuncian cambios dentro de una región ya existente.
  const bubble = toast&&(()=>{
    const isSuccess = toast.includes("✓")||toast.includes("💪")||toast.includes("✅")||toast.includes("listo")||toast.includes("done")||toast.includes("enviada")||toast.includes("copiado")||toast.includes("creado")||toast.includes("sent")||toast.includes("saved");
    const isError = toast.includes("Error")||toast.includes("error");
    const bg = isError?"#EF444422":isSuccess?"#22C55E22":darkMode?"#1E2D40":"#F0F4F8";
    const brd = isError?"#EF444444":isSuccess?"#22C55E44":border;
    const col = isError?(darkMode?"#FCA5A5":"#B91C1C"):isSuccess?(darkMode?"#22C55E":"#166534"):textMain;
    return(
      <div style={{
        background:bg,border:"1px solid "+brd,color:col,
        padding:"8px 20px",borderRadius:24,fontSize:15,fontWeight:600,
        maxWidth:"100%",boxSizing:"border-box",
        textAlign:"center",overflowWrap:"anywhere",
        boxShadow:"0 8px 24px rgba(0,0,0,0.3)",
        animation:"slideUpFade 0.25s ease"
      }}>{toast}</div>
    );
  })();
  // Contenedor flex a todo el ancho que centra el aviso SIN transform: la animacion slideUpFade define transform
  // (translateY) y pisaria un translateX(-50%) durante la entrada. pointerEvents none: el aviso no bloquea toques.
  return(
    <div role="status" aria-live="polite" aria-atomic="true" style={{
      // La barra inferior mide ~73px + safe-area: sin sumarla, en iPhone con barra de inicio el aviso quedaba encima de la barra.
      position:"fixed",bottom:"calc(88px + env(safe-area-inset-bottom, 0px))",left:0,right:0,
      display:"flex",justifyContent:"center",
      padding:"0 16px",boxSizing:"border-box",
      zIndex:250,pointerEvents:"none"
    }}>{bubble}</div>
  );
}

export default ToastBanner;
