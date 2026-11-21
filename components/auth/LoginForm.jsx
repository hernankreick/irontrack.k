import React, { useState, useRef, useEffect } from 'react';

function LoginForm({btn, inp, lbl, onLogin, onClose, darkMode, msg}) {
  const _dm = typeof darkMode !== "undefined" ? darkMode : true;
  const textMuted = _dm?"#8B9AB2":"#64748B";
  const errorColor = "#EF4444";

  const [mode,setMode]=useState("login");
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [showPass,setShowPass]=useState(false);
  const [errors,setErrors]=useState({email:false,pass:false,name:false});
  const [shake,setShake]=useState(false);

  const emailOk = /^[^@]+@[^@]+\.[^@]+$/.test(email);
  const passOk = pass.length >= 6;

  const firstFieldRef = useRef(null);
  useEffect(()=>{ firstFieldRef.current?.focus(); },[mode]);

  const nameId="login-name", emailId="login-email", passId="login-pass";
  const nameErrId="login-name-err", emailErrId="login-email-err", passErrId="login-pass-err";

  const errTextStyle = {fontSize:12,color:errorColor,marginTop:4};
  const eyeBtnStyle = {position:"absolute",right:4,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:16,padding:6,lineHeight:1,color:textMuted};

  function fieldStyle(hasError){
    return hasError?{...inp,borderColor:errorColor,boxShadow:"0 0 0 1px "+errorColor}:inp;
  }

  function handleSubmit(e){
    e.preventDefault();
    const eErr=!emailOk;
    const pErr=!passOk;
    const nErr=mode==="register"&&!name.trim();
    if(eErr||pErr||nErr){
      setErrors({email:eErr,pass:pErr,name:nErr});
      setShake(true);
      setTimeout(()=>setShake(false),320);
      return;
    }
    setErrors({email:false,pass:false,name:false});
    onLogin({name:mode==="register"?name:email.split("@")[0],email,id:email});
  }

  return(
    <form onSubmit={handleSubmit} noValidate className={shake?"login-shake":undefined}>
      <div style={{fontSize:28,fontWeight:800,letterSpacing:2,marginBottom:12,textAlign:"center"}}>{mode==="login"?msg("INICIAR SESION", "LOG IN"):msg("REGISTRO", "REGISTER")}</div>

      {mode==="register"&&(
        <div style={{marginBottom:8}}>
          <label htmlFor={nameId} style={lbl}>{msg("NOMBRE", "NAME")}</label>
          <input
            id={nameId}
            ref={firstFieldRef}
            style={fieldStyle(errors.name)}
            value={name}
            onChange={e=>setName(e.target.value)}
            placeholder={msg("Tu nombre","Your name")}
            autoComplete="name"
            aria-invalid={errors.name||undefined}
            aria-describedby={errors.name?nameErrId:undefined}
          />
          {errors.name&&<div id={nameErrId} role="alert" style={errTextStyle}>{msg("Ingresá tu nombre","Enter your name")}</div>}
        </div>
      )}

      <div style={{marginBottom:8}}>
        <label htmlFor={emailId} style={lbl}>EMAIL</label>
        <input
          id={emailId}
          ref={mode==="login"?firstFieldRef:undefined}
          type="email"
          style={fieldStyle(errors.email)}
          value={email}
          onChange={e=>setEmail(e.target.value)}
          placeholder="email@ejemplo.com"
          autoComplete="email"
          aria-invalid={errors.email||undefined}
          aria-describedby={errors.email?emailErrId:undefined}
        />
        {errors.email&&<div id={emailErrId} role="alert" style={errTextStyle}>{msg("Ingresá un email válido","Enter a valid email")}</div>}
      </div>

      <div style={{marginBottom:12}}>
        <label htmlFor={passId} style={lbl}>{msg("CONTRASENA", "PASSWORD")}</label>
        <div style={{position:"relative"}}>
          <input
            id={passId}
            type={showPass?"text":"password"}
            style={{...fieldStyle(errors.pass),paddingRight:36}}
            value={pass}
            onChange={e=>setPass(e.target.value)}
            placeholder="******"
            autoComplete={mode==="login"?"current-password":"new-password"}
            aria-invalid={errors.pass||undefined}
            aria-describedby={errors.pass?passErrId:undefined}
          />
          <button
            type="button"
            onClick={()=>setShowPass(s=>!s)}
            aria-label={showPass?msg("Ocultar contraseña","Hide password"):msg("Mostrar contraseña","Show password")}
            style={eyeBtnStyle}
          >{showPass?"🙈":"👁"}</button>
        </div>
        {errors.pass&&<div id={passErrId} role="alert" style={errTextStyle}>{msg("Mínimo 6 caracteres","At least 6 characters")}</div>}
      </div>

      <button type="submit" className="hov" style={{...btn("#2563EB"),width:"100%",padding:"8px",fontSize:18,marginBottom:8}}>{msg("ENTRAR","LOG IN")}</button>

      <button
        type="button"
        onClick={()=>setMode(m=>m==="login"?"register":"login")}
        style={{display:"block",width:"100%",textAlign:"center",fontSize:15,color:textMuted,cursor:"pointer",marginBottom:8,background:"none",border:"none",padding:4,fontFamily:"inherit"}}
      >
        {mode==="login"?msg("No tenes cuenta? Registrate", "No account? Register"):msg("Ya tenes cuenta? Iniciá sesion", "Already have an account? Log in")}
      </button>

      <button type="button" className="hov" style={{...btn(),width:"100%",padding:"8px",fontSize:15}} onClick={onClose}>{msg("CANCELAR","CANCEL")}</button>
    </form>
  );
}

export default LoginForm;
