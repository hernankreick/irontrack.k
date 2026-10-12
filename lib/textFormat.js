/** Helpers puramente visuales: no modifican el dato guardado. */

/** "andrea miranda" -> "Andrea Miranda". Los emails se dejan tal cual. */
export function toTitleCase(value) {
  const s = value == null ? '' : String(value).trim();
  if (!s || s.indexOf('@') !== -1) return s;
  return s
    .toLocaleLowerCase()
    .replace(/(^|[\s\-'])(\S)/g, (_, sep, ch) => sep + ch.toLocaleUpperCase());
}

/** pluralize(1, "día", "días") -> "1 día"; pluralize(2, "día", "días") -> "2 días". */
export function pluralize(n, singular, plural) {
  const count = Number(n) || 0;
  return count + ' ' + (count === 1 ? singular : plural);
}

/** Iniciales (máx. 2) para el avatar del selector de alumno. */
export function initialsOf(value) {
  const parts = String(value == null ? '' : value)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase();
  return (parts[0][0] + parts[1][0]).toLocaleUpperCase();
}
