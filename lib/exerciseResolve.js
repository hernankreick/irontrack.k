/**
 * Canonical exercise fields in the UI layer:
 *   name, nameEn, video_url, isCustom
 *
 * Reads: pickVideoUrl / resolveVideoUrl may still use legacy `youtube`, `youtube_url`, or videoUrl on
 * old rows until DB/local JSON is fully migrated.
 *
 * Writes: use sanitizeExerciseSnapshotForWrite / sanitizeRoutineDaysForWrite so persisted
 * data and API payloads never include `youtube`; dropping the column later is safe.
 */

/** UI / último recurso al mostrar (nunca usar id como etiqueta). */
export const FALLBACK_EXERCISE_NAME = {
  es: "Ejercicio sin nombre",
  en: "Unnamed exercise",
};

const warnEx =
  typeof console !== "undefined" && typeof console.warn === "function"
    ? console.warn.bind(console)
    : function () {};

function isBlankOrPlaceholderName(s) {
  if (s == null || s === "") return true;
  const t = String(s).trim().toLowerCase();
  return t === "custom" || t === "ejercicio" || t === "exercise";
}

/** Primer texto no vacío ni placeholder (orden de preferencia). */
function firstDisplayableName(...vals) {
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i];
    if (v == null) continue;
    const t = String(v).trim();
    if (!isBlankOrPlaceholderName(t)) return t;
  }
  return "";
}

/** http(s) absoluto; rechaza espacios y valores no parseables por URL. */
export function isValidHttpUrlString(s) {
  if (s == null || typeof s !== "string") return false;
  const t = s.trim();
  if (!t) return false;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Single object: canonical video_url first, then legacy youtube (read-only fallback). */
export function pickVideoUrl(exerciseLike) {
  if (!exerciseLike || typeof exerciseLike !== "object") return "";
  const u =
    exerciseLike.video_url ||
    exerciseLike.youtube ||
    exerciseLike.youtube_url ||
    exerciseLike.videoUrl ||
    "";
  return typeof u === "string" ? u.trim() : "";
}

/**
 * Merge library row + routine instance; video overrides (coach) win.
 * Order: override → video_url → youtube (temporary fallback).
 */
export function resolveVideoUrl(info, ex, videoOverrides) {
  const id = ex?.id || info?.id;
  if (id && videoOverrides && videoOverrides[id]) {
    const o = videoOverrides[id];
    return typeof o === "string" ? o.trim() : "";
  }
  const fromInfo = info ? pickVideoUrl(info) : "";
  const fromEx = ex ? pickVideoUrl(ex) : "";
  return fromInfo || fromEx || "";
}

/** @deprecated Use resolveVideoUrl */
export const resolveYoutubeUrl = resolveVideoUrl;

/**
 * @param {object|null} info - Library row (EX or custom)
 * @param {object|null} ex - Routine exercise snapshot
 * @param {boolean} es - Spanish UI
 */
export function resolveExerciseTitle(info, ex, es) {
  const candidates = [];
  if (info) {
    if (es) {
      candidates.push(info.name, info.nameEn, info.nombre);
    } else {
      candidates.push(info.nameEn, info.name, info.nombre);
    }
  }
  if (ex) {
    candidates.push(ex.name, ex.nameEn, ex.nombre);
  }
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (!isBlankOrPlaceholderName(c)) return String(c).trim();
  }
  return es ? FALLBACK_EXERCISE_NAME.es : FALLBACK_EXERCISE_NAME.en;
}

/**
 * Normalizes a library exercise: fills video_url from legacy youtube; sets isCustom.
 * @param {object} e - raw row
 * @param {{ catalog?: boolean }} opts - catalog entries from EX are not custom
 */
