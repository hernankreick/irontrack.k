import React from 'react';

export default function CoachEditStudentModal({
  editAlumnoModal,
  editAlumnoEmail,
  setEditAlumnoEmail,
  editAlumnoPass,
  setEditAlumnoPass,
  darkMode,
  bgCard,
  border,
  textMuted,
  inp,
  onClose,
  onSave,
}) {
  const [showPass, setShowPass] = React.useState(false);

  if (!editAlumnoModal) return null;

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:120,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:bgCard,borderRadius:16,padding:20,width:"100%",maxWidth:400,border:"1px solid "+border,animation:"fadeIn 0.25s ease"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>Editar alumno</div>
        <div style={{fontSize:13,color:textMuted,marginBottom:16}}>{editAlumnoModal.nombre}</div>
        <div style={{marginBottom:8}}>
          <span style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:0.3,display:"block",marginBottom:4}}>EMAIL</span>
          <input style={{...inp,width:"100%"}} value={editAlumnoEmail} onChange={e=>setEditAlumnoEmail(e.target.value)} placeholder="nuevo@email.com"/>
        </div>
        <div style={{marginBottom:16}}>
          <span style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:0.3,display:"block",marginBottom:4}}>CONTRASEÑA NUEVA</span>
          <div style={{position:"relative"}}>
            <input style={{...inp,width:"100%",paddingRight:40,boxSizing:"border-box"}} type={showPass?"text":"password"} value={editAlumnoPass} onChange={e=>setEditAlumnoPass(e.target.value)} placeholder="Dejar vacío para no cambiar"/>
            <button type="button" onClick={()=>setShowPass(v=>!v)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:textMuted,padding:4,display:"flex",alignItems:"center"}} aria-label={showPass?"Ocultar contraseña":"Mostrar contraseña"}>
              {showPass
                ? <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                : <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              }
            </button>
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button className="hov" style={{flex:1,padding:"12px",background:darkMode?"#162234":"#E2E8F0",color:textMuted,border:"1px solid "+border,borderRadius:12,fontFamily:"Barlow Condensed,sans-serif",fontSize:15,fontWeight:700,cursor:"pointer"}} onClick={onClose}>Cancelar</button>
          <button className="hov" style={{flex:1,padding:"12px",background:"#2563EB",color:"#fff",border:"none",borderRadius:12,fontFamily:"Barlow Condensed,sans-serif",fontSize:15,fontWeight:700,cursor:"pointer"}} onClick={onSave}>Guardar</button>
        </div>
      </div>
    </div>
  );
}
