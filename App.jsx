import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { PATS, EX, VIDEOS, IMGS } from './lib/exerciseStaticData.js';
import {
  cloneRoutineDay,
  exerciseMatchesLibraryFilter,
  getRutinaExerciseIdsForCleanup,
  sessionBelongsToRoutineForCleanup,
  sessionBelongsToRoutineWeekForCleanup,
  uid,
} from './lib/appPureHelpers.js';
import { Ic } from './components/Ic.jsx';
import DuplicateDayModal from './components/routines/DuplicateDayModal.jsx';
import NewRoutineModal from './components/routines/NewRoutineModal.jsx';
import { WorkoutScreen } from './components/WorkoutScreen.jsx';
import { ChatFlotante } from './components/ChatFlotante.jsx';
import AlumnoRestTimerBar from './components/student/AlumnoRestTimerBar.jsx';
import StudentMainView from './components/student/StudentMainView.jsx';
import { useAlumnos } from './hooks/useAlumnos.js';
import { useAppShellUIState } from './hooks/useAppShellUIState.js';
import { useCoachUIState } from './hooks/useCoachUIState.js';
import { useStudentUIState } from './hooks/useStudentUIState.js';
import { useStudentHeaderShellMeasurement } from './hooks/useStudentHeaderShellMeasurement.js';
import { useAlumnoPlanHeaderScrollController } from './hooks/useAlumnoPlanHeaderScrollController.js';
import {
  BIB_MUSCLE_OPTIONS,
  BIB_MUSCLE_ORDER,
  bibMuscleFilterHaystack,
  cleanActiveCoachAlumnos,
  formatBibMuscleDisplay,
  isValidUuid,
} from './lib/appHelpers.js';
import { getYTVideoId } from './lib/getYTVideoId.js';
import { createPortal } from 'react-dom';
import { resolveExerciseTitle, resolveVideoUrl, normalizeLibraryExercise, pickVideoUrl, isValidHttpUrlString, sanitizeRoutineDaysForWrite, sanitizeExerciseSnapshotForWrite } from './lib/exerciseResolve.js';
import { fmt, fmtP } from './lib/timeFormat.js';
import { getAppThemeTokens } from './lib/appThemeTokens.js';
import { shareSessionSummaryImageUi } from './lib/sessionSummaryShare.js';
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
import CoachConfirmDialog from './components/coach/CoachConfirmDialog.jsx';
import { getCoachDialogModalConfig } from './components/coach/coachDialogConfig.js';
import CoachEditStudentModal from './components/coach/CoachEditStudentModal.jsx';
import CoachSectionRenderer from './components/coach/CoachSectionRenderer.jsx';
import { coachInitialsFromFullName } from './components/coachUiScale.js';
import { useDesktopMin1024 } from './components/DesktopSidebar.jsx';
import AppShellModals from './components/AppShellModals.jsx';
import IronTrackAppIcon from './components/IronTrackAppIcon.jsx';
import IronTrackSplash from './components/IronTrackSplash.jsx';
import { checkTrainingReminderTick } from './components/student/RecordatoriosPanel.jsx';
import AlumnoUserMenu from './components/student/AlumnoUserMenu.jsx';
import FotosSlider from './components/student-progress/FotosSlider.jsx';
import GraficoProgreso from './components/student-progress/GraficoProgreso.jsx';
import { CurrentWorkoutHero } from './components/student-plan/CurrentWorkoutHero.jsx';
import { WeeklyPlanDayCard } from './components/student-plan/WeeklyPlanDayCard.jsx';
import CompletedTodayBanner from './components/student-plan/CompletedTodayBanner.jsx';
import StudentNoRoutinesEmptyState from './components/student-plan/StudentNoRoutinesEmptyState.jsx';
import RoutinePdfDownloadButton from './components/student-plan/RoutinePdfDownloadButton.jsx';
import StudentWeeklyProgressCard from './components/student-plan/StudentWeeklyProgressCard.jsx';
import StudentPlanMiniHeader from './components/student-plan/StudentPlanMiniHeader.jsx';
import StudentExerciseSparkline from './components/student-plan/StudentExerciseSparkline.jsx';
import StudentPlanExerciseRows from './components/student-plan/StudentPlanExerciseRows.jsx';
import { ExerciseVideoPlayButton } from './components/ExerciseVideoPlayButton.jsx';
import WorkoutSessionSummary from './components/workout/WorkoutSessionSummary.jsx';
import AppExerciseModals from './components/AppExerciseModals.jsx';
import AddExerciseModal from './components/modals/AddExerciseModal.jsx';
import CoachChatModal from './components/modals/CoachChatModal.jsx';
import PaymentInfoModal from './components/modals/PaymentInfoModal.jsx';
import {
  estimateDayMinutes,
  countExercisesWithLogToday,
  buildStudentDayPresentation,
} from './components/student-plan/studentPlanHelpers.js';
import LoginModalHost from './components/LoginModalHost.jsx';
import VideoModal from './components/ui/VideoModal.jsx';
import PRCelebrationOverlay from './components/ui/PRCelebrationOverlay.jsx';
import ToastBanner from './components/ui/ToastBanner.jsx';
import AppGlobalStyles from './components/layout/AppGlobalStyles.jsx';
import AppMainScroll from './components/layout/AppMainScroll.jsx';
import GlobalBottomNav from './components/layout/GlobalBottomNav.jsx';
import AppTopBar from './components/layout/AppTopBar.jsx';
import CoachDesktopShellFrame from './components/layout/CoachDesktopShellFrame.jsx';
import OfflineSyncBanner from './components/layout/OfflineSyncBanner.jsx';
import { applyItPrefsToDocument } from './components/settings/SettingsPage.jsx';
import { supabase } from './lib/supabaseClient.js';
import { clearIronTrackStorageForNewLogin, clearAllIronTrackPrefixedKeys } from './lib/irontrackLocalStorage.js';
import { irontrackMsg, localeForSort, pickExerciseName } from './lib/irontrackMsg.js';
import { selectCoachStudentListState } from './lib/coachStudentListSelectors.js';
import { buildCoachGlobalSearchData } from './lib/coachGlobalSearchSelectors.js';
import { selectAppShellLayoutState } from './lib/appShellLayoutSelectors.js';
import {
  buildRutinaInsertBody,
  cleanRutinaWriteBody,
  dedupeRutinas,
  getAssignmentRoutineParts,
  getRutinaAsignadaAlumno as getRutinaAsignadaAlumnoFromStore,
  getRutinaAlumnoId,
  getRutinaBadgeConfig,
  mergeRutinasAsignadas,
  normalizeRutinaLocalForAssignment,
  resolveAlumnoId,
  resolveEntrenadorId,
} from './lib/routineStore.js';
import { getActiveStudentRoutinePosition } from './lib/studentWeeklyProgress.js';
import { loadCoachRutinas } from './lib/coachDataLoaders.js';
import {
  prepareExerciseHistoryModalData,
} from './lib/exerciseHistory.js';
import {
  buildExerciseSetRecord,
  buildPendingProgressItem,
  buildProgressPayload,
  calculateNewWeightPR,
  formatWorkoutSetLabel,
  updateExerciseKgInRoutines,
  updateExerciseProgressRecord,
} from './lib/workoutSession.js';
import { IronTrackI18nProvider, useIronTrackI18n } from './contexts/IronTrackI18nContext.jsx';
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

function normalizeExerciseNameKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function mapCustomExerciseRow(row) {
  var rawName = row && row.name != null && row.name !== "" ? row.name : (row && row.nombre != null ? row.nombre : "");
  var rawEn = row && row.name_en != null && row.name_en !== "" ? row.name_en : (row && row.nameEn != null ? row.nameEn : rawName);
  var rawVu = row ? String(row.video_url || row.youtube || row.youtube_url || row.videoUrl || "").trim() : "";
  var vuStore = rawVu && isValidHttpUrlString(rawVu) ? rawVu : null;
  var isCust = row && row.is_custom != null ? !!row.is_custom : true;
  return sanitizeExerciseSnapshotForWrite({
    id: row && row.id,
    name: rawName,
    nameEn: rawEn || rawName,
    pattern: row && row.pattern ? row.pattern : "empuje",
    muscle: row && row.muscle ? row.muscle : "",
    equip: row && row.equip ? row.equip : "Libre",
    video_url: vuStore,
    isCustom: isCust,
  }, { silent: true });
}

function buildCustomExerciseDbPayload(exercise, entrenadorId) {
  var clean = sanitizeExerciseSnapshotForWrite(exercise || {}, { silent: true });
  return {
    id: clean.id,
    entrenador_id: entrenadorId,
    name: clean.name,
    name_en: clean.nameEn || clean.name,
    pattern: clean.pattern || "empuje",
    muscle: clean.muscle || "",
    equip: clean.equip || "Libre",
    video_url: clean.video_url != null ? clean.video_url : null,
    is_custom: true,
  };
}

