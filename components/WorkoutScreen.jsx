import React from 'react';
import { WorkoutExercisePanel } from './WorkoutExercisePanel.jsx';
import { normalizeFecha } from '../lib/normalizeFecha.js';
import { resolveExerciseTitle } from '../lib/exerciseResolve.js';

export function WorkoutScreen(props) {
  const {
    session, activeDay, activeR, allEx, progress, logSet, startTimer, timer,
    setSession, setCompletedDays, completedDays, currentWeek, setCurrentWeek,
    preSessionPRs, setResumenSesion, readOnly, sharedParam, sb, es, darkMode,
    prCelebration, setPrCelebration, activeExIdx, setActiveExIdx, sessionData,
    onSesionGuardada, sessionPRList, videoOverrides, setVideoModal,
  } = props;

  const _dm   = typeof darkMode !== "undefined" ? darkMode : true;
  const bg      = _dm ? "#0B1220" : "#F0F4F8";
  const bgCard  = _dm ? "#111E33" : "#FFFFFF";
  const bgSub   = _dm ? "#162234" : "#EEF2F7";
  const border  = _dm ? "rgba(45,64,87,.8)"  : "#E2E8F0";
  const border2 = _dm ? "rgba(148,163,184,.2)" : "#CBD5E1";
  const textMain  = _dm ? "#F1F5F9" : "#0F1923";
  const textMuted = _dm ? "#8B9AB2" : "#64748B";
  const blue    = "#2563EB";
  const green   = "#22C55E";

  const hoy       = new Date().toLocaleDateString("es-AR");
  const exercises = activeDay?.exercises || [];
  const ex        = exercises[activeExIdx];
  const info      = ex ? allEx.find(e => e.id === ex.id) : null;
  const pat       = info
    ? ({ empuje:{icon:"E",color:blue}, traccion:{icon:"T",color:blue},
         rodilla:{icon:"R",color:green}, bisagra:{icon:"B",color:textMuted},
         core:{icon:"C",color:textMuted}, movilidad:{icon:"M",color:blue},
       }[info?.pattern] || { icon:"E", color:textMuted })
    : { icon:"E", color:textMuted };

  const setsHoy      = ex ? (progress[ex.id]?.sets||[]).filter(s => s.date===hoy && (s.week===undefined||s.week===currentWeek)) : [];
  const totalSets    = parseInt(ex?.sets) || 3;
  const setsRestantes = Math.max(0, totalSets - setsHoy.length);
  const setActualNum  = setsHoy.length + 1;
  const ultimoSet     = setsHoy[0];
  const pr            = ex ? (progress[ex.id]?.max || 0) : 0;

  const totalExDone = exercises.filter(e => (progress[e.id]?.sets||[]).some(s => s.date===hoy)).length;
  const pct = exercises.length > 0 ? (totalExDone / exercises.length) * 100 : 0;

  const nextEx   = exercises[activeExIdx + 1];
  const nextInfo = nextEx ? allEx.find(e => e.id === nextEx.id) : null;
  const nextDisplayName = nextEx ? resolveExerciseTitle(nextInfo || null, nextEx, es) : "";

  const [, setRestTick] = React.useState(0);
  React.useEffect(() => {
    if (!timer?.endAt) return;
    const id = setInterval(() => setRestTick(function (n) { return n + 1; }), 250);
    return function () { clearInterval(id); };
  }, [timer?.endAt]);
  const restRemaining = timer?.endAt
    ? Math.max(0, Math.round((timer.endAt - Date.now()) / 1000))
    : 0;

  // ── Finalizar (sin cambios de lógica) ─────────────────────────────
  const finalizarSesion = async () => {
    const r = activeR;
    const dayKey = session.rId + "-" + session.dIdx + "-w" + currentWeek;
    const newCompleted = completedDays.includes(dayKey) ? completedDays : [...completedDays, dayKey];
    const totalDays = r ? r.days.length : 1;
    const daysThisWeek = newCompleted.filter(k => k.startsWith(session.rId+"-") && k.endsWith("-w"+currentWeek)).length;
    setCompletedDays(newCompleted);
    const semanaParaGuardar = currentWeek + 1;
    const durMin = Math.round((Date.now() - (session.startTime || Date.now())) / 60000) || 1;
    const exsCompleted = [...(activeDay?.warmup||[]), ...(exercises||[])];
    const hoyFin = new Date().toLocaleDateString("es-AR");
    const volTotal = exsCompleted.reduce((acc, ex2) => {
      const s = (progress[ex2.id]?.sets||[]).filter(s => s.date===hoyFin);
      return acc + s.reduce((a, s2) => a + (s2.kg||0) * (s2.reps||0), 0);
    }, 0);
    const prsNuevos = exsCompleted.filter(ex2 => {
      const pg = progress[ex2.id];
      if (!pg) return false;
      const sHoy = (pg.sets||[]).filter(s => s.date===hoyFin);
      if (!sHoy.length) return false;
      const maxHoy = Math.max(...sHoy.map(s2 => s2.kg||0));
      if (maxHoy <= 0) return false;
      return maxHoy > (preSessionPRs[ex2.id] || 0);
    }).length;
    setResumenSesion({
      durMin, ejercicios: exsCompleted.length,
      totalSets: exsCompleted.reduce((a, e) => a + (parseInt(e.sets)||3), 0),
      volTotal: Math.round(volTotal), prsNuevos,
      diaLabel: activeDay.label || ("Dia " + (session.dIdx+1)),
      rutinaName: r?.name || "Entrenamiento", fecha: hoyFin,
    });
    setSession(null);
    if (readOnly && sharedParam) {
      try {
        const rutData = JSON.parse(atob(sharedParam));
        if (rutData.alumnoId) {
          const existentes = await sb.getSesiones(rutData.alumnoId);
          const yaExiste = (existentes||[]).some(s =>
            normalizeFecha(s.fecha)===normalizeFecha(hoyFin) && s.dia_idx===session.dIdx && s.semana===semanaParaGuardar
          );
          if (!yaExiste) {
            sb.addSesion({ alumno_id:rutData.alumnoId, rutina_nombre:r?.name||"",
              dia_label:activeDay.label||("Dia "+(session.dIdx+1)), dia_idx:session.dIdx,
              semana:semanaParaGuardar, ejercicios:exercises.map(e=>e.id).join(","),
              fecha:hoyFin, hora:new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"}) });
          }
        }
      } catch(e) {}
    }
    if (!readOnly && sessionData?.role==="alumno" && sessionData?.alumnoId) {
      try {
        const existentes = await sb.getSesiones(sessionData.alumnoId);
        const yaExiste = (existentes||[]).some(s =>
          normalizeFecha(s.fecha)===normalizeFecha(hoyFin) && s.dia_idx===session.dIdx && s.semana===semanaParaGuardar
        );
        if (!yaExiste) {
          const resSesion = await sb.addSesion({
            alumno_id:sessionData.alumnoId, rutina_id:r?.id||null, rutina_nombre:r?.name||"",
            dia_label:activeDay.label||("Dia "+(session.dIdx+1)), dia_idx:session.dIdx,
            semana:semanaParaGuardar, ejercicios:exercises.map(e=>e.id).join(","),
            fecha:hoyFin, hora:new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"}),
          });
          if (resSesion && resSesion[0]) console.log("[addSesion] OK:", resSesion[0].id);
          if (typeof onSesionGuardada === "function") onSesionGuardada();
        }
      } catch(e) { console.error("[addSesion]", e); }
    }
    const lastAdvance = localStorage.getItem("it_last_week_advance_date");
    const todayStr = new Date().toDateString();
    if (daysThisWeek >= totalDays && currentWeek < 3 && lastAdvance !== todayStr) {
      setCompletedDays(prev => prev.filter(k => !k.endsWith("-w"+currentWeek)));
      setCurrentWeek(currentWeek + 1);
      localStorage.setItem("it_last_week_advance_date", todayStr);
    }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:bg, zIndex:80, display:"flex", flexDirection:"column", overflow:"hidden" }}>

      {/* ── Header ── */}
      <div style={{ background:bgCard, borderBottom:`2px solid ${blue}`, padding:"10px 16px 10px", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
          <button
            className="hov"
            onClick={() => {
              if (window.confirm(es ? "¿Salir del entrenamiento? Perderás los sets no guardados." : "Exit workout? Unsaved sets will be lost.")) {
                setSession(null);
              }
            }}
            style={{
              background:"transparent", border:`1px solid ${border2}`,
              borderRadius:10, width:36, height:36,
              display:"flex", alignItems:"center", justifyContent:"center",
              cursor:"pointer", color:textMuted, flexShrink:0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M10 3L5 8L10 13"/>
            </svg>
          </button>

          <div style={{ flex:1 }}>
            <div style={{ fontSize:10, fontWeight:700, color:blue, letterSpacing:1.5, textTransform:"uppercase" }}>
              {es ? "Entrenando" : "Training"}
            </div>
            <div style={{ fontSize:15, fontWeight:900, color:textMain }}>
              {activeR?.name} — {activeDay.label || ("Día " + (session.dIdx+1))}
            </div>
          </div>

          <div style={{
            fontSize:13, fontWeight:800, color:blue,
            background:"rgba(37,99,235,.12)", border:`1px solid rgba(37,99,235,.2)`,
            borderRadius:20, padding:"4px 12px",
          }}>
            {totalExDone}/{exercises.length}
          </div>
        </div>

        {/* Barra de progreso */}
        <div style={{ height:4, background:_dm?"rgba(45,64,87,.6)":"#E2E8F0", borderRadius:2, overflow:"hidden" }}>
          <div style={{ height:"100%", width:pct+"%", background:blue, borderRadius:2, transition:"width .5s ease" }}/>
        </div>
      </div>

      {/* ── Timer de descanso — circular ── */}
      {timer && (
        <div style={{
          position:"absolute", inset:0, zIndex:90,
          background:"rgba(10,18,40,.96)",
          display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center", gap:16,
        }}>
          <div style={{ fontSize:11, fontWeight:700, color:textMuted, letterSpacing:1.2, textTransform:"uppercase" }}>
            {es ? "Descanso" : "Rest"}
          </div>

          {/* SVG circular */}
          <div style={{ position:"relative", width:180, height:180 }}>
            <svg width="180" height="180" viewBox="0 0 180 180" style={{ transform:"rotate(-90deg)" }}>
              <circle cx="90" cy="90" r="80" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="10"/>
              <circle
                cx="90" cy="90" r="80" fill="none"
                stroke={restRemaining > timer.total * 0.5 ? green : restRemaining > timer.total * 0.25 ? "#F59E0B" : "#EF4444"}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 80}`}
                strokeDashoffset={`${2 * Math.PI * 80 * (1 - (timer.total - restRemaining) / Math.max(timer.total, 1))}`}
                style={{ transition:"stroke-dashoffset .1s linear, stroke .5s ease" }}
              />
            </svg>
            <div style={{
              position:"absolute", inset:0,
              display:"flex", flexDirection:"column",
              alignItems:"center", justifyContent:"center",
            }}>
              <div style={{ fontSize:44, fontWeight:900, color:textMain, lineHeight:1 }}>
                {Math.floor(restRemaining/60)}:{String(restRemaining%60).padStart(2,"0")}
              </div>
              <div style={{ fontSize:11, fontWeight:700, color:textMuted, letterSpacing:1, textTransform:"uppercase", marginTop:4 }}>
                {es ? "restante" : "remaining"}
              </div>
            </div>
          </div>

          {nextEx && (
            <div style={{ fontSize:14, color:textMuted, textAlign:"center" }}>
              {es ? "Próximo:" : "Next up:"}{" "}
              <strong style={{ color:textMain }}>{nextDisplayName}</strong>
            </div>
          )}

          <button
            className="hov"
            onClick={() => startTimer(0)}
            style={{
              padding:"10px 28px", borderRadius:12,
              background:"transparent", border:`1px solid ${border2}`,
              color:textMain, fontSize:13, fontWeight:700,
              fontFamily:"inherit", cursor:"pointer",
            }}
          >
            {es ? "Saltar descanso →" : "Skip rest →"}
          </button>
        </div>
      )}

      {/* ── Dots — progreso por ejercicio ── */}
      <div style={{ display:"flex", gap:6, padding:"10px 16px 4px", flexShrink:0, overflowX:"auto" }}>
        {exercises.map((e, i) => {
          const done   = (progress[e.id]?.sets||[]).filter(s => s.date===hoy).length >= (parseInt(e.sets)||3);
          const active = i === activeExIdx;
          return (
            <button
              key={i}
              onClick={() => setActiveExIdx(i)}
              style={{
                flexShrink:0,
                height:5, borderRadius:3,
                width: active ? 24 : done ? 24 : 14,
                border:"none", cursor:"pointer",
                background: done ? green : active ? blue : (_dm ? "rgba(45,64,87,.8)" : "#CBD5E1"),
                transition:"all .25s ease",
                padding:0,
              }}
            />
          );
        })}
      </div>

      {/* ── Contenido scrollable ── */}
      <div style={{ flex:1, overflowY:"auto", padding:"10px 16px 0", WebkitOverflowScrolling:"touch" }}>

        {ex && (
          <WorkoutExercisePanel
            activeExIdx={activeExIdx}
            setActiveExIdx={setActiveExIdx}
            exercises={exercises}
            ex={ex} info={info} pat={pat}
            setsHoy={setsHoy} totalSets={totalSets}
            setsRestantes={setsRestantes} setActualNum={setActualNum}
            ultimoSet={ultimoSet} pr={pr}
            es={es} darkMode={darkMode}
            bgCard={bgCard} bgSub={bgSub} border={border}
            textMain={textMain} textMuted={textMuted}
            sessionPRList={sessionPRList}
            videoOverrides={videoOverrides} setVideoModal={setVideoModal}
            logSet={logSet} startTimer={startTimer}
            setPrCelebration={setPrCelebration} progress={progress}
          />
        )}

        {/* ── Siguiente ejercicio — más prominente ── */}
        {nextEx && nextInfo && (
          <div style={{
            background: _dm ? "rgba(13,21,32,.9)" : "#F8FAFC",
            borderRadius:12, padding:"12px 14px", marginBottom:12,
            border:`1px solid ${border}`,
            display:"flex", alignItems:"center", gap:12,
            cursor:"pointer",
          }}
            onClick={() => setActiveExIdx(activeExIdx + 1)}
          >
            <div style={{ width:3, height:36, borderRadius:2, background:border2, flexShrink:0 }}/>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:10, fontWeight:700, color:textMuted, letterSpacing:1, textTransform:"uppercase", marginBottom:3 }}>
                {es ? "Siguiente" : "Next up"}
              </div>
              <div style={{ fontSize:15, fontWeight:700, color:textMain }}>
                {es ? nextInfo.name : nextInfo.nameEn||nextInfo.name}
              </div>
              <div style={{ fontSize:12, color:textMuted, marginTop:2 }}>
                {nextInfo.muscle||""} · {nextEx.sets}×{nextEx.reps}{nextEx.kg ? " · "+nextEx.kg+"kg" : ""}
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={textMuted} strokeWidth="2" strokeLinecap="round">
              <path d="M6 3l5 5-5 5"/>
            </svg>
          </div>
        )}
      </div>

      {/* ── Botón finalizar ── */}
      <div style={{ padding:"10px 16px 24px", flexShrink:0, background:bgCard, borderTop:`1px solid ${border}` }}>
        <button
          className="hov"
          onClick={finalizarSesion}
          style={{
            width:"100%", padding:"16px",
            background:blue, color:"#fff",
            border:"none", borderRadius:14,
            fontSize:16, fontWeight:900,
            cursor:"pointer", fontFamily:"inherit",
            letterSpacing:.5, textTransform:"uppercase",
            display:"flex", alignItems:"center", justifyContent:"center", gap:8,
            minHeight:56,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          {es ? "FINALIZAR ENTRENAMIENTO" : "FINISH WORKOUT"}
        </button>
      </div>
    </div>
  );
}
