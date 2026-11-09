// Fecha del entrenamiento en "Validar sesion manualmente": helpers puros de formato (sin Supabase ni estado).
const AR_TZ = "America/Argentina/Buenos_Aires";
const DAY_MS = 86400000;
import { limitesFechaValidacion, MANUAL_FECHA_MAX_DIAS } from "../../lib/manualSessionValidation.js";
export const MAX_DIAS_ATRAS = MANUAL_FECHA_MAX_DIAS;

/** Fecha "aaaa-mm-dd" de un instante en hora de Argentina (en-CA formatea como ISO). */
export function isoDateAR(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: AR_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** "2026-10-05" -> "5/10/2026" (es-AR sin ceros iniciales). Invalida -> "". */
export function isoToFechaAR(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return "";
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return "";
  return d + "/" + mo + "/" + y;
}

/**
 * Limites del input date (D7.2): MISMA regla que el guardado (lib/manualSessionValidation.js, limitesFechaValidacion), en hora de
 * Argentina: max = hoy; min = el mas reciente entre 60 dias atras, la asignacion de la rutina y el inicio del ciclo vigente.
 * Acepta la rutina o (compatibilidad) solo su created_at.
 */
export function fechaLimites(rutinaOCreatedAt, now) {
  const rutina = rutinaOCreatedAt && typeof rutinaOCreatedAt === "object" && !(rutinaOCreatedAt instanceof Date)
    ? rutinaOCreatedAt
    : { created_at: rutinaOCreatedAt };
  return limitesFechaValidacion(rutina, now);
}

/**
 * H5: por que la fecha elegida no sirve, con LAS MISMAS comparaciones que deshabilitan «Confirmar» (iso < min / iso > max).
 * "antes" | "despues" | null (valida o sin seleccion: no hay nada que explicar todavia).
 */
export function fechaFueraDeRango(iso, limites) {
  if (!iso || !limites) return null;
  if (iso < limites.min) return "antes";
  if (iso > limites.max) return "despues";
  return null;
}
