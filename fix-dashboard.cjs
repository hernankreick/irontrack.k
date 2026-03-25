// fix-dashboard.cjs — Mejora el Dashboard del entrenador
// Muestra para cada alumno: último peso por ejercicio, PRs, tendencia, última sesión
// Ejecutar: node fix-dashboard.cjs
const fs = require("fs");
let c = fs.readFileSync("App.jsx", "utf8");
let fixes = 0;

// ═══════════════════════════════════════════════════════════════
// FIX: Reemplazar la sección ALUMNOS del Dashboard con cards
// que muestran info completa de progreso
// ═══════════════════════════════════════════════════════════════

// Buscar el bloque de alumnos.map en el Dashboard
const oldStart = '          <div style={{background:bgCard,border:"1px solid "+border,borderRadius:12,marginBottom:20,overflow:"hidden"}}>\n            {alumnos.map((a,i)=>{\n              const alumnoProgress = routines';
const oldEnd = '          </div>\n        </>\n      )}\n      {modalPR&&(';

const oldStartIdx = c.indexOf(oldStart);
const oldEndIdx = c.indexOf(oldEnd, oldStartIdx);

if (oldStartIdx === -1) {
  console.log("WARN: no encontre el bloque viejo exacto, intentando alternativo...");
  // Buscar por partes
  var altStart = c.indexOf('{alumnos.map((a,i)=>{\n              const alumnoProgress');
  if (altStart === -1) altStart = c.indexOf('{alumnos.map((a,i)=>{');
  if (altStart > 5000) {
    console.log("Encontre alumnos.map en posicion", altStart);
  } else {
    console.log("ERROR: no encontre el bloque de alumnos en Dashboard");
    // Intentar con progresoGlobal si ya fue parcheado
    var altStart2 = c.indexOf('{alumnos.map((a,i)=>{\n              const alumnoProgress = progresoGlobal');
    if (altStart2 > 0) {
      console.log("Ya fue parcheado con progresoGlobal en posicion", altStart2);
    }
  }
}

// Estrategia: reemplazar TODO el bloque desde {alumnos.map hasta el cierre
// Pero es muy riesgoso con el archivo de 6000+ líneas
// Mejor: solo reemplazar el CONTENIDO de cada alumno card

// Enfoque seguro: reemplazar getNarrativaAlumno y la card de alumno
// para que use progresoGlobal y muestre más info

// 1. Reemplazar alumnoProgress y getNarrativaAlumno
const oldNarrativa = "const alumnoProgress = routines\n                .filter(r=>r.alumno_id===a.id)\n                .flatMap(r=>r.days||[])\n                .flatMap(d=>[...(d.exercises||[]),(d.warmup||[])].flat())\n                .reduce((acc,ex)=>{\n                  if(ex?.id && a.progress?.[ex.id]) acc[ex.id]=a.progress[ex.id];\n                  return acc;\n                }, {});\n\n              // \u2500\u2500 Narrativa inteligente \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n              const getNarrativaAlumno = () => {\n                // PR reciente: alg\u00FAn set del alumno supera el m\u00E1ximo anterior\n                let prReciente = null;\n                let mejorPct = 0;\n                let ejercicioCaida = null;\n\n                const progData = a.progress||{};";

const oldNarrativa2 = "const alumnoProgress = progresoGlobal[a.id] || [];\n\n              // \u2500\u2500 Narrativa inteligente \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n              const getNarrativaAlumno = () => {\n                // PR reciente: alg\u00FAn set del alumno supera el m\u00E1ximo anterior\n                let prReciente = null;\n                let mejorPct = 0;\n                let ejercicioCaida = null;\n\n                const progData = a.progress||{};";

