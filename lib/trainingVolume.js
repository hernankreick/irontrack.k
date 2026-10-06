// Card "Volumen de entrenamiento" (ultimas 4 semanas, kg x reps) -- logica pura, sin React.
//
// Contrato (preflight aprobado):
//  * today = fecha calendario local del dispositivo; todo se clasifica por numero de dia
//    entero (Date.UTC(y,m-1,d)/86400000), nunca por milisegundos ni por Date.parse(fecha).
//  * CURRENT = off 0..27, PREVIOUS = off 28..55, con off = today - dia(fecha).
//  * Barras CURRENT: B1 27..21, B2 20..14, B3 13..7, B4 6..0 (siempre las cuatro; vacia = 0).
//  * Una fila de `progreso` = una serie real. volumen = kg x reps. Sin promedios, sin reps<=50.
//  * currentTotal = TODAS las series validas de CURRENT. El porcentaje es like-for-like:
//    usa SOLO currentComparable / previousComparable y NUNCA currentTotal.
//  * Metadata de ejercicios: unicamente el catalogo estatico (EX). Un id que no esta alli
//    (p. ej. custom_*) es `no_resoluble`: el alumno no puede leer ejercicios_custom y el
//    snapshot de rutina no basta para declarar la naturaleza del ejercicio (solo se usa para
//    detectar objetivo de tiempo).

import { EX } from "./exerciseStaticData.js";
import {
  dedupeMatchedSets,
  exerciseHasTimeTarget,
  exerciseIsBodyweightLike,
  normalizeWorkoutSet,
} from "./workoutSession.js";

export const CURRENT_FIRST_OFF = 0;
export const CURRENT_LAST_OFF = 27;
export const PREVIOUS_FIRST_OFF = 28;
export const PREVIOUS_LAST_OFF = 55;

/** Barras CURRENT, de la mas vieja (B1) a la mas reciente (B4). `from` = off mayor, `to` = off menor. */
export const VOLUME_BLOCKS = [
  { key: "B1", from: 27, to: 21 },
  { key: "B2", from: 20, to: 14 },
  { key: "B3", from: 13, to: 7 },
  { key: "B4", from: 6, to: 0 },
];

/** Bloques de PREVIOUS usados solo para decidir si se muestra el porcentaje. */
export const PREVIOUS_BLOCKS = [
  { key: "P1", from: 55, to: 49 },
  { key: "P2", from: 48, to: 42 },
  { key: "P3", from: 41, to: 35 },
  { key: "P4", from: 34, to: 28 },
];

export const STRENGTH_PATTERNS = ["rodilla", "empuje", "traccion", "bisagra", "oly"];
export const NO_EXTERNAL_LOAD_EQUIP = ["libre", "colchoneta", "paralelas", "anillas", "banco", "banco 45", "rueda", "soga", "fitball"];

/** Motivos de exclusion, en el orden de evaluacion. */
export const EXCLUSION_REASONS = [
  "fecha_invalida",
  "fuera_de_ventana",
  "kg<=0",
  "reps<=0",
  "no_resoluble",
  "patron_no_fuerza",
  "equipo_sin_carga_externa",
  "peso_corporal_o_asistido",
  "objetivo_de_tiempo_en_rutina",
];

export const PCT_HIDDEN_REASONS = {
  COMMON_LT_2: "commonExercises<2",
  PREVIOUS_ZERO: "previousComparable=0",
  CURRENT_DAYS: "CURRENT_comparable_en_<2_dias",
  PREVIOUS_DAYS: "PREVIOUS_comparable_en_<2_dias",
  PREVIOUS_BLOCKS: "PREVIOUS_en_<2_bloques",
  INCOMPLETE: "retrieval_incompleto",
};

export const PAGE_SIZE = 1000;
export const DEFAULT_MAX_PAGES = 20;

// ---------------------------------------------------------------- fechas

/** Numero de dia (dias desde 1970-01-01, calendario UTC). */
export function dayNum(y, m, d) {
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

/** Numero de dia de la fecha calendario LOCAL de `now` (no depende de la hora ni del DST). */
export function todayDayNum(now) {
  var n = now instanceof Date ? now : new Date();
  return dayNum(n.getFullYear(), n.getMonth() + 1, n.getDate());
}

/**
 * Parser estricto de progreso.fecha: SOLO d/m/yyyy. Devuelve el numero de dia o null.
 * Nunca usa Date.parse / new Date(string) y jamas convierte una fecha invalida en "ahora".
 */
export function parseFechaDMY(value) {
  if (typeof value !== "string") return null;
  var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!m) return null;
  var d = Number(m[1]);
  var mo = Number(m[2]);
  var y = Number(m[3]);
  if (y < 2000 || y > 2100) return null;
  var dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dayNum(y, mo, d);
}

