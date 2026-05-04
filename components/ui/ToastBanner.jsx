import React from 'react';

function ToastBanner({ toast, darkMode, border, textMain }) {
  return toast&&(()=>{
    const isSuccess = toast.includes("✓")||toast.includes("💪")||toast.includes("✅")||toast.includes("listo")||toast.includes("done")||toast.includes("enviada")||toast.includes("copiado")||toast.includes("creado")||toast.includes("sent")||toast.includes("saved");
    const isError = toast.includes("Error")||toast.includes("error");
    const bg = isError?"#EF444422":isSuccess?"#22C55E22":darkMode?"#1E2D40":"#F0F4F8";
    const brd = isError?"#EF444444":isSuccess?"#22C55E44":border;
    const col = isError?"#EF4444":isSuccess?"#22C55E":textMain;
    return(
      <div style={{
        position:"fixed",bottom:88,left:"50%",transform:"translateX(-50%)",
        background:bg,border:"1px solid "+brd,color:col,
        padding:"8px 20px",borderRadius:24,fontSize:15,fontWeight:600,
        zIndex:250,whiteSpace:"nowrap",
        boxShadow:"0 8px 24px rgba(0,0,0,0.3)",
        animation:"slideUpFade 0.25s ease"
      }}>{toast}</div>
    );
  })();
}

export default ToastBanner;