function readLocalCustomExercisesForMigration() {
  if (typeof localStorage === "undefined") return [];
  var out = [];
  ["it_cex", "it_customEx"].forEach(function (key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      parsed.forEach(function (e) {
        var clean = sanitizeExerciseSnapshotForWrite({
          ...e,
          isCustom: e && e.isCustom != null ? e.isCustom : true,
        }, { silent: true });
        if (clean && clean.name) out.push(clean);
      });
    } catch (e) {}
  });
  var seen = {};
  return out.filter(function (e) {
    var key = normalizeExerciseNameKey(e.name || e.nameEn);
    if (!key || seen[key]) return false;
    seen[key] = true;
    return true;
  });
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
  createAlumno: async (alumnoData) => {
    const { data, error } = await supabase.from("alumnos").insert([alumnoData]).select();
    if (error) console.error("[createAlumno]", error);
    return { data: data || [], error };
  },
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
    if (error) { console.error("[rutinas SELECT BY ALUMNOS ERROR]", error); return null; }
    return data || [];
  },
  createRutina: async (data) => {
    const body = cleanRutinaWriteBody(data);
    const { data: created, error } = await supabase.from("rutinas").insert([body]).select();
    if (error) { console.error("[rutinas INSERT ERROR]", error); return null; }
    return created || [];
  },
  updateRutina: async (id, data) => {
    const body = cleanRutinaWriteBody(data);
    const { data: updated, error } = await supabase.from("rutinas").update(body).eq("id", id).select();
    if (error) { console.error("[rutinas UPDATE ERROR]", error); return null; }
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
  deleteSesionesByAlumnoRutina: async (alumnoId, rutinaId, rutinaNombre) => {
    var aid = String(alumnoId);
    var rid = rutinaId != null && rutinaId !== "" ? String(rutinaId) : "";
    var rname = rutinaNombre != null && rutinaNombre !== "" ? String(rutinaNombre) : "";
    if (rid) {
      const { error } = await supabase.from("sesiones").delete().eq("alumno_id", aid).eq("rutina_id", rid);
      if (error) throw error;
    }
    if (rid) {
      const { error } = await supabase.from("sesiones").delete().eq("alumno_id", aid).is("rutina_id", null);
      if (error) throw error;
    }
    if (rname) {
      var q = supabase.from("sesiones").delete().eq("alumno_id", aid).eq("rutina_nombre", rname);
      if (rid) q = q.is("rutina_id", null);
      const { error } = await q;
      if (error) throw error;
    }
    if (!rid && !rname) {
      const { error } = await supabase.from("sesiones").delete().eq("alumno_id", aid);
      if (error) throw error;
    }
    return true;
  },
  deleteSesionesByAlumnoRutinaSemana: async (alumnoId, rutinaId, rutinaNombre, semana) => {
    var aid = String(alumnoId);
    var rid = rutinaId != null && rutinaId !== "" ? String(rutinaId) : "";
    var rname = rutinaNombre != null && rutinaNombre !== "" ? String(rutinaNombre) : "";
    var week = Number(semana);
    if (!Number.isFinite(week) || week <= 0) throw new Error("semana requerida");
    if (rid) {
      const { error } = await supabase.from("sesiones").delete().eq("alumno_id", aid).eq("rutina_id", rid).eq("semana", week);
      if (error) throw error;
    }
    if (rname) {
      var q = supabase.from("sesiones").delete().eq("alumno_id", aid).eq("rutina_nombre", rname).eq("semana", week);
      if (rid) q = q.is("rutina_id", null);
      const { error } = await q;
      if (error) throw error;
    }
    if (!rid && !rname) {
      const { error } = await supabase.from("sesiones").delete().eq("alumno_id", aid).eq("semana", week);
      if (error) throw error;
    }
    return true;
  },

  getSesionesByAlumnoRutinaSemana: async (alumnoId, rutinaId, rutinaNombre, semana) => {
    var aid = String(alumnoId);
    var rid = rutinaId != null && rutinaId !== "" ? String(rutinaId) : "";
    var rname = rutinaNombre != null && rutinaNombre !== "" ? String(rutinaNombre) : "";
    var week = Number(semana);
    if (!Number.isFinite(week) || week <= 0) return [];
    var rows = [];
    if (rid) {
      const { data, error } = await supabase.from("sesiones").select("*").eq("alumno_id", aid).eq("rutina_id", rid).eq("semana", week);
      if (error) throw error;
      rows = rows.concat(data || []);
    }
    if (rname) {
      var q = supabase.from("sesiones").select("*").eq("alumno_id", aid).eq("rutina_nombre", rname).eq("semana", week);
      if (rid) q = q.is("rutina_id", null);
      const { data, error } = await q;
      if (error) throw error;
      rows = rows.concat(data || []);
    }
    if (!rid && !rname) {
      const { data, error } = await supabase.from("sesiones").select("*").eq("alumno_id", aid).eq("semana", week);
      if (error) throw error;
      rows = rows.concat(data || []);
    }
    return rows;
  },
  deleteProgresoByAlumnoEjercicios: async (alumnoId, ejercicioIds) => {

    var ids = Array.from(new Set((ejercicioIds || []).filter(Boolean).map(String)));
    if (!ids.length) return true;
    const { error } = await supabase.from("progreso").delete().eq("alumno_id", String(alumnoId)).in("ejercicio_id", ids);
    if (error) throw error;
    return true;
  },
  deleteProgresoByAlumnoEjerciciosFechas: async (alumnoId, ejercicioIds, fechas) => {
    var ids = Array.from(new Set((ejercicioIds || []).filter(Boolean).map(String)));
    var fs = Array.from(new Set((fechas || []).filter(Boolean).map(String)));
    if (!ids.length || !fs.length) return true;
    const { error } = await supabase.from("progreso").delete().eq("alumno_id", String(alumnoId)).in("ejercicio_id", ids).in("fecha", fs);
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
  getMensajesConversaciones: async (alumnoIds) => {
    var ids = Array.from(new Set((alumnoIds || []).filter(Boolean).map(String)));
    if (!ids.length) return [];
    const { data, error } = await supabase.from("mensajes").select("*").in("alumno_id", ids).order("created_at", { ascending: false }).limit(1000);
    if (error) { console.error("[mensajes conversaciones SELECT ERROR]", error); return null; }
    return data || [];
  },
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
  getVideoOverrides: (entId) => sbFetch("video_overrides?entrenador_id=eq."+encodeURIComponent(entId||"")+"&select=ejercicio_id,youtube_url"),
  getCustomEx: async (entId) => {
    const { data, error } = await supabase
      .from("ejercicios_custom")
      .select("*")
      .eq("entrenador_id", String(entId || getStoredEntrenadorId()));
    if (error) throw error;
    return data || [];
  },
  addCustomEx: async (data) => {
    const { data: row, error } = await supabase.from("ejercicios_custom").insert(data).select().single();
    if (error) throw error;
    return row;
  },
  deleteCustomEx: async (id, entId) => {
    if (!entId) { console.error('deleteCustomEx called without entId — aborting'); return; }
    var q = supabase.from("ejercicios_custom").delete().eq("id", id);
    if (entId) q = q.eq("entrenador_id", String(entId));
    const { error } = await q;
    if (error) throw error;
    return true;
  },
  updateCustomEx: async (id, data, entId) => {
    if (!entId) { console.error('updateCustomEx called without entId — aborting'); return; }
    var q = supabase.from("ejercicios_custom").update(data).eq("id", id);
    if (entId) q = q.eq("entrenador_id", String(entId));
    const { data: rows, error } = await q.select();
    if (error) throw error;
    return rows || [];
  },
  setVideoOverride: async (ejercicioId, url) => {
    try { await sbFetch("video_overrides?ejercicio_id=eq."+ejercicioId, "DELETE"); } catch(e){}
    try { return await sbFetch("video_overrides", "POST", {ejercicio_id:ejercicioId, youtube_url:url, entrenador_id:supabaseSessionUserId || sessionData?.entrenadorId}); } catch(e){ return null; }
  },
  getEntrenador: (id) => sbFetch("entrenadores?id=eq."+encodeURIComponent(id||"")+"&select=*"),
  updateEntrenador: (id, data) => {
    var clean = {};
    if (data && typeof data === "object") {
      Object.keys(data).forEach(function(k){ if(data[k] !== undefined) clean[k] = data[k]; });
    }
    return sbFetch("entrenadores?id=eq."+encodeURIComponent(id||""), "PATCH", clean);
  },
};

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
  const [showPassword, setShowPassword] = useState(false);
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
  } = useAlumnos({ sb, entrenadorId: supabaseSessionUserId || sessionData?.entrenadorId || null });
  const {
    registrosSubTab, setRegistrosSubTab,
    sugsOpen, setSugsOpen,
    filtroRut, setFiltroRut,
    bibOpenNewExerciseTick, setBibOpenNewExerciseTick,
    coachAlumnosSearch, setCoachAlumnosSearch,
    coachAlumnosFilter, setCoachAlumnosFilter,
    coachRoutineDiaIdx, setCoachRoutineDiaIdx,
    coachDiaSecsOpen, setCoachDiaSecsOpen,
    coachCardMenuId, setCoachCardMenuId,
    coachRutinaMenuOpen, setCoachRutinaMenuOpen,
    mobileDrawerOpen, setMobileDrawerOpen,
  } = useCoachUIState();
  const {
    expandedPlanDay, setExpandedPlanDay,
    userMenuOpen, setUserMenuOpen,
    pwaInstallTipOpen, setPwaInstallTipOpen,
  } = useStudentUIState();
  const [rutinasSB, setRutinasSB] = useState([]);
  const [sesionesGlobales, setSesionesGlobales] = useState([]);
  const [progresoGlobal, setProgresoGlobal] = useState({});
  const [mensajesEntrenadorPendientes, setMensajesEntrenadorPendientes] = useState([]);
  const [sugerencias, setSugerencias] = useState({});
  const [rutinasSBEntrenador, setRutinasSBEntrenador] = useState([]);
  const [rutinasLoaded, setRutinasLoaded] = useState(false);
  /** Incrementar para abrir la pestaña «+ Nuevo» en GestionBiblioteca (ej. desde menú Crear del dashboard). */

  

  const alumnosActivosLimpios = useMemo(function () {
    return cleanActiveCoachAlumnos(alumnos, supabaseSessionUserId || sessionData?.entrenadorId);
  }, [alumnos, supabaseSessionUserId, sessionData?.entrenadorId]);

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
    return getRutinaAsignadaAlumnoFromStore(rutinasUnificadas, alumnoOrId);
  }, [rutinasUnificadas]);

  const cargarRutinasEntrenador = React.useCallback(async function (alumnosScope) {
    try {
      var loadedRutinas = await loadCoachRutinas({
        supabaseClient: supabase,
        sb: sb,
        alumnosScope: alumnosScope,
      });
      if (loadedRutinas.sessionError) {
        console.error("[RUTINAS INIT] getSession error", loadedRutinas.sessionError);
        return null;
      }
      var entrenadorId = loadedRutinas.entrenadorId;
      if (!entrenadorId) {
        console.warn("[RUTINAS INIT] sin session.user.id, reintentando luego");
        return null;
      }
      var result = loadedRutinas.result;
      var alumnoIds = loadedRutinas.alumnoIds || [];
      var mergedResult = loadedRutinas.mergedResult;
      if (Array.isArray(mergedResult) && mergedResult.length > 0) {
        setRutinasSBEntrenador(function (prev) {
          return mergeRutinasAsignadas(mergedResult, prev);
        });
        setRutinasLoaded(true);
        return mergedResult;
      }
      if (Array.isArray(result)) {
        console.warn("[RUTINAS INIT] query sin resultados");
        if (alumnoIds.length > 0 || Array.isArray(alumnosScope)) {
          setRutinasLoaded(true);
        }
        return result;
      }
      console.error("[rutinas entrenador] respuesta invalida");
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
        var sbAlumnos = await sb.getAlumnos(supabaseSessionUserId || sessionData?.entrenadorId);
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
        sbFetch('mensajes?alumno_id=in.(' + idsStr + ')&de_entrenador=eq.false&or=(leido.is.null,leido.eq.false)&select=*&order=created_at.desc&limit=200'),
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
      if(results[2] && Array.isArray(results[2])) setMensajesEntrenadorPendientes(results[2]);
    } catch(e) { console.error('[cargarSesionesGlobales]', e); }
  }, [alumnosActivosLimpios, ENTRENADOR_ID]);

  useEffect(function() {
    if(sessionData && sessionData.role==='entrenador') {
      var init = async function() {
        var rutinasPromise = cargarRutinasEntrenador();
        var sbAlumnos = cleanActiveCoachAlumnos(await sb.getAlumnos(supabaseSessionUserId || sessionData?.entrenadorId) || [], ENTRENADOR_ID);
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
  const {
    toast,
    toast2,
    settingsOpen,
    setSettingsOpen,
  } = useAppShellUIState();

  const [cargandoAlumno, setCargandoAlumno] = useState(() => {
    try {
      const item = localStorage.getItem('it_session');
      if (!item) return false;
      const sess = JSON.parse(item);
      return sess?.role === 'alumno';
    } catch(e) { return false; }
  });
  console.log('Initial cargandoAlumno:', cargandoAlumno);
  const [routines, setRoutines] = useState(() => { try{return JSON.parse(localStorage.getItem("it_rt")||"[]")}catch(e){return []} });
  const [progress, setProgress] = useState(() => { try{return JSON.parse(localStorage.getItem("it_pg")||"{}")}catch(e){return {}} });
  const [user, setUser] = useState(() => { try{return JSON.parse(localStorage.getItem("it_u")||"null")}catch(e){return null} });
  const [search, setSearch] = useState("");
  const [filterPat, setFilterPat] = useState(null);
  const [detailEx, setDetailEx] = useState(null);
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
    return dedupeRutinas([].concat(rutinasUnificadas || [], routines || []), { requireId: true });
  }, [rutinasUnificadas, routines]);

  const assignRoutineToAlumno = React.useCallback(async function ({ alumno, rutina, fecha, previousRoutine }) {
    var authSessionAssign = await getActiveSupabaseSession();
    if (!authSessionAssign) {
      throw new Error("Inicia sesion nuevamente para asignar rutinas");
    }

    var alumnoIdAssign = resolveAlumnoId(alumno);
    var entrenadorIdAssign = resolveEntrenadorId(authSessionAssign);
    if (!alumnoIdAssign || !entrenadorIdAssign || !rutina) {
      console.error("[assignRut] datos invalidos");
      throw new Error("Datos invalidos para asignar rutina");
    }
    if (!isValidUuid(alumnoIdAssign)) {
      console.error("[assignRut] alumno_id no es UUID valido");
      throw new Error("El alumno no tiene un ID valido");
    }
    if (!isValidUuid(entrenadorIdAssign)) {
      console.error("[assignRut] entrenador_id no es UUID valido");
      throw new Error("La sesion del entrenador no es valida");
    }

    var routinePartsAssign = getAssignmentRoutineParts(rutina);
    var nombreAssign = routinePartsAssign.nombre;
    var daysAssign = routinePartsAssign.days;
    if (!Array.isArray(daysAssign)) {
      console.error("[assignRut] days no es array");
      throw new Error("La rutina no tiene dias validos");
    }

    var body = buildRutinaInsertBody({
      alumno: alumno,
      alumnoId: alumnoIdAssign,
      entrenadorId: entrenadorIdAssign,
      rutina: rutina,
    });

    var insertResult = await supabase
      .from("rutinas")
      .insert([body])
      .select()
      .single();
    if (insertResult.error || !insertResult.data) {
      console.error("[assignRut INSERT ERROR]", insertResult.error || new Error("No se pudo crear la rutina asignada"));
      throw insertResult.error || new Error("No se pudo crear la rutina asignada");
    }

    var res = insertResult.data;
    var oldRutina = previousRoutine || getRutinaAsignadaAlumno(alumnoIdAssign);
    var oldRutinas = [];
    var seenOldRutinas = {};
    function addOldRutinaForReplace(r) {
      if (!r || r.id == null || String(r.id) === String(res.id)) return;
      var ridAlumno = getRutinaAlumnoId(r);
      if (ridAlumno == null || String(ridAlumno) !== String(alumnoIdAssign)) return;
      var key = String(r.id);
      if (seenOldRutinas[key]) return;
      seenOldRutinas[key] = true;
      oldRutinas.push(r);
    }
    addOldRutinaForReplace(previousRoutine);
    addOldRutinaForReplace(oldRutina);
    (rutinasUnificadas || []).forEach(addOldRutinaForReplace);
    var oldRutinaIds = {};
    if (oldRutinas.length > 0) {
      for (var oldIdx = 0; oldIdx < oldRutinas.length; oldIdx += 1) {
        try {
          await sb.deleteRutina(oldRutinas[oldIdx].id);
          oldRutinaIds[String(oldRutinas[oldIdx].id)] = true;
        } catch (eOldRutina) {
          console.error("[assignRut] error al quitar rutina anterior despues del insert", eOldRutina);
        }
      }
      setRutinasSB(function (prev) {
        return (prev || []).filter(function (x) {
          return !oldRutinaIds[String(x.id)];
        });
      });
      setRutinasSBEntrenador(function (prev) {
        return (prev || []).filter(function (x) {
          return !oldRutinaIds[String(x.id)];
        });
      });
    }

    setRutinasSB(function (prev) {
      return mergeRutinasAsignadas([res], prev);
    });
    setRutinasSBEntrenador(function (prev) {
      return mergeRutinasAsignadas([res], prev);
    });
    setRoutines(function (prev) {
      var prevList = Array.isArray(prev) ? prev : [];
      var localRutina = normalizeRutinaLocalForAssignment({
        rutinaDb: res,
        alumno: alumno,
        fallbackNombre: nombreAssign,
      });
      var replaced = false;
      var next = prevList
        .filter(function (r) {
          return !oldRutinaIds[String(r.id)];
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
  }, [getRutinaAsignadaAlumno, rutinasUnificadas, setRoutines]);
  const [dupDayModal, setDupDayModal] = useState(null); // {rId, dIdx, days}
  const [dupDayClosing, setDupDayClosing] = useState(false);
  const [chatModal, setChatModal] = useState(null); // {alumnoId, alumnoNombre}
  const [videoOverrides, setVideoOverrides] = useState({}); // {ejercicioId: url}
  /** Claves: id de EX (catálogo); p.ej. { sq: "empuje" } — persiste en localStorage `it_pattern_ov` */
  const [patternOverrides, setPatternOverrides] = useState({});
  const [videoModal, setVideoModal] = useState(null); // {url, nombre}
  const [editEx, setEditEx] = useState(null);
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
  const lastAppliedHeaderStateRef = useRef(null);
  const globalBottomNavRef = useRef(null);
  /** Actualizado cada render tras conocer tab/esAlumno: el scroll handler no debe depender de closure viejo. */
  const planScrollCtxRef = useRef({ alumnoPlan: false, headerCollapse: true });
  const [resumenSesion, setResumenSesion] = useState(null);
  const [chatOpenId, setChatOpenId] = useState(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileEdit, setProfileEdit] = useState({nombre:"",apellido:"",email:"",phone:"",avatarDataUrl:null});
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

  function toggleDupDayDestination(di) {
    setDupDayModal(function (prev) {
      var sel = prev.selected.indexOf(di) !== -1
        ? prev.selected.filter(function (x) { return x !== di; })
        : [...prev.selected, di];
      return { ...prev, selected: sel };
    });
  }

  function confirmDuplicateDay() {
    var src = dupDayModal.sourceDay;
    var originalDays = Array.isArray(dupDayModal.days) ? dupDayModal.days : [];
    if (!src || !Array.isArray(originalDays) || !originalDays[dupDayModal.dIdx]) { toast2(msg("No se pudo duplicar el día", "Could not duplicate day")); return; }
    if (!Array.isArray(src.warmup) && !Array.isArray(src.exercises)) { toast2(msg("No se pudo duplicar el día", "Could not duplicate day")); return; }
    var appendNewDay = dupDayModal.selected.length === 0 && originalDays.length === 1;
    if (dupDayModal.selected.length === 0 && !appendNewDay) { toast2(msg("Seleccioná al menos un día", "Select at least one day")); return; }
    var sel = dupDayModal.selected;
    setRoutines(function (p) {
      return p.map(function (rr) {
        if (rr.id !== dupDayModal.rId) return rr;
        var rrDays = Array.isArray(rr.days) ? rr.days : [];
        if (appendNewDay) return { ...rr, days: rrDays.concat([cloneRoutineDay(src, "Día " + (rrDays.length + 1))]) };
        return {
          ...rr, days: rrDays.map(function (dd, ddi) {
            if (sel.indexOf(ddi) === -1) return dd;
            return { ...cloneRoutineDay(src, dd?.label || ("Día " + (ddi + 1))) };
          })
        };
      });
    });
    toast2(appendNewDay ? msg("Día duplicado ✓", "Day duplicated ✓") : ((msg("Duplicado a ", "Duplicated to ")) + sel.map(function (i) { return dupDayModal.days[i]?.label || ("Día " + (i + 1)); }).join(", ") + " ✓"));
    closeDupDayModalAnimated();
  }
  useAlumnoPlanHeaderScrollController({
    scrollRef: scrollRef,
    scrollRafIdRef: scrollRafIdRef,
    tickingRef: tickingRef,
    planScrollCtxRef: planScrollCtxRef,
    lastScrollY: lastScrollY,
    alumnoAppHeaderRef: alumnoAppHeaderRef,
    lastAppliedHeaderStateRef: lastAppliedHeaderStateRef,
    alumnoTopBarSpacerRef: alumnoTopBarSpacerRef,
    headerCollapsedRef: headerCollapsedRef,
    applyAlumnoHeaderLayerStyles: applyAlumnoHeaderLayerStyles,
    globalBottomNavRef: globalBottomNavRef,
  });

  /** Alumno / pestaña plan: fuerza expansión visible (sin capa mini por scroll/refs viejos). */
  useLayoutEffect(
    function () {
      if (!esAlumno || tab !== "plan") return;
      headerCollapsedRef.current = false;
      applyAlumnoHeaderLayerStyles(false);
    },
    [esAlumno, tab]
  );

  /** Al cambiar de tab, asegurar que el bottom nav siempre sea visible. */
  useLayoutEffect(
    function () {
      var nav = globalBottomNavRef.current;
      if (!nav) return;
      nav.style.transform = "";
      nav.style.opacity = "";
      nav.style.transition = "";
      nav.style.pointerEvents = "";
    },
    [tab]
  );

  /** Después de login/logout (localStorage ya actualizado): sincroniza sesión y datos persistidos sin recargar. */
  function syncStateWithLocalStorage() {
    var sess = null;
    try { sess = JSON.parse(localStorage.getItem("it_session") || "null"); } catch (e) { sess = null; }
    setSessionData(sess);
    if (sess?.role === "alumno") setCargandoAlumno(true);
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
    setMensajesEntrenadorPendientes([]);
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
    const goOnline = async () => {
      setIsOnline(true);
      // Sincronizar sets pendientes
      let pending = [];
      try {
        pending = JSON.parse(localStorage.getItem('it_pending_sync')||'[]');
      } catch(e) {
        console.warn('[offline sync] it_pending_sync corrupto; se conserva sin sincronizar', e);
        return;
      }
      if(!Array.isArray(pending)) {
        console.warn('[offline sync] it_pending_sync no es una lista; se conserva sin sincronizar');
        return;
      }
      if(pending.length === 0) return;
      const alumnoIdSync = (()=>{try{return JSON.parse(localStorage.getItem("it_session")||"null")?.alumnoId}catch(e){return null}})();
      if(!alumnoIdSync) return;
      const results = await Promise.allSettled(pending.map(item => {
        return Promise.resolve().then(function() {
          return sb.addProgreso(buildProgressPayload(alumnoIdSync, item.exId, item.kg, item.reps, item.note, item.date, item.semana));
        });
      }));
      const failed = pending.filter(function(item, idx) {
        var res = results[idx];
        return !res || res.status !== 'fulfilled' || res.value == null;
      });
      if(failed.length > 0) {
        try{localStorage.setItem('it_pending_sync', JSON.stringify(failed));}catch(e){}
      } else {
        localStorage.removeItem('it_pending_sync');
      }
      setPendingSync(failed);
      const syncedCount = pending.length - failed.length;
      if(syncedCount > 0) toast2(syncedCount+' set'+(syncedCount>1?'s':'')+' sincronizados ✓');
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
    if (typeof window === "undefined") return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then(function (regs) {
          regs.forEach(function (reg) { reg.unregister(); });
        })
        .catch(function (err) { console.error("SW cleanup error:", err); });
    }
    if ("caches" in window) {
      window.caches.keys()
        .then(function (keys) {
          keys.forEach(function (key) { window.caches.delete(key); });
        })
        .catch(function (err) { console.error("Cache cleanup error:", err); });
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
              setRoutines([{...ruts[0].datos, datos: ruts[0].datos || {}, alumnoId: decoded.alumnoId, alumno_id: decoded.alumnoId, id: ruts[0].id}]);
              const ses = await sb.getSesiones(decoded.alumnoId);
              setSesiones(ses || []);
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
    console.log('useEffect fired, alumnoId:', sessionData?.alumnoId);
    if(!readOnly && sessionData?.role==="alumno" && sessionData?.alumnoId) {
      setCargandoAlumno(true);
      setSesiones([]); // FIX B: flush stale sesiones from a previous student before fetching
      const safetyTimeout = setTimeout(() => {
        console.log('TIMEOUT fired at 1586');
        console.warn('Safety timeout: forcing cargandoAlumno to false');
        setCargandoAlumno(false);
      }, 8000);
      (async () => {
        try {
          // FIX A: fetch rutinas and sesiones in parallel
          const [rutsRaw, ses] = await Promise.all([
            sb.getRutinas(sessionData.alumnoId),
            sb.getSesiones(sessionData.alumnoId),
          ]);
          const ruts = (rutsRaw || []).slice().sort(function (a, b) {
            return new Date(b.created_at || 0) - new Date(a.created_at || 0);
          }).slice(0, 1);
          if(ruts && ruts[0] && ruts[0].datos) {
            const rSB = ruts[0];
            const rutLocal = {
              id: rSB.id,
              name: rSB.nombre || "Rutina",
              days: rSB.datos?.days || [],
              datos: rSB.datos || {},
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
          setSesiones(ses || []);
          sb.getNota(sessionData.alumnoId).then(function(res) {
            if(res && res[0]) setNotaDia(res[0].contenido||res[0].texto||"");
          }).catch(function(){});
        } catch(e) { console.error('[cargarRutinaAlumno]', e); }
        finally {
          console.log('FINALLY fired at 1623, fetch completed normally');
          clearTimeout(safetyTimeout);
          setCargandoAlumno(false);
        }
      })();
    } else if (sessionData?.role !== "alumno") {
      console.log('Line 1627 fired — sessionData.role was:', sessionData?.role);
      setCargandoAlumno(false);
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
    // Los ejercicios custom se cargan en un efecto separado, atado al auth user real.
  }, []);

  useEffect(function () {
    if (readOnly || sessionData?.role !== "entrenador") return;
    var coachId = supabaseSessionUserId || sessionData?.entrenadorId;
    if (!coachId || coachId === "entrenador_principal") return;
    var cancelled = false;

    (async function () {
      try {
        var remoteRows = await sb.getCustomEx(coachId);
        var remote = (remoteRows || []).map(mapCustomExerciseRow).filter(function (e) { return !!(e && e.name); });
        var names = {};
        var staticNames = {};
        remote.forEach(function (e) { names[normalizeExerciseNameKey(e.name)] = true; });
        EX.forEach(function (e) { staticNames[normalizeExerciseNameKey(e.name)] = true; });

        var migrationKey = "it_cex_migrated_" + coachId;
        var migrationDone = false;
        try { migrationDone = localStorage.getItem(migrationKey) === "1"; } catch (e) {}
        var inserted = [];

        if (!migrationDone) {
          var localItems = readLocalCustomExercisesForMigration();
          var toInsert = localItems.filter(function (e) {
            var key = normalizeExerciseNameKey(e.name || e.nameEn);
            return key && !names[key] && !staticNames[key];
          });
          for (var i = 0; i < toInsert.length; i++) {
            var item = toInsert[i];
            var payload = buildCustomExerciseDbPayload({
              ...item,
              id: item.id || ("custom_" + Date.now() + "_" + i),
            }, coachId);
            var row = await sb.addCustomEx(payload);
            var mapped = mapCustomExerciseRow(row || payload);
            inserted.push(mapped);
            names[normalizeExerciseNameKey(mapped.name)] = true;
          }
          try { localStorage.setItem(migrationKey, "1"); } catch (e) {}
          if (toInsert.length > 0) {
            console.info("[customExercises DEBUG] migrados a Supabase", { count: toInsert.length, entrenador_id: coachId });
          }
        }

        if (cancelled) return;
        setCustomEx(function () {
          var merged = [];
          var seen = {};
          remote.concat(inserted).forEach(function (e) {
            var key = normalizeExerciseNameKey(e.name || e.nameEn);
            if (!key || seen[key] || staticNames[key]) return;
            seen[key] = true;
            merged.push(e);
          });
          return merged;
        });
      } catch (e) {
        console.error("[customExercises DEBUG] error cargando/migrando", e);
        if (!cancelled) toast2(msg("No se pudieron cargar los ejercicios personalizados desde Supabase", "Could not load custom exercises from Supabase"));
      }
    })();

    return function () {
      cancelled = true;
    };
  }, [readOnly, sessionData?.role, sessionData?.entrenadorId, supabaseSessionUserId, msg, toast2]);

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

  const {
    coachAlumnoCategoria,
    coachAlumnosCounts,
    coachAlumnosListaFiltrada,
  } = React.useMemo(function () {
    return selectCoachStudentListState({
      alumnosActivosLimpios: alumnosActivosLimpios,
      rutinasUnificadas: rutinasUnificadas,
      sesionesGlobalesLimpias: sesionesGlobalesLimpias,
      progresoGlobalLimpio: progresoGlobalLimpio,
      coachAlumnosSearch: coachAlumnosSearch,
      coachAlumnosFilter: coachAlumnosFilter,
      nowMs: Date.now(),
    });
  }, [alumnosActivosLimpios, rutinasUnificadas, sesionesGlobalesLimpias, progresoGlobalLimpio, coachAlumnosSearch, coachAlumnosFilter]);

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

  const sessionDataRef = React.useRef(sessionData);React.useEffect(()=>{sessionDataRef.current=sessionData;},[sessionData]);const logSet = (exId, kg, reps, note, rpe, weekOverride) => {
    const d = new Date().toLocaleDateString("es-AR");
    const weekForSet = Number.isFinite(Number(weekOverride)) ? Number(weekOverride) : currentWeek;
    const newSet = buildExerciseSetRecord(kg, reps, d, weekForSet, note, rpe);
    setProgress(prev=>{
      const ex = updateExerciseProgressRecord(prev[exId], newSet);
      return {...prev,[exId]:ex};
    });
    // Guardar en Supabase — si offline, guardar en cola local
    const alumnoIdSync = (()=>{try{return JSON.parse(localStorage.getItem("it_session")||"null")?.alumnoId}catch(e){return null}})() || (readOnly&&sharedParam?(()=>{try{return JSON.parse(atob(sharedParam)).alumnoId}catch(e){return null}})():null);
    if(alumnoIdSync) {
      if(!isOnline) {
        const item = buildPendingProgressItem(exId, kg, reps, note, d, weekForSet);
        const updated = [...pendingSync, item];
        setPendingSync(updated);
        try{localStorage.setItem('it_pending_sync', JSON.stringify(updated));}catch(e){}
      } else {
        sb.addProgreso(buildProgressPayload(alumnoIdSync, exId, kg, reps, note, d, weekForSet)).catch(function(e){console.error("[PROGRESO] ERR",e)});
      }
    }
    // Detectar PR y celebrar (fuera del setter para tener acceso al scope)
    const exPrevData = progress[exId]||{sets:[],max:0};
    const newPR = calculateNewWeightPR(exPrevData, kg);
    if(newPR) {
      const inf = [...EX,...(customEx||[])].find(e=>e.id===exId);
      const exR = routines.flatMap(r=>r.days||[]).flatMap(d=>[...(d.warmup||[]),...(d.exercises||[])]).find(e=>e.id===exId);
      const nombreEj = resolveExerciseTitle(inf || null, exR || null, es);
      setPrCelebration({ejercicio: nombreEj, kg: newPR.kg, prevKg: newPR.prevKg, diff: newPR.diff, exId: exId});
      // Guardar PR en lista de la sesión
      setSessionPRList(function(prev){
        var existe = prev.find(function(p){return p.exId===exId && p.kg===newPR.kg});
        if(existe) return prev;
        return [...prev, {exId:exId, ejercicio:nombreEj, kg:newPR.kg, prevKg:newPR.prevKg, diff:newPR.diff}];
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
      setRoutines(prev=>updateExerciseKgInRoutines(prev, exId, kg));
    }
  };

  const {
    bg, bgCard, bgSub, border, textMain, textMuted, green, greenSoft, greenBorder,
    coachAluShell, coachAluSurface, coachAluSubtle, coachAluBorderSoft, coachAluTrack,
    coachAluDropdown, coachAluDropdownShadow, coachAluGhostBtn, card, inp, lbl, btn, tag,
  } = getAppThemeTokens(darkMode);

  const shareSessionSummaryImage = async () => {
    return shareSessionSummaryImageUi({ resumenSesion: resumenSesion, msg: msg, toast2: toast2 });
  };

  const allEx = React.useMemo(function () {
    var BIB_PAT = { empuje: 1, traccion: 1, rodilla: 1, bisagra: 1, core: 1, movilidad: 1, cardio: 1, oly: 1 };
    var po = patternOverrides || {};
    var catalog = EX.map(function (e) {
      var n = normalizeLibraryExercise(e, { catalog: true });
      var p = po[n.id];
      if (p && BIB_PAT[p]) return { ...n, pattern: p };
      return n;
    });
    var seenNames = {};
    var seenIds = {};
    catalog.forEach(function (e) {
      seenIds[String(e.id)] = true;
      seenNames[normalizeExerciseNameKey(e.name)] = true;
    });
    var custom = (customEx || []).map(function (e) { return normalizeLibraryExercise(e, { catalog: false }); }).filter(function (e) {
      var id = String(e && e.id);
      var nameKey = normalizeExerciseNameKey(e && e.name);
      if (!id || seenIds[id] || !nameKey || seenNames[nameKey]) return false;
      seenIds[id] = true;
      seenNames[nameKey] = true;
      return true;
    });
    return catalog.concat(custom);
  }, [customEx, patternOverrides]);
  const filteredEx = allEx.filter(function (e) {
    return exerciseMatchesLibraryFilter(e, search, filterPat, bibMuscleFilterHaystack);
  });
  const detailExHistoryData = React.useMemo(function () {
    return prepareExerciseHistoryModalData({
      exercise: detailEx,
      progress: progress,
      patterns: PATS,
      images: IMGS,
      videos: VIDEOS,
    });
  }, [detailEx, progress]);

  const coachGlobalSearchData = React.useMemo(
    function () {
      return buildCoachGlobalSearchData({
        sessionData: sessionData,
        alumnosActivosLimpios: alumnosActivosLimpios,
        sesionesGlobalesLimpias: sesionesGlobalesLimpias,
        rutinasSBEntrenadorLimpias: rutinasSBEntrenadorLimpias,
        allEx: allEx,
        coachAlumnoCategoria: coachAlumnoCategoria,
        getRutinaAsignadaAlumno: getRutinaAsignadaAlumno,
        progresoGlobalLimpio: progresoGlobalLimpio,
        completedDays: completedDays,
        currentWeek: currentWeek,
      });
    },
    [sessionData, alumnosActivosLimpios, sesionesGlobalesLimpias, rutinasSBEntrenadorLimpias, allEx, coachAlumnoCategoria, getRutinaAsignadaAlumno, progresoGlobalLimpio, completedDays, currentWeek]
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
  const activeStudentRoutinePosition = useMemo(function () {
    if (!esAlumno || !routines[0]) {
      return {
        currentWeek: currentWeek,
        currentDayIndex: null,
        completedDaysInWeek: 0,
        totalDaysInWeek: 0,
        completedDayIndexes: [],
      };
    }
    return getActiveStudentRoutinePosition({
      alumno: sessionData?.alumnoId || (routines[0] && (routines[0].alumno_id || routines[0].alumnoId)),
      rutina: routines[0],
      sesiones: sesiones,
      completedDays: completedDays,
      currentWeek: currentWeek,
    });
  }, [esAlumno, routines, sessionData?.alumnoId, sesiones, completedDays, currentWeek]);
  console.log('DEBUG completedDays/sesiones snapshot:', {
    completedDaysInWeek: activeStudentRoutinePosition.completedDaysInWeek,
    sesionesLength: sesiones?.length,
    sesionesAlumnoIds: [...new Set((sesiones||[]).map(s => s.alumno_id))],
    completedDaysArray: completedDays,
    currentAlumnoId: sessionData?.alumnoId
  });
  const studentCurrentWeek = esAlumno ? activeStudentRoutinePosition.currentWeek : currentWeek;
  const alumnoPlanHeaderDayNum = useMemo(
    function () {
      if (!esAlumno || tab !== "plan" || !routines[0]) return null;
      const r0 = routines[0];
      const totalDays = r0.days?.length || 0;
      if (totalDays === 0) return null;
      const daysCompletedThisWeek = activeStudentRoutinePosition.completedDaysInWeek || 0;
      if (daysCompletedThisWeek >= totalDays) return null;
      return daysCompletedThisWeek + 1;
    },
    [esAlumno, tab, routines, activeStudentRoutinePosition]
  );
  const coachDesktop1024 = useDesktopMin1024();
  const {
    showAlumnoProgressStack,
    showCoachDesktopShell,
    coachSuppressTopNav,
    routineDaysCount,
    tabs2,
    hideGlobalBottomNavCoachDash,
    hideAlumnoTopBarForSession,
    alumnoTopBarFixed,
    alumnoTopBarHeight,
    planScrollCtx,
    alumnoFullScreenShell,
    alumnoFullScreenBg,
    coachDesktopNavHidden,
  } = selectAppShellLayoutState({
    esAlumno: esAlumno,
    readOnly: readOnly,
    sharedParam: sharedParam,
    alumnoId: sessionData?.alumnoId,
    sessionRole: sessionData?.role,
    tab: tab,
    coachDesktop1024: coachDesktop1024,
    session: session,
    routineDaysLength: routines[0]?.days?.length,
    darkMode: darkMode,
    msg: msg,
    planScrollDiag: planScrollDiag,
  });
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
  planScrollCtxRef.current = planScrollCtx;

  /** Al cambiar de pestaña, restaurar barra superior (por si quedó oculta al final del scroll). */
  useLayoutEffect(
    function () {
      var nav = alumnoAppHeaderRef.current;
      var sp = alumnoTopBarSpacerRef.current;
      if (nav) {
        nav.style.transform = "";
        nav.style.opacity = "";
        nav.style.transition = "";
        nav.style.willChange = "";
        nav.style.paddingBottom = "";
        nav.style.minHeight = alumnoTopBarFixed ? alumnoTopBarHeight : "";
        nav.style.boxShadow = alumnoTopBarFixed ? "0 8px 24px rgba(0,0,0,.18)" : "";
        lastAppliedHeaderStateRef.current = alumnoTopBarFixed ? "full" : null;
      }
      if (sp && alumnoTopBarFixed) {
        sp.style.height = "0px";
        sp.style.minHeight = "0px";
        sp.style.overflow = "hidden";
        sp.style.transition = "none";
        sp.style.willChange = "";
      }
    },
    [tab, alumnoTopBarFixed, alumnoTopBarHeight]
  );
  useStudentHeaderShellMeasurement({
    headerResizeObserver: planScrollDiag.headerResizeObserver,
    esAlumno: esAlumno,
    tab: tab,
    routinesLength: routines.length,
    studentHeaderShellLockedHeightPxRef: studentHeaderShellLockedHeightPxRef,
    shellMinHeightPxRef: shellMinHeightPxRef,
    shellMeasureRafRef: shellMeasureRafRef,
    studentHeaderExpandRef: studentHeaderExpandRef,
    studentHeaderShellRef: studentHeaderShellRef,
    studentHeaderExpandHeightRef: studentHeaderExpandHeightRef,
    headerCollapsedRef: headerCollapsedRef,
    alumnoHeaderMiniPx: ALUMNO_HEADER_MINI_PX,
    applyAlumnoHeaderLayerStyles: applyAlumnoHeaderLayerStyles,
  });

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

  async function resetAlumnoRoutineWeek(alumno, rutina, weekIndex) {
    var aid = alumno && alumno.id != null ? String(alumno.id) : (alumnoActivo && alumnoActivo.id != null ? String(alumnoActivo.id) : "");
    var rut = rutina || (aid ? getRutinaAsignadaAlumno(aid) : null);
    var rid = rut && rut.id != null ? String(rut.id) : "";
    var rname = rut && (rut.nombre || rut.name) ? String(rut.nombre || rut.name) : "";
    var wi = Number.isFinite(Number(weekIndex)) ? Number(weekIndex) : currentWeek;
    var weekNumber = wi + 1;
    if (!aid) throw new Error("alumnoId requerido");

    var exIds = getRutinaExerciseIdsForCleanup(rut);
    var exSet = {};
    exIds.forEach(function (id) { exSet[String(id)] = true; });
    var weekSessions = [];
    if (typeof sb.getSesionesByAlumnoRutinaSemana === "function") {
      weekSessions = await sb.getSesionesByAlumnoRutinaSemana(aid, rid, rname, weekNumber) || [];
    }
    var dateSet = {};
    weekSessions.forEach(function (s) {
      if (s && s.fecha) dateSet[String(s.fecha)] = true;
    });
    var weekDates = Object.keys(dateSet);

    if (typeof sb.deleteSesionesByAlumnoRutinaSemana === "function") {
      await sb.deleteSesionesByAlumnoRutinaSemana(aid, rid, rname, weekNumber);
    }
    if (typeof sb.deleteProgresoByAlumnoEjerciciosFechas === "function" && weekDates.length) {
      await sb.deleteProgresoByAlumnoEjerciciosFechas(aid, exIds, weekDates);
    }
    if (rut && rid && typeof sb.updateRutina === "function") {
      var resetDatos = Object.assign({}, rut.datos || {}, {
        days: (rut.datos && rut.datos.days) || rut.days || [],
        semana_activa: weekNumber,
        semana_reiniciada: weekNumber,
        semana_reiniciada_at: new Date().toISOString(),
      });
      await sb.updateRutina(rid, {
        nombre: rut.nombre || rut.name || "Rutina",
        alumno_id: aid,
        entrenador_id: rut.entrenador_id || ENTRENADOR_ID,
        datos: resetDatos,
      });
      setRutinasSBEntrenador(function (prev) {
        return (prev || []).map(function (r0) {
          return String(r0 && r0.id) === rid ? Object.assign({}, r0, { datos: resetDatos }) : r0;
        });
      });
      setRutinasSB(function (prev) {
        return (prev || []).map(function (r0) {
          return String(r0 && r0.id) === rid ? Object.assign({}, r0, { datos: resetDatos }) : r0;
        });
      });
      setRoutines(function (prev) {
        return (prev || []).map(function (r0) {
          return String(r0 && r0.id) === rid ? Object.assign({}, r0, { datos: resetDatos, days: resetDatos.days }) : r0;
        });
      });
    }

    setAlumnoSesiones(function (prev) {
      if (!alumnoActivo || String(alumnoActivo.id) !== aid) return prev || [];
      return (prev || []).filter(function (s) {
        return !sessionBelongsToRoutineWeekForCleanup(s, aid, rid, rname, weekNumber);
      });
    });
    setSesionesGlobales(function (prev) {
      return (prev || []).filter(function (s) {
        return !sessionBelongsToRoutineWeekForCleanup(s, aid, rid, rname, weekNumber);
      });
    });
    setSesiones(function (prev) {
      if (!Array.isArray(prev)) return prev;
      return prev.filter(function (s) {
        return !sessionBelongsToRoutineWeekForCleanup(s, aid, rid, rname, weekNumber);
      });
    });
    setAlumnoProgreso(function (prev) {
      if (!alumnoActivo || String(alumnoActivo.id) !== aid) return prev || [];
      if (!weekDates.length || !exIds.length) return prev || [];
      return (prev || []).filter(function (r) {
        return !(exSet[String(r && r.ejercicio_id)] && dateSet[String(r && r.fecha)]);
      });
    });
    setProgresoGlobal(function (prev) {
      if (!weekDates.length || !exIds.length) return prev || {};
      var next = Object.assign({}, prev || {});
      var key = Object.prototype.hasOwnProperty.call(next, aid) ? aid : Object.keys(next).find(function (k) { return String(k) === aid; });
      if (key) {
        next[key] = (next[key] || []).filter(function (r) {
          return !(exSet[String(r && r.ejercicio_id)] && dateSet[String(r && r.fecha)]);
        });
      }
      return next;
    });
    setProgress(function (prev) {
      if (!prev || !exIds.length) return prev || {};
      var next = Object.assign({}, prev || {});
      exIds.forEach(function (id) {
        var entry = next[id];
        if (!entry || !Array.isArray(entry.sets)) return;
        var sets = entry.sets.filter(function (s) {
          if (s && s.week === wi) return false;
          if (weekDates.length && dateSet[String(s && s.date)]) return false;
          return true;
        });
        next[id] = Object.assign({}, entry, {
          sets: sets,
          max: sets.reduce(function (m, s) { return Math.max(m, parseFloat(s && s.kg) || 0); }, 0),
        });
      });
      try { localStorage.setItem("it_pg", JSON.stringify(next)); } catch (e) {}
      return next;
    });
    setPendingSync(function (prev) {
      if (!weekDates.length || !exIds.length) return prev || [];
      var next = (prev || []).filter(function (item) {
        if (!item) return true;
        if (item.alumno_id != null && String(item.alumno_id) !== aid) return true;
        var itemEx = String(item.exId || item.ejercicio_id || "");
        var itemDate = String(item.fecha || item.date || "");
        return !(exSet[itemEx] && dateSet[itemDate]);
      });
      try { localStorage.setItem("it_pending_sync", JSON.stringify(next)); } catch (e) {}
      return next;
    });
    setCompletedDays(function (prev) {
      return (prev || []).filter(function (k) {
        var text = String(k);
        if (!text.endsWith("-w" + wi)) return true;
        if (rid && text.startsWith(rid + "-")) return false;
        if (!rid && text.indexOf(aid) >= 0) return false;
        return true;
      });
    });
    setSession(null);
    setActiveExIdx(0);
    setCoachRoutineDiaIdx(0);
    setRegistrosSubTab(0);
    try {
      localStorage.removeItem("it_last_week_advance_date");
    } catch (e) {}
    await cargarSesionesGlobales();
    return true;
  }

  function clearRoutineLocalKeysForAlumno(alumnoId, rutinaId) {
    try {
      localStorage.removeItem('it_last_week_advance_date');
      var rid = rutinaId != null && rutinaId !== "" ? String(rutinaId) : "";
      var cd = JSON.parse(localStorage.getItem("it_cd") || "[]");
      if (Array.isArray(cd)) {
        localStorage.setItem("it_cd", JSON.stringify(cd.filter(function (k) {
          var text = String(k);
          return !((rid && text.indexOf(rid) >= 0) || text.indexOf(String(alumnoId)) >= 0);
        })));
      }
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var key = localStorage.key(i);
        if (!key || key.indexOf("it_") !== 0) continue;
        if (key.indexOf(String(alumnoId)) >= 0 || (rid && key.indexOf(rid) >= 0)) {
          localStorage.removeItem(key);
        }
      }
    } catch (e) {}
  }

  async function resetAlumnoRoutineHistory(alumno, rutina) {
    var aid = alumno && alumno.id != null ? String(alumno.id) : (alumnoActivo && alumnoActivo.id != null ? String(alumnoActivo.id) : "");
    var rut = rutina || (aid ? getRutinaAsignadaAlumno(aid) : null);
    var rid = rut && rut.id != null ? String(rut.id) : "";
    var rname = rut && (rut.nombre || rut.name) ? String(rut.nombre || rut.name) : "";
    if (!aid) throw new Error("alumnoId requerido");

    var exIds = getRutinaExerciseIdsForCleanup(rut);
    await Promise.all([
      typeof sb.deleteSesionesByAlumnoRutina === "function"
        ? sb.deleteSesionesByAlumnoRutina(aid, rid, rname)
        : sb.deleteSesionesByAlumno(aid),
      typeof sb.deleteProgresoByAlumnoEjercicios === "function"
        ? sb.deleteProgresoByAlumnoEjercicios(aid, exIds)
        : Promise.resolve(true),
    ]);

    var exSet = {};
    exIds.forEach(function (id) { exSet[String(id)] = true; });

    setAlumnoSesiones(function (prev) {
      if (!alumnoActivo || String(alumnoActivo.id) !== aid) return prev || [];
      return (prev || []).filter(function (s) {
        return !sessionBelongsToRoutineForCleanup(s, aid, rid, rname);
      });
    });
    setSesionesGlobales(function (prev) {
      return (prev || []).filter(function (s) {
        return !sessionBelongsToRoutineForCleanup(s, aid, rid, rname);
      });
    });
    setSesiones(function (prev) {
      if (!Array.isArray(prev)) return prev;
      return prev.filter(function (s) {
        return !sessionBelongsToRoutineForCleanup(s, aid, rid, rname);
      });
    });
    setAlumnoProgreso(function (prev) {
      if (!alumnoActivo || String(alumnoActivo.id) !== aid) return prev || [];
      if (!exIds.length) return prev || [];
      return (prev || []).filter(function (r) {
        return !exSet[String(r && r.ejercicio_id)];
      });
    });
    setProgresoGlobal(function (prev) {
      var next = Object.assign({}, prev || {});
      var key = Object.prototype.hasOwnProperty.call(next, aid) ? aid : Object.keys(next).find(function (k) { return String(k) === aid; });
      if (key && exIds.length) {
        next[key] = (next[key] || []).filter(function (r) {
          return !exSet[String(r && r.ejercicio_id)];
        });
      }
      return next;
    });
    setProgress(function (prev) {
      if (!prev || !exIds.length) return prev || {};
      var next = Object.assign({}, prev);
      exIds.forEach(function (id) { delete next[id]; });
      try { localStorage.setItem("it_pg", JSON.stringify(next)); } catch (e) {}
      return next;
    });
    setPendingSync(function (prev) {
      var next = (prev || []).filter(function (item) {
        if (!item) return true;
        if (item.alumno_id != null && String(item.alumno_id) !== aid) return true;
        if (!exIds.length) return true;
        return !exSet[String(item.exId || item.ejercicio_id)];
      });
      try { localStorage.setItem("it_pending_sync", JSON.stringify(next)); } catch (e) {}
      return next;
    });
    setSugerencias(function (prev) {
      if (!prev || typeof prev !== "object") return prev;
      var next = Object.assign({}, prev);
      delete next[aid];
      return next;
    });
    setCompletedDays(function (prev) {
      return (prev || []).filter(function (k) {
        var text = String(k);
        return !((rid && text.indexOf(rid) >= 0) || text.indexOf(aid) >= 0);
      });
    });
    if (rut && rid && typeof sb.updateRutina === "function") {
      var resetAllDatos = Object.assign({}, rut.datos || {}, {
        days: (rut.datos && rut.datos.days) || rut.days || [],
        semana_activa: 1,
      });
      delete resetAllDatos.semana_reiniciada;
      delete resetAllDatos.semana_reiniciada_at;
      await sb.updateRutina(rid, {
        nombre: rut.nombre || rut.name || "Rutina",
        alumno_id: aid,
        entrenador_id: rut.entrenador_id || ENTRENADOR_ID,
        datos: resetAllDatos,
      });
      setRutinasSBEntrenador(function (prev) {
        return (prev || []).map(function (r0) {
          return String(r0 && r0.id) === rid ? Object.assign({}, r0, { datos: resetAllDatos }) : r0;
        });
      });
      setRutinasSB(function (prev) {
        return (prev || []).map(function (r0) {
          return String(r0 && r0.id) === rid ? Object.assign({}, r0, { datos: resetAllDatos }) : r0;
        });
      });
      setRoutines(function (prev) {
        return (prev || []).map(function (r0) {
          return String(r0 && r0.id) === rid ? Object.assign({}, r0, { datos: resetAllDatos, days: resetAllDatos.days }) : r0;
        });
      });
    }
    setCurrentWeek(0);
    setCoachRoutineDiaIdx(0);
    setRegistrosSubTab(0);
    clearRoutineLocalKeysForAlumno(aid, rid);
    try {
      var freshSesiones = await sb.getSesiones(aid) || [];
      var freshProgreso = await sb.getProgreso(aid) || [];
      if (alumnoActivo && String(alumnoActivo.id) === aid) {
        setAlumnoSesiones(freshSesiones);
        setAlumnoProgreso(freshProgreso);
      }
      setProgresoGlobal(function (prev) {
        var next = Object.assign({}, prev || {});
        next[aid] = freshProgreso;
        return next;
      });
    } catch (e) {
      console.error("[resetAlumnoRoutineHistory] fetch after reset failed", e);
    }
    await cargarSesionesGlobales();
    return true;
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
    setCoachDialogLoading(c.t === 'deleteAlumno' || c.t === 'quitarRut' || c.t === 'assignRut' || c.t === 'clearProgress' || c.t === 'resetRoutine' || c.t === 'resetWeek');
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
        await resetAlumnoRoutineWeek(c.a || alumnoActivo, c.rutinaActiva || (c.a ? getRutinaAsignadaAlumno(c.a) : null), c.semanaCiclo - 1);
        setCoachRutinaMenuOpen(false);
        toast2(msg('Semana reiniciada', 'Week reset', 'Semana reiniciada'));
        setCoachDialog({ t: 'none' });
        return;
      }
      if (c.t === 'resetRoutine') {
        await resetAlumnoRoutineHistory(c.a || alumnoActivo, c.rutinaActiva || (c.a ? getRutinaAsignadaAlumno(c.a) : null));
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
        console.error("[assignRut legacy error]", {
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
            console.error("[assignRut INSERT ERROR]", insertResult.error);
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
      if (c.t === 'clearProgress' || c.t === 'resetRoutine' || c.t === 'resetWeek') {
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

  if (esAlumno && cargandoAlumno) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100dvh",background:bg}}>
      <div style={{width:36,height:36,border:"3px solid #1e1e2e",borderTop:"3px solid #2563EB",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
    </div>
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
          <div style={{position:"relative"}}>
            <input style={{background:bgSub,color:textMain,border:"1px solid "+border,borderRadius:8,padding:"8px 40px 8px 12px",width:"100%",fontFamily:"Inter,sans-serif",fontSize:15,boxSizing:"border-box"}} value={loginPass} onChange={e=>setLoginPass(e.target.value)} placeholder="••••••••" type={showPassword?"text":"password"}/>
            <button type="button" onClick={()=>setShowPassword(v=>!v)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#6B7280",padding:4,display:"flex",alignItems:"center"}}>
              {showPassword
                ? <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                : <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              }
            </button>
          </div>
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
                var hasCoachRowName = false;
                try {
                  var coachRow = await supabase
                    .from('entrenadores')
                    .select('nombre')
                    .eq('id', String(authLogin.data.user.id))
                    .maybeSingle();
                  if (!coachRow.error && coachRow.data && typeof coachRow.data.nombre === "string" && coachRow.data.nombre.trim()) {
                    demoName = coachRow.data.nombre.trim();
                    hasCoachRowName = true;
                  }
                } catch (eCoachName) {
                  console.error("[AUTH] entrenadores nombre select exception", eCoachName);
                }
                try {
                  var cpl = localStorage.getItem("it_coach_profile_local");
                  if (cpl) {
                    var cpj = JSON.parse(cpl);
                    if (!hasCoachRowName && cpj && typeof cpj.name === "string" && cpj.name.trim()) demoName = cpj.name.trim();
                  }
                } catch (e) {}
                try {
                  var upCoach = await supabase
                    .from('entrenadores')
                    .upsert({ id: String(authLogin.data.user.id), email: authLogin.data.user.email || loginEmailNorm }, { onConflict: 'id' });
                  if (upCoach.error) console.error("[AUTH] entrenadores upsert migracion fallo", upCoach.error);
                } catch (eUpCoach) {
                  console.error("[AUTH] entrenadores upsert migracion exception", eUpCoach);
                }
                const s={role:"entrenador",name: demoName,email:authLogin.data.user.email||loginEmailNorm,entrenadorId:String(authLogin.data.user.id)};
                localStorage.setItem("it_session",JSON.stringify(s));
                syncStateWithLocalStorage();
                setLoginEmail("");
                setLoginPass("");
                setShowPassword(false);
              } else setLoginError("Email o contraseña incorrectos");
            } else {
              const res=await sbFetch("alumnos?email=eq."+encodeURIComponent(loginEmailNorm)+"&select=id,nombre,entrenador_id");
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
                setShowPassword(false);
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

  const handleCoachDashboardEnviarMensaje = function () {
    var first = (alumnos || [])[0];
    if (first) {
      setChatModal({ alumnoId: first.id, alumnoNombre: first.nombre || first.email || "Alumno" });
    } else {
      toast2(msg("No hay alumnos para contactar", "No athletes to message"));
    }
  };
  const handleCoachDashboardCrearRutina = function () {
    setTab("routines");
  };
  const handleCoachDashboardRevisarAlumnos = function () {
    setTab("alumnos");
  };
  const handleCoachDashboardOpenAlumno = async function (alumnoId, logLabel) {
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
      console.error(logLabel, e);
    }
    setLoadingSB(false);
  };
  const handleCoachDashboardRevisar = function (alumnoId) {
    return handleCoachDashboardOpenAlumno(alumnoId, "[CoachDashboard onRevisar]");
  };
  const handleCoachDashboardVerPerfil = function (alumnoId) {
    return handleCoachDashboardOpenAlumno(alumnoId, "[CoachDashboard onVerPerfil]");
  };
  const handleCoachDashboardNuevoAlumno = function () {
    setTab("alumnos");
    setNewAlumnoForm(true);
  };
  const handleCoachDashboardNuevaRutina = function () {
    setTab("routines");
  };
  const handleCoachDashboardNuevoEjercicio = function () {
    setTab("biblioteca");
    setBibOpenNewExerciseTick(function (t) {
      return t + 1;
    });
  };
  const handleCoachDashboardIrProgreso = function () {
    setTab("progress");
  };
  const handleCoachDashboardAbrirChatAlumno = function (alumnoId) {
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
  };
  const handleCoachMensajesLeidos = function (alumnoId) {
    setMensajesEntrenadorPendientes(function(prev) {
      return (prev || []).filter(function(m) {
        return String(m && m.alumno_id) !== String(alumnoId);
      });
    });
  };
  const handleCoachMessagesOpenConversation = function (alumnoId, alumnoNombre) {
    handleCoachMensajesLeidos(alumnoId);
    setChatModal({
      alumnoId: alumnoId,
      alumnoNombre: alumnoNombre || "Alumno",
    });
  };
  const handleCoachLogout = function () {
    clearAllIronTrackPrefixedKeys();
    syncStateWithLocalStorage();
  };
  const handleCoachSettingsClose = function () {
    setTab("plan");
  };

  function buildCoachSectionRendererProps() {
    return {
      tab: tab,
      esAlumno: esAlumno,
      sessionData: sessionData,
      showCoachDesktopShell: showCoachDesktopShell,
      coachDesktop1024: coachDesktop1024,
      dashboardProps: {
        alumnos: alumnosActivosLimpios,
        sesionesGlobales: sesionesGlobalesLimpias,
        mensajesEntrenadorPendientes: mensajesEntrenadorPendientes,
        progresoGlobal: progresoGlobalLimpio,
        rutinasSBEntrenador: rutinasSBEntrenadorLimpias,
        allEx: allEx,
        lang: lang,
        darkMode: darkMode,
        currentWeek: currentWeek,
        coachName: sessionData?.name || "",
        onEnviarMensaje: handleCoachDashboardEnviarMensaje,
        onCrearRutina: handleCoachDashboardCrearRutina,
        onRevisarAlumnos: handleCoachDashboardRevisarAlumnos,
        onRevisar: handleCoachDashboardRevisar,
        onVerPerfil: handleCoachDashboardVerPerfil,
        onNuevoAlumno: handleCoachDashboardNuevoAlumno,
        onNuevaRutina: handleCoachDashboardNuevaRutina,
        onNuevoEjercicio: handleCoachDashboardNuevoEjercicio,
        onIrProgreso: handleCoachDashboardIrProgreso,
        onAbrirChatAlumno: handleCoachDashboardAbrirChatAlumno,
        globalSearchData: coachGlobalSearchData,
        onGlobalSearchNavigate: coachGlobalSearchNavigate,
        getAlumnoCategoria: coachAlumnoCategoria,
        supabase: supabase,
        entrenadorId: supabaseSessionUserId || sessionData?.entrenadorId || null,
      },
      calendarProps: {
        alumnos: alumnosActivosLimpios,
        rutinas: rutinasCalendarioEntrenador,
        lang: lang,
        dark: darkMode,
        supabase: supabase,
        entrenadorId: supabaseSessionUserId || null,
        onAssignRoutineToAlumno: assignRoutineToAlumno,
      },
      routinesProps: {
        setTab: setTab,
        border: border,
        textMuted: textMuted,
        bgCard: bgCard,
        textMain: textMain,
        darkMode: darkMode,
        bgSub: bgSub,
        lang: lang,
        es: es,
        filtroRut: filtroRut,
        setFiltroRut: setFiltroRut,
        card: card,
        setNewR: setNewR,
        routines: routines,
        setRoutines: setRoutines,
        allEx: allEx,
        toast2: toast2,
        setAddExModal: setAddExModal,
        setAddExSearch: setAddExSearch,
        setAddExPat: setAddExPat,
        setAddExMuscle: setAddExMuscle,
        setAddExSelectedIds: setAddExSelectedIds,
        setDupDayModal: setDupDayModal,
        alumnos: alumnosActivosLimpios,
        sb: sb,
        setAssignRoutineId: setAssignRoutineId,
        desktopCoachStableLayout: coachDesktopNavHidden,
        rutinasSBEntrenador: rutinasSBEntrenador,
        setRutinasSBEntrenador: setRutinasSBEntrenador,
      },
      studentsProps: {
        allEx: allEx,
        alumnoActivo: alumnoActivo,
        alumnoProgreso: alumnoProgreso,
        alumnoSesiones: alumnoSesiones,
        alumnos: alumnos,
        bgCard: bgCard,
        bgSub: bgSub,
        border: border,
        cargarAlumnos: cargarAlumnos,
        cleanActiveCoachAlumnos: cleanActiveCoachAlumnos,
        coachAluBorderSoft: coachAluBorderSoft,
        coachAluDropdown: coachAluDropdown,
        coachAluDropdownShadow: coachAluDropdownShadow,
        coachAluGhostBtn: coachAluGhostBtn,
        coachAluShell: coachAluShell,
        coachAluSubtle: coachAluSubtle,
        coachAluSurface: coachAluSurface,
        coachAluTrack: coachAluTrack,
        coachAlumnosCounts: coachAlumnosCounts,
        coachAlumnosFilter: coachAlumnosFilter,
        coachAlumnosListaFiltrada: coachAlumnosListaFiltrada,
        coachAlumnosSearch: coachAlumnosSearch,
        coachCardMenuId: coachCardMenuId,
        coachDiaSecsOpen: coachDiaSecsOpen,
        coachRoutineDiaIdx: coachRoutineDiaIdx,
        coachRutinaMenuOpen: coachRutinaMenuOpen,
        completedDays: completedDays,
        currentWeek: currentWeek,
        darkMode: darkMode,
        ENTRENADOR_ID: ENTRENADOR_ID,
        es: es,
        EX: EX,
        generarSugerenciasAlumno: generarSugerenciasAlumno,
        getRutinaAsignadaAlumno: getRutinaAsignadaAlumno,
        loadingSB: loadingSB,
        mergeRutinasAsignadas: mergeRutinasAsignadas,
        msg: msg,
        newAlumnoData: newAlumnoData,
        newAlumnoErrors: newAlumnoErrors,
        newAlumnoForm: newAlumnoForm,
        notaDiaInput: notaDiaInput,
        routineForAssign: routineForAssign,
        routines: routines,
        rutinasLoaded: rutinasLoaded,
        sb: sb,
        setAddExModal: setAddExModal,
        setAddExMuscle: setAddExMuscle,
        setAddExPat: setAddExPat,
        setAddExSearch: setAddExSearch,
        setAddExSelectedIds: setAddExSelectedIds,
        setAliasModal: setAliasModal,
        setAlumnoActivo: setAlumnoActivo,
        setAlumnoProgreso: setAlumnoProgreso,
        setAlumnoSesiones: setAlumnoSesiones,
        setAlumnos: setAlumnos,
        setAssignRoutineId: setAssignRoutineId,
        setCoachAlumnosFilter: setCoachAlumnosFilter,
        setCoachAlumnosSearch: setCoachAlumnosSearch,
        setCoachCardMenuId: setCoachCardMenuId,
        setChatModal: setChatModal,
        setCoachDiaSecsOpen: setCoachDiaSecsOpen,
        setCoachDialog: setCoachDialog,
        setCoachRoutineDiaIdx: setCoachRoutineDiaIdx,
        setCoachRutinaMenuOpen: setCoachRutinaMenuOpen,
        setEditEx: setEditEx,
        setLoadingSB: setLoadingSB,
        setNewAlumnoData: setNewAlumnoData,
        setNewAlumnoErrors: setNewAlumnoErrors,
        setNewAlumnoForm: setNewAlumnoForm,
        setNotaDiaInput: setNotaDiaInput,
        setRegistrosSubTab: setRegistrosSubTab,
        setRutinasSB: setRutinasSB,
        setRutinasSBEntrenador: setRutinasSBEntrenador,
        sesionesGlobales: sesionesGlobalesLimpias,
        progresoGlobal: progresoGlobalLimpio,
        showCoachDesktopShell: showCoachDesktopShell,
        sugsOpen: sugsOpen,
        setSugsOpen: setSugsOpen,
        textMain: textMain,
        textMuted: textMuted,
        toast2: toast2,
      },
      exercisesProps: {
        allEx: allEx,
        setPatternOverrides: setPatternOverrides,
        darkMode: darkMode,
        sb: sb,
        entrenadorId: supabaseSessionUserId || sessionData?.entrenadorId || null,
        customEx: customEx,
        setCustomEx: setCustomEx,
        toast2: toast2,
        videoOverrides: videoOverrides,
        setVideoOverrides: setVideoOverrides,
        openNewExerciseTick: bibOpenNewExerciseTick,
      },
      settingsProps: {
        onClose: handleCoachSettingsClose,
        toast2: toast2,
        setSessionData: setSessionData,
        syncStateWithLocalStorage: syncStateWithLocalStorage,
        lang: lang,
        setLang: setLang,
        darkMode: darkMode,
        setDarkMode: setDarkMode,
        es: es,
        alumnosCount: alumnos.length,
        rutinasActivasCount: rutinasSBEntrenador.length,
        sesionesGlobales: sesionesGlobales,
        sb: sb,
        entrenadorId: supabaseSessionUserId || sessionData?.entrenadorId || null,
      },
      messagesProps: {
        alumnos: alumnosActivosLimpios,
        sb: sb,
        darkMode: darkMode,
        lang: lang,
        onMensajesLeidos: handleCoachMensajesLeidos,
        onOpenConversation: handleCoachMessagesOpenConversation,
      },
      mobileDrawerProps: {
        open: mobileDrawerOpen,
        activeTab: tab,
        sessionData: sessionData,
        msg: msg,
        mobileDrawerRef: mobileDrawerRef,
        onClose: function () { setMobileDrawerOpen(false); },
        onNavigate: setTab,
        onLogout: handleCoachLogout,
        coachInitials: coachInitialsFromFullName(sessionData?.name),
      },
      scannerProps: {
        darkMode: darkMode,
        sb: sb,
        setRoutines: setRoutines,
        alumnos: alumnosActivosLimpios,
        toast2: toast2,
        customEx: customEx,
        msg: msg,
        green: green,
      },
    };
  }

  return (
    <>
    {brandSplashEl}
    <IronTrackI18nProvider lang={lang}>
    <div style={{
      minHeight:"100dvh",
      height: alumnoFullScreenShell ? "100svh" : undefined,
      overflow: alumnoFullScreenShell ? "hidden" : undefined,
      background:alumnoFullScreenShell ? alumnoFullScreenBg : bg,
      color:textMain,
      fontFamily:"Inter,sans-serif",
      "--sk1":darkMode?"#1E2D40":"#E8EEF4",
      "--sk2":darkMode?"#2D4057":"#D1DCE8",
      paddingBottom: alumnoFullScreenShell ? 0 : coachDesktopNavHidden ? "env(safe-area-inset-bottom, 0px)" : 72,
      position:"relative",
      display: alumnoFullScreenShell ? "flex" : undefined,
      flexDirection: alumnoFullScreenShell ? "column" : undefined,
    }}>
      <AppGlobalStyles darkMode={darkMode} bgSub={bgSub} textMain={textMain} border={border} />

      <div className="app-inner" style={alumnoFullScreenShell ? {display:"flex",flexDirection:"column",flex:1,minHeight:0} : showCoachDesktopShell ? {display:"flex",flexDirection:"column",minHeight:"100vh",width:"100%",flex:1,maxWidth:"none",margin:0} : undefined}>
      {!isOnline&&(
        <OfflineSyncBanner
          message={msg("Sin conexión — sets guardados localmente", "Offline — sets saved locally")}
          pendingCount={pendingSync.length}
        />
      )}
      <CoachDesktopShellFrame
        showCoachDesktopShell={showCoachDesktopShell} tab={tab} onNavigate={setTab}
        onSettings={function () { setTab("settings"); }} onPerfil={function () { setTab("perfil"); }}
        onLogout={function () { clearAllIronTrackPrefixedKeys(); syncStateWithLocalStorage(); }}
        coachAvatarUrl={sessionData?.avatarUrl} coachName={sessionData?.name} darkMode={darkMode}
      >
      {!coachSuppressTopNav && !hideAlumnoTopBarForSession && (
      <AppTopBar
        ref={alumnoAppHeaderRef}
        alumnoTopBarFixed={alumnoTopBarFixed}
        alumnoTopBarHeight={alumnoTopBarHeight}
        darkMode={darkMode}
        showCoachDesktopShell={showCoachDesktopShell}
        esAlumno={esAlumno}
        coachDesktop1024={coachDesktop1024}
        readOnly={readOnly}
        sessionData={sessionData}
        msg={msg}
        onOpenMobileDrawer={() => setMobileDrawerOpen(true)}
        showPlanHeaderLabel={esAlumno && tab === "plan" && alumnoPlanHeaderDayNum != null}
        alumnoPlanHeaderDayNum={alumnoPlanHeaderDayNum}
        textMuted={textMuted}
        session={session}
        sessionActiveStyle={{...tag("#22C55E"),fontSize:13}}
        showPWAInstall={esAlumno && (tab === "plan" || tab === "library" || tab === "progress") && canInstallPWA}
        pwaInstallTipOpen={pwaInstallTipOpen}
        setPwaInstallTipOpen={setPwaInstallTipOpen}
        installPWA={installPWA}
        settingsButtonStyle={{...btn(),padding:"8px",display:"flex",alignItems:"center",justifyContent:"center"}}
        onSettings={() => setSettingsOpen(true)}
        avatarLabel={(sessionData?.name||"U").slice(0,2).toUpperCase()}
        userMenuOpen={userMenuOpen}
        onToggleUserMenu={setUserMenuOpen}
        coachLogoutButtonStyle={{background:"#2563EB22",color:"#2563EB",border:"none",borderRadius:8,padding:"8px 14px",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}
        onCoachLogout={()=>{clearAllIronTrackPrefixedKeys();syncStateWithLocalStorage();}}
        loginButtonStyle={{...btn(),padding:"4px 8px",fontSize:13}}
        onLogin={()=>setLoginModal(true)}
      />
      )}
      {alumnoTopBarFixed && (
        <div ref={alumnoTopBarSpacerRef} style={{ height: 0, minHeight: 0, flexShrink: 0, overflow: "hidden", transition: "none", background: alumnoFullScreenBg, border: "none", boxShadow: "none" }} aria-hidden />
      )}
      {sessionData && esAlumno && userMenuOpen && (
        <AlumnoUserMenu
          sessionData={sessionData}
          alumnoTopBarFixed={alumnoTopBarFixed}
          msg={msg}
          onClose={() => setUserMenuOpen(false)}
          onProfile={() => {
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
          onSettings={() => {
            setUserMenuOpen(false);
            setSettingsOpen(true);
          }}
          onLogout={() => {
            setUserMenuOpen(false);
            setCoachDialog({ t: 'logout' });
          }}
        />
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

      <AppMainScroll
        showCoachDesktopShell={showCoachDesktopShell}
        esAlumno={esAlumno}
        tab={tab}
        showAlumnoProgressStack={showAlumnoProgressStack}
        coachSuppressTopNav={coachSuppressTopNav}
        coachDesktop1024={coachDesktop1024}
        planScrollDiag={planScrollDiag}
        alumnoTopBarFixed={alumnoTopBarFixed}
        alumnoFullScreenShell={alumnoFullScreenShell}
        session={session}
        activeDay={activeDay}
        darkMode={darkMode}
        onScrollNode={function (node) {
          scrollRef.current = node;
        }}
      >
        {esAlumno&&(
          <StudentMainView
            tab={tab}
            planScrollDiag={planScrollDiag}
            aliasData={aliasData}
            es={es}
            darkMode={darkMode}
            toast2={toast2}
            msg={msg}
            planView={null}
            allEx={allEx}
            routines={routines}
            videoOverrides={videoOverrides}
            setVideoModal={setVideoModal}
            showAlumnoProgressStack={showAlumnoProgressStack}
            progress={progress}
            EX={EX}
            sesiones={sesiones}
            sessionData={sessionData}
            sb={sb}
            sharedParam={sharedParam}
            routineDaysCount={routineDaysCount}
            onRegistrarPrimerEntrenamiento={()=>setTab("plan")}
          />
        )}
        {sessionData?.role === 'entrenador' && (
          <div style={{position:'fixed',top:0,left:0,right:0,zIndex:99999,background:'#1e1b4b',color:'#a5b4fc',fontSize:11,padding:'6px 10px',fontFamily:'monospace',lineHeight:1.5}}>
            <b>DEBUG</b> | supabaseSessionUserId: <b>{String(supabaseSessionUserId ?? 'null')}</b> | sessionData.entrenadorId: <b>{String(sessionData?.entrenadorId ?? 'null')}</b> | alumnos.length: <b>{alumnos.length}</b>
          </div>
        )}
        <CoachSectionRenderer {...buildCoachSectionRendererProps()} />
        {tab==="plan"&&esAlumno&&(
          <div className="mx-auto w-full max-w-[32rem] pt-4">
            {esAlumno&&!cargandoAlumno&&routines.length>0&&(()=>{
              const r0 = routines[0];
              const hoy = new Date().toLocaleDateString("es-AR");
              const totalDays = r0?.days?.length||0;
              const currentWeekForStudent = studentCurrentWeek;
              const daysCompletedThisWeek = activeStudentRoutinePosition.completedDaysInWeek || 0;
              // Racha: semanas consecutivas con al menos 1 día entrenado
              const rachaActual = (() => {
                if(!r0) return 0;
                let streak = 0;
                // Semana actual cuenta si ya entrenó algo
                for(let w = currentWeekForStudent; w >= 0; w--) {
                  const daysInWeek = completedDays.filter(k =>
                    k.startsWith(r0.id+"-") && k.endsWith("-w"+w)
                  ).length;
                  if(daysInWeek > 0) streak++;
                  else if(w < currentWeekForStudent) break; // semana anterior sin días = se rompe la racha
                }
                return streak;
              })();
              const nextDayIdx = daysCompletedThisWeek < totalDays ? daysCompletedThisWeek : null;
              const weeklyPct = totalDays > 0 ? Math.min(100, Math.round((daysCompletedThisWeek / totalDays) * 100)) : 0;
              const todayDay = nextDayIdx !== null ? r0?.days?.[nextDayIdx] : null;
              console.log('DEBUG hoy/iniciar:', {
                completedDaysInWeek: activeStudentRoutinePosition.completedDaysInWeek,
                totalDays,
                nextDayIdx,
                todayDay: todayDay?.dia || todayDay,
                esAlumno
              });
              const yaEntrenoHoy = Object.values(progress||{}).some(pg=>(pg.sets||[]).some(s=>s.date===hoy&&(s.week===undefined||s.week===currentWeekForStudent)));
              const todayDayPresentation = buildStudentDayPresentation({
                day: todayDay,
                dayIndex: nextDayIdx,
                allEx: allEx,
                msg: msg,
              });
              const totalEjHero = todayDayPresentation.exerciseCount;
              const doneEjHero = todayDay ? countExercisesWithLogToday(todayDay, progress, hoy, currentWeekForStudent) : 0;
              const pctHero = totalEjHero > 0 ? Math.min(100, Math.round((100 * doneEjHero) / totalEjHero)) : 0;
              const progressStatusHero =
                pctHero === 0
                  ? msg("Comienza tu entrenamiento", "Start your training", "Comece o treino")
                  : pctHero < 100
                    ? msg("Sigue con tu entrenamiento", "Keep going", "Continue o treino")
                    : msg("Casi listo", "Almost there", "Quase pronto");
              const todayHeroTitle = todayDayPresentation.dayTitle;
              const todayTypeBadge = todayDayPresentation.typeBadgeText;
              return (
                <div style={{ marginBottom: 0 }}>
                  {/*
                    Slot de altura FIJA (minHeight + height monótonos vía RO): el colapso del header solo
                    usa transform/opacity en las capas internas; este contenedor NO debe encogerse al
                    hacer scroll — si encoge, Full body / Día 1 suben (CLS). Ver studentHeaderShellLockedHeightPxRef.
                  */}
                  {!session&&(
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
                  <StudentWeeklyProgressCard
                    msg={msg}
                    bgCard={bgCard}
                    border={border}
                    textMuted={textMuted}
                    darkMode={darkMode}
                    currentWeek={currentWeekForStudent}
                    daysCompletedThisWeek={daysCompletedThisWeek}
                    totalDays={totalDays}
                    weeklyPct={weeklyPct}
                    nextDayIdx={nextDayIdx}
                  />

                  {/* Entrenamiento de hoy — hero (layout premium; mismos handlers que antes) */}
                  {planScrollDiag.hoyCard&&todayDay&&!yaEntrenoHoy&&!session&&(
                    <>
                    <CurrentWorkoutHero
                      msg={msg}
                      textMain={textMain}
                      textMuted={textMuted}
                      hoyBadgeText={msg("HOY TOCA", "TODAY", "HOJE")}
                      semDiaLine={
                        msg("Semana", "Week", "Semana") + " " + (currentWeekForStudent + 1) + " · " + msg("Día", "Day", "Dia") + " " + (nextDayIdx + 1)
                      }
                      dayTitle={todayHeroTitle}
                      typeBadgeText={todayTypeBadge}
                      exerciseCount={totalEjHero}
                      durationMinutes={estimateDayMinutes(todayDay, currentWeekForStudent)}
                      ctaLabel={msg("EMPEZAR", "START", "COMEÇAR")}
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
                    </>
                  )}

                  {/* DÍA YA ENTRENADO */}
                  {planScrollDiag.completedTodayBanner&&yaEntrenoHoy&&!session&&(
                    <CompletedTodayBanner msg={msg} textMuted={textMuted} />
                  )}
                  </div>
                  <StudentPlanMiniHeader
                    msg={msg}
                    textMain={textMain}
                    ALUMNO_HEADER_MINI_PX={ALUMNO_HEADER_MINI_PX}
                    firstName={sessionData?.name?.split(" ")[0]||"Atleta"}
                    showTrainButton={todayDay&&!yaEntrenoHoy&&!session}
                    onTrainToday={()=>{
                      const snap={};
                      [...(todayDay.warmup||[]),...(todayDay.exercises||[])].forEach(ex=>{snap[ex.id]=progress[ex.id]?.max||0;});
                      setPreSessionPRs({...snap});
                      setSessionPRList([]);setSession({rId:r0.id,dIdx:nextDayIdx,exIdx:0,startTime:Date.now()});
                    }}
                    showCompletedToday={yaEntrenoHoy}
                    headerRef={function (el) {
                      studentHeaderMiniRef.current = el;
                      if (el) applyAlumnoHeaderLayerStyles(headerCollapsedRef.current);
                    }}
                    layerTransitionsEnabled={planScrollDiag.planHeaderLayerTransitions}
                  />
                  </div>
                  )}
                </div>
              );
            })()}

            {esAlumno&&!cargandoAlumno&&routines.length===0&&(
              <StudentNoRoutinesEmptyState msg={msg} textMuted={textMuted} />
            )}
            {esAlumno&&!cargandoAlumno&&routines.length>0&&routines.map(r=>{
              const hoyStr = new Date().toLocaleDateString("es-AR");
              const currentWeekForRoutine = String(r.id) === String(routines[0]?.id) ? studentCurrentWeek : currentWeek;
              const completedDaysForRoutine = String(r.id) === String(routines[0]?.id)
                ? (activeStudentRoutinePosition.completedDaysInWeek || 0)
                : completedDays.filter(function(k){return k.startsWith(r.id+"-")&&k.endsWith("-w"+currentWeekForRoutine);}).length;
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
                      {completedDaysForRoutine}{" "}
                      {msg("completados", "done")}
                    </span>
                  </div>
                  {r.days.map((d,di)=>{
                    const dayKey=r.id+"-"+di+"-w"+currentWeekForRoutine;
                    const isDayDone=completedDays.includes(dayKey)
                      ||(esAlumno&&String(r.id)===String(routines[0]?.id)&&(activeStudentRoutinePosition.completedDayIndexes||[]).includes(di));
                    const daysCompletedR=completedDaysForRoutine;
                    console.log('DEBUG completedDays/sesiones snapshot:', {
                      completedDaysInWeek: activeStudentRoutinePosition.completedDaysInWeek,
                      sesionesLength: sesiones?.length,
                      sesionesAlumnoIds: [...new Set((sesiones||[]).map(s => s.alumno_id))],
                      completedDaysArray: completedDays,
                      currentAlumnoId: sessionData?.alumnoId
                    });
                    const localNextDayIdx=daysCompletedR < r.days.length ? daysCompletedR : null;
                    const isNextDay=di===localNextDayIdx;
                    const isFuture=localNextDayIdx!==null&&di>localNextDayIdx;
                    const totalEj=((d.warmup||[]).length+(d.exercises||[]).length);
                    const isOpen=expandedPlanDay===r.id+"-"+di;
                    const estMin=estimateDayMinutes(d,currentWeekForRoutine);
                    const metaLine=
                      totalEj + " " + msg("ejercicios", "exercises", "exercícios") + " · ~" + estMin + " " + msg("min", "min", "min");
                    const doneEjRow = isDayDone
                      ? totalEj
                      : isNextDay
                        ? countExercisesWithLogToday(d, progress, hoyStr, currentWeekForRoutine)
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
                            <StudentPlanExerciseRows
                              day={d}
                              routineId={r.id}
                              dayIndex={di}
                              allEx={allEx}
                              currentWeekForRoutine={currentWeekForRoutine}
                              border={border}
                              textMain={textMain}
                              msg={msg}
                              es={es}
                              fmtP={fmtP}
                              renderExerciseVideoButton={function(inf, ex, nombre){
                                var vUrl=resolveVideoUrl(inf||null,ex,videoOverrides);
                                return (
                                  <ExerciseVideoPlayButton
                                    hasVideo={!!vUrl}
                                    onClick={function(){var vid=getYTVideoId(vUrl);if(vid)setVideoModal({videoId:vid,nombre:nombre});else window.open(vUrl,"_blank")}}
                                    ariaLabel={msg("Ver video del ejercicio","View exercise video")}
                                    ariaLabelDisabled={msg("Video no disponible","No video available")}
                                  />
                                );
                              }}
                            />
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
                    <RoutinePdfDownloadButton msg={msg} onDownload={function(){ downloadRoutinePdf(r); }} />
                  )}

                  {/* Sparkline de tendencia 30 días */}
                <StudentExerciseSparkline progress={progress} _dm={darkMode} textMuted={textMuted} msg={msg} />
                </div>
              );
            })}
          </div>
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
                        <div style={{fontWeight:700}}>{formatWorkoutSetLabel(ex, s2)}</div>
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
      {esAlumno&&(sessionData?.alumnoId||(sharedParam?(()=>{try{return JSON.parse(atob(sharedParam)).alumnoId}catch(e){return null}})():null))&&(
        <ChatFlotante darkMode={darkMode} es={es} alumnoId={sessionData?.alumnoId||(sharedParam?(()=>{try{return JSON.parse(atob(sharedParam)).alumnoId}catch(e){return null}})():null)} alumnoNombre={sessionData?.name||"Alumno"} sb={sb} esEntrenador={false}/>
      )}
      <AppShellModals
        welcomeProps={{
          open: showWelcome, sessionData, routines, alumnos, onboardStep,
          studentCurrentWeek, activeStudentRoutinePosition, allEx, es,
          bgCard, border, textMain, textMuted, msg,
          images: IMGS,
          videoOverrides,
          onStudentOpenChange: function (v) { if (!v) setShowWelcome(false); },
          onStudentExerciseVideo: function (nombre, vUrl) {
            var vid = getYTVideoId(vUrl);
            if (vid) setVideoModal({ videoId: vid, nombre: nombre });
            else window.open(vUrl, "_blank");
          },
          onStudentStartWorkout: function ({ routine, day, dayIndex }) {
            if (!routine || !day) {
              setShowWelcome(false);
              return;
            }
            var snap = {};
            [].concat(day.warmup || [], day.exercises || []).forEach(function (ex) {
              snap[ex.id] = progress[ex.id]?.max || 0;
            });
            setPreSessionPRs({ ...snap });
            setSessionPRList([]);
            setShowWelcome(false);
            setSession({ rId: routine.id, dIdx: dayIndex, exIdx: 0, startTime: Date.now() });
          },
          onCoachStart: function () { setOnboardStep(1); },
          onCoachRoutine: function (routinesReady) { if (!routinesReady) { setShowWelcome(false); setOnboardStep(1); setTab("routines"); } else setOnboardStep(2); },
          onCoachSkipRoutine: function () { setOnboardStep(2); },
          onCoachAlumno: function (alumnosReady) { if (!alumnosReady) { setShowWelcome(false); setOnboardStep(2); setTab("alumnos"); setNewAlumnoForm(true); } else setOnboardStep(3); },
          onCoachSkipAlumno: function () { setOnboardStep(3); },
          onCoachFinish: function () { setShowWelcome(false); },
        }}
        profileProps={{
          open: profileModalOpen, esAlumno, sessionData, profileEdit,
          setProfileEdit, profileFileRef, bgSub, border, textMain, msg,
          onClose: function () { setProfileModalOpen(false); },
          onSave: function () {
            try {
              var fullName = [profileEdit.nombre, profileEdit.apellido].filter(Boolean).join(" ").trim() || profileEdit.email || "Atleta";
              var next = { ...sessionData, name: fullName, email: profileEdit.email, phone: profileEdit.phone, avatarUrl: profileEdit.avatarDataUrl || sessionData.avatarUrl };
              localStorage.setItem("it_session", JSON.stringify(next));
              setSessionData(next);
              setProfileModalOpen(false);
              toast2(msg("Perfil guardado ✓", "Profile saved ✓"));
            } catch (err) { toast2("Error"); }
          },
        }}
        settingsOpen={settingsOpen}
        esAlumno={esAlumno}
        sessionData={sessionData}
        tab={tab}
        coachSettingsProps={{
          coach: sessionData,
          onClose: ()=>setSettingsOpen(false),
          toast2, setSessionData, syncStateWithLocalStorage,
          lang, setLang, darkMode, setDarkMode, es,
          alumnosCount: alumnos.length,
          rutinasActivasCount: rutinasSBEntrenador.length,
          sesionesGlobales, sb,
          entrenadorId: supabaseSessionUserId || sessionData?.entrenadorId || null,
        }}
        alumnoSettingsProps={{
          open: settingsOpen, darkMode, lang, msg, es, toast2,
          onClose: function () { setSettingsOpen(false); },
          onToggleDarkMode: function () { var v = !darkMode; setDarkMode(v); localStorage.setItem("it_dark", v ? "true" : "false"); },
          onChangeLang: function (code) { setLang(code); localStorage.setItem("it_lang", code); },
          onLogoutSettings: function () { setCoachDialog({ t: 'logoutSettings' }); },
        }}
      />
      <PRCelebrationOverlay prCelebration={prCelebration} setPrCelebration={setPrCelebration} msg={msg} />
      <WorkoutSessionSummary
        resumenSesion={resumenSesion}
        sessionPRList={sessionPRList}
        msg={msg}
        darkMode={darkMode}
        bgCard={bgCard}
        border={border}
        textMuted={textMuted}
        textMain={textMain}
        allEx={allEx}
        videoOverrides={videoOverrides}
        onClose={()=>setResumenSesion(null)}
        onShareImage={shareSessionSummaryImage}
      />
      <AppExerciseModals
        detailEx={detailEx}
        detailProps={{
          exercise: detailExHistoryData.exercise,
          history: detailExHistoryData.history,
          pattern: detailExHistoryData.pattern,
          imageSrc: detailExHistoryData.imageSrc,
          videoSrc: detailExHistoryData.videoSrc,
          canAddToRoutine: !!(expandedR&&selDay!==null),
          darkMode, es, msg, btn, lbl, tag, bgCard, textMain, textMuted,
          onClose: ()=>setDetailEx(null),
          onAddToRoutine: ()=>{
            setRoutines(p=>p.map(r=>r.id===expandedR?{...r,days:r.days.map((d,i)=>i===selDay?{...d,exercises:[...d.exercises,{id:detailEx.id,sets:"3",reps:"8-10",kg:"",pause:90,note:"",weeks:[]}]}:d)}:r));
            toast2("Ejercicio agregado");
            setDetailEx(null);
            setTab("plan");
          },
        }}
        editProps={{
          editEx, darkMode, btn, inp, allEx, es, PATS, msg,
          onSave: async(updatedRaw)=>{
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
                const payload={nombre:rActual.name,alumno_id:rActual.alumno_id||null,datos:{days:updatedDays,alumno:rActual.alumno||"",note:rActual.note||""},entrenador_id:rActual.entrenador_id};
                if(rActual.saved){ await sb.updateRutina(rActual.id,payload); }
                else { const res = await sb.createRutina(payload); if(res&&res[0]){setRoutines(p=>p.map(r=>r.id===rActual.id?{...r,id:res[0].id,saved:true}:r));} }
              } else {
                // Buscar en rutinasSB (edición desde vista alumno)
                const rSB = (rutinasSBEntrenador||[]).find(x=>String(x.id)===String(editEx.rId)) || (rutinasSB||[]).find(x=>String(x.id)===String(editEx.rId));
                if(rSB) {
                  const diasActualizados = sanitizeRoutineDaysForWrite(replaceExerciseInDays(rSB.datos?.days||[]));
                  const payloadSB = {nombre:rSB.nombre,alumno_id:rSB.alumno_id,datos:{...rSB.datos,days:diasActualizados},entrenador_id:rSB.entrenador_id};
                  updateRutinaRowsLocal(rSB.id, diasActualizados);
                  await sb.updateRutina(rSB.id, payloadSB);
                }
              }
            } catch(e){ console.error("Auto-save error:",e); }
            setEditEx(null);toast2("Guardado âœ“");
          },
          onClose: ()=>setEditEx(null),
        }}
      />
      <CoachEditStudentModal
        editAlumnoModal={editAlumnoModal}
        editAlumnoEmail={editAlumnoEmail}
        setEditAlumnoEmail={setEditAlumnoEmail}
        editAlumnoPass={editAlumnoPass}
        setEditAlumnoPass={setEditAlumnoPass}
        darkMode={darkMode}
        bgCard={bgCard}
        border={border}
        textMuted={textMuted}
        inp={inp}
        onClose={()=>setEditAlumnoModal(null)}
        onSave={async()=>{
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
        }}
      />
      {newR&&(
        <NewRoutineModal
          newR={newR}
          setNewR={setNewR}
          es={es}
          msg={msg}
          lbl={lbl}
          inp={inp}
          btn={btn}
          textMuted={textMuted}
          bgCard={bgCard}
          bgSub={bgSub}
          border={border}
          setRoutines={setRoutines}
          setAssignRoutineId={setAssignRoutineId}
          uid={uid}
          toast2={toast2}
        />
      )}

                  {/* ── Modal duplicar día ── */}
      <DuplicateDayModal
        dupDayModal={dupDayModal}
        dupDayClosing={dupDayClosing}
        bgSub={bgSub}
        border={border}
        textMain={textMain}
        textMuted={textMuted}
        msg={msg}
        onClose={closeDupDayModalAnimated}
        onToggleDay={toggleDupDayDestination}
        onConfirm={confirmDuplicateDay}
      />
            {/* ── Modal chat entrenador ── */}
      <CoachChatModal
        chatModal={chatModal}
        darkMode={darkMode}
        es={es}
        sb={sb}
        bgCard={bgCard}
        border={border}
        textMain={textMain}
        textMuted={textMuted}
        msg={msg}
        onMensajesLeidos={handleCoachMensajesLeidos}
        onClose={()=>setChatModal(null)}
      />
      <LoginModalHost
        open={loginModal} user={user} bgCard={bgCard} textMuted={textMuted}
        darkMode={darkMode} es={es} btn={btn} inp={inp} lbl={lbl} msg={msg}
        onClose={()=>setLoginModal(false)}
        onLogout={()=>{localStorage.removeItem("it_u");setUser(null);setLoginModal(false);toast2("Sesion cerrada");}}
        onLogin={u=>{setUser(u);localStorage.setItem("it_u",JSON.stringify(u));setLoginModal(false);toast2("Hola "+u.name+"!");}}
      />
      {aliasModal&&(
        <PaymentInfoModal
          form={aliasForm}
          setForm={setAliasForm}
          bgCard={bgCard}
          bgSub={bgSub}
          border={border}
          textMain={textMain}
          textMuted={textMuted}
          darkMode={darkMode}
          green={green}
          msg={msg}
          onClose={()=>setAliasModal(false)}
          onSave={() => { sb.saveConfig(aliasForm).then(()=>{
            setAliasData(aliasForm);
            setAliasModal(false);
            toast2(msg("Datos de pago guardados ✓", "Payment info saved ✓"));
          }).catch(()=>toast2("Error al guardar")); }}
        />
      )}
      <AddExerciseModal
        addExModal={addExModal}
        addExSearch={addExSearch}
        setAddExSearch={setAddExSearch}
        addExPat={addExPat}
        setAddExPat={setAddExPat}
        addExMuscle={addExMuscle}
        setAddExMuscle={setAddExMuscle}
        addExSelectedIds={addExSelectedIds}
        setAddExSelectedIds={setAddExSelectedIds}
        allEx={allEx}
        coachDesktopNavHidden={coachDesktopNavHidden}
        darkMode={darkMode}
        es={es}
        lang={lang}
        msg={msg}
        btn={btn}
        inp={inp}
        bgCard={bgCard}
        border={border}
        textMuted={textMuted}
        onClose={()=>{setAddExModal(null);setAddExSelectedIds([]);}}
        onConfirm={async function(){
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
              await sb.updateRutina(rSB.id,{nombre:rSB.nombre,alumno_id:rSB.alumno_id,datos:{...rSB.datos,days:diasAct},entrenador_id:rSB.entrenador_id});
              setRutinasSB(function(prev){return prev.map(function(rw){return rw.id===rSB.id?{...rw,datos:{...rw.datos,days:diasAct}}:rw;});});
            }catch(e){console.error("Add batch save error:",e);}
          }
          toast2((msg("Agregados ", "Added "))+newExs.length+(msg(" ejercicios", " exercises")));
          setAddExModal(null);
          setAddExSelectedIds([]);
        }}
      />
      <ToastBanner toast={toast} darkMode={darkMode} border={border} textMain={textMain} />

      </AppMainScroll>
      </CoachDesktopShellFrame>
      {/* Modal video: fuera del scroll (display:none con sesi?n ocultaba el overlay) + portal a body */}
      <VideoModal videoModal={videoModal} setVideoModal={setVideoModal} />
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
          currentWeek={esAlumno ? studentCurrentWeek : currentWeek}
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
          onSesionGuardada={async function () {
            if (sessionData?.alumnoId) {
              var fresh = await sb.getSesiones(sessionData.alumnoId);
              setSesiones(fresh || []);
            }
          }}
        />
      )}
      {!resumenSesion && !hideGlobalBottomNavCoachDash && !(showCoachDesktopShell && coachDesktop1024) && (
        <GlobalBottomNav
          ref={globalBottomNavRef}
          darkMode={darkMode}
          esAlumno={esAlumno}
          tabs2={tabs2}
          tab={tab}
          setTab={setTab}
        />
      )}
      </div>
    </div>
    {(coachDialog.t === 'logout' || coachDialog.t === 'logoutSettings') && (
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:10000,display:"flex",alignItems:"center",justifyContent:"center"}}
        onClick={function(){if(!coachDialogLoading)setCoachDialog({t:'none'});}}>
        <div style={{background:"#111827",borderRadius:16,padding:"24px 20px",width:"calc(100% - 48px)",maxWidth:320,margin:"0 auto",display:"flex",flexDirection:"column",gap:12}}
          onClick={function(e){e.stopPropagation();}}>
          <div style={{textAlign:"center"}}>
            <div style={{width:44,height:44,borderRadius:"50%",background:"rgba(59,130,246,0.15)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}>
              <Ic name="log-out" size={20} color="#60a5fa"/>
            </div>
            <div style={{fontSize:20,fontWeight:800,color:"#fff",marginBottom:6}}>{msg('¿Cerrar sesión?','Log out?','Encerrar sessão?')}</div>
            <div style={{fontSize:14,color:"#94a3b8",lineHeight:1.5}}>{msg('Vas a salir y tendrás que volver a iniciar sesión.','You\'ll sign out and will need to sign in again.','Você sairá e precisará entrar de novo.')}</div>
          </div>
          <button style={{padding:"13px 0",borderRadius:10,fontSize:14,fontWeight:600,width:"100%",cursor:"pointer",background:"linear-gradient(135deg,#3b82f6,#2563eb)",color:"#fff",border:"none",fontFamily:"inherit"}}
            disabled={coachDialogLoading}
            onClick={function(){void confirmCoachDialog();}}>
            {coachDialogLoading ? msg('Cerrando…','Signing out…','Saindo…') : msg('Cerrar sesión','Log out','Sair')}
          </button>
          <button style={{padding:"13px 0",borderRadius:10,fontSize:14,fontWeight:600,width:"100%",cursor:"pointer",background:"rgba(148,163,184,0.08)",color:"#fff",border:"1px solid rgba(148,163,184,0.32)",fontFamily:"inherit"}}
            disabled={coachDialogLoading}
            onClick={function(){if(!coachDialogLoading)setCoachDialog({t:'none'});}}>
            {msg('Cancelar','Cancel','Cancelar')}
          </button>
        </div>
      </div>
    )}
    {(() => {
      var cfg = getCoachDialogModalConfig(coachDialog, msg, es);
      return (
    <CoachConfirmDialog
      dialog={(coachDialog.t === 'logout' || coachDialog.t === 'logoutSettings') ? {t:'none'} : coachDialog}
      config={cfg}
      loading={coachDialogLoading}
      cancelLabel={msg('Cancelar', 'Cancel', 'Cancelar')}
      onCancel={function () {
        if (coachDialogLoading) return;
        setCoachDialog({ t: 'none' });
      }}
      onConfirm={function () {
        void confirmCoachDialog();
      }}
    />
      );
    })()}
    </IronTrackI18nProvider>
    </>
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