/** "08/09" para un numero de dia (aria-label de las barras). */
export function formatDayShort(day) {
  var dt = new Date(day * 86400000);
  return String(dt.getUTCDate()).padStart(2, "0") + "/" + String(dt.getUTCMonth() + 1).padStart(2, "0");
}

// ---------------------------------------------------------------- formato

/** Primero se redondea kg; despues <1000 -> "840 kg", >=1000 -> toneladas con 1 decimal y coma. */
export function formatVolume(kg) {
  var rounded = Math.round(Number(kg) || 0);
  if (rounded < 1000) return rounded + " kg";
  return (rounded / 1000).toFixed(1).replace(".", ",") + " t";
}

/** "+12%", "-28%" o "0%" (si |delta| < 0.5%). */
export function formatPct(pct) {
  var rounded = Math.round(pct);
  if (!Number.isFinite(pct) || Math.abs(pct) < 0.5 || rounded === 0) return "0%";
  return (rounded > 0 ? "+" : "") + rounded + "%";
}

// ---------------------------------------------------------------- clasificacion

function buildCatalog(list) {
  var out = {};
  (Array.isArray(list) ? list : []).forEach(function (e) {
    if (e && e.id != null) out[e.id] = e;
  });
  return out;
}

var DEFAULT_CATALOG = buildCatalog(EX);

/**
 * Clasifica un ejercicio por id: { ok:true } o { ok:false, reason }.
 *  catalog: id -> definicion estatica (unica fuente de naturaleza del ejercicio).
 *  timeDefsById: id -> [definiciones/snapshots de rutina]; solo sirve para objetivo de tiempo.
 */
export function classifyExercise(id, catalog, timeDefsById) {
  var source = catalog || DEFAULT_CATALOG;
  var def = id != null ? source[id] : null;
  if (!def) return { ok: false, reason: "no_resoluble" };
  var pattern = String(def.pattern == null ? "" : def.pattern).trim().toLowerCase();
  if (STRENGTH_PATTERNS.indexOf(pattern) === -1) return { ok: false, reason: "patron_no_fuerza" };
  var equip = String(def.equip == null ? "" : def.equip).trim().toLowerCase();
  if (NO_EXTERNAL_LOAD_EQUIP.indexOf(equip) !== -1) return { ok: false, reason: "equipo_sin_carga_externa" };
  if (exerciseIsBodyweightLike(def)) return { ok: false, reason: "peso_corporal_o_asistido" };
  var snapshots = (timeDefsById && timeDefsById[id]) || [];
  for (var i = 0; i < snapshots.length; i++) {
    if (exerciseHasTimeTarget(snapshots[i])) return { ok: false, reason: "objetivo_de_tiempo_en_rutina" };
  }
  return { ok: true };
}

/** id -> [snapshots] de los ejercicios (calentamiento + principales) de las rutinas dadas. */
export function collectRoutineExerciseDefs(routines) {
  var out = {};
  (Array.isArray(routines) ? routines : []).forEach(function (r) {
    var days = (r && (r.days || (r.datos && r.datos.days))) || [];
    days.forEach(function (day) {
      [].concat((day && day.warmup) || [], (day && day.exercises) || []).forEach(function (ex) {
        if (!ex || ex.id == null) return;
        (out[ex.id] = out[ex.id] || []).push(ex);
      });
    });
  });
  return out;
}

// ---------------------------------------------------------------- calculo

function emptyDiagnostics() {
  var byReason = {};
  EXCLUSION_REASONS.forEach(function (r) { byReason[r] = { sets: 0, volume: 0, ids: {} }; });
  return { byReason: byReason };
}

function sumValues(obj) {
  var t = 0;
  Object.keys(obj).forEach(function (k) { t += obj[k]; });
  return t;
}

/**
 * Calcula el modelo de la card.
 *  rows: [{ ejercicio_id, kg, reps, fecha }] (una fila = una serie)
 *  opts: { today (numero de dia), complete (retrieval completo, default true), catalog, routineExerciseDefs }
 */
