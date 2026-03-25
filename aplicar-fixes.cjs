// ============================================================================
// IRON TRACK — Script de aplicación automática de fixes
// ============================================================================
// USO: node aplicar-fixes.js [ruta-al-archivo-gymapp.jsx]
// Ejemplo: node aplicar-fixes.js src/GymApp.jsx
// ============================================================================

const fs = require('fs');
const path = require('path');

const archivo = process.argv[2];
if (!archivo) {
  console.error('❌ Uso: node aplicar-fixes.js src/GymApp.jsx');
  process.exit(1);
}

let code = fs.readFileSync(archivo, 'utf8');
const original = code;
let fixesAplicados = 0;

function aplicarFix(nombre, buscar, reemplazar) {
  if (code.includes(buscar)) {
    code = code.replace(buscar, reemplazar);
    fixesAplicados++;
    console.log(`✅ ${nombre} — aplicado`);
  } else {
    console.log(`⚠️  ${nombre} — no se encontró el texto exacto, aplicar manualmente`);
  }
}

// ============================================================================
// FIX 0A — Agregar sessionDataRef después de sessionData
// ============================================================================
aplicarFix(
  'FIX 0A: sessionDataRef',
  `const [sessionData, setSessionData] = useState(()=>{ try{return JSON.parse(localStorage.getItem("it_session")||"null")}catch(e){return null} });`,
  `const [sessionData, setSessionData] = useState(()=>{ try{return JSON.parse(localStorage.getItem("it_session")||"null")}catch(e){return null} });
  // FIX 0A: ref para que logSet siempre tenga el sessionData actual
  const sessionDataRef = useRef(sessionData);
  useEffect(() => { sessionDataRef.current = sessionData; }, [sessionData]);`
);

// ============================================================================
// FIX 0B — logSet usa sessionDataRef en vez de sessionData (closure stale)
// ============================================================================
aplicarFix(
  'FIX 0B: logSet usa sessionDataRef',
  `const alumnoIdSync = sessionData?.alumnoId || (readOnly&&sharedParam?(()=>{try{return JSON.parse(atob(sharedParam)).alumnoId}catch(e){return null}})():null);`,
  `// FIX 0B: usar ref para evitar closure stale
    const alumnoIdSync = sessionDataRef.current?.alumnoId || (readOnly&&sharedParam?(()=>{try{return JSON.parse(atob(sharedParam)).alumnoId}catch(e){return null}})():null);`
);

// ============================================================================
// FIX 1 — Semana no avanza automáticamente el mismo día
// ============================================================================
// En WorkoutScreen.finalizarSesion
aplicarFix(
  'FIX 1: semana no avanza mismo día (WorkoutScreen)',
  `// Avanzar semana solo cuando se completan TODOS los días de la semana
    if(daysThisWeek >= totalDays && currentWeek < 3){
      setCompletedDays(prev=>prev.filter(k=>!k.endsWith("-w"+currentWeek)));
      setCurrentWeek(currentWeek + 1);
    }`,
  `// FIX 1: solo avanzar semana si pasó al menos 1 día real
    if(daysThisWeek >= totalDays && currentWeek < 3){
      const ultimaFechaAvance = localStorage.getItem('it_last_week_advance_date');
      const hoyDateStr = new Date().toDateString();
      if(!ultimaFechaAvance || ultimaFechaAvance !== hoyDateStr) {
        setCompletedDays(prev => prev.filter(k => !k.endsWith("-w" + currentWeek)));
        setCurrentWeek(currentWeek + 1);
        localStorage.setItem('it_last_week_advance_date', hoyDateStr);
      }
    }`
);

