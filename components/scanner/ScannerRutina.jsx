import React from 'react';
import { EX } from '../../lib/exerciseStaticData.js';
import { Ic } from '../Ic.jsx';

export default function ScannerRutina({sb, setRoutines, alumnos, toast2, darkMode, customEx, msg, green}) {
  const _dm = typeof darkMode !== "undefined" ? darkMode : true;
  const bg = _dm?"#0F1923":"#F0F4F8";
  const bgCard = _dm?"#162234":"#FFFFFF";
  const bgSub = _dm?"#162234":"#EEF2F7";
  const border = _dm?"#2D4057":"#E2E8F0";
  const textMain = _dm?"#FFFFFF":"#0F1923";
  const textMuted = _dm?"#8B9AB2":"#64748B";

  const [paso, setPaso] = React.useState(1);
  const [procesando, setProcesando] = React.useState(false);
  const [progreso, setProgreso] = React.useState(0);
  const [statusMsg, setStatusMsg] = React.useState("");
  const [resultado, setResultado] = React.useState(null);
  const [nombreRutina, setNombreRutina] = React.useState("");
  const [alumnoSel, setAlumnoSel] = React.useState(null);
  const [filtroRut, setFiltroRut] = React.useState("todas");
  const fileRef = React.useRef();
  const fileGalRef = React.useRef();
  const allEx = React.useMemo(()=>{
    return [...EX,...(Array.isArray(customEx)?customEx:[])];
  },[customEx]);

  const procesarImagen = async (base64) => {
    setPaso(2); setProcesando(true); setProgreso(0);
    const msgs = ["Detectando texto...","Reconociendo ejercicios...",msg("Buscando en biblioteca...", "Searching library..."),"Analizando series y reps...","Finalizando..."];
    let i=0;
    const timer = setInterval(()=>{ if(i<msgs.length){setProgreso((i+1)*18);setStatusMsg(msgs[i]);i++;}else{clearInterval(timer);} },600);

    try {
      const resp = await fetch("/api/scan",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          messages:[{role:"user",content:[
            {type:"image",source:{type:"base64",media_type:"image/jpeg",data:base64.split(",")[1]||base64}},
            {type:"text",text:"Sos un asistente de gimnasio. Analiza esta imagen de una rutina de entrenamiento escrita a mano o impresa. Extrae todos los ejercicios con sus series y repeticiones. Responde SOLO con JSON valido, sin texto extra, sin backticks: {\"nombreRutina\":\"nombre detectado o Rutina Escaneada\",\"ejercicios\":[{\"nombre\":\"nombre exacto del ejercicio\",\"series\":4,\"reps\":\"8\",\"notas\":\"notas si hay\"}]} Si no ves un valor claro de series o reps, usa null. Maximo 20 ejercicios."}
          ]}]}
        )
      });
      clearInterval(timer);
      const data = await resp.json();
      const txt = data.content?.find(c=>c.type==="text")?.text||"{}";
      let parsed;
      try{ parsed=JSON.parse(txt); }catch(e){ parsed={nombreRutina:"Rutina Escaneada",ejercicios:[]}; }
      setProgreso(100); setStatusMsg(msg("Analisis completo", "Analysis complete"));

      // Cruzar con biblioteca
      const exConMatch = (parsed.ejercicios||[]).map(ej=>{
        const nombre = ej.nombre||"";
        const match = allEx.find(e=>
          e.name.toLowerCase().includes(nombre.toLowerCase().slice(0,5)) ||
          nombre.toLowerCase().includes(e.name.toLowerCase().slice(0,5))
        );
        return {...ej, match, busqueda:"", selManual:null};
      });
      setResultado({nombre:parsed.nombreRutina||"Rutina Escaneada", ejercicios:exConMatch});
      setNombreRutina(parsed.nombreRutina||"Rutina Escaneada");
      setTimeout(()=>{ setProcesando(false); setPaso(3); },600);
    } catch(err) {
      clearInterval(timer);
      toast2("Error al procesar la imagen"); setProcesando(false); setPaso(1);
    }
  };

  const handleFile = (e) => {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => procesarImagen(ev.target.result);
    reader.readAsDataURL(file);
  };

  const buscarEnBib = (idx, q) => {
    if(!resultado) return;
    const upd = resultado.ejercicios.map((e,i)=>i===idx?{...e,busqueda:q,selManual:null}:e);
    setResultado({...resultado, ejercicios:upd});
  };

  const seleccionarMatch = (idx, ex) => {
    const upd = resultado.ejercicios.map((e,i)=>i===idx?{...e,selManual:ex,busqueda:""}:e);
    setResultado({...resultado, ejercicios:upd});
  };

  const agregarAutoEx = (idx) => {
    const ej = resultado.ejercicios[idx];
    const newEx = {id:"scan_"+Date.now()+"_"+idx, name:ej.nombre, nameEn:ej.nombre, pattern:"core", muscle:"", equip:"", custom:true, scanned:true};
    const storedCustomEx = JSON.parse(localStorage.getItem("it_customEx")||"[]");
    localStorage.setItem("it_customEx", JSON.stringify([...storedCustomEx, newEx]));
    const upd = resultado.ejercicios.map((e,i)=>i===idx?{...e,selManual:newEx,autoAdded:true}:e);
    setResultado({...resultado, ejercicios:upd});
    toast2("Ejercicio agregado a biblioteca ✓");
  };

  const guardarRutina = async () => {
    if(!nombreRutina.trim()){toast2("Ingresa un nombre");return;}
    const dias = [{
      id:"d1", name:"Dia 1", label:"DIA 1",
      exercises: resultado.ejercicios.map((ej,i)=>{
        const exRef = ej.selManual||ej.match;
        return {
          exId: exRef?.id||"custom_scan_"+i,
          exName: exRef?.name||ej.nombre,
          sets: ej.series||3,
          reps: ej.reps||"10",
          note: ej.notas||""
        };
      })
    }];
    const rutina = {id:"scan_"+Date.now(), name:nombreRutina, days:dias, scanned:true, created:new Date().toLocaleDateString("es-AR")};
    setRoutines(prev=>[...prev, rutina]);
    if(alumnoSel) {
      await sb.saveRutina(alumnoSel, {nombre:nombreRutina, datos:rutina});
      toast2("Rutina creada y asignada a "+alumnos.find(a=>a.id===alumnoSel)?.nombre+" ✓");
    } else {
      toast2("Rutina guardada ✓");
    }
    setPaso(4);
  };

  const inpS = {background:bg,border:"1px solid "+border,borderRadius:8,padding:"8px 12px",color:textMain,fontSize:15,width:"100%",fontFamily:"inherit",outline:"none"};

  return (
    <div>
      {paso===1&&(
        <div>
          <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>{msg("Escanear rutina en papel", "Scan paper routine")}</div>
          <div style={{fontSize:13,color:textMuted,marginBottom:24}}>{msg("La IA detecta ejercicios, series y repeticiones automaticamente.", "AI automatically detects exercises, sets and reps.")}</div>

          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={handleFile}/>
          <input ref={fileGalRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleFile}/>

          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <button onClick={()=>fileRef.current.click()} style={{flex:1,padding:"16px 10px",background:"#2563EB22",border:"2px solid #243040",borderRadius:12,color:"#2563EB",fontFamily:"inherit",fontSize:15,fontWeight:700,cursor:"pointer",textAlign:"center"}}>
              <div style={{fontSize:36,marginBottom:8}}>📸</div>
              <div>{msg("SACAR FOTO", "TAKE PHOTO")}</div>
              <div style={{fontSize:11,color:textMuted,marginTop:4}}>{msg("Abrir camara", "Open camera")}</div>
            </button>
            <button onClick={()=>fileGalRef.current.click()} style={{flex:1,padding:"16px 10px",background:_dm?"#162234":"#E2E8F0",border:"2px solid #2d3748",borderRadius:12,color:textMuted,fontFamily:"inherit",fontSize:15,fontWeight:700,cursor:"pointer",textAlign:"center"}}>
              <div style={{fontSize:36,marginBottom:8}}>🖼️</div>
              <div>{msg("CARGAR ARCHIVO", "UPLOAD FILE")}</div>
              <div style={{fontSize:11,color:textMuted,marginTop:4}}>{msg("Foto de galeria", "From gallery")}</div>
            </button>
          </div>

          <div style={{background:bgSub,border:"1px solid "+border,borderRadius:12,padding:12}}>
            <div style={{fontSize:13,fontWeight:500,color:textMuted,marginBottom:8,letterSpacing:.5}}>{msg("CONSEJOS", "TIPS")}</div>
            <div style={{fontSize:13,color:textMuted,display:"flex",flexDirection:"column",gap:8}}>
              <div>{msg("✅ Buena iluminacion, sin sombras", "✅ Good lighting, no shadows")}</div>
              <div>{msg("✅ Hoja bien centrada y legible", "✅ Sheet centered and legible")}</div>
              <div>{msg("✅ Formatos: \"4x8\", \"3 series de 10\"", "✅ Formats: \"4x8\", \"3 sets of 10\"")}</div>
            </div>
          </div>
        </div>
      )}
      {paso===2&&(
        <div style={{textAlign:"center",padding:"30px 0"}}>
          <div style={{fontSize:48,marginBottom:12}}>{progreso===100?"✅":"🔍"}</div>
          <div style={{fontSize:18,fontWeight:800,marginBottom:8}}>{progreso===100?"Analisis completo":"Procesando rutina..."}</div>
          <div style={{fontSize:13,color:textMuted,marginBottom:24}}>{statusMsg}</div>
          <div style={{height:5,background:_dm?"#162234":"#E2E8F0",borderRadius:2,overflow:"hidden",marginBottom:8}}>
            <div style={{height:"100%",background:"#2563EB",borderRadius:2,width:progreso+"%",transition:"width .5s"}}/>
          </div>
          <div style={{fontSize:13,color:textMuted}}>{progreso}%</div>
        </div>
      )}
      {paso===3&&resultado&&(
        <div>
          <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>{msg("Revisa la rutina detectada", "Review detected routine")}</div>
          <div style={{fontSize:13,color:textMuted,marginBottom:12}}>{msg("Podes editar antes de guardar.", "You can edit values before saving.")}</div>

          <div style={{background:"#22c55e15",border:"1px solid #22c55e33",borderRadius:12,padding:"8px 12px",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:18}}>✅</span>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:"#22C55E"}}>{resultado.ejercicios.length} ejercicios detectados</div>
              <div style={{fontSize:11,color:textMuted}}>{resultado.ejercicios.filter(e=>!e.match&&!e.selManual).length} no encontrados en biblioteca</div>
            </div>
          </div>

          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:0.3,marginBottom:8}}>{msg("NOMBRE", "NAME")}</div>
            <input style={inpS} value={nombreRutina} onChange={e=>setNombreRutina(e.target.value)}/>
          </div>
          {resultado.ejercicios.filter(e=>e.match||e.selManual).length>0&&(
            <div>
              <div style={{fontSize:11,fontWeight:700,color:"#22C55E",letterSpacing:0.3,marginBottom:8}}>{msg("✅ ENCONTRADOS", "✅ FOUND")} ({resultado.ejercicios.filter(e=>e.match||e.selManual).length})</div>
              {resultado.ejercicios.map((ej,i)=>{
                if(!ej.match&&!ej.selManual) return null;
                const ref = ej.selManual||ej.match;
                return (
                  <div key={(ref.id||"ex")+"-scan-ok-"+i+"-"+(ej.nombre||"")} style={{background:bg,border:"1px solid "+border,borderRadius:12,padding:"8px 12px",marginBottom:8,display:"flex",alignItems:"center",gap:8}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:800}}>{ref.name}</div>
                      <div style={{fontSize:11,color:textMuted}}>{ej.nombre!==ref.name?`Detectado: "${ej.nombre}"`:""}</div>
                    </div>
                    <input style={{background:bgSub,border:"1px solid "+border,borderRadius:6,padding:"4px 7px",color:textMain,fontSize:13,width:38,textAlign:"center",fontFamily:"inherit"}} defaultValue={ej.series||3}/>
                    <span style={{color:textMuted}}>x</span>
                    <input style={{background:bgSub,border:"1px solid "+border,borderRadius:6,padding:"4px 7px",color:textMain,fontSize:13,width:42,textAlign:"center",fontFamily:"inherit"}} defaultValue={ej.reps||"10"}/>
                  </div>
                );
              })}
            </div>
          )}
          {resultado.ejercicios.filter(e=>!e.match&&!e.selManual).length>0&&(
            <div>
              <div style={{fontSize:11,fontWeight:700,color:"#8B9AB2",letterSpacing:0.3,margin:"16px 0 7px"}}>{msg("⚠️ NO ENCONTRADOS", "⚠️ NOT FOUND")} ({resultado.ejercicios.filter(e=>!e.match&&!e.selManual).length})</div>
              {resultado.ejercicios.map((ej,i)=>{
                if(ej.match||ej.selManual) return null;
                const resBib = ej.busqueda?.length>=2 ? allEx.filter(e=>e.name.toLowerCase().includes(ej.busqueda.toLowerCase())).slice(0,4) : [];
                return (
                  <div key={"scan-miss-"+(ej.nombre||"ej")+"-"+i} style={{background:bgCard,border:"1px solid #243040",borderRadius:12,padding:12,marginBottom:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                      <div>
                        <div style={{fontSize:15,fontWeight:800,color:"#8B9AB2"}}>(msg("Detectado", "Detected"))+": \""+ej.nombre+"\""</div>
                        <div style={{fontSize:11,color:textMuted,marginTop:4}}>{ej.series||"?"} series · {ej.reps||"?"} reps</div>
                      </div>
                      <span style={{background:"#2563EB22",color:"#8B9AB2",border:"1px solid #243040",borderRadius:6,padding:"2px 7px",fontSize:11,fontWeight:700,flexShrink:0,marginLeft:8}}>SIN MATCH</span>
                    </div>
                    <div style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:.8,marginBottom:8}}>BUSCAR EN BIBLIOTECA</div>
                    <input style={inpS} placeholder={msg("Escribi el nombre correcto...", "Type the correct name...")} value={ej.busqueda||""} onChange={e=>buscarEnBib(i,e.target.value)}/>
                    {resBib.length>0&&(
                      <div style={{background:bg,border:"1px solid "+border,borderRadius:12,overflow:"hidden",marginTop:8}}>
                        {resBib.map(ex=>(
                          <div key={ex.id} onClick={()=>seleccionarMatch(i,ex)} style={{padding:"8px 12px",borderBottom:"1px solid "+(darkMode?"#2D4057":"#2D4057"),cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
                            <div style={{flex:1}}>
                              <div style={{fontSize:13,fontWeight:800}}>{ex.name}</div>
                              <div style={{fontSize:11,color:textMuted}}>{ex.pattern} · {ex.muscle}</div>
                            </div>
                            <span style={{color:"#22C55E",fontSize:15}}>✓</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {ej.busqueda?.length>=2&&resBib.length===0&&(
                      <div style={{fontSize:13,color:textMuted,textAlign:"center",padding:"8px 0"}}>{msg("Sin resultados — agregalo abajo", "No results — add it below")}</div>
                    )}
                    <div style={{fontSize:11,color:textMuted,textAlign:"center",margin:"8px 0 7px"}}>— o si no esta en biblioteca —</div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>agregarAutoEx(i)} style={{flex:1,padding:"8px",background:green,color:darkMode?"#fff":"#fff",border:"none",borderRadius:8,fontFamily:"inherit",fontSize:13,fontWeight:700,cursor:"pointer"}}>⚡ AUTO</button>
                      <button style={{flex:1,padding:"8px",background:_dm?"#162234":"#E2E8F0",color:textMuted,border:"1px solid "+border,borderRadius:8,fontFamily:"inherit",fontSize:13,fontWeight:700,cursor:"pointer"}} onClick={()=>toast2("Ir a Biblioteca > + Nuevo para agregarlo manualmente")}>✏️ MANUAL</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {}
          <div style={{marginTop:16,marginBottom:8}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>{msg("Asignar a alumno", "Assign to athlete")} <span style={{color:textMuted,fontWeight:400}}>(opcional)</span></div>
            {alumnos.map(a=>(
              <div key={a.id} onClick={()=>setAlumnoSel(alumnoSel===a.id?null:a.id)} style={{background:bg,border:"2px solid "+(alumnoSel===a.id?"#2563EB":"#2D4057"),borderRadius:12,padding:"8px 12px",marginBottom:8,display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                <div style={{width:32,height:32,background:"#2563EB22",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#2563EB",flexShrink:0}}>{a.nombre?.[0]}</div>
                <div style={{flex:1,fontSize:15,fontWeight:700}}>{a.nombre}</div>
                <div style={{width:18,height:18,borderRadius:"50%",border:"2px solid "+(alumnoSel===a.id?"#2563EB":"#2D4057"),background:alumnoSel===a.id?"#2563EB":"transparent"}}/>
              </div>
            ))}
          </div>

          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button onClick={()=>setPaso(1)} style={{flex:1,padding:"8px",background:_dm?"#162234":"#E2E8F0",color:textMuted,border:"1px solid "+border,borderRadius:12,fontFamily:"inherit",fontSize:15,fontWeight:700,cursor:"pointer"}}>← Volver</button>
            <button onClick={guardarRutina} style={{flex:2,padding:"12px",background:"#2563EB",color:"#fff",border:"none",borderRadius:12,fontFamily:"inherit",fontSize:15,fontWeight:700,cursor:"pointer"}}>GUARDAR RUTINA →</button>
          </div>
        </div>
      )}
      {paso===4&&(
        <div style={{textAlign:"center",paddingTop:30}}>
          <div style={{fontSize:48,marginBottom:8}}><Ic name="check-circle" size={40} color="#22C55E"/></div>
          <div style={{fontSize:22,fontWeight:900,color:"#22C55E",marginBottom:4}}>Rutina creada!</div>
          <div style={{fontSize:15,color:textMuted,marginBottom:24}}>{nombreRutina}</div>
          <div style={{background:"#22c55e15",border:"1px solid #22c55e33",borderRadius:12,padding:16,marginBottom:24,display:"flex",justifyContent:"space-around"}}>
            <div><div style={{fontSize:22,fontWeight:900,color:"#22C55E"}}>{resultado?.ejercicios?.length||0}</div><div style={{fontSize:11,color:textMuted}}>ejercicios</div></div>
            <div><div style={{fontSize:22,fontWeight:900,color:"#2563EB"}}>📷</div><div style={{fontSize:11,color:textMuted}}>Escaneada</div></div>
            {alumnoSel&&<div><div style={{fontSize:22,fontWeight:900,color:"#2563EB"}}>✓</div><div style={{fontSize:11,color:textMuted}}>Asignada</div></div>}
          </div>
          <button onClick={()=>{setPaso(1);setResultado(null);setAlumnoSel(null);}} style={{width:"100%",padding:12,background:_dm?"#162234":"#E2E8F0",color:textMuted,border:"1px solid "+border,borderRadius:12,fontFamily:"inherit",fontSize:15,fontWeight:700,cursor:"pointer"}}>
            Escanear otra rutina
          </button>
        </div>
      )}
    </div>
  );
}
