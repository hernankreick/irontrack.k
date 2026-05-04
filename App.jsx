import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { PATS, EX, VIDEOS, IMGS } from './lib/exerciseStaticData.js';
import { Ic } from './components/Ic.jsx';
import { LogForm } from './components/LogForm.jsx';
import { RutinaView } from './components/RutinaView.jsx';
import { WorkoutScreen } from './components/WorkoutScreen.jsx';
import { Chat } from './components/Chat.jsx';
import { ChatFlotante } from './components/ChatFlotante.jsx';
import AlumnoRestTimerBar from './components/student/AlumnoRestTimerBar.jsx';
import { useAlumnos } from './hooks/useAlumnos.js';
import {
  BIB_MUSCLE_OPTIONS,
  BIB_MUSCLE_ORDER,
  bibMuscleFilterHaystack,
  cleanActiveCoachAlumnos,
  formatBibMuscleDisplay,
  isValidUuid,
} from './lib/appHelpers.js';
import { ROUTINE_TEMPLATES, instantiateTemplate, emptyDays, getTemplateById } from './lib/routineTemplates.js';
import { getYTVideoId, getYoutubeEmbedSrc } from './lib/getYTVideoId.js';
import { createPortal } from 'react-dom';
import { resolveExerciseTitle, resolveVideoUrl, normalizeLibraryExercise, pickVideoUrl, isValidHttpUrlString, sanitizeRoutineDaysForWrite, sanitizeExerciseSnapshotForWrite } from './lib/exerciseResolve.js';
import { fmt, fmtP } from './lib/timeFormat.js';
import { getTheme } from './lib/uiHelpers.js';
import { exportRoutinePdfHtml } from './lib/routinePdfExport.js';
import { generarSugerenciasAlumno } from './lib/sugerenciasAlumno.js';
import {
  BLUE_GRAD,
  BTN_H,
  C,
  GLOW,
  GLOW_G,
  GREEN_GRAD,
  ONBOARD_PREMIUM_BG,
  ONBOARD_PREMIUM_CARD,
  ONBOARD_PROFILE_H_PAD,
  ONBOARD_PROFILE_WRAP,
} from './lib/onboardingTokens.js';
import {
  AthleteSVG,
  ArrowSVG,
  BackArrowSVG,
  BtnBack,
  BtnPrimary,
  BtnRow,
  CalSVG,
  CheckSVG,
  CoachSVG,
  Dots,
  InfoSVG,
  OnboardingProgress3,
  PersonSVG,
  Tag,
  TrendSVG,
  UserOneSVG,
  UserTeamSVG,
} from './components/onboarding/OnboardingPrimitives.jsx';
import OnboardingScreen from './components/onboarding/OnboardingScreen.jsx';
import AtencionHoy from "./components/AtencionHoy/AtencionHoy";
import CoachDashboard from './components/CoachDashboard';
import CoachCalendar from './components/CoachCalendar.jsx';
import { coachInitialsFromFullName } from './components/coachUiScale.js';
import DesktopSidebar, { useDesktopMin1024 } from './components/DesktopSidebar.jsx';
import IronTrackLogo from './components/IronTrackLogo.jsx';
import IronTrackAppIcon from './components/IronTrackAppIcon.jsx';
import IronTrackSplash from './components/IronTrackSplash.jsx';
import LibraryAlumno from './components/student/LibraryAlumno.jsx';
import PagoAlumno from './components/student/PagoAlumno.jsx';
import StudentProgressSection from './components/student-progress/StudentProgressSection.jsx';
import FotosSlider from './components/student-progress/FotosSlider.jsx';
import GraficoProgreso from './components/student-progress/GraficoProgreso.jsx';
import { CurrentWorkoutHero } from './components/student-plan/CurrentWorkoutHero.jsx';
import { WeeklyPlanDayCard } from './components/student-plan/WeeklyPlanDayCard.jsx';
import { ExerciseVideoPlayButton } from './components/ExerciseVideoPlayButton.jsx';
import EditExModal from './components/routines/EditExModal.jsx';
import {
  estimateDayMinutes,
  countExercisesWithLogToday,
} from './components/student-plan/studentPlanHelpers.js';
import { WelcomeModal } from './components/WelcomeModal.jsx';
import { DeleteConfirmModal } from './components/DeleteConfirmModal.jsx';
import LoginForm from './components/auth/LoginForm.jsx';
import SettingsPage, { applyItPrefsToDocument } from './components/settings/SettingsPage.jsx';
import { supabase } from './lib/supabaseClient.js';
import { clearIronTrackStorageForNewLogin, clearAllIronTrackPrefixedKeys } from './lib/irontrackLocalStorage.js';
import { irontrackMsg, localeForSort, pickExerciseName } from './lib/irontrackMsg.js';
import { IronTrackI18nProvider, useIronTrackI18n } from './contexts/IronTrackI18nContext.jsx';
import { Calendar as CalNavIcon, CalendarDays, Dumbbell, Download as DownloadNavIcon, TrendingUp as TrendNavIcon } from 'lucide-react';
import { usePWAInstall } from './hooks/usePWAInstall.js';


const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function getStoredEntrenadorId() {
  try {
    return JSON.parse(localStorage.getItem("it_session") || "null")?.entrenadorId || "entrenador_principal";
  } catch (e) {
    return "entrenador_principal";
  }
}

async function getActiveSupabaseSession() {
  if (!supabase || !supabase.auth || typeof supabase.auth.getSession !== "function") return null;
  try {
    var result = await supabase.auth.getSession();
    if (result && result.error) {
      console.error("[AUTH] getSession error", result.error);
      return null;
    }
    return result && result.data ? result.data.session : null;
  } catch (e) {
    console.error("[AUTH] getSession exception", e);
    return null;
  }
}

function cleanRutinaWriteBody(data) {
  var src = data || {};
  return {
    alumno_id: src.alumno_id || null,
    entrenador_id: src.entrenador_id != null ? String(src.entrenador_id) : null,
    nombre: src.nombre || "Rutina",
    datos: src.datos || {},
  };
}

const sbFetch = async (path, method="GET", body=null) => {
  var activeSession = await getActiveSupabaseSession();
  var accessToken = activeSession && activeSession.access_token ? activeSession.access_token : SB_KEY;
  const opts = { method, headers: { "apikey": SB_KEY, "Authorization": "Bearer "+accessToken, "Content-Type": "application/json", "Prefer": "return=representation" } };
  if(body) opts.body = JSON.stringify(body);
  const r = await fetch(SB_URL+"/rest/v1/"+path, opts);
  if(!r.ok) {
    var errText = "";
    try {
      errText = await r.text();
    } catch (e) {}
    console.error("[Supabase request error]", {
      path: path,
      method: method,
      status: r.status,
      body: body,
      error: errText || r.statusText,
    });
    return null;
  }
  const text = await r.text();
  return text ? JSON.parse(text) : null;
};

const sb = {
  getAlumnos: (entId) => sbFetch("alumnos?entrenador_id=eq."+entId+"&select=*"),
  createAlumno: (data) => sbFetch("alumnos", "POST", data),
  getRutinas: async (alumnoId) => {
    const { data, error } = await supabase.from("rutinas").select("*").eq("alumno_id", alumnoId);
    if (error) { console.error("[rutinas SELECT ERROR]", error); return null; }
    return data || [];
  },
  getRutinasByEntrenador: async (entId) => {
    const { data, error } = await supabase.from("rutinas").select("*").eq("entrenador_id", String(entId || getStoredEntrenadorId()));
    if (error) { console.error("[rutinas SELECT ERROR]", error); return null; }
    return data || [];
  },
  getRutinasByAlumnoIds: async (alumnoIds) => {
    var ids = (alumnoIds || []).map(function (id) { return String(id); }).filter(Boolean);
    if (ids.length === 0) return [];
    const { data, error } = await supabase.from("rutinas").select("*").in("alumno_id", ids);
    if (error) { console.error("[rutinas SELECT BY ALUMNOS ERROR]", error, { alumnoIds: ids }); return null; }
    return data || [];
  },
  createRutina: async (data) => {
    const body = cleanRutinaWriteBody(data);
    const { data: created, error } = await supabase.from("rutinas").insert([body]).select();
    if (error) { console.error("[rutinas INSERT ERROR]", error, { requestBody: body }); return null; }
    return created || [];
  },
  updateRutina: async (id, data) => {
    const body = cleanRutinaWriteBody(data);
    const { data: updated, error } = await supabase.from("rutinas").update(body).eq("id", id).select();
    if (error) { console.error("[rutinas UPDATE ERROR]", error, { requestBody: body, id: id }); return null; }
    return updated || [];
  },
  deleteRutina: async function (id) {
    const { error } = await supabase.from("rutinas").delete().eq("id", id);
    if (error) throw error;
  },
  getProgreso: (alumnoId) => sbFetch("progreso?alumno_id=eq."+alumnoId+"&select=*&order=created_at.desc"),
  addProgreso: (data) => sbFetch("progreso", "POST", data),
  deleteProgresoByAlumno: async (alumnoId) => {
    const { error } = await supabase.from("progreso").delete().eq("alumno_id", String(alumnoId));
    if (error) throw error;
    return true;
  },
  getSesiones: (alumnoId) => sbFetch("sesiones?alumno_id=eq."+alumnoId+"&select=*&order=created_at.desc&limit=10"),
  addSesion: (data) => sbFetch("sesiones", "POST", data),
  deleteSesionesByAlumno: async (alumnoId) => {
    const { error } = await supabase.from("sesiones").delete().eq("alumno_id", String(alumnoId));
    if (error) throw error;
    return true;
  },
  getUltimaSesion: (alumnoId) => sbFetch("sesiones?alumno_id=eq."+alumnoId+"&select=*&order=created_at.desc&limit=1"),
  getFotos: (alumnoId) => sbFetch("fotos?alumno_id=eq."+alumnoId+"&select=*&order=created_at.desc"),
  deleteFoto: (id) => sbFetch("fotos?id=eq."+id, "DELETE"),
  addFoto: (data) => sbFetch("fotos", "POST", data),
  updateAlumno: async (id, data) => {
    return sbFetch("alumnos?id=eq."+id, "PATCH", data);
  },
  deleteAlumno: async function (id) {
    var sid = encodeURIComponent(String(id));
    var activeSession = await getActiveSupabaseSession();
    var accessToken = activeSession && activeSession.access_token ? activeSession.access_token : SB_KEY;
    var r = await fetch(SB_URL + "/rest/v1/alumnos?id=eq." + sid, {
      method: "DELETE",
      headers: {
        apikey: SB_KEY,
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
    });
    if (!r.ok) {
      var errBody = "";
      try {
        errBody = await r.text();
      } catch (e) {}
      throw new Error(errBody || "HTTP " + r.status);
    }
  },
  getConfig: () => sbFetch("config?id=eq.pagos&select=*"),
  saveConfig: (data) => sbFetch("config?id=eq.pagos", "PATCH", data),
  getMensajes: (alumnoId) => sbFetch("mensajes?alumno_id=eq."+alumnoId+"&select=*&order=created_at.asc&limit=50"),
  addMensaje: (data) => sbFetch("mensajes", "POST", data),
  marcarMensajesLeidos: async (alumnoId, esEntrenador) => {
  const deQuien = esEntrenador ? "false" : "true";
  const url = "mensajes?alumno_id=eq."+alumnoId+"&de_entrenador=eq."+deQuien+"&leido=eq.false";
  const activeSession = await getActiveSupabaseSession();
  const accessToken = activeSession && activeSession.access_token ? activeSession.access_token : SB_KEY;
  const r = await fetch(SB_URL+"/rest/v1/"+url, {
    method: "PATCH",
    headers: {
      "apikey": SB_KEY,
      "Authorization": "Bearer "+accessToken,
      "Content-Type": "application/json",
      "Prefer": "return=minimal"
    },
    body: JSON.stringify({ leido: true })
  });
  if (!r.ok) {
    const err = await r.text();
    console.error("marcarMensajesLeidos falló:", r.status, err);
  }
},
  getNota: (alumnoId) => sbFetch("notas?alumno_id=eq."+alumnoId+"&select=*&order=created_at.desc&limit=1"),
  setNota: (data) => sbFetch("notas", "POST", data),
  getVideoOverrides: () => sbFetch("video_overrides?select=ejercicio_id,youtube_url"),
  getCustomEx: (entId) => sbFetch("ejercicios_custom?entrenador_id=eq."+(entId||"entrenador_principal")+"&select=*"),
  addCustomEx: (data) => sbFetch("ejercicios_custom", "POST", data),
  deleteCustomEx: (id) => sbFetch("ejercicios_custom?id=eq."+id, "DELETE"),
  updateCustomEx: (id, data) => sbFetch("ejercicios_custom?id=eq."+id, "PATCH", data),
  setVideoOverride: async (ejercicioId, url) => {
    try { await sbFetch("video_overrides?ejercicio_id=eq."+ejercicioId, "DELETE"); } catch(e){}
    try { return await sbFetch("video_overrides", "POST", {ejercicio_id:ejercicioId, youtube_url:url, entrenador_id:"entrenador_principal"}); } catch(e){ return null; }
  },
  getEntrenador: (id) => sbFetch("entrenadores?id=eq."+encodeURIComponent(id||"entrenador_principal")+"&select=*"),
  updateEntrenador: (id, data) => {
    var clean = {};
    if (data && typeof data === "object") {
      Object.keys(data).forEach(function(k){ if(data[k] !== undefined) clean[k] = data[k]; });
    }
    return sbFetch("entrenadores?id=eq."+encodeURIComponent(id||"entrenador_principal"), "PATCH", clean);
  },
};

const uid = () => Math.random().toString(36).slice(2,9);


function RecordatoriosPanel({es, darkMode, toast2, msg}) {
  const {bg, bgCard, bgSub, border, textMain, textMuted} = getTheme(darkMode);
const DIAS = es
  ? ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"]
  : ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const [notifDias, setNotifDias] = React.useState(()=>{
  try{ return JSON.parse(localStorage.getItem("it_notif_dias")||"[]"); }catch(e){return [];}
});
const [notifHora, setNotifHora] = React.useState(()=>
  localStorage.getItem("it_notif_hora")||"08:00"
);
const [notifActivo, setNotifActivo] = React.useState(()=>
  localStorage.getItem("it_notif_on")==="true"
);
const toggleDia = (i) => {
  const next = notifDias.includes(i)
    ? notifDias.filter(d=>d!==i)
    : [...notifDias,i];
  setNotifDias(next);
  localStorage.setItem("it_notif_dias", JSON.stringify(next));
};
const guardar = async () => {
  localStorage.setItem("it_notif_hora", notifHora);
  localStorage.setItem("it_notif_on", "true");
  setNotifActivo(true);
  var perm = typeof Notification !== "undefined" ? Notification.permission : "denied";
  if ("Notification" in window && perm === "default") {
    perm = await Notification.requestPermission();
  }
  if ("Notification" in window && perm === "granted") {
    toast2(msg("Recordatorios activados ✓", "Reminders set ✓"));
    checkTrainingReminderTick();
  } else if ("Notification" in window) {
    toast2(msg(
      "Preferencias guardadas, pero el navegador bloqueó las notificaciones. Permití notificaciones para este sitio en la configuración del navegador.",
      "Preferences saved, but the browser blocked notifications. Allow notifications for this site in your browser settings."
    ));
  } else {
    toast2(msg("Recordatorios guardados (este navegador no soporta notificaciones de escritorio).", "Reminders saved (this browser does not support desktop notifications)."));
  }
};
const apagar = () => {
  localStorage.setItem("it_notif_on","false");
  setNotifActivo(false);
  toast2(msg("Recordatorios desactivados", "Reminders off"));
};
return(
  <div style={{marginBottom:24}}>
    <div style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:2,marginBottom:12,textTransform:"uppercase"}}>
      🔔 {msg("Recordatorios de entrenamiento", "Training reminders")}
    </div>
    <div style={{display:"flex",gap:4,marginBottom:12,flexWrap:"wrap"}}>
      {DIAS.map((d,i)=>(
        <button key={"it-notif-dow-"+i} onClick={()=>toggleDia(i)}
          style={{flex:1,minWidth:36,padding:"8px 4px",borderRadius:8,border:"1px solid "+
            (notifDias.includes(i)?"#2563EB":"#2D4057"),
            background:notifDias.includes(i)?"#2563EB":"transparent",
            color:notifDias.includes(i)?"#fff":textMuted,
            fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
          {d}
        </button>
      ))}
    </div>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
      <div style={{fontSize:13,color:textMuted,fontWeight:500,flex:1}}>
        {msg("Hora del recordatorio", "Reminder time")}
      </div>
      <input type="time" value={notifHora}
        onChange={e=>{setNotifHora(e.target.value);localStorage.setItem("it_notif_hora",e.target.value);}}
        style={{background:bgSub,color:textMain,border:"1px solid "+border,
          borderRadius:8,padding:"8px 12px",fontSize:15,fontFamily:"inherit",outline:"none"}}/>
    </div>
    {notifActivo?(
      <div style={{display:"flex",gap:8}}>
        <div style={{flex:1,padding:"8px 12px",background:"#22C55E12",border:"1px solid #22C55E33",
          borderRadius:12,fontSize:13,color:"#22C55E",fontWeight:600,display:"flex",alignItems:"center",gap:8}}>
          🔔 {es?`Activo · ${notifDias.length} días · ${notifHora}`:`On · ${notifDias.length} days · ${notifHora}`}
        </div>
        <button onClick={apagar}
          style={{padding:"8px 16px",background:"#EF444422",color:"#EF4444",border:"1px solid #EF444433",
            borderRadius:12,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
          {msg("Apagar", "Off")}
        </button>
      </div>
    ):(
      <button onClick={guardar} disabled={notifDias.length===0}
        style={{width:"100%",padding:"12px",
          background:notifDias.length>0?"#2563EB":"#2D4057",
          color:notifDias.length>0?"#fff":textMuted,
          border:"none",borderRadius:12,fontSize:15,fontWeight:700,
          cursor:notifDias.length>0?"pointer":"not-allowed",fontFamily:"inherit"}}>
        {notifDias.length===0
          ?(msg("Seleccioná al menos un día", "Select at least one day"))
          :(msg("Activar recordatorios", "Activate reminders"))}
      </button>
    )}
  </div>
);
}

/**
 * Dispara recordatorio si coincide día/hora (app abierta / pestaña activa).
 * Notificación del sistema solo con permiso granted; vibración y tono siempre que el navegador lo permita.
 */
function checkTrainingReminderTick() {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem("it_notif_on") !== "true") return;
    var diasRaw = localStorage.getItem("it_notif_dias") || "[]";
    var dias = JSON.parse(diasRaw);
    if (!Array.isArray(dias) || dias.length === 0) return;
    dias = dias.map(function (d) { return typeof d === "string" ? parseInt(d, 10) : d; }).filter(function (x) { return x === 0 || x > 0; });
    if (dias.length === 0) return;
    var hora = (localStorage.getItem("it_notif_hora") || "08:00").trim();
    var hparts = hora.split(":");
    var targetH = parseInt(hparts[0], 10);
    var targetM = parseInt(hparts[1] != null ? hparts[1] : "0", 10);
    if (isNaN(targetH) || isNaN(targetM)) return;
    var now = new Date();
    var jsD = now.getDay();
    var uiIdx = jsD === 0 ? 6 : jsD - 1;
    if (dias.indexOf(uiIdx) === -1) return;
    var pad = function (n) { return String(n).padStart(2, "0"); };
    if (now.getHours() !== targetH || now.getMinutes() !== targetM) return;
    var hhmm = pad(now.getHours()) + ":" + pad(now.getMinutes());
    var stamp = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()) + "_" + hhmm;
    if (localStorage.getItem("it_notif_last_fired") === stamp) return;
    localStorage.setItem("it_notif_last_fired", stamp);
    playTrainingReminderFeedback();
    if ("Notification" in window && Notification.permission === "granted") {
      var lang = localStorage.getItem("it_lang") || "es";
      var title = "IronTrack — ¡Hora de entrenar!";
      var body = "Tocá para abrir la app y registrar tu sesión.";
      if (lang === "en") {
        title = "IronTrack — Time to train!";
        body = "Open the app to log your workout.";
      } else if (lang === "pt") {
        title = "IronTrack — Hora de treinar!";
        body = "Abra o app para registrar a sessão.";
      }
      new Notification(title, {
        body: body,
        tag: "irontrack-training-" + stamp,
        silent: false,
        vibrate: [200, 100, 200, 100, 280],
      });
    }
  } catch (e) { /* ignore */ }
}

/** Vibración + tono corto cuando suena el recordatorio (complementa la notificación del sistema). */
function playTrainingReminderFeedback() {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([200, 90, 200, 90, 280]);
    }
  } catch (e) { /* ignore */ }
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    var ctx = new AC();
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 740;
    o.connect(g);
    g.connect(ctx.destination);
    var t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.11, t + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.start(t);
    o.stop(t + 0.22);
    o.onended = function () {
      try { ctx.close(); } catch (e2) { /* ignore */ }
    };
  } catch (e3) { /* ignore (autoplay / AudioContext) */ }
}

/**
 * ── Plan alumno: diagnóstico scroll / micro-saltos (Chrome mobile) ─────────────────
 * Se lee una vez al montar (sin setState). Para cambiar flags: localStorage + recarga.
 *
 *   localStorage.setItem("it_plan_scroll_diag", JSON.stringify({
 *     headerCollapseOnScroll: false,
 *     headerResizeObserver: true,
 *     hoyCard: true,
 *     routineMetaPdf: true,
 *     dayList: true,
 *     completedTodayBanner: true,
 *     pagoAlumnoBanner: true,
 *     planAnimationsGlobalCss: true,
 *     planHeaderLayerTransitions: false
 *   })); location.reload();
 *
 * Causas típicas ya mitigadas en código (ver también comentarios en plan-main-scroll y scroll handler):
 * - 100dvh en el área scroll: al mostrar/ocultar la barra de URL, dvh cambia → el contenedor
 *   cambia de altura y el scroll “salta”. Mitigación: usar 100svh (viewport pequeño, más estable).
 * - Colapso del header a ~60px de scroll: coincide con cruzar HOY → Día 1; transform+opacity
 *   animados compiten con el gesto. Mitigación: umbrales más altos (p. ej. 120px) y transiciones
 *   del header desactivadas por defecto (planHeaderLayerTransitions: false).
 * - ResizeObserver escribiendo minHeight: ya va en rAF y solo si cambia el px; se puede cortar con
 *   headerResizeObserver: false para aislar.
 */
var PLAN_SCROLL_DIAG_DEFAULT = {
  /** false por defecto: el colapso por scroll competía con el layout; el slot del header ya es fijo con altura monótona. Activar en localStorage si se quiere. */
  headerCollapseOnScroll: false,
  headerResizeObserver: true,
  hoyCard: true,
  routineMetaPdf: true,
  dayList: true,
  completedTodayBanner: true,
  pagoAlumnoBanner: true,
  /** Si false, desactiva animaciones en .hov dentro del área plan (reduce transition:all). */
  planAnimationsGlobalCss: true,
  /** false = cambio instantáneo expand/mini (recomendado contra jitter al scroll). */
  planHeaderLayerTransitions: false,
};

function readPlanScrollDiag() {
  try {
    var raw = localStorage.getItem("it_plan_scroll_diag");
    var parsed = raw ? JSON.parse(raw) : {};
    var out = {};
    for (var k in PLAN_SCROLL_DIAG_DEFAULT) {
      if (Object.prototype.hasOwnProperty.call(PLAN_SCROLL_DIAG_DEFAULT, k)) {
        out[k] = parsed[k] !== undefined ? parsed[k] : PLAN_SCROLL_DIAG_DEFAULT[k];
      }
    }
    return out;
  } catch (e) {
    return Object.assign({}, PLAN_SCROLL_DIAG_DEFAULT);
  }
}

function mergeRutinasAsignadas(primary, secondary, alumnosIds) {
  var out = [];
  var seen = {};
  var shouldFilterByAlumno = !!(alumnosIds && Object.keys(alumnosIds).length > 0);
  [primary || [], secondary || []].forEach(function (list) {
    list.forEach(function (r, idx) {
      if (!r) return;
      var alumnoRutinaId = getRutinaAlumnoId(r);
      if (alumnoRutinaId != null && shouldFilterByAlumno && !alumnosIds[String(alumnoRutinaId)]) return;
      var key = r.id != null ? "id:" + String(r.id) : "row:" + String(alumnoRutinaId || "") + ":" + idx;
      if (seen[key]) return;
      seen[key] = true;
      out.push(r);
    });
  });
  return out;
}

function getRutinaAlumnoId(r) {
  if (!r) return null;
  if (r.alumno_id != null && r.alumno_id !== "") return r.alumno_id;
  if (r.assigned_to != null && r.assigned_to !== "") return r.assigned_to;
  if (r.atleta_id != null && r.atleta_id !== "") return r.atleta_id;
  if (r.alumnoId != null && r.alumnoId !== "") return r.alumnoId;
  if (r.datos && r.datos.alumno && r.datos.alumno.id != null && r.datos.alumno.id !== "") return r.datos.alumno.id;
  if (r.datos && r.datos.alumnoId != null && r.datos.alumnoId !== "") return r.datos.alumnoId;
  return null;
}

function findRutinaForAlumno(rutinas, alumnoId) {
  var aid = String(alumnoId);
  return (rutinas || []).find(function (r) {
    var rid = getRutinaAlumnoId(r);
    return rid != null && String(rid) === aid;
  }) || null;
}

function GymApp() {
  /** Flags de diagnóstico (lectura única; recargar tras editar localStorage). */
  const planScrollDiag = useMemo(function () { return readPlanScrollDiag(); }, []);
  const [tab, setTab] = useState("plan");
  const [tabMain, setTabMain] = useState("entrenador"); // entrenador | alumno
      const [onboardStep, setOnboardStep] = useState(0);
  const [onboardDone, setOnboardDone] = useState(()=>{ try{return !!localStorage.getItem('it_onboard_done');}catch(e){return false;} });
                          const ENTRENADOR_ID = "entrenador_principal";
  // Modo alumno: detectar ?r= en la URL
  const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const sharedParam = urlParams ? urlParams.get("r") : null;
  const readOnly = !!sharedParam;
  const [sharedLoaded, setSharedLoaded] = useState(false);
  // Login
  const [sessionData, setSessionData] = useState(()=>{ try{return JSON.parse(localStorage.getItem("it_session")||"null")}catch(e){return null} });
  const esAlumno = readOnly || sessionData?.role==="alumno";
  const [supabaseSessionUserId, setSupabaseSessionUserId] = useState(null);
  const [loginScreen, setLoginScreen] = useState(()=>{ try{return !localStorage.getItem("it_session")}catch(e){return true} });
  const [loginRole, setLoginRole] = useState("entrenador");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  /** Evita mostrar onboarding/login hasta leer `it_session` / flags en localStorage (post-login, refresh). */
  const [authLoading, setAuthLoading] = useState(function () { return !sharedParam; });
  /** Splash de marca: una vez por pestaña (sessionStorage), no en enlaces ?r= */
  const [brandSplashDismissed, setBrandSplashDismissed] = useState(function () {
    if (typeof window === "undefined") return true;
    try {
      if (new URLSearchParams(window.location.search).get("r")) return true;
      return !!sessionStorage.getItem("it_splash_shown_v1");
    } catch (e) {
      return true;
    }
  });
  var onBrandSplashComplete = useCallback(function () {
    try {
      sessionStorage.setItem("it_splash_shown_v1", "1");
    } catch (e) {}
    setBrandSplashDismissed(true);
  }, []);
  var brandSplashEl = !brandSplashDismissed ? <IronTrackSplash onComplete={onBrandSplashComplete} /> : null;
  const [webAuthnAvail] = useState(()=> typeof window!=="undefined" && !!window.PublicKeyCredential);
  const [savedCredential] = useState(()=>{ try{return localStorage.getItem("it_biometric_cred")}catch(e){return null} });
  const [lang, setLang] = useState(()=>{try{return localStorage.getItem("it_lang")||"es"}catch(e){return "es"}});
  const [darkMode, setDarkMode] = useState(()=>{
    try{
      const saved = localStorage.getItem("it_dark");
      if(saved !== null) return saved !== "false";
      return window.matchMedia?.("(prefers-color-scheme: dark)").matches !== false;
    }catch(e){ return true; }
  });

  // ── useAlumnos ────────────────────────────────────────────────────────
  const {
    alumnos, setAlumnos,
    sesiones, setSesiones,
    alumnoActivo, setAlumnoActivo,
    alumnoSesiones, setAlumnoSesiones,
    alumnoProgreso, setAlumnoProgreso,
    loadingSB, setLoadingSB,
    newAlumnoForm, setNewAlumnoForm,
    newAlumnoData, setNewAlumnoData,
    newAlumnoErrors, setNewAlumnoErrors,
    editAlumnoModal, setEditAlumnoModal,
    editAlumnoEmail, setEditAlumnoEmail,
    editAlumnoPass, setEditAlumnoPass,
    cargarAlumnos,
    notifyAlumno,
  } = useAlumnos({ sb });
  const [rutinasSB, setRutinasSB] = useState([]);
  const [registrosSubTab, setRegistrosSubTab] = useState(0);
  const [sesionesGlobales, setSesionesGlobales] = useState([]);
  const [progresoGlobal, setProgresoGlobal] = useState({});
  const [sugerencias, setSugerencias] = useState({});
  // Estado del dropdown de sugerencias por alumno (para no mostrar listas interminables).
  const [sugsOpen, setSugsOpen] = useState({});
  const [rutinasSBEntrenador, setRutinasSBEntrenador] = useState([]);
  const [rutinasLoaded, setRutinasLoaded] = useState(false);
  const [filtroRut, setFiltroRut] = useState("todas");
  /** Incrementar para abrir la pestaña «+ Nuevo» en GestionBiblioteca (ej. desde menú Crear del dashboard). */
  const [bibOpenNewExerciseTick, setBibOpenNewExerciseTick] = useState(0);

  

  const alumnosActivosLimpios = useMemo(function () {
    return cleanActiveCoachAlumnos(alumnos, ENTRENADOR_ID);
  }, [alumnos, ENTRENADOR_ID]);

  const alumnosActivosIds = useMemo(function () {
    var ids = {};
    alumnosActivosLimpios.forEach(function (a) {
      ids[String(a.id)] = true;
    });
    return ids;
  }, [alumnosActivosLimpios]);

  const rutinasSBEntrenadorLimpias = useMemo(function () {
    return (rutinasSBEntrenador || []).filter(function (r) {
      var alumnoRutinaId = getRutinaAlumnoId(r);
      if (r && alumnoRutinaId == null) return true;
      return !!(r && alumnosActivosIds[String(alumnoRutinaId)]);
    });
  }, [rutinasSBEntrenador, alumnosActivosIds]);

  const rutinasUnificadas = useMemo(function () {
    return mergeRutinasAsignadas(rutinasSBEntrenadorLimpias, rutinasSB, alumnosActivosIds);
  }, [rutinasSBEntrenadorLimpias, rutinasSB, alumnosActivosIds]);

  const getRutinaAsignadaAlumno = React.useCallback(function (alumnoOrId) {
    var alumnoId = alumnoOrId && typeof alumnoOrId === "object" ? alumnoOrId.id : alumnoOrId;
    return findRutinaForAlumno(rutinasUnificadas, alumnoId);
  }, [rutinasUnificadas]);

  const cargarRutinasEntrenador = React.useCallback(async function (alumnosScope) {
    try {
      var sessionResult = await supabase.auth.getSession();
      if (sessionResult.error) {
        console.error("[RUTINAS INIT] getSession error", sessionResult.error);
        return null;
      }
      var session = sessionResult.data && sessionResult.data.session;
      var entrenadorId = session?.user?.id ? String(session.user.id) : "";
      if (!entrenadorId) {
        console.warn("[RUTINAS INIT] sin session.user.id, reintentando luego");
        return null;
      }
      var result = await sb.getRutinasByEntrenador(entrenadorId);
      console.log("[RUTINAS INIT DEBUG]", {
        sessionUserId: session?.user?.id,
        entrenadorId,
        resultCount: Array.isArray(result) ? result.length : null,
        result: result?.map?.(function (r) {
          return {
            id: r.id,
            nombre: r.nombre,
            alumno_id: r.alumno_id,
            entrenador_id: r.entrenador_id
          };
        })
      });
      var listaAlumnos = Array.isArray(alumnosScope) && alumnosScope.length > 0 ? alumnosScope : [];
      var alumnoIds = (listaAlumnos || []).map(function (a) { return a && a.id; }).filter(Boolean);
      var fallbackResult = null;
      if (alumnoIds.length > 0) {
        fallbackResult = await sb.getRutinasByAlumnoIds(alumnoIds);
        console.log("[RUTINAS INIT FALLBACK DEBUG]", {
          alumnoIds: alumnoIds.map(function (id) { return String(id); }),
          resultCount: Array.isArray(fallbackResult) ? fallbackResult.length : null,
          result: fallbackResult?.map?.(function (r) {
            return {
              id: r.id,
              nombre: r.nombre,
              alumno_id: r.alumno_id,
              assigned_to: r.assigned_to,
              atleta_id: r.atleta_id,
              alumnoId: r.alumnoId,
              datos_alumno_id: r.datos?.alumno?.id,
              datos_alumnoId: r.datos?.alumnoId,
              entrenador_id: r.entrenador_id
            };
          })
        });
      }
      var mergedResult = mergeRutinasAsignadas(result || [], Array.isArray(fallbackResult) ? fallbackResult : []);
      if (Array.isArray(mergedResult) && mergedResult.length > 0) {
        setRutinasSBEntrenador(function (prev) {
          return mergeRutinasAsignadas(mergedResult, prev);
        });
        setRutinasLoaded(true);
        return mergedResult;
      }
      if (Array.isArray(result)) {
        console.warn("[RUTINAS INIT] query sin resultados", {
          query: 'rutinas.select("*").eq("entrenador_id", String(entrenadorId))',
          entrenadorId
        });
        if (alumnoIds.length > 0 || Array.isArray(alumnosScope)) {
          setRutinasLoaded(true);
        }
        return result;
      }
      console.error("[rutinas entrenador] respuesta invalida", result);
      return null;
    } catch (e) {
      console.error("[rutinas entrenador] error", e);
      return null;
    }
  }, []);

  const sesionesGlobalesLimpias = useMemo(function () {
    return (sesionesGlobales || []).filter(function (s) {
      return !!(s && alumnosActivosIds[String(s.alumno_id)]);
    });
  }, [sesionesGlobales, alumnosActivosIds]);

  const progresoGlobalLimpio = useMemo(function () {
    var out = {};
    Object.keys(progresoGlobal || {}).forEach(function (id) {
      if (alumnosActivosIds[String(id)]) out[id] = progresoGlobal[id];
    });
    return out;
  }, [progresoGlobal, alumnosActivosIds]);

  const cargarSesionesGlobales = React.useCallback(async function(alumnosActuales) {
    var lista = alumnosActuales || alumnosActivosLimpios;
    if(!lista || lista.length === 0) {
      try {
        var sbAlumnos = await sb.getAlumnos('entrenador_principal');
        var clean = cleanActiveCoachAlumnos(sbAlumnos || [], ENTRENADOR_ID);
        if(clean && clean.length > 0) { setAlumnos(clean); lista = clean; }
        else return;
      } catch(e) { return; }
    }
    try {
      lista = cleanActiveCoachAlumnos(lista, ENTRENADOR_ID);
      var ids = lista.map(function(a){return a.id}).filter(function(id){return id && typeof id === 'string'});
      if(ids.length === 0) return;
      var idsStr = ids.join(',');
      var results = await Promise.all([
        sbFetch('sesiones?alumno_id=in.(' + idsStr + ')&select=*&order=created_at.desc&limit=500'),
        sbFetch('progreso?alumno_id=in.(' + idsStr + ')&select=alumno_id,ejercicio_id,kg,reps,fecha&order=created_at.desc&limit=3000'),
      ]);
      if(results[0] && Array.isArray(results[0])) setSesionesGlobales(results[0]);
      if(results[1] && Array.isArray(results[1])) {
        var idx2 = {};
        results[1].forEach(function(reg) {
          if(!idx2[reg.alumno_id]) idx2[reg.alumno_id] = [];
          idx2[reg.alumno_id].push(reg);
        });
        setProgresoGlobal(idx2);
      }
    } catch(e) { console.error('[cargarSesionesGlobales]', e); }
  }, [alumnosActivosLimpios, ENTRENADOR_ID]);

  useEffect(function() {
    if(sessionData && sessionData.role==='entrenador') {
      var init = async function() {
        var rutinasPromise = cargarRutinasEntrenador();
        var sbAlumnos = cleanActiveCoachAlumnos(await sb.getAlumnos('entrenador_principal') || [], ENTRENADOR_ID);
        setAlumnos(sbAlumnos);
        if(sbAlumnos.length > 0) cargarSesionesGlobales(sbAlumnos);
        await rutinasPromise;
        if(sbAlumnos.length > 0) await cargarRutinasEntrenador(sbAlumnos);
      };
      init();
      var intervalo = setInterval(function() { cargarSesionesGlobales(); }, 30000);
      return function() { clearInterval(intervalo); };
    }
  }, [sessionData?.role, sessionData?.entrenadorId, supabaseSessionUserId, cargarRutinasEntrenador]);

  useEffect(function () {
    if (sessionData?.role !== "entrenador" || tab !== "alumnos") return;
    cargarRutinasEntrenador(alumnosActivosLimpios);
  }, [sessionData?.role, sessionData?.entrenadorId, supabaseSessionUserId, tab, alumnosActivosLimpios, cargarRutinasEntrenador]);

  const es = lang==="es";
  const msg = useCallback(function (esStr, enStr, ptStr) {
    return irontrackMsg(lang, esStr, enStr, ptStr);
  }, [lang]);
  const { install: installPWA, canInstall: canInstallPWA } = usePWAInstall();

  const [routines, setRoutines] = useState(() => { try{return JSON.parse(localStorage.getItem("it_rt")||"[]")}catch(e){return []} });
  const [progress, setProgress] = useState(() => { try{return JSON.parse(localStorage.getItem("it_pg")||"{}")}catch(e){return {}} });
  const [user, setUser] = useState(() => { try{return JSON.parse(localStorage.getItem("it_u")||"null")}catch(e){return null} });
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState("");
  const [filterPat, setFilterPat] = useState(null);
  const [detailEx, setDetailEx] = useState(null);
  const [logModal, setLogModal] = useState(null);
  const [activeExIdx, setActiveExIdx] = useState(0); // ejercicio activo en modo entrenamiento
  const [expandedR, setExpandedR] = useState(null);
  const [selDay, setSelDay] = useState(null);
  const [addExModal, setAddExModal] = useState(null); // {rId, dIdx}
  const [addExSearch, setAddExSearch] = useState("");
  const [addExPat, setAddExPat] = useState(null);
  const [addExMuscle, setAddExMuscle] = useState(null);
  const [addExSelectedIds, setAddExSelectedIds] = useState([]);
  const [newR, setNewR] = useState(null);
  /** Rutina local usada al pulsar "Asignar rutina" en cada alumno (explícita si hay varias). */
  const [assignRoutineId, setAssignRoutineId] = useState(null);
  const routineForAssign = useMemo(function(){
    if(!routines.length) return null;
    var id = assignRoutineId && routines.some(function(r){return r.id===assignRoutineId;}) ? assignRoutineId : routines[routines.length-1].id;
    return routines.find(function(r){return r.id===id;}) || null;
  }, [routines, assignRoutineId]);
  const rutinasCalendarioEntrenador = useMemo(function () {
    var seen = {};
    var out = [];
    [rutinasUnificadas || [], routines || []].forEach(function (list) {
      (list || []).forEach(function (r) {
        if (!r) return;
        var id = r.id != null ? String(r.id) : "";
        if (!id || seen[id]) return;
        seen[id] = true;
        out.push(r);
      });
    });
    return out;
  }, [rutinasUnificadas, routines]);

  const assignRoutineToAlumno = React.useCallback(async function ({ alumno, rutina, fecha, previousRoutine }) {
    var authSessionAssign = await getActiveSupabaseSession();
    if (!authSessionAssign) {
      throw new Error("Inicia sesion nuevamente para asignar rutinas");
    }

    var alumnoIdAssign = alumno && alumno.id ? String(alumno.id) : "";
    var entrenadorIdAssign = authSessionAssign.user && authSessionAssign.user.id ? String(authSessionAssign.user.id) : "";
    if (!alumnoIdAssign || !entrenadorIdAssign || !rutina) {
      console.error("[assignRut] datos invalidos", {
        alumno_id: alumnoIdAssign || null,
        entrenador_id: entrenadorIdAssign || null,
        alumno: alumno,
        rutinaLocal: rutina,
        fecha: fecha || null,
      });
      throw new Error("Datos invalidos para asignar rutina");
    }
    if (!isValidUuid(alumnoIdAssign)) {
      console.error("[assignRut] alumno_id no es UUID valido", { alumno_id: alumnoIdAssign, alumno: alumno });
      throw new Error("El alumno no tiene un ID valido");
    }
    if (!isValidUuid(entrenadorIdAssign)) {
      console.error("[assignRut] entrenador_id no es UUID valido", { entrenador_id: entrenadorIdAssign, sessionUserId: authSessionAssign.user?.id });
      throw new Error("La sesion del entrenador no es valida");
    }

    var nombreAssign = rutina?.nombre || rutina?.name || "Rutina";
    var daysAssign = rutina?.datos?.days || rutina?.days || [];
    if (!Array.isArray(daysAssign)) {
      console.error("[assignRut] days no es array", { days: daysAssign, rutinaLocal: rutina });
      throw new Error("La rutina no tiene dias validos");
    }

    var body = {
      alumno_id: alumnoIdAssign,
      entrenador_id: entrenadorIdAssign,
      nombre: nombreAssign,
      datos: {
        days: sanitizeRoutineDaysForWrite(daysAssign),
        alumno: {
          id: alumno.id,
          nombre: alumno.nombre || "",
          email: alumno.email || "",
        },
        note: rutina?.datos?.note || rutina?.note || "",
      },
    };

    var insertResult = await supabase
      .from("rutinas")
      .insert([body])
      .select()
      .single();
    if (insertResult.error || !insertResult.data) {
      console.error("[assignRut INSERT ERROR FULL]", insertResult.error || insertResult);
      throw insertResult.error || new Error("No se pudo crear la rutina asignada");
    }

    var res = insertResult.data;
    var oldRutina = previousRoutine || getRutinaAsignadaAlumno(alumnoIdAssign);
    if (oldRutina && oldRutina.id != null && String(oldRutina.id) !== String(res.id)) {
      try {
        await sb.deleteRutina(oldRutina.id);
        var oldId = String(oldRutina.id);
        setRutinasSB(function (prev) {
          return (prev || []).filter(function (x) {
            return String(x.id) !== oldId;
          });
        });
        setRutinasSBEntrenador(function (prev) {
          return (prev || []).filter(function (x) {
            return String(x.id) !== oldId;
          });
        });
      } catch (eOldRutina) {
        console.error("[assignRut] error al quitar rutina anterior despues del insert", eOldRutina);
      }
    }

    setRutinasSB(function (prev) {
      return mergeRutinasAsignadas([res], prev);
    });
    setRutinasSBEntrenador(function (prev) {
      return mergeRutinasAsignadas([res], prev);
    });
    setRoutines(function (prev) {
      var prevList = Array.isArray(prev) ? prev : [];
      var localRutina = {
        id: res.id,
        name: res.nombre || nombreAssign,
        days: res.datos?.days || [],
        alumno_id: res.alumno_id,
        alumno: alumno.nombre || alumno.email || "",
        note: res.datos?.note || "",
        saved: true,
        collapsed: true,
      };
      var replaced = false;
      var next = prevList
        .filter(function (r) {
          return !oldRutina || String(r.id) !== String(oldRutina.id);
        })
        .map(function (r) {
          if (String(r.id) === String(res.id)) {
            replaced = true;
            return Object.assign({}, r, localRutina);
          }
          return r;
        });
      return replaced ? next : [localRutina].concat(next);
    });

    return { ok: true, rutina: res };
  }, [getRutinaAsignadaAlumno, setRoutines]);
  const [dupDayModal, setDupDayModal] = useState(null); // {rId, dIdx, days}
  const [dupDayClosing, setDupDayClosing] = useState(false);
  const [chatModal, setChatModal] = useState(null); // {alumnoId, alumnoNombre}
  const [videoOverrides, setVideoOverrides] = useState({}); // {ejercicioId: url}
  /** Claves: id de EX (catálogo); p.ej. { sq: "empuje" } — persiste en localStorage `it_pattern_ov` */
  const [patternOverrides, setPatternOverrides] = useState({});
  const [videoModal, setVideoModal] = useState(null); // {url, nombre}
  const [expandedPlanDay, setExpandedPlanDay] = useState(null); // "rutId-dayIdx"
  const [editEx, setEditEx] = useState(null);
  const [coachAlumnosSearch, setCoachAlumnosSearch] = useState("");
  const [coachAlumnosFilter, setCoachAlumnosFilter] = useState("todos");
  const [coachRoutineDiaIdx, setCoachRoutineDiaIdx] = useState(0);
  const [coachDiaSecsOpen, setCoachDiaSecsOpen] = useState({ warmup: true, main: true });
  const [coachCardMenuId, setCoachCardMenuId] = useState(null);
  const [coachRutinaMenuOpen, setCoachRutinaMenuOpen] = useState(false);
  const [loginModal, setLoginModal] = useState(false);
  const [session, setSession] = useState(null);
  const [preSessionPRs, setPreSessionPRs] = useState({});
  const [prCelebration, setPrCelebration] = useState(null); // {ejercicio, kg, prevKg, diff, exId}
  const [sessionPRList, setSessionPRList] = useState([]); // [{exId, ejercicio, kg, prevKg, diff}]
  const [notaDia, setNotaDia] = useState(""); // nota del entrenador al alumno
  const [notaDiaInput, setNotaDiaInput] = useState(""); // input del entrenador
  const headerCollapsedRef = useRef(false);
  const studentHeaderExpandRef = useRef(null);
  const studentHeaderMiniRef = useRef(null);
  const studentHeaderShellRef = useRef(null);
  /** Altura layout de la capa expandida (px) para translate3d estable; evita % y subpíxeles. */
  const studentHeaderExpandHeightRef = useRef(0);
  /** Último minHeight aplicado al shell (evita escrituras RO que disparan scroll anchoring). */
  const shellMinHeightPxRef = useRef(-1);
  /**
   * Altura máxima medida del bloque header expandido + mini (px). Solo crece: nunca bajar evita
   * que al colapsar con transform/opacity el RO vuelva a medir menos y el shell encoja → CLS.
   */
  const studentHeaderShellLockedHeightPxRef = useRef(0);
  const shellMeasureRafRef = useRef(null);
  const scrollRef = useRef(null);
  /** Barra superior fija (alumno): transform al llegar al final del scroll. */
  const alumnoAppHeaderRef = useRef(null);
  const alumnoTopBarSpacerRef = useRef(null);
  const profileFileRef = useRef(null);
  const lastScrollY = useRef(0);
  const tickingRef = useRef(false);
  const scrollRafIdRef = useRef(null);
  /** Actualizado cada render tras conocer tab/esAlumno: el scroll handler no debe depender de closure viejo. */
  const planScrollCtxRef = useRef({ alumnoPlan: false, headerCollapse: true });
  const [resumenSesion, setResumenSesion] = useState(null);
  const [chatOpenId, setChatOpenId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileEdit, setProfileEdit] = useState({nombre:"",apellido:"",email:"",phone:"",avatarDataUrl:null});
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [pwaInstallTipOpen, setPwaInstallTipOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(()=>{ try{ const v=localStorage.getItem("it_show_welcome"); if(v){localStorage.removeItem("it_show_welcome");return true;} return false; }catch(e){return false;} });
  const [currentWeek, setCurrentWeek] = useState(() => { try{return parseInt(localStorage.getItem("it_week")||"0")}catch(e){return 0} });
  const [completedDays, setCompletedDays] = useState(() => { try{return JSON.parse(localStorage.getItem("it_cd")||"[]")}catch(e){return []} });
  /** Diálogos reemplazando `confirm` en el panel coach (alumnos / rutinas). */
  const [coachDialog, setCoachDialog] = useState({ t: 'none' });
  const [coachDialogLoading, setCoachDialogLoading] = useState(false);
  const [libQ, setLibQ] = useState("");
  const [filtPat, setFiltPat] = useState(null);
  const [editExModal, setEditExModal] = useState(null);
  const [editExNombre, setEditExNombre] = useState("");
  const [editExYT, setEditExYT] = useState("");
  const [customEx, setCustomEx] = useState(() => { try{return JSON.parse(localStorage.getItem("it_cex")||"[]")}catch(e){return []} });
  const [exModal, setExModal] = useState(null);
  const [aliasModal, setAliasModal] = useState(false);
  const [aliasData, setAliasData] = useState(null);
  const [isOnline, setIsOnline] = useState(()=>typeof navigator!=='undefined'?navigator.onLine:true);
  const [pendingSync, setPendingSync] = useState(()=>{
    try{return JSON.parse(localStorage.getItem('it_pending_sync')||'[]');}catch(e){return [];}
  });
  const [pagosEstado, setPagosEstado] = useState(()=>{
    try{ return JSON.parse(localStorage.getItem("it_pagos_estado")||"{}"); }catch(e){ return {}; }
  });
  const togglePago = (alumnoId) => {
    setPagosEstado(prev => {
      const cur = prev[alumnoId] || "pendiente";
      const next = cur === "pagado" ? "pendiente" : cur === "pendiente" ? "vencido" : "pagado";
      const updated = {...prev, [alumnoId]: next};
      try{ localStorage.setItem("it_pagos_estado", JSON.stringify(updated)); }catch(e){}
      return updated;
    });
  };
  const [aliasForm, setAliasForm] = useState({alias:"",cbu:"",monto:"",banco:"",nota:""});
  const [timer, setTimer] = useState(null);
  const timerRef = useRef(null);
  const mobileDrawerRef = useRef(null);
  const toast2 = useCallback((msg, type) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);
  var ALUMNO_HEADER_MINI_PX = 56;
  /** Colapso visual únicamente: NO quitar nodos ni height:0. La caja real la fija studentHeaderShellRef (altura monótona). */
  function applyAlumnoHeaderLayerStyles(collapsed) {
    var exp = studentHeaderExpandRef.current;
    var mini = studentHeaderMiniRef.current;
    if (exp) {
      var hLay = exp.offsetHeight;
      if (hLay > 0) studentHeaderExpandHeightRef.current = hLay;
      var h = studentHeaderExpandHeightRef.current > 0 ? studentHeaderExpandHeightRef.current : Math.max(hLay, 1);
      exp.style.transform = collapsed
        ? "translate3d(0,-" + h + "px,0)"
        : "translate3d(0,0,0)";
      exp.style.opacity = collapsed ? "0" : "1";
      exp.style.pointerEvents = collapsed ? "none" : "auto";
    }
    if (mini) {
      var hm = mini.offsetHeight > 0 ? mini.offsetHeight : ALUMNO_HEADER_MINI_PX;
      mini.style.transform = collapsed
        ? "translate3d(0,0,0)"
        : "translate3d(0," + hm + "px,0)";
      mini.style.opacity = collapsed ? "1" : "0";
      mini.style.pointerEvents = collapsed ? "auto" : "none";
    }
  }

  function closeDupDayModalAnimated() {
    if (!dupDayModal || dupDayClosing) return;
    setDupDayClosing(true);
    window.setTimeout(function () {
      setDupDayModal(null);
      setDupDayClosing(false);
    }, 200);
  }

  useEffect(function () {
    if (!dupDayModal) return undefined;
    setDupDayClosing(false);
    function onKeyDown(e) {
      if (e.key === "Escape") closeDupDayModalAnimated();
    }
    window.addEventListener("keydown", onKeyDown);
    return function () {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [dupDayModal, dupDayClosing]);

  /** Plan alumno: scroll vía requestAnimationFrame + listener pasivo (sin setState en el hilo de scroll). */
  useLayoutEffect(function () {
    var cancelled = false;
    var waitRafId = null;
    var attachedEl = null;

    function applyScrollHeaderFrame() {
      scrollRafIdRef.current = null;
      if (!attachedEl) {
        tickingRef.current = false;
        return;
      }
      var ctx = planScrollCtxRef.current;
      /** Modo alumno: header superior siempre visible (sin translate fuera del viewport). */
      var nav = alumnoAppHeaderRef.current;
      if (nav && ctx.alumnoFixedTabs) {
        nav.style.transform = "";
        nav.style.transition = "";
        var sp = alumnoTopBarSpacerRef.current;
        if (sp) {
          sp.style.height = ctx.alumnoTopBarPx;
          sp.style.minHeight = ctx.alumnoTopBarPx;
          sp.style.transition = "none";
        }
      } else if (nav && !ctx.alumnoFixedTabs) {
        nav.style.transform = "";
        nav.style.transition = "";
        var sp0 = alumnoTopBarSpacerRef.current;
        if (sp0) {
          sp0.style.height = "";
          sp0.style.minHeight = "";
          sp0.style.transition = "";
        }
      }
      if (!ctx.headerCollapse || !ctx.alumnoPlan) {
        tickingRef.current = false;
        return;
      }
      var y = attachedEl.scrollTop;
      var dir = y > lastScrollY.current;
      lastScrollY.current = y;
      var nextCollapsed = headerCollapsedRef.current;
      /** Umbrales por encima del tramo HOY→Día 1 (~60–100px) para no colapsar el header justo al cruzar esa unión. */
      var COLLAPSE_AFTER_Y = 120;
      var EXPAND_BELOW_Y = 36;
      if (dir && y > COLLAPSE_AFTER_Y && !headerCollapsedRef.current) nextCollapsed = true;
      if (!dir && y < EXPAND_BELOW_Y && headerCollapsedRef.current) nextCollapsed = false;
      if (nextCollapsed !== headerCollapsedRef.current) {
        headerCollapsedRef.current = nextCollapsed;
        applyAlumnoHeaderLayerStyles(nextCollapsed);
      }
      tickingRef.current = false;
    }

    function onScroll() {
      if (tickingRef.current) return;
      tickingRef.current = true;
      scrollRafIdRef.current = requestAnimationFrame(applyScrollHeaderFrame);
    }

    function tryAttachToScrollEl() {
      if (cancelled) return;
      var el = scrollRef.current;
      if (el) {
        attachedEl = el;
        el.addEventListener("scroll", onScroll, { passive: true });
        return;
      }
      waitRafId = requestAnimationFrame(tryAttachToScrollEl);
    }

    waitRafId = requestAnimationFrame(tryAttachToScrollEl);

    return function () {
      cancelled = true;
      if (waitRafId != null) {
        cancelAnimationFrame(waitRafId);
        waitRafId = null;
      }
      if (attachedEl) {
        attachedEl.removeEventListener("scroll", onScroll);
        attachedEl = null;
      }
      if (scrollRafIdRef.current != null) {
        cancelAnimationFrame(scrollRafIdRef.current);
        scrollRafIdRef.current = null;
      }
      tickingRef.current = false;
    };
  }, []);

  /** Alumno / pestaña plan: fuerza expansión visible (sin capa mini por scroll/refs viejos). */
  useLayoutEffect(
    function () {
      if (!esAlumno || tab !== "plan") return;
      headerCollapsedRef.current = false;
      applyAlumnoHeaderLayerStyles(false);
    },
    [esAlumno, tab]
  );

  /** Después de login/logout (localStorage ya actualizado): sincroniza sesión y datos persistidos sin recargar. */
  function syncStateWithLocalStorage() {
    var sess = null;
    try { sess = JSON.parse(localStorage.getItem("it_session") || "null"); } catch (e) { sess = null; }
    setSessionData(sess);
    try { setLoginScreen(!localStorage.getItem("it_session")); } catch (e) { setLoginScreen(true); }
    try { setRoutines(JSON.parse(localStorage.getItem("it_rt") || "[]")); } catch (e) { setRoutines([]); }
    try { setProgress(JSON.parse(localStorage.getItem("it_pg") || "{}")); } catch (e) { setProgress({}); }
    try { setUser(JSON.parse(localStorage.getItem("it_u") || "null")); } catch (e) { setUser(null); }
    var welcome = false;
    try {
      if (localStorage.getItem("it_show_welcome")) {
        localStorage.removeItem("it_show_welcome");
        welcome = true;
      }
    } catch (e) {}
    setShowWelcome(welcome);
    try { setCurrentWeek(parseInt(localStorage.getItem("it_week") || "0", 10) || 0); } catch (e) { setCurrentWeek(0); }
    try { setCompletedDays(JSON.parse(localStorage.getItem("it_cd") || "[]")); } catch (e) { setCompletedDays([]); }
    try { setCustomEx(JSON.parse(localStorage.getItem("it_cex") || "[]")); } catch (e) { setCustomEx([]); }
    try { setPendingSync(JSON.parse(localStorage.getItem("it_pending_sync") || "[]")); } catch (e) { setPendingSync([]); }
    try { setPagosEstado(JSON.parse(localStorage.getItem("it_pagos_estado") || "{}")); } catch (e) { setPagosEstado({}); }
    try {
      if (sess && (sess.role === "entrenador" || sess.role === "alumno")) {
        try { localStorage.setItem("it_onboard_done", "1"); } catch (e) {}
        setOnboardDone(true);
      } else {
        setOnboardDone(!!localStorage.getItem("it_onboard_done"));
      }
    } catch (e) { setOnboardDone(false); }
    setTab("plan");
    setSession(null);
    setAlumnos([]);
    setSesiones([]);
    setAlumnoActivo(null);
    setAlumnoSesiones([]);
    setAlumnoProgreso([]);
    setSesionesGlobales([]);
    setProgresoGlobal({});
    setRutinasSBEntrenador([]);
    setRutinasSB([]);
    setLoadingSB(false);
    setUserMenuOpen(false);
    setSettingsOpen(false);
    setLoginModal(false);
    setPreSessionPRs({});
    setSessionPRList([]);
    setPrCelebration(null);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimer(null);
  }

  useLayoutEffect(function () {
    if (sharedParam) {
      setAuthLoading(false);
      return;
    }
    try {
      var raw = localStorage.getItem("it_session");
      var parsed = null;
      if (raw) {
        try { parsed = JSON.parse(raw); } catch (e1) { parsed = null; }
      }
      setSessionData(parsed);
      setLoginScreen(!raw);
      var fromLs = !!localStorage.getItem("it_onboard_done");
      if (parsed && (parsed.role === "entrenador" || parsed.role === "alumno")) {
        fromLs = true;
        try { localStorage.setItem("it_onboard_done", "1"); } catch (e2) {}
      }
      setOnboardDone(fromLs);
    } catch (e) {
      setSessionData(null);
      setLoginScreen(true);
      try { setOnboardDone(!!localStorage.getItem("it_onboard_done")); } catch (e2) { setOnboardDone(false); }
    }
    setAuthLoading(false);
  }, [sharedParam]);

  // OneSignal Web Push

  // ── Escuchar cambios de tema del SO ─────────────────────────────────────
  useEffect(()=>{
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if(!mq) return;
    const handler = (e) => {
      if(localStorage.getItem("it_dark") === null) setDarkMode(e.matches);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(function(){
    try {
      var raw = localStorage.getItem("it_prefs");
      if(!raw) return;
      var p = JSON.parse(raw);
      applyItPrefsToDocument(p);
      if(p.lang === "es" || p.lang === "en" || p.lang === "pt") { setLang(p.lang); localStorage.setItem("it_lang", p.lang); }
      if(p.theme === "night") { setDarkMode(true); localStorage.setItem("it_dark", "true"); }
      else if(p.theme === "day") { setDarkMode(false); localStorage.setItem("it_dark", "false"); }
      else if(p.theme === "system") {
        var d = window.matchMedia("(prefers-color-scheme: dark)").matches;
        setDarkMode(d); localStorage.setItem("it_dark", d ? "true" : "false");
      }
    } catch(e) {}
  }, []);

  // ── Supabase Auth: fila mínima en `entrenadores` (id = auth.users.id) ──
  useEffect(function () {
    if (!supabase) return;
    var cancelled = false;

    function upsertEntrenador(user) {
      if (cancelled || !user || !user.id) return;
      supabase
        .from('entrenadores')
        .upsert({ id: user.id, email: user.email ?? null }, { onConflict: 'id' })
        .then(function (result) {
          if (result.error) console.error('[entrenadores upsert]', result.error);
        });
    }

    supabase.auth.getSession().then(function (sessionResult) {
      if (cancelled) return;
      if (sessionResult.error) {
        console.error('[supabase.auth.getSession]', sessionResult.error);
        return;
      }
      var session = sessionResult.data && sessionResult.data.session;
      if (!session || !session.user) {
        setSupabaseSessionUserId(null);
        return;
      }
      setSupabaseSessionUserId(String(session.user.id));
      upsertEntrenador(session.user);
    });

    var sub = supabase.auth.onAuthStateChange(function (event, session) {
      if (cancelled) return;
      if (session && session.user) {
        setSupabaseSessionUserId(String(session.user.id));
        if (event !== 'INITIAL_SESSION') upsertEntrenador(session.user);
      } else {
        setSupabaseSessionUserId(null);
      }
    });

    return function () {
      cancelled = true;
      try {
        if (sub && sub.data && sub.data.subscription) sub.data.subscription.unsubscribe();
      } catch (e) {}
    };
  }, []);

  // ── Cargar datos del coach desde `entrenadores` (Supabase); fallback localStorage ──
  useEffect(function () {
    if (!supabase) return;
    var cancelled = false;

    (async function () {
      try {
        var sessionRes = await supabase.auth.getSession();
        if (sessionRes.error) {
          console.error('[App] coach entrenadores getSession', sessionRes.error);
          return;
        }
        var activeSession = sessionRes.data && sessionRes.data.session;
        if (!activeSession || !activeSession.user) return;
        var u = activeSession.user;
        if (!u || !u.id) return;

        var q = await supabase.from('entrenadores').select('*').eq('id', u.id).maybeSingle();
        if (q.error) {
          console.error('[App] coach entrenadores select', q.error);
          return;
        }
        var row = q.data;
        if (cancelled) return;
        if (!row) return;

        setSessionData(function (prev) {
          if (cancelled) return prev;
          if (!prev || prev.role !== 'entrenador') return prev;
          var next = Object.assign({}, prev, {
            email: row.email || u.email || prev.email,
            entrenadorId: u.id,
          });
          if (row.nombre) next.name = row.nombre;
          if (row.titulo_profesional != null) next.titulo = row.titulo_profesional;
          if (row.telefono != null) next.phone = row.telefono;
          else if (row.telefono_comercial != null) next.phone = row.telefono_comercial;
          if (row.avatar_url != null) next.avatarUrl = row.avatar_url;
          if ((!next.name || String(next.name).trim() === 'Entrenador') && (row.nombre == null || !String(row.nombre).trim())) {
            try {
              var cpl2 = localStorage.getItem('it_coach_profile_local');
              if (cpl2) {
                var cp2 = JSON.parse(cpl2);
                if (cp2 && typeof cp2.name === 'string' && cp2.name.trim()) {
                  next.name = cp2.name.trim();
                }
              }
            } catch (e2) {}
          }
          try {
            localStorage.setItem('it_session', JSON.stringify(next));
          } catch (e) {
            console.error('[App] coach it_session persist', e);
          }
          return next;
        });

        try {
          var exNeg = null;
          try {
            exNeg = JSON.parse(localStorage.getItem('it_coach_negocio') || 'null');
          } catch (e0) {}
          if (!exNeg || typeof exNeg !== 'object') exNeg = {};
          var disp = row.disponibilidad_json;
          if (typeof disp === 'string') {
            try {
              disp = JSON.parse(disp);
            } catch (e1) {
              disp = null;
            }
          }
          var merged = Object.assign({}, exNeg);
          if (row.nombre_gimnasio != null) merged.nombre_gimnasio = row.nombre_gimnasio;
          if (row.telefono_comercial != null) merged.telefono_comercial = row.telefono_comercial;
          if (row.capacidad_max != null) merged.capacidad_max = Number(row.capacidad_max);
          if (row.moneda) merged.moneda = row.moneda;
          if (Array.isArray(disp) && disp.length === 7) merged.disponibilidad = disp;
          if (typeof merged.capacidad_max !== 'number' || isNaN(merged.capacidad_max)) merged.capacidad_max = 30;
          if (!merged.moneda) merged.moneda = 'ARS';
          localStorage.setItem('it_coach_negocio', JSON.stringify(merged));
        } catch (e2) {
          console.error('[App] coach it_coach_negocio merge', e2);
        }
      } catch (e) {
        console.error('[App] coach entrenadores load', e);
      }
    })();

    return function () {
      cancelled = true;
    };
  }, []);

  // ── Detectar online/offline y sincronizar cola ─────────────────────────
  useEffect(()=>{
    const goOnline = () => {
      setIsOnline(true);
      // Sincronizar sets pendientes
      const pending = JSON.parse(localStorage.getItem('it_pending_sync')||'[]');
      if(pending.length === 0) return;
      const alumnoIdSync = (()=>{try{return JSON.parse(localStorage.getItem("it_session")||"null")?.alumnoId}catch(e){return null}})();
      if(!alumnoIdSync) return;
      pending.forEach(item => {
        try {
          console.log("[PROGRESO] enviando a supabase...");sb.addProgreso({
            alumno_id: alumnoIdSync,
            ejercicio_id: item.exId,
            kg: item.kg, reps: item.reps,
            nota: item.note||'', fecha: item.date
          });
        } catch(e) {}
      });
      localStorage.removeItem('it_pending_sync');
      setPendingSync([]);
      if(pending.length > 0) toast2(pending.length+' set'+(pending.length>1?'s':'')+' sincronizados ✓');
    };
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [sessionData]);

    // ── Registrar Service Worker (PWA) ───────────────────────────────────
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
          .then(reg => console.log('SW registrado:', reg.scope))
          .catch(err => console.log('SW error:', err));
      });
    }
  }, []);

  useEffect(() => {
    if(typeof window === "undefined") return;
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function(OneSignal) {
      await OneSignal.init({
        appId: "8c5e2bd1-2ac8-497a-93eb-fd07e5ce74d7",
        allowLocalhostAsSecureOrigin: true,
        notifyButton: { enable: false },
      });
    });
  }, []);

  useEffect(() => {
    if(sharedParam && !sharedLoaded) {
      (async () => {
        try {
          const decoded = JSON.parse(atob(sharedParam));
          // Siempre intentar cargar desde Supabase primero (rutina más actualizada)
          if(decoded?.alumnoId) {
            const rutsRaw = await sb.getRutinas(decoded.alumnoId);
            const ruts = (rutsRaw || []).slice().sort(function (a, b) {
              return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            }).slice(0, 1);
            if(ruts && ruts[0] && ruts[0].datos) {
              setRoutines([{...ruts[0].datos, alumnoId: decoded.alumnoId, id: ruts[0].id}]);
              setSharedLoaded(true);
              return;
            }
          }
          // Fallback: usar datos del link si Supabase falla
          if(decoded && decoded.id) setRoutines([decoded]);
        } catch(e) {
          try {
            const decoded = JSON.parse(atob(sharedParam));
            if(decoded && decoded.id) setRoutines([decoded]);
          } catch(e2) {}
        }
        setSharedLoaded(true);
      })();
    }
  }, []);
  useEffect(() => {
    if (readOnly) return;
    try {
      const sanitized = routines.map((r) => ({ ...r, days: sanitizeRoutineDaysForWrite(r.days) }));
      localStorage.setItem("it_rt", JSON.stringify(sanitized));
    } catch (e) {}
  }, [routines, readOnly]);
  useEffect(() => { localStorage.setItem("it_pg",JSON.stringify(progress)); },[progress]);

  // Recalcular timer cuando el alumno vuelve de background (sin setState por tick)
  useEffect(()=>{
    const handleVisibility = () => {
      if(!document.hidden && timer?.endAt) {
        const rem = Math.max(0, Math.round((timer.endAt - Date.now()) / 1000));
        if(rem <= 0) {
          if(timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          setTimer(null);
          toast2(msg("¡Pausa lista! 💪", "Rest done! 💪"));
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [timer, es]);
  // Alarma de fin de pausa (un solo setTimer(null) al terminar; no actualiza el padre cada 500 ms)
  useEffect(() => {
    if (!timer?.endAt) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    const endAt = timer.endAt;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (Date.now() >= endAt) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setTimer(null);
        toast2(msg("¡Pausa lista! 💪", "Rest done! 💪"));
      }
    }, 500);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [timer?.endAt, es]);
  useEffect(() => { localStorage.setItem("it_week",String(currentWeek)); },[currentWeek]);

  useEffect(() => {
    if(!readOnly && sessionData?.role==="entrenador") {
      cargarAlumnos();
    }
  }, [sessionData?.role]);

  // Refrescar rutinas del alumno desde Supabase siempre al cargar
  useEffect(() => {
    if(!readOnly && sessionData?.role==="alumno" && sessionData?.alumnoId) {
      (async () => {
        try {
          const rutsRaw = await sb.getRutinas(sessionData.alumnoId);
          const ruts = (rutsRaw || []).slice().sort(function (a, b) {
            return new Date(b.created_at || 0) - new Date(a.created_at || 0);
          }).slice(0, 1);
          if(ruts && ruts[0] && ruts[0].datos) {
            const rSB = ruts[0];
            const rutLocal = {
              id: rSB.id,
              name: rSB.nombre || "Rutina",
              days: rSB.datos?.days || [],
              alumno: rSB.datos?.alumno || sessionData.name || "",
              note: rSB.datos?.note || "",
              alumno_id: sessionData.alumnoId,
              saved: true
            };
            setRoutines(function(prev) {
              // No duplicar si ya existe
              var existe = prev.find(function(r) { return r.id === rSB.id; });
              if(existe) return prev.map(function(r) { return r.id === rSB.id ? rutLocal : r; });
              return [rutLocal];
            });
          }
          // Cargar nota del día
          sb.getNota(sessionData.alumnoId).then(function(res) {
            if(res && res[0]) setNotaDia(res[0].contenido||res[0].texto||"");
          }).catch(function(){});
        } catch(e) { console.error('[cargarRutinaAlumno]', e); }
      })();
    }
  }, [sessionData?.alumnoId]);
  useEffect(() => { localStorage.setItem("it_cd",JSON.stringify(completedDays)); },[completedDays]);
  useEffect(function () {
    try {
      localStorage.setItem("it_pattern_ov", JSON.stringify(patternOverrides || {}));
    } catch (e) {}
  }, [patternOverrides]);
  useEffect(() => {
    try {
      const sanitized = (customEx || []).map(sanitizeExerciseSnapshotForWrite);
      localStorage.setItem("it_cex", JSON.stringify(sanitized));
    } catch (e) {}
  }, [customEx]);
  // Cargar config de pagos desde Supabase
  useEffect(() => {
    sb.getConfig().then(res => {
      if(res && res[0]) setAliasData(res[0]);
    }).catch(()=>{});
    // Cargar video overrides
    sb.getVideoOverrides().then(function(res){
      if(res && Array.isArray(res)) {
        var map = {};
        res.forEach(function(r){ map[r.ejercicio_id] = r.youtube_url; });
        setVideoOverrides(map);
      }
    }).catch(function(){});
    try {
      var pRaw = localStorage.getItem("it_pattern_ov");
      if (pRaw) {
        var pOb = JSON.parse(pRaw);
        if (pOb && typeof pOb === "object") setPatternOverrides(pOb);
      }
    } catch (e) {}
    // Cargar ejercicios custom desde Supabase
    var entId = (()=>{ try{ return JSON.parse(localStorage.getItem("it_session")||"null")?.entrenadorId || "entrenador_principal"; }catch(e){ return "entrenador_principal"; } })();
    sb.getCustomEx(entId).then(function(res){
      if(res && Array.isArray(res) && res.length > 0) {
        var exs = res.map(function(e){
          var rawName = e.name != null && e.name !== "" ? e.name : (e.nombre != null ? e.nombre : "");
          var rawEn = e.name_en != null && e.name_en !== "" ? e.name_en : (e.nameEn != null ? e.nameEn : rawName);
          var rawVu = (e.video_url || e.youtube || e.youtube_url || e.videoUrl || "").trim();
          var vuStore = rawVu && isValidHttpUrlString(rawVu) ? rawVu : null;
          var isCust = e.is_custom != null ? !!e.is_custom : true;
          return {
            id: e.id,
            name: rawName,
            nameEn: rawEn || rawName,
            pattern: e.pattern || "empuje",
            muscle: e.muscle || "",
            equip: e.equip || "Libre",
            video_url: vuStore,
            isCustom: isCust,
          };
        });
        setCustomEx(function(prev){
          // Merge: Supabase tiene prioridad, agregar locales que no estén
          var ids = new Set(exs.map(function(e){return e.id}));
          var locales = (prev||[]).filter(function(e){return !ids.has(e.id)});
          return [...exs, ...locales];
        });
      }
    }).catch(function(){});
  }, []);

  /** Recordatorios de entrenamiento (alumno): comprobar hora mientras la app está abierta. */
  React.useEffect(function () {
    if (typeof window === "undefined") return;
    function onVisible() {
      if (document.visibilityState === "visible") checkTrainingReminderTick();
    }
    checkTrainingReminderTick();
    var id = setInterval(checkTrainingReminderTick, 15000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", checkTrainingReminderTick);
    return function () {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", checkTrainingReminderTick);
    };
  }, []);

  const coachAlumnoCategoria = React.useCallback(function (a) {
    if (!getRutinaAsignadaAlumno(a.id)) return "sin_rutina";
    var cutoff = Date.now() - 21 * 24 * 60 * 60 * 1000;
    var ses = sesionesGlobalesLimpias || [];
    for (var i = 0; i < ses.length; i++) {
      if (ses[i].alumno_id !== a.id) continue;
      var raw = ses[i].created_at || "";
      if (!raw) continue;
      var d = new Date(raw.slice(0, 10));
      if (!isNaN(d.getTime()) && d.getTime() >= cutoff) return "activo";
    }
    var plist = progresoGlobalLimpio[a.id];
    if (plist && plist.length) {
      for (var j = 0; j < plist.length; j++) {
        var fecha = plist[j].fecha || "";
        if (!fecha) continue;
        var d2;
        if (fecha.indexOf("/") >= 0) {
          var p = fecha.split("/");
          d2 = new Date(parseInt(p[2], 10), parseInt(p[1], 10) - 1, parseInt(p[0], 10));
        } else {
          d2 = new Date(fecha.slice(0, 10));
        }
        if (!isNaN(d2.getTime()) && d2.getTime() >= cutoff) return "activo";
      }
    }
    return "inactivo";
  }, [getRutinaAsignadaAlumno, sesionesGlobalesLimpias, progresoGlobalLimpio]);

  const coachAlumnosCounts = React.useMemo(function () {
    var c = { todos: alumnosActivosLimpios.length, activos: 0, inactivos: 0, sin_rutina: 0 };
    alumnosActivosLimpios.forEach(function (a) {
      var cat = coachAlumnoCategoria(a);
      if (cat === "sin_rutina") c.sin_rutina++;
      else if (cat === "activo") c.activos++;
      else c.inactivos++;
    });
    return c;
  }, [alumnosActivosLimpios, coachAlumnoCategoria]);

  const coachAlumnosListaFiltrada = React.useMemo(function () {
    var q = coachAlumnosSearch.trim().toLowerCase();
    return alumnosActivosLimpios.filter(function (a) {
      if (q) {
        var hay = ((a.nombre || "") + " " + (a.email || "")).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      var cat = coachAlumnoCategoria(a);
      if (coachAlumnosFilter === "todos") return true;
      if (coachAlumnosFilter === "sin_rutina") return cat === "sin_rutina";
      if (coachAlumnosFilter === "activos") return cat === "activo";
      if (coachAlumnosFilter === "inactivos") return cat === "inactivo";
      return true;
    });
  }, [alumnosActivosLimpios, coachAlumnosSearch, coachAlumnosFilter, coachAlumnoCategoria]);

  React.useEffect(function () {
    setCoachRoutineDiaIdx(0);
    setCoachDiaSecsOpen({ warmup: true, main: true });
    setCoachRutinaMenuOpen(false);
  }, [alumnoActivo?.id]);

  const startTimer = (secs, color) => {
    if (secs <= 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setTimer(null);
      return;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimer({ total: secs, color, endAt: Date.now() + secs * 1000 });
  };

  const sessionDataRef = React.useRef(sessionData);React.useEffect(()=>{sessionDataRef.current=sessionData;},[sessionData]);const logSet = (exId, kg, reps, note, rpe) => {
    const d = new Date().toLocaleDateString("es-AR");
    setProgress(prev=>{
      const ex = {...(prev[exId]||{sets:[],max:0})};
      ex.sets = [{kg:parseFloat(kg)||0,reps:parseInt(reps)||0,date:d,week:currentWeek,note,rpe:rpe||null},...(ex.sets||[])].slice(0,50);
      ex.max = Math.max(ex.max||0,parseFloat(kg)||0);
      return {...prev,[exId]:ex};
    });
    // Guardar en Supabase — si offline, guardar en cola local
    const alumnoIdSync = (()=>{try{return JSON.parse(localStorage.getItem("it_session")||"null")?.alumnoId}catch(e){return null}})() || (readOnly&&sharedParam?(()=>{try{return JSON.parse(atob(sharedParam)).alumnoId}catch(e){return null}})():null);
    if(alumnoIdSync) {
      if(!isOnline) {
        const item = {exId, kg:parseFloat(kg)||0, reps:parseInt(reps)||0, note:note||'', date:d};
        const updated = [...pendingSync, item];
        setPendingSync(updated);
        try{localStorage.setItem('it_pending_sync', JSON.stringify(updated));}catch(e){}
      } else {
        sb.addProgreso({
          alumno_id: alumnoIdSync,
          ejercicio_id: exId,
          kg: parseFloat(kg)||0,
          reps: parseInt(reps)||0,
          nota: note||"",
          fecha: d
        }).then(function(r){console.log("[PROGRESO] OK",r)}).catch(function(e){console.error("[PROGRESO] ERR",e)});
      }
    }
    // Detectar PR y celebrar (fuera del setter para tener acceso al scope)
    const exPrevData = progress[exId]||{sets:[],max:0};
    const newKgVal = parseFloat(kg)||0;
    if(newKgVal > (exPrevData.max||0) && (exPrevData.max||0) > 0) {
      const inf = [...EX,...(customEx||[])].find(e=>e.id===exId);
      const exR = routines.flatMap(r=>r.days||[]).flatMap(d=>[...(d.warmup||[]),...(d.exercises||[])]).find(e=>e.id===exId);
      const nombreEj = resolveExerciseTitle(inf || null, exR || null, es);
      const prevMax = exPrevData.max||0;
      const diff = Math.round((newKgVal - prevMax)*10)/10;
      setPrCelebration({ejercicio: nombreEj, kg: newKgVal, prevKg: prevMax, diff: diff, exId: exId});
      // Guardar PR en lista de la sesión
      setSessionPRList(function(prev){
        var existe = prev.find(function(p){return p.exId===exId && p.kg===newKgVal});
        if(existe) return prev;
        return [...prev, {exId:exId, ejercicio:nombreEj, kg:newKgVal, prevKg:prevMax, diff:diff}];
      });
      setTimeout(()=>setPrCelebration(null), 3000);
    }
    if(!isOnline) {
      toast2(es?'Set guardado localmente':'Set saved locally');
    } else {
      toast2(es?'Serie guardada ✓':'Set saved ✓');
    }
    // Actualizar kg en la rutina para autocompletar sets restantes
    if(parseFloat(kg)>0) {
      setRoutines(prev=>prev.map(r=>({...r,days:r.days.map(d=>({...d,
        exercises:d.exercises.map(ex=>ex.id===exId?{...ex,kg:String(kg)}:ex),
        warmup:(d.warmup||[]).map(ex=>ex.id===exId?{...ex,kg:String(kg)}:ex)
      }))})));
    }
  };

  const bg=darkMode?"#0F1923":"#F0F4F8";
  const bgCard=darkMode?"#1E2D40":"#FFFFFF";
  const bgSub=darkMode?"#162234":"#E2E8F0";
  const border=darkMode?"#2D4057":"#2D4057";
  const textMain=darkMode?"#FFFFFF":"#0F1923";
  const textMuted=darkMode?"#8B9AB2":"#64748B";
  const green=darkMode?"#22C55E":"#16A34A";
  const greenSoft=darkMode?"rgba(34,197,94,0.12)":"rgba(22,163,74,0.1)";
  const greenBorder=darkMode?"rgba(34,197,94,0.25)":"rgba(22,163,74,0.25)";
  /** Coach — pestaña Alumnos: en modo día, superficies claras que contrasten con el scroll blanco. */
  const coachAluShell = darkMode ? "#0a0f1a" : "#f1f5f9";
  const coachAluSurface = darkMode ? "#111827" : "#ffffff";
  const coachAluSubtle = darkMode ? "#0f172a" : "#f8fafc";
  const coachAluBorderSoft = darkMode ? "rgba(59,130,246,0.22)" : "#e2e8f0";
  const coachAluTrack = darkMode ? "#1e293b" : "#e2e8f0";
  const coachAluDropdown = darkMode ? "#111827" : "#ffffff";
  const coachAluDropdownShadow = darkMode ? "0 12px 32px rgba(0,0,0,0.55)" : "0 12px 28px rgba(15,23,42,0.12)";
  const coachAluGhostBtn = darkMode ? "#162234" : "#f1f5f9";
  const card={background:bgCard,borderRadius:16,padding:"22px 24px",marginBottom:12,border:"1px solid "+border,boxShadow:darkMode?"0 4px 16px rgba(0,0,0,0.5)":"0 2px 8px rgba(0,0,0,0.08)"};
  const inp={background:bgSub,color:textMain,border:"1px solid "+border,borderRadius:12,padding:"8px 12px",fontSize:15,fontFamily:"Inter,sans-serif",width:"100%",boxSizing:"border-box"};
  const lbl={fontSize:13,fontWeight:600,letterSpacing:0.3,color:textMuted,marginBottom:4,display:"block"};
  const btn=(col,txt)=>({background:col||(darkMode?"#2D4057":"#E2E8F0"),color:txt||(darkMode?"#FFFFFF":"#0F1923"),border:"none",borderRadius:8,padding:"8px 16px",fontFamily:"Barlow Condensed,sans-serif",fontSize:15,fontWeight:700,cursor:"pointer",letterSpacing:1});
  const tag=(col)=>({background:"#162234",color:"#8B9AB2",border:"1px solid #2D4057",borderRadius:6,padding:"4px 8px",fontSize:13,fontWeight:700});

  const allEx = React.useMemo(function () {
    var BIB_PAT = { empuje: 1, traccion: 1, rodilla: 1, bisagra: 1, core: 1, movilidad: 1, cardio: 1, oly: 1 };
    var po = patternOverrides || {};
    var catalog = EX.map(function (e) {
      var n = normalizeLibraryExercise(e, { catalog: true });
      var p = po[n.id];
      if (p && BIB_PAT[p]) return { ...n, pattern: p };
      return n;
    });
    var custom = (customEx || []).map(function (e) { return normalizeLibraryExercise(e, { catalog: false }); });
    return catalog.concat(custom);
  }, [customEx, patternOverrides]);
  const filteredEx = allEx.filter(e=>{
    const q=search.toLowerCase();
    if(filterPat && e.pattern!==filterPat) return false;
    if(!q) return true;
    return e.name.toLowerCase().includes(q)||e.nameEn.toLowerCase().includes(q)||bibMuscleFilterHaystack(e.muscle).includes(q);
  });

  /** Datos normalizados para GlobalSearch (coach). */
  const coachGlobalSearchData = React.useMemo(
    function () {
      if (sessionData?.role !== "entrenador") {
        return { alumnos: [], rutinas: [], ejercicios: [], sesiones: [] };
      }
      var weekMs = 7 * 24 * 60 * 60 * 1000;
      var weekAgo = Date.now() - weekMs;
      var sg = sesionesGlobalesLimpias || [];
      var alumnosSearch = (alumnosActivosLimpios || []).map(function (a) {
        var cat = coachAlumnoCategoria(a);
        var estado = cat === "activo" ? "ok" : cat === "inactivo" ? "inactivo" : "riesgo";
        var sesCount = sg.filter(function (s) {
          return s.alumno_id === a.id;
        }).length;
        var weekSessions = sg.filter(function (s) {
          if (s.alumno_id !== a.id) return false;
          var t = new Date(s.created_at || 0).getTime();
          return !isNaN(t) && t >= weekAgo;
        }).length;
        var pct = Math.min(100, Math.round((weekSessions / 3) * 100));
        return {
          id: a.id,
          nombre: a.nombre || a.email || "Sin nombre",
          pctSemanal: pct,
          sesionesCompletadas: sesCount,
          estado: estado,
        };
      });
      var rutinasSearch = (rutinasSBEntrenadorLimpias || []).map(function (rSB) {
        var dias = rSB.datos?.days || [];
        var ejCount = dias.reduce(function (acc, d) {
          return acc + (d.warmup || []).length + (d.exercises || []).length;
        }, 0);
        var alum = alumnosActivosLimpios.find(function (al) {
          return al.id === rSB.alumno_id;
        });
        return {
          id: rSB.id,
          nombre: rSB.nombre || "Rutina",
          ejerciciosCount: ejCount,
          semanaActual: dias.length ? String(dias.length) : "—",
          alumnosAsignados: alum ? alum.nombre || alum.email : "—",
        };
      });
      var ejerciciosSearch = allEx.slice(0, 280).map(function (e) {
        var pat = String(e.pattern || "").toLowerCase();
        var tipo = /compound|multi|push|pull|squat|hinge/i.test(pat) ? "compuesto" : "aislado";
        return {
          id: e.id,
          nombre: e.name || e.nameEn || e.id,
          grupoMuscular: e.muscle || "—",
          tipo: tipo,
        };
      });
      var sesionesSearch = sg.slice(0, 150).map(function (s, idx) {
        var alum = alumnosActivosLimpios.find(function (al) {
          return al.id === s.alumno_id;
        });
        var raw = s.created_at || s.fecha || "";
        var fechaLabel = raw
          ? new Date(raw).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })
          : "—";
        var pend = s.estado === "pendiente" || s.completada === false;
        return {
          id: s.id != null ? s.id : "ses-" + String(s.alumno_id) + "-" + idx,
          alumnoId: s.alumno_id,
          alumnoNombre: alum ? alum.nombre || alum.email : "Alumno",
          tipoSesion: s.tipo || s.nota || "Entrenamiento",
          fechaLabel: fechaLabel,
          estado: pend ? "pendiente" : "completada",
        };
      });
      return {
        alumnos: alumnosSearch,
        rutinas: rutinasSearch,
        ejercicios: ejerciciosSearch,
        sesiones: sesionesSearch,
      };
    },
    [sessionData, alumnosActivosLimpios, sesionesGlobalesLimpias, rutinasSBEntrenadorLimpias, allEx, coachAlumnoCategoria]
  );

  var coachGlobalSearchNavigate = React.useCallback(
    function (seccion, id) {
      if (seccion === "alumnos") {
        var alum = (alumnosActivosLimpios || []).find(function (x) {
          return String(x.id) === String(id);
        });
        if (!alum) return;
        setAlumnoActivo(alum);
        setTab("alumnos");
        setLoadingSB(true);
        Promise.all([sb.getRutinas(alum.id), sb.getProgreso(alum.id), sb.getSesiones(alum.id)])
          .then(function (r) {
            setRutinasSB(r[0] || []);
            setAlumnoProgreso(r[1] || []);
            setAlumnoSesiones(r[2] || []);
          })
          .catch(function (e) {
            console.error("[GlobalSearch alumnos]", e);
          })
          .finally(function () {
            setLoadingSB(false);
          });
        return;
      }
      if (seccion === "rutinas") {
        setTab("routines");
        return;
      }
      if (seccion === "ejercicios") {
        setTab("biblioteca");
        return;
      }
      if (seccion === "sesiones") {
        var aid = id;
        var alum2 = (alumnosActivosLimpios || []).find(function (x) {
          return String(x.id) === String(aid);
        });
        if (!alum2) return;
        setAlumnoActivo(alum2);
        setTab("alumnos");
        setLoadingSB(true);
        Promise.all([sb.getRutinas(alum2.id), sb.getProgreso(alum2.id), sb.getSesiones(alum2.id)])
          .then(function (r) {
            setRutinasSB(r[0] || []);
            setAlumnoProgreso(r[1] || []);
            setAlumnoSesiones(r[2] || []);
          })
          .catch(function (e) {
            console.error("[GlobalSearch sesiones]", e);
          })
          .finally(function () {
            setLoadingSB(false);
          });
      }
    },
    [alumnosActivosLimpios, sb, setAlumnoActivo, setTab, setLoadingSB, setRutinasSB, setAlumnoProgreso, setAlumnoSesiones]
  );

  const activeR = session ? routines.find(r=>r.id===session.rId) : null;
  const activeDay = activeR ? activeR.days[session.dIdx] : null;
  const alumnoPlanHeaderDayNum = useMemo(
    function () {
      if (!esAlumno || tab !== "plan" || !routines[0]) return null;
      const r0 = routines[0];
      const totalDays = r0.days?.length || 0;
      if (totalDays === 0) return null;
      const daysCompletedThisWeek = completedDays.filter(function (k) {
        return k.startsWith((r0.id || "") + "-") && k.endsWith("-w" + currentWeek);
      }).length;
      if (daysCompletedThisWeek >= totalDays) return null;
      return daysCompletedThisWeek + 1;
    },
    [esAlumno, tab, routines, completedDays, currentWeek]
  );
  const showAlumnoProgressStack = (readOnly||esAlumno)&&(sharedParam||sessionData?.alumnoId);
  const coachDesktop1024 = useDesktopMin1024();
  /** Shell coach (sidebar App + dashboard embebido): todos los anchos; la barra lateral se oculta por CSS por debajo de lg. */
  const showCoachDesktopShell = !esAlumno && sessionData?.role === "entrenador";
  /** Tabs coach desktop sin barra superior global (misma envolvente que plan / progreso). */
  const coachDesktopBleedTab =
    tab === "plan" || tab === "calendar" || tab === "progress" || tab === "settings" || tab === "perfil";
  /** Coach: ocultar header global (logo + settings + salir) cuando la sidebar ya concentra esa navegación. En desktop, Alumnos/Rutinas/Ejercicios se alinean con Plan (sin barra duplicada). En móvil siguen mostrando el header en esas tabs (sidebar no visible). */
  const coachSuppressTopNav =
    showCoachDesktopShell &&
    !esAlumno &&
    (coachDesktopBleedTab ||
      (coachDesktop1024 && (tab === "alumnos" || tab === "calendar" || tab === "routines" || tab === "biblioteca")));
  useEffect(() => {
    if (coachDesktop1024) return; // solo mobile
    const appEl = document.getElementById("app-root") || document.body;
    let touchStartX = 0;
    let touchStartY = 0;
    let dragging = false;
    let axisLocked = false;

    function onTouchStart(e) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      dragging = false;
      axisLocked = false;
      const fromLeft = touchStartX;
      // abrir: swipe desde borde izquierdo (≤40px); cerrar: drawer abierto
      if (!mobileDrawerOpen && fromLeft > 40) return;
      dragging = true;
    }

    function onTouchMove(e) {
      if (!dragging) return;
      const dx = e.touches[0].clientX - touchStartX;
      const dy = e.touches[0].clientY - touchStartY;
      if (!axisLocked) {
        if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
        axisLocked = true;
        if (Math.abs(dy) > Math.abs(dx)) {
          dragging = false;
          return;
        }
      }
      e.preventDefault();
    }

    function onTouchEnd(e) {
      if (!dragging) return;
      dragging = false;
      axisLocked = false;
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (mobileDrawerOpen) {
        if (dx < -50) setMobileDrawerOpen(false);
      } else {
        if (dx > 50) setMobileDrawerOpen(true);
      }
    }

    appEl.addEventListener("touchstart", onTouchStart, { passive: true });
    appEl.addEventListener("touchmove", onTouchMove, { passive: false });
    appEl.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      appEl.removeEventListener("touchstart", onTouchStart);
      appEl.removeEventListener("touchmove", onTouchMove);
      appEl.removeEventListener("touchend", onTouchEnd);
    };
  }, [coachDesktop1024, mobileDrawerOpen]);
  const routineDaysCount = Math.max(1, (routines[0]?.days?.length)||3);
  const tabs2 = esAlumno
    ? [
        {k:"plan",    icon:(c)=><CalNavIcon size={20} color={c} strokeWidth={2}/>,      lbl:msg("PLAN", "PLAN")},
        {k:"library", icon:(c)=><Dumbbell size={20} color={c} strokeWidth={2}/>, lbl:msg("EJERCICIOS", "EXERCISES")},
        {k:"progress",icon:(c)=><TrendNavIcon size={20} color={c} strokeWidth={2}/>,  lbl:msg("PROGRESO", "PROGRESS")}
      ]
    : [
        {k:"plan",      icon:(c)=><Ic name="bar-chart-2" size={20} color={c}/>, lbl:msg("DASHBOARD", "DASHBOARD")},
        {k:"calendar",  icon:(c)=><CalendarDays size={20} color={c} strokeWidth={2}/>, lbl:msg("CALENDARIO", "CALENDAR")},
        {k:"routines",  icon:(c)=><Ic name="file-text" size={20} color={c}/>,  lbl:msg("RUTINAS", "ROUTINES")},
        {k:"biblioteca",icon:(c)=><Ic name="activity" size={20} color={c}/>, lbl:msg("EJERCICIOS", "EXERCISES")},
        {k:"alumnos",   icon:(c)=><Ic name="users" size={20} color={c}/>,  lbl:msg("ALUMNOS", "ATHLETES")}
      ];

  /** En desktop el coach usa sidebar App; en móvil necesita la bottom nav también en Dashboard. */
  const hideGlobalBottomNavCoachDash =
    !esAlumno && sessionData?.role === "entrenador" && coachDesktopBleedTab && coachDesktop1024;
  const alumnoTopBarFixed = !!(esAlumno && (tab === "plan" || tab === "library" || tab === "progress"));
  const alumnoTopBarHeight = alumnoTopBarFixed ? "calc(env(safe-area-inset-top, 0px) + 96px)" : "0px";

  planScrollCtxRef.current = {
    alumnoPlan: !!(esAlumno && tab === "plan"),
    /** Modo alumno: nunca colapsar el bloque HOY/expandido por gesto scroll. */
    headerCollapse:
      !!(planScrollDiag.headerCollapseOnScroll && !esAlumno),
    alumnoFixedTabs: !!(esAlumno && (tab === "plan" || tab === "library" || tab === "progress")),
    alumnoTopBarPx: alumnoTopBarHeight,
  };

  /** Al cambiar de pestaña, restaurar barra superior (por si quedó oculta al final del scroll). */
  useLayoutEffect(
    function () {
      var nav = alumnoAppHeaderRef.current;
      var sp = alumnoTopBarSpacerRef.current;
      if (nav) {
        nav.style.transform = "";
        nav.style.transition = "";
      }
      if (sp && alumnoTopBarFixed) {
        sp.style.height = alumnoTopBarHeight;
        sp.style.minHeight = alumnoTopBarHeight;
        sp.style.transition = "";
      }
    },
    [tab, alumnoTopBarFixed, alumnoTopBarHeight]
  );

  /** Altura del shell: medición monótona (solo crece) + height fija = slot estable; el colapso es solo transform/opacity. */
  useLayoutEffect(function () {
    if (!planScrollDiag.headerResizeObserver) return undefined;
    if (typeof ResizeObserver === "undefined") return undefined;
    if (!esAlumno || tab !== "plan") return undefined;
    studentHeaderShellLockedHeightPxRef.current = 0;
    shellMinHeightPxRef.current = -1;
    var cancelled = false;
    var ro = null;
    var waitId = null;
    var attempts = 0;
    function flushShellMeasure() {
      shellMeasureRafRef.current = null;
      if (cancelled) return;
      var expand = studentHeaderExpandRef.current;
      var shell = studentHeaderShellRef.current;
      if (!expand || !shell) return;
      var contentH = Math.max(expand.offsetHeight, expand.scrollHeight);
      var measuredPx = Math.ceil(contentH + ALUMNO_HEADER_MINI_PX);
      var lockedPx = Math.max(studentHeaderShellLockedHeightPxRef.current, measuredPx);
      if (lockedPx < 1) return;
      studentHeaderShellLockedHeightPxRef.current = lockedPx;
      if (lockedPx === shellMinHeightPxRef.current) {
        if (expand.offsetHeight > 0) studentHeaderExpandHeightRef.current = expand.offsetHeight;
        applyAlumnoHeaderLayerStyles(headerCollapsedRef.current);
        return;
      }
      shellMinHeightPxRef.current = lockedPx;
      shell.style.minHeight = lockedPx + "px";
      shell.style.height = lockedPx + "px";
      shell.style.boxSizing = "border-box";
      if (expand.offsetHeight > 0) studentHeaderExpandHeightRef.current = expand.offsetHeight;
      applyAlumnoHeaderLayerStyles(headerCollapsedRef.current);
    }
    function scheduleShellMeasure() {
      if (shellMeasureRafRef.current != null) return;
      shellMeasureRafRef.current = requestAnimationFrame(flushShellMeasure);
    }
    function onResizeObserver() {
      scheduleShellMeasure();
    }
    function tryConnect() {
      if (cancelled) return;
      attempts++;
      var expand = studentHeaderExpandRef.current;
      var shell = studentHeaderShellRef.current;
      if (expand && shell) {
        shellMinHeightPxRef.current = -1;
        scheduleShellMeasure();
        ro = new ResizeObserver(onResizeObserver);
        ro.observe(expand);
        return;
      }
      if (attempts < 120) waitId = requestAnimationFrame(tryConnect);
    }
    waitId = requestAnimationFrame(tryConnect);
    return function () {
      cancelled = true;
      if (waitId != null) cancelAnimationFrame(waitId);
      if (shellMeasureRafRef.current != null) {
        cancelAnimationFrame(shellMeasureRafRef.current);
        shellMeasureRafRef.current = null;
      }
      if (ro) ro.disconnect();
      shellMinHeightPxRef.current = -1;
      studentHeaderShellLockedHeightPxRef.current = 0;
    };
  }, [tab, esAlumno, routines.length, planScrollDiag.headerResizeObserver]);

  /** Filas del plan para imprimir/PDF — misma estructura que antes; el HTML se arma en `exportRoutinePdfHtml` (sin vista previa en pantalla). */
  const downloadRoutinePdf = (r) => {
    const patColors = {pierna:"#22C55E",empuje:"#2563EB",traccion:"#2563EB",core:"#8B9AB2",movil:"#8B9AB2"};
    const weeks4 = [0,1,2,3];
    let rows = [];
    r.days.forEach((d,di) => {
      rows.push({type:"day", label:"DIA "+(di+1)+(d.label&&d.label!=="Dia "+(di+1)?" — "+d.label:""), di});
      if(d.warmup && d.warmup.length>0) {
        rows.push({type:"warmup-header"});
        d.warmup.forEach((ex,ei) => {
          const inf = allEx.find(e=>e.id===ex.id);
          const exName = resolveExerciseTitle(inf || null, ex, es);
          const wks = weeks4.map(wi => {
            const w = (ex.weeks||[])[wi]||{};
            return {s:w.sets||ex.sets||"-", r:w.reps||ex.reps||"-", kg:w.kg||ex.kg||"", note:w.note||"", filled:!!(w.sets||w.reps||w.kg), active:wi===currentWeek};
          });
          rows.push({type:"warmup-ex", exName, ex, wks});
        });
      }
      if(d.exercises && d.exercises.length>0) {
        rows.push({type:"main-header"});
        d.exercises.forEach((ex,ei) => {
          const inf = allEx.find(e=>e.id===ex.id);
          const pat = inf?.pattern||"empuje";
          const col = patColors[pat]||"#2563EB";
          const exName = resolveExerciseTitle(inf || null, ex, es);
          const wks = weeks4.map(wi => {
            const w = (ex.weeks||[])[wi]||{};
            return {s:w.sets||ex.sets||"-", r:w.reps||ex.reps||"-", kg:w.kg||ex.kg||"", note:w.note||"", filled:!!(w.sets||w.reps||w.kg), active:wi===currentWeek};
          });
          const lastRpe = progress[ex.id]?.sets?.[0]?.rpe||null;
          rows.push({type:"ex", exName, info:inf, pat, col, ex, wks, lastRpe});
        });
      }
    });
    exportRoutinePdfHtml(r, rows, es, toast2, { textMain, bgCard, border, darkMode, textMuted, currentWeek });
  };

  function getCoachDialogModalConfig() {
    var c = coachDialog;
    if (c.t === 'none') {
      return { tone: 'danger', title: '', message: '', subjectName: null, confirmLabel: msg('Aceptar', 'OK', 'OK'), useLogoutIcon: false };
    }
    if (c.t === 'deleteAlumno') {
      return {
        tone: 'danger',
        title: msg('Eliminar alumno', 'Delete student', 'Excluir aluno'),
        message: msg(
          'Esta acción no se puede deshacer. El alumno se eliminará definitivamente.',
          'This action cannot be undone. The athlete will be permanently removed.',
          'Esta ação não pode ser desfeita. O aluno será excluído permanentemente.'
        ),
        subjectName: c.a && (c.a.nombre || c.a.email),
        confirmLabel: msg('Eliminar', 'Delete', 'Excluir'),
        useLogoutIcon: false,
        loadingLabel: msg('Eliminando…', 'Removing…', 'Excluindo…'),
      };
    }
    if (c.t === 'clearProgress' && c.a) {
      return {
        tone: 'danger',
        title: msg('Limpiar historial de progreso', 'Clear progress history', 'Limpar histórico de progresso'),
        message: msg(
          'Esta acción eliminará los PRs, sesiones completadas, volumen, tonelaje y métricas de progreso de este alumno. La rutina asignada y los datos personales se mantendrán. Esta acción no se puede deshacer.',
          'This action will delete this athlete’s PRs, completed sessions, volume, tonnage, and progress metrics. The assigned routine and personal data will be kept. This action cannot be undone.',
          'Esta ação eliminará os PRs, sessões concluídas, volume, tonelagem e métricas de progresso deste aluno. A rotina atribuída e os dados pessoais serão mantidos. Esta ação não pode ser desfeita.'
        ),
        subjectName: c.a && (c.a.nombre || c.a.email),
        confirmLabel: msg('Limpiar historial', 'Clear history', 'Limpar histórico'),
        useLogoutIcon: false,
        loadingLabel: msg('Limpiando…', 'Clearing…', 'Limpando…'),
        requireAcknowledge: true,
        acknowledgeLabel: msg(
          'Entiendo que esta acción no se puede deshacer',
          'I understand this action cannot be undone',
          'Entendo que esta ação não pode ser desfeita'
        ),
      };
    }
    if (c.t === 'quitarRut') {
      return {
        tone: 'danger',
        title: msg('Quitar rutina', 'Remove routine', 'Remover rotina'),
        message: msg(
          'Esta acción no se puede deshacer. La rutina se desasignará y se eliminará del registro.',
          'This action cannot be undone. The routine will be unassigned and removed from the record.',
          'Esta ação não pode ser desfeita. A rotina será desatribuída e removida do registro.'
        ),
        subjectName: c.rutinaActiva && c.rutinaActiva.nombre,
        confirmLabel: msg('Quitar', 'Remove', 'Remover'),
        useLogoutIcon: false,
        loadingLabel: msg('Quitando…', 'Removing…', 'Removendo…'),
      };
    }
    if (c.t === 'resetWeek') {
      return {
        tone: 'caution',
        title: msg('Reiniciar semana', 'Reset week', 'Redefinir semana'),
        message: es
          ? '¿Reiniciar la semana actual? El alumno volverá a Día 1 de la semana ' + c.semanaCiclo + '.'
          : 'Reset the current week? The athlete will restart at Day 1 of week ' + c.semanaCiclo + '.',
        subjectName: null,
        confirmLabel: msg('Reiniciar', 'Reset', 'Redefinir'),
        useLogoutIcon: false,
        loadingLabel: msg('Aplicando…', 'Applying…', 'Aplicando…'),
      };
    }
    if (c.t === 'resetRoutine') {
      return {
        tone: 'caution',
        title: msg('Reiniciar rutina', 'Reset routine', 'Redefinir rotina'),
        message: msg(
          '¿Reiniciar la rutina completa? Volverá a Semana 1, Día 1. El historial de progreso se mantiene.',
          'Reset the entire routine? It will go back to Week 1, Day 1. Progress history is kept.',
          'Redefinir a rotina completa? Volta à Semana 1, Dia 1. O histórico de progresso é mantido.'
        ),
        subjectName: null,
        confirmLabel: msg('Reiniciar', 'Reset', 'Redefinir'),
        useLogoutIcon: false,
        loadingLabel: msg('Aplicando…', 'Applying…', 'Aplicando…'),
      };
    }
    if (c.t === 'editAlum') {
      return {
        tone: 'neutral',
        title: msg('Editar alumno', 'Edit athlete', 'Editar aluno'),
        message: msg('Se abrirá el formulario para modificar email y contraseña del alumno.', 'A form will open to edit the athlete’s email and password.', 'O formulário será aberto para editar e-mail e senha do aluno.'),
        subjectName: c.a && (c.a.nombre || c.a.email),
        confirmLabel: msg('Continuar', 'Continue', 'Continuar'),
        useLogoutIcon: false,
        loadingLabel: msg('…', '…', '…'),
      };
    }
    if (c.t === 'goRoutines') {
      return {
        tone: 'neutral',
        title: msg('Abrir en Rutinas', 'Open in Routines', 'Abrir em Rotinas'),
        message: msg('Se abrirá la pestaña RUTINAS con esta rutina para editarla.', 'The Routines tab will open with this routine for editing.', 'A aba Rotinas abrirá com esta rotina para edição.'),
        subjectName: c.rutinaActiva && c.rutinaActiva.nombre,
        confirmLabel: msg('Abrir', 'Open', 'Abrir'),
        useLogoutIcon: false,
        loadingLabel: msg('…', '…', '…'),
      };
    }
    if (c.t === 'assignRut') {
      return {
        tone: 'caution',
        title: c.ex
          ? msg('Cambiar rutina asignada', 'Change assigned routine', 'Trocar rotina atribuída')
          : msg('Asignar rutina', 'Assign routine', 'Atribuir rotina'),
        message: c.assignMsg,
        subjectName: null,
        confirmLabel: msg('Confirmar', 'Confirm', 'Confirmar'),
        useLogoutIcon: false,
        loadingLabel: msg('Asignando…', 'Assigning…', 'Atribuindo…'),
      };
    }
    if (c.t === 'logout' || c.t === 'logoutSettings') {
      return {
        tone: 'neutral',
        title: msg('¿Cerrar sesión?', 'Log out?', 'Encerrar sessão?'),
        message: msg('Vas a salir y tendrás que volver a iniciar sesión.', "You'll sign out and will need to sign in again.", 'Você sairá e precisará entrar de novo.'),
        subjectName: null,
        confirmLabel: msg('Cerrar sesión', 'Log out', 'Sair'),
        useLogoutIcon: true,
        loadingLabel: msg('Cerrando…', 'Signing out…', 'Saindo…'),
      };
    }
    return { tone: 'danger', title: '', message: '', subjectName: null, confirmLabel: 'OK', useLogoutIcon: false, loadingLabel: '…' };
  }

  async function clearAlumnoProgressHistory(alumnoId) {
    var aid = alumnoId != null ? String(alumnoId) : "";
    if (!aid) throw new Error("alumnoId requerido");

    await Promise.all([
      sb.deleteProgresoByAlumno(aid),
      sb.deleteSesionesByAlumno(aid),
    ]);

    setAlumnoProgreso(function (prev) {
      if (!alumnoActivo || String(alumnoActivo.id) === aid) return [];
      return prev || [];
    });
    setAlumnoSesiones(function (prev) {
      if (!alumnoActivo || String(alumnoActivo.id) === aid) return [];
      return prev || [];
    });
    setSesionesGlobales(function (prev) {
      return (prev || []).filter(function (s) {
        return String(s && s.alumno_id) !== aid;
      });
    });
    setProgresoGlobal(function (prev) {
      var next = Object.assign({}, prev || {});
      delete next[aid];
      return next;
    });
    setSesiones(function (prev) {
      if (!Array.isArray(prev)) return prev;
      return prev.filter(function (s) {
        return String(s && s.alumno_id) !== aid;
      });
    });
    setSugerencias(function (prev) {
      if (!prev || typeof prev !== "object") return prev;
      var next = Object.assign({}, prev);
      delete next[aid];
      return next;
    });

    var rutinaIdsAlumno = {};
    mergeRutinasAsignadas(rutinasUnificadas, rutinasSBEntrenador, alumnosActivosIds).concat(rutinasSB || []).forEach(function (r) {
      if (r && String(r.alumno_id) === aid && r.id != null) rutinaIdsAlumno[String(r.id)] = true;
    });
    setCompletedDays(function (prev) {
      return (prev || []).filter(function (k) {
        var key = String(k);
        return !Object.keys(rutinaIdsAlumno).some(function (rid) {
          return key.startsWith(rid + "-");
        });
      });
    });

    try {
      var sessRaw = localStorage.getItem("it_session");
      var sess = sessRaw ? JSON.parse(sessRaw) : null;
      if (sess && sess.alumnoId != null && String(sess.alumnoId) === aid) {
        localStorage.setItem("it_pg", JSON.stringify({}));
        setProgress({});
      }
    } catch (e) {}

    setPendingSync(function (prev) {
      var next = (prev || []).filter(function (item) {
        if (!item || item.alumno_id == null) return true;
        return String(item.alumno_id) !== aid;
      });
      try { localStorage.setItem("it_pending_sync", JSON.stringify(next)); } catch (e) {}
      return next;
    });

    if (alumnoActivo && String(alumnoActivo.id) === aid) {
      setRegistrosSubTab(0);
      try {
        var freshRutinas = await sb.getRutinas(aid);
        setRutinasSB(freshRutinas || []);
      } catch (e) {}
    }

    cargarSesionesGlobales();
    return true;
  }

  async function confirmCoachDialog() {
    var c = coachDialog;
    if (c.t === 'none') return;
    setCoachDialogLoading(c.t === 'deleteAlumno' || c.t === 'quitarRut' || c.t === 'assignRut' || c.t === 'clearProgress');
    try {
      if (c.t === 'deleteAlumno' && c.a) {
        if (typeof sb.deleteAlumno === 'function') {
          await sb.deleteAlumno(c.a.id);
        }
        setAlumnos(function (prev) {
          return prev.filter(function (x) {
            return x.id !== c.a.id;
          });
        });
        toast2(msg('Alumno eliminado', 'Athlete removed', 'Aluno excluído'));
        setCoachDialog({ t: 'none' });
        return;
      }
      if (c.t === 'clearProgress' && c.a) {
        await clearAlumnoProgressHistory(c.a.id);
        toast2(msg('Historial de progreso limpiado', 'Progress history cleared', 'Histórico de progresso limpo'));
        setCoachDialog({ t: 'none' });
        return;
      }
      if (c.t === 'quitarRut' && c.rutinaActiva) {
        try {
          await sb.deleteRutina(c.rutinaActiva.id);
          var ridQ = c.rutinaActiva.id;
          setRutinasSB(function (prev) {
            return prev.filter(function (x) {
              return String(x.id) !== String(ridQ);
            });
          });
          setRutinasSBEntrenador(function (prev) {
            return prev.filter(function (x) {
              return String(x.id) !== String(ridQ);
            });
          });
          await cargarRutinasEntrenador();
          toast2(msg('Quitada', 'Removed', 'Removida'));
        } catch (e0) {
          toast2(msg('No se pudo quitar la rutina.', 'Could not remove the routine.', 'Não foi possível remover a rotina.'));
        }
        setCoachDialog({ t: 'none' });
        return;
      }
      if (c.t === 'resetWeek' && c.semanaCiclo != null) {
        setCompletedDays(function (prev) {
          return prev.filter(function (k) {
            return !k.endsWith('-w' + (c.semanaCiclo - 1));
          });
        });
        setCoachRutinaMenuOpen(false);
        toast2(msg('Semana reiniciada ✓', 'Week reset ✓', 'Semana reiniciada ✓'));
        setCoachDialog({ t: 'none' });
        return;
      }
      if (c.t === 'resetRoutine') {
        setCompletedDays([]);
        setCurrentWeek(0);
        try {
          localStorage.removeItem('it_last_week_advance_date');
        } catch (e) {}
        setCoachRutinaMenuOpen(false);
        toast2(msg('Rutina reiniciada ✓', 'Routine reset ✓', 'Rotina reiniciada ✓'));
        setCoachDialog({ t: 'none' });
        return;
      }
      if (c.t === 'editAlum' && c.a) {
        setEditAlumnoModal(c.a);
        setEditAlumnoEmail(c.a.email);
        setEditAlumnoPass('');
        setCoachDialog({ t: 'none' });
        return;
      }
      if (c.t === 'goRoutines' && c.rutinaActiva && c.rutina) {
        setRoutines(function (prev) {
          var ex = prev.find(function (x) {
            return x.id === c.rutina.id;
          });
          if (ex) {
            return prev.map(function (x) {
              return x.id === c.rutina.id ? c.rutina : x;
            });
          }
          return [c.rutina].concat(prev);
        });
        setTab('routines');
        toast2(msg('Abierta en RUTINAS', 'Opened in ROUTINES', 'Aberta em ROTINAS'));
        setCoachDialog({ t: 'none' });
        return;
      }
      if (c.t === 'assignRut' && c.a && c.rutinaLocal) {
        setLoadingSB(true);
        try {
          await assignRoutineToAlumno({ alumno: c.a, rutina: c.rutinaLocal, previousRoutine: c.ex || null });
          toast2('Rutina asignada ✓');
        } catch (eAssignRut) {
          console.error('[assignRut] error al asignar rutina', eAssignRut);
          toast2('Error al asignar rutina');
        }
        setLoadingSB(false);
        setCoachDialog({ t: 'none' });
        return;
        /*
        var authSessionAssign = await getActiveSupabaseSession();
        if (!authSessionAssign) {
          console.error("[AUTH] No hay sesión activa");
          toast2('Iniciá sesión nuevamente para asignar rutinas');
          setLoadingSB(false);
          setCoachDialog({ t: 'none' });
          return;
        }
        var alumnoIdAssign = c.a && c.a.id ? String(c.a.id) : "";
        var entrenadorIdAssign = authSessionAssign.user && authSessionAssign.user.id ? String(authSessionAssign.user.id) : "";
        if (!alumnoIdAssign || !entrenadorIdAssign || !c.rutinaLocal) {
          console.error('[assignRut] datos invalidos', {
            alumno_id: alumnoIdAssign || null,
            entrenador_id: entrenadorIdAssign || null,
            alumno: c.a,
            rutinaLocal: c.rutinaLocal,
          });
          toast2('Error al asignar rutina');
          setLoadingSB(false);
          setCoachDialog({ t: 'none' });
          return;
        }
        var nombreAssign = c.rutinaLocal?.nombre || c.rutinaLocal?.name || "Rutina";
        var daysAssign = c.rutinaLocal?.datos?.days || c.rutinaLocal?.days || [];
        if (!Array.isArray(daysAssign)) {
          console.error('[assignRut] days no es array', { days: daysAssign, rutinaLocal: c.rutinaLocal });
          toast2('Error: la rutina no tiene días válidos');
          setLoadingSB(false);
          setCoachDialog({ t: 'none' });
          return;
        }
        if (!isValidUuid(alumnoIdAssign)) {
          console.error('[assignRut] alumno_id no es UUID valido', { alumno_id: alumnoIdAssign, alumno: c.a });
          toast2('Error: el alumno no tiene un ID válido');
          setLoadingSB(false);
          setCoachDialog({ t: 'none' });
          return;
        }
        if (!isValidUuid(entrenadorIdAssign)) {
          console.error('[assignRut] entrenador_id no es UUID valido', { entrenador_id: entrenadorIdAssign, sessionUserId: authSessionAssign.user?.id });
          toast2('Error: la sesión del entrenador no es válida');
          setLoadingSB(false);
          setCoachDialog({ t: 'none' });
          return;
        }
        var body = {
          alumno_id: alumnoIdAssign,
          entrenador_id: entrenadorIdAssign,
          nombre: nombreAssign,
          datos: {
            days: sanitizeRoutineDaysForWrite(daysAssign),
            alumno: {
              id: c.a.id,
              nombre: c.a.nombre || "",
              email: c.a.email || "",
            },
            note: c.rutinaLocal.datos?.note || "",
          },
        };
        console.error("[assignRut DEBUG]", {
          session: authSessionAssign,
          alumnoId: alumnoIdAssign,
          entrenadorId: entrenadorIdAssign,
          body: body,
        });
        var res = null;
        try {
          var insertResult = await supabase
            .from("rutinas")
            .insert([body])
            .select()
            .single();
          if (insertResult.error) {
            console.error("[assignRut INSERT ERROR FULL]", insertResult.error);
            throw insertResult.error;
          }
          res = insertResult.data;
        } catch (eCreate) {
          console.error('[assignRut] error al crear copia de rutina', { error: eCreate, body: body });
        }
        if (res) {
          if (c.ex) {
            try {
              await sb.deleteRutina(c.ex.id);
              var exidA2 = c.ex.id;
              setRutinasSB(function (prev) {
                return prev.filter(function (x) {
                  return String(x.id) !== String(exidA2);
                });
              });
              setRutinasSBEntrenador(function (prev) {
                return prev.filter(function (x) {
                  return String(x.id) !== String(exidA2);
                });
              });
            } catch (eOldRutina) {
              console.error('[assignRut] error al quitar rutina anterior despues del insert', eOldRutina);
            }
          }
          setRutinasSB(function (prev) {
            return mergeRutinasAsignadas([res], prev);
          });
          setRutinasSBEntrenador(function (prev) {
            return mergeRutinasAsignadas([res], prev);
          });
          toast2('Rutina asignada ✓');
        } else {
          toast2('Error al asignar rutina');
        }
        setLoadingSB(false);
        setCoachDialog({ t: 'none' });
        return;
        */
      }
      if (c.t === 'logout' || c.t === 'logoutSettings') {
        if (c.t === 'logoutSettings') setSettingsOpen(false);
        clearAllIronTrackPrefixedKeys();
        syncStateWithLocalStorage();
        setCoachDialog({ t: 'none' });
        return;
      }
    } catch (e1) {
      console.error('[confirmCoachDialog]', e1);
      if (c.t === 'clearProgress') {
        toast2(msg('No se pudo limpiar el historial.', 'Could not clear the history.', 'Não foi possível limpar o histórico.'));
      }
    } finally {
      setCoachDialogLoading(false);
    }
  }

  // Pantalla de login

  const hasAppSession = !!(sessionData && (sessionData.role === "entrenador" || sessionData.role === "alumno"));

  // ── Onboarding de 3 pasos ─────────────────────────────────────────────
  if (!sharedParam && authLoading) return (
    <>
      {brandSplashEl}
      <div style={{maxWidth:480,margin:"0 auto",height:"100dvh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:bg,color:textMain,fontFamily:"Inter,sans-serif",padding:"0 24px"}}>
        <IronTrackAppIcon size={72} animated={false} aria-label={msg("IronTrack", "IronTrack")} />
        <div style={{marginTop:20,fontSize:14,fontWeight:600,color:textMuted,letterSpacing:0.5}}>{msg("Cargando…", "Loading…")}</div>
      </div>
    </>
  );

  if (!sharedParam && !hasAppSession && !onboardDone) return (
    <>
      {brandSplashEl}
      <OnboardingScreen es={es} darkMode={darkMode} onDone={()=>{
        try{localStorage.setItem('it_onboard_done','1');}catch(e){}
        setOnboardDone(true);
      }}/>
    </>
  );

  if (!sharedParam && !hasAppSession && loginScreen) return (
    <>
      {brandSplashEl}
      <div style={{minHeight:"100dvh",width:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"radial-gradient(circle at 50% 25%, rgba(37, 99, 235, 0.18), transparent 32%), radial-gradient(circle at 50% 55%, rgba(34, 211, 238, 0.10), transparent 38%), linear-gradient(180deg, #0A0F1A 0%, #020617 100%)",color:textMain,fontFamily:"Inter,sans-serif",padding:"32px 24px",boxSizing:"border-box"}}>
      <div style={{textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center"}}>
        <IronTrackAppIcon
          size="clamp(90px, 18vw, 120px)"
          animated={false}
          aria-label={msg("IronTrack", "IronTrack")}
          style={{ margin: "0 auto 16px", background: "transparent", border: "none", boxShadow: "none" }}
        />
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontSize:"clamp(24px, 4vw, 32px)",lineHeight:1,textAlign:"center",marginBottom:32,letterSpacing:1.2,fontWeight:800,fontFamily:"Barlow Condensed, Arial Black, sans-serif",textTransform:"uppercase"}}>
          <span style={{color:"#fff"}}>IRON</span>
          <span style={{color:"#2563EB"}}>TRACK</span>
        </div>
      </div>
      <div style={{maxWidth:420,width:"100%",background:"rgba(255,255,255,0.04)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",borderRadius:16,padding:"24px",border:"1px solid rgba(255,255,255,0.08)",boxSizing:"border-box"}}>

        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:0.3,color:textMuted,marginBottom:4}}>EMAIL</div>
          <input style={{background:bgSub,color:textMain,border:"1px solid "+border,borderRadius:8,padding:"8px 12px",width:"100%",fontFamily:"Inter,sans-serif",fontSize:15,boxSizing:"border-box"}} value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} placeholder="tu@email.com" type="email"/>
        </div>
        <div style={{marginBottom:loginError?12:20}}>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:0.3,color:textMuted,marginBottom:4}}>CONTRASEÑA</div>
          <input style={{background:bgSub,color:textMain,border:"1px solid "+border,borderRadius:8,padding:"8px 12px",width:"100%",fontFamily:"Inter,sans-serif",fontSize:15,boxSizing:"border-box"}} value={loginPass} onChange={e=>setLoginPass(e.target.value)} placeholder="••••••••" type="password"/>
        </div>
        {loginError&&<div style={{color:"#2563EB",fontSize:13,marginBottom:12,textAlign:"center"}}>{loginError}</div>}
        <button style={{width:"100%",padding:"12px",background:"#2563EB",color:"#fff",border:"none",borderRadius:12,fontFamily:"Barlow Condensed,sans-serif",fontSize:18,fontWeight:700,cursor:"pointer",letterSpacing:1}} onClick={async ()=>{
          setLoginLoading(true); setLoginError("");
          try {
            const sp = typeof window!=="undefined"?(localStorage.getItem("it_tpass")||"irontrack2024"):"irontrack2024";
            const loginEmailNorm = loginEmail.trim().toLowerCase();
            const isEntrenador = loginEmailNorm==="entrenador@irontrack.app";
            if(isEntrenador){
              if(loginEmailNorm==="entrenador@irontrack.app"&&loginPass===sp){
                if (!supabase) {
                  console.error("[AUTH] Supabase client no inicializado");
                  setLoginError("No se pudo iniciar sesión con Supabase");
                  return;
                }
                var authLogin = await supabase.auth.signInWithPassword({
                  email: loginEmailNorm,
                  password: loginPass,
                });
                if (authLogin.error || !authLogin.data || !authLogin.data.session) {
                  console.error("[AUTH] signInWithPassword fallo; intentando migracion segura", authLogin.error || authLogin);
                  var authSignup = await supabase.auth.signUp({
                    email: loginEmailNorm,
                    password: loginPass,
                    options: {
                      data: { nombre: "Entrenador", role: "entrenador" },
                    },
                  });
                  if (authSignup.error) {
                    console.error("[AUTH] signUp migracion fallo", authSignup.error);
                    setLoginError("No se pudo crear tu usuario en Supabase Auth. Revisá la consola para ver el error real.");
                    return;
                  }
                  if (authSignup.data && authSignup.data.session) {
                    authLogin = authSignup;
                  } else if (authSignup.data && authSignup.data.user && !authSignup.data.session) {
                    console.error("[AUTH] Usuario creado sin sesión activa; Supabase requiere confirmar email", authSignup.data.user);
                    setLoginError("El usuario fue creado, pero Supabase requiere confirmar email. Desactivá Confirm email en Supabase Auth o confirmá el usuario manualmente.");
                    return;
                  } else {
                    console.error("[AUTH] signUp no devolvio usuario ni sesion", authSignup);
                    setLoginError("No se pudo crear una sesión de Supabase Auth. Revisá la consola para ver el error real.");
                    return;
                  }
                }
                if (!authLogin.data || !authLogin.data.session || !authLogin.data.session.access_token || !authLogin.data.user || !authLogin.data.user.id) {
                  console.error("[AUTH] No hay sesión activa", authLogin.error || authLogin);
                  setLoginError("No se pudo iniciar sesión con Supabase Auth. Revisá la consola para ver el error real.");
                  return;
                }
                clearIronTrackStorageForNewLogin();
                var demoName = "Entrenador";
                try {
                  var cpl = localStorage.getItem("it_coach_profile_local");
                  if (cpl) {
                    var cpj = JSON.parse(cpl);
                    if (cpj && typeof cpj.name === "string" && cpj.name.trim()) demoName = cpj.name.trim();
                  }
                } catch (e) {}
                try {
                  var upCoach = await supabase
                    .from('entrenadores')
                    .upsert({ id: String(authLogin.data.user.id), email: authLogin.data.user.email || loginEmailNorm, nombre: demoName }, { onConflict: 'id' });
                  if (upCoach.error) console.error("[AUTH] entrenadores upsert migracion fallo", upCoach.error);
                } catch (eUpCoach) {
                  console.error("[AUTH] entrenadores upsert migracion exception", eUpCoach);
                }
                const s={role:"entrenador",name: demoName,email:authLogin.data.user.email||loginEmailNorm,entrenadorId:String(authLogin.data.user.id)};
                localStorage.setItem("it_session",JSON.stringify(s));
                syncStateWithLocalStorage();
                setLoginEmail("");
                setLoginPass("");
              } else setLoginError("Email o contraseña incorrectos");
            } else {
              const res=await sbFetch("alumnos?email=eq."+encodeURIComponent(loginEmail)+"&password=eq."+encodeURIComponent(loginPass)+"&select=*");
              if(res&&res.length>0){
                const alumno=res[0];
                const rutsRaw=await sb.getRutinas(alumno.id);
                const ruts=(rutsRaw || []).slice().sort(function(a,b){return new Date(b.created_at||0)-new Date(a.created_at||0);}).slice(0,1);
                clearIronTrackStorageForNewLogin();
                const s={role:"alumno",name:alumno.nombre,alumnoId:alumno.id,entrenadorId:alumno.entrenador_id};
                localStorage.setItem("it_session",JSON.stringify(s));
                localStorage.setItem("it_show_welcome","1");
                if(ruts&&ruts[0]) localStorage.setItem("it_rt",JSON.stringify([{...ruts[0].datos,alumnoId:alumno.id}]));
                // Registrar OneSignal
                try {
                  window.OneSignalDeferred = window.OneSignalDeferred || [];
                  window.OneSignalDeferred.push(async function(OS) {
                    await OS.init({ appId: "8c5e2bd1-2ac8-497a-93eb-fd07e5ce74d7", allowLocalhostAsSecureOrigin: true });
                    const pid = OS.User?.PushSubscription?.id;
                    if(pid) await sbFetch("alumnos?id=eq."+alumno.id,"PATCH",{onesignal_id:pid});
                  });
                } catch(e) {}
                syncStateWithLocalStorage();
                setLoginEmail("");
                setLoginPass("");
              } else setLoginError("Email o contraseña incorrectos");
            }
          } finally {
            setLoginLoading(false);
          }
        }}>
          {loginLoading?"INGRESANDO...":"INGRESAR"}
        </button>
        {webAuthnAvail&&savedCredential&&(
          <button className="hov" style={{...btn("#2D4057"),width:"100%",padding:"12px",fontSize:15,marginTop:8,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}
            onClick={async()=>{
              try {
                const cred = await navigator.credentials.get({publicKey:{
                  challenge: new Uint8Array(32),
                  rpId: window.location.hostname,
                  allowCredentials:[{type:"public-key",id:Uint8Array.from(atob(savedCredential),c=>c.charCodeAt(0))}],
                  userVerification:"required",
                  timeout:60000
                }});
                if(cred) {
                  const saved = JSON.parse(localStorage.getItem("it_biometric_user")||"null");
                  if(saved) {
                    setLoginLoading(true);
                    setTimeout(function(){
                      try { localStorage.setItem("it_session", JSON.stringify(saved)); } catch(e) {}
                      syncStateWithLocalStorage();
                      setLoginEmail("");
                      setLoginPass("");
                      setLoginLoading(false);
                    }, 500);
                  }
                }
              } catch(e){ toast2(msg("Error de biometría", "Biometric error")); }
            }}>
            <Ic name="lock" size={36} color="#2563EB"/>
            <span>{msg("Ingresar con huella / Face ID", "Sign in with biometrics")}</span>
          </button>
        )}
        {loginEmail.trim().toLowerCase()==="entrenador@irontrack.app"&&<div style={{fontSize:11,color:textMuted,textAlign:"center",marginTop:12}}>Contraseña por defecto: irontrack2024</div>}
        {loginEmail.trim().toLowerCase()!=="entrenador@irontrack.app"&&<div style={{fontSize:11,color:textMuted,textAlign:"center",marginTop:12}}>Usa el email y contrasena que te dio tu entrenador</div>}
      </div>
    </div>
    </>
  );

  const alumnoFullScreenShell = !!(esAlumno && (tab === "plan" || tab === "library" || tab === "progress"));
  /** Coach ≥1024: nav inferior global oculta — no reservar 72px extra (dejaba franja vacía bajo el shell). */
  const coachDesktopNavHidden = !!(showCoachDesktopShell && coachDesktop1024);

  return (
    <>
    {brandSplashEl}
    <IronTrackI18nProvider lang={lang}>
    <div style={{
      minHeight:"100dvh",
      height: alumnoFullScreenShell ? "100svh" : undefined,
      overflow: alumnoFullScreenShell ? "hidden" : undefined,
      background:bg,
      color:textMain,
      fontFamily:"Inter,sans-serif",
      "--sk1":darkMode?"#1E2D40":"#E8EEF4",
      "--sk2":darkMode?"#2D4057":"#D1DCE8",
      paddingBottom: alumnoFullScreenShell ? 0 : coachDesktopNavHidden ? "env(safe-area-inset-bottom, 0px)" : 72,
      position:"relative",
      display: alumnoFullScreenShell ? "flex" : undefined,
      flexDirection: alumnoFullScreenShell ? "column" : undefined,
    }}>
      <style dangerouslySetInnerHTML={{__html:
        "@import url(https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Inter:wght@400;500;600;700&display=swap);" +
        "*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Inter',sans-serif;line-height:1.4;-webkit-font-smoothing:antialiased}input,textarea,select{outline:none!important}" +
        "html{scrollbar-color:"+(darkMode?"#64748b #0f172a":"#64748b #e2e8f0")+"}" +
        "::-webkit-scrollbar{width:10px;height:10px}::-webkit-scrollbar-track{background:"+(darkMode?"rgba(15,23,42,.55)":"#e2e8f0")+";border-radius:8px}::-webkit-scrollbar-thumb{background:"+(darkMode?"#64748b":"#64748b")+";border-radius:8px;border:2px solid transparent;background-clip:padding-box}" +
        ".plan-main-scroll{scrollbar-gutter:stable;scrollbar-color:"+(darkMode?"#94a3b8 #0b1120":"#64748b #f1f5f9")+"}" +
        ".plan-main-scroll::-webkit-scrollbar{width:14px}" +
        ".plan-main-scroll::-webkit-scrollbar-track{background:"+(darkMode?"rgba(15,23,42,.65)":"#e8edf3")+";border-radius:10px;margin:4px 0}" +
        ".plan-main-scroll::-webkit-scrollbar-thumb{background:"+(darkMode?"#94a3b8":"#64748b")+";border-radius:10px;border:3px solid "+(darkMode?"#0b1120":"#f8fafc")+";background-clip:padding-box;min-height:48px}" +
        ".hov{transition:filter .15s ease,transform .15s ease,background-color .15s ease,border-color .15s ease,color .15s ease,opacity .15s ease;cursor:pointer}.hov:hover{filter:brightness(1.15)}" +
        "@keyframes successPulse{0%{transform:scale(1)}30%{transform:scale(0.94)}60%{transform:scale(1.06)}100%{transform:scale(1)}}" +
        "@keyframes pillBounce{0%{transform:scale(1)}30%{transform:scale(1.25)}50%{transform:scale(0.9)}70%{transform:scale(1.1)}100%{transform:scale(1)}}" +
        "@keyframes greenFlash{0%{filter:brightness(1)}40%{filter:brightness(1.5) saturate(1.3)}100%{filter:brightness(1)}}" +
        "@keyframes bounceIn{0%{transform:scale(0) rotate(-10deg);opacity:0}50%{transform:scale(1.2) rotate(5deg)}70%{transform:scale(0.92) rotate(-2deg)}100%{transform:scale(1) rotate(0);opacity:1}}" +
        "@keyframes rippleOut{0%{box-shadow:0 0 0 0 rgba(34,197,94,0.5)}100%{box-shadow:0 0 0 20px rgba(34,197,94,0)}}" +

        ".num{font-family:'Barlow Condensed',sans-serif;font-variant-numeric:tabular-nums}" +
        "*{-webkit-tap-highlight-color:transparent}[style*='overflowY']{-webkit-overflow-scrolling:touch}.plan-main-scroll{scroll-behavior:auto!important;overflow-anchor:none;overscroll-behavior-y:contain}" +
        ".plan-scroll-diag-no-hov .hov{transition:none!important;filter:none!important}" +
        ".plan-hoy-cta-wrap{min-height:228px;touch-action:manipulation;box-sizing:border-box;background-clip:padding-box;border-style:solid;border-width:1px;filter:none;box-shadow:none}" +
        ".plan-hoy-cta-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:4px;min-height:128px;flex-shrink:0}" +
        ".plan-hoy-cta-kicker{font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:4px;line-height:1.2}" +
        ".plan-hoy-cta-title{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:22px;font-weight:900;line-height:1.2;word-break:break-word}" +
        ".plan-hoy-cta-sub{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:13px;line-height:1.35;margin-top:4px;margin-bottom:14px;word-break:break-word}" +
        ".plan-hoy-cta-badge{flex-shrink:0;align-self:flex-start;white-space:nowrap;font-size:12px;font-weight:700;border-radius:8px;padding:3px 10px;border-style:solid;border-width:1px;line-height:1.2;filter:none;box-shadow:none;transition:none}" +
        ".plan-hoy-cta-btn{touch-action:manipulation;-webkit-tap-highlight-color:transparent;transition:none!important;box-sizing:border-box;height:52px;flex-shrink:0;filter:none;box-shadow:none;outline:none}" +
        ".plan-hoy-cta-btn svg{flex-shrink:0;display:block}" +
        ".card-ex{will-change:transform;contain:layout style paint}" +
        "@keyframes checkPop{0%{transform:scale(0.3) rotate(-15deg);opacity:0}60%{transform:scale(1.3) rotate(5deg);opacity:1}80%{transform:scale(0.9) rotate(-3deg)}100%{transform:scale(1) rotate(0deg);opacity:1}}@keyframes slideUpFade{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:translateY(0)}}@keyframes prGlow{0%{box-shadow:0 0 0 0 rgba(34,197,94,0.6);transform:scale(1)}50%{box-shadow:0 0 0 12px rgba(34,197,94,0);transform:scale(1.05)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0);transform:scale(1)}}@keyframes rowComplete{0%{background:rgba(34,197,94,0.0)}15%{background:rgba(34,197,94,0.3)}100%{background:transparent}}" +
        "select{background:"+bgSub+";color:"+textMain+";border:1px solid "+border+";border-radius:8px;padding:8px 12px;font-family:Inter,sans-serif;font-size:13px;width:100%}" +
        ".add-ex-hscroll{scrollbar-width:none;-ms-overflow-style:none;overscroll-behavior-x:contain;touch-action:pan-x pan-y}" +
        ".add-ex-hscroll::-webkit-scrollbar{display:none;height:0;width:0}" +
        ".add-ex-list-scroll--desktop{scrollbar-gutter:stable;scrollbar-width:thin;-webkit-overflow-scrolling:touch}" +
        ".add-ex-list-scroll--desktop::-webkit-scrollbar{width:10px}" +
        ".add-ex-list-scroll--desktop::-webkit-scrollbar-track{background:transparent}" +
        ".add-ex-list-scroll--desktop::-webkit-scrollbar-thumb{background:"+(darkMode?"#475569":"#94a3b8")+";border-radius:99px;border:2px solid transparent;background-clip:padding-box}" +
        ".add-ex-card{cursor:pointer;border-radius:12px;border:none;transition:background-color .15s ease;filter:none!important;outline:none;-webkit-focus-ring-color:transparent;-webkit-tap-highlight-color:transparent;position:relative}" +
        ".add-ex-card--light{background:#E2E8F0}.add-ex-card--light:hover{background:#d6dee9}" +
        ".add-ex-card--dark{background:#162234}.add-ex-card--dark:hover{background:#1c2d45}" +
        ".app-inner{max-width:1200px;margin:0 auto;width:100%}" +
        "@media(min-width:768px){" +
        ".app-inner{font-size:142%}" +
        ".tab-content{padding:24px 32px!important}" +
        ".card-item{padding:18px 22px!important}" +
        "nav{justify-content:center;max-width:700px;margin:0 auto}" +
        "nav>*{max-width:140px;font-size:15px!important;padding:12px 0!important}" +
        "nav>* i{font-size:24px!important}" +
        ".scroll-area{padding:24px 32px!important;max-width:860px;margin:0 auto}" +
        ".sk{background:linear-gradient(90deg,var(--sk1,#1E2D40) 25%,var(--sk2,#2D4057) 50%,var(--sk1,#1E2D40) 75%);background-size:200% 100%;animation:shimmer 1.4s ease-in-out infinite;border-radius:8px;}@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}" +
        "}"
      }}/>

      <div className="app-inner" style={alumnoFullScreenShell ? {display:"flex",flexDirection:"column",flex:1,minHeight:0} : showCoachDesktopShell ? {display:"flex",flexDirection:"column",minHeight:"100vh",width:"100%",flex:1,maxWidth:"none",margin:0} : undefined}>
      {!isOnline&&(
        <div style={{
          background:"#1f1500",borderBottom:"1px solid #F59E0B44",
          padding:"8px 16px",display:"flex",alignItems:"center",gap:8,
          fontSize:12,color:"#fbbf24",fontWeight:500,
          animation:"slideUpFade .3s ease"
        }}>
          <div style={{width:7,height:7,borderRadius:"50%",background:"#F59E0B",flexShrink:0}}/>
          <span>{msg("Sin conexión — sets guardados localmente", "Offline — sets saved locally")}</span>
          {pendingSync.length>0&&(
            <span style={{marginLeft:"auto",background:"#F59E0B22",borderRadius:10,padding:"1px 7px",fontSize:10,fontWeight:700}}>
              {pendingSync.length} pendiente{pendingSync.length>1?"s":""}
            </span>
          )}
        </div>
      )}
      <div
        className={showCoachDesktopShell ? "flex w-full min-h-0 flex-1 flex-col self-stretch items-stretch lg:flex-row" : undefined}
        style={showCoachDesktopShell ? undefined : { display: "contents" }}
      >
        {showCoachDesktopShell ? (
          <div style={{ display: (tab === "settings" || tab === "perfil") ? "none" : "flex" }}>
            <DesktopSidebar
              activeTab={tab}
              onNavigate={setTab}
              onSettings={function () {
                setTab("settings");
              }}
              onPerfil={function () {
                setTab("perfil");
              }}
              onLogout={function () {
                clearAllIronTrackPrefixedKeys();
                syncStateWithLocalStorage();
              }}
              coachAvatarUrl={sessionData?.avatarUrl}
              coachName={sessionData?.name}
              darkMode={darkMode}
            />
          </div>
        ) : null}
        <div
          className={showCoachDesktopShell ? "flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden" : undefined}
          style={showCoachDesktopShell ? undefined : { display: "contents" }}
        >
      {!coachSuppressTopNav && (
      <div
        ref={alumnoAppHeaderRef}
        className={
          (alumnoTopBarFixed ? "relative flex w-full min-w-0 items-center justify-between gap-1 pb-3 pt-3 " : "relative z-50 flex w-full min-w-0 items-center justify-between gap-1 pb-3 pt-4 ") +
          (alumnoTopBarFixed
            ? ""
            : darkMode
              ? "border-b border-[#2D4057] bg-[#0F1923]"
              : showCoachDesktopShell && !esAlumno
                ? "border-b border-slate-200 bg-white"
                : "border-b border-[#2D4057] bg-[#F0F4F8]")
        }
        style={{
          position: alumnoTopBarFixed ? "fixed" : "relative",
          top: alumnoTopBarFixed ? 0 : undefined,
          left: alumnoTopBarFixed ? 0 : undefined,
          right: alumnoTopBarFixed ? 0 : undefined,
          zIndex: alumnoTopBarFixed ? 95 : undefined,
          paddingLeft: esAlumno ? 20 : 16,
          paddingRight: esAlumno ? 20 : 16,
          paddingTop: alumnoTopBarFixed ? "env(safe-area-inset-top, 0px)" : undefined,
          height: undefined,
          minHeight: alumnoTopBarFixed ? alumnoTopBarHeight : undefined,
          boxSizing: "border-box",
          background: alumnoTopBarFixed ? "#0A0F1A" : undefined,
          borderBottom: alumnoTopBarFixed ? "1px solid #2d4057" : undefined,
          backdropFilter: alumnoTopBarFixed ? "none" : undefined,
          WebkitBackdropFilter: alumnoTopBarFixed ? "none" : undefined,
          boxShadow: alumnoTopBarFixed ? "0 8px 24px rgba(0,0,0,.18)" : undefined,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
          {showCoachDesktopShell && !coachDesktop1024 && (
            <button
              onClick={() => setMobileDrawerOpen(true)}
              style={{
                width: 34,
                height: 34,
                background: darkMode ? "#111827" : "#ffffff",
                border: darkMode ? "1px solid #1A2535" : "1px solid #e2e8f0",
                borderRadius: 9,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                flexShrink: 0,
                position: "relative",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={darkMode ? "#94a3b8" : "#64748b"} strokeWidth="2.5" strokeLinecap="round">
                <line x1="3" y1="7" x2="21" y2="7" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="17" x2="21" y2="17" />
              </svg>
              {/* dot rojo si hay notificaciones pendientes */}
              <span
                style={{
                  position: "absolute",
                  top: 5,
                  right: 5,
                  width: 7,
                  height: 7,
                  background: "#ef4444",
                  borderRadius: "50%",
                  border: darkMode ? "1.5px solid #0B0E11" : "1.5px solid #ffffff",
                }}
              />
            </button>
          )}
          <IronTrackLogo
            size={esAlumno ? 24 : 22}
            color="#2563EB"
            {...(darkMode && (readOnly || esAlumno)
              ? { ironColor: "#ffffff", trackColor: "#2563EB", barColor: "#2563EB" }
              : darkMode && !esAlumno && sessionData
                ? { ironColor: "#ffffff", trackColor: "#2563EB", barColor: "#2563EB" }
                : {})}
            showBar={true}
            modeFontSize={esAlumno ? 12 : 11}
            mode={
              (readOnly || esAlumno) && sessionData
                ? msg("Modo alumno", "Athlete mode") +
                  ": " +
                  (String(sessionData.name || "").trim() || msg("Atleta", "Athlete"))
                : !esAlumno && sessionData
                  ? msg("Modo entrenador", "Coach mode") +
                    (String(sessionData.name || "").trim() ? ": " + String(sessionData.name || "").trim() : "")
                  : null
            }
            modeColor={darkMode ? "#94a3b8" : "#64748B"}
          />
        </div>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            paddingLeft: 4,
            paddingRight: 4,
          }}
        >
          {esAlumno && tab === "plan" && alumnoPlanHeaderDayNum != null && (
            <p
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 600,
                textAlign: "center",
                lineHeight: 1.25,
                maxWidth: "100%",
              }}
            >
              <span style={{ color: textMuted, fontWeight: 500 }}>{msg("Hoy toca:", "Today:", "Hoje é:")}</span>{" "}
              <span style={{ color: "#3B82F6", fontWeight: 800, letterSpacing: 0.3 }}>
                {String(msg("Día", "Day", "Dia")).toUpperCase()}{" "}
                {alumnoPlanHeaderDayNum}
              </span>
            </p>
          )}
        </div>
        <div className="relative flex flex-shrink-0 items-center gap-3">
          {session&&<span style={{...tag("#22C55E"),fontSize:13}}>✓ Sesion activa</span>}
          {esAlumno &&
            (tab === "plan" || tab === "library" || tab === "progress") &&
            canInstallPWA &&
            (!coachDesktop1024 ? (
              <div style={{ position: "relative", flexShrink: 0, zIndex: pwaInstallTipOpen ? 660 : "auto" }}>
                {pwaInstallTipOpen && (
                  <div
                    style={{ position: "fixed", inset: 0, zIndex: 630, background: "transparent" }}
                    onClick={() => setPwaInstallTipOpen(false)}
                    aria-hidden
                  />
                )}
                <button
                  type="button"
                  className="hov select-none"
                  onClick={function () {
                    setPwaInstallTipOpen(function (open) { return !open; });
                  }}
                  aria-label={msg("Instalar app", "Install app", "Instalar app")}
                  aria-expanded={pwaInstallTipOpen}
                  style={{
                    position: "relative",
                    zIndex: 650,
                    width: 40,
                    height: 40,
                    minWidth: 40,
                    minHeight: 40,
                    padding: 0,
                    borderRadius: "50%",
                    background: "rgba(37, 99, 235, 0.10)",
                    color: "#2563EB",
                    border: "1px solid rgba(37, 99, 235, 0.45)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxSizing: "border-box",
                    boxShadow: "0 8px 24px rgba(2, 6, 23, 0.24)",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <DownloadNavIcon size={20} strokeWidth={2.35} color="#2563EB" aria-hidden />
                </button>
                {pwaInstallTipOpen && (
                  <button
                    type="button"
                    onClick={function () {
                      setPwaInstallTipOpen(false);
                      void installPWA();
                    }}
                    style={{
                      position: "absolute",
                      zIndex: 660,
                      top: "calc(100% + 10px)",
                      right: 0,
                      width: 220,
                      padding: "12px 14px",
                      borderRadius: 16,
                      background: "rgba(10, 22, 40, 0.96)",
                      border: "1px solid rgba(148, 163, 184, 0.18)",
                      boxShadow: "0 18px 44px rgba(0, 0, 0, 0.46)",
                      color: "#fff",
                      textAlign: "left",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      backdropFilter: "blur(12px)",
                      WebkitBackdropFilter: "blur(12px)",
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.2 }}>
                      {msg("Instalar app", "Install app", "Instalar app")}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.35, color: "#94a3b8", marginTop: 4 }}>
                      {msg("Acceso rápido desde tu dispositivo", "Quick access from your device", "Acesso rápido pelo seu dispositivo")}
                    </div>
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                className="hov select-none"
                onClick={function () {
                  void installPWA();
                }}
                aria-label={msg("Instalar app", "Install app", "Instalar app")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  height: 42,
                  minHeight: 42,
                  padding: "0 16px",
                  borderRadius: 9999,
                  background: "#2563EB",
                  color: "#fff",
                  border: "none",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  flexShrink: 0,
                  boxSizing: "border-box",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.12), 0 2px 4px -2px rgba(0, 0, 0, 0.08)",
                  transition: "background-color 0.15s ease, transform 0.15s ease",
                  WebkitTapHighlightColor: "transparent",
                }}
                onMouseEnter={function (e) {
                  e.currentTarget.style.background = "#2f6df6";
                }}
                onMouseLeave={function (e) {
                  e.currentTarget.style.background = "#2563EB";
                  e.currentTarget.style.transform = "";
                }}
                onTouchStart={function (e) {
                  e.currentTarget.style.transform = "scale(0.97)";
                }}
                onTouchEnd={function (e) {
                  e.currentTarget.style.transform = "";
                }}
                onTouchCancel={function (e) {
                  e.currentTarget.style.transform = "";
                }}
              >
                <DownloadNavIcon size={20} strokeWidth={2.25} color="#ffffff" aria-hidden />
                {msg("Instalar app", "Install app", "Instalar app")}
              </button>
            ))}
          <button className="hov" style={{...btn(),padding:"8px",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setSettingsOpen(true)}><Ic name="settings" size={18} color={textMuted}/></button>
          {sessionData&&esAlumno
            ? <button className="hov" style={{width:36,height:36,background:"linear-gradient(135deg,#1E3A5F,#2563EB)",border:"none",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:13,fontWeight:800,color:"#fff"}} onClick={()=>setUserMenuOpen(!userMenuOpen)}>
                {(sessionData.name||"U").slice(0,2).toUpperCase()}
              </button>
            : sessionData
              ? <button className="hov" style={{background:"#2563EB22",color:"#2563EB",border:"none",borderRadius:8,padding:"8px 14px",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>{clearAllIronTrackPrefixedKeys();syncStateWithLocalStorage();}}>SALIR</button>
              : <button className="hov" style={{...btn(),padding:"4px 8px",fontSize:13}} onClick={()=>setLoginModal(true)}><Ic name="user" size={18}/></button>
          }
        </div>
      </div>
      )}
      {alumnoTopBarFixed && (
        <div ref={alumnoTopBarSpacerRef} style={{ height: alumnoTopBarHeight, minHeight: alumnoTopBarHeight, flexShrink: 0, transition: "none" }} aria-hidden />
      )}
      {sessionData && esAlumno && userMenuOpen && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 600 }} onClick={() => setUserMenuOpen(false)} />
          <div
            style={{
              position: "fixed",
              zIndex: 610,
              top: alumnoTopBarFixed ? "calc(env(safe-area-inset-top, 0px) + 104px)" : "calc(env(safe-area-inset-top, 0px) + 56px)",
              right: 16,
              background: "#0a1628",
              border: "1px solid rgba(59,130,246,.25)",
              borderRadius: 14,
              width: 240,
              overflow: "hidden",
              boxShadow: "0 12px 40px rgba(0,0,0,.55)",
              animation: "fadeIn .2s ease",
            }}
          >
            <div style={{ padding: "14px 16px", background: "linear-gradient(180deg,#0f1f3a 0%,#0a1628 100%)", borderBottom: "1px solid rgba(59,130,246,.15)" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", lineHeight: 1.3 }}>{sessionData.name}</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{sessionData.email || ""}</div>
            </div>
            <div style={{ padding: "6px 0" }}>
              <div
                className="hov"
                style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}
                onClick={() => {
                  setUserMenuOpen(false);
                  const n = (sessionData.name || "").trim().split(/\s+/);
                  setProfileEdit({
                    nombre: n[0] || "",
                    apellido: n.slice(1).join(" ") || "",
                    email: sessionData.email || "",
                    phone: sessionData.phone || "",
                    avatarDataUrl: sessionData.avatarUrl || null,
                  });
                  setProfileModalOpen(true);
                }}
              >
                <Ic name="user" size={17} color="#3b82f6" /> {msg("Mi perfil", "My profile")}
              </div>
              <div
                className="hov"
                style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}
                onClick={() => {
                  setUserMenuOpen(false);
                  setSettingsOpen(true);
                }}
              >
                <Ic name="settings" size={17} color="#94a3b8" /> {msg("Configuración", "Settings")}
              </div>
            </div>
            <div style={{ borderTop: "1px solid rgba(239,68,68,.2)", padding: "4px 0" }}>
              <div
                className="hov"
                style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#f87171" }}
                onClick={() => {
                  setUserMenuOpen(false);
                  setCoachDialog({ t: 'logout' });
                }}
              >
                <Ic name="log-out" size={17} color="#f87171" /> {msg("Cerrar sesión", "Log out")}
              </div>
            </div>
          </div>
        </>
      )}
      {timer&&!session&&(
        <AlumnoRestTimerBar
          timer={timer}
          bgSub={bgSub}
          darkMode={darkMode}
          textMuted={textMuted}
          btn={btn}
          fmt={fmt}
          onCancel={() => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } setTimer(null); }}
        />
      )}

      <div
        className={
          "plan-main-scroll relative z-0 overflow-y-auto " +
          (showCoachDesktopShell && !esAlumno ? "overflow-x-hidden " : "") +
          (showCoachDesktopShell && !esAlumno
            ? "px-0 "
            : esAlumno && (tab === "plan" || tab === "library" || (tab === "progress" && showAlumnoProgressStack))
              ? "px-7 "
              : "px-6 ") +
          (showCoachDesktopShell && !esAlumno ? "lg:[scrollbar-gutter:stable] " : "") +
          (!coachSuppressTopNav ? "mt-6 " : "") +
          (planScrollDiag.planAnimationsGlobalCss === false ? "plan-scroll-diag-no-hov " : "") +
          (coachSuppressTopNav
            ? "pt-0 "
            : esAlumno && (tab === "plan" || tab === "library" || (tab === "progress" && showAlumnoProgressStack))
              ? "pt-8 "
              : tab === "progress"
                ? "pt-[max(0.75rem,env(safe-area-inset-top,0px))] "
                : showCoachDesktopShell && !esAlumno
                  ? "pt-6 "
                  : "pt-6 ")
        }
        ref={function (node) {
          scrollRef.current = node;
        }}
        style={{
          /** 100svh: viewport estable; 100dvh cambia con la barra de URL en móvil y redimensiona el área → micro saltos. */
          height:
            showCoachDesktopShell && !esAlumno
              ? undefined
              : alumnoTopBarFixed
                ? "calc(100svh - 204px)"
                : "calc(100svh - 130px)",
          flex: alumnoFullScreenShell ? 1 : showCoachDesktopShell && !esAlumno ? 1 : undefined,
          minHeight: alumnoFullScreenShell ? 0 : showCoachDesktopShell && !esAlumno ? 0 : undefined,
          maxHeight: showCoachDesktopShell && !esAlumno ? "100%" : undefined,
          display:
            session && activeDay
              ? "none"
              : showCoachDesktopShell && !esAlumno
                ? "flex"
                : "block",
          flexDirection: showCoachDesktopShell && !esAlumno && !(session && activeDay) ? "column" : undefined,
          paddingBottom: esAlumno
            ? "calc(150px + env(safe-area-inset-bottom, 0px))"
            : showCoachDesktopShell
              ? coachDesktop1024
                ? "calc(1rem + env(safe-area-inset-bottom, 0px))"
                : "calc(5.5rem + env(safe-area-inset-bottom, 0px))"
              : "calc(5.5rem + env(safe-area-inset-bottom, 0px))",
          paddingLeft:
            esAlumno && (tab === "plan" || tab === "library" || (tab === "progress" && showAlumnoProgressStack))
              ? 20
              : undefined,
          paddingRight:
            esAlumno && (tab === "plan" || tab === "library" || (tab === "progress" && showAlumnoProgressStack))
              ? 20
              : undefined,
          paddingTop:
            esAlumno && (tab === "plan" || tab === "library" || (tab === "progress" && showAlumnoProgressStack))
              ? 32
              : undefined,
          WebkitOverflowScrolling: "touch",
          scrollBehavior: "auto",
          overflowAnchor: "none",
          overscrollBehavior: "contain",
          background: darkMode
            ? esAlumno &&
                (tab === "plan" || tab === "library" || (tab === "progress" && showAlumnoProgressStack))
              ? "#0B1220"
              : "#0B1120"
            : showCoachDesktopShell && !esAlumno
              ? "#ffffff"
              : "#F1F5F9",
        }}
      >
        <div
          className={
            showCoachDesktopShell && !esAlumno
              ? "mx-auto box-border flex min-h-0 w-full min-w-0 max-w-[min(100%,1400px)] flex-1 flex-col px-4 pb-3 pt-0 sm:px-5 lg:px-6 lg:pb-12 lg:pt-6"
              : "min-w-0 w-full"
          }
        >
        {tab==="plan"&&esAlumno&&planScrollDiag.pagoAlumnoBanner&&aliasData?.alias&&<PagoAlumno aliasData={aliasData} es={es} darkMode={darkMode} toast2={toast2} msg={msg}/>}
        {(tab==="plan"||tab==="progress")&&!esAlumno&&sessionData?.role==="entrenador"&&(
              <CoachDashboard
                activeNav={tab==="progress"?"progreso":"dashboard"}
                alumnos={alumnosActivosLimpios}
                sesionesGlobales={sesionesGlobalesLimpias}
                progresoGlobal={progresoGlobalLimpio}
                rutinasSBEntrenador={rutinasSBEntrenadorLimpias}
                allEx={allEx}
                lang={lang}
                darkMode={darkMode}
                coachName={sessionData?.name || ""}
                onEnviarMensaje={function () {
                  var first = (alumnos || [])[0];
                  if (first) {
                    setChatModal({ alumnoId: first.id, alumnoNombre: first.nombre || first.email || "Alumno" });
                  } else {
                    toast2(msg("No hay alumnos para contactar", "No athletes to message"));
                  }
                }}
                onCrearRutina={function () {
                  setTab("routines");
                }}
                onRevisarAlumnos={function () {
                  setTab("alumnos");
                }}
                onRevisar={async function (alumnoId) {
                  var alum = (alumnosActivosLimpios || []).find(function (x) {
                    return String(x.id) === String(alumnoId);
                  });
                  if (!alum) {
                    return;
                  }
                  setAlumnoActivo(alum);
                  setTab("alumnos");
                  setLoadingSB(true);
                  try {
                    var r = await Promise.all([sb.getRutinas(alum.id), sb.getProgreso(alum.id), sb.getSesiones(alum.id)]);
                    setRutinasSB(r[0] || []);
                    setAlumnoProgreso(r[1] || []);
                    setAlumnoSesiones(r[2] || []);
                  } catch (e) {
                    console.error("[CoachDashboard onRevisar]", e);
                  }
                  setLoadingSB(false);
                }}
                onVerPerfil={async function (alumnoId) {
                  var alum = (alumnosActivosLimpios || []).find(function (x) {
                    return String(x.id) === String(alumnoId);
                  });
                  if (!alum) {
                    return;
                  }
                  setAlumnoActivo(alum);
                  setTab("alumnos");
                  setLoadingSB(true);
                  try {
                    var r = await Promise.all([sb.getRutinas(alum.id), sb.getProgreso(alum.id), sb.getSesiones(alum.id)]);
                    setRutinasSB(r[0] || []);
                    setAlumnoProgreso(r[1] || []);
                    setAlumnoSesiones(r[2] || []);
                  } catch (e) {
                    console.error("[CoachDashboard onVerPerfil]", e);
                  }
                  setLoadingSB(false);
                }}
                onNuevoAlumno={function () {
                  setTab("alumnos");
                  setNewAlumnoForm(true);
                }}
                onNuevaRutina={function () {
                  setTab("routines");
                }}
                onNuevoEjercicio={function () {
                  setTab("biblioteca");
                  setBibOpenNewExerciseTick(function (t) {
                    return t + 1;
                  });
                }}
                onIrProgreso={function () {
                  setTab("progress");
                }}
                onAbrirChatAlumno={function (alumnoId) {
                  var alum = (alumnos || []).find(function (x) {
                    return String(x.id) === String(alumnoId);
                  });
                  if (!alum) {
                    toast2(msg("Alumno no encontrado", "Athlete not found"));
                    return;
                  }
                  setChatModal({
                    alumnoId: alum.id,
                    alumnoNombre: alum.nombre || alum.email || "Alumno",
                  });
                }}
                globalSearchData={coachGlobalSearchData}
                onGlobalSearchNavigate={coachGlobalSearchNavigate}
                getAlumnoCategoria={coachAlumnoCategoria}
              />
        )}
        {/* ── MOBILE DRAWER (solo entrenador, solo mobile) ── */}
        {tab==="calendar"&&!esAlumno&&sessionData?.role==="entrenador"&&(
          <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-y-auto">
            <CoachCalendar
              alumnos={alumnosActivosLimpios}
              rutinas={rutinasCalendarioEntrenador}
              lang={lang}
              dark={darkMode}
              supabase={supabase}
              entrenadorId={supabaseSessionUserId || null}
              onAssignRoutineToAlumno={assignRoutineToAlumno}
            />
          </div>
        )}
        {showCoachDesktopShell && !coachDesktop1024 && (
          <>
            {/* Overlay */}
            <div
              onClick={() => setMobileDrawerOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 200,
                background: "rgba(0,0,0,0.65)",
                backdropFilter: "blur(2px)",
                WebkitBackdropFilter: "blur(2px)",
                opacity: mobileDrawerOpen ? 1 : 0,
                pointerEvents: mobileDrawerOpen ? "all" : "none",
                transition: "opacity .28s ease",
              }}
            />

            {/* Drawer */}
            <div
              ref={mobileDrawerRef}
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                bottom: 0,
                width: 260,
                zIndex: 201,
                background: "#111827",
                borderRight: "1px solid #1A2535",
                display: "flex",
                flexDirection: "column",
                transform: mobileDrawerOpen ? "translateX(0)" : "translateX(-100%)",
                transition: "transform .3s cubic-bezier(.32,.72,0,1)",
                overflowY: "auto",
                overflowX: "hidden",
              }}
            >
              {/* Header del drawer */}
              <div style={{ padding: "20px 16px 14px", borderBottom: "1px solid #1A2535", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
                  <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: "-.3px" }}>
                    <span style={{ color: "#2563EB" }}>IRON</span>
                    <span style={{ color: "#fff" }}>TRACK</span>
                  </span>
                  <span
                    style={{
                      background: "rgba(37,99,235,.15)",
                      border: "1px solid rgba(59,130,246,.3)",
                      color: "#3B82F6",
                      fontSize: 8,
                      fontWeight: 700,
                      borderRadius: 99,
                      padding: "2px 7px",
                      letterSpacing: ".5px",
                    }}
                  >
                    PRO
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg,#1d4ed8,#2563EB)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#fff",
                      border: "2px solid rgba(59,130,246,.4)",
                      flexShrink: 0,
                    }}
                  >
                    {coachInitialsFromFullName(sessionData?.name)}
                  </div>
                  <div>
                    <div style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>{sessionData?.name || "Entrenador"}</div>
                    <div style={{ color: "#64748b", fontSize: 10, marginTop: 2 }}>Entrenador personal</div>
                  </div>
                </div>
              </div>

              {/* Body scrollable */}
              <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
                {/* PRINCIPAL */}
                <div
                  style={{
                    color: "#374151",
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "1.2px",
                    textTransform: "uppercase",
                    padding: "10px 16px 4px",
                  }}
                >
                  PRINCIPAL
                </div>

                {[
                  { k: "plan", icon: "calendar", label: msg("Dashboard", "Dashboard"), sub: null },
                  { k: "calendar", icon: "calendar", label: msg("Calendario", "Calendar"), sub: msg("Programar rutinas", "Schedule routines") },
                  { k: "alumnos", icon: "users", label: msg("Alumnos", "Athletes"), sub: msg("Gestionar equipo", "Manage team") },
                  { k: "routines", icon: "file-text", label: msg("Rutinas", "Routines"), sub: null },
                  { k: "biblioteca", icon: "activity", label: msg("Ejercicios", "Exercises"), sub: null },
                ].map((item) => (
                  <div
                    key={item.k}
                    onClick={() => {
                      setTab(item.k);
                      setMobileDrawerOpen(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 16px",
                      cursor: "pointer",
                      background: tab === item.k ? "rgba(37,99,235,.1)" : "transparent",
                      borderLeft: tab === item.k ? "3px solid #2563EB" : "3px solid transparent",
                    }}
                  >
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        background: tab === item.k ? "rgba(37,99,235,.15)" : "rgba(148,163,184,.06)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Ic name={item.icon} size={14} color={tab === item.k ? "#3B82F6" : "#94a3b8"} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: tab === item.k ? "#3B82F6" : "#e2e8f0", fontSize: 12, fontWeight: 600 }}>{item.label}</div>
                      {item.sub && <div style={{ color: "#64748b", fontSize: 10, marginTop: 1 }}>{item.sub}</div>}
                    </div>
                  </div>
                ))}

                <div style={{ height: 1, background: "#1A2535", margin: "6px 16px" }} />

                {/* PERFIL */}
                <div
                  style={{
                    color: "#374151",
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "1.2px",
                    textTransform: "uppercase",
                    padding: "10px 16px 4px",
                  }}
                >
                  PERFIL
                </div>

                {[
                  { k: "perfil", icon: "user", label: msg("Mi perfil", "My profile"), sub: msg("Foto, bio, datos", "Photo, bio, data") },
                  { k: "settings", icon: "settings", label: msg("Configuración", "Settings"), sub: msg("Preferencias", "Preferences") },
                ].map((item) => (
                  <div
                    key={item.k}
                    onClick={() => {
                      setTab(item.k);
                      setMobileDrawerOpen(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 16px",
                      cursor: "pointer",
                      background: tab === item.k ? "rgba(37,99,235,.1)" : "transparent",
                      borderLeft: tab === item.k ? "3px solid #2563EB" : "3px solid transparent",
                    }}
                  >
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        background: "rgba(37,99,235,.1)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Ic name={item.icon} size={14} color="#3B82F6" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600 }}>{item.label}</div>
                      <div style={{ color: "#64748b", fontSize: 10, marginTop: 1 }}>{item.sub}</div>
                    </div>
                  </div>
                ))}

                <div style={{ height: 1, background: "#1A2535", margin: "6px 16px" }} />

                {/* PAGOS */}
                <div
                  style={{
                    color: "#374151",
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "1.2px",
                    textTransform: "uppercase",
                    padding: "10px 16px 4px",
                  }}
                >
                  PAGOS
                </div>

                {[
                  { icon: "credit-card", label: msg("Facturación", "Billing"), sub: "Plan Pro · $29/mes" },
                  { icon: "dollar-sign", label: msg("Cobros", "Payments"), sub: msg("Gestionar cobros", "Manage payments") },
                ].map((item, i) => (
                  <div
                    key={i}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", cursor: "pointer", opacity: 0.6 }}
                  >
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        background: "rgba(34,197,94,.1)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Ic name={item.icon} size={14} color="#22c55e" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600 }}>{item.label}</div>
                      <div style={{ color: "#64748b", fontSize: 10, marginTop: 1 }}>{item.sub}</div>
                    </div>
                    <span
                      style={{
                        background: "#1A2535",
                        color: "#64748b",
                        fontSize: 8,
                        borderRadius: 99,
                        padding: "2px 6px",
                        fontWeight: 700,
                      }}
                    >
                      PRONTO
                    </span>
                  </div>
                ))}
              </div>

              {/* Footer: cerrar sesión */}
              <div style={{ borderTop: "1px solid #1A2535", flexShrink: 0 }}>
                <div
                  onClick={() => {
                    clearAllIronTrackPrefixedKeys();
                    syncStateWithLocalStorage();
                  }}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", cursor: "pointer" }}
                >
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: "rgba(239,68,68,.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Ic name="log-out" size={14} color="#ef4444" />
                  </div>
                  <div style={{ color: "#ef4444", fontSize: 12, fontWeight: 600 }}>{msg("Cerrar sesión", "Log out")}</div>
                </div>
              </div>
            </div>
          </>
        )}
        {(tab === "settings" || tab === "perfil") && showCoachDesktopShell && !esAlumno && sessionData?.role === "entrenador" && sessionData && (
          <SettingsPage
            key={tab}
            embedInMainColumn
            coach={sessionData}
            onClose={function () {
              setTab("plan");
            }}
            initialSection={tab === "perfil" ? "perfil" : "preferencias"}
            toast2={toast2}
            setSessionData={setSessionData}
            syncStateWithLocalStorage={syncStateWithLocalStorage}
            lang={lang}
            setLang={setLang}
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            es={es}
            alumnosCount={alumnos.length}
            rutinasActivasCount={rutinasSBEntrenador.length}
            sesionesGlobales={sesionesGlobales}
            sb={sb}
            entrenadorId={sessionData.entrenadorId || "entrenador_principal"}
          />
        )}
        {tab==="plan"&&(
          <div className={esAlumno ? "mx-auto w-full max-w-[32rem] pt-4" : ""}>
            {esAlumno&&routines.length>0&&(()=>{
              const r0 = routines[0];
              const hoy = new Date().toLocaleDateString("es-AR");
              const totalDays = r0?.days?.length||0;
              const daysCompletedThisWeek = completedDays.filter(k=>k.startsWith((r0?.id||"")+"-")&&k.endsWith("-w"+currentWeek)).length;
              // Racha: semanas consecutivas con al menos 1 día entrenado
              const rachaActual = (() => {
                if(!r0) return 0;
                let streak = 0;
                // Semana actual cuenta si ya entrenó algo
                for(let w = currentWeek; w >= 0; w--) {
                  const daysInWeek = completedDays.filter(k =>
                    k.startsWith(r0.id+"-") && k.endsWith("-w"+w)
                  ).length;
                  if(daysInWeek > 0) streak++;
                  else if(w < currentWeek) break; // semana anterior sin días = se rompe la racha
                }
                return streak;
              })();
              const nextDayIdx = daysCompletedThisWeek < totalDays ? daysCompletedThisWeek : null;
              const weeklyPct = totalDays > 0 ? Math.min(100, Math.round((daysCompletedThisWeek / totalDays) * 100)) : 0;
              const todayDay = nextDayIdx !== null ? r0?.days?.[nextDayIdx] : null;
              const yaEntrenoHoy = Object.values(progress||{}).some(pg=>(pg.sets||[]).some(s=>s.date===hoy&&(s.week===undefined||s.week===currentWeek)));
              const totalEjHero = todayDay ? (todayDay.warmup || []).length + (todayDay.exercises || []).length : 0;
              const doneEjHero = todayDay ? countExercisesWithLogToday(todayDay, progress, hoy, currentWeek) : 0;
              const pctHero = totalEjHero > 0 ? Math.min(100, Math.round((100 * doneEjHero) / totalEjHero)) : 0;
              const progressStatusHero =
                pctHero === 0
                  ? msg("Comienza tu entrenamiento", "Start your training", "Comece o treino")
                  : pctHero < 100
                    ? msg("Sigue con tu entrenamiento", "Keep going", "Continue o treino")
                    : msg("Casi listo", "Almost there", "Quase pronto");
              return (
                <div style={{ marginBottom: 0 }}>
                  {/*
                    Slot de altura FIJA (minHeight + height monótonos vía RO): el colapso del header solo
                    usa transform/opacity en las capas internas; este contenedor NO debe encogerse al
                    hacer scroll — si encoge, Full body / Día 1 suben (CLS). Ver studentHeaderShellLockedHeightPxRef.
                  */}
                  <div
                    ref={function (el) {
                      studentHeaderShellRef.current = el;
                    }}
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      boxSizing: "border-box",
                    }}
                  >
                  <div
                    ref={function (el) {
                      studentHeaderExpandRef.current = el;
                      if (el) applyAlumnoHeaderLayerStyles(headerCollapsedRef.current);
                    }}
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: 0,
                      paddingLeft: 16,
                      paddingRight: 16,
                      zIndex: 2,
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                      transition: planScrollDiag.planHeaderLayerTransitions
                        ? "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease"
                        : "none",
                    }}
                  >
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: textMuted, fontWeight: 500, letterSpacing: 0.2, marginBottom: 4 }}>
                      {new Date().getHours()<12?(msg("BUENOS DÍAS", "GOOD MORNING", "BOM DIA")):new Date().getHours()<18?(msg("BUENAS TARDES", "GOOD AFTERNOON", "BOA TARDE")):(msg("BUENAS NOCHES", "GOOD EVENING", "BOA NOITE"))}
                    </div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: textMain, lineHeight: 1.1, letterSpacing: -0.3 }}>
                      {sessionData?.name?.split(" ")[0]||"Atleta"}
                    </div>
                    {rachaActual>=2&&(
                      <div style={{display:"flex",alignItems:"center",gap:5,marginTop:4}}>
                        <div style={{
                          display:"flex",alignItems:"center",gap:4,
                          background:"#F59E0B12",border:"1px solid #F59E0B33",
                          borderRadius:20,padding:"3px 10px"
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                          <span style={{fontSize:11,fontWeight:700,color:"#fbbf24"}}>
                            {rachaActual} {msg("semanas seguidas", "weeks straight")}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  {notaDia&&(
                    <div style={{background:"#2563EB12",border:"1px solid #2563EB33",borderRadius:12,
                      padding:"12px 16px",marginBottom:8,display:"flex",gap:8,alignItems:"flex-start",
                      animation:"slideUpFade 0.4s ease"}}>
                      <span style={{fontSize:18,flexShrink:0}}><Ic name="bookmark" size={16}/></span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:11,fontWeight:600,color:"#2563EB",letterSpacing:1,
                          marginBottom:4,textTransform:"uppercase"}}>
                          {msg("Nota de tu entrenador", "Coach note")}
                        </div>
                        <div style={{fontSize:15,color:textMain,lineHeight:1.5,fontWeight:400}}>{notaDia}</div>
                      </div>
                    </div>
                  )}
                  {/* ESTA SEMANA */}
                  <div style={{background:bgCard,borderRadius:14,padding:"12px 16px 13px",marginBottom:10,border:"1px solid "+border}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:6}}>
                      <span style={{fontSize:11,fontWeight:700,color:textMuted,letterSpacing:1,textTransform:"uppercase",lineHeight:1.2}}>{msg("Esta semana", "This week")}</span>
                      <span style={{fontSize:12,fontWeight:700,color:"#2563EB",whiteSpace:"nowrap",lineHeight:1.2}}>{msg("Semana", "Week")} {currentWeek+1}/4</span>
                    </div>
                    <div style={{fontSize:12,color:textMuted,fontWeight:600,marginBottom:8,lineHeight:1.25}}>
                      {daysCompletedThisWeek} {msg("de", "of")} {totalDays} {msg("días completados", "days completed")}
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{flex:1,height:8,borderRadius:999,overflow:"hidden",background:darkMode?"rgba(148,163,184,.18)":"rgba(15,23,42,.12)"}}>
                        <div style={{height:"100%",width:weeklyPct+"%",borderRadius:999,background:"linear-gradient(90deg,#2563EB,#22D3EE)",transition:"width .25s ease"}}/>
                      </div>
                      <span style={{minWidth:34,textAlign:"right",fontSize:12,fontWeight:800,color:"#2563EB",fontVariantNumeric:"tabular-nums",lineHeight:1.2}}>
                        {weeklyPct}%
                      </span>
                    </div>
                    {nextDayIdx !== null && (
                      <div style={{fontSize:12,color:textMuted,fontWeight:600,marginTop:8,lineHeight:1.25}}>
                        {"\u2022"} {msg("Hoy:", "Today:")}{" "}
                        <span style={{color:"#2563EB",fontWeight:800}}>{msg("Día", "Day")} {nextDayIdx+1}</span>
                      </div>
                    )}
                  </div>

                  {/* Entrenamiento de hoy — hero (layout premium; mismos handlers que antes) */}
                  {planScrollDiag.hoyCard&&todayDay&&!yaEntrenoHoy&&!session&&(
                    <CurrentWorkoutHero
                      msg={msg}
                      textMain={textMain}
                      textMuted={textMuted}
                      hoyBadgeText={msg("HOY", "TODAY", "HOJE")}
                      semDiaLine={
                        msg("Semana", "Week", "Semana") + " " + (currentWeek + 1) + " · " + msg("Día", "Day", "Dia") + " " + (nextDayIdx + 1)
                      }
                      dayTitle={msg("Día", "Day", "Dia") + " " + (nextDayIdx + 1)}
                      exerciseCount={totalEjHero}
                      durationMinutes={estimateDayMinutes(todayDay, currentWeek)}
                      completedExercises={doneEjHero}
                      totalExercises={totalEjHero}
                      progressStatusText={progressStatusHero}
                      ctaLabel={msg("Comenzar entrenamiento", "Start workout", "Começar treino")}
                      onStart={function () {
                        const snap = {};
                        [...(todayDay.warmup || []), ...(todayDay.exercises || [])].forEach(function (ex) {
                          snap[ex.id] = progress[ex.id]?.max || 0;
                        });
                        setPreSessionPRs({ ...snap });
                        setSessionPRList([]);
                        setSession({ rId: r0.id, dIdx: nextDayIdx, exIdx: 0, startTime: Date.now() });
                      }}
                    />
                  )}

                  {/* DÍA YA ENTRENADO */}
                  {planScrollDiag.completedTodayBanner&&yaEntrenoHoy&&!session&&(
                    <div style={{
                      background:"rgba(34,197,94,.08)",borderRadius:14,padding:"14px 16px",
                      marginBottom:8,display:"flex",alignItems:"center",gap:12,
                      border:"1px solid rgba(34,197,94,.18)",
                    }}>
                      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                        <circle cx="14" cy="14" r="13" fill="rgba(34,197,94,.15)"/>
                        <path d="M8 14l4.5 4.5L20 9" stroke="#22C55E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <div>
                        <div style={{fontSize:14,fontWeight:800,color:"#22C55E"}}>{msg("¡Entrenamiento completado!", "Workout done!")}</div>
                        <div style={{fontSize:12,color:textMuted}}>{msg("Buen trabajo, descansá.", "Great work, rest up.")}</div>
                      </div>
                    </div>
                  )}
                  </div>
                  <div
                    ref={function (el) {
                      studentHeaderMiniRef.current = el;
                      if (el) applyAlumnoHeaderLayerStyles(headerCollapsedRef.current);
                    }}
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: ALUMNO_HEADER_MINI_PX,
                      boxSizing: "border-box",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingLeft: 16,
                      paddingRight: 16,
                      paddingBottom: 8,
                      zIndex: 1,
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                      transition: planScrollDiag.planHeaderLayerTransitions
                        ? "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease"
                        : "none",
                    }}
                  >
                      <div style={{fontSize:15,fontWeight:700,color:textMain}}>
                        {sessionData?.name?.split(" ")[0]||"Atleta"}
                      </div>
                      {todayDay&&!yaEntrenoHoy&&!session&&(
                        <button className="hov"
                          style={{background:"#2563EB",color:"#fff",border:"none",
                            borderRadius:8,padding:"8px 14px",fontSize:13,
                            fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}
                          onClick={()=>{
                            const snap={};
                            [...(todayDay.warmup||[]),...(todayDay.exercises||[])].forEach(ex=>{snap[ex.id]=progress[ex.id]?.max||0;});
                            setPreSessionPRs({...snap});
                            setSessionPRList([]);setSession({rId:r0.id,dIdx:nextDayIdx,exIdx:0,startTime:Date.now()});
                          }}>
                          ⚡ {msg("Entrenar", "Train")}
                        </button>
                      )}
                      {yaEntrenoHoy&&<span style={{fontSize:13,color:"#22C55E",fontWeight:600}}>✅ {msg("Listo hoy", "Done today")}</span>}
                    </div>
                  </div>
                </div>
              );
            })()}

            {esAlumno&&routines.length===0&&(
              <div style={{textAlign:"center",padding:"60px 0",color:textMuted}}>
                <div style={{fontSize:48,marginBottom:12}}>📋</div>
                <div style={{fontSize:22,fontWeight:700,letterSpacing:1,marginBottom:8}}>{msg("Sin rutinas aun", "No routines yet")}</div>
                <div style={{fontSize:15}}>{msg("Crea tu primera rutina en RUTINAS", "Create your first routine in ROUTINES")}</div>
              </div>
            )}
            {esAlumno&&routines.length>0&&routines.map(r=>{
              const hoyStr = new Date().toLocaleDateString("es-AR");
              return (<div key={r.id} style={{marginBottom:20,marginTop:20}}>
                  {/* Título + meta (sin botón PDF arriba: exportación solo al final del plan) */}
                  {planScrollDiag.routineMetaPdf&&(
                  <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:12}}>
                    <div style={{
                      fontSize:15,
                      fontWeight:800,
                      letterSpacing:0.2,
                      lineHeight:1.25,
                      margin:0,
                      wordBreak:"break-word",
                      display:"-webkit-box",
                      WebkitLineClamp:2,
                      WebkitBoxOrient:"vertical",
                      overflow:"hidden",
                      color:textMain,
                    }}>{r.name}</div>
                    <div style={{
                      fontSize:12,
                      color:textMuted,
                      lineHeight:1.35,
                      minWidth:0,
                      display:"-webkit-box",
                      WebkitLineClamp:2,
                      WebkitBoxOrient:"vertical",
                      overflow:"hidden",
                    }}>{r.created} · {r.days.length} {msg("dias", "days")}{r.note?" · "+r.note:""}</div>
                  </div>
                  )}
                  {planScrollDiag.dayList&&(
                  <>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:12,marginBottom:14,flexWrap:"wrap"}}>
                    <span style={{fontSize:17,fontWeight:800,color:textMain,letterSpacing:0.2}}>{msg("Plan de la semana", "Weekly plan")}</span>
                    <span style={{fontSize:12,color:textMuted,fontWeight:600,whiteSpace:"nowrap"}}>
                      {r.days.length} {msg("días", "days")}
                      {" · "}
                      {completedDays.filter(function(k){return k.startsWith(r.id+"-")&&k.endsWith("-w"+currentWeek);}).length}{" "}
                      {msg("completados", "done")}
                    </span>
                  </div>
                  {r.days.map((d,di)=>{
                    const dayKey=r.id+"-"+di+"-w"+currentWeek;
                    const isDayDone=completedDays.includes(dayKey);
                    const daysCompletedR=completedDays.filter(k=>k.startsWith(r.id+"-")&&k.endsWith("-w"+currentWeek)).length;
                    const localNextDayIdx=daysCompletedR < r.days.length ? daysCompletedR : null;
                    const isNextDay=di===localNextDayIdx;
                    const isFuture=localNextDayIdx!==null&&di>localNextDayIdx;
                    const totalEj=((d.warmup||[]).length+(d.exercises||[]).length);
                    const isOpen=expandedPlanDay===r.id+"-"+di;
                    const estMin=estimateDayMinutes(d,currentWeek);
                    const metaLine=
                      totalEj + " " + msg("ejercicios", "exercises", "exercícios") + " · ~" + estMin + " " + msg("min", "min", "min");
                    const doneEjRow = isDayDone
                      ? totalEj
                      : isNextDay
                        ? countExercisesWithLogToday(d, progress, hoyStr, currentWeek)
                        : 0;
                    const rightProgress = doneEjRow + "/" + totalEj;

                    return(
                      <WeeklyPlanDayCard
                        key={r.id+"-plan-day-"+di}
                        onHeaderClick={function(){setExpandedPlanDay(isOpen?null:r.id+"-"+di)}}
                        isOpen={isOpen}
                        isDayDone={isDayDone}
                        isNextDay={isNextDay}
                        isFuture={isFuture}
                        dayNumberDisplay={di+1}
                        titleNode={msg("Día", "Day", "Dia") + " " + (di + 1)}
                        metaLine={metaLine}
                        rightProgress={rightProgress}
                        hoyBadgeText={isNextDay&&!isDayDone?msg("HOY", "TODAY", "HOJE"):null}
                        doneLabel={null}
                        nextLabel={null}
                        textMain={textMain}
                        textMuted={textMuted}
                        border={border}
                        bgCard={bgCard}
                        bgSub={bgSub}
                        accent="#2563EB"
                        success="#22C55E"
                        children={isOpen?(
                          <div style={{paddingTop:4}}>
                            {(d.warmup||[]).length>0&&(
                              <div style={{marginTop:12,marginBottom:12}}>
                                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                                  <span style={{width:3,height:12,borderRadius:2,background:"#F59E0B"}}/>
                                  <span style={{fontSize:11,fontWeight:700,color:"#F59E0B",letterSpacing:1}}>{msg("ENTRADA EN CALOR", "WARM-UP")}</span>
                                </div>
                                {(d.warmup||[]).map(function(ex,ei){
                                  var inf=allEx.find(function(e){return e.id===ex.id});
                                  var nombre=resolveExerciseTitle(inf||null,ex,es);
                                  var vUrl=resolveVideoUrl(inf||null,ex,videoOverrides);
                                  return(
                                    <div key={r.id+"-d"+di+"-wu-"+(ex.id||"ex")+"-"+ei} style={{display:"flex",alignItems:"center",gap:10,padding:"14px 0",borderBottom:ei<(d.warmup||[]).length-1?"1px solid "+border:"none"}}>
                                      <div style={{width:3,height:20,borderRadius:2,background:"#F59E0B44",flexShrink:0}}/>
                                      <div style={{flex:1,fontSize:16,fontWeight:700,color:textMain}}>{nombre}</div>
                                      <span style={{fontSize:13,color:"#A3B4CC",fontWeight:600}}>{ex.sets||"-"}×{ex.reps||"-"}</span>
                                      <ExerciseVideoPlayButton
                                        hasVideo={!!vUrl}
                                        onClick={function(){var vid=getYTVideoId(vUrl);if(vid)setVideoModal({videoId:vid,nombre:nombre});else window.open(vUrl,"_blank")}}
                                        ariaLabel={msg("Ver video del ejercicio","View exercise video")}
                                        ariaLabelDisabled={msg("Video no disponible","No video available")}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            <div style={{marginBottom:12}}>
                              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                                <span style={{width:3,height:12,borderRadius:2,background:"#2563EB"}}/>
                                <span style={{fontSize:11,fontWeight:700,color:"#2563EB",letterSpacing:1}}>{msg("BLOQUE PRINCIPAL", "MAIN BLOCK")}</span>
                              </div>
                              {d.exercises.map(function(ex,ei){
                                var inf=allEx.find(function(e){return e.id===ex.id});
                                var nombre=resolveExerciseTitle(inf||null,ex,es);
                                var vUrl=resolveVideoUrl(inf||null,ex,videoOverrides);
                                var w=((ex.weeks||[])[currentWeek])||{};
                                var s=w.sets||ex.sets||"-";
                                var rp=w.reps||ex.reps||"-";
                                var kg2=w.kg||ex.kg||"";
                                return(
                                  <div key={r.id+"-d"+di+"-ex-"+(ex.id||"ex")+"-"+ei} style={{display:"flex",alignItems:"center",gap:10,padding:"16px 0",borderBottom:ei<d.exercises.length-1?"1px solid "+border:"none"}}>
                                    <div style={{width:3,height:24,borderRadius:2,background:border,flexShrink:0}}/>
                                    <div style={{flex:1,minWidth:0}}>
                                      <div style={{fontSize:17,fontWeight:800,color:textMain}}>{nombre}</div>
                                      <div style={{fontSize:13,color:"#A3B4CC",fontWeight:500,marginTop:2,display:"flex",gap:6,flexWrap:"wrap"}}>
                                        <span style={{fontWeight:700}}>{s}×{rp}</span>{kg2&&<span>{kg2}kg</span>}{ex.pause&&<span>⏱ {fmtP(ex.pause)}</span>}
                                      </div>
                                    </div>
                                    <ExerciseVideoPlayButton
                                      hasVideo={!!vUrl}
                                      onClick={function(){var vid=getYTVideoId(vUrl);if(vid)setVideoModal({videoId:vid,nombre:nombre});else window.open(vUrl,"_blank")}}
                                      ariaLabel={msg("Ver video del ejercicio","View exercise video")}
                                      ariaLabelDisabled={msg("Video no disponible","No video available")}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                            {/* Botón iniciar/estado del día */}
                            {isDayDone&&(
                              <div style={{textAlign:"center",padding:"8px",color:"#22C55E",fontSize:13,fontWeight:700}}>
                                ✅ {msg("Día completado esta semana", "Day completed this week")}
                              </div>
                            )}
                            {isNextDay&&!isDayDone&&(
                              <button className="hov" style={{width:"100%",marginTop:4,padding:"12px",background:"#2563EB",color:"#fff",border:"none",borderRadius:10,fontSize:15,fontWeight:900,letterSpacing:1,cursor:"pointer",fontFamily:"inherit"}} onClick={function(){
                                var snap={};
                                [].concat(d.warmup||[],d.exercises||[]).forEach(function(ex){snap[ex.id]=progress[ex.id]?.max||0});
                                setPreSessionPRs(snap);
                                setSessionPRList([]);setSession({rId:r.id,dIdx:di,exIdx:0,startTime:Date.now()});
                              }}>{msg("INICIAR ENTRENAMIENTO", "START WORKOUT")}</button>
                            )}
                            {isFuture&&(
                              <div style={{textAlign:"center",padding:"8px",color:textMuted,fontSize:12,fontWeight:700,background:bgSub,borderRadius:8,marginTop:4}}>
                                <Ic name="lock" size={13}/> {es?"Completá el Día "+(localNextDayIdx+1)+" primero":"Complete Day "+(localNextDayIdx+1)+" first"}
                              </div>
                            )}
                          </div>
                        ):null}
                      />
                    );
                  })}
                  </>
                  )}
                  {/* Export PDF: no usa planScrollDiag (el bloque meta sí); solo rutina con días — mismo tab Plan que envuelve este mapa. */}
                  {(r.days||[]).length>0&&(
                    <button
                      type="button"
                      onClick={function(){ downloadRoutinePdf(r); }}
                      style={{
                        width:"100%",
                        marginTop:20,
                        marginBottom:12,
                        padding:"20px 20px 22px",
                        background:"linear-gradient(180deg, rgba(37,99,235,0.22) 0%, rgba(15,23,42,0.9) 100%)",
                        color:"#fff",
                        border:"1px solid rgba(96,165,250,0.45)",
                        borderRadius:16,
                        fontFamily:"Barlow Condensed, DM Sans, system-ui, sans-serif",
                        cursor:"pointer",
                        display:"flex",
                        flexDirection:"column",
                        alignItems:"center",
                        justifyContent:"center",
                        gap:6,
                        boxSizing:"border-box",
                        textAlign:"center",
                        boxShadow:"0 12px 32px rgba(0,0,0,0.25)",
                      }}
                    >
                      <div
                        style={{
                          display:"flex",
                          alignItems:"center",
                          justifyContent:"center",
                          gap:10,
                        }}
                      >
                        <Ic name="download" size={22} color="#fff"/>
                        <span
                          style={{
                            fontSize:16,
                            fontWeight:900,
                            letterSpacing:0.6,
                            textTransform:"uppercase",
                            lineHeight:1.2,
                          }}
                        >
                          {msg("Descargar rutina (PDF)", "Download routine (PDF)", "Baixar rotina (PDF)")}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize:12,
                          fontWeight:600,
                          color:"rgba(226,232,240,0.9)",
                          maxWidth:280,
                          lineHeight:1.35,
                        }}
                      >
                        {msg("Lleva tu plan a donde quieras", "Take your plan anywhere", "Leve seu plano para onde quiser")}
                      </span>
                    </button>
                  )}

                  {/* Sparkline de tendencia 30 días */}
                {(()=>{
                  const setsAlu = Object.values(progress||{})
                    .flatMap(pg => (pg.sets||[]))
                    .filter(s => s.kg > 0)
                    .sort((x,y) => new Date(x.date||0) - new Date(y.date||0));
                  if(setsAlu.length < 3) return null;
                  // Agrupar por semana relativa (últimas 8 semanas)
                  const now = Date.now();
                  const buckets = {};
                  setsAlu.forEach(s => {
                    const d = new Date(s.date||now);
                    const weekAgo = Math.floor((now - d.getTime()) / (7*24*60*60*1000));
                    const bucket = Math.min(weekAgo, 7);
                    if(!buckets[bucket]) buckets[bucket] = [];
                    buckets[bucket].push(s.kg);
                  });
                  const weeks = Array.from({length:8},(_,i)=>7-i);
                  const data = weeks.map(w => {
                    const vals = buckets[w];
                    return vals ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
                  }).filter(v => v !== null);
                  if(data.length < 2) return null;
                  const first = data[0], last = data[data.length-1];
                  const pct = first>0 ? Math.round((last-first)/first*100) : 0;
                  const color = pct > 0 ? "#22C55E" : pct < -2 ? "#F59E0B" : "#2563EB";
                  const fill  = pct > 0 ? "rgba(34,197,94,.1)" : pct < -2 ? "rgba(245,158,11,.08)" : "rgba(37,99,235,.08)";
                  const min = Math.min(...data), max = Math.max(...data), range = max-min||1;
                  const W=120, H=24, pad=2;
                  const pts = data.map((v,i)=>({
                    x: pad + (i/(data.length-1))*(W-pad*2),
                    y: H - pad - ((v-min)/range)*(H-pad*2)
                  }));
                  const pathD = pts.map((p,i)=>(i===0?`M${p.x},${p.y}`:`L${p.x},${p.y}`)).join(' ');
                  const areaD = `M${pts[0].x},${H} ${pathD} L${pts[pts.length-1].x},${H} Z`;
                  return (
                    <div style={{
                      display:"flex",alignItems:"center",gap:8,
                      marginLeft:46,marginTop:6,
                      padding:"5px 8px",borderRadius:8,
                      background:_dm?"#162234":"#EEF2F7"
                    }}>
                      <span style={{fontSize:9,color:textMuted,fontWeight:600,whiteSpace:"nowrap"}}>
                        {msg("30d carga", "30d load")}
                      </span>
                      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{flex:1}}>
                        <path d={areaD} fill={fill}/>
                        <path d={pathD} stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round" strokeLinecap="round"/>
                        <circle cx={pts[pts.length-1].x} cy={pts[pts.length-1].y} r="2.5" fill={color}/>
                      </svg>
                      <span style={{
                        fontSize:10,fontWeight:700,color,
                        whiteSpace:"nowrap",minWidth:30,textAlign:"right"
                      }}>
                        {pct>0?"+":""}{pct}%
                      </span>
                    </div>
                  );
                })()}
                </div>
              );
            })}
          </div>
        )}
        {tab==="library"&&(
          <div className={esAlumno ? "mx-auto w-full max-w-[32rem] pt-4" : "flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-y-auto"}>
            {esAlumno && <LibraryAlumno allEx={allEx} darkMode={darkMode} es={es} routines={routines} videoOverrides={videoOverrides} setVideoModal={setVideoModal} msg={msg}/>}
            {!esAlumno && <GestionBiblioteca allEx={allEx} setPatternOverrides={setPatternOverrides} darkMode={darkMode} sb={sb} customEx={customEx} setCustomEx={setCustomEx} toast2={toast2} setTab={setTab} videoOverrides={videoOverrides} setVideoOverrides={setVideoOverrides} setVideoModal={setVideoModal} openNewExerciseTick={bibOpenNewExerciseTick}/>}
          </div>
        )}
        {tab==="routines"&&!esAlumno&&(
          <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col">
          <RutinaView
            setTab={setTab}
            border={border}
            textMuted={textMuted}
            bgCard={bgCard}
            textMain={textMain}
            darkMode={darkMode}
            bgSub={bgSub}
            lang={lang}
            es={es}
            filtroRut={filtroRut}
            setFiltroRut={setFiltroRut}
            card={card}
            setNewR={setNewR}
            routines={routines}
            setRoutines={setRoutines}
            allEx={allEx}
            toast2={toast2}
            setAddExModal={setAddExModal}
            setAddExSearch={setAddExSearch}
            setAddExPat={setAddExPat}
            setAddExMuscle={setAddExMuscle}
            setAddExSelectedIds={setAddExSelectedIds}
            setDupDayModal={setDupDayModal}
            alumnos={alumnosActivosLimpios}
            sb={sb}
            setAssignRoutineId={setAssignRoutineId}
            desktopCoachStableLayout={coachDesktopNavHidden}
            rutinasSBEntrenador={rutinasSBEntrenador}
            setRutinasSBEntrenador={setRutinasSBEntrenador}
          />
          </div>
        )}
        {tab==="scanner"&&!esAlumno&&(
          <div className="min-w-0 max-w-full">
            <ScannerRutina darkMode={darkMode} sb={sb} setRoutines={setRoutines} alumnos={alumnosActivosLimpios} toast2={toast2} es={es} setTab={setTab} user={user} customEx={customEx}/>
          </div>
        )}
        {tab==="biblioteca"&&!esAlumno&&(
          <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-y-auto">
            <GestionBiblioteca allEx={allEx} setPatternOverrides={setPatternOverrides} darkMode={darkMode} sb={sb} customEx={customEx} setCustomEx={setCustomEx} toast2={toast2} setTab={setTab} videoOverrides={videoOverrides} setVideoOverrides={setVideoOverrides} setVideoModal={setVideoModal} openNewExerciseTick={bibOpenNewExerciseTick}/>
          </div>
        )}
        {tab==="progress"&&showAlumnoProgressStack&&(
          <StudentProgressSection
            progress={progress}
            EX={EX}
            allEx={allEx}
            sesiones={sesiones}
            sessionData={sessionData}
            sb={sb}
            sharedParam={sharedParam||btoa(JSON.stringify({alumnoId:sessionData?.alumnoId}))}
            es={es}
            expectedDaysPerWeek={routineDaysCount}
            onRegistrarPrimerEntrenamiento={()=>setTab("plan")}
            esEntrenador={false}
          />
        )}
        {tab==="progress"&&!showAlumnoProgressStack&&!(sessionData?.role==="entrenador"&&!esAlumno)&&(
          <div className="mx-auto w-full min-w-0 max-w-[480px] lg:max-w-3xl">
            <GraficoProgreso allEx={allEx} es={es} darkMode={darkMode} progress={progress} EX={EX} readOnly={readOnly||esAlumno} sharedParam={sharedParam} sb={sb} sessionData={sessionData} sesiones={sesiones}/>
          </div>
        )}
        {tab==="progress"&&!showAlumnoProgressStack&&!(sessionData?.role==="entrenador"&&!esAlumno)&&(
          <div className="min-w-0 max-w-full overflow-x-hidden">
            {EX.filter(ex=>progress[ex.id]?.sets?.length>0).map(ex=>{
              const pat=PATS[ex.pattern]||{icon:"E",color:textMuted,label:"Otro",labelEn:"Other"}; const pg=progress[ex.id];
              return(
                <div key={ex.id} className="hov" style={{...card,cursor:"pointer"}} onClick={()=>setDetailEx(ex)}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <span style={{fontSize:22}}>{pat.icon}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:18,fontWeight:700}}>{es?ex.name:ex.nameEn}</div>
                      <div style={{fontSize:13,color:textMuted}}>{ex.muscle}</div>
                    </div>
                    <div style={{textAlign:"right"}}><div style={{fontSize:22,fontWeight:700,color:pat.color}}>{pg.max}kg</div><div style={{fontSize:13,color:textMuted}}>max</div></div>
                  </div>
                  <div style={{display:"flex",gap:4,overflowX:"auto"}}>
                    {(pg.sets||[]).slice(0,5).map((s2,i)=>(
                      <div key={ex.id+"-pg-mini-"+(s2.date||"")+"-"+(s2.kg??"")+"-"+(s2.reps??"")+"-"+i} style={{background:darkMode?"#162234":"#E2E8F0",borderRadius:6,padding:"4px 8px",flexShrink:0,fontSize:13}}>
                        <div style={{fontWeight:700}}>{s2.kg}kg x {s2.reps}</div>
                        <div style={{color:textMuted,fontSize:13}}>{s2.date}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {/* ── Rutinas asignadas (Supabase) ── */}
            {rutinasSBEntrenador.length>0&&(<div style={{marginTop:16}}>
              <div style={{fontSize:11,fontWeight:800,color:"#22C55E",letterSpacing:2,marginBottom:8,textTransform:"uppercase",borderLeft:"3px solid #22C55E",paddingLeft:8}}>{msg("RUTINAS ASIGNADAS", "ASSIGNED ROUTINES")} ({rutinasSBEntrenador.length})</div>
              {rutinasSBEntrenador.map(function(rSB,ri){
                var alumnoInfo=alumnos.find(function(al){return al.id===rSB.alumno_id});
                var diasSB=rSB.datos?.days||[];
                return(<div key={rSB.id||ri} style={{background:bgCard,borderRadius:12,padding:"16px",marginBottom:8,border:"1px solid "+border}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                    <div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{fontSize:18,fontWeight:800,color:textMain}}>{rSB.nombre}</div>
                        <span style={{background:"#22C55E22",color:"#22C55E",borderRadius:6,padding:"1px 7px",fontSize:10,fontWeight:700}}>☁️</span>
                      </div>
                      {alumnoInfo&&<div style={{fontSize:13,fontWeight:700,color:textMuted,marginTop:2}}>👤 {alumnoInfo.nombre||alumnoInfo.email}</div>}
                      <div style={{fontSize:13,color:textMuted}}>{diasSB.length} {msg("días", "days")}</div>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button className="hov" style={{background:"#2563EB22",color:"#2563EB",border:"none",borderRadius:8,padding:"8px 12px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}} onClick={function(){var rutLocal={id:rSB.id,...(rSB.datos||{}),name:rSB.nombre,saved:true,alumno_id:rSB.alumno_id,alumno:alumnoInfo?.nombre||""};setRoutines(function(p){var ex=p.find(function(x){return x.id===rSB.id});return ex?p:[rutLocal,...p]});toast2(msg("Abierta para editar", "Opened for editing"));}}>{msg("Editar", "Edit")}</button>
                      <button className="hov" style={{background:"#22C55E22",color:"#22C55E",border:"none",borderRadius:8,padding:"8px 10px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}} onClick={function(){var newId=uid();var copia={id:newId,name:rSB.nombre+" (copia)",days:(rSB.datos?.days||[]).map(function(d){return{...d,warmup:(d.warmup||[]).map(function(e){return{...e}}),exercises:(d.exercises||[]).map(function(e){return{...e}})}}),collapsed:false,saved:false};setRoutines(function(p){return[...p,copia]});setAssignRoutineId(newId);toast2(msg("Duplicada", "Duplicated"));}}><Ic name="copy" size={14}/></button>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:4}}>{diasSB.map(function(d,di){return(<span key={(rSB.id||"rut")+"-dchip-"+di} style={{background:bgSub,borderRadius:6,padding:"2px 8px",fontSize:11,color:textMuted,fontWeight:600}}>{d.label||("Día "+(di+1))} · {((d.warmup||[]).length+(d.exercises||[]).length)} ej.</span>)})}</div>
                </div>);
              })}
            </div>)}
            {Object.keys(progress).length===0&&(
              <div style={{textAlign:"center",padding:"60px 0",color:textMuted}}>
                <div style={{fontSize:48,marginBottom:12}}>📊</div>
                <div style={{fontSize:22,fontWeight:700,letterSpacing:1}}>{msg("Sin registros aun", "No records yet")}</div>
              </div>
            )}
          </div>
        )}
        {tab==="alumnos"&&sessionData?.role==="entrenador"&&(
          <div className="min-w-0 max-w-full" style={{background:coachAluShell,marginLeft:showCoachDesktopShell?0:-4,marginRight:showCoachDesktopShell?0:-4,padding:"8px 0 20px",borderRadius:12}}>
            <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:8}}>
              <div style={{fontSize:22,fontWeight:800,letterSpacing:1,color:textMain,minWidth:0,flex:"1 1 12rem"}}><Ic name="users" size={18} color={textMain}/> {msg("MIS ALUMNOS", "MY ATHLETES")}</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",flexShrink:0}}>
                <button className="hov" style={{background:coachAluGhostBtn,color:textMuted,border:"1px solid "+coachAluBorderSoft,borderRadius:8,padding:"8px 8px",fontSize:13,cursor:"pointer"}} onClick={()=>setAliasModal(true)} aria-label={msg("Datos de pago", "Payment info")}><Ic name="share" size={16}/></button>
                <button className="hov" style={{background:coachAluGhostBtn,color:textMuted,border:"1px solid "+coachAluBorderSoft,borderRadius:8,padding:"8px 8px",fontSize:13,cursor:"pointer"}} onClick={cargarAlumnos} aria-label={msg("Actualizar", "Refresh")}><Ic name="refresh-cw" size={16}/></button>
                <button className="hov" style={{background:"#2563EB",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontSize:15,fontWeight:700,cursor:"pointer"}} onClick={()=>setNewAlumnoForm(true)}>+ {msg("Nuevo", "New")}</button>
              </div>
            </div>

            {routines.length>0&&(
              <div style={{marginBottom:12,padding:"12px 14px",background:bgSub,borderRadius:12,border:"1px solid "+border}}>
                <div style={{fontSize:11,fontWeight:800,letterSpacing:0.8,color:"#2563EB",marginBottom:8}}>{msg("RUTINA QUE SE ASIGNA AL TOCAR «ASIGNAR»", "ROUTINE USED WHEN YOU TAP «ASSIGN»")}</div>
                {routines.length===1 ? (
                  <div style={{fontSize:16,fontWeight:700,color:textMain}}>{routines[0].name}</div>
                ) : (
                  <select
                    style={{width:"100%",background:bgCard,color:textMain,border:"1px solid "+border,borderRadius:10,padding:"10px 12px",fontSize:15,fontWeight:600,fontFamily:"inherit",cursor:"pointer",outline:"none"}}
                    value={routineForAssign?.id||""}
                    onChange={function(e){setAssignRoutineId(e.target.value);}}>
                    {routines.map(function(r){
                      return <option key={r.id} value={r.id}>{r.name||"—"} · {(r.days||[]).length} {msg("días", "days")}</option>;
                    })}
                  </select>
                )}
                <div style={{fontSize:12,color:textMuted,marginTop:6}}>{msg("Creá o editá rutinas en RUTINAS. Con varias listas, elegí cuál mandar acá.", "Create or edit routines under ROUTINES. If you have several, pick which one to send.")}</div>
              </div>
            )}

            <div style={{marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:10,background:coachAluSurface,border:"1px solid "+coachAluBorderSoft,borderRadius:12,padding:"10px 12px",boxShadow:darkMode ? "none" : "0 1px 2px rgba(15,23,42,0.06)"}}>
                <Ic name="search" size={18} color={textMuted}/>
                <input
                  type="search"
                  value={coachAlumnosSearch}
                  onChange={function (e) { setCoachAlumnosSearch(e.target.value); }}
                  placeholder={msg("Buscar alumno...", "Search athlete...")}
                  style={{flex:1,background:"transparent",border:"none",outline:"none",color:textMain,fontSize:15,fontFamily:"inherit",minWidth:0}}
                />
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>
                {[
                  { k: "todos", es: "Todos", en: "All", n: coachAlumnosCounts.todos },
                  { k: "activos", es: "Activos", en: "Active", n: coachAlumnosCounts.activos },
                  { k: "inactivos", es: "Inactivos", en: "Inactive", n: coachAlumnosCounts.inactivos },
                  { k: "sin_rutina", es: "Sin rutina", en: "No routine", n: coachAlumnosCounts.sin_rutina },
                ].map(function (chip) {
                  var sel = coachAlumnosFilter === chip.k;
                  return (
                    <button
                      key={chip.k}
                      type="button"
                      className="hov"
                      onClick={function () { setCoachAlumnosFilter(chip.k); }}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 999,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        border: sel ? "1px solid #2563eb" : "1px solid "+coachAluBorderSoft,
                        background: sel ? (darkMode ? "rgba(59,130,246,0.2)" : "rgba(37,99,235,0.1)") : coachAluSurface,
                        color: sel ? "#2563eb" : textMuted,
                      }}
                    >
                      {es ? chip.es : chip.en} ({chip.n})
                    </button>
                  );
                })}
              </div>
            </div>

            {newAlumnoForm&&(
              <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>{setNewAlumnoForm(false);setNewAlumnoData({nombre:"",email:"",pass:""});setNewAlumnoErrors({nombre:false,email:false});}}>
                <div style={{background:bgCard,borderRadius:"16px 16px 0 0",padding:"20px 16px",width:"100%",maxWidth:480,paddingBottom:32}} onClick={e=>e.stopPropagation()}>
                  <div style={{fontSize:15,fontWeight:800,letterSpacing:1,marginBottom:16,color:textMain}}>{msg("NUEVO ALUMNO", "NEW ATHLETE")}</div>
                  <div style={{marginBottom:8}}>
                    <span style={{fontSize:11,fontWeight:700,letterSpacing:0.3,color:textMuted,marginBottom:4,display:"block"}}>{msg("NOMBRE", "NAME")}</span>
                    <input
                      style={{background:bgSub,color:textMain,
                        border:"1px solid "+(newAlumnoErrors.nombre?"#EF4444":newAlumnoData.nombre.trim().length>1?"#22C55E":border),
                        borderRadius:8,padding:"8px 12px",width:"100%",fontSize:15,
                        transition:"border-color .2s ease",outline:"none"}}
                      value={newAlumnoData.nombre}
                      onChange={e=>{setNewAlumnoData(p=>({...p,nombre:e.target.value}));if(e.target.value.trim().length>1)setNewAlumnoErrors(p=>({...p,nombre:false}));}}
                      onBlur={e=>{if(!e.target.value.trim())setNewAlumnoErrors(p=>({...p,nombre:true}));}}
                      placeholder={msg("Nombre completo", "Full name")}/>
                    {newAlumnoErrors.nombre&&<div style={{fontSize:11,color:"#EF4444",marginTop:4,fontWeight:700}}><Ic name="alert-triangle" size={14} color="#F59E0B"/> {msg("El nombre es obligatorio", "Name is required")}</div>}
                  </div>
                  <div style={{marginBottom:8}}>
                    <span style={{fontSize:11,fontWeight:700,letterSpacing:0.3,color:textMuted,marginBottom:4,display:"block"}}>EMAIL</span>
                    <input
                      style={{background:bgSub,color:textMain,
                        border:"1px solid "+(newAlumnoErrors.email?"#EF4444":/^[^@]+@[^@]+\.[^@]+$/.test(newAlumnoData.email)?"#22C55E":border),
                        borderRadius:8,padding:"8px 12px",width:"100%",fontSize:15,
                        transition:"border-color .2s ease",outline:"none"}}
                      value={newAlumnoData.email} type="email"
                      onChange={e=>{setNewAlumnoData(p=>({...p,email:e.target.value}));if(/^[^@]+@[^@]+\.[^@]+$/.test(e.target.value))setNewAlumnoErrors(p=>({...p,email:false}));}}
                      onBlur={e=>{if(!/^[^@]+@[^@]+\.[^@]+$/.test(e.target.value))setNewAlumnoErrors(p=>({...p,email:true}));}}
                      placeholder="email@ejemplo.com"/>
                    {newAlumnoErrors.email&&<div style={{fontSize:11,color:"#EF4444",marginTop:4,fontWeight:700}}><Ic name="alert-triangle" size={14} color="#F59E0B"/> {msg("Email inválido (ej: nombre@mail.com)", "Invalid email (e.g. name@mail.com)")}</div>}
                  </div>
                  <div style={{marginBottom:16}}>
                    <span style={{fontSize:11,fontWeight:700,letterSpacing:0.3,color:textMuted,marginBottom:4,display:"block"}}>{msg("CONTRASEÑA", "PASSWORD")}</span>
                    <input style={{background:bgSub,color:textMain,border:"1px solid "+border,borderRadius:8,padding:"8px 12px",width:"100%",fontSize:15}} value={newAlumnoData.pass} onChange={e=>setNewAlumnoData(p=>({...p,pass:e.target.value}))} placeholder="Contraseña" type="password"/>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button className="hov" style={{background:bgSub,color:textMuted,border:"1px solid "+border,borderRadius:12,padding:"12px 16px",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>{setNewAlumnoForm(false);setNewAlumnoData({nombre:"",email:"",pass:""});setNewAlumnoErrors({nombre:false,email:false});}}>{msg("Cancelar", "Cancel")}</button>
                    <button className="hov" style={{background:"#2563EB",color:"#fff",border:"none",borderRadius:12,padding:"12px 16px",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",flex:1}} onClick={async()=>{
                      const errNom = !newAlumnoData.nombre.trim();
                      const errEm = !/^[^@]+@[^@]+\.[^@]+$/.test(newAlumnoData.email);
                      if(errNom||errEm){setNewAlumnoErrors({nombre:errNom,email:errEm});return;}
                      setLoadingSB(true);
                      const res = await sb.createAlumno({nombre:newAlumnoData.nombre.trim(),email:newAlumnoData.email.trim(),password:newAlumnoData.pass.trim()||"irontrack2024",entrenador_id:ENTRENADOR_ID});
                      if(res&&res[0]){setAlumnos(prev=>cleanActiveCoachAlumnos([...prev,res[0]],ENTRENADOR_ID));toast2(msg("Alumno creado ✓", "Athlete created ✓"));setNewAlumnoForm(false);setNewAlumnoData({nombre:"",email:"",pass:""});setNewAlumnoErrors({nombre:false,email:false});}
                      else{toast2("Error al crear alumno");}
                      setLoadingSB(false);
                    }}>GUARDAR</button>
                  </div>
                </div>
              </div>
            )}

            {loadingSB&&(
              <div>
                {[1,2,3].map(i=>(
                  <div key={"alumno-list-skel-"+i} style={{background:bgCard,borderRadius:12,padding:"16px",marginBottom:8,border:"1px solid "+border}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <div style={{flex:1}}>
                        <div className="sk" style={{height:16,width:"55%",marginBottom:8}}/>
                        <div className="sk" style={{height:12,width:"35%"}}/>
                      </div>
                      <div style={{display:"flex",gap:8}}>
                        <div className="sk" style={{width:32,height:32,borderRadius:8}}/>
                        <div className="sk" style={{width:52,height:32,borderRadius:8}}/>
                        <div className="sk" style={{width:32,height:32,borderRadius:8}}/>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {alumnos.length===0&&!loadingSB&&(
              <div style={{textAlign:"center",padding:"30px 0",color:textMuted}}>
                <div style={{fontSize:36,marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <Ic name="users" size={34} color={textMuted}/>
                </div>
                <div style={{fontSize:15,fontWeight:700,color:textMain}}>{msg("Sin alumnos aún", "No athletes yet")}</div>
              </div>
            )}
            {alumnos.length>0 && coachAlumnosListaFiltrada.length===0 && !loadingSB && (
              <div style={{textAlign:"center",padding:"24px 12px",color:textMuted,fontSize:15,fontWeight:600}}>
                {msg("No hay alumnos que coincidan con la búsqueda o el filtro.", "No athletes match your search or filter.")}
              </div>
            )}

            {coachAlumnosListaFiltrada.map(a=>{
              const rutinaAsignada = getRutinaAsignadaAlumno(a);
              console.log("[RUTINA ALUMNO DEBUG]", {
                alumno: a.nombre || a.name,
                alumno_id: a.id,
                rutinasSB_count: Array.isArray(rutinasSB) ? rutinasSB.length : null,
                rutinasSBEntrenador_count: Array.isArray(rutinasSBEntrenador) ? rutinasSBEntrenador.length : null,
                routines_count: Array.isArray(routines) ? routines.length : null,
                rutinasUnificadas_count: Array.isArray(rutinasUnificadas) ? rutinasUnificadas.length : null,
                candidatos: (rutinasUnificadas || []).filter(function (r) {
                  var alumnoRutinaId = getRutinaAlumnoId(r);
                  return alumnoRutinaId != null && String(alumnoRutinaId) === String(a.id);
                }).map(function (r) {
                  return {
                    id: r.id,
                    nombre: r.nombre,
                    alumno_id: r.alumno_id,
                    assigned_to: r.assigned_to,
                    atleta_id: r.atleta_id,
                    alumnoId: r.alumnoId,
                    datos_alumno_id: r.datos?.alumno?.id,
                    datos_alumnoId: r.datos?.alumnoId,
                    entrenador_id: r.entrenador_id
                  };
                }),
                resultado_getRutinaAsignadaAlumno: rutinaAsignada ? {
                  id: rutinaAsignada.id,
                  nombre: rutinaAsignada.nombre,
                  alumno_id: rutinaAsignada.alumno_id,
                  entrenador_id: rutinaAsignada.entrenador_id
                } : null
              });
              return (
              <div key={a.id} style={{position:"relative",background:coachAluSurface,borderRadius:12,padding:"14px 14px 12px",marginBottom:10,border:alumnoActivo?.id===a.id?"1px solid #2563eb":"1px solid "+coachAluBorderSoft,boxShadow:darkMode ? "none" : "0 1px 3px rgba(15,23,42,0.08)"}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                  <div style={{width:48,height:48,borderRadius:"50%",background:"#2563eb",color:"#fff",fontSize:20,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:"inherit"}}>
                    {(a.nombre||a.email||"?").trim().charAt(0).toUpperCase()}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                      <span style={{fontSize:17,fontWeight:800,color:textMain,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%"}}>{a.nombre}</span>
                      {(() => {
                        var cfg = !rutinasLoaded
                          ? { bg: darkMode ? "#1e293b" : "#f1f5f9", color: darkMode ? "#94a3b8" : "#64748b", t: "..." }
                          : rutinaAsignada
                          ? { bg: darkMode ? "#14532d" : "#dcfce7", color: darkMode ? "#4ade80" : "#15803d", t: rutinaAsignada.nombre || msg("Con rutina", "Has routine") }
                          : { bg: darkMode ? "#1e293b" : "#f1f5f9", color: darkMode ? "#94a3b8" : "#475569", t: msg("Sin rutina", "No routine") };
                        return <span style={{fontSize:11,fontWeight:800,padding:"2px 8px",borderRadius:6,background:cfg.bg,color:cfg.color}}>{cfg.t}</span>;
                      })()}
                    </div>
                    <div style={{fontSize:13,color:textMuted,lineHeight:1.4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{a.email}</div>
                    {(() => {
                      var rA = rutinaAsignada;
                      var nD = rA ? (rA.datos?.days || []).length : 0;
                      var done = rA ? completedDays.filter(function (k) { return k.startsWith(rA.id + "-") && k.endsWith("-w" + currentWeek); }).length : 0;
                      if (!nD) return null;
                      var pct = Math.min(100, Math.round((done / nD) * 100));
                      return (
                        <div style={{marginTop:10}}>
                          <div style={{fontSize:12,fontWeight:700,color:textMuted,marginBottom:4}}>{done}/{nD} {msg("días esta semana", "days this week")}</div>
                          <div style={{height:6,background:coachAluTrack,borderRadius:4,overflow:"hidden"}}>
                            <div style={{width: pct + "%", height: "100%", background: "#22c55e", borderRadius: 4, transition: "width .2s ease"}}/>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0,marginLeft:"auto"}}>
                    <button
                      className="hov"
                      style={{background:"#3b82f6",color:"#fff",border:"none",borderRadius:10,padding:"8px 18px",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}
                      onClick={async function () {
                        setCoachCardMenuId(null);
                        if (alumnoActivo?.id === a.id) { setAlumnoActivo(null); return; }
                        setAlumnoActivo(a); setRegistrosSubTab(0); setLoadingSB(true);
                        const ruts = await sb.getRutinas(a.id); setRutinasSB(ruts || []);
                        setRutinasSBEntrenador(function (prev) {
                          var fresh = Array.isArray(ruts) ? ruts : [];
                          return mergeRutinasAsignadas(
                            fresh,
                            (prev || []).filter(function (r) {
                              var alumnoRutinaId = getRutinaAlumnoId(r);
                              return alumnoRutinaId == null || String(alumnoRutinaId) !== String(a.id);
                            })
                          );
                        });
                        const prog = await sb.getProgreso(a.id); setAlumnoProgreso(prog || []);
                        const ses = await sb.getSesiones(a.id); setAlumnoSesiones(ses || []);
                        setLoadingSB(false);
                      }}
                    >{alumnoActivo?.id === a.id ? (msg("CERRAR", "CLOSE", "FECHAR")) : msg("VER", "VIEW", "VER")}</button>
                    <div style={{position:"relative"}}>
                      <button
                        type="button"
                        className="hov"
                        aria-label={msg("Más opciones", "More options")}
                        style={{width:40,height:40,display:"flex",alignItems:"center",justifyContent:"center",background:coachAluSubtle,color:textMuted,border:"1px solid "+coachAluBorderSoft,borderRadius:10,cursor:"pointer"}}
                        onClick={function (e) { e.stopPropagation(); setCoachCardMenuId(coachCardMenuId === a.id ? null : a.id); }}
                      >
                        <Ic name="more-vertical" size={18} color="currentColor"/>
                      </button>
                      {coachCardMenuId === a.id && (
                        <div
                          style={{position:"absolute",right:0,top:"100%",marginTop:6,background:coachAluDropdown,border:"1px solid "+coachAluBorderSoft,borderRadius:12,padding:6,zIndex:30,minWidth:176,boxShadow:coachAluDropdownShadow}}
                          onClick={function (e) { e.stopPropagation(); }}
                        >
                          <button
                            type="button"
                            className="hov"
                            style={{width:"100%",textAlign:"left",display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:"transparent",border:"none",borderRadius:8,color:textMain,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}
                            onClick={function () {
                              setCoachCardMenuId(null);
                              setCoachDialog({ t: 'editAlum', a: a });
                            }}
                          >
                            <Ic name="edit-2" size={16} color={textMuted}/> {msg("Editar", "Edit")}
                          </button>
                          <button
                            type="button"
                            className="hov"
                            style={{width:"100%",textAlign:"left",display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:"transparent",border:"none",borderRadius:8,color:textMain,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}
                            onClick={function () { setCoachCardMenuId(null); setChatModal({ alumnoId: a.id, alumnoNombre: a.nombre || a.email || "Alumno" }); }}
                          >
                            <Ic name="message-circle" size={16} color="#2563eb"/> {msg("Mensaje", "Message")}
                          </button>
                          <button
                            type="button"
                            className="hov"
                            style={{width:"100%",textAlign:"left",display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:"transparent",border:"none",borderRadius:8,color:"#f59e0b",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}
                            onClick={function () {
                              setCoachCardMenuId(null);
                              setCoachDialog({ t: 'clearProgress', a: a });
                            }}
                          >
                            <Ic name="refresh-cw" size={16} color="#f59e0b"/> {msg("Limpiar historial de progreso", "Clear progress history")}
                          </button>
                          <button
                            type="button"
                            className="hov"
                            style={{width:"100%",textAlign:"left",display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:"transparent",border:"none",borderRadius:8,color:"#f87171",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}
                            onClick={function () {
                              setCoachCardMenuId(null);
                              setCoachDialog({ t: 'deleteAlumno', a: a });
                            }}
                          >
                            <Ic name="trash-2" size={16} color="#f87171"/> {msg("Eliminar", "Delete")}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {alumnoActivo?.id===a.id&&(
                  <div>
                    {(()=>{
                      const rutinaActiva = getRutinaAsignadaAlumno(a.id);
                      if(!rutinaActiva) return <div style={{background:coachAluSurface,borderRadius:12,padding:"16px",marginBottom:8,textAlign:"center",border:"1px solid "+coachAluBorderSoft}}><div style={{fontSize:13,color:textMuted}}>{msg("Sin rutina asignada", "No routine assigned")}</div></div>;
                      const dias=rutinaActiva.datos?.days||[];
                      const semanaCiclo = currentWeek + 1;
                      const rId = rutinaActiva.id;
                      const diasCompletados = completedDays.filter(function(k){return k.startsWith(rId+"-") && k.endsWith("-w"+currentWeek)}).length;
                      const hoyDate = new Date();
                      const inicioSemana = new Date(hoyDate);
                      inicioSemana.setDate(hoyDate.getDate() - ((hoyDate.getDay()+6)%7));
                      const finSemana = new Date(inicioSemana);
                      finSemana.setDate(inicioSemana.getDate() + 6);
                      const semCalLabel = inicioSemana.getDate() + "/" + (inicioSemana.getMonth()+1) + " — " + finSemana.getDate() + "/" + (finSemana.getMonth()+1);
                      const pctBar = dias.length ? Math.min(100, Math.round((diasCompletados / dias.length) * 100)) : 0;
                      const diSel = dias.length ? Math.min(coachRoutineDiaIdx, Math.max(0, dias.length - 1)) : 0;
                      const dSel = dias[diSel] || { warmup: [], exercises: [], label: "" };
                      const proxTxt = (function(){
                        var proxDia, proxSemana;
                        if(diasCompletados >= dias.length) { proxDia = 1; proxSemana = semanaCiclo < 4 ? semanaCiclo + 1 : 1; }
                        else { proxDia = diasCompletados + 1; proxSemana = semanaCiclo; }
                        var proxLabel = dias[proxDia-1] ? (dias[proxDia-1].label || ("Día " + proxDia)) : ("Día " + proxDia);
                        return proxLabel + " · " + (msg("Semana ", "Week ")) + proxSemana + (semanaCiclo >= 4 && diasCompletados >= dias.length ? (msg(" (nuevo ciclo)", " (new cycle)")) : "");
                      })();
                      return(
                        <div style={{marginBottom:8}}>
                          <div style={{background:coachAluSurface,border:"1px solid "+coachAluBorderSoft,borderRadius:12,padding:"16px",position:"relative",boxShadow:darkMode ? "none" : "0 1px 3px rgba(15,23,42,0.06)"}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:14}}>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:24,fontWeight:900,color:textMain,lineHeight:1.15}}>{rutinaActiva.nombre}</div>
                                <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:10,alignItems:"center"}}>
                                  <span style={{fontSize:14,color:textMuted,fontWeight:600}}>{dias.length} {msg("días", "days")}</span>
                                  <span style={{padding:"4px 10px",borderRadius:8,background:darkMode?"rgba(59,130,246,0.15)":"rgba(37,99,235,0.1)",border:"1px solid "+(darkMode?"rgba(59,130,246,0.35)":"rgba(37,99,235,0.35)"),color:"#2563eb",fontSize:12,fontWeight:800}}>{msg("Semana", "Week")} {semanaCiclo} {msg("de", "of")} 4</span>
                                  <span style={{fontSize:13,color:textMuted,fontWeight:600}}>{semCalLabel}</span>
                                </div>
                              </div>
                              <div style={{position:"relative",flexShrink:0}}>
                                <button type="button" className="hov" aria-label={msg("Opciones de rutina", "Routine options")} style={{width:40,height:40,display:"flex",alignItems:"center",justifyContent:"center",background:coachAluSubtle,border:"1px solid "+coachAluBorderSoft,borderRadius:10,cursor:"pointer"}} onClick={function(){setCoachRutinaMenuOpen(function(o){return !o;});}}>
                                  <Ic name="more-vertical" size={18} color={textMuted}/>
                                </button>
                                {coachRutinaMenuOpen && (
                                  <div style={{position:"absolute",right:0,top:"100%",marginTop:6,background:coachAluDropdown,border:"1px solid "+coachAluBorderSoft,borderRadius:12,padding:6,zIndex:40,minWidth:200,boxShadow:coachAluDropdownShadow}} onClick={function(e){e.stopPropagation();}}>
                                    <button type="button" className="hov" style={{width:"100%",textAlign:"left",display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:"transparent",border:"none",borderRadius:8,color:"#fbbf24",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}} onClick={function(){
                                      setCoachDialog({ t: 'resetWeek', semanaCiclo: semanaCiclo });
                                    }}>
                                      <Ic name="refresh-cw" size={15} color="#fbbf24"/> {msg("Reiniciar semana", "Reset week")}
                                    </button>
                                    <button type="button" className="hov" style={{width:"100%",textAlign:"left",display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:"transparent",border:"none",borderRadius:8,color:"#f87171",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}} onClick={function(){
                                      setCoachDialog({ t: 'resetRoutine' });
                                    }}>
                                      <Ic name="refresh-cw" size={15} color="#f87171"/> {msg("Reiniciar rutina", "Reset routine")}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div style={{marginBottom:12}}>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
                                <span style={{fontSize:14,fontWeight:700,color:textMain}}>{diasCompletados} {msg("de", "of")} {dias.length} {msg("días completados", "days completed")}</span>
                                <span style={{fontSize:15,fontWeight:800,color:"#22c55e"}}>{pctBar}%</span>
                              </div>
                              <div style={{height:12,background:coachAluTrack,borderRadius:8,overflow:"hidden"}}>
                                <div style={{width:pctBar+"%",height:"100%",background:"linear-gradient(90deg,#22c55e,#16a34a)",borderRadius:8,transition:"width .25s ease"}}/>
                              </div>
                            </div>
                            <div style={{marginBottom:14,padding:"10px 12px",background:darkMode?"rgba(59,130,246,0.06)":"rgba(37,99,235,0.06)",border:"1px solid "+(darkMode?"rgba(59,130,246,0.2)":"rgba(37,99,235,0.2)"),borderRadius:10}}>
                              <span style={{fontSize:13,color:textMuted,fontWeight:600}}>{msg("Próxima sesión:", "Next session:")} </span>
                              <span style={{fontSize:13,color:textMain,fontWeight:700}}>{proxTxt}</span>
                            </div>
                            {dias.length > 0 && (
                              <div style={{display:"flex",gap:8,overflowX:"auto",marginBottom:14,paddingBottom:4,WebkitOverflowScrolling:"touch"}}>
                                {dias.map(function(d, di){
                                  var dayDone = completedDays.includes(rId+"-"+di+"-w"+currentWeek);
                                  var active = di === diSel;
                                  return (
                                    <button
                                      key={(rutinaActiva?.id||"rut")+"-tab-"+di}
                                      type="button"
                                      className="hov"
                                      onClick={function(){ setCoachRoutineDiaIdx(di); }}
                                      style={{
                                        flexShrink:0,
                                        padding:"10px 14px",
                                        borderRadius:10,
                                        border:active?"2px solid #2563eb":"1px solid "+coachAluBorderSoft,
                                        background:active?(darkMode?"rgba(59,130,246,0.18)":"rgba(37,99,235,0.12)"):coachAluSubtle,
                                        color:active?textMain:textMuted,
                                        fontSize:13,
                                        fontWeight:800,
                                        cursor:"pointer",
                                        fontFamily:"inherit",
                                        display:"flex",
                                        alignItems:"center",
                                        gap:6,
                                      }}
                                    >
                                      {msg("Día ", "Day ")}{di+1}
                                      {dayDone ? <Ic name="check-sm" size={14} color="#22c55e"/> : null}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                            {dias.length > 0 && (
                              <div style={{background:coachAluSubtle,borderRadius:12,border:"1px solid "+coachAluBorderSoft,padding:"12px"}}>
                                <div style={{fontSize:12,fontWeight:800,color:textMuted,marginBottom:10}}>{dSel.label || ((msg("Día ", "Day "))+(diSel+1))} · {((dSel.warmup||[]).length+(dSel.exercises||[]).length)} {msg("ej.", "ex.")}</div>
                                <div style={{marginBottom:12}}>
                                    <button type="button" className="hov" onClick={function(){ setCoachDiaSecsOpen(function(o){ return {...o, warmup:!o.warmup}; }); }} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",background:"transparent",border:"none",padding:"6px 0",cursor:"pointer",marginBottom:8}}>
                                      <span style={{fontSize:12,fontWeight:800,color:"#f59e0b",letterSpacing:0.5}}>{msg("ENTRADA EN CALOR", "WARM-UP")}</span>
                                      <Ic name="chevron-right" size={16} color="#f59e0b" style={{transform:coachDiaSecsOpen.warmup?"rotate(90deg)":"none",transition:"transform .2s"}}/>
                                    </button>
                                    {coachDiaSecsOpen.warmup && (
                                      <div>
                                        {(dSel.warmup||[]).map((ex,ei)=>{
                                          const exInfo=allEx.find(e=>e.id===ex.id);
                                          const nombre=resolveExerciseTitle(exInfo||null,ex,es);
                                          return <div key={(rutinaActiva?.id||"rut")+"-d"+diSel+"-wu-"+(ex.id||"ex")+"-"+ei} style={{display:"flex",gap:8,padding:"8px 0",alignItems:"center",borderBottom:ei<(dSel.warmup||[]).length-1?"1px solid "+coachAluBorderSoft:"none"}}>
                                            <div style={{flex:1,fontSize:14,fontWeight:600,color:textMain}}>{nombre}</div>
                                            <div style={{fontSize:12,color:textMuted,marginRight:4}}>{ex.sets}×{ex.reps}{ex.kg?" · "+ex.kg+"kg":""}</div>
                                            <button className="hov" onClick={()=>setEditEx({rId:rutinaActiva.id,dIdx:diSel,eIdx:ei,bloque:"warmup",ex:{...ex}})} style={{background:"transparent",border:"1px solid rgba(59,130,246,0.3)",borderRadius:8,padding:"6px 10px",cursor:"pointer",display:"flex",alignItems:"center"}}><Ic name="edit-2" size={14} color="#94a3b8"/></button>
                                          </div>;
                                        })}
                                        <button className="hov" onClick={()=>{setAddExModal({rId:rutinaActiva.id,dIdx:diSel,bloque:"warmup"});setAddExSearch("");setAddExPat(null);setAddExMuscle(null);setAddExSelectedIds([]);}} style={{width:"100%",marginTop:6,padding:"8px",background:"transparent",border:"1px dashed rgba(245,158,11,0.45)",borderRadius:8,fontSize:12,fontWeight:700,color:"#f59e0b",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Ic name="plus" size={14} color="#f59e0b"/>{msg("+ Añadir ejercicio", "+ Add exercise")}</button>
                                      </div>
                                    )}
                                </div>
                                <button type="button" className="hov" onClick={function(){ setCoachDiaSecsOpen(function(o){ return {...o, main:!o.main}; }); }} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",background:"transparent",border:"none",padding:"6px 0",cursor:"pointer",marginBottom:8}}>
                                  <span style={{fontSize:12,fontWeight:800,color:"#f59e0b",letterSpacing:0.5}}>{msg("BLOQUE PRINCIPAL", "MAIN BLOCK")}</span>
                                  <Ic name="chevron-right" size={16} color="#f59e0b" style={{transform:coachDiaSecsOpen.main?"rotate(90deg)":"none",transition:"transform .2s"}}/>
                                </button>
                                {coachDiaSecsOpen.main && (
                                  <div>
                                    {(dSel.exercises||[]).map((ex,ei)=>{
                                      const exInfo=allEx.find(e=>e.id===ex.id);
                                      const nombre=resolveExerciseTitle(exInfo||null,ex,es);
                                      return <div key={(rutinaActiva?.id||"rut")+"-d"+diSel+"-ex-"+(ex.id||"ex")+"-"+ei} style={{display:"flex",gap:8,padding:"8px 0",alignItems:"center",borderBottom:ei<(dSel.exercises||[]).length-1?"1px solid "+coachAluBorderSoft:"none"}}>
                                        <div style={{flex:1,fontSize:15,fontWeight:700,color:textMain}}>{nombre}</div>
                                        <div style={{fontSize:12,color:textMuted,marginRight:4}}>{ex.sets}×{ex.reps}{ex.kg?" · "+ex.kg+"kg":""}</div>
                                        <button className="hov" onClick={()=>setEditEx({rId:rutinaActiva.id,dIdx:diSel,eIdx:ei,bloque:"exercises",ex:{...ex}})} style={{background:"transparent",border:"1px solid rgba(59,130,246,0.3)",borderRadius:8,padding:"6px 10px",cursor:"pointer",display:"flex",alignItems:"center"}}><Ic name="edit-2" size={14} color="#94a3b8"/></button>
                                      </div>;
                                    })}
                                    <button className="hov" onClick={()=>{setAddExModal({rId:rutinaActiva.id,dIdx:diSel,bloque:"exercises"});setAddExSearch("");setAddExPat(null);setAddExMuscle(null);setAddExSelectedIds([]);}} style={{width:"100%",marginTop:8,padding:"8px",background:"transparent",border:"1px dashed rgba(59,130,246,0.4)",borderRadius:8,fontSize:13,fontWeight:700,color:"#3b82f6",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Ic name="plus" size={15} color="#3b82f6"/>{msg("+ Añadir ejercicio", "+ Add exercise")}</button>
                                  </div>
                                )}
                              </div>
                            )}
                            <div style={{display:"flex",gap:8,marginTop:14}}>
                              <button className="hov" style={{flex:2,padding:"10px",background:coachAluSubtle,border:"1px solid "+coachAluBorderSoft,borderRadius:12,fontSize:14,fontWeight:800,color:textMain,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}} onClick={function () {
                                var rut = {id:rutinaActiva.id,...(rutinaActiva.datos||{}),name:rutinaActiva.nombre,saved:true,alumno_id:a.id,alumno:a.nombre};
                                setCoachDialog({ t: 'goRoutines', rutinaActiva: rutinaActiva, a: a, rutina: rut });
                              }}><Ic name="edit-2" size={16} color={textMuted}/>{msg("Editar rutina", "Edit routine")}</button>
                              <button className="hov" style={{padding:"10px 16px",background:coachAluSubtle,border:"1px solid "+coachAluBorderSoft,borderRadius:12,fontSize:14,fontWeight:800,color:textMuted,cursor:"pointer",fontFamily:"inherit"}} onClick={function () {
                                setCoachDialog({ t: 'quitarRut', rutinaActiva: rutinaActiva, a: a });
                              }}><Ic name="trash-2" size={15}/></button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    <button className="hov" style={{background:coachAluGhostBtn,color:textMuted,border:"1px solid "+coachAluBorderSoft,borderRadius:12,padding:"8px",width:"100%",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center",gap:8}} onClick={function () {
                      const rutinaLocal = routineForAssign;
                      if (!rutinaLocal) {
                        toast2(msg('Creá una rutina en RUTINAS', 'Create a routine in ROUTINES', 'Crie uma rotina em ROTINAS'));
                        return;
                      }
                      const ex0 = getRutinaAsignadaAlumno(a.id);
                      const rutinaParaAsignar = rutinaLocal.datos
                        ? rutinaLocal
                        : {
                            nombre: rutinaLocal.nombre || rutinaLocal.name || 'Rutina',
                            datos: {
                              days: rutinaLocal.days || [],
                              note: rutinaLocal.note || '',
                            },
                          };
                      const rutinaNombre = rutinaParaAsignar.nombre || 'Rutina';
                      var assignMsg0 = ex0
                        ? es
                          ? 'Ya tiene: ' + ex0.nombre + '\n¿Reemplazar por: ' + rutinaNombre + '?'
                          : 'Has: ' + ex0.nombre + '\nReplace with: ' + rutinaNombre + '?'
                        : es
                          ? '¿Asignar rutina: ' + rutinaNombre + ' a ' + a.nombre + '?'
                          : 'Assign routine: ' + rutinaNombre + ' to ' + a.nombre + '?';
                      setCoachDialog({ t: 'assignRut', a: a, ex: ex0 || null, rutinaLocal: rutinaParaAsignar, assignMsg: assignMsg0 });
                    }}>{getRutinaAsignadaAlumno(a.id)?(<><Ic name="refresh-cw" size={16}/>{msg("Cambiar rutina", "Change routine")}</>):(<><Ic name="plus" size={16}/>{msg("Asignar rutina", "Assign routine")}</>)}</button>
                    {/* ── SUGERENCIAS ── */}
                    {(()=>{
                      const rutSB = getRutinaAsignadaAlumno(a.id);
                      const regsAlu = alumnoProgreso || [];
                      if(!rutSB || regsAlu.length < 2) return null;
                      const sugs = generarSugerenciasAlumno(regsAlu, rutSB.datos, EX);
                      if(sugs.length === 0) return null;
                      var open = !!sugsOpen[a.id];
                      const colores = {
                        subir: {icon:(<Ic name="trending-up" size={16} color="#22C55E"/>),bg:"#22C55E12",border:"#22C55E33",color:"#22C55E",btnBg:"#22C55E"},
                        bajar: {icon:(<Ic name="trending-up" size={16} color="#EF4444" style={{transform:"rotate(180deg)"}}/>),bg:"#EF444412",border:"#EF444433",color:"#EF4444",btnBg:"#EF4444"},
                        ajustar: {icon:(<Ic name="zap" size={16} color="#F59E0B"/>),bg:"#F59E0B12",border:"#F59E0B33",color:"#F59E0B",btnBg:"#F59E0B"},
                        cambiar: {icon:(<Ic name="refresh-cw" size={16} color="#2563EB"/>),bg:"#2563EB12",border:"#2563EB33",color:"#2563EB",btnBg:"#2563EB"},
                        mantener: {icon:(<Ic name="chevron-right" size={16} color={textMuted}/>),bg:bgSub,border:border,color:textMuted,btnBg:"#2563EB"}
                      };
                      return (
                        <div style={{marginTop:12,marginBottom:8}}>
                          <button
                            type="button"
                            className="hov"
                            onClick={function(){ setSugsOpen(function(prev){ return {...prev, [a.id]: !prev[a.id]}; }); }}
                            style={{
                              width:"100%",
                              background:bgSub,
                              border:"1px solid "+border,
                              borderRadius:12,
                              padding:"10px 12px",
                              cursor:"pointer",
                              display:"flex",
                              alignItems:"center",
                              justifyContent:"space-between",
                              gap:10
                            }}
                          >
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <Ic name="info" size={16} color="#F59E0B"/>
                              <div style={{fontSize:11,fontWeight:800,color:"#F59E0B",letterSpacing:2,textTransform:"uppercase"}}>{msg("SUGERENCIAS", "SUGGESTIONS")}</div>
                              <span style={{fontSize:12,fontWeight:800,color:textMuted,background:"#F59E0B12",border:"1px solid #F59E0B33",borderRadius:999,padding:"2px 8px"}}>{sugs.length}</span>
                            </div>
                            <Ic
                              name="chevron-right"
                              size={18}
                              color={textMuted}
                              style={{transition:"transform .18s ease", transform: open ? "rotate(90deg)" : "rotate(0deg)"}}
                            />
                          </button>
                          {open && (
                            <div style={{marginTop:10,maxHeight:260,overflowY:"auto",paddingRight:4}}>
                              {sugs.map(function(sug,si){
                                var c = colores[sug.tipo] || colores.mantener;
                                var sugKey = a.id+"-sug-"+(sug.exId||"ex")+"-"+sug.dIdx+"-"+sug.eIdx+"-"+sug.tipo;
                                return (
                                  <div key={sugKey} id={sugKey} style={{background:c.bg,border:"1px solid "+c.border,borderRadius:12,padding:"12px",marginBottom:8}}>
                                    <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
                                      <div style={{flexShrink:0,marginTop:1}}>{c.icon}</div>
                                      <div style={{flex:1,minWidth:0}}>
                                        <div style={{fontSize:13,fontWeight:800,color:c.color,marginBottom:2}}>{sug.nombre}</div>
                                        <div style={{fontSize:14,fontWeight:700,color:textMain}}>{sug.accion}</div>
                                        <div style={{fontSize:12,color:textMuted,marginTop:2,display:"flex",alignItems:"center",gap:4}}>
                                          <Ic name="chevron-right" size={12} color={textMuted}/>
                                          {sug.ajuste}
                                        </div>
                                        <div style={{display:"flex",gap:8,marginTop:8}}>
                                          <button className="hov" onClick={function(){
                                            var exConSug = {...sug.exData};
                                            if(sug.sugKg) exConSug.kg = sug.sugKg;
                                            if(sug.sugReps) exConSug.reps = sug.sugReps;
                                            if(sug.sugSets) exConSug.sets = sug.sugSets;
                                            if(sug.sugPause) exConSug.pause = sug.sugPause;
                                            setEditEx({rId:rutSB.id,dIdx:sug.dIdx,eIdx:sug.eIdx,bloque:sug.bloque,ex:exConSug});
                                          }} style={{padding:"5px 14px",background:c.btnBg,color:"#fff",border:"none",borderRadius:8,fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{msg("APLICAR", "APPLY")}</button>
                                          <button className="hov" onClick={function(){
                                            var el=document.getElementById(sugKey);
                                            if(el){el.style.opacity="0";el.style.height="0";el.style.padding="0";el.style.margin="0";el.style.overflow="hidden";el.style.transition="all .3s ease";}
                                          }} style={{padding:"5px 14px",background:"transparent",color:textMuted,border:"1px solid "+border,borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{msg("IGNORAR", "IGNORE")}</button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    <div style={{marginTop:12,borderTop:"1px solid "+border,paddingTop:12}}>
                      <div style={{fontSize:11,fontWeight:600,color:textMuted,letterSpacing:1,
                        textTransform:"uppercase",marginBottom:8}}>
                        <Ic name="bookmark" size={14} color={textMuted}/> {msg("Nota del día", "Daily note")}
                      </div>
                      <textarea
                        style={{width:"100%",background:bgSub,color:textMain,border:"1px solid "+border,
                          borderRadius:12,padding:"8px 12px",fontSize:15,fontFamily:"Inter,sans-serif",
                          resize:"none",lineHeight:1.5,outline:"none",minHeight:80}}
                        placeholder={msg("Escribí una nota, recordatorio o indicación para el alumno...", "Write a note, reminder or instruction for this athlete...")}
                        value={notaDiaInput}
                        onChange={e=>setNotaDiaInput(e.target.value)}
                      />
                      <button className="hov" style={{width:"100%",marginTop:8,padding:"8px",
                        background:"#2563EB",color:"#fff",border:"none",borderRadius:12,
                        fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}
                        onClick={async()=>{
                          if(!notaDiaInput.trim()) return;
                          try{
                            await sb.setNota({
                              alumno_id:a.id,
                              entrenador_id:ENTRENADOR_ID,
                              contenido:notaDiaInput.trim(),
                              texto:notaDiaInput.trim(),
                              fecha:new Date().toLocaleDateString("es-AR")
                            });
                            toast2(msg("Nota enviada ✓", "Note sent ✓"));
                            setNotaDiaInput("");
                          }catch(e){toast2("Error al enviar nota");}
                        }}>
                        {msg("Enviar nota", "Send note")}
                      </button>
                    </div>

                  </div>
                )}
              </div>
            )})}
          </div>
        )}
      {esAlumno&&(sessionData?.alumnoId||(sharedParam?(()=>{try{return JSON.parse(atob(sharedParam)).alumnoId}catch(e){return null}})():null))&&(
        <ChatFlotante darkMode={darkMode} es={es} alumnoId={sessionData?.alumnoId||(sharedParam?(()=>{try{return JSON.parse(atob(sharedParam)).alumnoId}catch(e){return null}})():null)} alumnoNombre={sessionData?.name||"Alumno"} sb={sb} esEntrenador={false}/>
      )}
{showWelcome&&(()=>{
        const isCoach = sessionData?.role==="entrenador";
        if(!isCoach){
          return(
            <WelcomeModal
              open={true}
              onOpenChange={(v)=>{if(!v)setShowWelcome(false);}}
              userName={sessionData?.name}
              es={es}
              bgCard={bgCard}
              border={border}
              textMain={textMain}
              textMuted={textMuted}
            />
          );
        }
        const obStep = onboardStep||0;
        const setObStep = setOnboardStep;
        const steps = [
          {
            icon:"👋",title:msg("¡Bienvenido/a!", "Welcome!"),
            subtitle:msg("Configurá tu cuenta en 3 pasos", "Set up your account in 3 steps"),
            body:null,
            items:[
              {n:1,text:msg("Creá tu primera rutina", "Create your first routine"),done:routines.length>0},
              {n:2,text:msg("Agregá un alumno", "Add an athlete"),done:alumnos.length>0},
              {n:3,text:msg("Asignale la rutina", "Assign the routine"),done:false},
            ],
            cta:msg("EMPEZAR →", "GET STARTED →"),action:()=>setObStep(1)
          },{
            icon:"📋",title:msg("Paso 1 — Rutina", "Step 1 — Routine"),
            subtitle:msg("Creá tu primera rutina", "Create your first routine"),
            body:msg("Organizá los días, ejercicios y series. La podés editar cuando quieras.", "Organize days, exercises and sets. You can edit it anytime."),
            cta:routines.length>0?(msg("Rutina lista ✓ → Siguiente", "Routine ready ✓ → Next")):(msg("CREAR RUTINA →", "CREATE ROUTINE →")),
            action:()=>{if(routines.length===0){setShowWelcome(false);setOnboardStep(1);setTab("routines");}else setObStep(2);},
            skip:()=>setObStep(2)
          },{
            icon:"👥",title:msg("Paso 2 — Alumno", "Step 2 — Athlete"),
            subtitle:msg("Agregá tu primer alumno", "Add your first athlete"),
            body:msg("Creá su acceso con email y contraseña. Desde ALUMNOS podés ver su historial.", "Create their access. From ATHLETES you can see their history."),
            cta:alumnos.length>0?(msg("Alumno listo ✓ → Siguiente", "Athlete ready ✓ → Next")):(msg("AGREGAR ALUMNO →", "ADD ATHLETE →")),
            action:()=>{if(alumnos.length===0){setShowWelcome(false);setOnboardStep(2);setTab("alumnos");setNewAlumnoForm(true);}else setObStep(3);},
            skip:()=>setObStep(3)
          },{
            icon:"🚀",title:msg("¡Todo listo!", "All set!"),
            subtitle:msg("Ya podés usar IRON TRACK", "You're ready to use IRON TRACK"),
            body:msg("Desde el dashboard vas a ver la actividad de tus alumnos y quién necesita atención.", "From the dashboard see your athletes' activity and who needs attention."),
            cta:msg("ABRIR IRON TRACK 💪", "OPEN IRON TRACK 💪"),
            action:()=>setShowWelcome(false)
          }
        ];
        const step = steps[Math.min(obStep,steps.length-1)];
        return(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.93)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
            <div style={{background:bgCard,borderRadius:"20px 20px 0 0",padding:"28px 24px 40px",width:"100%",maxWidth:480,animation:"slideUpFade 0.35s ease"}}
              onClick={e=>e.stopPropagation()}>
              <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:24}}>
                {steps.map((_,i)=>(
                  <div key={(isCoach?"coach":"alumno")+"-welcome-dot-"+i} style={{height:4,borderRadius:2,transition:"all .35s ease",
                    width:i===obStep?32:8,
                    background:i<obStep?"#22C55E":i===obStep?"#2563EB":border}}/>
                ))}
              </div>
              <div style={{textAlign:"center",marginBottom:24}}>
                <div style={{fontSize:48,marginBottom:8}}>{step.icon}</div>
                <div style={{fontSize:11,fontWeight:800,letterSpacing:2,color:"#2563EB",marginBottom:4,textTransform:"uppercase"}}>{step.subtitle}</div>
                <div style={{fontSize:28,fontWeight:900,color:textMain,marginBottom:step.body?8:0}}>{step.title}</div>
                {step.body&&<div style={{fontSize:15,color:textMuted,lineHeight:1.6,marginTop:8}}>{step.body}</div>}
              </div>
              {step.items&&(
                <div style={{marginBottom:24}}>
                  {step.items.map((item,i)=>(
                    <div key={"welcome-item-"+(item.n ?? i)} style={{display:"flex",alignItems:"center",gap:12,marginBottom:12,opacity:item.done?0.6:1}}>
                      <div style={{width:36,height:36,borderRadius:"50%",flexShrink:0,
                        background:item.done?"#22C55E22":"#2563EB22",
                        border:"2px solid "+(item.done?"#22C55E":"#2563EB"),
                        color:item.done?"#22C55E":"#2563EB",
                        display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:item.done?18:15,fontWeight:900,
                        animation:item.done?"checkPop 0.4s ease":undefined}}>
                        {item.done?"✓":item.n}
                      </div>
                      <div style={{fontSize:18,fontWeight:700,color:item.done?textMuted:textMain}}>{item.text}</div>
                    </div>
                  ))}
                </div>
              )}
              <button className="hov" onClick={step.action}
                style={{width:"100%",padding:"16px",background:"#2563EB",color:"#fff",
                  border:"none",borderRadius:12,fontSize:18,fontWeight:900,cursor:"pointer",
                  fontFamily:"inherit",letterSpacing:1,boxShadow:"0 4px 20px rgba(37,99,235,0.35)",
                  marginBottom:step.skip?8:0}}>
                {step.cta}
              </button>
              {step.skip&&(
                <button className="hov" onClick={step.skip}
                  style={{width:"100%",padding:"12px",background:"transparent",color:textMuted,
                    border:"none",fontSize:15,cursor:"pointer",fontFamily:"inherit"}}>
                  {msg("Saltar este paso", "Skip this step")}
                </button>
              )}
            </div>
          </div>
        );
      })()}
      {profileModalOpen && sessionData && esAlumno && typeof document !== "undefined" && createPortal(
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 400,
            background: "rgba(10,22,40,.78)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            paddingBottom: "env(safe-area-inset-bottom,0px)",
          }}
          onClick={function () { setProfileModalOpen(false); }}
        >
          <div
            style={{
              background: "#0a1628",
              borderRadius: "20px 20px 0 0",
              width: "100%",
              maxWidth: 480,
              border: "1px solid rgba(59,130,246,.22)",
              animation: "slideUpFade 0.35s ease",
              maxHeight: "min(90dvh, 100svh - env(safe-area-inset-top, 0px) - 12px)",
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 -8px 40px rgba(0,0,0,.45)",
              overflow: "hidden",
            }}
            onClick={function (e) { e.stopPropagation(); }}
          >
            <div style={{ flexShrink: 0, padding: "12px 18px 0" }}>
              <div style={{ width: 40, height: 4, background: "#3b82f6", borderRadius: 2, margin: "0 auto 16px" }} />
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 14, color: "#fff", letterSpacing: 0.5 }}>{msg("Mi perfil", "My profile")}</div>
            </div>
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                WebkitOverflowScrolling: "touch",
                overscrollBehavior: "contain",
                padding: "0 18px 12px",
              }}
            >
              <input ref={profileFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={function (e) {
                var f = e.target.files && e.target.files[0];
                if (!f) return;
                var r = new FileReader();
                r.onload = function (ev) { setProfileEdit(function (p) { return { ...p, avatarDataUrl: ev.target.result }; }); };
                r.readAsDataURL(f);
              }} />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
                <div style={{ width: 96, height: 96, borderRadius: "50%", background: profileEdit.avatarDataUrl ? "transparent" : "linear-gradient(135deg,#3b82f6,#1d4ed8)", overflow: "hidden", border: "3px solid rgba(59,130,246,.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 900, color: "#fff" }}>
                  {profileEdit.avatarDataUrl
                    ? <img src={profileEdit.avatarDataUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : (sessionData.name || "A").slice(0, 2).toUpperCase()}
                </div>
                <button type="button" className="hov" style={{ marginTop: 10, background: "rgba(59,130,246,.15)", border: "1px solid rgba(59,130,246,.35)", borderRadius: 10, padding: "8px 16px", color: "#3b82f6", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                  onClick={function () { profileFileRef.current && profileFileRef.current.click(); }}>
                  {msg("Cambiar foto", "Change photo")}
                </button>
              </div>
              {[
                { k: "nombre", lbl: msg("Nombre", "First name"), ph: "" },
                { k: "apellido", lbl: msg("Apellido", "Last name"), ph: "" },
                { k: "email", lbl: "Email", ph: "email@", type: "email" },
                { k: "phone", lbl: msg("Celular", "Phone"), ph: "+54 ...", type: "tel" },
              ].map(function (row) {
                return (
                  <div key={row.k} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 6, letterSpacing: 0.5 }}>{row.lbl}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, background: bgSub, border: "1px solid " + border, borderRadius: 12, padding: "4px 4px 4px 12px" }}>
                      {row.k === "email" ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg> :
                        row.k === "phone" ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                          : <Ic name="user" size={18} color="#64748b" />}
                      <input style={{ flex: 1, background: "transparent", border: "none", color: textMain, fontSize: 15, padding: "10px 8px", outline: "none", fontFamily: "inherit" }}
                        value={row.k === "phone" ? profileEdit.phone : (row.k === "email" ? profileEdit.email : profileEdit[row.k])}
                        onChange={function (e) {
                          var v = e.target.value;
                          if (row.k === "phone") setProfileEdit(function (p) { return { ...p, phone: v }; });
                          else if (row.k === "email") setProfileEdit(function (p) { return { ...p, email: v }; });
                          else setProfileEdit(function (p) { return { ...p, [row.k]: v }; });
                        }}
                        type={row.type || "text"}
                        placeholder={row.ph}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ flexShrink: 0, padding: "12px 18px calc(14px + env(safe-area-inset-bottom, 0px))", borderTop: "1px solid rgba(59,130,246,.25)", background: "#0a1628" }}>
              <button type="button" className="hov" style={{ width: "100%", padding: "14px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 20px rgba(59,130,246,.35)" }}
                onClick={function () {
                  try {
                    var fullName = [profileEdit.nombre, profileEdit.apellido].filter(Boolean).join(" ").trim() || profileEdit.email || "Atleta";
                    var next = { ...sessionData, name: fullName, email: profileEdit.email, phone: profileEdit.phone, avatarUrl: profileEdit.avatarDataUrl || sessionData.avatarUrl };
                    localStorage.setItem("it_session", JSON.stringify(next));
                    setSessionData(next);
                    setProfileModalOpen(false);
                    toast2(msg("Perfil guardado ✓", "Profile saved ✓"));
                  } catch (err) { toast2("Error"); }
                }}>
                {msg("Guardar cambios", "Save changes")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {settingsOpen && !esAlumno && sessionData && tab !== "settings" && tab !== "perfil" && (
        <SettingsPage
          coach={sessionData}
          onClose={()=>setSettingsOpen(false)}
          toast2={toast2}
          setSessionData={setSessionData}
          syncStateWithLocalStorage={syncStateWithLocalStorage}
          lang={lang}
          setLang={setLang}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          es={es}
          alumnosCount={alumnos.length}
          rutinasActivasCount={rutinasSBEntrenador.length}
          sesionesGlobales={sesionesGlobales}
          sb={sb}
          entrenadorId={sessionData.entrenadorId || "entrenador_principal"}
        />
      )}
      {settingsOpen && esAlumno && typeof document !== "undefined" && createPortal(
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 400,
            background: "rgba(10,22,40,.75)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            paddingBottom: "env(safe-area-inset-bottom,0px)",
          }}
          onClick={function () { setSettingsOpen(false); }}
        >
          <div
            style={{
              background: "#0a1628",
              borderRadius: "16px 16px 0 0",
              width: "100%",
              maxWidth: 480,
              border: "1px solid rgba(59,130,246,.2)",
              animation: "slideUpFade 0.3s ease",
              maxHeight: "min(90dvh, 100svh - env(safe-area-inset-top, 0px) - 12px)",
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={function (e) { e.stopPropagation(); }}
          >
            <div style={{ flexShrink: 0, padding: "20px 16px 12px" }}>
              <div style={{ width: 40, height: 4, background: "#3b82f6", borderRadius: 2, margin: "0 auto 16px" }} />
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 1, color: "#fff" }}><Ic name="settings" size={18} color="#3b82f6" /> {msg("CONFIGURACIÓN", "SETTINGS")}</div>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowX: "hidden", overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", padding: "0 16px 8px" }}>
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: 1.2, marginBottom: 10 }}>{msg("APARIENCIA", "APPEARANCE")}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,.04)", border: "1px solid rgba(148,163,184,.2)", borderRadius: 14, padding: "14px 16px" }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>{msg("Modo oscuro", "Dark mode")}</span>
                  <button type="button" className="hov" onClick={function () { var v = !darkMode; setDarkMode(v); localStorage.setItem("it_dark", v ? "true" : "false"); }}
                    style={{ width: 52, height: 28, borderRadius: 14, border: "none", background: darkMode ? "#22c55e" : "#475569", position: "relative", cursor: "pointer", transition: "background .25s" }}>
                    <span style={{ position: "absolute", top: 3, left: darkMode ? 26 : 3, width: 22, height: 22, borderRadius: "50%", background: "#fff", transition: "left .25s ease", boxShadow: "0 1px 4px rgba(0,0,0,.3)" }} />
                  </button>
                </div>
              </div>
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: 1.2, marginBottom: 10 }}>{msg("IDIOMA", "LANGUAGE")}</div>
                {[{ code: "es", label: msg("Español", "Spanish") }, { code: "en", label: "English" }].map(function (opt) {
                  return (
                    <button key={opt.code} type="button" className="hov" onClick={function () { setLang(opt.code); localStorage.setItem("it_lang", opt.code); }}
                      style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", marginBottom: 8, background: lang === opt.code ? "rgba(59,130,246,.12)" : "rgba(255,255,255,.03)", border: "1px solid " + (lang === opt.code ? "rgba(59,130,246,.4)" : "rgba(148,163,184,.15)"), borderRadius: 12, cursor: "pointer", fontFamily: "inherit" }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>{opt.label}</span>
                      {lang === opt.code ? <span style={{ color: "#22c55e", fontSize: 18, fontWeight: 900 }}>✓</span> : <span style={{ width: 18 }} />}
                    </button>
                  );
                })}
              </div>
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: 1.2, marginBottom: 10 }}>{msg("AYUDA", "HELP")}</div>
                <a href="https://wa.me/541164461075" target="_blank" rel="noreferrer" style={{ display: "block", textDecoration: "none", marginBottom: 10 }}>
                  <div style={{ padding: "14px 16px", background: "rgba(59,130,246,.1)", border: "1px solid rgba(59,130,246,.25)", borderRadius: 12 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#3b82f6" }}>{msg("Soporte", "Support")}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{msg("Contactá con nosotros", "Contact us")}</div>
                  </div>
                </a>
                <a href="mailto:soporte@irontrack.app?subject=Feedback" style={{ display: "block", textDecoration: "none" }}>
                  <div style={{ padding: "14px 16px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(148,163,184,.15)", borderRadius: 12 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#e2e8f0" }}>{msg("Enviar comentarios", "Send feedback")}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{msg("Ayudanos a mejorar", "Help us improve")}</div>
                  </div>
                </a>
                <div style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: "#64748b" }}>Iron Track v1.0.0</div>
              </div>
              <RecordatoriosPanel es={es} darkMode={darkMode} toast2={toast2} msg={msg} />
              <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid rgba(239,68,68,.25)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#f87171", letterSpacing: 1.2, marginBottom: 10 }}>{msg("ZONA DE PELIGRO", "DANGER ZONE")}</div>
                <button type="button" className="hov" style={{ width: "100%", padding: "14px", background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.35)", borderRadius: 12, color: "#f87171", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                  onClick={function () { setCoachDialog({ t: 'logoutSettings' }); }}>
                  <Ic name="log-out" size={18} color="#f87171" /> {msg("Cerrar sesión", "Log out")}
                </button>
              </div>
            </div>
            <div style={{ flexShrink: 0, padding: "10px 16px calc(12px + env(safe-area-inset-bottom, 0px))", borderTop: "1px solid rgba(148,163,184,.2)", background: "#0a1628" }}>
              <button className="hov"
                style={{ width: "100%", padding: "12px", background: "rgba(148,163,184,.12)", border: "1px solid rgba(148,163,184,.2)", borderRadius: 12, color: "#cbd5e1", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                onClick={function () { setSettingsOpen(false); }}>
                {msg("CERRAR", "CLOSE")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {prCelebration&&(
        <div onClick={()=>setPrCelebration(null)} style={{
          position:"fixed",inset:0,zIndex:500,
          display:"flex",alignItems:"center",justifyContent:"center",
          background:"rgba(0,0,0,0.92)",
          animation:"fadeIn .2s ease",cursor:"pointer"
        }}>
          <div style={{
            textAlign:"center",padding:"48px 32px",
            background:"linear-gradient(135deg,#1a1a1a,#2a1f00)",
            borderRadius:28,border:"2px solid #f59e0b55",
            maxWidth:340,width:"90%",
            boxShadow:"0 0 80px #f59e0b44",
            animation:"fadeIn .3s ease"
          }}>
            <div style={{fontSize:64,marginBottom:12,filter:"drop-shadow(0 0 24px #f59e0b)",animation:"pulse 1s infinite"}}>🏆</div>
            <div style={{fontSize:15,fontWeight:900,color:"#fbbf24",letterSpacing:4,marginBottom:12,textTransform:"uppercase"}}>
              {msg("¡NUEVO PR!", "NEW PR!")}
            </div>
            <div style={{fontSize:24,fontWeight:900,color:"#FFFFFF",marginBottom:8,lineHeight:1.2}}>
              {prCelebration.ejercicio}
            </div>
            <div style={{fontSize:56,fontWeight:900,color:"#fbbf24",letterSpacing:1,lineHeight:1}}>
              {prCelebration.kg} kg
            </div>
            {prCelebration.diff>0&&(
              <div style={{marginTop:12,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <span style={{background:"#22C55E22",border:"1px solid #22C55E44",borderRadius:8,padding:"4px 12px",fontSize:15,fontWeight:800,color:"#22C55E"}}>
                  +{prCelebration.diff}kg
                </span>
                <span style={{fontSize:13,color:"#8B9AB2"}}>
                  vs {prCelebration.prevKg}kg
                </span>
              </div>
            )}
            <div style={{fontSize:12,color:"#8B9AB244",marginTop:16}}>
              {msg("Tocá para cerrar", "Tap to close")}
            </div>
          </div>
        </div>
      )}
      {resumenSesion&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.92)",zIndex:150,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 16px"}}>
          <div style={{background:bgCard,borderRadius:20,padding:"28px 20px",width:"100%",maxWidth:420,border:"1px solid "+border,textAlign:"center",animation:"fadeIn 0.25s ease"}}>
            <div style={{fontSize:48,marginBottom:4}}>💪</div>
            <div style={{fontSize:28,fontWeight:900,letterSpacing:1,marginBottom:4}}>ENTRENAMIENTO</div>
            <div style={{fontSize:28,fontWeight:900,letterSpacing:1,color:"#2563EB",marginBottom:4}}>COMPLETADO</div>
            <div style={{fontSize:13,color:textMuted,marginBottom:24}}>{resumenSesion.diaLabel} · {resumenSesion.rutinaName} · {resumenSesion.fecha}</div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
              {[
                ["⏱",msg("DURACIÓN", "DURATION"),resumenSesion.durMin+" min","#2563EB"],
                ["🏋️",msg("EJERCICIOS", "EXERCISES"),resumenSesion.ejercicios,"#2563EB"],
                ["⚖️",msg("KG LEVANTADOS", "KG LIFTED"),resumenSesion.volTotal.toLocaleString()+" kg","#60A5FA"],
                [resumenSesion.prsNuevos>0?"🏆":"✓",msg("RÉCORD PERSONAL", "PERSONAL RECORD"),resumenSesion.prsNuevos>0?(resumenSesion.prsNuevos+" PR!"):(msg("Sin PR", "No PR")),resumenSesion.prsNuevos>0?"#60A5FA":"#8B9AB2"],
              ].map(([icon,label,val,color])=>(
                <div key={label} style={{background:darkMode?"#162234":"#E2E8F0",borderRadius:12,padding:"8px 12px 10px",border:"1px solid "+border}}>
                  <div style={{fontSize:18}}>{icon}</div>
                  <div style={{fontSize:18,fontWeight:700,color,marginTop:4}}>{val}</div>
                  <div style={{fontSize:11,fontWeight:400,color:textMuted,letterSpacing:0.3,marginTop:4}}>{label}</div>
                </div>
              ))}
            </div>

            {resumenSesion.prsNuevos>0&&(
              <div style={{background:"#fbbf2412",border:"1px solid #fbbf2444",borderRadius:12,padding:"12px",marginBottom:16}}>
                <div style={{fontSize:28,marginBottom:4}}>🏆</div>
                <div style={{fontSize:18,fontWeight:800,color:"#fbbf24",marginBottom:8}}>
                  {resumenSesion.prsNuevos} nuevo{resumenSesion.prsNuevos>1?"s":""} PR!
                </div>
                {sessionPRList.length>0&&(
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {sessionPRList.map(function(pr,pi){return(
                      <div key={pi} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(0,0,0,0.2)",borderRadius:8,padding:"6px 10px"}}>
                        <span style={{fontSize:13,fontWeight:700,color:textMain}}>{pr.ejercicio}</span>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:15,fontWeight:900,color:"#fbbf24"}}>{pr.kg}kg</span>
                          <span style={{fontSize:11,fontWeight:700,color:"#22C55E"}}>+{pr.diff}kg</span>
                        </div>
                      </div>
                    )})}
                  </div>
                )}
              </div>
            )}

                        <button className="hov" style={{width:"100%",padding:"12px",background:darkMode?"#162234":"#E2E8F0",border:"none",borderRadius:12,color:textMuted,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:8}}
                onClick={()=>setResumenSesion(null)}>
                {msg("Cerrar", "Close")}
              </button>
              <div style={{marginBottom:4}}>
                <div style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:0.3,marginBottom:8,textAlign:"center"}}>{msg("COMPARTIR ENTRENAMIENTO", "SHARE WORKOUT")}</div>
                <button className="hov" style={{
                  width:"100%",padding:"16px",borderRadius:12,border:"none",cursor:"pointer",
                  fontFamily:"inherit",fontSize:15,fontWeight:900,letterSpacing:1,
                  background:"linear-gradient(135deg,#FF3B30,#FF6B35)",color:"#fff",
                  boxShadow:"0 4px 14px rgba(59,130,246,0.35)"
                }} onClick={async()=>{
                  try {
                    // Generar imagen con Canvas
                    const canvas = document.createElement("canvas");
                    canvas.width = 1080; canvas.height = 1080;
                    const ctx = canvas.getContext("2d");
                    // Fondo degradado oscuro
                    const grad = ctx.createLinearGradient(0,0,0,1080);
                    grad.addColorStop(0,"#0F1923");
                    grad.addColorStop(1,"#1E2D40");
                    ctx.fillStyle = grad;
                    ctx.fillRect(0,0,1080,1080);
                    // Línea roja superior
                    ctx.fillStyle = "#2563EB";
                    ctx.fillRect(0,0,1080,8);
                    // Logo
                    ctx.fillStyle = "#2563EB";
                    ctx.font = "900 72px 'Arial Black', Arial";
                    ctx.fillText("IRON TRACK", 80, 120);
                    // Nombre rutina
                    ctx.fillStyle = "#FFFFFF";
                    ctx.font = "800 52px Arial";
                    const rName = (resumenSesion.rutinaName||"").toUpperCase();
                    ctx.fillText(rName.slice(0,22), 80, 220);
                    // Línea separadora
                    ctx.fillStyle = "#2D4057";
                    ctx.fillRect(80, 260, 920, 2);
                    // Stats grandes
                    const stats = [
                      {val: resumenSesion.durMin+"'", label: msg("DURACIÓN", "DURATION")},
                      {val: resumenSesion.ejercicios, label: msg("EJERCICIOS", "EXERCISES")},
                      {val: resumenSesion.totalSets, label: "SETS"},
                      {val: (resumenSesion.volTotal/1000).toFixed(1)+"t", label: msg("TONELAJE", "VOLUME")},
                    ];
                    stats.forEach((s,i)=>{
                      const x = 80 + i*240;
                      ctx.fillStyle = "#2563EB";
                      ctx.font = "900 80px 'Arial Black', Arial";
                      ctx.fillText(String(s.val), x, 420);
                      ctx.fillStyle = "#8B9AB2";
                      ctx.font = "700 24px Arial";
                      ctx.fillText(s.label, x, 460);
                    });
                    // PRs
                    if(resumenSesion.prsNuevos > 0){
                      ctx.fillStyle = "#60A5FA";
                      ctx.font = "900 48px 'Arial Black', Arial";
                      ctx.fillText(""+resumenSesion.prsNuevos+" PR "+(msg("NUEVO", "NEW"))+(resumenSesion.prsNuevos>1?"S":"")+"!", 80, 560);
                    }
                    // Semana
                    ctx.fillStyle = "#8B9AB2";
                    ctx.font = "700 32px Arial";
                    ctx.fillText((msg("SEMANA", "WEEK"))+" "+resumenSesion.semana+" / 4", 80, 650);
                    // Hashtag
                    ctx.fillStyle = "#2D4057";
                    ctx.font = "700 28px Arial";
                    ctx.fillText("#IronTrack  #Fitness  #Entrenamiento", 80, 980);
                    // Línea roja inferior
                    ctx.fillStyle = "#2563EB";
                    ctx.fillRect(0,1072,1080,8);
                    // Convertir a blob y compartir
                    canvas.toBlob(async(blob)=>{
                      if(!blob) return;
                      const file = new File([blob],"irontrack-sesion.png",{type:"image/png"});
                      const txt = "💪 "+resumenSesion.rutinaName+" | "+resumenSesion.durMin+"min | "+resumenSesion.ejercicios+" ejercicios | "+resumenSesion.volTotal.toLocaleString()+"kg"+( resumenSesion.prsNuevos>0?" | 🏆 "+resumenSesion.prsNuevos+" PR!":"")+" #IronTrack";
                      if(navigator.canShare && navigator.canShare({files:[file]})){
                        await navigator.share({files:[file], title:"IRON TRACK", text:txt});
                      } else if(navigator.share){
                        await navigator.share({title:"IRON TRACK", text:txt});
                      } else {
                        // Fallback: descargar imagen
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href=url; a.download="irontrack-sesion.png"; a.click();
                        URL.revokeObjectURL(url);
                        toast2(msg("Imagen guardada!", "Image saved!"));
                      }
                    },"image/png");
                  } catch(e){ console.error(e); toast2(msg("Error al compartir", "Share error")); }
                }}>
                  <Ic name="upload" size={16}/> {msg("COMPARTIR / GUARDAR IMAGEN", "SHARE / SAVE IMAGE")}
                </button>
              </div>
          </div>
        </div>
      )}
      {detailEx&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:100,display:"flex",alignItems:"flex-end"}} onClick={()=>setDetailEx(null)}>
          <div style={{background:bgCard,borderRadius:"16px 16px 0 0",padding:"20px 16px",width:"100%",maxHeight:"80dvh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              <span style={{fontSize:36}}>{PATS[detailEx.pattern]?.icon}</span>
              <div>
                <div style={{fontSize:28,fontWeight:800,letterSpacing:1}}>{es?detailEx.name:detailEx.nameEn}</div>
                <div style={{display:"flex",gap:8,marginTop:4}}>
                  <span style={tag(PATS[detailEx.pattern]?.color||"#2563EB")}>{es?PATS[detailEx.pattern]?.label:PATS[detailEx.pattern]?.labelEn}</span>
                  <span style={{fontSize:13,color:textMuted}}>{detailEx.muscle} · {detailEx.equip}</span>
                </div>
              </div>
              <button className="hov" style={{...btn(),marginLeft:"auto",fontSize:22,padding:"4px 8px"}} onClick={()=>setDetailEx(null)}>x</button>
            </div>
            <div style={{marginBottom:12}}>
              {IMGS[detailEx.id]&&(
                <div style={{borderRadius:12,overflow:"hidden",background:darkMode?"#162234":"#E2E8F0",marginBottom:8,position:"relative"}}>
                  <img src={IMGS[detailEx.id]} alt={detailEx.name}
                    style={{width:"100%",maxHeight:200,objectFit:"cover",display:"block"}}
                    onError={e=>{e.target.style.display="none"}}
                  />
                </div>
              )}
              {VIDEOS[detailEx.id]&&(
                <a href={VIDEOS[detailEx.id]} target="_blank" rel="noopener noreferrer"
                  style={{display:"flex",alignItems:"center",gap:8,background:"#162234",border:"1px solid #2D4057",borderRadius:12,padding:"8px 16px",textDecoration:"none"}}>
                  <span style={{fontSize:28}}>▶️</span>
                  <div>
                    <div style={{fontSize:15,fontWeight:700,color:textMain}}>{msg("Ver video en YouTube", "Watch on YouTube")}</div>
                    <div style={{fontSize:11,color:textMuted}}>{msg("Tutorial de técnica", "Technique tutorial")}</div>
                  </div>
                </a>
              )}
            </div>
            <span style={lbl}>{msg("HISTORIAL", "HISTORY")}</span>
            {(progress[detailEx.id]?.sets||[]).length===0&&<div style={{color:textMuted,fontSize:15,margin:"8px 0 10px"}}>{msg("Sin registros", "No records")}</div>}
            {(progress[detailEx.id]?.sets||[]).slice(0,10).map((s2,i)=>(
              <div key={detailEx.id+"-hist-"+(s2.date||"")+"-"+(s2.kg??"")+"-"+(s2.reps??"")+"-"+(s2.week ?? "nw")+"-"+i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid "+(darkMode?"#2D4057":"#2D4057"),fontSize:15}}>
                <span>{s2.kg}kg x {s2.reps} reps</span>
                <span style={{color:textMuted}}>{s2.date}</span>
              </div>
            ))}
            <button className="hov" style={{...btn("#2563EB22"),color:"#2563EB",width:"100%",marginTop:12,padding:"8px"}} onClick={()=>{setLogModal({...detailEx});setDetailEx(null);}}>
              + LOG SET
            </button>
            {expandedR&&selDay!==null&&(
              <button className="hov" style={{...btn("#2563EB22"),color:"#2563EB",width:"100%",marginTop:8,padding:"8px"}} onClick={()=>{
                setRoutines(p=>p.map(r=>r.id===expandedR?{...r,days:r.days.map((d,i)=>i===selDay?{...d,exercises:[...d.exercises,{id:detailEx.id,sets:"3",reps:"8-10",kg:"",pause:90,note:"",weeks:[]}]}:d)}:r));
                toast2("Ejercicio agregado");
                setDetailEx(null);
                setTab("plan");
              }}>+ AGREGAR A RUTINA</button>
            )}
          </div>
        </div>
      )}
      {false&&logModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:110,display:"flex",alignItems:"flex-end"}} onClick={()=>setLogModal(null)}>
          <LogForm darkMode={darkMode} ex={logModal} btn={btn} inp={inp} lbl={lbl} tag={tag} fmtP={fmtP} progress={progress}
            onLog={(kg,reps,note,pause,rpe)=>{logSet(logModal.id,kg,reps,note,rpe);if(pause>0)startTimer(pause,PATS[logModal.pattern]?.color);setLogModal(null);}}
            onClose={()=>setLogModal(null)}/>
        </div>
      )}
      {editAlumnoModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:120,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={()=>setEditAlumnoModal(null)}>
          <div style={{background:bgCard,borderRadius:16,padding:20,width:"100%",maxWidth:400,border:"1px solid "+border,animation:"fadeIn 0.25s ease"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>Editar alumno</div>
            <div style={{fontSize:13,color:textMuted,marginBottom:16}}>{editAlumnoModal.nombre}</div>
            <div style={{marginBottom:8}}>
              <span style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:0.3,display:"block",marginBottom:4}}>EMAIL</span>
              <input style={{...inp,width:"100%"}} value={editAlumnoEmail} onChange={e=>setEditAlumnoEmail(e.target.value)} placeholder="nuevo@email.com"/>
            </div>
            <div style={{marginBottom:16}}>
              <span style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:0.3,display:"block",marginBottom:4}}>CONTRASEÑA NUEVA</span>
              <input style={{...inp,width:"100%"}} type="password" value={editAlumnoPass} onChange={e=>setEditAlumnoPass(e.target.value)} placeholder="Dejar vacío para no cambiar"/>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button className="hov" style={{flex:1,padding:"12px",background:darkMode?"#162234":"#E2E8F0",color:textMuted,border:"1px solid "+border,borderRadius:12,fontFamily:"Barlow Condensed,sans-serif",fontSize:15,fontWeight:700,cursor:"pointer"}} onClick={()=>setEditAlumnoModal(null)}>Cancelar</button>
              <button className="hov" style={{flex:1,padding:"12px",background:"#2563EB",color:"#fff",border:"none",borderRadius:12,fontFamily:"Barlow Condensed,sans-serif",fontSize:15,fontWeight:700,cursor:"pointer"}} onClick={async()=>{
                const updates={};
                if(editAlumnoEmail&&editAlumnoEmail!==editAlumnoModal.email) updates.email=editAlumnoEmail;
                if(editAlumnoPass) updates.password=editAlumnoPass;
                if(!Object.keys(updates).length){toast2("Sin cambios");return;}
                const res=await sbFetch("alumnos?id=eq."+editAlumnoModal.id,"PATCH",updates);
                if(res!==null){
                  setAlumnos(prev=>prev.map(a=>a.id===editAlumnoModal.id?{...a,...updates}:a));
                  toast2("Alumno actualizado ✓");
                  setEditAlumnoModal(null);
                } else {toast2("Error al guardar");}
              }}>Guardar</button>
            </div>
          </div>
        </div>
      )}
      {newR&&(
        <div
          style={{
            position:"fixed",
            inset:0,
            background:"rgba(0,0,0,.9)",
            zIndex:120,
            overflowY:"auto",
            display:"flex",
            alignItems:"safe center",
            justifyContent:"center",
            boxSizing:"border-box",
            padding:"max(12px, env(safe-area-inset-top, 0px)) 16px max(12px, env(safe-area-inset-bottom, 0px))",
          }}
          onClick={()=>setNewR(null)}
        >
          <div style={{background:bgCard,margin:0,width:"100%",maxWidth:520,borderRadius:16,padding:"20px 16px",maxHeight:"min(85dvh, calc(100dvh - 32px))",overflowY:"auto",flexShrink:0}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:22,fontWeight:800,letterSpacing:1,marginBottom:4}}>{msg("Nueva rutina", "New routine")}</div>
            <div style={{fontSize:13,color:textMuted,marginBottom:14}}>{msg("Elegí una plantilla o en blanco. Podés afinar después.", "Pick a template or start blank. Refine anytime.")}</div>
            <span style={lbl}>{msg("INICIO RÁPIDO", "QUICK START")}</span>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14,marginTop:6}}>
              <button type="button" className="hov" style={{...btn(newR.templateId==="blank"?"#2563EB":undefined),padding:"10px 14px",fontSize:14,fontWeight:700,borderRadius:12}} onClick={()=>setNewR(p=>({...p,templateId:"blank",numDays:p.numDays||3,days:emptyDays(p.numDays||3,es)}))}>
                {msg("En blanco", "Blank")}
              </button>
              {ROUTINE_TEMPLATES.map(function(T){
                var active=newR.templateId===T.id;
                return(
                  <button key={T.id} type="button" className="hov" style={{...btn(active?"#22C55E":undefined),padding:"10px 14px",fontSize:14,fontWeight:700,borderRadius:12,maxWidth:"100%",textAlign:"left"}} onClick={function(){
                    var tpl=getTemplateById(T.id);
                    if(!tpl) return;
                    setNewR(function(p){
                      return{...p,templateId:T.id,name:es?tpl.nameEs:tpl.nameEn,numDays:tpl.days.length,days:instantiateTemplate(tpl,es)};
                    });
                  }}>
                    {es?T.nameEs:T.nameEn}
                  </button>
                );
              })}
            </div>
            <div style={{marginBottom:10}}><span style={lbl}>{msg("NOMBRE", "NAME")}</span><input style={inp} value={newR.name} onChange={e=>setNewR(p=>({...p,name:e.target.value}))} placeholder={msg("Ej: PPL Juan", "E.g: John PPL")}/></div>
            {newR.templateId==="blank"&&(
              <div style={{marginBottom:10}}>
                <span style={lbl}>{msg("DÍAS", "DAYS")}</span>
                <div style={{display:"flex",gap:8}}>
                  {[1,2,3,4,5,6,7].map(n=>(
                    <button key={n} type="button" className="hov" style={{...btn(newR.numDays===n?"#2563EB":undefined),padding:"8px 0",flex:1,fontSize:18}} onClick={()=>setNewR(p=>({...p,numDays:n,days:emptyDays(n,es)}))}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {newR.templateId&&newR.templateId!=="blank"&&(
              <div style={{fontSize:13,color:textMuted,marginBottom:12,padding:"8px 10px",background:bgSub,borderRadius:10,border:"1px solid "+border}}>
                {(function(){
                  var T=getTemplateById(newR.templateId);
                  if(!T) return null;
                  var n=(newR.days||[]).length;
                  var ex=(newR.days||[]).reduce(function(a,d){return a+(d.exercises||[]).length;},0);
                  return(es?T.hintEs:T.hintEn)+" · "+n+(msg(" días · ", " days · "))+ex+(msg(" ejercicios", " exercises"));
                })()}
              </div>
            )}
            <button type="button" className="hov" style={{width:"100%",padding:"10px",marginBottom:12,background:"transparent",border:"1px dashed "+border,borderRadius:12,color:textMuted,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>setNewR(p=>({...p,showAdvanced:!p.showAdvanced}))}>
              {newR.showAdvanced?(msg("▲ Menos opciones", "▲ Fewer options")):(msg("▼ Nota, alumno, nombres de día", "▼ Note, client, day names"))}
            </button>
            {newR.showAdvanced&&(
              <div style={{marginBottom:12}}>
                <div style={{marginBottom:8}}>
                  <span style={lbl}>{msg("NOTA (opcional)", "NOTE (optional)")}</span>
                  <input style={inp} value={newR.note||""} onChange={e=>setNewR(p=>({...p,note:e.target.value}))} placeholder={msg("Ej: Lun, Mie, Vie", "E.g. Mon, Wed, Fri")}/>
                </div>
                <div style={{marginBottom:8}}>
                  <span style={lbl}>{msg("ALUMNO (opcional)", "CLIENT (optional)")}</span>
                  <input style={inp} value={newR.alumno||""} onChange={e=>setNewR(p=>({...p,alumno:e.target.value}))} placeholder={msg("Asigná también desde la tarjeta del alumno", "Or assign from client card")}/>
                </div>
                <span style={lbl}>{msg("NOMBRE DE CADA DÍA", "NAME EACH DAY")}</span>
                <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:6}}>
                  {(newR.days||[]).map(function(d,di){return(
                    <div key={"new-routine-day-"+di} style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:13,fontWeight:700,color:textMuted,width:52,flexShrink:0}}>{msg("Día", "Day")} {di+1}</span>
                      <input style={{...inp,marginBottom:0,flex:1}} value={d.label||""} onChange={function(e){
                        var val=e.target.value;
                        setNewR(function(p){return{...p,days:p.days.map(function(dd,ddi){return ddi===di?{...dd,label:val}:dd})}});
                      }} placeholder={msg("Ej: Empuje, Pierna…", "E.g. Push, Legs…")}/>
                    </div>
                  )})}
                </div>
              </div>
            )}
            <div style={{display:"flex",gap:8}}>
              <button type="button" className="hov" style={{...btn(),flex:1,padding:"10px"}} onClick={()=>setNewR(null)}>{msg("CANCELAR", "CANCEL")}</button>
              <button type="button" className="hov" style={{...btn("#2563EB"),flex:2,padding:"10px",fontSize:17,fontWeight:800}} onClick={()=>{
                if(!newR.name.trim()){toast2(msg("Pon un nombre", "Add a name"));return;}
                var payload={name:newR.name,numDays:newR.numDays,days:newR.days,note:newR.note||"",alumno:newR.alumno||"",collapsed:false};
                var newId=uid();
                setRoutines(p=>[...p,{...payload,id:newId,created:new Date().toLocaleDateString("es-AR")}]);
                setAssignRoutineId(newId);
                setNewR(null);
                toast2(msg("Rutina creada ✓", "Routine created ✓"));
              }}>{msg("CREAR", "CREATE")}</button>
            </div>
          </div>
        </div>
      )}

                  {/* ── Modal duplicar día ── */}
      {dupDayModal&&typeof document!=="undefined"&&createPortal(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16,opacity:dupDayClosing?0:1,transition:"opacity 200ms cubic-bezier(0.16, 1, 0.3, 1)",animation:dupDayClosing?"none":"it-dup-day-overlay-in 200ms cubic-bezier(0.16, 1, 0.3, 1)"}} onClick={closeDupDayModalAnimated}>
          <div style={{background:darkMode?"#0d1424":bgCard,borderRadius:18,padding:20,width:"90%",maxWidth:480,border:"1px solid "+border,boxShadow:"0 24px 80px rgba(0,0,0,.45)",transform:dupDayClosing?"scale(0.96) translateY(10px)":"scale(1) translateY(0)",opacity:dupDayClosing?0:1,transition:"opacity 200ms cubic-bezier(0.16, 1, 0.3, 1), transform 200ms cubic-bezier(0.16, 1, 0.3, 1)",animation:dupDayClosing?"none":"it-dup-day-card-in 200ms cubic-bezier(0.16, 1, 0.3, 1)"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,color:textMain,marginBottom:4}}>
              {msg("Duplicar", "Duplicate")} {dupDayModal.days[dupDayModal.dIdx]?.label||("Día "+(dupDayModal.dIdx+1))}
            </div>
            <div style={{fontSize:13,color:textMuted,marginBottom:16}}>
              {msg("Seleccioná los días destino", "Select destination days")}
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
              {dupDayModal.days.map(function(d,di){
                if(di===dupDayModal.dIdx) return (
                  <div key={"dup-day-src-"+dupDayModal.dIdx+"-mark-"+di} style={{padding:"10px 16px",borderRadius:12,background:"#2563EB22",border:"2px solid #2563EB",opacity:0.5}}>
                    <div style={{fontSize:13,fontWeight:800,color:"#2563EB"}}>{d.label||("Día "+(di+1))}</div>
                    <div style={{fontSize:10,color:textMuted}}>{msg("Origen", "Source")}</div>
                  </div>
                );
                var isSelected = dupDayModal.selected.indexOf(di)!==-1;
                var tieneEj = ((d.warmup||[]).length+(d.exercises||[]).length)>0;
                return (
                  <div key={"dup-day-pick-"+dupDayModal.dIdx+"-to-"+di} onClick={function(){
                    setDupDayModal(function(prev){
                      var sel = prev.selected.indexOf(di)!==-1
                        ? prev.selected.filter(function(x){return x!==di})
                        : [...prev.selected, di];
                      return {...prev, selected:sel};
                    });
                  }} style={{padding:"10px 16px",borderRadius:12,cursor:"pointer",transition:"all .15s",
                    background:isSelected?"#22C55E22":bgSub,
                    border:isSelected?"2px solid #22C55E":"2px solid "+border}}>
                    <div style={{fontSize:13,fontWeight:800,color:isSelected?"#22C55E":textMain}}>{d.label||("Día "+(di+1))}</div>
                    <div style={{fontSize:10,color:textMuted}}>
                      {tieneEj?((d.warmup||[]).length+(d.exercises||[]).length)+" ej.":"vacío"}
                    </div>
                    {isSelected&&<div style={{fontSize:10,fontWeight:700,color:"#22C55E",marginTop:2}}>✓ {msg("Seleccionado", "Selected")}</div>}
                  </div>
                );
              })}
            </div>
            {dupDayModal.selected.some(function(di){return ((dupDayModal.days[di]?.warmup||[]).length+(dupDayModal.days[di]?.exercises||[]).length)>0})&&(
              <div style={{background:"#F59E0B12",border:"1px solid #F59E0B33",borderRadius:8,padding:"8px 10px",marginBottom:12,fontSize:12,color:"#F59E0B"}}>
                ⚠ {msg("Algunos días seleccionados tienen ejercicios. Se reemplazarán.", "Some selected days have exercises. They will be replaced.")}
              </div>
            )}
            <div style={{display:"flex",gap:8}}>
              <button onClick={closeDupDayModalAnimated} style={{flex:1,padding:12,background:bgSub,color:textMuted,border:"none",borderRadius:8,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{msg("CANCELAR", "CANCEL")}</button>
              <button onClick={function(){
                var src=dupDayModal.sourceDay;
                var originalDays = Array.isArray(dupDayModal.days) ? dupDayModal.days : [];
                if(!src || !Array.isArray(originalDays) || !originalDays[dupDayModal.dIdx]){toast2(msg("No se pudo duplicar el día", "Could not duplicate day"));return;}
                if(!Array.isArray(src.warmup) && !Array.isArray(src.exercises)){toast2(msg("No se pudo duplicar el día", "Could not duplicate day"));return;}
                var appendNewDay = dupDayModal.selected.length===0 && originalDays.length===1;
                if(dupDayModal.selected.length===0 && !appendNewDay){toast2(msg("Seleccioná al menos un día", "Select at least one day"));return;}
                var sel=dupDayModal.selected;
                var cloneDay = function(base, label){
                  try {
                    var copy = JSON.parse(JSON.stringify(base || {}));
                    copy.id = uid();
                    copy.label = label;
                    copy.warmup = Array.isArray(copy.warmup) ? copy.warmup : [];
                    copy.exercises = Array.isArray(copy.exercises) ? copy.exercises : [];
                    return copy;
                  } catch(e) {
                    return {id:uid(),label:label,warmup:(base?.warmup||[]).map(function(x){return {...x};}),exercises:(base?.exercises||[]).map(function(x){return {...x};}),note:base?.note||""};
                  }
                };
                setRoutines(function(p){return p.map(function(rr){
                  if(rr.id!==dupDayModal.rId) return rr;
                  var rrDays = Array.isArray(rr.days) ? rr.days : [];
                  if(appendNewDay) return {...rr,days:rrDays.concat([cloneDay(src, "Día "+(rrDays.length+1))])};
                  return {...rr,days:rrDays.map(function(dd,ddi){
                    if(sel.indexOf(ddi)===-1) return dd;
                    return {...cloneDay(src, dd?.label||("Día "+(ddi+1)))};
                  })};
                })});
                toast2(appendNewDay ? msg("Día duplicado ✓", "Day duplicated ✓") : ((msg("Duplicado a ", "Duplicated to "))+sel.map(function(i){return dupDayModal.days[i]?.label||("Día "+(i+1))}).join(", ")+" ✓"));
                closeDupDayModalAnimated();
              }} style={{flex:1,padding:12,background:(dupDayModal.selected.length>0 || (Array.isArray(dupDayModal.days)&&dupDayModal.days.length===1))?"#2563EB":"#2D4057",color:"#fff",border:"none",borderRadius:8,fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>
                {msg("DUPLICAR", "DUPLICATE")} {dupDayModal.selected.length>0&&("("+dupDayModal.selected.length+")")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
            {/* ── Modal chat entrenador ── */}
      {chatModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setChatModal(null)}>
          <div style={{background:bgCard,borderRadius:"16px 16px 0 0",padding:"16px",width:"100%",maxWidth:480,border:"1px solid "+border,maxHeight:"80dvh",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexShrink:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:"#2563EB22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#2563EB"}}>
                  {(chatModal.alumnoNombre||"?").slice(0,2).toUpperCase()}
                </div>
                <div>
                  <div style={{fontSize:15,fontWeight:800,color:textMain}}>{chatModal.alumnoNombre}</div>
                  <div style={{fontSize:11,color:textMuted}}>{msg("Chat interno", "Internal chat")}</div>
                </div>
              </div>
              <button onClick={()=>setChatModal(null)} style={{background:"none",border:"none",color:textMuted,fontSize:22,cursor:"pointer",padding:"4px"}}><Ic name="x" size={18}/></button>
            </div>
            <div style={{flex:1,overflow:"hidden"}}>
              <Chat darkMode={darkMode} es={es} alumnoId={chatModal.alumnoId} alumnoNombre={chatModal.alumnoNombre} esEntrenador={true} sb={sb}/>
            </div>
          </div>
        </div>
      )}
      {editEx&&typeof document!=="undefined"&&createPortal(
        <EditExModal darkMode={darkMode} key={editEx.rId+"-"+editEx.dIdx+"-"+editEx.eIdx} editEx={editEx} btn={btn} inp={inp} allEx={allEx} es={es} PATS={PATS} msg={msg}
          onSave={async(updatedRaw)=>{
            const updated = sanitizeExerciseSnapshotForWrite(updatedRaw);
            const blq = editEx.bloque||"exercises";
            const replaceExerciseInDays = function(days){
              return (days||[]).map((d,di)=>di===editEx.dIdx?{...d,[blq]:(d[blq]||[]).map((ex,ei)=>ei===editEx.eIdx?updated:ex)}:d);
            };
            const updateRutinaRowsLocal = function(rowId, days){
              if(!rowId) return;
              const diasActualizados = sanitizeRoutineDaysForWrite(days);
              const updateRow = function(r){
                return String(r.id)===String(rowId)?{...r,datos:{...(r.datos||{}),days:diasActualizados}}:r;
              };
              setRutinasSB(prev=>(prev||[]).map(updateRow));
              setRutinasSBEntrenador(prev=>(prev||[]).map(updateRow));
            };
            // Actualizar routines locales
            setRoutines(p=>(p||[]).map(r=>r.id===editEx.rId?{...r,days:replaceExerciseInDays(r.days)}:r));
            // Auto-guardar en Supabase inmediatamente
            try {
              const rActual = routines.find(x=>x.id===editEx.rId);
              if(rActual) {
                const updatedDays = sanitizeRoutineDaysForWrite(replaceExerciseInDays(rActual.days));
                updateRutinaRowsLocal(rActual.id, updatedDays);
                const payload={nombre:rActual.name,alumno_id:rActual.alumno_id||null,datos:{days:updatedDays,alumno:rActual.alumno||"",note:rActual.note||""},entrenador_id:"entrenador_principal"};
                if(rActual.saved){ await sb.updateRutina(rActual.id,payload); }
                else { const res = await sb.createRutina(payload); if(res&&res[0]){setRoutines(p=>p.map(r=>r.id===rActual.id?{...r,id:res[0].id,saved:true}:r));} }
              } else {
                // Buscar en rutinasSB (edición desde vista alumno)
                const rSB = (rutinasSBEntrenador||[]).find(x=>String(x.id)===String(editEx.rId)) || (rutinasSB||[]).find(x=>String(x.id)===String(editEx.rId));
                if(rSB) {
                  const diasActualizados = sanitizeRoutineDaysForWrite(replaceExerciseInDays(rSB.datos?.days||[]));
                  const payloadSB = {nombre:rSB.nombre,alumno_id:rSB.alumno_id,datos:{...rSB.datos,days:diasActualizados},entrenador_id:"entrenador_principal"};
                  updateRutinaRowsLocal(rSB.id, diasActualizados);
                  await sb.updateRutina(rSB.id, payloadSB);
                }
              }
            } catch(e){ console.error("Auto-save error:",e); }
            setEditEx(null);toast2("Guardado ✓");
          }}
          onClose={()=>setEditEx(null)}
        />,
        document.body
      )}
      {loginModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.9)",zIndex:130,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 20px"}} onClick={()=>setLoginModal(false)}>
          <div style={{background:bgCard,borderRadius:16,padding:"24px 20px",width:"100%",maxWidth:360,animation:"fadeIn 0.25s ease"}} onClick={e=>e.stopPropagation()}>
            {user?(
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:48,marginBottom:8}}>👤</div>
                <div style={{fontSize:22,fontWeight:700,marginBottom:4}}>{user.name}</div>
                <div style={{fontSize:15,color:textMuted,marginBottom:16}}>{user.email}</div>
                <button className="hov" style={{...btn("#2563EB22"),color:"#2563EB",width:"100%",padding:"8px"}} onClick={()=>{localStorage.removeItem("it_u");setUser(null);setLoginModal(false);toast2("Sesion cerrada");}}>SALIR</button>
              </div>
            ):(
              <LoginForm darkMode={darkMode} es={es} btn={btn} inp={inp} lbl={lbl} msg={msg} onLogin={u=>{setUser(u);localStorage.setItem("it_u",JSON.stringify(u));setLoginModal(false);toast2("Bienvenido/a "+u.name+"!");}} onClose={()=>setLoginModal(false)}/>
            )}
          </div>
        </div>
      )}
      {aliasModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:200,display:"flex",alignItems:"flex-end"}} onClick={()=>setAliasModal(false)}>
          <div style={{background:bgCard,borderRadius:"20px 20px 0 0",padding:20,width:"100%",maxHeight:"85dvh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:22,fontWeight:800,marginBottom:4}}>💰 {msg("Datos de Pago", "Payment Info")}</div>
            <div style={{fontSize:13,color:textMuted,marginBottom:16}}>{msg("Configurá tu alias o CBU para recibir pagos", "Set up your alias or CBU to receive payments")}</div>
            {(()=>{
              const form = aliasForm;
              const setForm = setAliasForm;
              const save = () => { sb.saveConfig(form).then(()=>{
                    setAliasData(form);
                    setAliasModal(false);
                    toast2(msg("Datos de pago guardados ✓", "Payment info saved ✓"));
                  }).catch(()=>toast2("Error al guardar")); };
              return(
                <div>
                  <div style={{fontSize:13,color:textMuted,fontWeight:500,marginBottom:8}}>ALIAS</div>
                  <input style={{background:bgSub,color:textMain,border:"1px solid "+border,borderRadius:12,padding:"8px 16px",fontSize:15,width:"100%",fontFamily:"inherit",marginBottom:8}} value={form.alias} onChange={e=>setForm(p=>({...p,alias:e.target.value}))} placeholder="tu.alias.mp"/>
                  <div style={{fontSize:13,color:textMuted,fontWeight:500,marginBottom:8}}>CBU (opcional)</div>
                  <input style={{background:bgSub,color:textMain,border:"1px solid "+border,borderRadius:12,padding:"8px 16px",fontSize:15,width:"100%",fontFamily:"inherit",marginBottom:8}} value={form.cbu} onChange={e=>setForm(p=>({...p,cbu:e.target.value}))} placeholder="0000000000000000000000"/>
                  <div style={{fontSize:13,color:textMuted,fontWeight:500,marginBottom:8}}>{msg("BANCO / BILLETERA", "BANK / WALLET")}</div>
                  <input style={{background:bgSub,color:textMain,border:"1px solid "+border,borderRadius:12,padding:"8px 16px",fontSize:15,width:"100%",fontFamily:"inherit",marginBottom:8}} value={form.banco} onChange={e=>setForm(p=>({...p,banco:e.target.value}))} placeholder="Mercado Pago / Banco Nación / etc"/>
                  <div style={{fontSize:13,color:textMuted,fontWeight:500,marginBottom:8}}>{msg("MONTO MENSUAL", "MONTHLY FEE")}</div>
                  <input style={{background:bgSub,color:textMain,border:"1px solid "+border,borderRadius:12,padding:"8px 16px",fontSize:15,width:"100%",fontFamily:"inherit",marginBottom:8}} value={form.monto} onChange={e=>setForm(p=>({...p,monto:e.target.value}))} placeholder="$ 15.000"/>
                  <div style={{fontSize:13,color:textMuted,fontWeight:500,marginBottom:8}}>{msg("NOTA (opcional)", "NOTE (optional)")}</div>
                  <input style={{background:bgSub,color:textMain,border:"1px solid "+border,borderRadius:12,padding:"8px 16px",fontSize:15,width:"100%",fontFamily:"inherit",marginBottom:16}} value={form.nota} onChange={e=>setForm(p=>({...p,nota:e.target.value}))} placeholder={msg("Ej: Transferir antes del 5 de cada mes", "E.g.: Transfer before the 5th of each month")}/>
                  <div style={{display:"flex",gap:8}}>
                    <button className="hov" style={{background:darkMode?"#162234":"#E2E8F0",color:textMain,border:"none",borderRadius:12,padding:"12px",flex:1,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>setAliasModal(false)}>{msg("Cancelar", "Cancel")}</button>
                    <button className="hov" style={{background:green,color:darkMode?"#fff":"#fff",border:"none",borderRadius:12,padding:"12px",flex:2,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}} onClick={save}>{msg("Guardar", "Save")}</button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
      {addExModal&&(
        <>
        <div
          role="presentation"
          style={{
            position:"fixed",inset:0,zIndex:150,
            display:"flex",flexDirection:"column",
            height:"100dvh",maxHeight:"100dvh",minHeight:0,
            boxSizing:"border-box",
            background:"rgba(0,0,0,.92)",
            ...(coachDesktopNavHidden
              ? {
                  alignItems:"center",
                  justifyContent:"center",
                  padding:"max(12px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) max(12px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px))",
                  overflowY:"auto",
                  overflowX:"hidden",
                }
              : {
                  overflow:"hidden",
                }),
          }}
          onClick={()=>{setAddExModal(null);setAddExSelectedIds([]);}}
        >
          {!coachDesktopNavHidden ? (
          <div style={{flex:"1 1 0%",minHeight:0,minWidth:0}} aria-hidden />
          ) : null}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-ex-modal-title"
            style={{
              flex:"0 1 auto",
              width: coachDesktopNavHidden ? "min(100%, 1120px)" : "100%",
              maxWidth: coachDesktopNavHidden ? 1120 : undefined,
              minWidth: coachDesktopNavHidden ? 0 : undefined,
              maxHeight: coachDesktopNavHidden
                ? "min(90dvh, calc(100dvh - 40px))"
                : "80dvh",
              minHeight:0,
              display:"flex",flexDirection:"column",overflow:"hidden",boxSizing:"border-box",
              background:bgCard,
              borderRadius: coachDesktopNavHidden ? 16 : "16px 16px 0 0",
              flexShrink: coachDesktopNavHidden ? 0 : undefined,
            }}
            onClick={e=>e.stopPropagation()}
          >
            <div style={{flex:"none",padding: coachDesktopNavHidden ? "18px 24px 0 24px" : "16px 16px 0 16px",background:bgCard}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:12}}>
                <div style={{minWidth:0,paddingRight:8,flex:1}}>
                  <div id="add-ex-modal-title" style={{fontSize:22,fontWeight:800,letterSpacing:1}}>{msg("Agregar ejercicios", "Add exercises")}</div>
                  <div style={{fontSize:13,color:textMuted,marginTop:6,maxWidth: coachDesktopNavHidden ? "none" : 320,lineHeight:1.45,wordBreak:"break-word"}}>
                    {(addExModal.bloque||"exercises")==="warmup"
                      ? (msg("Tocá para marcar varios en entrada en calor; confirmá abajo.", "Tap to select warm-up exercises, then confirm."))
                      : (msg("Tocá para marcar varios en bloque principal; confirmá abajo.", "Tap to select main exercises, then confirm."))}
                  </div>
                </div>
                <button type="button" className="hov" style={{...btn(),padding:"6px",flexShrink:0}} onClick={()=>{setAddExModal(null);setAddExSelectedIds([]);}} aria-label={msg("Cerrar", "Close")}><Ic name="x" size={20}/></button>
              </div>
              <input style={{...inp,marginBottom:12,width:"100%",boxSizing:"border-box"}} placeholder={msg("Buscar...", "Search...")} value={addExSearch} onChange={e=>setAddExSearch(e.target.value)}/>
              <div style={{marginBottom:16}}>
                <div style={{fontSize:12,fontWeight:700,color:textMuted,letterSpacing:"0.06em",marginBottom:10,textTransform:"uppercase"}}>
                  {msg("Patrones", "Patterns")}
                </div>
                <div style={{position:"relative",overflow:"hidden"}}>
                  <div
                    className="add-ex-hscroll"
                    style={{
                      display:"flex",
                      flexDirection:"row",
                      flexWrap:"nowrap",
                      alignItems:"center",
                      gap:9,
                      overflowX:"auto",
                      overflowY:"hidden",
                      WebkitOverflowScrolling:"touch",
                      marginLeft:-6,
                      marginRight:-6,
                      paddingLeft:6,
                      paddingRight:6,
                      paddingBottom:2,
                      minHeight:46,
                    }}
                  >
                    {Object.entries(PATS).map(([k,p])=>(
                      <button key={k} type="button" className="hov" style={{flex:"0 0 auto",background:addExPat===k?"#2563EB":"transparent",color:addExPat===k?"#ffffff":"#94a3b8",border:addExPat===k?"1px solid #2563EB":"1px solid #334155",boxShadow:"none",borderRadius:10,padding:"10px 16px",fontSize:13,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",textTransform:"uppercase",letterSpacing:".5px"}} onClick={()=>setAddExPat(addExPat===k?null:k)}>
                        {es?p.label:p.labelEn}
                      </button>
                    ))}
                  </div>
                  <div aria-hidden style={{position:"absolute",right:0,top:0,bottom:0,width:32,pointerEvents:"none",zIndex:2,background:"linear-gradient(to left, "+bgCard+" 0%, "+bgCard+"cc 35%, transparent 100%)"}} />
                </div>
              </div>
              <div style={{marginBottom:14}}>
                <div style={{fontSize:11,fontWeight:600,color:"#64748b",letterSpacing:"0.06em",marginBottom:8,textTransform:"uppercase",opacity:0.92}}>
                  {msg("Músculos", "Muscles")}
                </div>
                <div style={{position:"relative",overflow:"hidden"}}>
                  <div
                    className="add-ex-hscroll"
                    style={{
                      display:"flex",
                      flexDirection:"row",
                      flexWrap:"nowrap",
                      alignItems:"center",
                      gap:9,
                      overflowX:"auto",
                      overflowY:"hidden",
                      WebkitOverflowScrolling:"touch",
                      marginLeft:-6,
                      marginRight:-6,
                      paddingLeft:6,
                      paddingRight:6,
                      paddingBottom:2,
                      minHeight:40,
                    }}
                  >
                    {["Cuádriceps","Glúteo","Isquiotibial","Pectoral","Espalda",
                      "Hombro","Core","Aductor","Abductor","Bíceps","Tríceps"]
                      .map(m=>(
                        <button key={m} type="button" className="hov" style={{
                          flex:"0 0 auto",
                          background: addExMuscle===m ? "#2563EB" : "transparent",
                          color: addExMuscle===m ? "#ffffff" : "#94a3b8",
                          border: addExMuscle===m ? "1px solid #2563EB" : "1px solid #334155",
                          boxShadow: "none",
                          borderRadius:8, padding:"8px 12px", fontSize:12, fontWeight:700,
                          cursor:"pointer", whiteSpace:"nowrap",
                          textTransform:"uppercase", letterSpacing:".5px"
                        }} onClick={()=>setAddExMuscle(addExMuscle===m?null:m)}>
                          {m}
                        </button>
                      ))
                    }
                  </div>
                  <div aria-hidden style={{position:"absolute",right:0,top:0,bottom:0,width:28,pointerEvents:"none",zIndex:2,background:"linear-gradient(to left, "+bgCard+" 0%, "+bgCard+"cc 40%, transparent 100%)"}} />
                </div>
              </div>
            </div>
            <div
              className={coachDesktopNavHidden ? "add-ex-list-scroll--desktop" : undefined}
              style={{
              flex:1,
              minHeight:0,
              minWidth:0,
              overflowY:"auto",
              overflowX:"hidden",
              WebkitOverflowScrolling:"touch",
              overscrollBehavior:"contain",
              padding: coachDesktopNavHidden
                ? "14px 32px 20px 32px"
                : "10px 20px 16px 20px",
              boxSizing:"border-box",
              touchAction:"pan-y",
            }}
            >
              {allEx.filter(e=>{
                const q=addExSearch.toLowerCase();
                if(addExPat&&e.pattern!==addExPat) return false;
                if(addExMuscle && !(formatBibMuscleDisplay(e.muscle, lang)||"").toLowerCase()
                  .includes(addExMuscle.toLowerCase())) return false;
                if(!q) return true;
                return (e.name||"").toLowerCase().includes(q)||(e.nameEn||"").toLowerCase().includes(q)||bibMuscleFilterHaystack(e.muscle).includes(q);
              }).map(ex=>{
                const pat=PATS[ex.pattern]||{icon:"E",color:textMuted,label:"Otro",labelEn:"Other"};
                const sel=addExSelectedIds.includes(ex.id);
                return(
                  <div
                    key={ex.id}
                    className={"add-ex-card add-ex-card--"+(darkMode?"dark":"light")}
                    role="button"
                    tabIndex={0}
                    style={{display:"flex",alignItems:"flex-start",gap:12,padding:"14px 14px",marginBottom:8,marginLeft:1,marginRight:1,border:"none",boxSizing:"border-box",outline:"none",boxShadow:sel?"inset 0 0 0 2px "+(pat.color||"#2563EB"):"none",WebkitTapHighlightColor:"transparent",borderRadius:12}}
                    onMouseDown={e=>e.preventDefault()}
                    onClick={()=>setAddExSelectedIds(function(prev){return prev.includes(ex.id)?prev.filter(function(x){return x!==ex.id;}):[...prev,ex.id];})}
                    onKeyDown={e=>{
                      if(e.key==="Enter"||e.key===" "){
                        e.preventDefault();
                        setAddExSelectedIds(function(prev){return prev.includes(ex.id)?prev.filter(function(x){return x!==ex.id;}):[...prev,ex.id];});
                      }
                    }}
                  >
                    <div style={{width:52,height:52,borderRadius:12,background:pat.color+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:800,color:pat.color,flexShrink:0,marginTop:2}}>{pat.icon}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:18,fontWeight:700,lineHeight:1.25,wordBreak:"break-word"}}>{es?ex.name:ex.nameEn}</div>
                      <div style={{fontSize:12,fontWeight:700,color:pat.color,textTransform:"uppercase",letterSpacing:.4,marginTop:4,lineHeight:1.3}}>{es?pat.label:pat.labelEn}</div>
                      {(formatBibMuscleDisplay(ex.muscle, lang)||ex.equip)&&<div style={{fontSize:14,color:textMuted,marginTop:2,lineHeight:1.35,wordBreak:"break-word"}}>{[formatBibMuscleDisplay(ex.muscle, lang),ex.equip].filter(Boolean).join(" · ")}</div>}
                    </div>
                    <div style={{width:28,height:28,borderRadius:"50%",border:"none",boxShadow:sel?"inset 0 0 0 2px "+pat.color:"inset 0 0 0 2px "+border,background:sel?pat.color+"33":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:4}}>
                      {sel ? <Ic name="check-sm" size={16} color={pat.color}/> : null}
                    </div>
                  </div>
                );
              })}
            </div>
            <div
              style={{
                flexShrink:0,
                display:"flex",
                gap:8,
                background:darkMode?"#111":"#FFFFFF",
                padding: coachDesktopNavHidden
                  ? "14px 20px calc(14px + env(safe-area-inset-bottom, 0px)) 20px"
                  : "12px 16px calc(12px + env(safe-area-inset-bottom, 0px)) 16px",
                borderTop:"1px solid "+border,
                boxSizing:"border-box",
                boxShadow: coachDesktopNavHidden ? "0 -8px 24px rgba(0,0,0,0.12)" : "0 -10px 15px -3px rgba(0,0,0,0.5), 0 -4px 6px -2px rgba(0,0,0,0.3)",
              }}
              onClick={e=>e.stopPropagation()}
            >
          <button type="button" className="hov" style={{...btn(),flex:1,padding:"12px",fontWeight:700,textTransform:"uppercase",letterSpacing:".5px",fontSize:13}} onClick={()=>{setAddExModal(null);setAddExSelectedIds([]);}}>{msg("CANCELAR", "CANCEL")}</button>
          <button type="button" className="hov" style={{...btn("#2563EB"),flex:2,padding:"12px",fontWeight:800,opacity:addExSelectedIds.length?1:0.5,textTransform:"uppercase",letterSpacing:".5px",fontSize:13}} disabled={!addExSelectedIds.length} onClick={async function(){
            if(!addExModal||addExSelectedIds.length===0) return;
            var blk=addExModal.bloque||"exercises";
            var rId=addExModal.rId;
            var dIdx=addExModal.dIdx;
            var r=routines.find(function(rr){return rr.id===rId;});
            var day=r&&r.days?r.days[dIdx]:null;
            var existing=new Set((day&&day[blk]?day[blk]:[]).map(function(e){return e.id;}));
            var ids=addExSelectedIds.filter(function(id){return !existing.has(id);});
            if(ids.length===0){toast2(msg("Ya están en ese bloque", "Already in that block"));return;}
            var newExs=ids.map(function(id){
              var ex=allEx.find(function(e){return e.id===id;});
              if(!ex) return null;
              var vu = pickVideoUrl(ex);
              return sanitizeExerciseSnapshotForWrite({
                id:ex.id,
                name:ex.name||"",
                nameEn:ex.nameEn||ex.name||"",
                video_url:vu,
                isCustom: Boolean(ex.isCustom) || String(ex.id||"").indexOf("custom_")===0,
                sets:"3",reps:"8-10",kg:"",pause:0,note:"",weeks:[],
              });
            }).filter(Boolean);
            setRoutines(function(p){return p.map(function(rr){
              if(rr.id!==rId) return rr;
              return {...rr,days:rr.days.map(function(d,i){
                if(i!==dIdx) return d;
                return {...d,[blk]:[...(d[blk]||[]),...newExs]};
              })};
            });});
            var rSB=rutinasSB.find(function(x){return x.id===rId;});
            if(rSB){
              try{
                var diasAct=sanitizeRoutineDaysForWrite((rSB.datos&&rSB.datos.days?rSB.datos.days:[]).map(function(d,i){
                  if(i!==dIdx) return d;
                  return {...d,[blk]:[...(d[blk]||[]),...newExs]};
                }));
                await sb.updateRutina(rSB.id,{nombre:rSB.nombre,alumno_id:rSB.alumno_id,datos:{...rSB.datos,days:diasAct},entrenador_id:"entrenador_principal"});
                setRutinasSB(function(prev){return prev.map(function(rw){return rw.id===rSB.id?{...rw,datos:{...rw.datos,days:diasAct}}:rw;});});
              }catch(e){console.error("Add batch save error:",e);}
            }
            toast2((msg("Agregados ", "Added "))+newExs.length+(msg(" ejercicios", " exercises")));
            setAddExModal(null);
            setAddExSelectedIds([]);
          }}>{msg("AÑADIR SELECCIONADOS", "ADD SELECTED")}{addExSelectedIds.length?" ("+addExSelectedIds.length+")":""}</button>
            </div>
          </div>
        </div>
        </>
      )}
      {toast&&(()=>{
        const isSuccess = toast.includes("✓")||toast.includes("💪")||toast.includes("✅")||toast.includes("listo")||toast.includes("done")||toast.includes("enviada")||toast.includes("copiado")||toast.includes("creado")||toast.includes("sent")||toast.includes("saved");
        const isError = toast.includes("Error")||toast.includes("error");
        const bg = isError?"#EF444422":isSuccess?"#22C55E22":darkMode?"#1E2D40":"#F0F4F8";
        const brd = isError?"#EF444444":isSuccess?"#22C55E44":border;
        const col = isError?"#EF4444":isSuccess?"#22C55E":textMain;
        return(
          <div style={{
            position:"fixed",bottom:88,left:"50%",transform:"translateX(-50%)",
            background:bg,border:"1px solid "+brd,color:col,
            padding:"8px 20px",borderRadius:24,fontSize:15,fontWeight:600,
            zIndex:250,whiteSpace:"nowrap",
            boxShadow:"0 8px 24px rgba(0,0,0,0.3)",
            animation:"slideUpFade 0.25s ease"
          }}>{toast}</div>
        );
      })()}

      </div>
        </div>
      </div>
      </div>
      {/* Modal video: fuera del scroll (display:none con sesión ocultaba el overlay) + portal a body */}
      {videoModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,.95)",
              zIndex: 10000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
            }}
            onClick={() => setVideoModal(null)}
            role="presentation"
          >
            <div style={{ width: "100%", maxWidth: 480, padding: "0 16px" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{videoModal.nombre || ""}</div>
                <button
                  type="button"
                  onClick={() => setVideoModal(null)}
                  style={{ background: "none", border: "none", color: "#8B9AB2", fontSize: 24, cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>
              <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: 12, overflow: "hidden", background: "#000" }}>
                {videoModal.videoId ? (
                  <iframe
                    key={videoModal.videoId}
                    title={videoModal.nombre || "YouTube"}
                    src={getYoutubeEmbedSrc(videoModal.videoId)}
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : null}
              </div>
            </div>
          </div>,
          document.body
        )}
      {session&&activeDay&&(
        <WorkoutScreen
          session={session}
          activeDay={activeDay}
          activeR={activeR}
          allEx={allEx}
          progress={progress}
          logSet={logSet}
          startTimer={startTimer}
          timer={timer}
          setSession={setSession}
          setCompletedDays={setCompletedDays}
          completedDays={completedDays}
          currentWeek={currentWeek}
          setCurrentWeek={setCurrentWeek}
          preSessionPRs={preSessionPRs}
          setResumenSesion={setResumenSesion}
          readOnly={readOnly}
          sharedParam={sharedParam}
          sb={sb}
          es={es}
          darkMode={darkMode}
          prCelebration={prCelebration}
          setPrCelebration={setPrCelebration}
          activeExIdx={activeExIdx}
          setActiveExIdx={setActiveExIdx}
          sessionData={sessionData}
          sessionPRList={sessionPRList}
          videoOverrides={videoOverrides}
          setVideoModal={setVideoModal}
        />
      )}
      {!hideGlobalBottomNavCoachDash && !(showCoachDesktopShell && coachDesktop1024) && (
      <nav style={{
        position:"fixed",bottom:0,left:0,right:0,
        background: darkMode ? "rgba(15,25,35,0.96)" : "rgba(255,255,255,0.96)",
        backdropFilter: "blur(12px)",
        borderTop:"1px solid "+(darkMode?"#1E2D40":"#E2E8F0"),
        display:"flex",zIndex:40,
        paddingBottom:"env(safe-area-inset-bottom,0px)"
      }}>
        {tabs2.map(tb=>{
          const isActive = tab===tb.k;
          const activeCol = esAlumno ? "#3b82f6" : "#2563EB";
          const inactiveCol = darkMode?"#8B9AB2":"#64748B";
          return(
            <button key={tb.k} onClick={()=>setTab(tb.k)}
              style={{flex:1,background:"none",border:"none",
                padding:"8px 0 12px",cursor:"pointer",
                display:"flex",flexDirection:"column",
                alignItems:"center",gap:4,
                position:"relative"}}>
              <div style={{
                position:"absolute",top:0,left:"50%",
                transform:"translateX(-50%)",
                height:3,width:isActive?28:0,
                background:activeCol,borderRadius:"0 0 3px 3px",
                transition:"width .25s cubic-bezier(.4,0,.2,1)"
              }}/>
              <div style={{
                background:isActive?(darkMode?"rgba(59,130,246,0.2)":"rgba(59,130,246,0.12)"):esAlumno?"transparent":(darkMode?"transparent":"transparent"),
                borderRadius:esAlumno?8:8,
                padding:esAlumno?"6px 14px":"4px 12px",
                transition:"background-color .2s ease,border-color .2s ease,color .2s ease,opacity .2s ease,transform .2s ease",
                display:"flex",alignItems:"center",justifyContent:"center"
              }}>
                {tb.icon(isActive?activeCol:inactiveCol)}
              </div>
              <span style={{
                fontSize:11,fontWeight:isActive?700:500,
                letterSpacing:0.3,
                color:isActive?activeCol:inactiveCol,
                transition:"color .2s"
              }}>{tb.lbl}</span>
            </button>
          );
        })}
      </nav>
      )}
      </div>
    </div>
    {(() => {
      var cfg = getCoachDialogModalConfig();
      return (
    <DeleteConfirmModal
      key="it-coach-confirm"
      zIndex={10000}
      open={coachDialog.t !== 'none'}
      onCancel={function () {
        if (coachDialogLoading) return;
        setCoachDialog({ t: 'none' });
      }}
      onConfirm={function () {
        void confirmCoachDialog();
      }}
      title={cfg.title}
      message={cfg.message}
      subjectName={cfg.subjectName}
      confirmLabel={cfg.confirmLabel}
      cancelLabel={msg('Cancelar', 'Cancel', 'Cancelar')}
      tone={cfg.tone}
      loading={coachDialogLoading}
      loadingLabel={cfg.loadingLabel}
      useLogoutIcon={!!cfg.useLogoutIcon}
      requireAcknowledge={!!cfg.requireAcknowledge}
      acknowledgeLabel={cfg.acknowledgeLabel}
    />
      );
    })()}
    </IronTrackI18nProvider>
    </>
  );
}

function GestionBiblioteca({allEx, setPatternOverrides, sb, customEx, setCustomEx, toast2, darkMode, videoOverrides, setVideoOverrides, setVideoModal, openNewExerciseTick = 0}) {
  const { msg, lang } = useIronTrackI18n();
  const _dm = typeof darkMode !== "undefined" ? darkMode : true;
  const bg = _dm?"#0F1923":"#F0F4F8";
  const bgCard = _dm?"#162234":"#FFFFFF";
  const bgSub = _dm?"#162234":"#EEF2F7";
  const border = _dm?"#2D4057":"#E2E8F0";
  const textMain = _dm?"#FFFFFF":"#0F1923";
  const textMuted = _dm?"#8B9AB2":"#64748B";

  const [tab, setTab] = React.useState(0);
  React.useEffect(
    function () {
      if (openNewExerciseTick > 0) setTab(1);
    },
    [openNewExerciseTick]
  );
  const [busq, setBusq] = React.useState("");
  const [filtPat, setFiltPat] = React.useState("todos");
  const [filtMus, setFiltMus] = React.useState("todos");
  const [modoFiltro, setModoFiltro] = React.useState("patron");
  const [editModal, setEditModal] = React.useState(null);
  const [editNombre, setEditNombre] = React.useState("");
  const [editPat, setEditPat] = React.useState("empuje");
  const [editYT, setEditYT] = React.useState("");
  const [editSaveLoading, setEditSaveLoading] = React.useState(false);
  const [newNombre, setNewNombre] = React.useState("");
  const [newPat, setNewPat] = React.useState("empuje");
  const [newMusKeys, setNewMusKeys] = React.useState([]);
  const [sortModo, setSortModo] = React.useState(0);
  const [newEquip, setNewEquip] = React.useState("");
  const [newYT, setNewYT] = React.useState("");
  const [borrarId, setBorrarId] = React.useState(null);
  const ytOverrides = videoOverrides || {};
  const [libNarrow, setLibNarrow] = React.useState(function () {
    return typeof window !== "undefined" && window.innerWidth < 700;
  });
  React.useEffect(function () {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    var mq = window.matchMedia("(max-width: 699px)");
    var onCh = function () { setLibNarrow(mq.matches); };
    onCh();
    mq.addEventListener("change", onCh);
    return function () { mq.removeEventListener("change", onCh); };
  }, []);

  const patrones = ["todos","empuje","traccion","rodilla","bisagra","core","movilidad","cardio","oly"];
  const musculos = ["todos","Cuadriceps","Gluteo","Isquios","Pecho","Dorsal","Hombro","Biceps","Triceps","Core","Pantorrilla"];
  const patColors = {empuje:"#8B9AB2",traccion:"#8B9AB2",rodilla:"#8B9AB2",bisagra:"#8B9AB2",core:"#8B9AB2",movilidad:"#8B9AB2",cardio:"#8B9AB2",oly:"#8B9AB2"};
  const patLabel = p => ({
    todos:msg("TODOS", "ALL"), empuje:msg("EMPUJE", "PUSH"), traccion:msg("TRACCION", "PULL"),
    rodilla:msg("RODILLA", "KNEE"), bisagra:msg("BISAGRA", "HINGE"), core:"CORE",
    movilidad:msg("MOVILIDAD", "MOBILITY"), cardio:"CARDIO", oly:msg("OLIMPICO", "OLYMPIC"),
  })[p] || p.toUpperCase();
  const musLabel = m => m==="todos"?(msg("TODOS", "ALL")):m==="Dorsal"?(msg("DORSAL", "BACK")):m==="Gluteo"?(msg("GLUTEO", "GLUTE")):m==="Isquios"?(msg("ISQUIOS", "HAMSTRINGS")):m==="Pecho"?(msg("PECHO", "CHEST")):m==="Hombro"?(msg("HOMBRO", "SHOULDER")):m==="Pantorrilla"?(msg("PANTORRILLA", "CALVES")):m.toUpperCase();
  const BIB_PATTERN_EDIT_KEYS = { empuje: 1, traccion: 1, rodilla: 1, bisagra: 1, core: 1, movilidad: 1, cardio: 1, oly: 1 };
  const patKeysEditList = ["empuje", "traccion", "rodilla", "bisagra", "core", "movilidad", "cardio", "oly"];
  const normalizeEditPattern = function (p) { return p && BIB_PATTERN_EDIT_KEYS[p] ? p : "empuje"; };

  const exFiltrados = allEx.filter(e=>{
    const nombre = pickExerciseName(e, lang);
    const matchQ = !busq || nombre.toLowerCase().includes(busq.toLowerCase());
    const matchPat = filtPat==="todos" || e.pattern===filtPat;
    const matchMus = filtMus==="todos" || bibMuscleFilterHaystack(e.muscle).includes(filtMus.toLowerCase());
    return matchQ && (modoFiltro==="patron"?matchPat:matchMus);
  });

  const exFiltradosSorted = React.useMemo(function () {
    var list = exFiltrados.slice();
    if (sortModo === 0) return list;
    var loc = localeForSort(lang);
    list.sort(function (a, b) {
      var na = pickExerciseName(a, lang) || "";
      var nb = pickExerciseName(b, lang) || "";
      var cmp = na.localeCompare(nb, loc, { sensitivity: "base" });
      return sortModo === 1 ? cmp : -cmp;
    });
    return list;
  }, [exFiltrados, sortModo, lang]);

  const counts = {};
  allEx.forEach(e=>{ counts[e.name.toLowerCase()]=(counts[e.name.toLowerCase()]||0)+1; });
  const dupCount = Object.values(counts).filter(v=>v>1).length;

  const guardarEdicion = async () => {
    if (!editModal || !editNombre.trim()) { toast2(msg("Ingresa un nombre", "Enter a name")); return; }
    const canPat = normalizeEditPattern(editPat);
    setEditSaveLoading(true);
    try {
      const isCustom = !!(customEx || []).find(c => c.id === editModal.id);
      if (isCustom) {
        const updated = customEx.map(e =>
          e.id === editModal.id
            ? sanitizeExerciseSnapshotForWrite({ ...e, name: editNombre, nameEn: editNombre, video_url: (editYT || "").trim(), pattern: canPat })
            : sanitizeExerciseSnapshotForWrite(e)
        );
        setCustomEx(updated);
        const row = updated.find(c => c.id === editModal.id);
        if (row) {
          try {
            await sb.updateCustomEx(editModal.id, { name: row.name, name_en: row.nameEn, video_url: row.video_url, pattern: canPat });
          } catch (e) {}
        }
      } else if (setPatternOverrides) {
        const orig = EX.find(function (x) { return x.id === editModal.id; });
        const basePat = orig && BIB_PATTERN_EDIT_KEYS[orig.pattern] ? orig.pattern : "empuje";
        if (canPat === basePat) {
          setPatternOverrides(function (prev) {
            var n = { ...(prev || {}) };
            delete n[editModal.id];
            return n;
          });
        } else {
          setPatternOverrides(function (prev) { return { ...(prev || {}), [editModal.id]: canPat }; });
        }
      }
      if (editYT) {
        try {
          await sb.setVideoOverride(editModal.id, editYT);
          if (setVideoOverrides) setVideoOverrides(function (prev) { return { ...prev, [editModal.id]: editYT }; });
        } catch (e) { console.error("[videoOverride]", e); }
      }
      setEditModal(null);
      toast2(msg("Ejercicio actualizado ✓", "Exercise updated ✓"));
    } finally {
      setEditSaveLoading(false);
    }
  };
  const borrarEjercicio = async (id) => {
    const updated = customEx.filter(e=>e.id!==id);
    setCustomEx(updated);
    try { await sb.deleteCustomEx(id); } catch(e){}
    setBorrarId(null); toast2(msg("Ejercicio eliminado ✓", "Exercise deleted ✓"));
  };
  const agregarEjercicio = async () => {
    if(!newNombre.trim()){toast2(msg("Ingresa un nombre", "Enter a name"));return;}
    var muscleStored = newMusKeys.length ? JSON.stringify(BIB_MUSCLE_ORDER.filter(function (k) { return newMusKeys.indexOf(k) >= 0; })) : "";
    const newEx = sanitizeExerciseSnapshotForWrite({id:"custom_"+Date.now(), name:newNombre, nameEn:newNombre, pattern:newPat, muscle:muscleStored, equip:newEquip||"Libre", video_url:(newYT||"").trim(), isCustom:true});
    const updated = [...(customEx||[]), newEx];
    setCustomEx(updated);
    // Guardar en Supabase
    try {
      await sb.addCustomEx({id:newEx.id, name:newEx.name, name_en:newEx.nameEn, pattern:newEx.pattern, muscle:newEx.muscle, equip:newEx.equip, video_url:newEx.video_url!=null?newEx.video_url:null, entrenador_id:"entrenador_principal"});
    } catch(e){ console.error("[addCustomEx]",e); }
    setNewNombre(""); setNewPat("empuje"); setNewMusKeys([]); setNewEquip(""); setNewYT("");
    setTab(0); toast2(msg("Ejercicio agregado ✓", "Exercise added ✓"));
  };
  const inpS = {background:bg,border:"1px solid "+border,borderRadius:8,padding:"8px 12px",color:textMain,fontSize:15,width:"100%",fontFamily:"inherit",outline:"none",marginBottom:8};
  const cardBorder = _dm ? "rgba(45, 64, 87, 0.9)" : border;
  const chipBtnPad = {padding:libNarrow ? "6px 11px" : "7px 13px", borderRadius:18, fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:"inherit"};

  return (
    <div className="min-w-0 max-w-full">
      <style dangerouslySetInnerHTML={{__html:(
        "@media (min-width:769px){.it-bib-ex-card{transition:background .16s ease,border-color .16s ease}"+
        (_dm?".it-bib-ex-card-d:hover{background:rgba(255,255,255,.04)!important;border-color:rgba(96,165,250,.32)!important}":".it-bib-ex-card-l:hover{background:rgba(37,99,235,.05)!important;border-color:rgba(96,165,250,.4)!important}") +
        "}"
      )}} />
      <div
        className="min-w-0 max-w-full"
        style={{
          display:"flex", flexDirection:"column", gap:libNarrow ? 18 : 20,
          padding: libNarrow ? "20px 16px 24px" : "30px 20px 28px",
        }}
      >
        <div
          className="min-w-0"
          style={{
            display:"flex",
            flexDirection: libNarrow ? "column" : "row",
            alignItems: libNarrow ? "stretch" : "flex-start",
            justifyContent:"space-between",
            gap: libNarrow ? 12 : 20,
            marginBottom: 4,
          }}
        >
          <div className="min-w-0" style={{flex: libNarrow ? "none" : 1, minWidth:0}}>
            <h2
              className="min-w-0"
              style={{fontSize: libNarrow ? 22 : 24, fontWeight: 800, color: textMain, lineHeight: 1.2, margin: 0, marginBottom: 6, letterSpacing: 0.2}}
            >
              {msg("Ejercicios", "Exercises", "Exercícios")}
            </h2>
            <p style={{fontSize: 14, lineHeight: 1.5, color: textMuted, margin: 0, maxWidth: 480}}>
              {msg("Gestioná tu biblioteca de movimientos, videos y categorías.", "Manage your library of movements, videos, and categories.", "Gerencie sua biblioteca de movimentos, vídeos e categorias.")}
            </p>
          </div>
          <button
            type="button"
            onClick={function () { setTab(1); }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "10px 18px",
              borderRadius: 12,
              border: "none",
              background: "#2563EB",
              color: "#fff",
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
              flexShrink: 0,
              minHeight: 44,
              width: libNarrow ? "100%" : "auto",
            }}
          >
            {msg("+ Nuevo ejercicio", "+ New exercise", "+ Novo exercício")}
          </button>
        </div>

        <div style={{display:"flex",borderBottom:"1px solid "+(darkMode?"#2D4057":"#2D4057"),minWidth:0, paddingBottom:0}}>
          {[msg("GESTIONAR", "MANAGE"), msg("+ NUEVO", "+ NEW")].map((t,i)=>(
            <button key={i===0?"bib-tab-manage":"bib-tab-new"} onClick={()=>setTab(i)} style={{flex:1,minWidth:0,padding:"14px 8px",border:"none",background:"none",
              fontFamily:"inherit",fontSize:16,fontWeight:800,cursor:"pointer",
              color:tab===i?"#2563EB":"#8B9AB2",borderBottom:tab===i?"2px solid #3B82F6":"2px solid transparent"}}>
              {t}{i===0&&dupCount>0?(
                <span
                  title={msg(`Hay ${dupCount} nombres de ejercicio duplicados`, `There are ${dupCount} duplicate exercise names`)}
                  style={{marginLeft:8,background:"#2563EB",color:"#fff",borderRadius:12,padding:"1px 7px",fontSize:13,display:"inline-flex",alignItems:"center",justifyContent:"center"}}
                >
                  <Ic name="alert-triangle" size={12} color="#fff"/>
                </span>
              ):null}
            </button>
          ))}
        </div>

        {tab===0&&(
        <div className="min-w-0" style={{ display:"flex", flexDirection:"column", gap: libNarrow ? 16 : 20, marginTop: 0 }}>
          <div
            className="min-w-0"
            style={{
              borderRadius: 20,
              padding: libNarrow ? 16 : 22,
              border: "1px solid " + (_dm ? "rgba(45, 64, 87, 0.65)" : "rgba(226, 232, 240, 0.9)"),
              background: _dm
                ? "linear-gradient(165deg, rgba(32, 48, 64, 0.42) 0%, rgba(12, 22, 35, 0.58) 100%)"
                : "linear-gradient(165deg, rgba(255, 255, 255, 0.96) 0%, rgba(241, 245, 249, 0.9) 100%)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              boxShadow: _dm ? "0 4px 24px rgba(0,0,0,0.12)" : "0 2px 12px rgba(15, 23, 42, 0.06)",
              display: "flex", flexDirection: "column", gap: libNarrow ? 16 : 18, minWidth: 0,
            }}
          >
            <input
              type="search"
              style={{...inpS, marginBottom:0}}
              placeholder={msg("🔍 Buscar ejercicio...", "🔍 Search exercise...")}
              value={busq}
              onChange={e=>setBusq(e.target.value)}
            />
            <div
              className="min-w-0"
              style={{ display:"flex", background:bgSub, border:"1px solid "+border, borderRadius: 12, padding: 4, gap: 4 }}
            >
              {[msg("Por patrón", "By pattern", "Por padrão"), msg("Por músculo", "By muscle", "Por músculo")].map((t,i)=>(
                <button
                  type="button"
                  key={i===0?"bib-filt-patron":"bib-filt-muscle"}
                  onClick={()=>{setModoFiltro(i===0?"patron":"musculo");setFiltPat("todos");setFiltMus("todos");}}
                  style={{
                    flex:1, padding:"9px 8px", border:"none", borderRadius:8, fontFamily:"inherit", fontSize:14, fontWeight:700, cursor:"pointer",
                    background:modoFiltro===(i===0?"patron":"musculo")?"#2563EB":"transparent",
                    color:modoFiltro===(i===0?"patron":"musculo")?"#fff":"#8B9AB2",
                    minWidth:0,
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            {modoFiltro==="patron" && (
              <div className="min-w-0" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignContent: "flex-start" }}>
                {patrones.map(p=>(
                  <button
                    type="button"
                    key={p}
                    onClick={()=>setFiltPat(p)}
                    style={{...chipBtnPad,
                      border: filtPat===p ? "1px solid "+patColors[p] : filtPat==="todos"&&p==="todos" ? "1px solid #243040" : "1px solid "+border,
                      background: filtPat===p ? patColors[p]+"22" : filtPat==="todos"&&p==="todos" ? "#2563EB22" : _dm ? "#1E2D40" : bgSub,
                      color: filtPat===p ? patColors[p] : filtPat==="todos"&&p==="todos" ? "#2563EB" : "#8B9AB2",
                    }}
                  >
                    {patLabel(p)}
                  </button>
                ))}
              </div>
            )}
            {modoFiltro==="musculo" && (
              <div className="min-w-0" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignContent: "flex-start" }}>
                {musculos.map(m=>(
                  <button
                    type="button"
                    key={m}
                    onClick={()=>setFiltMus(m==="todos"?"todos":m)}
                    style={{...chipBtnPad,
                      border: filtMus===m ? "1px solid #60a5fa" : "1px solid "+border,
                      background: filtMus===m ? "#2563EB22" : _dm ? "#1E2D40" : bgSub,
                      color: filtMus===m ? "#2563EB" : "#8B9AB2",
                    }}
                  >
                    {musLabel(m)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div
            className="min-w-0"
            style={{
              display: "flex",
              flexDirection: libNarrow ? "column" : "row",
              alignItems: libNarrow ? "stretch" : "center",
              justifyContent: "space-between",
              gap: libNarrow ? 10 : 14,
              minWidth: 0,
            }}
          >
            <div style={{fontSize: 14, color: textMuted, fontWeight: 600, minWidth: 0, lineHeight: 1.4, flex: libNarrow ? "none" : 1, overflowWrap: "anywhere" }}>
              {msg("Mostrando", "Showing")} {exFiltrados.length} {msg("ejercicios de", "exercises of")} {allEx.length}
            </div>
            <button
              type="button"
              onClick={function () { setSortModo(function (m) { return (m + 1) % 3; }); }}
              title={sortModo === 0 ? (msg("Sin orden definido — clic para A-Z", "Default order — click for A-Z")) : sortModo === 1 ? (msg("Orden: A-Z — clic para Z-A", "Order: A-Z — click for Z-A")) : (msg("Orden: Z-A — clic para quitar orden", "Order: Z-A — click to clear sort"))}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 10,
                border: "1px solid " + (sortModo === 0 ? border : "#2563EB"),
                background: sortModo === 0 ? bgSub : "#2563EB22",
                color: sortModo === 0 ? textMuted : "#2563EB",
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                flexShrink: 0,
                alignSelf: libNarrow ? "stretch" : "auto",
                width: libNarrow ? "100%" : "auto",
              }}
            >
              <Ic name="arrow-up-down" size={18} color={sortModo === 0 ? "#8B9AB2" : "#2563EB"} />
              {msg("Ordenar", "Sort")}
            </button>
          </div>

          <div className="min-w-0" style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 2 }}>
          {exFiltradosSorted.map(e=>{
            const isCustom = !!(customEx||[]).find(c=>c.id===e.id);
            const nombre = pickExerciseName(e, lang);
            const muscleLine = formatBibMuscleDisplay(e.muscle, lang);
            const ytUrl = resolveVideoUrl(e, null, ytOverrides);
            return (
              <div
                key={e.id}
                className={"it-bib-ex-card min-w-0 " + (_dm ? "it-bib-ex-card-d" : "it-bib-ex-card-l")}
                style={{background:bgCard, border: "1px solid "+cardBorder, borderRadius: 17, padding: libNarrow ? "15px" : "17px", minWidth:0}}
              >
                <div style={{display:"flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap", flexDirection: libNarrow ? "column" : "row" }}>
                  <div style={{flex: "1 1 8rem", minWidth:0}}>
                    <div
                      className="min-w-0"
                      style={{fontSize: 17, fontWeight: 800, color: textMain, marginBottom: 7, lineHeight: 1.3, wordBreak: "break-word", overflowWrap: "anywhere"}}
                    >
                      {nombre}
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <span
                        className="inline-flex"
                        style={{
                          background: _dm ? "rgba(22, 34, 52, 0.85)" : "rgba(226, 232, 240, 0.85)",
                          color: textMuted,
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 10,
                          fontWeight: 700,
                          border: "1px solid " + cardBorder,
                          letterSpacing: 0.2,
                        }}
                      >
                        {patLabel(e.pattern)}
                      </span>
                      {muscleLine && (
                        <span
                          className="inline-flex"
                          style={{
                            background: _dm ? "rgba(22, 34, 52, 0.5)" : "rgba(37, 99, 235, 0.08)",
                            color: _dm ? textMuted : "#0F1923",
                            padding: "2px 7px",
                            borderRadius: 8,
                            fontSize: 10,
                            fontWeight: 600,
                            border: "1px solid " + (_dm ? "rgba(45, 64, 87, 0.45)" : border),
                            maxWidth: "100%",
                          }}
                        >
                          {muscleLine}
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    className="min-w-0"
                    style={{
                      display: "flex",
                      gap: 8,
                      flexShrink: 0,
                      alignItems: "center",
                      marginLeft: "auto",
                      width: libNarrow ? "100%" : "auto",
                      justifyContent: "flex-end",
                    }}
                  >
                    {ytUrl && (
                      <a href={ytUrl} target="_blank" rel="noreferrer" aria-label={msg("Ver video", "Watch video", "Ver vídeo")}
                        style={{
                          width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center",
                          background: _dm ? "rgba(22, 34, 52, 0.6)" : bgSub,
                          color: textMuted, border: "1px solid " + cardBorder, borderRadius: 12, textDecoration: "none", fontSize: 16, flexShrink: 0,
                        }}>▶</a>
                    )}
                    <button
                      type="button"
                      onClick={function () {
                        setEditModal(e);
                        setEditNombre(pickExerciseName(e, lang) || e.name || "");
                        setEditPat(normalizeEditPattern(e.pattern));
                        setEditYT(ytUrl || "");
                      }}
                      style={{
                        width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center",
                        background: _dm ? "rgba(22, 34, 52, 0.6)" : bgSub, color: textMuted, border: "1px solid " + cardBorder, borderRadius: 12, cursor: "pointer", fontSize: 15, flexShrink: 0,
                        fontFamily: "inherit", padding: 0,
                      }}
                    >
                      <Ic name="link" size={15}/>
                    </button>
                    {isCustom && (
                      <button
                        type="button"
                        onClick={()=>setBorrarId(e.id)}
                        style={{
                          width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center",
                          background: _dm ? "rgba(22, 34, 52, 0.6)" : bgSub, color: textMuted, border: "1px solid " + cardBorder, borderRadius: 12, cursor: "pointer", fontSize: 15, flexShrink: 0,
                          fontFamily: "inherit", padding: 0,
                        }}
                      >
                        <Ic name="trash-2" size={15}/>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>
        )}

      {tab===1&&(
        <div>
          <div style={{fontSize:15,color:textMuted,marginBottom:16}}>{msg("El ejercicio quedara disponible en la biblioteca para armar rutinas.", "The exercise will be available in the library to build routines.")}</div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:15,fontWeight:800,color:textMuted,letterSpacing:1,marginBottom:8}}>{msg("NOMBRE *", "NAME *")}</div>
            <input style={inpS} value={newNombre} onChange={e=>setNewNombre(e.target.value)} placeholder={msg("Ej: Press inclinado con mancuernas", "Ex: Incline Dumbbell Press")}/>
          </div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:15,fontWeight:800,color:textMuted,letterSpacing:1,marginBottom:8}}>{msg("PATRON", "PATTERN")}</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {["empuje","traccion","rodilla","bisagra","core","movilidad","cardio","oly"].map(p=>(
                <button key={p} onClick={()=>setNewPat(p)} style={{padding:"8px 14px",borderRadius:8,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                  border:newPat===p?"1px solid "+(patColors[p]||"#2563EB"):"1px solid "+border,
                  background:newPat===p?(patColors[p]||"#2563EB")+"22":"#1E2D40",
                  color:newPat===p?(patColors[p]||"#2563EB"):"#8B9AB2"}}>
                  {patLabel(p)}
                </button>
              ))}
            </div>
          </div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:15,fontWeight:800,color:textMuted,letterSpacing:1,marginBottom:8}}>{msg("MUSCULO", "MUSCLE")}</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {BIB_MUSCLE_OPTIONS.map(function (o) {
                var sel = newMusKeys.indexOf(o.k) >= 0;
                return (
                  <button
                    key={o.k}
                    type="button"
                    onClick={function () {
                      setNewMusKeys(function (prev) {
                        return prev.indexOf(o.k) >= 0 ? prev.filter(function (x) { return x !== o.k; }) : prev.concat([o.k]);
                      });
                    }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      fontSize: 15,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      border: sel ? "1px solid #2563EB" : "1px solid " + border,
                      background: sel ? "#2563EB22" : "#1E2D40",
                      color: sel ? "#2563EB" : "#8B9AB2",
                    }}
                  >
                    {msg(o.chipEs, o.chipEn)}
                  </button>
                );
              })}
            </div>
            <div style={{fontSize: 13, color: textMuted, marginTop: 8, lineHeight: 1.4 }}>
              {msg("Seleccionados: ", "Selected: ")}
              {BIB_MUSCLE_ORDER.filter(function (k) { return newMusKeys.indexOf(k) >= 0; })
                .map(function (k) {
                  var opt = BIB_MUSCLE_OPTIONS.find(function (x) { return x.k === k; });
                  return opt ? msg(opt.selEs, opt.selEn) : k;
                })
                .join(", ") || "—"}
            </div>
          </div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:15,fontWeight:800,color:textMuted,letterSpacing:1,marginBottom:8}}>{msg("EQUIPAMIENTO", "EQUIPMENT")}</div>
            <input style={inpS} value={newEquip} onChange={e=>setNewEquip(e.target.value)} placeholder={msg("Ej: Barra, Mancuernas, Libre", "Ex: Barbell, Dumbbells, Bodyweight")}/>
          </div>
          <div style={{marginBottom:24}}>
            <div style={{fontSize:15,fontWeight:800,color:textMuted,letterSpacing:1,marginBottom:8}}>LINK YOUTUBE</div>
            <input style={inpS} value={newYT} onChange={e=>setNewYT(e.target.value)} placeholder="https://youtube.com/..."/>
            {newYT&&(newYT.includes("youtube")||newYT.includes("youtu.be"))&&(
              <div style={{marginTop:8,fontSize:13,color:"#22C55E",fontWeight:700}}>▶️ {msg("Link valido ✓", "Valid link ✓")}</div>
            )}
          </div>
          <button onClick={agregarEjercicio} style={{width:"100%",padding:12,background:"#2563EB",color:"#fff",border:"none",borderRadius:12,fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>
            {msg("+ AGREGAR EJERCICIO", "+ ADD EXERCISE")}
          </button>
        </div>
      )}

      </div>

      {editModal && typeof document !== "undefined" && createPortal((
        <div
          onClick={function () { if (!editSaveLoading) setEditModal(null); }}
          style={{
            position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, boxSizing: "border-box",
            background: "rgba(2, 6, 23, 0.72)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <div
            onClick={function (e) { e.stopPropagation(); }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="bib-edit-ex-title"
            className="it-bib-edit-card"
            style={{
              maxWidth: 560,
              width: "min(560px, calc(100vw - 32px))",
              maxHeight: "calc(100dvh - 48px)",
              overflowY: "auto",
              boxSizing: "border-box",
              borderRadius: 22,
              padding: 24,
              background: _dm ? "rgba(15, 23, 42, 0.94)" : "#ffffff",
              border: _dm ? "1px solid rgba(148, 163, 184, 0.24)" : "1px solid " + border,
              boxShadow: "0 24px 80px rgba(0,0,0,.45)",
              color: _dm ? "#f1f5f9" : textMain,
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "contain",
            }}
          >
            <div id="bib-edit-ex-title" style={{ fontSize: 20, fontWeight: 800, marginBottom: 20, lineHeight: 1.2 }}>{msg("Editar ejercicio", "Edit exercise", "Editar exercício")}</div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8, color: _dm ? "#94a3b8" : textMuted }}>{msg("NOMBRE", "NAME", "NOME")}</label>
              <input
                autoComplete="off"
                style={{
                  background: _dm ? "rgba(2, 6, 23, 0.5)" : bgSub,
                  border: "1px solid " + (_dm ? "rgba(148, 163, 184, 0.3)" : border), borderRadius: 10, padding: "10px 12px", color: _dm ? "#f8fafc" : textMain, fontSize: 15, width: "100%", fontFamily: "inherit", outline: "none", boxSizing: "border-box",
                }}
                value={editNombre}
                onChange={e=>setEditNombre(e.target.value)}
                disabled={editSaveLoading}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8, color: _dm ? "#94a3b8" : textMuted }} htmlFor="bib-edit-pattern">{msg("PATRÓN", "PATTERN", "PADRÃO")}</label>
              <select
                id="bib-edit-pattern"
                value={editPat}
                onChange={e=>setEditPat(e.target.value)}
                disabled={editSaveLoading}
                style={{
                  display: "block", width: "100%", minHeight: 44,
                  background: _dm ? "rgba(2, 6, 23, 0.5)" : bgSub,
                  border: "1px solid " + (_dm ? "rgba(148, 163, 184, 0.3)" : border), borderRadius: 10, padding: "10px 12px", color: _dm ? "#f8fafc" : textMain, fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box", cursor: "pointer",
                }}
              >
                {patKeysEditList.map(function (pk) {
                  return <option key={pk} value={pk}>{patLabel(pk)}</option>;
                })}
              </select>
            </div>
            <div style={{ marginBottom: 0 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8, color: _dm ? "#94a3b8" : textMuted }}>{msg("LINK YOUTUBE", "YOUTUBE LINK", "LINK DO YOUTUBE")}</label>
              <div style={{ fontSize: 12, color: _dm ? "#7dd3fc" : "#2563EB", marginBottom: 8, display: "flex", alignItems: "flex-start", gap: 6, lineHeight: 1.35 }}>
                <span style={{ flexShrink: 0, marginTop: 1 }}><Ic name="info" size={14} color="currentColor"/></span>
                <span>{msg("Ideal: video corto -30 seg (YouTube Shorts)", "Ideal: short video -30 sec (YouTube Shorts)", "Ideal: vídeo curto ~30s (YouTube Shorts)")}</span>
              </div>
              <input
                autoComplete="off"
                style={{
                  background: _dm ? "rgba(2, 6, 23, 0.5)" : bgSub,
                  border: "1px solid " + (_dm ? "rgba(148, 163, 184, 0.3)" : border), borderRadius: 10, padding: "10px 12px", color: _dm ? "#f8fafc" : textMain, fontSize: 15, width: "100%", fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 8,
                }}
                value={editYT}
                onChange={e=>setEditYT(e.target.value)}
                placeholder="https://youtube.com/shorts/..."
                disabled={editSaveLoading}
              />
              {editYT && (editYT.includes("youtube") || editYT.includes("youtu.be")) && (()=>{
                var videoId = null;
                try {
                  if (editYT.includes("shorts/")) videoId = editYT.split("shorts/")[1].split("?")[0].split("&")[0];
                  else if (editYT.includes("v=")) videoId = editYT.split("v=")[1].split("&")[0];
                  else if (editYT.includes("youtu.be/")) videoId = editYT.split("youtu.be/")[1].split("?")[0];
                } catch (e) {}
                if (!videoId) return <div style={{ marginTop: 8, fontSize: 13, color: "#22C55E", fontWeight: 700 }}>✓ {msg("Link detectado", "Link detected", "Link detectado")}</div>;
                return (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: _dm ? "#94a3b8" : textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{msg("PREVIEW", "PREVIEW", "PRÉVIA")}</div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <img loading="lazy" alt="" src={"https://img.youtube.com/vi/" + videoId + "/mqdefault.jpg"} style={{ width: 120, height: 68, borderRadius: 8, objectFit: "cover", border: "1px solid " + (_dm ? "rgba(148, 163, 184, 0.35)" : border) }} onError={function (e) { e.target.style.display = "none"; }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#22C55E" }}>✓ {msg("Video detectado", "Video detected", "Vídeo detectado")}</div>
                        <div style={{ fontSize: 11, color: _dm ? "#94a3b8" : textMuted, marginTop: 2 }}>ID: {videoId}</div>
                        <a href={editYT} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#3b82f6", textDecoration: "none", marginTop: 4, display: "inline-block" }}>{msg("Abrir en YouTube ↗", "Open in YouTube ↗", "Abrir no YouTube ↗")}</a>
                      </div>
                    </div>
                  </div>
                );
              })()}
              {editYT && !(editYT.includes("youtube") || editYT.includes("youtu.be")) && (
                <div style={{ marginTop: 8, fontSize: 12, color: "#F59E0B" }}>⚠ {msg("No parece un link de YouTube", "Doesn't look like a YouTube link", "Não parece um link do YouTube")}</div>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 24, paddingTop: 4 }}>
              <button
                type="button"
                disabled={editSaveLoading}
                onClick={function () { setEditModal(null); }}
                style={{ flex: 1, padding: 12, background: _dm ? "rgba(30, 41, 59, 0.9)" : "#E2E8F0", color: _dm ? "#cbd5e1" : textMain, border: "1px solid " + (_dm ? "rgba(148, 163, 184, 0.25)" : "transparent"), borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: editSaveLoading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: editSaveLoading ? 0.75 : 1 }}
              >{msg("CANCELAR", "CANCEL", "CANCELAR")}</button>
              <button
                type="button"
                disabled={editSaveLoading}
                onClick={function () { guardarEdicion(); }}
                style={{ flex: 1, padding: 12, background: "#2563EB", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: editSaveLoading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: editSaveLoading ? 0.85 : 1 }}
              >{editSaveLoading ? msg("Guardando...", "Saving...", "Guardando...") : msg("GUARDAR", "SAVE", "GUARDAR")}</button>
            </div>
          </div>
        </div>
      ), document.body)}

      {borrarId&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 16px"}} onClick={()=>setBorrarId(null)}>
          <div style={{background:bgCard,borderRadius:16,padding:20,width:"100%",maxWidth:320,border:"1px solid "+border,textAlign:"center"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:28,marginBottom:8}}>🗑️</div>
            <div style={{fontSize:15,fontWeight:800,marginBottom:8}}>{msg("Borrar ejercicio?", "Delete exercise?")}</div>
            <div style={{fontSize:13,color:textMuted,marginBottom:16}}>{msg("Esta accion no se puede deshacer", "This action cannot be undone")}</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setBorrarId(null)} style={{flex:1,padding:8,background:_dm?"#162234":"#E2E8F0",color:textMuted,border:"none",borderRadius:8,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{msg("CANCELAR", "CANCEL")}</button>
              <button onClick={()=>borrarEjercicio(borrarId)} style={{flex:1,padding:8,background:"#2563EB",color:"#fff",border:"none",borderRadius:8,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{msg("BORRAR", "DELETE")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function ScannerRutina({sb, routines, setRoutines, alumnos, toast2, setTab, es, user, darkMode}) {
  const _dm = typeof darkMode !== "undefined" ? darkMode : true;
  const bg = _dm?"#0F1923":"#F0F4F8";
  const bgCard = _dm?"#162234":"#FFFFFF";
  const bgSub = _dm?"#162234":"#EEF2F7";
  const border = _dm?"#2D4057":"#E2E8F0";
  const textMain = _dm?"#FFFFFF":"#0F1923";
  const textMuted = _dm?"#8B9AB2":"#64748B";

  const [paso, setPaso] = React.useState(1);
  const [procesando, setProcesando] = React.useState(false);
  const [progreso, setProgreso] = React.useState(0);
  const [statusMsg, setStatusMsg] = React.useState("");
  const [resultado, setResultado] = React.useState(null);
  const [nombreRutina, setNombreRutina] = React.useState("");
  const [alumnoSel, setAlumnoSel] = React.useState(null);
  const [filtroRut, setFiltroRut] = React.useState("todas");
  const fileRef = React.useRef();
  const fileGalRef = React.useRef();
  const allEx = React.useMemo(()=>{
    try{ const c=JSON.parse(localStorage.getItem("it_cex")||"[]"); return [...EX,...c]; }catch(e){return EX;}
  },[]);

  const procesarImagen = async (base64) => {
    setPaso(2); setProcesando(true); setProgreso(0);
    const msgs = ["Detectando texto...","Reconociendo ejercicios...",msg("Buscando en biblioteca...", "Searching library..."),"Analizando series y reps...","Finalizando..."];
    let i=0;
    const timer = setInterval(()=>{ if(i<msgs.length){setProgreso((i+1)*18);setStatusMsg(msgs[i]);i++;}else{clearInterval(timer);} },600);

    try {
      const resp = await fetch("/api/scan",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          messages:[{role:"user",content:[
            {type:"image",source:{type:"base64",media_type:"image/jpeg",data:base64.split(",")[1]||base64}},
            {type:"text",text:"Sos un asistente de gimnasio. Analiza esta imagen de una rutina de entrenamiento escrita a mano o impresa. Extrae todos los ejercicios con sus series y repeticiones. Responde SOLO con JSON valido, sin texto extra, sin backticks: {\"nombreRutina\":\"nombre detectado o Rutina Escaneada\",\"ejercicios\":[{\"nombre\":\"nombre exacto del ejercicio\",\"series\":4,\"reps\":\"8\",\"notas\":\"notas si hay\"}]} Si no ves un valor claro de series o reps, usa null. Maximo 20 ejercicios."}
          ]}]}
        )
      });
      clearInterval(timer);
      const data = await resp.json();
      const txt = data.content?.find(c=>c.type==="text")?.text||"{}";
      let parsed;
      try{ parsed=JSON.parse(txt); }catch(e){ parsed={nombreRutina:"Rutina Escaneada",ejercicios:[]}; }
      setProgreso(100); setStatusMsg(msg("Analisis completo", "Analysis complete"));

      // Cruzar con biblioteca
      const exConMatch = (parsed.ejercicios||[]).map(ej=>{
        const nombre = ej.nombre||"";
        const match = allEx.find(e=>
          e.name.toLowerCase().includes(nombre.toLowerCase().slice(0,5)) ||
          nombre.toLowerCase().includes(e.name.toLowerCase().slice(0,5))
        );
        return {...ej, match, busqueda:"", selManual:null};
      });
      setResultado({nombre:parsed.nombreRutina||"Rutina Escaneada", ejercicios:exConMatch});
      setNombreRutina(parsed.nombreRutina||"Rutina Escaneada");
      setTimeout(()=>{ setProcesando(false); setPaso(3); },600);
    } catch(err) {
      clearInterval(timer);
      toast2("Error al procesar la imagen"); setProcesando(false); setPaso(1);
    }
  };

  const handleFile = (e) => {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => procesarImagen(ev.target.result);
    reader.readAsDataURL(file);
  };

  const buscarEnBib = (idx, q) => {
    if(!resultado) return;
    const upd = resultado.ejercicios.map((e,i)=>i===idx?{...e,busqueda:q,selManual:null}:e);
    setResultado({...resultado, ejercicios:upd});
  };

  const seleccionarMatch = (idx, ex) => {
    const upd = resultado.ejercicios.map((e,i)=>i===idx?{...e,selManual:ex,busqueda:""}:e);
    setResultado({...resultado, ejercicios:upd});
  };

  const agregarAutoEx = (idx) => {
    const ej = resultado.ejercicios[idx];
    const newEx = {id:"scan_"+Date.now()+"_"+idx, name:ej.nombre, nameEn:ej.nombre, pattern:"core", muscle:"", equip:"", custom:true, scanned:true};
    const customEx = JSON.parse(localStorage.getItem("it_customEx")||"[]");
    localStorage.setItem("it_customEx", JSON.stringify([...customEx, newEx]));
    const upd = resultado.ejercicios.map((e,i)=>i===idx?{...e,selManual:newEx,autoAdded:true}:e);
    setResultado({...resultado, ejercicios:upd});
    toast2("Ejercicio agregado a biblioteca ✓");
  };

  const guardarRutina = async () => {
    if(!nombreRutina.trim()){toast2("Ingresa un nombre");return;}
    const dias = [{
      id:"d1", name:"Dia 1", label:"DIA 1",
      exercises: resultado.ejercicios.map((ej,i)=>{
        const exRef = ej.selManual||ej.match;
        return {
          exId: exRef?.id||"custom_scan_"+i,
          exName: exRef?.name||ej.nombre,
          sets: ej.series||3,
          reps: ej.reps||"10",
          note: ej.notas||""
        };
      })
    }];
    const rutina = {id:"scan_"+Date.now(), name:nombreRutina, days:dias, scanned:true, created:new Date().toLocaleDateString("es-AR")};
    setRoutines(prev=>[...prev, rutina]);
    if(alumnoSel) {
      await sb.saveRutina(alumnoSel, {nombre:nombreRutina, datos:rutina});
      toast2("Rutina creada y asignada a "+alumnos.find(a=>a.id===alumnoSel)?.nombre+" ✓");
    } else {
      toast2("Rutina guardada ✓");
    }
    setPaso(4);
  };

  const inpS = {background:bg,border:"1px solid "+border,borderRadius:8,padding:"8px 12px",color:textMain,fontSize:15,width:"100%",fontFamily:"inherit",outline:"none"};

  return (
    <div>
      {paso===1&&(
        <div>
          <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>{msg("Escanear rutina en papel", "Scan paper routine")}</div>
          <div style={{fontSize:13,color:textMuted,marginBottom:24}}>{msg("La IA detecta ejercicios, series y repeticiones automaticamente.", "AI automatically detects exercises, sets and reps.")}</div>

          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={handleFile}/>
          <input ref={fileGalRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleFile}/>

          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <button onClick={()=>fileRef.current.click()} style={{flex:1,padding:"16px 10px",background:"#2563EB22",border:"2px solid #243040",borderRadius:12,color:"#2563EB",fontFamily:"inherit",fontSize:15,fontWeight:700,cursor:"pointer",textAlign:"center"}}>
              <div style={{fontSize:36,marginBottom:8}}>📸</div>
              <div>{msg("SACAR FOTO", "TAKE PHOTO")}</div>
              <div style={{fontSize:11,color:textMuted,marginTop:4}}>{msg("Abrir camara", "Open camera")}</div>
            </button>
            <button onClick={()=>fileGalRef.current.click()} style={{flex:1,padding:"16px 10px",background:_dm?"#162234":"#E2E8F0",border:"2px solid #2d3748",borderRadius:12,color:textMuted,fontFamily:"inherit",fontSize:15,fontWeight:700,cursor:"pointer",textAlign:"center"}}>
              <div style={{fontSize:36,marginBottom:8}}>🖼️</div>
              <div>{msg("CARGAR ARCHIVO", "UPLOAD FILE")}</div>
              <div style={{fontSize:11,color:textMuted,marginTop:4}}>{msg("Foto de galeria", "From gallery")}</div>
            </button>
          </div>

          <div style={{background:bgSub,border:"1px solid "+border,borderRadius:12,padding:12}}>
            <div style={{fontSize:13,fontWeight:500,color:textMuted,marginBottom:8,letterSpacing:.5}}>{msg("CONSEJOS", "TIPS")}</div>
            <div style={{fontSize:13,color:textMuted,display:"flex",flexDirection:"column",gap:8}}>
              <div>{msg("✅ Buena iluminacion, sin sombras", "✅ Good lighting, no shadows")}</div>
              <div>{msg("✅ Hoja bien centrada y legible", "✅ Sheet centered and legible")}</div>
              <div>{msg("✅ Formatos: \"4x8\", \"3 series de 10\"", "✅ Formats: \"4x8\", \"3 sets of 10\"")}</div>
            </div>
          </div>
        </div>
      )}
      {paso===2&&(
        <div style={{textAlign:"center",padding:"30px 0"}}>
          <div style={{fontSize:48,marginBottom:12}}>{progreso===100?"✅":"🔍"}</div>
          <div style={{fontSize:18,fontWeight:800,marginBottom:8}}>{progreso===100?"Analisis completo":"Procesando rutina..."}</div>
          <div style={{fontSize:13,color:textMuted,marginBottom:24}}>{statusMsg}</div>
          <div style={{height:5,background:_dm?"#162234":"#E2E8F0",borderRadius:2,overflow:"hidden",marginBottom:8}}>
            <div style={{height:"100%",background:"#2563EB",borderRadius:2,width:progreso+"%",transition:"width .5s"}}/>
          </div>
          <div style={{fontSize:13,color:textMuted}}>{progreso}%</div>
        </div>
      )}
      {paso===3&&resultado&&(
        <div>
          <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>{msg("Revisa la rutina detectada", "Review detected routine")}</div>
          <div style={{fontSize:13,color:textMuted,marginBottom:12}}>{msg("Podes editar antes de guardar.", "You can edit values before saving.")}</div>

          <div style={{background:"#22c55e15",border:"1px solid #22c55e33",borderRadius:12,padding:"8px 12px",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:18}}>✅</span>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:"#22C55E"}}>{resultado.ejercicios.length} ejercicios detectados</div>
              <div style={{fontSize:11,color:textMuted}}>{resultado.ejercicios.filter(e=>!e.match&&!e.selManual).length} no encontrados en biblioteca</div>
            </div>
          </div>

          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:0.3,marginBottom:8}}>{msg("NOMBRE", "NAME")}</div>
            <input style={inpS} value={nombreRutina} onChange={e=>setNombreRutina(e.target.value)}/>
          </div>
          {resultado.ejercicios.filter(e=>e.match||e.selManual).length>0&&(
            <div>
              <div style={{fontSize:11,fontWeight:700,color:"#22C55E",letterSpacing:0.3,marginBottom:8}}>{msg("✅ ENCONTRADOS", "✅ FOUND")} ({resultado.ejercicios.filter(e=>e.match||e.selManual).length})</div>
              {resultado.ejercicios.map((ej,i)=>{
                if(!ej.match&&!ej.selManual) return null;
                const ref = ej.selManual||ej.match;
                return (
                  <div key={(ref.id||"ex")+"-scan-ok-"+i+"-"+(ej.nombre||"")} style={{background:bg,border:"1px solid "+border,borderRadius:12,padding:"8px 12px",marginBottom:8,display:"flex",alignItems:"center",gap:8}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:800}}>{ref.name}</div>
                      <div style={{fontSize:11,color:textMuted}}>{ej.nombre!==ref.name?`Detectado: "${ej.nombre}"`:""}</div>
                    </div>
                    <input style={{background:bgSub,border:"1px solid "+border,borderRadius:6,padding:"4px 7px",color:textMain,fontSize:13,width:38,textAlign:"center",fontFamily:"inherit"}} defaultValue={ej.series||3}/>
                    <span style={{color:textMuted}}>x</span>
                    <input style={{background:bgSub,border:"1px solid "+border,borderRadius:6,padding:"4px 7px",color:textMain,fontSize:13,width:42,textAlign:"center",fontFamily:"inherit"}} defaultValue={ej.reps||"10"}/>
                  </div>
                );
              })}
            </div>
          )}
          {resultado.ejercicios.filter(e=>!e.match&&!e.selManual).length>0&&(
            <div>
              <div style={{fontSize:11,fontWeight:700,color:"#8B9AB2",letterSpacing:0.3,margin:"16px 0 7px"}}>{msg("⚠️ NO ENCONTRADOS", "⚠️ NOT FOUND")} ({resultado.ejercicios.filter(e=>!e.match&&!e.selManual).length})</div>
              {resultado.ejercicios.map((ej,i)=>{
                if(ej.match||ej.selManual) return null;
                const resBib = ej.busqueda?.length>=2 ? allEx.filter(e=>e.name.toLowerCase().includes(ej.busqueda.toLowerCase())).slice(0,4) : [];
                return (
                  <div key={"scan-miss-"+(ej.nombre||"ej")+"-"+i} style={{background:bgCard,border:"1px solid #243040",borderRadius:12,padding:12,marginBottom:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                      <div>
                        <div style={{fontSize:15,fontWeight:800,color:"#8B9AB2"}}>(msg("Detectado", "Detected"))+": \""+ej.nombre+"\""</div>
                        <div style={{fontSize:11,color:textMuted,marginTop:4}}>{ej.series||"?"} series · {ej.reps||"?"} reps</div>
                      </div>
                      <span style={{background:"#2563EB22",color:"#8B9AB2",border:"1px solid #243040",borderRadius:6,padding:"2px 7px",fontSize:11,fontWeight:700,flexShrink:0,marginLeft:8}}>SIN MATCH</span>
                    </div>
                    <div style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:.8,marginBottom:8}}>BUSCAR EN BIBLIOTECA</div>
                    <input style={inpS} placeholder={msg("Escribi el nombre correcto...", "Type the correct name...")} value={ej.busqueda||""} onChange={e=>buscarEnBib(i,e.target.value)}/>
                    {resBib.length>0&&(
                      <div style={{background:bg,border:"1px solid "+border,borderRadius:12,overflow:"hidden",marginTop:8}}>
                        {resBib.map(ex=>(
                          <div key={ex.id} onClick={()=>seleccionarMatch(i,ex)} style={{padding:"8px 12px",borderBottom:"1px solid "+(darkMode?"#2D4057":"#2D4057"),cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
                            <div style={{flex:1}}>
                              <div style={{fontSize:13,fontWeight:800}}>{ex.name}</div>
                              <div style={{fontSize:11,color:textMuted}}>{ex.pattern} · {ex.muscle}</div>
                            </div>
                            <span style={{color:"#22C55E",fontSize:15}}>✓</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {ej.busqueda?.length>=2&&resBib.length===0&&(
                      <div style={{fontSize:13,color:textMuted,textAlign:"center",padding:"8px 0"}}>{msg("Sin resultados — agregalo abajo", "No results — add it below")}</div>
                    )}
                    <div style={{fontSize:11,color:textMuted,textAlign:"center",margin:"8px 0 7px"}}>— o si no esta en biblioteca —</div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>agregarAutoEx(i)} style={{flex:1,padding:"8px",background:green,color:darkMode?"#fff":"#fff",border:"none",borderRadius:8,fontFamily:"inherit",fontSize:13,fontWeight:700,cursor:"pointer"}}>⚡ AUTO</button>
                      <button style={{flex:1,padding:"8px",background:_dm?"#162234":"#E2E8F0",color:textMuted,border:"1px solid "+border,borderRadius:8,fontFamily:"inherit",fontSize:13,fontWeight:700,cursor:"pointer"}} onClick={()=>toast2("Ir a Biblioteca > + Nuevo para agregarlo manualmente")}>✏️ MANUAL</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {}
          <div style={{marginTop:16,marginBottom:8}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>{msg("Asignar a alumno", "Assign to athlete")} <span style={{color:textMuted,fontWeight:400}}>(opcional)</span></div>
            {alumnos.map(a=>(
              <div key={a.id} onClick={()=>setAlumnoSel(alumnoSel===a.id?null:a.id)} style={{background:bg,border:"2px solid "+(alumnoSel===a.id?"#2563EB":"#2D4057"),borderRadius:12,padding:"8px 12px",marginBottom:8,display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                <div style={{width:32,height:32,background:"#2563EB22",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#2563EB",flexShrink:0}}>{a.nombre?.[0]}</div>
                <div style={{flex:1,fontSize:15,fontWeight:700}}>{a.nombre}</div>
                <div style={{width:18,height:18,borderRadius:"50%",border:"2px solid "+(alumnoSel===a.id?"#2563EB":"#2D4057"),background:alumnoSel===a.id?"#2563EB":"transparent"}}/>
              </div>
            ))}
          </div>

          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button onClick={()=>setPaso(1)} style={{flex:1,padding:"8px",background:_dm?"#162234":"#E2E8F0",color:textMuted,border:"1px solid "+border,borderRadius:12,fontFamily:"inherit",fontSize:15,fontWeight:700,cursor:"pointer"}}>← Volver</button>
            <button onClick={guardarRutina} style={{flex:2,padding:"12px",background:"#2563EB",color:"#fff",border:"none",borderRadius:12,fontFamily:"inherit",fontSize:15,fontWeight:700,cursor:"pointer"}}>GUARDAR RUTINA →</button>
          </div>
        </div>
      )}
      {paso===4&&(
        <div style={{textAlign:"center",paddingTop:30}}>
          <div style={{fontSize:48,marginBottom:8}}><Ic name="check-circle" size={40} color="#22C55E"/></div>
          <div style={{fontSize:22,fontWeight:900,color:"#22C55E",marginBottom:4}}>Rutina creada!</div>
          <div style={{fontSize:15,color:textMuted,marginBottom:24}}>{nombreRutina}</div>
          <div style={{background:"#22c55e15",border:"1px solid #22c55e33",borderRadius:12,padding:16,marginBottom:24,display:"flex",justifyContent:"space-around"}}>
            <div><div style={{fontSize:22,fontWeight:900,color:"#22C55E"}}>{resultado?.ejercicios?.length||0}</div><div style={{fontSize:11,color:textMuted}}>ejercicios</div></div>
            <div><div style={{fontSize:22,fontWeight:900,color:"#2563EB"}}>📷</div><div style={{fontSize:11,color:textMuted}}>Escaneada</div></div>
            {alumnoSel&&<div><div style={{fontSize:22,fontWeight:900,color:"#2563EB"}}>✓</div><div style={{fontSize:11,color:textMuted}}>Asignada</div></div>}
          </div>
          <button onClick={()=>{setPaso(1);setResultado(null);setAlumnoSel(null);}} style={{width:"100%",padding:12,background:_dm?"#162234":"#E2E8F0",color:textMuted,border:"1px solid "+border,borderRadius:12,fontFamily:"inherit",fontSize:15,fontWeight:700,cursor:"pointer"}}>
            Escanear otra rutina
          </button>
        </div>
      )}
    </div>
  );
}

/*
  FLUJO COMPLETO:
  ─────────────────────────────────────────────────
  Paso 0 → Landing (splash)
  Paso 1 → Rol (entrenador / atleta)
  Paso 2 → Nombre (TODOS)
  Paso 3 → Alumnos (SOLO entrenador) ← condicional
  Paso 4 → Final / dashboard preview
  ─────────────────────────────────────────────────
  Entrenador: 0 → 1 → 2 → 3 → 4
  Atleta:     0 → 1 → 2 → 4  (salta paso 3)
*/

export default GymApp;
