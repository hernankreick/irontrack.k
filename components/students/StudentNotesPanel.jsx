import React from 'react';
import { Ic } from '../Ic.jsx';

export default function StudentNotesPanel({
  alumno,
  nota,
  msg,
  textMain,
  textMuted,
  bgSub,
  border,
  onChange,
  onSave,
  saving,
}) {
  return (
    <div style={{marginTop:12,borderTop:"1px solid "+border,paddingTop:12}}>
      <div style={{fontSize:11,fontWeight:600,color:textMuted,letterSpacing:1,
        textTransform:"uppercase",marginBottom:8}}>
        <Ic name="bookmark" size={14} color={textMuted}/> {msg("Nota del día", "Daily note")}
      </div>
      <textarea
        style={{width:"100%",background:bgSub,color:textMain,border:"1px solid "+border,
          borderRadius:12,padding:"8px 12px",fontSize:15,fontFamily:"Inter,sans-serif",
          resize:"none",lineHeight:1.5,outline:"none",minHeight:80}}
        placeholder={msg("Escribí una nota, recordatorio o indicación para el alumno...", "Write a note, reminder or instruction for this athlete...")}
        value={nota}
        onChange={onChange}
      />
      <button className="hov" style={{width:"100%",marginTop:8,padding:"8px",
        background:"#2563EB",color:"#fff",border:"none",borderRadius:12,
        fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}
        onClick={onSave}
        disabled={saving}>
        {msg("Enviar nota", "Send note")}
      </button>
    </div>
  );
}
