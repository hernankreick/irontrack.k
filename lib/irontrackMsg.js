/**
 * Texto UI trilingüe (es / en / pt).
 * Si `pt` se omite, en portugués se usa la cadena en inglés.
 */
export function irontrackMsg(lang, es, en, pt) {
  if (lang === 'es') return es;
  if (lang === 'pt') return pt !== undefined && pt !== null && pt !== '' ? pt : en;
  return en;
}

/** `localeCompare` / Intl según idioma de la app. */
export function localeForSort(lang) {
  if (lang === 'es') return 'es';
  if (lang === 'pt') return 'pt';
  return 'en';
}

/**
 * Nombre de ejercicio en biblioteca: español / inglés / portugués (namePt opcional).
 */
export function pickExerciseName(ex, lang) {
  if (!ex) return '';
  if (lang === 'es') return ex.name || '';
  if (lang === 'pt') return ex.namePt || ex.nameEn || ex.name || '';
  return ex.nameEn || ex.name || '';
}

/** Etiqueta de patrón PATS u objeto con label / labelEn / labelPt. */
export function pickPatLabel(pat, lang) {
  if (!pat) return '';
  if (lang === 'es') return pat.label || '';
  if (lang === 'pt') return pat.labelPt || pat.labelEn || pat.label || '';
  return pat.labelEn || pat.label || '';
}
