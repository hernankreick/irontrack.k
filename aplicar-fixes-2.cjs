// ============================================================================
// IRON TRACK — Script de fixes PARTE 2 (los que faltaron)
// ============================================================================
// USO: node aplicar-fixes-2.cjs App.jsx
// ============================================================================

const fs = require('fs');

const archivo = process.argv[2];
if (!archivo) {
  console.error('USO: node aplicar-fixes-2.cjs App.jsx');
  process.exit(1);
}

let code = fs.readFileSync(archivo, 'utf8');
const original = code;
let fixesAplicados = 0;

function aplicarFix(nombre, buscar, reemplazar) {
  if (code.includes(buscar)) {
    code = code.replace(buscar, reemplazar);
    fixesAplicados++;
    console.log(`✅ ${nombre}`);
  } else {
    console.log(`⚠️  ${nombre} — no encontrado`);
  }
}

// ============================================================================
// FIX 2 — finalizarSesion: hacerla async + anti-duplicados + semana capturada
// ============================================================================
// El bloque en WorkoutScreen (línea ~3407)
aplicarFix(
  'FIX 2A: finalizarSesion → async',
  `const finalizarSesion = () => {`,
  `const finalizarSesion = async () => {`
);

// Reemplazar el bloque de addSesion para readOnly (sharedParam)
aplicarFix(
  'FIX 2B: addSesion readOnly con semana capturada + anti-duplicados',
  `setSession(null);
    if(readOnly&&sharedParam){try{
      const rutData=JSON.parse(atob(sharedParam));
      if(rutData.alumnoId)sb.addSesion({alumno_id:rutData.alumnoId,rutina_nombre:r?.name||"",
        dia_label:activeDay.label||("Dia "+(session.dIdx+1)),dia_idx:session.dIdx,
        semana:currentWeek+1,ejercicios:exercises.map(e=>e.id).join(","),
        fecha:hoyFin,hora:new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})});
    }catch(e){}}`,
  `setSession(null);
    // FIX 2: capturar semana antes de cualquier setState
    const semanaParaGuardar = currentWeek + 1;
    if(readOnly&&sharedParam){try{
      const rutData=JSON.parse(atob(sharedParam));
      if(rutData.alumnoId){
        // FIX 2: check duplicados antes de guardar
        const sesExist = await sb.getSesiones(rutData.alumnoId);
        const dup = (sesExist||[]).some(s => s.fecha===hoyFin && s.dia_idx===session.dIdx && s.semana===semanaParaGuardar);
        if(!dup) {
          sb.addSesion({alumno_id:rutData.alumnoId,rutina_nombre:r?.name||"",
            dia_label:activeDay.label||("Dia "+(session.dIdx+1)),dia_idx:session.dIdx,
            semana:semanaParaGuardar,ejercicios:exercises.map(e=>e.id).join(","),
            fecha:hoyFin,hora:new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})});
        }
      }
    }catch(e){}}`
);

// ── Agregar bloque de addSesion para alumno LOGUEADO si no existe ────
// Buscar si ya existe el bloque para alumno logueado en finalizarSesion
if (!code.includes(`sessionData?.role==="alumno" && sessionData?.alumnoId`) ||
    // Verificar que esté DENTRO de finalizarSesion (WorkoutScreen), no en otro lado
    true) {
  
  // Insertar bloque de alumno logueado DESPUÉS del bloque readOnly
  aplicarFix(
    'FIX 2C: agregar addSesion para alumno logueado en WorkoutScreen',
    `}catch(e){}}
    // FIX 1: solo avanzar semana`,
    `}catch(e){}}
    // FIX 2C: guardar sesión para alumno LOGUEADO (no readOnly)
    if(!readOnly && sessionData?.role==="alumno" && sessionData?.alumnoId) {
      try {
        const sesExistLog = await sb.getSesiones(sessionData.alumnoId);
        const dupLog = (sesExistLog||[]).some(s => s.fecha===hoyFin && s.dia_idx===session.dIdx && s.semana===semanaParaGuardar);
        if(!dupLog) {
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
            console.log('[addSesion] sesion guardada:', resSesion[0].id);
            if(typeof onSesionGuardada === 'function') onSesionGuardada();
          }
        } else {
          console.log('[addSesion] duplicada, no se guarda');
        }
      } catch(e) { console.error('[addSesion]', e); }
    }
    // FIX 1: solo avanzar semana`
  );
}

