const fs=require("fs");
const lines=fs.readFileSync("App.jsx","utf8").split("\n");
// Reemplazar líneas 888-909 (index 888-909) con el bloque correcto
const fix=[
'    if(alumnoIdSync) {',
'      if(!isOnline) {',
'        const item = {exId, kg:parseFloat(kg)||0, reps:parseInt(reps)||0, note:note||"", date:d};',
'        const updated = [...pendingSync, item];',
'        setPendingSync(updated);',
'        try{localStorage.setItem("it_pending_sync", JSON.stringify(updated));}catch(e){}',
'      } else {',
'        console.log("[PROGRESO] enviando", alumnoIdSync, exId, kg);',
'        sb.addProgreso({',
'          alumno_id: alumnoIdSync,',
'          ejercicio_id: exId,',
'          kg: parseFloat(kg)||0,',
'          reps: parseInt(reps)||0,',
'          nota: note||"",',
'          fecha: d',
'        }).then(function(r){console.log("[PROGRESO] OK",r)}).catch(function(e){console.error("[PROGRESO] ERR",e)});',
'      }',
'    }',
'','','',''
];
lines.splice(888,22,...fix);
fs.writeFileSync("App.jsx",lines.join("\n"));
console.log("LISTO - fix aplicado en lineas 888-909");
