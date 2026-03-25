const fs=require("fs");
let c=fs.readFileSync("App.jsx","utf8");
let fixes=0;

// FIX 1: Agregar states faltantes despues de useAlumnos
const m1="} = useAlumnos({ sb });";
if(c.includes(m1) && !c.includes("rutinasSB, setRutinasSB")){
  c=c.replace(m1, m1+"\n  const [rutinasSB, setRutinasSB] = useState([]);\n  const [registrosSubTab, setRegistrosSubTab] = useState(0);\n  const [sesionesGlobales, setSesionesGlobales] = useState([]);\n  const [progresoGlobal, setProgresoGlobal] = useState({});\n  const [sugerencias, setSugerencias] = useState({});");
  console.log("OK FIX 1: states agregados");fixes++;
}else if(c.includes("rutinasSB")){console.log("SKIP FIX 1: ya tiene states")}
else{console.log("ERR FIX 1: no encontre useAlumnos")}

// FIX 2: Agregar cargarSesionesGlobales + useEffect entrenador
const m2="const es = lang===\"es\";";
if(c.includes(m2) && !c.includes("cargarSesionesGlobales")){
  const fn="\n  const cargarSesionesGlobales = React.useCallback(async (alumnosActuales) => {\n    let lista = alumnosActuales || alumnos;\n    if(!lista || lista.length === 0) {\n      try {\n        const sbAlumnos = await sb.getAlumnos('entrenador_principal');\n        if(sbAlumnos && sbAlumnos.length > 0) { setAlumnos(sbAlumnos); lista = sbAlumnos; }\n        else return;\n      } catch(e) { return; }\n    }\n    try {\n      const ids = lista.map(function(a){return a.id}).filter(function(id){return id && typeof id === 'string'});\n      if(ids.length === 0) return;\n      const idsStr = ids.join(',');\n      const results = await Promise.all([\n        sbFetch('sesiones?alumno_id=in.(' + idsStr + ')&select=*&order=created_at.desc&limit=500'),\n        sbFetch('progreso?alumno_id=in.(' + idsStr + ')&select=alumno_id,ejercicio_id,kg,reps,fecha&order=created_at.desc&limit=3000'),\n      ]);\n      var sesResult=results[0],progResult=results[1];\n      if(sesResult && Array.isArray(sesResult)) setSesionesGlobales(sesResult);\n      if(progResult && Array.isArray(progResult)) {\n        var idx2 = {};\n        progResult.forEach(function(reg) {\n          if(!idx2[reg.alumno_id]) idx2[reg.alumno_id] = [];\n          idx2[reg.alumno_id].push(reg);\n        });\n        setProgresoGlobal(idx2);\n      }\n    } catch(e) { console.error('[cargarSesionesGlobales]', e); }\n  }, [alumnos]);\n\n  useEffect(function() {\n    if(sessionData && sessionData.role===\"entrenador\") {\n      var init = async function() {\n        var sbAlumnos = await sb.getAlumnos('entrenador_principal') || [];\n        setAlumnos(sbAlumnos);\n        if(sbAlumnos.length > 0) await cargarSesionesGlobales(sbAlumnos);\n      };\n      init();\n      var intervalo = setInterval(function() { cargarSesionesGlobales(); }, 30000);\n      return function() { clearInterval(intervalo); };\n    }\n  }, [sessionData]);\n\n";
  c=c.replace(m2, fn + "  " + m2);
  console.log("OK FIX 2: cargarSesionesGlobales agregado");fixes++;
}else if(c.includes("cargarSesionesGlobales")){console.log("SKIP FIX 2: ya existe")}
else{console.log("ERR FIX 2: no encontre marker")}

// FIX 3: logSet - eliminar try/atob(sharedParam) que rompe
const m3="const rutData = JSON.parse(atob(sharedParam));\n        if(alumnoIdSync) {\n          if(!isOnline) {";
if(c.includes(m3)){
  const oldBlock="try {\n        const rutData = JSON.parse(atob(sharedParam));\n        if(alumnoIdSync) {\n          if(!isOnline) {\n            // Guardar en cola local para sincronizar despu\u00e9s\n            const item = {exId, kg:parseFloat(kg)||0, reps:parseInt(reps)||0, note:note||'', date:d};\n            const updated = [...pendingSync, item];\n            setPendingSync(updated);\n            try{localStorage.setItem('it_pending_sync', JSON.stringify(updated));}catch(e){}\n          } else {\n            console.log(\"[PROGRESO] enviando a supabase...\");sb.addProgreso({\n              alumno_id: alumnoIdSync,\n              ejercicio_id: exId,\n              kg: parseFloat(kg)||0,\n              reps: parseInt(reps)||0,\n              nota: note||\"\",\n              fecha: d\n            });\n          }\n        }\n      } catch(e) {}";
  const newBlock="if(!isOnline) {\n        var item = {exId, kg:parseFloat(kg)||0, reps:parseInt(reps)||0, note:note||'', date:d};\n        var updated = [...pendingSync, item];\n        setPendingSync(updated);\n        try{localStorage.setItem('it_pending_sync', JSON.stringify(updated));}catch(e){}\n      } else {\n        sb.addProgreso({\n          alumno_id: alumnoIdSync,\n          ejercicio_id: exId,\n          kg: parseFloat(kg)||0,\n          reps: parseInt(reps)||0,\n          nota: note||\"\",\n          fecha: d\n        }).then(function(r){console.log('[PROGRESO] OK',r)}).catch(function(e){console.error('[PROGRESO] ERR',e)});\n      }";
  if(c.includes(oldBlock)){
    c=c.replace(oldBlock,newBlock);
    console.log("OK FIX 3: logSet arreglado");fixes++;
  }else{console.log("ERR FIX 3: bloque no matchea exacto, intentando alternativo...");
    // Fix alternativo: buscar el try{atob} mas cercano a logSet
    var tryIdx=c.indexOf("try {\n        const rutData = JSON.parse(atob(sharedParam));");
    if(tryIdx>800 && tryIdx<1000){
      // Encontrar el catch(e) {} que cierra
      var catchStr="} catch(e) {}";
      var catchIdx=c.indexOf(catchStr,tryIdx);
      if(catchIdx>0){
        var blockToReplace=c.substring(tryIdx,catchIdx+catchStr.length);
        c=c.replace(blockToReplace,newBlock);
        console.log("OK FIX 3 (alt): logSet arreglado");fixes++;
      }
    }
  }
}else if(c.includes("[PROGRESO] OK")){console.log("SKIP FIX 3: ya arreglado")}
else{console.log("SKIP FIX 3: no encontre el patron")}