// ============================================================================
// FIX 3B — GraficoProgreso: Promise.all + loading
// ============================================================================
// Tu código usa setSesionesLocal que NO existe. Arreglar eso también.
aplicarFix(
  'FIX 3B: Promise.all + loading + corregir setSesionesLocal',
  `React.useEffect(()=>{
    const alumnoId = sessionData?.alumnoId || (sharedParam?(()=>{try{return JSON.parse(atob(sharedParam)).alumnoId}catch(e){return null}})():null);
    if(!alumnoId) return;
    sb.getProgreso(alumnoId).then(d=>{ if(d) setSbData(d); });
    sb.getSesiones(alumnoId).then(d=>{ if(d) setSesionesLocal(d); });
  },[]);`,
  `React.useEffect(()=>{
    const alumnoId = sessionData?.alumnoId || (sharedParam?(()=>{try{return JSON.parse(atob(sharedParam)).alumnoId}catch(e){return null}})():null);
    if(!alumnoId) { setLoadingGrafico(false); return; }
    // FIX 3B: cargar en paralelo con loading state
    Promise.all([
      sb.getProgreso(alumnoId),
      sb.getSesiones(alumnoId),
    ]).then(([prog, ses]) => {
      if(prog) setSbData(prog);
      if(ses) setSesionesData(ses);
    }).finally(() => setLoadingGrafico(false));
  },[]);`
);

// ============================================================================
// FIX EXTRA — Bloque inline que avanza semana SIEMPRE (línea ~2570)
// ============================================================================
// Este bloque está en GymApp (NO en WorkoutScreen) y hace setCurrentWeek
// cada vez que se finaliza, sin check de fecha.
aplicarFix(
  'FIX EXTRA: bloque inline que avanza semana siempre → agregar check',
  `if(readOnly&&sharedParam){try{const rutData=JSON.parse(atob(sharedParam));const alumnoId=rutData.alumnoId;if(alumnoId){sb.addSesion({alumno_id:alumnoId,rutina_nombre:r?.name||"",dia_label:activeDay.label||("Dia "+(session.dIdx+1)),dia_idx:session.dIdx,semana:currentWeek+1,ejercicios:exsCompleted.map(e=>e.id).join(","),fecha:new Date().toLocaleDateString("es-AR"),hora:new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})});}}catch(e){}}
              // Avanzar SIEMPRE a la semana siguiente al terminar cada sesión
              if(currentWeek < 3){
                setCurrentWeek(currentWeek + 1);`,
  `if(readOnly&&sharedParam){try{const rutData=JSON.parse(atob(sharedParam));const alumnoId=rutData.alumnoId;if(alumnoId){sb.addSesion({alumno_id:alumnoId,rutina_nombre:r?.name||"",dia_label:activeDay.label||("Dia "+(session.dIdx+1)),dia_idx:session.dIdx,semana:currentWeek+1,ejercicios:exsCompleted.map(e=>e.id).join(","),fecha:new Date().toLocaleDateString("es-AR"),hora:new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})});}}catch(e){}}
              // FIX: solo avanzar semana si no se avanzó hoy ya
              const _lastAdv = localStorage.getItem('it_last_week_advance_date');
              const _hoyAdv = new Date().toDateString();
              if(currentWeek < 3 && (!_lastAdv || _lastAdv !== _hoyAdv)){
                setCurrentWeek(currentWeek + 1);
                localStorage.setItem('it_last_week_advance_date', _hoyAdv);`
);

// Si el texto tiene encoding raro (UTF-8 con Ã), intentar con esa variante
if (!code.includes('// Avanzar SIEMPRE a la semana siguiente al terminar cada sesi')) {
  aplicarFix(
    'FIX EXTRA (variante encoding): bloque inline semana',
    `// Avanzar SIEMPRE a la semana siguiente al terminar cada sesi`,
    `// FIX: solo avanzar semana si no se avanz`
  );
  // Buscar la variante con encoding Windows
  const variants = [
    'Avanzar SIEMPRE',
    'Avanzar SIEMPRE a la semana'
  ];
  // Intentar reemplazar el if sin check
  if (code.includes('if(currentWeek < 3){\n                setCurrentWeek(currentWeek + 1);')) {
    // ya se aplicó arriba
  }
}

// ============================================================================
// GUARDAR
// ============================================================================
if (fixesAplicados === 0) {
  console.log('\n❌ No se pudo aplicar ningún fix adicional.');
  process.exit(1);
}

const backupPath = archivo + '.backup2';
fs.writeFileSync(backupPath, original, 'utf8');
console.log(`\n📦 Backup guardado en: ${backupPath}`);

fs.writeFileSync(archivo, code, 'utf8');
console.log(`✅ ${fixesAplicados} fixes adicionales aplicados en: ${archivo}`);
console.log('\n📋 Ahora corré: npm run dev');
console.log('   Si compila bien, probá logueándote como alumno.');