export function computeTrainingVolume(rows, opts) {
  var o = opts || {};
  var today = o.today;
  var catalog = o.catalog || DEFAULT_CATALOG;
  var timeDefs = o.routineExerciseDefs || {};
  var complete = o.complete !== false;
  var diagnostics = emptyDiagnostics();

  var blocks = VOLUME_BLOCKS.map(function (b) {
    return { key: b.key, from: b.from, to: b.to, startDay: today - b.from, endDay: today - b.to, kg: 0 };
  });

  var result = {
    today: today,
    complete: complete,
    currentTotal: 0,
    previousTotal: 0,
    blocks: blocks,
    currentByExercise: {},
    previousByExercise: {},
    commonExercises: [],
    currentComparable: 0,
    previousComparable: 0,
    pct: null,
    pctLabel: null,
    showPct: false,
    pctHiddenReasons: [],
    currentDays: [],
    previousDays: [],
    comparableCurrentDays: [],
    comparablePreviousDays: [],
    comparablePreviousBlocks: [],
    showCard: false,
    diagnostics: diagnostics,
  };

  if (!complete || !Number.isFinite(today)) {
    result.pctHiddenReasons = [PCT_HIDDEN_REASONS.INCOMPLETE];
    return result;
  }

  var classCache = {};
  var currentSets = [];
  var previousSets = [];

  (Array.isArray(rows) ? rows : []).forEach(function (row) {
    var id = row ? row.ejercicio_id : null;
    var kg = row ? parseFloat(row.kg) : NaN;
    var reps = row ? parseInt(row.reps, 10) : NaN;
    function exclude(reason) {
      var slot = diagnostics.byReason[reason];
      slot.sets += 1;
      if (kg > 0 && reps > 0) slot.volume += kg * reps;
      var key = id == null ? "(sin id)" : String(id);
      slot.ids[key] = (slot.ids[key] || 0) + 1;
    }

    var day = row ? parseFechaDMY(row.fecha) : null;
    if (day == null) return exclude("fecha_invalida");
    var off = today - day;
    if (off < CURRENT_FIRST_OFF || off > PREVIOUS_LAST_OFF) return exclude("fuera_de_ventana");
    if (!(kg > 0)) return exclude("kg<=0");
    if (!(reps > 0)) return exclude("reps<=0");
    var key = String(id);
    if (!Object.prototype.hasOwnProperty.call(classCache, key)) classCache[key] = classifyExercise(id, catalog, timeDefs);
    var cls = classCache[key];
    if (!cls.ok) return exclude(cls.reason);

    var set = { id: key, day: day, off: off, volume: kg * reps };
    if (off <= CURRENT_LAST_OFF) currentSets.push(set);
    else previousSets.push(set);
  });

  var currentDays = {};
  var previousDays = {};
  currentSets.forEach(function (s) {
    result.currentByExercise[s.id] = (result.currentByExercise[s.id] || 0) + s.volume;
    currentDays[s.day] = true;
    for (var i = 0; i < VOLUME_BLOCKS.length; i++) {
      if (s.off <= VOLUME_BLOCKS[i].from && s.off >= VOLUME_BLOCKS[i].to) { blocks[i].kg += s.volume; break; }
    }
  });
  previousSets.forEach(function (s) {
    result.previousByExercise[s.id] = (result.previousByExercise[s.id] || 0) + s.volume;
    previousDays[s.day] = true;
  });

  result.currentTotal = sumValues(result.currentByExercise);
  result.previousTotal = sumValues(result.previousByExercise);
  result.currentDays = Object.keys(currentDays).map(Number).sort(function (a, b) { return a - b; });
  result.previousDays = Object.keys(previousDays).map(Number).sort(function (a, b) { return a - b; });

  // Like-for-like: SOLO ejercicios con volumen valido > 0 en ambas ventanas.
  var common = Object.keys(result.currentByExercise).filter(function (id) {
    return result.currentByExercise[id] > 0 && (result.previousByExercise[id] || 0) > 0;
  });
  result.commonExercises = common;
  var commonSet = {};
  common.forEach(function (id) { commonSet[id] = true; });
  var currentComparable = 0;
  var previousComparable = 0;
  var cDays = {};
  var pDays = {};
  var pBlocks = {};
  currentSets.forEach(function (s) {
    if (!commonSet[s.id]) return;
    currentComparable += s.volume;
    cDays[s.day] = true;
  });
  previousSets.forEach(function (s) {
    if (!commonSet[s.id]) return;
    previousComparable += s.volume;
    pDays[s.day] = true;
    for (var i = 0; i < PREVIOUS_BLOCKS.length; i++) {
      if (s.off <= PREVIOUS_BLOCKS[i].from && s.off >= PREVIOUS_BLOCKS[i].to) { pBlocks[PREVIOUS_BLOCKS[i].key] = true; break; }
    }
  });
  result.currentComparable = currentComparable;
  result.previousComparable = previousComparable;
  result.comparableCurrentDays = Object.keys(cDays).map(Number).sort(function (a, b) { return a - b; });
  result.comparablePreviousDays = Object.keys(pDays).map(Number).sort(function (a, b) { return a - b; });
  result.comparablePreviousBlocks = PREVIOUS_BLOCKS.map(function (b) { return b.key; }).filter(function (k) { return pBlocks[k]; });

  // pct = (currentComparable - previousComparable) / previousComparable * 100. currentTotal NO interviene.
  result.pct = previousComparable > 0 ? ((currentComparable - previousComparable) / previousComparable) * 100 : null;

  var reasons = [];
  if (common.length < 2) reasons.push(PCT_HIDDEN_REASONS.COMMON_LT_2);
  if (!(previousComparable > 0)) reasons.push(PCT_HIDDEN_REASONS.PREVIOUS_ZERO);
  if (result.comparableCurrentDays.length < 2) reasons.push(PCT_HIDDEN_REASONS.CURRENT_DAYS);
  if (result.comparablePreviousDays.length < 2) reasons.push(PCT_HIDDEN_REASONS.PREVIOUS_DAYS);
  if (result.comparablePreviousBlocks.length < 2) reasons.push(PCT_HIDDEN_REASONS.PREVIOUS_BLOCKS);
  result.pctHiddenReasons = reasons;
  result.showPct = reasons.length === 0 && result.pct != null;
  result.pctLabel = result.showPct ? formatPct(result.pct) : null;

  result.showCard = result.currentTotal > 0 && result.currentDays.length >= 2;
  return result;
}

