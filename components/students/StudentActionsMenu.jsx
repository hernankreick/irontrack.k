import React from 'react';
import { Ic } from '../Ic.jsx';

export default function StudentActionsMenu({
  alumno,
  msg,
  textMain,
  textMuted,
  coachAluDropdown,
  coachAluBorderSoft,
  coachAluDropdownShadow,
  onEdit,
  onChat,
  onClearProgress,
  onDelete,
  disabled,
}) {
  return (
    <div
      style={{position:"absolute",right:0,top:"100%",marginTop:6,background:coachAluDropdown,border:"1px solid "+coachAluBorderSoft,borderRadius:12,padding:6,zIndex:30,minWidth:176,boxShadow:coachAluDropdownShadow}}
      onClick={function (e) { e.stopPropagation(); }}
    >
      <button
        type="button"
        className="hov"
        disabled={disabled}
        style={{width:"100%",textAlign:"left",display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:"transparent",border:"none",borderRadius:8,color:textMain,fontSize:14,fontWeight:600,cursor:disabled?"not-allowed":"pointer",fontFamily:"inherit"}}
        onClick={onEdit}
      >
        <Ic name="edit-2" size={16} color={textMuted}/> {msg("Editar", "Edit")}
      </button>
      <button
        type="button"
        className="hov"
        disabled={disabled}
        style={{width:"100%",textAlign:"left",display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:"transparent",border:"none",borderRadius:8,color:textMain,fontSize:14,fontWeight:600,cursor:disabled?"not-allowed":"pointer",fontFamily:"inherit"}}
        onClick={onChat}
      >
        <Ic name="message-circle" size={16} color="#2563eb"/> {msg("Mensaje", "Message")}
      </button>
      <button
        type="button"
        className="hov"
        disabled={disabled}
        style={{width:"100%",textAlign:"left",display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:"transparent",border:"none",borderRadius:8,color:"#f59e0b",fontSize:14,fontWeight:600,cursor:disabled?"not-allowed":"pointer",fontFamily:"inherit"}}
        onClick={onClearProgress}
      >
        <Ic name="refresh-cw" size={16} color="#f59e0b"/> {msg("Limpiar historial de progreso", "Clear progress history")}
      </button>
      <button
        type="button"
        className="hov"
        disabled={disabled}
        style={{width:"100%",textAlign:"left",display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:"transparent",border:"none",borderRadius:8,color:"#f87171",fontSize:14,fontWeight:600,cursor:disabled?"not-allowed":"pointer",fontFamily:"inherit"}}
        onClick={onDelete}
      >
        <Ic name="trash-2" size={16} color="#f87171"/> {msg("Eliminar", "Delete")}
      </button>
    </div>
  );
}