// FIX 4: setSesionesLocal -> setSesionesData
if(c.includes("setSesionesLocal")){
  c=c.replace(/setSesionesLocal/g,"setSesionesData");
  console.log("OK FIX 4: setSesionesLocal corregido");fixes++;
}else{console.log("SKIP FIX 4: ya corregido")}

// FIX 5: DashboardEntrenador - pasar sesionesGlobales y progresoGlobal
if(c.includes("sesiones={alumnoSesiones}") && c.includes("DashboardEntrenador")){
  c=c.replace("sesiones={alumnoSesiones}","sesiones={sesionesGlobales}\n                progresoGlobal={progresoGlobal}");
  console.log("OK FIX 5: Dashboard recibe sesionesGlobales");fixes++;
}else{console.log("SKIP FIX 5: ya corregido o no encontrado")}

// FIX 6: DashboardEntrenador props - agregar progresoGlobal
var dashDef="function DashboardEntrenador({alumnos, sesiones, es, onVerAlumno, onChatAlumno, darkMode, progress={}, session=null, routines=[], pagosEstado={}, togglePago=()=>{}})";
if(c.includes(dashDef)){
  c=c.replace(dashDef,"function DashboardEntrenador({alumnos, sesiones, es, onVerAlumno, onChatAlumno, darkMode, progress={}, progresoGlobal={}, session=null, routines=[], pagosEstado={}, togglePago=()=>{}})");
  console.log("OK FIX 6: Dashboard props actualizados");fixes++;
}else{console.log("SKIP FIX 6: ya tiene progresoGlobal o no matchea")}

// FIX 7: getNarrativaAlumno - reemplazar a.progress por progresoGlobal
if(c.includes("const progData = a.progress||{};")){
  c=c.replace("const progData = a.progress||{};","const regsAlumno = progresoGlobal[a.id] || []; const progData = {}; regsAlumno.forEach(function(r){if(!progData[r.ejercicio_id])progData[r.ejercicio_id]={sets:[],max:0};progData[r.ejercicio_id].sets.push({kg:parseFloat(r.kg)||0,reps:parseInt(r.reps)||0,date:r.fecha,week:0});progData[r.ejercicio_id].max=Math.max(progData[r.ejercicio_id].max,parseFloat(r.kg)||0);});");
  console.log("OK FIX 7: narrativa usa progresoGlobal");fixes++;
}else{console.log("SKIP FIX 7: ya corregido")}

// FIX 8: alumnoProgress usa progresoGlobal
if(c.includes("if(ex?.id && a.progress?.[ex.id]) acc[ex.id]=a.progress[ex.id];")){
  c=c.replace(/const alumnoProgress = routines[\s\S]*?return acc;\s*\}, \{\}\);/,"const alumnoProgress = progresoGlobal[a.id] || [];");
  console.log("OK FIX 8: alumnoProgress usa progresoGlobal");fixes++;
}else{console.log("SKIP FIX 8: ya corregido")}

// FIX 9: WorkoutScreen props - agregar sessionData y onSesionGuardada
var wsDef="setPrCelebration, activeExIdx, setActiveExIdx}) {";
if(c.includes(wsDef) && !c.includes("sessionData, onSesionGuardada}) {")){
  c=c.replace(wsDef,"setPrCelebration, activeExIdx, setActiveExIdx, sessionData, onSesionGuardada}) {");
  console.log("OK FIX 9: WorkoutScreen props");fixes++;
}else{console.log("SKIP FIX 9: ya tiene props")}

// FIX 10: Pasar sessionData y onSesionGuardada a WorkoutScreen
var wsRender="activeExIdx={activeExIdx} setActiveExIdx={setActiveExIdx}/>";
if(c.includes(wsRender) && !c.includes("onSesionGuardada={")){
  c=c.replace(wsRender,"activeExIdx={activeExIdx} setActiveExIdx={setActiveExIdx} sessionData={sessionData} onSesionGuardada={typeof cargarSesionesGlobales==='function'?cargarSesionesGlobales:function(){}}/>");
  console.log("OK FIX 10: WorkoutScreen recibe sessionData");fixes++;
}else{console.log("SKIP FIX 10: ya tiene props")}

// FIX 11: Object.values(a.progress||{}) -> Object.values(progress||{})
if(c.includes("Object.values(a.progress||{})")){
  c=c.replace("Object.values(a.progress||{})","Object.values(progress||{})");
  console.log("OK FIX 11: sparkline a.progress corregido");fixes++;
}else{console.log("SKIP FIX 11: ya corregido")}

// ESCRIBIR con writeFileSync (NO Set-Content)
fs.writeFileSync("App.jsx",c,"utf8");
console.log("\n=== "+fixes+" fixes aplicados ===");
console.log("Ahora: npx vite");