// ============================================================================
// FIX 2 — Sesión usa semana capturada + check duplicados
// ============================================================================
aplicarFix(
  'FIX 2: sesión con semana capturada + anti-duplicados',
  `if(!readOnly && sessionData?.role==="alumno" && sessionData?.alumnoId) {
      try {
        const resSesion = await sb.addSesion({
          alumno_id: sessionData.alumnoId,
          rutina_id: r?.id || null,
          rutina_nombre: r?.name||"",
          dia_label: activeDay.label||("Dia "+(session.dIdx+1)),
          dia_idx: session.dIdx,
          semana: currentWeek+1,
          ejercicios: exercises.map(e=>e.id).join(","),
          fecha: hoyFin,
          hora: new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})
        });
        if(resSesion && resSesion[0]) {
          console.log('[addSesion] ✓ sesión guardada:', resSesion[0].id);
          // Notificar a GymApp para que refresque sesionesGlobales
          // → el entrenador ve los datos inmediatamente
          if(typeof onSesionGuardada === 'function') {
            onSesionGuardada();
          }
        } else {
          console.error('[addSesion] ✗ Supabase no confirmó el guardado', resSesion);
        }
      } catch(e) { console.error('[addSesion alumno logueado]', e); }`,
  `if(!readOnly && sessionData?.role==="alumno" && sessionData?.alumnoId) {
      try {
        // FIX 2: capturar semana ANTES de cualquier setState
        const semanaParaGuardar = currentWeek + 1;
        // FIX 2: verificar que no exista sesión duplicada
        const sesExistentes = await sb.getSesiones(sessionData.alumnoId);
        const yaExiste = (sesExistentes || []).some(s =>
          s.fecha === hoyFin &&
          s.dia_idx === session.dIdx &&
          s.semana === semanaParaGuardar
        );
        if(yaExiste) {
          console.log('[addSesion] Sesión duplicada detectada, no se guarda');
        } else {
          const resSesion = await sb.addSesion({
            alumno_id: sessionData.alumnoId,
            rutina_id: r?.id || null,
            rutina_nombre: r?.name||"",
            dia_label: activeDay.label||("Dia "+(session.dIdx+1)),
            dia_idx: session.dIdx,
            semana: semanaParaGuardar,
            ejercicios: exercises.map(e=>e.id).join(","),
            fecha: hoyFin,
            hora: new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})
          });
          if(resSesion && resSesion[0]) {
            console.log('[addSesion] ✓ sesión guardada:', resSesion[0].id);
            if(typeof onSesionGuardada === 'function') {
              onSesionGuardada();
            }
          } else {
            console.error('[addSesion] ✗ Supabase no confirmó el guardado', resSesion);
          }
        }
      } catch(e) { console.error('[addSesion alumno logueado]', e); }`
);

// ============================================================================
// FIX 3 — GraficoProgreso: loading state
// ============================================================================
aplicarFix(
  'FIX 3A: agregar loadingGrafico state',
  `const [sbData, setSbData] = React.useState([]);
  const [sesionesData, setSesionesData] = React.useState(sesiones||[]);
  const canvasRef = React.useRef();`,
  `const [sbData, setSbData] = React.useState([]);
  const [sesionesData, setSesionesData] = React.useState(sesiones||[]);
  // FIX 3: loading state para el gráfico
  const [loadingGrafico, setLoadingGrafico] = React.useState(true);
  const canvasRef = React.useRef();`
);

aplicarFix(
  'FIX 3B: cargar datos con Promise.all + loading',
  `React.useEffect(()=>{
    const alumnoId = sessionData?.alumnoId || (sharedParam?(()=>{try{return JSON.parse(atob(sharedParam)).alumnoId}catch(e){return null}})():null);
    if(!alumnoId) return;
    sb.getProgreso(alumnoId).then(d=>{ if(d) setSbData(d); });
    sb.getSesiones(alumnoId).then(d=>{ if(d) setSesionesData(d); });
  },[]);`,
  `React.useEffect(()=>{
    const alumnoId = sessionData?.alumnoId || (sharedParam?(()=>{try{return JSON.parse(atob(sharedParam)).alumnoId}catch(e){return null}})():null);
    if(!alumnoId) { setLoadingGrafico(false); return; }
    // FIX 3: cargar en paralelo con loading state
    Promise.all([
      sb.getProgreso(alumnoId),
      sb.getSesiones(alumnoId),
    ]).then(([prog, ses]) => {
      if(prog) setSbData(prog);
      if(ses) setSesionesData(ses);
    }).finally(() => setLoadingGrafico(false));
  },[]);`
);

