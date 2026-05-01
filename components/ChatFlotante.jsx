import React from 'react';
import { Chat } from './Chat.jsx';
import { Ic } from './Ic.jsx';

export function ChatFlotante({alumnoId, alumnoNombre, sb, esEntrenador, darkMode, es}) {
  const _dm = typeof darkMode !== "undefined" ? darkMode : true;
  const bgCard = _dm?"#162234":"#FFFFFF";
  const border = _dm?"#2D4057":"#E2E8F0";
  const textMain = _dm?"#FFFFFF":"#0F1923";
  const textMuted = _dm?"#8B9AB2":"#64748B";

  const [abierto, setAbierto] = React.useState(false);
  const [unread, setUnread] = React.useState(0);

  // ✅ Cuenta mensajes no leídos REALES desde Supabase (de_entrenador=true, leido=false)
  const checkUnread = React.useCallback(()=>{
    if(!alumnoId || abierto) return;
    sb.getMensajes(alumnoId).then(function(m){
      const noLeidos = (m||[]).filter(msg => msg.de_entrenador && !msg.leido).length;
      setUnread(noLeidos);
    });
  }, [alumnoId, abierto]);

  React.useEffect(()=>{
    if(!alumnoId) return;
    checkUnread();
    const interval = setInterval(checkUnread, 15000);
    return ()=>clearInterval(interval);
  },[alumnoId, checkUnread]);

  const toggleChat = function() {
    setAbierto(function(prev) {
      if(!prev) {
        // ✅ Al abrir: marcar como leídos en Supabase Y limpiar badge
        setUnread(0);
        if(sb.marcarMensajesLeidos) {
          sb.marcarMensajesLeidos(alumnoId, esEntrenador);
        }
      }
      return !prev;
    });
  };

  if(!alumnoId) return null;

  const fabBottom = "calc(env(safe-area-inset-bottom, 0px) + 112px)";
  const panelBottom = "calc(env(safe-area-inset-bottom, 0px) + 118px)";
  /** Por encima del bottom nav alumno (z-index 40) y debajo de modales (600+). */

  return (
    <div>
      {abierto&&(
        <div style={{position:"fixed",bottom:panelBottom,right:16,width:290,maxWidth:"calc(100vw - 32px)",background:bgCard,borderRadius:16,border:"1px solid "+border,zIndex:165,padding:16,boxSizing:"border-box",boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <div style={{fontSize:15,fontWeight:800,color:textMain}}><Ic name="message-circle" size={18}/> Chat con Entrenador</div>
            <button onClick={()=>setAbierto(false)} style={{background:"none",border:"none",color:textMuted,fontSize:22,cursor:"pointer"}}><Ic name="x" size={16}/></button>
          </div>
          <Chat darkMode={darkMode} _dm={_dm} alumnoId={alumnoId} alumnoNombre={alumnoNombre} esEntrenador={esEntrenador} sb={sb} es={es}/>
        </div>
      )}
      <button type="button" onClick={toggleChat} style={{position:"fixed",bottom:fabBottom,right:16,background:"#2563EB",color:"#fff",border:"none",borderRadius:"50%",width:40,height:40,fontSize:15,cursor:"pointer",zIndex:155,boxShadow:"0 4px 12px rgba(239,68,68,0.4)",display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent",boxSizing:"border-box"}}>
        💬
        {unread>0&&<span style={{position:"absolute",top:-4,right:-4,background:"#22C55E",color:"#fff",borderRadius:"50%",width:18,height:18,fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{unread}</span>}
      </button>
    </div>
  );
}
