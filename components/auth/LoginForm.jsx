import React, { useState } from 'react';

function LoginForm({es, btn, inp, lbl, onLogin, onClose, darkMode, msg}) {
  const _dm = typeof darkMode !== "undefined" ? darkMode : true;
  const bg = _dm?"#0F1923":"#F0F4F8";
  const bgCard = _dm?"#162234":"#FFFFFF";
  const bgSub = _dm?"#162234":"#EEF2F7";
  const border = _dm?"#2D4057":"#E2E8F0";
  const textMain = _dm?"#FFFFFF":"#0F1923";
  const textMuted = _dm?"#8B9AB2":"#64748B";

  const [mode,setMode]=useState("login");
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [errors,setErrors]=useState({email:false,pass:false,name:false});
  const emailOk = /^[^@]+@[^@]+\.[^@]+$/.test(email);
  const passOk = pass.length >= 6;
  return(
    <div>
      <div style={{fontSize:28,fontWeight:800,letterSpacing:2,marginBottom:12,textAlign:"center"}}>{mode==="login"?(msg("INICIAR SESION", "LOG IN")):(msg("REGISTRO", "REGISTER"))}</div>
      {mode==="register"&&<div style={{marginBottom:8}}><span style={lbl}>{es?msg("NOMBRE", "NAME"):"NAME"}</span><input style={inp} value={name} onChange={e=>setName(e.target.value)} placeholder="Tu nombre"/></div>}
      <div style={{marginBottom:8}}><span style={lbl}>EMAIL</span><input style={inp} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@ejemplo.com"/></div>
      <div style={{marginBottom:12}}><span style={lbl}>{msg("CONTRASENA", "PASSWORD")}</span><input style={inp} type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="*****"/></div>
      <button className="hov" style={{...btn("#2563EB"),width:"100%",padding:"8px",fontSize:18,marginBottom:8}} onClick={()=>{
          const eErr=!emailOk;
          const pErr=!passOk;
          const nErr=mode==="register"&&!name.trim();
          if(eErr||pErr||nErr){setErrors({email:eErr,pass:pErr,name:nErr});return;}
          onLogin({name:mode==="register"?name:email.split("@")[0],email,id:email});
        }}>ENTRAR</button>
      <div style={{textAlign:"center",fontSize:15,color:textMuted,cursor:"pointer",marginBottom:8}} onClick={()=>setMode(m=>m==="login"?"register":"login")}>
        {mode==="login"?(msg("No tenes cuenta? Registrate", "No account? Register")):(msg("Ya tenes cuenta? IniciÃ¡ sesion", "Already have an account? Log in"))}
      </div>
      <button className="hov" style={{...btn(),width:"100%",padding:"8px",fontSize:15}} onClick={onClose}>CANCELAR</button>
    </div>
  );
}

export default LoginForm;