const newNarrativa = `// \u2500\u2500 Datos del alumno desde Supabase \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
              const regsAlumno = progresoGlobal[a.id] || [];
              const sesAlumno = (sesiones||[]).filter(function(s){return s.alumno_id===a.id})
                .sort(function(x,y){return new Date(y.created_at||y.fecha)-new Date(x.created_at||x.fecha)});
              const ultimaSes = sesAlumno[0];

              // PRs por ejercicio
              const prsPorEj = {};
              regsAlumno.forEach(function(reg){
                var exId = reg.ejercicio_id;
                var kg = parseFloat(reg.kg)||0;
                if(!prsPorEj[exId] || kg > prsPorEj[exId].kg) {
                  prsPorEj[exId] = {kg:kg, fecha:reg.fecha};
                }
              });

              // Últimos pesos por ejercicio (último registro de cada ej)
              const ultimosPesos = {};
              regsAlumno.forEach(function(reg){
                var exId = reg.ejercicio_id;
                if(!ultimosPesos[exId]) ultimosPesos[exId] = {kg:parseFloat(reg.kg)||0, reps:parseInt(reg.reps)||0, fecha:reg.fecha};
              });

              // Top 3 ejercicios por PR
              const topPRs = Object.entries(prsPorEj)
                .sort(function(a,b){return b[1].kg-a[1].kg})
                .slice(0,3)
                .map(function(entry){
                  var exInfo = EX.find(function(e){return e.id===entry[0]});
                  return {id:entry[0], nombre:exInfo?exInfo.name:entry[0], kg:entry[1].kg};
                });

              // Tendencia: comparar promedio últimos 3 registros vs anteriores 3
              var tendencia = null;
              if(regsAlumno.length >= 6) {
                var sorted = regsAlumno.slice().sort(function(a,b){return new Date(b.created_at||b.fecha)-new Date(a.created_at||a.fecha)});
                var recientes = sorted.slice(0,3);
                var anteriores = sorted.slice(3,6);
                var avgRec = recientes.reduce(function(acc,r){return acc+(parseFloat(r.kg)||0)},0)/3;
                var avgAnt = anteriores.reduce(function(acc,r){return acc+(parseFloat(r.kg)||0)},0)/3;
                if(avgAnt > 0) {
                  var pctCambio = Math.round((avgRec-avgAnt)/avgAnt*100);
                  tendencia = {pct:pctCambio, dir:pctCambio>2?"sube":pctCambio<-2?"baja":"estable"};
                }
              }

              // Narrativa inteligente
              const getNarrativaAlumno = function() {
                var prReciente = null;
                var mejorPct = 0;
                var ejercicioCaida = null;

                // Agrupar por ejercicio
                var porEj = {};
                regsAlumno.forEach(function(reg){
                  var exId = reg.ejercicio_id;
                  if(!porEj[exId]) porEj[exId] = [];
                  porEj[exId].push({kg:parseFloat(reg.kg)||0, fecha:reg.fecha});
                });

                Object.entries(porEj).forEach(function(entry){
                  var exId = entry[0], registros = entry[1];
                  if(registros.length < 2) return;
                  var maxKg = Math.max.apply(null, registros.map(function(r){return r.kg}));
                  var primero = registros[registros.length-1];
                  var ultimo = registros[0];
                  var pct = primero.kg > 0 ? Math.round((ultimo.kg-primero.kg)/primero.kg*100) : 0;
                  if(pct > mejorPct) mejorPct = pct;
                  if(ultimo.kg >= maxKg && registros.length > 1) {
                    var exInfo = EX.find(function(e){return e.id===exId});
                    if(!prReciente) prReciente = {exId:exId, kg:maxKg, nombre:exInfo?exInfo.name:exId};
                  }
                  if(ultimo.kg < primero.kg * 0.9 && !ejercicioCaida) {
                    var exInfo2 = EX.find(function(e){return e.id===exId});
                    ejercicioCaida = exInfo2?exInfo2.name:null;
                  }
                });

                var progData = {};`;

// Intentar reemplazar ambas versiones
if (c.includes(oldNarrativa)) {
  c = c.replace(oldNarrativa, newNarrativa);
  console.log("OK: Narrativa reemplazada (version original)"); fixes++;
} else if (c.includes(oldNarrativa2)) {
  c = c.replace(oldNarrativa2, newNarrativa);
  console.log("OK: Narrativa reemplazada (version parcheada)"); fixes++;
} else {
  console.log("WARN: No encontre getNarrativaAlumno para reemplazar");
  // Buscar cualquier version
  var nIdx = c.indexOf("const getNarrativaAlumno = () => {");
  if (nIdx === -1) nIdx = c.indexOf("const getNarrativaAlumno = function()");
  if (nIdx > 0) {
    console.log("  getNarrativaAlumno encontrado en posicion", nIdx);
  }
}