aplicarFix(
  'FIX 3C: mostrar skeleton mientras carga',
  `if(exConDatos.length===0 && sesionesData.length===0) return (
    <div style={{textAlign:"center",padding:"30px 0",color:textMuted}}>
      <div style={{fontSize:36,marginBottom:8}}>📊</div>`,
  `// FIX 3: skeleton mientras carga
  if(loadingGrafico) return (
    <div style={{padding:"40px 0",textAlign:"center"}}>
      <div className="sk" style={{height:180,borderRadius:12,marginBottom:12}}/>
      <div className="sk" style={{height:14,width:"60%",margin:"0 auto"}}/>
    </div>
  );
  if(exConDatos.length===0 && sesionesData.length===0) return (
    <div style={{textAlign:"center",padding:"30px 0",color:textMuted}}>
      <div style={{fontSize:36,marginBottom:8}}>📊</div>`
);

// ============================================================================
// FIX 4 — Agregar normalizeFecha helper
// ============================================================================
aplicarFix(
  'FIX 4: agregar normalizeFecha',
  `const uid = () => Math.random().toString(36).slice(2,9);`,
  `const uid = () => Math.random().toString(36).slice(2,9);
// FIX 4: normalizar fechas para comparaciones (evitar "22/3/2026" vs "22/03/2026")
const normalizeFecha = (f) => {
  if (!f) return '';
  const parts = f.split('/');
  if (parts.length === 3) return parts.map(p => p.padStart(2, '0')).join('/');
  return f;
};`
);

// FIX 4B — Usar normalizeFecha en comparaciones de PRs
// Hay 2 ocurrencias de p.fecha===s.fecha en el bloque de alumnoSesiones
let count4 = 0;
while (code.includes('p.ejercicio_id===exId&&p.fecha===s.fecha')) {
  code = code.replace(
    'p.ejercicio_id===exId&&p.fecha===s.fecha',
    'p.ejercicio_id===exId&&normalizeFecha(p.fecha)===normalizeFecha(s.fecha)'
  );
  count4++;
}
if (count4 > 0) {
  console.log(`✅ FIX 4B: normalizeFecha en comparaciones — ${count4} reemplazos`);
  fixesAplicados++;
} else {
  console.log('⚠️  FIX 4B: no se encontró p.fecha===s.fecha');
}

// ============================================================================
// FIX 5 — Dashboard narrativa: usar progresoGlobal en vez de a.progress
// ============================================================================
aplicarFix(
  'FIX 5: narrativa usa progresoGlobal',
  `const progData = a.progress||{};
    Object.entries(progData).forEach(([exId, pg])=>{
      const sets = pg?.sets||[];
      if(sets.length < 2) return;
      const sorted = [...sets].sort((a,b)=>parseFloat(b.kg||0)-parseFloat(a.kg||0));
      const maxKg = parseFloat(sorted[0]?.kg||0);
      const semana1Sets = sets.filter(s=>s.week===0);
      const semanaUltSets = sets.filter(s=>s.week===Math.max(...sets.map(s2=>s2.week||0)));
      if(!semana1Sets.length||!semanaUltSets.length) return;
      const kgS1 = Math.max(...semana1Sets.map(s=>parseFloat(s.kg||0)));
      const kgSU = Math.max(...semanaUltSets.map(s=>parseFloat(s.kg||0)));
      const pct = kgS1>0 ? Math.round((kgSU-kgS1)/kgS1*100) : 0;
      // PR: máximo de todos los sets es del set más reciente
      const lastSet = sets[0];
      if(lastSet&&parseFloat(lastSet.kg||0)>=maxKg&&sets.length>1) {
        const exInfo = (routines.flatMap(r=>r.days||[]).flatMap(d=>[...(d.exercises||[]),...(d.warmup||[])]).find(e=>e?.id===exId));
        if(!prReciente) prReciente = {exId, kg:maxKg, nombre:exInfo?.name||exId};
      }
      if(pct>mejorPct) mejorPct = pct;
      // Caída: última semana bajó vs semana anterior
      if(semanaUltSets.length&&kgSU<kgS1&&!ejercicioCaida) {
        const exInfo2 = routines.flatMap(r=>r.days||[]).flatMap(d=>[...(d.exercises||[]),...(d.warmup||[])]).find(e=>e?.id===exId);
        ejercicioCaida = exInfo2?.name||null;
      }
    });`,
  `// FIX 5: usar progresoGlobal (datos reales de Supabase) en vez de a.progress
                const regsAlumno = progresoGlobal[a.id] || [];
                if(regsAlumno.length > 0) {
                  const porEjercicio = {};
                  regsAlumno.forEach(reg => {
                    const exId2 = reg.ejercicio_id;
                    if(!exId2) return;
                    if(!porEjercicio[exId2]) porEjercicio[exId2] = [];
                    porEjercicio[exId2].push({ kg: parseFloat(reg.kg)||0, reps: parseInt(reg.reps)||0, fecha: reg.fecha||'' });
                  });
                  Object.entries(porEjercicio).forEach(([exId, registros]) => {
                    if(registros.length < 2) return;
                    const sorted = [...registros].sort((x, y) => y.kg - x.kg);
                    const maxKg = sorted[0].kg;
                    const parseF = (f) => { const p = (f||'').split('/'); return p.length===3 ? new Date(parseInt(p[2]),parseInt(p[1])-1,parseInt(p[0])) : new Date(f||0); };
                    const byDate = [...registros].sort((x, y) => parseF(x.fecha) - parseF(y.fecha));
                    const primero = byDate[0]; const ultimo = byDate[byDate.length - 1];
                    const pct = primero.kg > 0 ? Math.round((ultimo.kg - primero.kg) / primero.kg * 100) : 0;
                    if(pct > mejorPct) mejorPct = pct;
                    if(ultimo.kg >= maxKg && registros.length > 1) {
                      const exInfo = EX.find(e => e.id === exId);
                      if(!prReciente) prReciente = { exId, kg: maxKg, nombre: exInfo?.name || exId };
                    }
                    if(ultimo.kg < primero.kg * 0.9 && !ejercicioCaida) {
                      const exInfo2 = EX.find(e => e.id === exId);
                      ejercicioCaida = exInfo2?.name || null;
                    }
                  });
                }`
);

