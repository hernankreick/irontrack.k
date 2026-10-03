import React, { useRef, useState } from 'react';
import { WorkoutExercisePanel } from './WorkoutExercisePanel.jsx';
import { resolveExerciseTitle } from '../lib/exerciseResolve.js';
import WorkoutExitConfirmModal from './workout/WorkoutExitConfirmModal.jsx';
import RestTimer from './workout/RestTimer.jsx';
import WorkoutFinishSection from './workout/WorkoutFinishSection.jsx';
import WorkoutHeader from './workout/WorkoutHeader.jsx';
import WorkoutProgressStrip from './workout/WorkoutProgressStrip.jsx';
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
import { FINALIZE_FAILURE, createFinalizeGuard, finalizeStudentSession } from '../lib/finalizeWorkoutSession.js';

export function WorkoutScreen(props) {
  const {
    session, activeDay, activeR, allEx, progress, logSet, startTimer, timer,
    setSession, setCompletedDays, completedDays, currentWeek, setCurrentWeek,
    preSessionPRs, setResumenSesion, readOnly, sharedParam, sb, es, darkMode,
    prCelebration, setPrCelebration, activeExIdx, setActiveExIdx, sessionData,
    onSesionGuardada, sessionPRList, videoOverrides, setVideoModal, toast2,
  } = props;

  const [exitWorkoutOpen, setExitWorkoutOpen] = useState(false);
  // T01.2: guard de finalizacion en curso (ref = bloqueo inmediato; state = UI).
  const finalizeGuardRef = useRef(null);
  if (!finalizeGuardRef.current) finalizeGuardRef.current = createFinalizeGuard();
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState("");
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
  // Entrada en calor + bloque principal, en ese orden — igual que en el resto de las
  // pantallas (plan semanal, resumen). Antes solo se tomaba activeDay.exercises, así que
  // el entrenamiento activo arrancaba directo en el bloque principal y la entrada en
  // calor quedaba imposible de marcar desde esta pantalla.
  const exercises = [...(activeDay?.warmup || []), ...(activeDay?.exercises || [])];
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
  const workoutReadyToFinish = exercises.length > 0 && totalExDone >= exercises.length;

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

  // ── Finalizar ─────────────────────────────────────────────────────
  // Alumno logueado (T01.2): se persiste y CONFIRMA la sesion en `sesiones` ANTES de completar,
  // mostrar el resumen, cerrar o avanzar de semana. Si no se confirma, el entrenamiento sigue abierto.
  // Otros flujos (readOnly/compartido y entrenador): comportamiento previo.
  const finalizarSesion = async () => {
    if (finalizeGuardRef.current.isBusy()) return;
    const r = activeR;
    // La semana local (currentWeek) puede quedar desincronizada de la semana real de la
    // rutina (r.datos.semana_activa, la que persiste en el server) — por ejemplo si el
    // alumno vuelve a loguearse y se resetea el estado local. Si hay un valor persistido
    // válido, es la fuente de verdad: se usa para guardar la sesión y se re-sincroniza el
    // estado local, para no marcar el día completado bajo la semana equivocada.
    const persistedWeekNum = Number(r && r.datos && r.datos.semana_activa);
    const hasPersistedWeek = Number.isFinite(persistedWeekNum) && persistedWeekNum >= 1 && persistedWeekNum <= 4;
    const effectiveWeek = hasPersistedWeek ? (persistedWeekNum - 1) : currentWeek;
    const dayKey = buildCompletedDayKey(session, effectiveWeek);
    const newCompleted = mergeCompletedDay(completedDays, dayKey);
    const totalDays = r ? r.days.length : 1;
    const semanaParaGuardar = effectiveWeek + 1;
    const hoyFin = new Date().toLocaleDateString("es-AR");
    const horaFin = new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
    const buildSummary = () => buildWorkoutSummary({
      session: session,
      activeDay: activeDay,
      activeRoutine: r,
      progress: progress,
      preSessionPRs: preSessionPRs,
      date: hoyFin,
      now: Date.now(),
      weekToSave: semanaParaGuardar,
    });

    if (!readOnly && sessionData?.role==="alumno" && sessionData?.alumnoId) {
      if (!finalizeGuardRef.current.acquire()) return;
      setFinalizing(true);
      setFinalizeError("");
      try {
        const todayStr = new Date().toDateString();
        let lastAdvanceDate = null;
        try { lastAdvanceDate = localStorage.getItem("it_last_week_advance_date"); } catch (e) {}
        const outcome = await finalizeStudentSession({
          sb: sb,
          alumnoId: sessionData.alumnoId,
          payload: removeUndefinedPayloadFields(buildSessionPayload({
            alumnoId: sessionData.alumnoId,
            session: session,
            activeDay: activeDay,
            activeRoutine: r,
            exercises: exercises,
            weekToSave: semanaParaGuardar,
            date: hoyFin,
            time: horaFin,
            includeRoutineId: true,
          })),
          date: hoyFin,
          dayIndex: session.dIdx,
          weekToSave: semanaParaGuardar,
          isOnline: typeof navigator === "undefined" ? true : navigator.onLine !== false,
          effectiveWeek: effectiveWeek,
          totalDays: totalDays,
          lastAdvanceDate: lastAdvanceDate,
          todayStr: todayStr,
          rutinaId: r && r.id,
          rutinaNombre: r && r.name,
          updateRutinaWeek: function () {
            if (!r || !r.id || typeof sb.updateRutina !== "function") return null;
            return sb.updateRutina(r.id, {
              nombre: r.name || r.nombre || "Rutina",
              alumno_id: sessionData.alumnoId,
              entrenador_id: r.entrenador_id,
              datos: Object.assign({}, r.datos || {}, {
                days: r.days || (r.datos && r.datos.days) || [],
                semana_activa: effectiveWeek + 2,
              }),
            });
          },
        });

        if (outcome.status !== "saved") {
          const offline = outcome.reason === FINALIZE_FAILURE.OFFLINE;
          const text = offline
            ? (es ? "Necesitás conexión para finalizar. Tu entrenamiento sigue abierto. Intentá nuevamente cuando vuelva la conexión." : "You need a connection to finish. Your workout is still open. Try again when you are back online.")
            : (es ? "No pudimos guardar la finalización. Tu entrenamiento sigue abierto. Intentá nuevamente." : "We could not save your workout. It is still open. Please try again.");
          setFinalizeError(text);
          if (typeof toast2 === "function") toast2(es ? "Error al guardar la sesión" : "Error saving workout");
          return;
        }

        // Persistencia confirmada: recién ahora se aplican los efectos de "terminado".
        if (hasPersistedWeek && effectiveWeek !== currentWeek) {
          setCurrentWeek(effectiveWeek);
        }
        setCompletedDays(newCompleted);
        setResumenSesion(buildSummary());
        setSession(null);
        if (typeof onSesionGuardada === "function") {
          Promise.resolve().then(function () { return onSesionGuardada(); }).catch(function (e) {
            console.error("[onSesionGuardada]", e);
          });
        }
        if (outcome.week.advance === "ok") {
          setCompletedDays(prev => prev.filter(k => !k.endsWith("-w"+effectiveWeek)));
          setCurrentWeek(effectiveWeek + 1);
          try { localStorage.setItem("it_last_week_advance_date", todayStr); } catch (e) {}
        } else if (outcome.week.advance === "failed" || outcome.week.advance === "unverified") {
          // La sesion YA esta guardada y sigue COMPLETADA; solo falto el avance de semana.
          console.error("[advance active week] no confirmado:", outcome.week.advance);
          if (typeof toast2 === "function") toast2(es ? "Sesión guardada ✓ · Error al avanzar de semana" : "Workout saved ✓ · Error advancing week");
        }
      } catch (e) {
        console.error("[finalizarSesion]", e);
        setFinalizeError(es ? "No pudimos guardar la finalización. Tu entrenamiento sigue abierto. Intentá nuevamente." : "We could not save your workout. It is still open. Please try again.");
      } finally {
        finalizeGuardRef.current.release();
        setFinalizing(false);
      }
      return;
    }

    // ── Flujo previo (readOnly/compartido y entrenador) ──
    if (hasPersistedWeek && effectiveWeek !== currentWeek) {
      setCurrentWeek(effectiveWeek);
    }
    const daysThisWeek = countCompletedDaysForWeek(newCompleted, session.rId, effectiveWeek);
    setCompletedDays(newCompleted);
    setResumenSesion(buildSummary());
    setSession(null);
    if (readOnly && sharedParam) {
      try {
        const rutData = JSON.parse(atob(sharedParam));
        if (rutData.alumnoId) {
          const existentes = await sb.getSesiones(rutData.alumnoId);
          const yaExiste = sessionAlreadyExists(existentes, hoyFin, session.dIdx, semanaParaGuardar);
          if (!yaExiste) {
            // .catch: evita un rechazo no manejado (sigue siendo fire-and-forget, sin cambios de flujo).
            Promise.resolve(sb.addSesion(removeUndefinedPayloadFields(buildSessionPayload({
              alumnoId: rutData.alumnoId,
              session: session,
              activeDay: activeDay,
              activeRoutine: r,
              exercises: exercises,
              weekToSave: semanaParaGuardar,
              date: hoyFin,
              time: horaFin,
              includeRoutineId: false,
            })))).catch(function (e) { console.error("[addSesion shared]", e); });
          }
        }
      } catch(e) {}
    }
    const lastAdvance = localStorage.getItem("it_last_week_advance_date");
    const todayStr = new Date().toDateString();
    if (daysThisWeek >= totalDays && effectiveWeek < 3 && lastAdvance !== todayStr) {
      setCompletedDays(prev => prev.filter(k => !k.endsWith("-w"+effectiveWeek)));
      setCurrentWeek(effectiveWeek + 1);
      localStorage.setItem("it_last_week_advance_date", todayStr);
    }
  };

  return (
    <div style={{ position:"fixed", inset:0, minHeight:"100svh", background:bg, zIndex:80, display:"flex", flexDirection:"column", overflow:"hidden" }}>

      <WorkoutHeader
        bgCard={bgCard}
        blue={blue}
        border2={border2}
        textMuted={textMuted}
        textMain={textMain}
        isCompact={isCompact}
        showHeader={showHeader}
        lastScrollY={lastScrollY}
        es={es}
        activeR={activeR}
        activeDay={activeDay}
        session={session}
        totalExDone={totalExDone}
        exercises={exercises}
        pct={pct}
        darkModeResolved={_dm}
        onBack={() => setExitWorkoutOpen(true)}
      />

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

      <WorkoutProgressStrip
        exercises={exercises}
        activeExIdx={activeExIdx}
        setActiveExIdx={setActiveExIdx}
        getExerciseStatus={(e) => getWorkoutExerciseStatus({
          exercise: e,
          progress: progress,
          date: hoy,
          currentWeek: currentWeek,
          checkWeek: false,
        })}
        green={green}
        blue={blue}
        darkModeResolved={_dm}
      />

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

        {workoutReadyToFinish && (
          <WorkoutFinishSection
            es={es}
            blue={blue}
            onFinish={finalizarSesion}
            saving={finalizing}
            errorMessage={finalizeError}
          />
        )}
      </div>
      <WorkoutExitConfirmModal
        open={exitWorkoutOpen}
        es={es}
        onCancel={function () {
          setExitWorkoutOpen(false);
        }}
        onConfirm={function () {
          setExitWorkoutOpen(false);
          setSession(null);
        }}
      />
    </div>
  );
}