// 2. Reemplazar la card de alumno para mostrar info expandida
// Buscar el return de cada alumno y agregar sección de progreso
const oldCard = `                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke={textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      style={{flexShrink:0,opacity:0.5}}>
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </div>
                  {narrativa&&(
                    <div style={{
                      background:narrativa.bg,
                      border:"1px solid "+narrativa.border,
                      borderRadius:8,padding:"8px 10px",
                      marginLeft:46,
                      fontSize:12,color:narrativa.color,
                      fontWeight:500,lineHeight:1.4
                    }}>
                      {narrativa.tipo==="pr"&&<span style={{background:"#22C55E",color:"#fff",fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:4,marginRight:8}}>PR</span>}
                      {narrativa.tipo==="alerta"&&<span style={{fontSize:12,marginRight:4}}>\u26A0</span>}
                      {narrativa.msg}
                    </div>
                  )}`;

const newCard = `                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke={textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      style={{flexShrink:0,opacity:0.5}}>
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </div>
                  {narrativa&&(
                    <div style={{
                      background:narrativa.bg,
                      border:"1px solid "+narrativa.border,
                      borderRadius:8,padding:"8px 10px",
                      marginLeft:46,
                      fontSize:12,color:narrativa.color,
                      fontWeight:500,lineHeight:1.4
                    }}>
                      {narrativa.tipo==="pr"&&<span style={{background:"#22C55E",color:"#fff",fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:4,marginRight:8}}>PR</span>}
                      {narrativa.tipo==="alerta"&&<span style={{fontSize:12,marginRight:4}}>\u26A0</span>}
                      {narrativa.msg}
                    </div>
                  )}
                  {/* \u2500\u2500 Info expandida de progreso \u2500\u2500 */}
                  {regsAlumno.length>0&&(
                    <div style={{marginLeft:46,marginTop:8}}>
                      {/* Última sesión */}
                      {ultimaSes&&(
                        <div style={{fontSize:11,color:textMuted,marginBottom:6}}>
                          <span style={{fontWeight:700}}>{es?"\u00DAltima sesi\u00F3n":"Last session"}:</span> {ultimaSes.dia_label||"?"} \u00B7 {ultimaSes.fecha||"?"} \u00B7 {ultimaSes.hora||""}
                        </div>
                      )}
                      {/* Tendencia */}
                      {tendencia&&(
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                          <span style={{fontSize:11,fontWeight:700,color:tendencia.dir==="sube"?"#22C55E":tendencia.dir==="baja"?"#EF4444":"#8B9AB2"}}>
                            {tendencia.dir==="sube"?"\u2191":tendencia.dir==="baja"?"\u2193":"\u2192"} {tendencia.pct>0?"+":""}{tendencia.pct}%
                          </span>
                          <span style={{fontSize:10,color:textMuted}}>{es?"tendencia carga":"load trend"}</span>
                        </div>
                      )}
                      {/* Top PRs */}
                      {topPRs.length>0&&(
                        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
                          {topPRs.map(function(pr){return(
                            <span key={pr.id} style={{background:"#22C55E15",border:"1px solid #22C55E33",borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:700,color:"#22C55E"}}>
                              \uD83C\uDFC6 {pr.nombre.substring(0,15)} {pr.kg}kg
                            </span>
                          )})}
                        </div>
                      )}
                      {/* Últimos pesos por ejercicio */}
                      {Object.keys(ultimosPesos).length>0&&(
                        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                          {Object.entries(ultimosPesos).slice(0,4).map(function(entry){
                            var exInfo = EX.find(function(e){return e.id===entry[0]});
                            var nombre = exInfo?exInfo.name:entry[0];
                            return(
                              <span key={entry[0]} style={{background:bgSub,borderRadius:6,padding:"2px 6px",fontSize:9,color:textMuted,fontWeight:600}}>
                                {nombre.substring(0,12)} {entry[1].kg}kg\u00D7{entry[1].reps}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}`;

if (c.includes(oldCard)) {
  c = c.replace(oldCard, newCard);
  console.log("OK: Card de alumno expandida con info de progreso"); fixes++;
} else {
  console.log("WARN: No encontre card de alumno para expandir");
}

// ESCRIBIR
fs.writeFileSync("App.jsx", c, "utf8");
var vLines = fs.readFileSync("App.jsx", "utf8").split(/\r?\n/).length;
console.log("\n=== " + fixes + " fixes aplicados ===");
console.log("Archivo: " + vLines + " lineas");
console.log("Verificacion: " + (vLines > 6000 ? "OK" : "ERROR"));
