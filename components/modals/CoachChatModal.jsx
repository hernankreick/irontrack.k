import React from 'react';
import { Chat } from '../Chat.jsx';
import { Ic } from '../Ic.jsx';

export default function CoachChatModal({
  chatModal,
  darkMode,
  es,
  sb,
  bgCard,
  border,
  textMain,
  textMuted,
  msg,
  onClose,
}) {
  if (!chatModal) return null;

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div style={{background:bgCard,borderRadius:"16px 16px 0 0",padding:"16px",width:"100%",maxWidth:480,border:"1px solid "+border,maxHeight:"80dvh",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:32,height:32,borderRadius:"50%",background:"#2563EB22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#2563EB"}}>
              {(chatModal.alumnoNombre||"?").slice(0,2).toUpperCase()}
            </div>
            <div>
              <div style={{fontSize:15,fontWeight:800,color:textMain}}>{chatModal.alumnoNombre}</div>
              <div style={{fontSize:11,color:textMuted}}>{msg("Chat interno", "Internal chat")}</div>
            </div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:textMuted,fontSize:22,cursor:"pointer",padding:"4px"}}><Ic name="x" size={18}/></button>
        </div>
        <div style={{flex:1,overflow:"hidden"}}>
          <Chat darkMode={darkMode} es={es} alumnoId={chatModal.alumnoId} alumnoNombre={chatModal.alumnoNombre} esEntrenador={true} sb={sb}/>
        </div>
      </div>
    </div>
  );
}
