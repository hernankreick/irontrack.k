import React from 'react';
import LoginForm from './auth/LoginForm.jsx';

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
  if (!open) return null;

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.9)",zIndex:130,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 20px"}} onClick={onClose}>
      <div style={{background:bgCard,borderRadius:16,padding:"24px 20px",width:"100%",maxWidth:360,animation:"fadeIn 0.25s ease"}} onClick={e=>e.stopPropagation()}>
        {user?(
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:48,marginBottom:8}}>👤</div>
            <div style={{fontSize:22,fontWeight:700,marginBottom:4}}>{user.name}</div>
            <div style={{fontSize:15,color:textMuted,marginBottom:16}}>{user.email}</div>
            <button className="hov" style={{...btn("#2563EB22"),color:"#2563EB",width:"100%",padding:"8px"}} onClick={onLogout}>SALIR</button>
          </div>
        ):(
          <LoginForm darkMode={darkMode} es={es} btn={btn} inp={inp} lbl={lbl} msg={msg} onLogin={onLogin} onClose={onClose}/>
        )}
      </div>
    </div>
  );
}