// ---------------------------------------------------------------- remoto + local

/**
 * Combina filas remotas con las series locales aun no sincronizadas SIN colapsar multiplicidad real:
 * por ejercicio usa dedupeMatchedSets (max(local, remoto) por firma kg|reps|fecha|semana|nota).
 *  remoteRows: filas crudas de `progreso`; progress: estado local { [exId]: { sets: [...] } }.
 * Devuelve filas { ejercicio_id, kg, reps, fecha }.
 */
export function mergeRemoteAndLocalRows(remoteRows, progress) {
  var remoteById = {};
  (Array.isArray(remoteRows) ? remoteRows : []).forEach(function (row) {
    if (!row || row.ejercicio_id == null) return;
    var id = String(row.ejercicio_id);
    (remoteById[id] = remoteById[id] || []).push(normalizeWorkoutSet({
      kg: row.kg, reps: row.reps, date: row.fecha, week: row.semana, note: row.nota, created_at: row.created_at,
    }));
  });
  var ids = {};
  Object.keys(remoteById).forEach(function (k) { ids[k] = true; });
  var local = progress && typeof progress === "object" ? progress : {};
  Object.keys(local).forEach(function (k) { ids[k] = true; });

  var out = [];
  Object.keys(ids).forEach(function (id) {
    var localSets = local[id] && Array.isArray(local[id].sets) ? local[id].sets : [];
    var merged = dedupeMatchedSets(localSets, remoteById[id] || []);
    merged.forEach(function (s) {
      out.push({ ejercicio_id: id, kg: s.kg, reps: s.reps, fecha: s.date });
    });
  });
  return out;
}

// ---------------------------------------------------------------- recuperacion paginada

/** Corte de prefiltro: medianoche LOCAL de (today-55) menos 3 dias, en ISO UTC. Solo prefiltro; nunca decide la ventana. */
export function getCreatedAtCutoffISO(now) {
  var n = now instanceof Date ? now : new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate() - PREVIOUS_LAST_OFF - 3).toISOString();
}

export function buildProgressPagePath(alumnoId, cutoffISO, offset) {
  return "progreso?alumno_id=eq." + encodeURIComponent(String(alumnoId)) +
    "&select=id,ejercicio_id,kg,reps,fecha,semana,nota,created_at" +
    "&created_at=gte." + encodeURIComponent(cutoffISO) +
    "&order=created_at.desc,id.desc&limit=" + PAGE_SIZE + "&offset=" + offset;
}

/**
 * Lee TODAS las filas de progreso del alumno posteriores al corte, de a PAGE_SIZE, hasta recibir una pagina corta.
 *  fetchPage(path) -> Promise<array | null>  (null/no-array = error)
 * Devuelve { complete, rows, pages }. Cualquier pagina fallida, o alcanzar el tope de paginas sin una
 * pagina corta, => complete:false (la card se oculta; nunca se muestra 0 kg).
 */
export async function fetchTrainingVolumeRows(fetchPage, alumnoId, opts) {
  var o = opts || {};
  var maxPages = o.maxPages || DEFAULT_MAX_PAGES;
  var cutoff = getCreatedAtCutoffISO(o.now);
  var rows = [];
  if (typeof fetchPage !== "function" || alumnoId == null || alumnoId === "") return { complete: false, rows: rows, pages: 0 };
  for (var page = 0; page < maxPages; page++) {
    var data;
    try {
      data = await fetchPage(buildProgressPagePath(alumnoId, cutoff, page * PAGE_SIZE));
    } catch (e) {
      return { complete: false, rows: rows, pages: page };
    }
    if (!Array.isArray(data)) return { complete: false, rows: rows, pages: page };
    for (var i = 0; i < data.length; i++) rows.push(data[i]);
    if (data.length < PAGE_SIZE) return { complete: true, rows: rows, pages: page + 1 };
  }
  return { complete: false, rows: rows, pages: maxPages };
}
