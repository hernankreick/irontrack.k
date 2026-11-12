/**
 * Pausa entre series: normaliza el valor cargado por el coach (numero o texto) a segundos enteros.
 * JS puro, sin React. Fuente unica para el panel de entrenamiento y la vista Plan.
 */

export const DEFAULT_REST_SECONDS = 90;

const NUM = "(\\d+(?:[.,]\\d+)?)";
const SEC_U = "(?:s|sec|secs|seg|segs|segundo|segundos|second|seconds)";
const MIN_U = "(?:m|min|mins|minuto|minutos|minute|minutes)";

const RE_PLAIN = /^\d+$/;
const RE_CLOCK = /^(\d+):(\d{1,2})$/;
const RE_SEC = new RegExp("^(\\d+)\\s*" + SEC_U + "$");
const RE_MIN = new RegExp("^" + NUM + "\\s*" + MIN_U + "$");
const RE_MIN_SEC = new RegExp("^(\\d+)\\s*" + MIN_U + "\\s*(\\d+)\\s*" + SEC_U + "$");

function parseText(raw) {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  let m;
  if (RE_PLAIN.test(s)) return parseInt(s, 10);
  if ((m = RE_CLOCK.exec(s))) {
    const ss = parseInt(m[2], 10);
    if (m[2].length !== 2 || ss > 59) return null;
    return parseInt(m[1], 10) * 60 + ss;
  }
  if ((m = RE_SEC.exec(s))) return parseInt(m[1], 10);
  if ((m = RE_MIN_SEC.exec(s))) {
    const ss = parseInt(m[2], 10);
    return parseInt(m[1], 10) * 60 + ss;
  }
  if ((m = RE_MIN.exec(s))) return Math.round(parseFloat(m[1].replace(",", ".")) * 60);
  return null;
}

/**
 * @param {unknown} value
 * @param {{fallback?: number}} [opts]
 * @returns {number} segundos enteros >= 0 (0 = sin pausa / sin timer)
 */
export function resolveRestSeconds(value, opts) {
  const fb = opts && Number.isFinite(opts.fallback) && opts.fallback >= 0 ? Math.round(opts.fallback) : DEFAULT_REST_SECONDS;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return fb;
    return Math.round(value);
  }
  if (typeof value === "string") {
    const n = parseText(value);
    return n == null || !Number.isFinite(n) ? fb : n;
  }
  return fb;
}

/** Segundos con los que arranca el timer de descanso (0 = no arrancar). */
export function restTimerSeconds(value) {
  return resolveRestSeconds(value);
}
