// fix-all-final.cjs — TODOS los fixes de Iron Track
// Ejecutar: node fix-all-final.cjs
const fs = require("fs");
let c = fs.readFileSync("App.jsx", "utf8");
let fixes = 0;

// ═══════════════════════════════════════════════════════════════
// FIX 1: States faltantes
// ═══════════════════════════════════════════════════════════════
const m1 = "} = useAlumnos({ sb });";
if (c.includes(m1) && !c.includes("rutinasSB, setRutinasSB")) {
  c = c.replace(m1, m1 +
    "\n  const [rutinasSB, setRutinasSB] = useState([]);" +
    "\n  const [registrosSubTab, setRegistrosSubTab] = useState(0);" +
    "\n  const [sesionesGlobales, setSesionesGlobales] = useState([]);" +
    "\n  const [progresoGlobal, setProgresoGlobal] = useState({});" +
    "\n  const [sugerencias, setSugerencias] = useState({});");
  console.log("OK FIX 1: states agregados"); fixes++;
} else { console.log("SKIP FIX 1"); }

// ═══════════════════════════════════════════════════════════════
// FIX 2: cargarSesionesGlobales + useEffect entrenador
// ═══════════════════════════════════════════════════════════════
const m2 = 'const es = lang==="es";';
if (c.includes(m2) && !c.includes("cargarSesionesGlobales")) {
  const fn = "\n\n  const cargarSesionesGlobales = React.useCallback(async function(alumnosActuales) {" +
    "\n    var lista = alumnosActuales || alumnos;" +
    "\n    if(!lista || lista.length === 0) {" +
    "\n      try {" +
    "\n        var sbAlumnos = await sb.getAlumnos('entrenador_principal');" +
    "\n        if(sbAlumnos && sbAlumnos.length > 0) { setAlumnos(sbAlumnos); lista = sbAlumnos; }" +
    "\n        else return;" +
    "\n      } catch(e) { return; }" +
    "\n    }" +
    "\n    try {" +
    "\n      var ids = lista.map(function(a){return a.id}).filter(function(id){return id && typeof id === 'string'});" +
    "\n      if(ids.length === 0) return;" +
    "\n      var idsStr = ids.join(',');" +
    "\n      var results = await Promise.all([" +
    "\n        sbFetch('sesiones?alumno_id=in.(' + idsStr + ')&select=*&order=created_at.desc&limit=500')," +
    "\n        sbFetch('progreso?alumno_id=in.(' + idsStr + ')&select=alumno_id,ejercicio_id,kg,reps,fecha&order=created_at.desc&limit=3000')," +
    "\n      ]);" +
    "\n      if(results[0] && Array.isArray(results[0])) setSesionesGlobales(results[0]);" +
    "\n      if(results[1] && Array.isArray(results[1])) {" +
    "\n        var idx2 = {};" +
    "\n        results[1].forEach(function(reg) {" +
    "\n          if(!idx2[reg.alumno_id]) idx2[reg.alumno_id] = [];" +
    "\n          idx2[reg.alumno_id].push(reg);" +
    "\n        });" +
    "\n        setProgresoGlobal(idx2);" +
    "\n      }" +
    "\n    } catch(e) { console.error('[cargarSesionesGlobales]', e); }" +
    "\n  }, [alumnos]);" +
    "\n" +
    "\n  useEffect(function() {" +
    "\n    if(sessionData && sessionData.role==='entrenador') {" +
    "\n      var init = async function() {" +
    "\n        var sbAlumnos = await sb.getAlumnos('entrenador_principal') || [];" +
    "\n        setAlumnos(sbAlumnos);" +
    "\n        if(sbAlumnos.length > 0) cargarSesionesGlobales(sbAlumnos);" +
    "\n      };" +
    "\n      init();" +
    "\n      var intervalo = setInterval(function() { cargarSesionesGlobales(); }, 30000);" +
    "\n      return function() { clearInterval(intervalo); };" +
    "\n    }" +
    "\n  }, [sessionData]);\n\n  ";
  c = c.replace(m2, fn + m2);
  console.log("OK FIX 2: cargarSesionesGlobales agregado"); fixes++;
} else { console.log("SKIP FIX 2"); }

