import React, { useEffect } from 'react';
import LoginForm from './auth/LoginForm.jsx';
import IronTrackLogo from './IronTrackLogo.jsx';

export default function LoginModalHost({
  open,
  user,
  bgCard,
  textMuted,
  darkMode,
  es,
  btn,
  inp,
  lbl,
  msg,
  onClose,
  onLogout,
  onLogin,
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.9)",zIndex:130,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 20px"}} onClick={onClose}>
      <style>{`
        .it-login-modal .login-shake { animation: itLoginShake .32s ease; }
        @keyframes itLoginShake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 50%{transform:translateX(5px)} 75%{transform:translateX(-3px)} }
        .it-login-modal input:focus-visible { outline: 2px solid rgba(37,99,235,.7); outline-offset: 1px; }
        .it-login-modal button:focus-visible { outline: 2px solid rgba(37,99,235,.7); outline-offset: 2px; }
      `}</style>
      <div
        className="it-login-modal"
        role="dialog"
        aria-modal="true"
        aria-label={user?(msg("Tu cuenta","Your account")):(msg("Iniciar sesión","Log in"))}
        style={{background:bgCard,borderRadius:16,padding:"24px 20px",width:"100%",maxWidth:360,animation:"fadeIn 0.25s ease",position:"relative"}}
        onClick={e=>e.stopPropagation()}
      >
        <button
          type="button"
          className="hov"
          onClick={onClose}
          aria-label={msg("Cerrar","Close")}
          style={{position:"absolute",top:10,right:10,width:28,height:28,borderRadius:8,border:"none",background:"transparent",color:textMuted,fontSize:18,lineHeight:1,cursor:"pointer"}}
        >×</button>
        {user?(
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:48,marginBottom:8}}>👤</div>
            <div style={{fontSize:22,fontWeight:700,marginBottom:4}}>{user.name}</div>
            <div style={{fontSize:15,color:textMuted,marginBottom:16}}>{user.email}</div>
            <button className="hov" style={{...btn("#2563EB22"),color:"#2563EB",width:"100%",padding:"8px"}} onClick={onLogout}>{msg("SALIR","LOG OUT")}</button>
          </div>
        ):(
          <>
            <div style={{display:"flex",justifyContent:"center",marginBottom:16,marginTop:4}}>
              <IronTrackLogo size={20} color={darkMode?"#FFFFFF":"#0F1923"} />
            </div>
            <LoginForm darkMode={darkMode} es={es} btn={btn} inp={inp} lbl={lbl} msg={msg} onLogin={onLogin} onClose={onClose}/>
          </>
        )}
      </div>
    </div>
  );
}
