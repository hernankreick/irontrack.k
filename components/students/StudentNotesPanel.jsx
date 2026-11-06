import React from 'react';
import { Ic } from '../Ic.jsx';

// «Nota del día». saving: envío pendiente (botón deshabilitado con «Enviando…» y texto de solo lectura, para que lo enviado sea lo que
// se ve). error: mensaje del último envío fallido de ESTE alumno (el borrador se conserva para reintentar).
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
  error,
  darkMode,
}) {
  return (
    <div style={{marginTop:12,borderTop:"1px solid "+border,paddingTop:12}}>
      <div style={{fontSize:11,fontWeight:600,color:textMuted,letterSpacing:1,
        textTransform:"uppercase",marginBottom:8}}>
        <Ic name="bookmark" size={14} color={textMuted}/> {msg("Nota del día", "Daily note")}
      </div>
      <textarea
        data-qa="nota-dia-texto"
        aria-label={msg("Nota del día", "Daily note")}
        style={{width:"100%",background:bgSub,color:textMain,border:"1px solid "+border,
          borderRadius:12,padding:"8px 12px",fontSize:15,fontFamily:"Inter,sans-serif",
          resize:"none",lineHeight:1.5,outline:"none",minHeight:80,opacity:saving?0.7:1}}
        placeholder={msg("Escribí una nota, recordatorio o indicación para el alumno...", "Write a note, reminder or instruction for this athlete...")}
        value={nota}
        readOnly={!!saving}
        onChange={onChange}
      />
      {error ? (
        <div role="alert" data-qa="nota-dia-error" style={{marginTop:8,fontSize:13,fontWeight:700,color:darkMode?"#f87171":"#b91c1c",lineHeight:1.4}}>{error}</div>
      ) : null}
      <button type="button" className="hov" data-qa="nota-dia-enviar" style={{width:"100%",marginTop:8,padding:"8px",minHeight:44,
        background:"#2563EB",color:"#fff",border:"none",borderRadius:12,
        fontSize:15,fontWeight:700,cursor:saving?"default":"pointer",fontFamily:"inherit",opacity:saving?0.7:1}}
        onClick={onSave}
        disabled={!!saving}
        aria-busy={saving ? "true" : undefined}>
        {saving ? msg("Enviando…", "Sending…") : msg("Enviar nota", "Send note")}
      </button>
    </div>
  );
}