// ═══════════════════════════════════════════════════════════════
// FIX 3: logSet - eliminar try/atob(sharedParam)
// ═══════════════════════════════════════════════════════════════
// Buscar el bloque problemático por partes
var logSetTryIdx = -1;
var lines = c.split(/\r?\n/);
for (var i = 0; i < lines.length; i++) {
  if (lines[i].includes("const rutData = JSON.parse(atob(sharedParam))") && i > 850 && i < 950) {
    logSetTryIdx = i;
    break;
  }
}
if (logSetTryIdx > 0) {
  // Encontrar el try { que está una línea antes
  var tryLine = logSetTryIdx - 1;
  // Encontrar el } catch(e) {} que cierra
  var catchLine = -1;
  for (var j = logSetTryIdx; j < logSetTryIdx + 25; j++) {
    if (lines[j] && lines[j].trim() === "} catch(e) {}") {
      catchLine = j;
      break;
    }
  }
  if (catchLine > 0) {
    // Reemplazar las líneas tryLine..catchLine con el bloque correcto
    var newLines = [
      "      if(!isOnline) {",
      "        var item = {exId, kg:parseFloat(kg)||0, reps:parseInt(reps)||0, note:note||'', date:d};",
      "        var updated = [...pendingSync, item];",
      "        setPendingSync(updated);",
      "        try{localStorage.setItem('it_pending_sync', JSON.stringify(updated));}catch(e){}",
      "      } else {",
      "        sb.addProgreso({",
      "          alumno_id: alumnoIdSync,",
      "          ejercicio_id: exId,",
      "          kg: parseFloat(kg)||0,",
      "          reps: parseInt(reps)||0,",
      '          nota: note||"",',
      "          fecha: d",
      "        }).then(function(r){console.log('[PROGRESO] OK',r)}).catch(function(e){console.error('[PROGRESO] ERR',e)});",
      "      }"
    ];
    lines.splice(tryLine, catchLine - tryLine + 1, ...newLines);
    c = lines.join("\n");
    console.log("OK FIX 3: logSet arreglado (lineas " + tryLine + "-" + catchLine + ")"); fixes++;
  } else {
    console.log("ERR FIX 3: no encontre catch");
  }
} else if (c.includes("[PROGRESO] OK")) {
  console.log("SKIP FIX 3: ya arreglado");
} else {
  console.log("WARN FIX 3: no encontre el patron de atob en logSet");
}

// ═══════════════════════════════════════════════════════════════
// FIX 4: setSesionesLocal -> setSesionesData
// ═══════════════════════════════════════════════════════════════
if (c.includes("setSesionesLocal")) {
  c = c.replace(/setSesionesLocal/g, "setSesionesData");
  console.log("OK FIX 4: setSesionesLocal corregido"); fixes++;
} else { console.log("SKIP FIX 4"); }

// ═══════════════════════════════════════════════════════════════
// FIX 5: DashboardEntrenador recibe sesionesGlobales y progresoGlobal
// ═══════════════════════════════════════════════════════════════
if (c.includes("sesiones={alumnoSesiones}") && c.includes("DashboardEntrenador")) {
  c = c.replace("sesiones={alumnoSesiones}", "sesiones={sesionesGlobales}\n                progresoGlobal={progresoGlobal}");
  console.log("OK FIX 5: Dashboard recibe sesionesGlobales"); fixes++;
} else { console.log("SKIP FIX 5"); }

// ═══════════════════════════════════════════════════════════════
// FIX 6: DashboardEntrenador props
// ═══════════════════════════════════════════════════════════════
var dashDef = "function DashboardEntrenador({alumnos, sesiones, es, onVerAlumno, onChatAlumno, darkMode, progress={}, session=null, routines=[], pagosEstado={}, togglePago=()=>{}})";
if (c.includes(dashDef)) {
  c = c.replace(dashDef, "function DashboardEntrenador({alumnos, sesiones, es, onVerAlumno, onChatAlumno, darkMode, progress={}, progresoGlobal={}, session=null, routines=[], pagosEstado={}, togglePago=()=>{}})");
  console.log("OK FIX 6: Dashboard props"); fixes++;
} else { console.log("SKIP FIX 6"); }