export function normalizeLibraryExercise(e, opts) {
  if (!e || typeof e !== "object") return e;
  const catalog = opts && opts.catalog;
  const vu = pickVideoUrl(e);
  const { youtube: _yt, videoUrl: _vv, youtube_url: _yurl, nombre: _nom, ...rest } = e;
  const ic = catalog
    ? false
    : e.isCustom === true ||
      e.is_custom === true ||
      String(e.id || "").indexOf("custom_") === 0;

  let nameOut = firstDisplayableName(e.name, e.nombre, e.nameEn);
  let nameEnOut = firstDisplayableName(e.nameEn, e.name, e.nombre);
  if (!nameOut) {
    warnEx("[exercise] biblioteca: fila sin name · id=", e.id);
    nameOut = FALLBACK_EXERCISE_NAME.es;
  }
  if (!nameEnOut) nameEnOut = FALLBACK_EXERCISE_NAME.en;
  let videoOut = null;
  if (vu) {
    if (isValidHttpUrlString(vu)) videoOut = vu.trim();
    else warnEx("[exercise] biblioteca: video_url inválido · id=", e.id, vu);
  }
  return {
    ...rest,
    name: nameOut,
    nameEn: nameEnOut,
    video_url: videoOut,
    isCustom: ic,
  };
}

/**
 * Exercise object persisted to routines / storage / API: only video_url (never duplicate youtube).
 * Legacy snapshots may still have youtube only — pickVideoUrl merges before strip.
 * @param {{ silent?: boolean }} opts - si silent: true, no console.warn
 */
export function sanitizeExerciseSnapshotForWrite(ex, options) {
  const opts = options && typeof options === "object" && !Array.isArray(options) ? options : {};
  const silent = opts.silent === true;
  const log = silent ? function () {} : warnEx;
  if (!ex || typeof ex !== "object") return ex;

  const rawVu = pickVideoUrl(ex);
  const hadRawVideoField =
    (ex.video_url != null && String(ex.video_url).trim() !== "") ||
    (ex.youtube != null && String(ex.youtube).trim() !== "") ||
    (ex.youtube_url != null && String(ex.youtube_url).trim() !== "") ||
    (ex.videoUrl != null && String(ex.videoUrl).trim() !== "");

  const { youtube: _y, videoUrl: _v, youtube_url: _yu, ...rest } = ex;
  const out = { ...rest };

  let nm = out.name != null ? String(out.name).trim() : "";
  let nmen = out.nameEn != null ? String(out.nameEn).trim() : "";
  const nom = out.nombre != null ? String(out.nombre).trim() : "";

  if (!nm && nom) nm = nom;
  if (isBlankOrPlaceholderName(nm)) nm = "";
  if (isBlankOrPlaceholderName(nmen)) nmen = "";
  if (!nm && nmen && !isBlankOrPlaceholderName(nmen)) nm = nmen;

  if (!nm) {
    log("[exercise] snapshot sin name · id=", out.id ?? ex.id ?? "?");
    nm = FALLBACK_EXERCISE_NAME.es;
  }
  if (!nmen) nmen = FALLBACK_EXERCISE_NAME.en;

  out.name = nm;
  out.nameEn = nmen;
  if ("nombre" in out) delete out.nombre;

  let videoFinal = null;
  if (rawVu) {
    if (isValidHttpUrlString(rawVu)) videoFinal = rawVu.trim();
    else {
      log("[exercise] video_url inválido · id=", out.id ?? ex.id ?? "?", rawVu);
      videoFinal = null;
    }
  } else if (hadRawVideoField && !rawVu) {
    log("[exercise] video_url vacío (solo espacios) · id=", out.id ?? ex.id ?? "?");
  }

  out.video_url = videoFinal;

  return out;
}

/** Sanitize all exercise snapshots inside routine days before save. */
export function sanitizeRoutineDaysForWrite(days, options) {
  const opts = options && typeof options === "object" && !Array.isArray(options) ? options : {};
  if (!Array.isArray(days)) return days;
  return days.map((d) => ({
    ...d,
    warmup: (d.warmup || []).map((ex) => sanitizeExerciseSnapshotForWrite(ex, opts)),
    exercises: (d.exercises || []).map((ex) => sanitizeExerciseSnapshotForWrite(ex, opts)),
  }));
}