// ============================================================================
// FIX 6 — HistorialSesiones: usar sesiones de props si están disponibles
// ============================================================================
aplicarFix(
  'FIX 6: HistorialSesiones usa props primero',
  `React.useEffect(()=>{
    const load = async () => {
      try {
        const rutData = JSON.parse(atob(sharedParam));
        const alumnoId = rutData.alumnoId;
        if(alumnoId) {
          const ses = await sb.getSesiones(alumnoId);
          setSesionesData(ses||[]);
        }
      } catch(e) {}
      setLoading(false);
    };
    load();
  },[]);`,
  `React.useEffect(()=>{
    // FIX 6: usar sesiones de props si ya están disponibles
    if(sesiones && sesiones.length > 0) {
      setSesionesData(sesiones);
      setLoading(false);
      return;
    }
    // Fallback: cargar desde Supabase
    const load = async () => {
      try {
        const rutData = JSON.parse(atob(sharedParam));
        const alumnoId = rutData.alumnoId;
        if(alumnoId) {
          const ses = await sb.getSesiones(alumnoId);
          setSesionesData(ses||[]);
        }
      } catch(e) {}
      setLoading(false);
    };
    load();
  },[sesiones]);`
);

// ============================================================================
// GUARDAR
// ============================================================================
if (fixesAplicados === 0) {
  console.log('\n❌ No se pudo aplicar ningún fix. Verificá que el archivo sea el correcto.');
  process.exit(1);
}

// Backup
const backupPath = archivo + '.backup';
fs.writeFileSync(backupPath, original, 'utf8');
console.log(`\n📦 Backup guardado en: ${backupPath}`);

// Guardar archivo patcheado
fs.writeFileSync(archivo, code, 'utf8');
console.log(`\n✅ ${fixesAplicados} fixes aplicados exitosamente en: ${archivo}`);
console.log('\n📋 Próximos pasos:');
console.log('   1. Corré: npm run dev');
console.log('   2. Probá logueándote como alumno y registrando un set');
console.log('   3. Verificá en Supabase que aparezca en tabla "progreso"');
console.log('   4. Si todo funciona: git add . && git commit -m "fix: progreso, sesiones, gráfico" && git push');