// ═══════════════════════════════════════════════════════════════
// FIX 7: getNarrativaAlumno usa progresoGlobal
// ═══════════════════════════════════════════════════════════════
if (c.includes("const progData = a.progress||{};")) {
  c = c.replace(
    "const progData = a.progress||{};",
    "var regsAlu = progresoGlobal[a.id] || []; var progData = {}; regsAlu.forEach(function(r){if(!progData[r.ejercicio_id])progData[r.ejercicio_id]={sets:[],max:0};progData[r.ejercicio_id].sets.push({kg:parseFloat(r.kg)||0,reps:parseInt(r.reps)||0,date:r.fecha,week:0});progData[r.ejercicio_id].max=Math.max(progData[r.ejercicio_id].max,parseFloat(r.kg)||0);});"
  );
  console.log("OK FIX 7: narrativa usa progresoGlobal"); fixes++;
} else { console.log("SKIP FIX 7"); }

// ═══════════════════════════════════════════════════════════════
// FIX 8: alumnoProgress usa progresoGlobal
// ═══════════════════════════════════════════════════════════════
if (c.includes("if(ex?.id && a.progress?.[ex.id]) acc[ex.id]=a.progress[ex.id];")) {
  // Reemplazar el bloque completo de alumnoProgress
  var apStart = c.indexOf("const alumnoProgress = routines");
  var apEnd = c.indexOf("}, {});", apStart);
  if (apStart > 0 && apEnd > 0) {
    var oldAP = c.substring(apStart, apEnd + 7);
    c = c.replace(oldAP, "const alumnoProgress = progresoGlobal[a.id] || [];");
    console.log("OK FIX 8: alumnoProgress usa progresoGlobal"); fixes++;
  }
} else { console.log("SKIP FIX 8"); }

// ═══════════════════════════════════════════════════════════════
// FIX 9: WorkoutScreen props
// ═══════════════════════════════════════════════════════════════
var wsDef = "setPrCelebration, activeExIdx, setActiveExIdx}) {";
if (c.includes(wsDef) && !c.includes("sessionData, onSesionGuardada}) {")) {
  c = c.replace(wsDef, "setPrCelebration, activeExIdx, setActiveExIdx, sessionData, onSesionGuardada}) {");
  console.log("OK FIX 9: WorkoutScreen props"); fixes++;
} else { console.log("SKIP FIX 9"); }

// ═══════════════════════════════════════════════════════════════
// FIX 10: Pasar sessionData y onSesionGuardada donde se renderiza WorkoutScreen
// ═══════════════════════════════════════════════════════════════
var wsRender = "activeExIdx={activeExIdx} setActiveExIdx={setActiveExIdx}/>";
if (c.includes(wsRender) && !c.includes("onSesionGuardada={")) {
  c = c.replace(wsRender,
    "activeExIdx={activeExIdx} setActiveExIdx={setActiveExIdx} sessionData={sessionData} onSesionGuardada={typeof cargarSesionesGlobales==='function'?cargarSesionesGlobales:function(){}}/>"
  );
  console.log("OK FIX 10: WorkoutScreen recibe sessionData"); fixes++;
} else { console.log("SKIP FIX 10"); }

// ═══════════════════════════════════════════════════════════════
// FIX 11: Sparkline a.progress -> progress
// ═══════════════════════════════════════════════════════════════
if (c.includes("Object.values(a.progress||{})")) {
  c = c.replace("Object.values(a.progress||{})", "Object.values(progress||{})");
  console.log("OK FIX 11: sparkline corregido"); fixes++;
} else { console.log("SKIP FIX 11"); }

