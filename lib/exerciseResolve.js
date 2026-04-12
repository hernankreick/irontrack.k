/**
 * Resolves display name and video URL for a routine exercise + library entry.
 * Custom exercises may use Spanish columns (nombre, video_url) from Supabase.
 */

function isBlankOrPlaceholderName(s) {
  if (s == null || s === "") return true;
  const t = String(s).trim().toLowerCase();
  return t === "custom" || t === "ejercicio" || t === "exercise";
}

/**
 * @param {object|null} info - Entry from EX + customEx (library)
 * @param {object|null} ex - Exercise instance on a routine day { id, name?, ... }
 * @param {boolean} es - Spanish UI
 */
export function resolveExerciseTitle(info, ex, es) {
  const candidates = [];
  if (info) {
    if (es) {
      candidates.push(info.name, info.nombre, info.nameEn);
    } else {
      candidates.push(info.nameEn, info.name, info.nombre);
    }
  }
  if (ex) {
    candidates.push(ex.name, ex.nombre, ex.nameEn);
  }
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (!isBlankOrPlaceholderName(c)) return String(c).trim();
  }
  if (ex && ex.id != null) {
    const idStr = String(ex.id);
    if (idStr.startsWith("custom_")) {
      return es ? "Ejercicio personalizado" : "Custom exercise";
    }
    return idStr;
  }
  return es ? "Ejercicio" : "Exercise";
}

/**
 * @param {object|null} info - Library row
 * @param {object|null} ex - Routine exercise (may carry youtube snapshot)
 * @param {Record<string,string>|null|undefined} videoOverrides
 */
export function resolveYoutubeUrl(info, ex, videoOverrides) {
  const id = ex?.id || info?.id;
  if (id && videoOverrides && videoOverrides[id]) return videoOverrides[id] || "";
  const fromInfo =
    (info && (info.youtube || info.video_url || info.videoUrl)) || "";
  const fromEx = (ex && (ex.youtube || ex.videoUrl || ex.video_url)) || "";
  return fromInfo || fromEx || "";
}
