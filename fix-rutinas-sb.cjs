const fs=require("fs");
let c=fs.readFileSync("App.jsx","utf8");
const lines=c.split(/\r?\n/);
// Encontrar linea 2494 (cierre de routines.map) que está justo antes de Object.keys(progress)
for(let i=2490;i<2500;i++){
  if(lines[i] && lines[i].trim()==="})}" && lines[i+1] && lines[i+1].includes("Object.keys(progress)")){
    console.log("Encontrado en linea",i+1);
    const insert=[
      '            {/* Rutinas de Supabase */}',
      '            {rutinasSBEntrenador.length>0&&(',
      '              <div style={{marginTop:16}}>',
      '                <div style={{fontSize:11,fontWeight:800,color:"#22C55E",letterSpacing:2,marginBottom:8,textTransform:"uppercase",borderLeft:"3px solid #22C55E",paddingLeft:8}}>{es?"RUTINAS ASIGNADAS":"ASSIGNED ROUTINES"} ({rutinasSBEntrenador.length})</div>',
      '                {rutinasSBEntrenador.map(function(rSB,ri){',
      '                  var alumnoInfo=alumnos.find(function(al){return al.id===rSB.alumno_id});',
      '                  var diasSB=rSB.datos?.days||[];',
      '                  return(<div key={rSB.id||ri} style={{background:bgCard,borderRadius:12,padding:"16px",marginBottom:8,border:"1px solid "+border}}>',
      '                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>',
      '                      <div><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{fontSize:18,fontWeight:800,color:textMain}}>{rSB.nombre}</div><span style={{background:"#22C55E22",color:"#22C55E",borderRadius:6,padding:"1px 7px",fontSize:10,fontWeight:700}}>Supabase</span></div>',
      '                      {alumnoInfo&&<div style={{fontSize:13,fontWeight:700,color:textMuted,marginTop:2}}>?? {alumnoInfo.nombre||alumnoInfo.email}</div>}',
      '                      <div style={{fontSize:13,color:textMuted}}>{diasSB.length} {es?"días":"days"}</div></div>',
      '                      <div style={{display:"flex",gap:8}}>',
      '                        <button className="hov" style={{background:"#2563EB22",color:"#2563EB",border:"none",borderRadius:8,padding:"8px 12px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}} onClick={function(){var rutLocal={id:rSB.id,...(rSB.datos||{}),name:rSB.nombre,saved:true,alumno_id:rSB.alumno_id,alumno:alumnoInfo?.nombre||""};setRoutines(function(p){var ex=p.find(function(x){return x.id===rSB.id});return ex?p:[rutLocal,...p]});toast2(es?"Abierta para editar":"Opened for editing");}}>{es?"Editar":"Edit"}</button>',
      '                        <button className="hov" style={{background:"#22C55E22",color:"#22C55E",border:"none",borderRadius:8,padding:"8px 10px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}} onClick={function(){var copia={id:uid(),name:rSB.nombre+" (copia)",days:(rSB.datos?.days||[]).map(function(d){return{...d,warmup:(d.warmup||[]).map(function(e){return{...e}}),exercises:(d.exercises||[]).map(function(e){return{...e}})}}),collapsed:false,saved:false};setRoutines(function(p){return[...p,copia]});toast2(es?"Rutina duplicada":"Routine duplicated");}}><Ic name="copy" size={14}/></button>',
      '                      </div>',
      '                    </div>',
      '                    <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:4}}>{diasSB.map(function(d,di){return(<span key={di} style={{background:bgSub,borderRadius:6,padding:"2px 8px",fontSize:11,color:textMuted,fontWeight:600}}>{d.label||("Día "+(di+1))} · {((d.warmup||[]).length+(d.exercises||[]).length)} ej.</span>)})}</div>',
      '                  </div>);',
      '                })}',
      '              </div>',
      '            )}',
    ];
    lines.splice(i+1,0,...insert);
    break;
  }
}
fs.writeFileSync("App.jsx",lines.join("\n"),"utf8");
var v=fs.readFileSync("App.jsx","utf8");
console.log("Lineas:",v.split(/\r?\n/).length);
console.log("Tiene rutinasSBEntrenador.map:",v.includes("rutinasSBEntrenador.map")?"SI":"NO");