// ═══════════════════════════════════════════════════════════════
// FIX 12: GraficoProgreso - loading state + auto-seleccion
// ═══════════════════════════════════════════════════════════════
var grafOld = "const [selEx, setSelEx] = React.useState(null);\n  const [sbData, setSbData] = React.useState([]);\n  const [sesionesData, setSesionesData] = React.useState(sesiones||[]);\n  const canvasRef";
var grafNew = "const [selEx, setSelEx] = React.useState(null);\n  const [sbData, setSbData] = React.useState([]);\n  const [sesionesData, setSesionesData] = React.useState(sesiones||[]);\n  const [loadingGrafico, setLoadingGrafico] = React.useState(true);\n  const canvasRef";
if (c.includes(grafOld)) {
  c = c.replace(grafOld, grafNew);
  console.log("OK FIX 12a: loadingGrafico state"); fixes++;
} else { console.log("SKIP FIX 12a"); }

// Reemplazar la carga de datos con Promise.all + loading
var grafLoad = "if(!alumnoId) return;\n    sb.getProgreso(alumnoId).then(d=>{ if(d) setSbData(d); });\n    sb.getSesiones(alumnoId).then(d=>{ if(d) setSesionesData(d); });";
var grafLoadNew = "if(!alumnoId) { setLoadingGrafico(false); return; }\n    Promise.all([\n      sb.getProgreso(alumnoId),\n      sb.getSesiones(alumnoId),\n    ]).then(function(results){\n      if(results[0]) setSbData(results[0]);\n      if(results[1]) setSesionesData(results[1]);\n      setLoadingGrafico(false);\n    }).catch(function(){ setLoadingGrafico(false); });";
if (c.includes(grafLoad)) {
  c = c.replace(grafLoad, grafLoadNew);
  console.log("OK FIX 12b: Promise.all + loading"); fixes++;
} else { console.log("SKIP FIX 12b"); }

// Agregar loading skeleton
var grafEmpty = '  if(exConDatos.length===0 && sesionesData.length===0) return (';
var grafSkeleton = '  if(loadingGrafico) return (\n    <div style={{textAlign:"center",padding:"40px 0"}}>\n      <div className="sk" style={{height:180,borderRadius:12,marginBottom:12}}/>\n      <div className="sk" style={{height:14,width:"60%",margin:"0 auto"}}/>\n    </div>\n  );\n\n  if(exConDatos.length===0 && sesionesData.length===0) return (';
if (c.includes(grafEmpty) && !c.includes("loadingGrafico) return")) {
  c = c.replace(grafEmpty, grafSkeleton);
  console.log("OK FIX 12c: loading skeleton"); fixes++;
} else { console.log("SKIP FIX 12c"); }

// Auto-seleccionar primer ejercicio
var exConLocal = "const exConDatosLocal = (allEx||[]).filter(e=>\n          (progress[e.id]?.sets||[]).some(s=>parseFloat(s.kg)>0)\n        );";
var exConLocalNew = "const exConDatosLocal = (allEx||[]).filter(e=>\n          (progress[e.id]?.sets||[]).some(s=>parseFloat(s.kg)>0) ||\n          sbData.some(function(d){return d.ejercicio_id===e.id&&parseFloat(d.kg)>0})\n        );\n\n        if(!selEx && exConDatosLocal.length>0) {\n          setTimeout(function(){setSelEx(exConDatosLocal[0].id)},0);\n        }";
if (c.includes(exConLocal)) {
  c = c.replace(exConLocal, exConLocalNew);
  console.log("OK FIX 12d: auto-seleccion ejercicio"); fixes++;
} else { console.log("SKIP FIX 12d"); }

// ═══════════════════════════════════════════════════════════════
// ESCRIBIR — SOLO con fs.writeFileSync (NUNCA Set-Content)
// ═══════════════════════════════════════════════════════════════
fs.writeFileSync("App.jsx", c, "utf8");

// Verificar que se escribió bien
var verify = fs.readFileSync("App.jsx", "utf8");
var vLines = verify.split(/\r?\n/).length;
console.log("\n=== " + fixes + " fixes aplicados ===");
console.log("Archivo: " + vLines + " lineas");
console.log("Verificacion: " + (vLines > 6000 ? "OK" : "ERROR - archivo corrupto"));
console.log("\nAhora: npx vite");
