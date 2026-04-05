import React, { useState, useEffect, useRef } from 'react';

export function Chat({alumnoId, alumnoNombre, esEntrenador, sb, darkMode, es}) {
  const _dm = typeof darkMode !== "undefined" ? darkMode : true;
  const bg = _dm?"#0F1923":"#F0F4F8";
  const bgCard = _dm?"#162234":"#FFFFFF";
  const bgSub = _dm?"#162234":"#EEF2F7";
  const border = _dm?"#2D4057":"#E2E8F0";
  const textMain = _dm?"#FFFFFF":"#0F1923";
  const textMuted = _dm?"#8B9AB2":"#64748B";

  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const endRef = useRef();

  const cargarYMarcar = async () => {
    const m = await sb.getMensajes(alumnoId);
    if (m) setMensajes(m);

    if (sb.marcarMensajesLeidos) {
      await sb.marcarMensajesLeidos(alumnoId, esEntrenador);

      // volver a traer mensajes ya actualizados
      const m2 = await sb.getMensajes(alumnoId);
      if (m2) setMensajes(m2);
    }
  };

  useEffect(()=>{
    cargarYMarcar().finally(()=> setLoading(false));
    const interval = setInterval(cargarYMarcar, 10000);
    return ()=>clearInterval(interval);
  },[]);

  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:"smooth"}); },[mensajes]);

  console.log("SB:", sb);
console.log("marcarMensajesLeidos:", sb.marcarMensajesLeidos);

  const enviar = async () => {
    if(!texto.trim() || enviando) return;
    setEnviando(true);
    const msg = {alumno_id:alumnoId, texto:texto.trim(), de_entrenador:esEntrenador, nombre:esEntrenador?"Entrenador":alumnoNombre};
    const res = await sb.addMensaje(msg);
    if(res&&res[0]) setMensajes(prev=>[...prev,res[0]]);
    setTexto("");
    setEnviando(false);
  };

  if(loading) return (
    <div style={{display:"flex",flexDirection:"column",gap:8,padding:"8px 0"}}>
      {[1,2,3].map(i=>(
        <div key={i} style={{display:"flex",gap:8,justifyContent:i%2===0?"flex-end":"flex-start"}}>
          <div className="sk" style={{height:36,width:"65%",borderRadius:12}}/>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",height:400}}>
      <div style={{flex:1,overflowY:"auto",padding:"8px 0",marginBottom:8}}>
        {mensajes.length===0&&<div style={{textAlign:"center",padding:"30px 0",color:textMuted,fontSize:13}}>Sin mensajes aún. ¡Escribí el primero!</div>}
        {mensajes.map((m,i)=>{
          const esMio = esEntrenador ? m.de_entrenador : !m.de_entrenador;
          return (
            <div key={i} style={{display:"flex",justifyContent:esMio?"flex-end":"flex-start",marginBottom:8}}>
              <div style={{maxWidth:"78%",
                background:m.de_entrenador?"#2563EB":"#16A34A",
                borderRadius:esMio?"14px 14px 2px 14px":"14px 14px 14px 2px",
                padding:"8px 16px"}}>
                <div style={{fontSize:11,fontWeight:800,color:"rgba(255,255,255,0.7)",marginBottom:4,letterSpacing:0.5}}>
                  {m.de_entrenador?"🏋️ Entrenador":"👤 "+m.nombre}
                </div>
                <div style={{fontSize:15,color:textMain,lineHeight:1.4}}>{m.texto}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginTop:4,textAlign:"right"}}>
                  {m.created_at ? new Date(m.created_at).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"}) : ""}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef}/>
      </div>
      <div style={{display:"flex",gap:8}}>
        <input style={{flex:1,background:bgSub,color:textMain,border:"1px solid "+border,borderRadius:12,padding:"12px 14px",fontFamily:"Inter,sans-serif",fontSize:15}} value={texto} onChange={e=>setTexto(e.target.value)} placeholder="Escribí un mensaje..." onKeyDown={e=>e.key==="Enter"&&enviar()}/>
        <button style={{background:"#2563EB",color:"#fff",border:"none",borderRadius:12,padding:"8px 16px",fontFamily:"Barlow Condensed,sans-serif",fontSize:15,fontWeight:700,cursor:"pointer"}} onClick={enviar}>
          {enviando?"...":"▶"}
        </button>
      </div>
    </div>
  );
}
