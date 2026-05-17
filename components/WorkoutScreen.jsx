import React, { useState } from 'react';
import { DeleteConfirmModal } from './DeleteConfirmModal.jsx';
import { WorkoutExercisePanel } from './WorkoutExercisePanel.jsx';
import { resolveExerciseTitle } from '../lib/exerciseResolve.js';
import RestTimer from './workout/RestTimer.jsx';
import {
  buildCompletedDayKey,
  buildSessionPayload,
  buildWorkoutSummary,
  calculateDayProgress,
  countCompletedDaysForWeek,
  getWorkoutExerciseStatus,
  mergeCompletedDay,
  removeUndefinedPayloadFields,
  sessionAlreadyExists,
} from '../lib/workoutSession.js';

export function WorkoutScreen(props) {
  const {
    session, activeDay, activeR, allEx, progress, logSet, startTimer, timer,
    setSession, setCompletedDays, completedDays, currentWeek, setCurrentWeek,
    preSessionPRs, setResumenSesion, readOnly, sharedParam, sb, es, darkMode,
    prCelebration, setPrCelebration, activeExIdx, setActiveExIdx, sessionData,
    onSesionGuardada, sessionPRList, videoOverrides, setVideoModal,
  } = props;

  const [exitWorkoutOpen, setExitWorkoutOpen] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [showHeader, setShowHeader] = useState(true);
  const [isCompact, setIsCompact] = useState(false);
  const scrollFrame = React.useRef(null);
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

  const exerciseStatus = getWorkoutExerciseStatus({
    exercise: ex,
    progress: progress,
    date: hoy,
    currentWeek: currentWeek,
  });
  const setsHoy = exerciseStatus.setsToday;
  const totalSets = exerciseStatus.totalSets;
  const setsRestantes = exerciseStatus.remainingSets;
  const setActualNum = exerciseStatus.currentSetNumber;
  const ultimoSet = exerciseStatus.lastSet;
  const pr = exerciseStatus.pr;

  const dayProgress = calculateDayProgress(exercises, progress, hoy, currentWeek, { checkWeek: false });
  const totalExDone = dayProgress.done;
  const pct = dayProgress.pct;

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

  React.useEffect(() => {
    return function () {
      if (scrollFrame.current != null && typeof cancelAnimationFrame !== "undefined") {
        cancelAnimationFrame(scrollFrame.current);
      }
    };
  }, []);

  const handleWorkoutScroll = (e) => {
    const nextY = e.currentTarget.scrollTop || 0;
    if (scrollFrame.current != null) return;
    scrollFrame.current = requestAnimationFrame(function () {
      scrollFrame.current = null;
      setLastScrollY(function (prevY) {
        const scrollingDown = nextY > prevY;
        const delta = Math.abs(nextY - prevY);
        setIsCompact(nextY > 40);
        if (nextY < 12) {
          setShowHeader(true);
        } else if (delta > 8) {
          setShowHeader(!scrollingDown || nextY < 120);
        }
        return nextY;
      });
    });
  };

  // ── Finalizar (sin cambios de lógica) ─────────────────────────────
  const finalizarSesion = async () => {
    const r = activeR;
    const dayKey = buildCompletedDayKey(session, currentWeek);
    const newCompleted = mergeCompletedDay(completedDays, dayKey);
    const totalDays = r ? r.days.length : 1;
    const daysThisWeek = countCompletedDaysForWeek(newCompleted, session.rId, currentWeek);
    setCompletedDays(newCompleted);
    const semanaParaGuardar = currentWeek + 1;
    const hoyFin = new Date().toLocaleDateString("es-AR");
    const horaFin = new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
    setResumenSesion(buildWorkoutSummary({
      session: session,
      activeDay: activeDay,
      activeRoutine: r,
      progress: progress,
      preSessionPRs: preSessionPRs,
      date: hoyFin,
      now: Date.now(),
    }));
    setSession(null);
    if (readOnly && sharedParam) {
      try {
        const rutData = JSON.parse(atob(sharedParam));
        if (rutData.alumnoId) {
          const existentes = await sb.getSesiones(rutData.alumnoId);
          const yaExiste = sessionAlreadyExists(existentes, hoyFin, session.dIdx, semanaParaGuardar);
          if (!yaExiste) {
            sb.addSesion(removeUndefinedPayloadFields(buildSessionPayload({
              alumnoId: rutData.alumnoId,
              session: session,
              activeDay: activeDay,
              activeRoutine: r,
              exercises: exercises,
              weekToSave: semanaParaGuardar,
              date: hoyFin,
              time: horaFin,
              includeRoutineId: false,
            })));
          }
        }
      } catch(e) {}
    }
    if (!readOnly && sessionData?.role==="alumno" && sessionData?.alumnoId) {
      try {
        const existentes = await sb.getSesiones(sessionData.alumnoId);
        const yaExiste = sessionAlreadyExists(existentes, hoyFin, session.dIdx, semanaParaGuardar);
        if (!yaExiste) {
          await sb.addSesion(removeUndefinedPayloadFields(buildSessionPayload({
            alumnoId: sessionData.alumnoId,
            session: session,
            activeDay: activeDay,
            activeRoutine: r,
            exercises: exercises,
            weekToSave: semanaParaGuardar,
            date: hoyFin,
            time: horaFin,
            includeRoutineId: true,
          })));
          if (typeof onSesionGuardada === "function") onSesionGuardada();
        }
      } catch(e) { console.error("[addSesion]", e); }
    }
    const lastAdvance = localStorage.getItem("it_last_week_advance_date");
    const todayStr = new Date().toDateString();
    if (daysThisWeek >= totalDays && currentWeek < 3 && lastAdvance !== todayStr) {
      if (!readOnly && sessionData?.role==="alumno" && sessionData?.alumnoId && r?.id && typeof sb.updateRutina === "function") {
        try {
          await sb.updateRutina(r.id, {
            nombre: r.name || r.nombre || "Rutina",
            alumno_id: sessionData.alumnoId,
            entrenador_id: r.entrenador_id || sessionData.entrenadorId || "entrenador_principal",
            datos: Object.assign({}, r.datos || {}, {
              days: r.days || (r.datos && r.datos.days) || [],
              semana_activa: currentWeek + 2,
            }),
          });
        } catch (e) {
          console.error("[advance active week]", e);
        }
      }
      setCompletedDays(prev => prev.filter(k => !k.endsWith("-w"+currentWeek)));
      setCurrentWeek(currentWeek + 1);
      localStorage.setItem("it_last_week_advance_date", todayStr);
    }
  };

  return (
    <div style={{ position:"fixed", inset:0, minHeight:"100svh", background:bg, zIndex:80, display:"flex", flexDirection:"column", overflow:"hidden" }}>

      {/* ── Header ── */}
      <div style={{
        position:"fixed",
        top:0,
        left:0,
        right:0,
        zIndex:85,
        background:bgCard,
        borderBottom:`2px solid ${blue}`,
        paddingTop:"calc(env(safe-area-inset-top, 0px) + 10px)",
        paddingRight:16,
        paddingBottom:isCompact ? 7 : 10,
        paddingLeft:16,
        flexShrink:0,
        transform:showHeader ? "translateY(0)" : "translateY(-100%)",
        opacity:showHeader ? 1 : 0,
        boxShadow:lastScrollY > 0 ? "0 10px 28px rgba(2,6,23,.18)" : "none",
        transition:"transform 0.25s ease, opacity 0.2s ease",
        willChange:"transform, opacity",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:isCompact ? 6 : 8 }}>
          <button
            className="hov"
            onClick={() => setExitWorkoutOpen(true)}
            style={{
              background:"transparent", border:`1px solid ${border2}`,
              borderRadius:10, width:44, height:44, minWidth:44, minHeight:44,
              display:"flex", alignItems:"center", justifyContent:"center",
              cursor:"pointer", color:textMuted, flexShrink:0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M10 3L5 8L10 13"/>
            </svg>
          </button>

          <div style={{ flex:1 }}>
            <div style={{ fontSize:isCompact ? 9 : 10, fontWeight:700, color:blue, letterSpacing:1.5, textTransform:"uppercase" }}>
              {es ? "Entrenando" : "Training"}
            </div>
            <div style={{ fontSize:isCompact ? 13 : 15, fontWeight:900, color:textMain, lineHeight:1.15 }}>
              {activeR?.name} — {activeDay.label || ("Día " + (session.dIdx+1))}
            </div>
          </div>

          <div style={{
            fontSize:isCompact ? 12 : 13, fontWeight:800, color:blue,
            background:"rgba(37,99,235,.12)", border:`1px solid rgba(37,99,235,.2)`,
            borderRadius:20, padding:isCompact ? "3px 10px" : "4px 12px",
          }}>
            {totalExDone}/{exercises.length}
          </div>
        </div>

        {/* Barra de progreso */}
        <div style={{ height:isCompact ? 3 : 4, background:_dm?"rgba(45,64,87,.6)":"#E2E8F0", borderRadius:2, overflow:"hidden" }}>
          <div style={{ height:"100%", width:pct+"%", background:blue, borderRadius:2, transition:"width .5s ease" }}/>
        </div>
      </div>

      <div aria-hidden style={{ height:"calc(env(safe-area-inset-top, 0px) + 104px)", minHeight:"calc(env(safe-area-inset-top, 0px) + 104px)", flexShrink:0 }} />

      <RestTimer
        active={!!timer}
        remainingSeconds={restRemaining}
        totalSeconds={timer?.total || 0}
        nextLabel={nextEx ? nextDisplayName : ""}
        es={es}
        green={green}
        border2={border2}
        textMain={textMain}
        textMuted={textMuted}
        onSkip={() => startTimer(0)}
      />

      {/* ── Dots — progreso por ejercicio ── */}
      <div style={{ display:"flex", gap:6, padding:"10px 16px 4px", flexShrink:0, overflowX:"auto" }}>
        {exercises.map((e, i) => {
          const done = getWorkoutExerciseStatus({
            exercise: e,
            progress: progress,
            date: hoy,
            currentWeek: currentWeek,
            checkWeek: false,
          }).isDone;
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
      <div onScroll={handleWorkoutScroll} style={{ flex:1, minHeight:0, overflowY:"auto", padding:"10px 16px 0", paddingBottom:"calc(16px + env(safe-area-inset-bottom, 0px))", WebkitOverflowScrolling:"touch" }}>

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
            currentWeek={currentWeek}
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
      <div style={{ padding:"10px 16px calc(24px + env(safe-area-inset-bottom, 0px))", flexShrink:0, background:bgCard, borderTop:`1px solid ${border}` }}>
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
      <DeleteConfirmModal
        zIndex={10000}
        open={exitWorkoutOpen}
        tone="caution"
        onCancel={function () {
          setExitWorkoutOpen(false);
        }}
        onConfirm={function () {
          setExitWorkoutOpen(false);
          setSession(null);
        }}
        title={es ? 'Salir del entrenamiento' : 'Exit workout'}
        message={
          es
            ? 'Vas a salir sin finalizar. Los sets aún no guardados en almacenamiento local se pueden perder.'
            : "You'll leave without finishing. Sets not yet stored locally may be lost."
        }
        confirmLabel={es ? 'Salir' : 'Exit'}
        cancelLabel={es ? 'Cancelar' : 'Cancel'}
        variant="workoutExit"
        loading={false}
      />
    </div>
  );
}
