import { fmtP } from './timeFormat.js';
import { estimateDayMinutes } from '../components/student-plan/studentPlanHelpers.js';

/**
 * PDF rutina: en móvil, `<a download>` dispara la UI inferior del sistema (Chrome/iOS) y tapa la PWA.
 * Abrir el HTML en una pestaña nueva evita esa barra sobre el contenido; el usuario imprime/guarda desde el navegador.
 */
export function ironTrackPreferPdfOpenInNewTab() {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia('(max-width: 768px)').matches) return true;
    if (window.matchMedia('(pointer: coarse)').matches) return true;
  } catch (e) {}
  return false;
}

function esc(t) {
  if (t == null || t === '') return '';
  return String(t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Paleta documento PDF (marca dark tech / neón). */
const PDF = {
  bg: '#050816',
  panel: '#0A1020',
  panel2: '#0B1224',
  border: 'rgba(80,140,255,0.18)',
  borderSoft: 'rgba(255,255,255,0.08)',
  neon: '#2F6BFF',
  glow: 'rgba(47,107,255,0.35)',
  text: '#F8FAFC',
  muted: '#94A3B8',
};

function estimateRoutineWeekMinutes(r, currentWeek) {
  var days = r.days || [];
  var t = 0;
  for (var i = 0; i < days.length; i++) {
    t += estimateDayMinutes(days[i], currentWeek);
  }
  return t;
}

/**
 * Isotipo minimal (mancuerna blanca) dentro de cuadrado con degradado azul. viewBox 64×64 del diseño base.
 */
function pdfHeaderLogoSvg(displaySize) {
  var s = displaySize || 56;
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    s +
    '" height="' +
    s +
    '" viewBox="0 0 64 64" fill="none" aria-hidden="true" style="display:block">' +
    '<defs>' +
    '<linearGradient id="itpdfLogoBg" x1="6" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse">' +
    '<stop stop-color="#7CB2FF"/>' +
    '<stop offset="0.45" stop-color="#3B82F6"/>' +
    '<stop offset="1" stop-color="#1D4ED8"/>' +
    '</linearGradient>' +
    '</defs>' +
    '<rect x="4" y="4" width="56" height="56" rx="14" fill="url(#itpdfLogoBg)"/>' +
    '<rect x="10" y="24" width="10" height="16" rx="3" fill="white"/>' +
    '<rect x="24" y="29" width="16" height="6" rx="3" fill="white"/>' +
    '<rect x="44" y="24" width="10" height="16" rx="3" fill="white"/>' +
    '</svg>'
  );
}

/** Cuenta ejercicios consecutivos tras cada cabecera de bloque (sin mutar el array original de filas). */
function enrichPdfRowsWithBlockCounts(rows) {
  return rows.map(function (row, i) {
    if (row.type !== 'warmup-header' && row.type !== 'main-header') return row;
    var n = 0;
    if (row.type === 'warmup-header') {
      for (var j = i + 1; j < rows.length && rows[j].type === 'warmup-ex'; j++) n++;
    } else {
      for (var k = i + 1; k < rows.length && rows[k].type === 'ex'; k++) n++;
    }
    return Object.assign({}, row, { _pdfBlockExCount: n });
  });
}

function pdfExerciseCountLabel(n, isEs) {
  if (isEs) {
    return n === 1 ? '1 ejercicio' : String(n) + ' ejercicios';
  }
  return n === 1 ? '1 exercise' : String(n) + ' exercises';
}

function pdfIconUser() {
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="' + PDF.muted + '" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
}
function pdfIconTarget() {
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="' + PDF.muted + '" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>';
}
function pdfIconClock() {
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="' + PDF.muted + '" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
}
function pdfIconCalendar() {
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="' + PDF.muted + '" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
}
function pdfIconDoc() {
  return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="' + PDF.neon + '" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>';
}

/**
 * HTML interior del PDF (marca premium dark tech). `theme` conserva compatibilidad; el PDF fuerza paleta propia para impresión consistente.
 */
export function buildRoutinePdfInnerHtml(r, rows, textMain, bgCard, border, darkMode, textMuted, es, currentWeek) {
  var cw = typeof currentWeek === 'number' && currentWeek >= 0 ? currentWeek : 0;
  var isEs = !!es;
  var weekMin = estimateRoutineWeekMinutes(r, cw);
  var alumnoLine = (r.alumno && String(r.alumno).trim()) || (isEs ? '—' : '—');
  var noteRaw = (r.note && String(r.note).trim()) || '';
  var metaNoteMax = 56;
  var objetivoLine = noteRaw
    ? noteRaw.length > metaNoteMax
      ? noteRaw.slice(0, metaNoteMax) + '…'
      : noteRaw
    : isEs
      ? '—'
      : '—';
  var durLine =
    '~' +
    weekMin +
    ' ' +
    (isEs ? 'min / semana' : 'min / week');
  var freqLine = (r.days || []).length + ' ' + (isEs ? 'días / semana' : 'days / week');
  var lblAlumno = isEs ? 'Alumno' : 'Athlete';
  var lblObj = isEs ? 'Objetivo / notas' : 'Goal / notes';
  var lblDur = isEs ? 'Duración' : 'Duration';
  var lblFreq = isEs ? 'Frecuencia' : 'Frequency';
  var subDoc = isEs ? 'PLAN DE ENTRENAMIENTO' : 'TRAINING PLAN';
  var lblWarm = isEs ? 'ENTRADA EN CALOR' : 'WARM-UP';
  var lblMain = isEs ? 'BLOQUE PRINCIPAL' : 'MAIN BLOCK';
  var lblNotesCard = isEs ? 'Notas del plan' : 'Plan notes';
  var lblFooter = isEs ? 'Documento generado con IRON TRACK' : 'Generated with IRON TRACK';

  var rpeColors2 = { 6: '#22C55E', 7: '#22C55E', 8: '#60A5FA', 9: '#94A3B8', 10: '#2F6BFF' };
  var rowsPdf = enrichPdfRowsWithBlockCounts(rows);
  var parts = [];

  parts.push('<div class="itpdf-wrap">');

  /* —— Header —— */
  parts.push('<header class="itpdf-header">');
  parts.push('<div class="itpdf-header-left">');
  parts.push('<div class="itpdf-brand-row">');
  parts.push('<div class="itpdf-logo-slot">' + pdfHeaderLogoSvg(56) + '</div>');
  parts.push('<div class="itpdf-wordmark">');
  parts.push(
    '<div class="itpdf-wordmark-line"><span class="itpdf-w-iron">IRON</span><span class="itpdf-w-track">TRACK</span></div>'
  );
  parts.push('<div class="itpdf-subdoc">' + esc(subDoc) + '</div>');
  parts.push('</div></div>');
  parts.push('<div class="itpdf-header-rule" role="presentation"></div>');
  parts.push('</div>');

  parts.push('<aside class="itpdf-meta">');
  parts.push(
    '<div class="itpdf-meta-row">' +
      '<span class="itpdf-meta-ic">' +
      pdfIconUser() +
      '</span>' +
      '<div><div class="itpdf-meta-k">' +
      esc(lblAlumno) +
      '</div><div class="itpdf-meta-v">' +
      esc(alumnoLine) +
      '</div></div></div>'
  );
  parts.push(
    '<div class="itpdf-meta-row">' +
      '<span class="itpdf-meta-ic">' +
      pdfIconTarget() +
      '</span>' +
      '<div><div class="itpdf-meta-k">' +
      esc(lblObj) +
      '</div><div class="itpdf-meta-v">' +
      esc(objetivoLine) +
      '</div></div></div>'
  );
  parts.push(
    '<div class="itpdf-meta-row">' +
      '<span class="itpdf-meta-ic">' +
      pdfIconClock() +
      '</span>' +
      '<div><div class="itpdf-meta-k">' +
      esc(lblDur) +
      '</div><div class="itpdf-meta-v">' +
      esc(durLine) +
      '</div></div></div>'
  );
  parts.push(
    '<div class="itpdf-meta-row">' +
      '<span class="itpdf-meta-ic">' +
      pdfIconCalendar() +
      '</span>' +
      '<div><div class="itpdf-meta-k">' +
      esc(lblFreq) +
      '</div><div class="itpdf-meta-v">' +
      esc(freqLine) +
      '</div></div></div>'
  );
  parts.push('</aside>');
  parts.push('</header>');

  /* —— Título plan —— */
  parts.push('<section class="itpdf-hero">');
  parts.push('<div class="itpdf-hero-top">');
  parts.push('<h1 class="itpdf-plan-title">' + esc(r.name) + '</h1>');
  parts.push(
    '<div class="itpdf-plan-pill"><span class="itpdf-plan-pill-ic">' +
      pdfIconCalendar() +
      '</span><span>' +
      (r.days || []).length +
      ' ' +
      (isEs ? 'días' : 'days') +
      '</span></div>'
  );
  parts.push('</div>');
  parts.push(
    '<div class="itpdf-hero-meta">' +
      esc(r.created || '') +
      '</div>'
  );
  parts.push('</section>');

  if (noteRaw.length > metaNoteMax) {
    parts.push(
      '<section class="itpdf-note-card" aria-label="' +
        esc(lblNotesCard) +
        '">' +
        '<div class="itpdf-note-card-h">' +
        pdfIconDoc() +
        '<span>' +
        esc(lblNotesCard) +
        '</span></div>' +
        '<div class="itpdf-note-card-b">' +
        esc(noteRaw) +
        '</div></section>'
    );
  }

  rowsPdf.forEach(function (row, ri) {
    var pdfRowKey = (r.id || 'rut') + '-pdf-' + ri + '-' + row.type + '-' + (row.ex?.id || row.exName || row.label || '');
    void pdfRowKey;
    if (row.type === 'day') {
      parts.push(
        '<div class="itpdf-day-title">' + esc(row.label) + '</div>'
      );
      return;
    }
    if (row.type === 'warmup-header') {
      var nw = typeof row._pdfBlockExCount === 'number' ? row._pdfBlockExCount : 0;
      parts.push(
        '<div class="itpdf-block-head itpdf-block-head--warm">' +
          '<span class="itpdf-block-head-line"></span>' +
          '<span class="itpdf-block-head-txt">' +
          esc(lblWarm) +
          '</span>' +
          '<span class="itpdf-block-head-sep"> · </span>' +
          '<span class="itpdf-block-head-count">' +
          esc(pdfExerciseCountLabel(nw, isEs)) +
          '</span></div>'
      );
      return;
    }
    if (row.type === 'warmup-ex') {
      var wksW =
        row.wks ||
        [
          { s: row.ex.sets || '-', r: row.ex.reps || '-', kg: '', filled: false, active: false },
          { s: row.ex.sets || '-', r: row.ex.reps || '-', kg: '', filled: false, active: false },
          { s: row.ex.sets || '-', r: row.ex.reps || '-', kg: '', filled: false, active: false },
          { s: row.ex.sets || '-', r: row.ex.reps || '-', kg: '', filled: false, active: false },
        ];
      parts.push('<article class="itpdf-card itpdf-card--warm">');
      parts.push(
        '<div class="itpdf-ex-head"><div class="itpdf-ex-name">' +
          esc(row.exName) +
          '</div></div>'
      );
      parts.push('<div class="itpdf-week-grid">');
      wksW.forEach(function (w, wi) {
        var active = !!w.active;
        var filled = !!w.filled;
        parts.push(
          '<div class="itpdf-wk' +
            (active ? ' itpdf-wk--active' : '') +
            (filled && !active ? ' itpdf-wk--filled' : '') +
            '">' +
            '<div class="itpdf-wk-lbl">' +
            (active ? '▸ ' : '') +
            (isEs ? 'SEM' : 'WK') +
            ' ' +
            (wi + 1) +
            '</div>' +
            '<div class="itpdf-wk-val">' +
            esc(w.s) +
            '×' +
            esc(w.r) +
            '</div>' +
            (w.kg
              ? '<div class="itpdf-chip">' + esc(w.kg) + ' kg</div>'
              : '') +
            '</div>'
        );
      });
      parts.push('</div></article>');
      return;
    }
    if (row.type === 'main-header') {
      var nm = typeof row._pdfBlockExCount === 'number' ? row._pdfBlockExCount : 0;
      parts.push(
        '<div class="itpdf-block-head itpdf-block-head--main">' +
          '<span class="itpdf-block-head-line itpdf-block-head-line--main"></span>' +
          '<span class="itpdf-block-head-txt">' +
          esc(lblMain) +
          '</span>' +
          '<span class="itpdf-block-head-sep"> · </span>' +
          '<span class="itpdf-block-head-count">' +
          esc(pdfExerciseCountLabel(nm, isEs)) +
          '</span></div>'
      );
      return;
    }

    var exName = row.exName;
    var col = row.col;
    var ex = row.ex;
    var wks = row.wks;
    var lastRpe = row.lastRpe;
    var info = row.info;
    var meta2 = [info && info.muscle ? String(info.muscle) : '', info && info.equip ? String(info.equip) : '']
      .filter(Boolean)
      .join(' · ');

    parts.push(
      '<article class="itpdf-card itpdf-card--ex" style="--ex-accent:' +
        esc(col) +
        '">' +
        '<div class="itpdf-ex-row">' +
        '<div class="itpdf-ex-main">' +
        '<div class="itpdf-ex-name">' +
        esc(exName) +
        '</div>' +
        (meta2 ? '<div class="itpdf-ex-meta2">' + esc(meta2) + '</div>' : '') +
        '</div>' +
        '<div class="itpdf-ex-badges">'
    );
    if (ex.kg) {
      parts.push('<span class="itpdf-chip">' + esc(ex.kg) + ' kg</span>');
    }
    if (ex.pause) {
      parts.push(
        '<span class="itpdf-chip itpdf-chip--muted">' + esc(fmtP(ex.pause)) + '</span>'
      );
    }
    if (lastRpe) {
      var rc = rpeColors2[lastRpe] || PDF.neon;
      parts.push(
        '<span class="itpdf-chip itpdf-chip--rpe" style="border-color:' +
          esc(rc) +
          '66;color:' +
          esc(rc) +
          ';background:' +
          esc(rc) +
          '22">RPE ' +
          esc(lastRpe) +
          '</span>'
      );
    }
    parts.push('</div></div>');
    parts.push('<div class="itpdf-week-grid">');
    wks.forEach(function (w, wi) {
      var active = !!w.active;
      var filled = !!w.filled;
      parts.push(
        '<div class="itpdf-wk' +
          (active ? ' itpdf-wk--active' : '') +
          (filled && !active ? ' itpdf-wk--filled' : '') +
          '">' +
          '<div class="itpdf-wk-lbl">' +
          (active ? '▸ ' : '') +
          (isEs ? 'SEM' : 'WK') +
          ' ' +
          (wi + 1) +
          '</div>' +
          '<div class="itpdf-wk-val">' +
          esc(w.s) +
          '×' +
          esc(w.r) +
          '</div>'
      );
      if (w.kg) {
        parts.push('<div class="itpdf-chip">' + esc(w.kg) + ' kg</div>');
      }
      if (w.note) {
        parts.push('<div class="itpdf-wk-note">' + esc(w.note) + '</div>');
      }
      parts.push('</div>');
    });
    parts.push('</div></article>');
  });

  parts.push('<footer class="itpdf-footer">' + esc(lblFooter) + '</footer>');
  parts.push('</div>');
  void textMain;
  void bgCard;
  void border;
  void darkMode;
  void textMuted;
  return parts.join('');
}

function buildPdfStylesheet() {
  return [
    '*{box-sizing:border-box;margin:0;padding:0}',
    'body{background:' + PDF.bg + ';color:' + PDF.text + ';font-family:DM Sans,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:20px 18px 28px;font-size:13px;line-height:1.45;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    '.itpdf-wrap{max-width:820px;margin:0 auto}',
    '.itpdf-header{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:20px 24px;margin-bottom:22px}',
    '.itpdf-header-left{flex:1;min-width:220px}',
    '.itpdf-brand-row{display:flex;align-items:center;gap:14px}',
    '.itpdf-logo-slot{flex-shrink:0;display:flex;align-items:center;justify-content:center}',
    '.itpdf-wordmark{display:flex;flex-direction:column;gap:4px}',
    '.itpdf-wordmark-line{font-family:Barlow Condensed,DM Sans,sans-serif;font-size:28px;font-weight:800;letter-spacing:0.12em;line-height:1}',
    '.itpdf-w-iron{color:' + PDF.text + '}',
    '.itpdf-w-track{color:' + PDF.neon + ';text-shadow:0 0 18px ' + PDF.glow + '}',
    '.itpdf-subdoc{font-size:11px;font-weight:600;letter-spacing:0.28em;color:' + PDF.muted + '}',
    '.itpdf-header-rule{height:1px;margin-top:14px;background:' + PDF.borderSoft + ';box-shadow:0 0 12px ' + PDF.glow + ';border-radius:1px}',
    '.itpdf-meta{width:100%;max-width:280px;background:' + PDF.panel + ';border:1px solid ' + PDF.border + ';border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:10px;box-shadow:0 8px 24px rgba(0,0,0,0.35)}',
    '.itpdf-meta-row{display:flex;gap:10px;align-items:flex-start}',
    '.itpdf-meta-ic{flex-shrink:0;padding-top:2px;opacity:0.9}',
    '.itpdf-meta-k{font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:' + PDF.muted + '}',
    '.itpdf-meta-v{font-size:12.5px;font-weight:600;color:' + PDF.text + ';margin-top:2px;word-break:break-word}',
    '.itpdf-hero{background:' + PDF.panel2 + ';border:1px solid ' + PDF.border + ';border-radius:16px;padding:18px 18px 16px;margin-bottom:18px;box-shadow:0 4px 20px rgba(0,0,0,0.25)}',
    '.itpdf-hero-top{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:12px}',
    '.itpdf-plan-title{font-family:Barlow Condensed,DM Sans,sans-serif;font-size:clamp(22px,4vw,32px);font-weight:800;letter-spacing:0.04em;color:' + PDF.text + ';line-height:1.15}',
    '.itpdf-plan-pill{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;border:1px solid ' + PDF.border + ';background:rgba(47,107,255,0.08);font-size:12px;font-weight:700;color:' + PDF.muted + '}',
    '.itpdf-plan-pill-ic{display:flex;opacity:0.85}',
    '.itpdf-hero-meta{margin-top:10px;font-size:12px;color:' + PDF.muted + ';font-weight:500}',
    '.itpdf-note-card{margin-bottom:18px;padding:14px 16px;border-radius:14px;background:' + PDF.panel + ';border:1px solid ' + PDF.border + ';box-shadow:0 0 0 1px rgba(47,107,255,0.06) inset}',
    '.itpdf-note-card-h{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:' + PDF.text + ';margin-bottom:8px}',
    '.itpdf-note-card-b{font-size:13px;color:' + PDF.muted + ';white-space:pre-wrap;word-break:break-word}',
    '.itpdf-day-title{font-family:Barlow Condensed,DM Sans,sans-serif;font-size:19px;font-weight:800;letter-spacing:0.12em;color:' + PDF.text + ';margin:22px 0 12px;padding-bottom:8px;border-bottom:1px solid ' + PDF.borderSoft + '}',
    '.itpdf-block-head{display:flex;align-items:center;flex-wrap:wrap;gap:8px 6px;margin:16px 0 11px;padding:10px 14px;border-radius:10px;background:rgba(47,107,255,0.06);border:1px solid ' + PDF.border + '}',
    '.itpdf-block-head--warm{border-color:rgba(148,163,184,0.2)}',
    '.itpdf-block-head-line{width:3px;height:16px;border-radius:2px;background:' + PDF.muted + ';flex-shrink:0}',
    '.itpdf-block-head-line--main{background:' + PDF.neon + '}',
    '.itpdf-block-head-txt{font-size:13px;font-weight:800;letter-spacing:0.14em;color:' + PDF.text + ';text-transform:uppercase}',
    '.itpdf-block-head-sep{color:rgba(248,250,252,0.35);font-size:13px;font-weight:700}',
    '.itpdf-block-head-count{font-size:12.5px;font-weight:700;letter-spacing:0.02em;color:#93C5FD}',
    '.itpdf-card{background:' + PDF.panel2 + ';border:1px solid ' + PDF.border + ';border-radius:14px;padding:12px 14px;margin-bottom:10px;box-shadow:0 2px 12px rgba(0,0,0,0.2)}',
    '.itpdf-card--warm{border-color:rgba(148,163,184,0.22)}',
    '.itpdf-card--ex{border-color:rgba(80,140,255,0.22);border-left:3px solid var(--ex-accent,' + PDF.neon + ')}',
    '.itpdf-ex-head{margin-bottom:10px}',
    '.itpdf-ex-row{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px}',
    '.itpdf-ex-main{flex:1;min-width:0}',
    '.itpdf-ex-name{font-size:17px;font-weight:800;color:' + PDF.text + ';letter-spacing:0.02em}',
    '.itpdf-ex-meta2{font-size:12px;color:' + PDF.muted + ';margin-top:4px;font-weight:500}',
    '.itpdf-ex-badges{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end;align-items:flex-start;flex-shrink:0;max-width:42%}',
    '.itpdf-chip{display:inline-block;font-size:10px;font-weight:700;letter-spacing:0.04em;padding:3px 8px;border-radius:999px;border:1px solid ' + PDF.border + ';background:rgba(5,8,22,0.65);color:' + PDF.text + '}',
    '.itpdf-chip--muted{color:' + PDF.muted + ';font-weight:600}',
    '.itpdf-chip--rpe{font-weight:800}',
    '.itpdf-week-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}',
    '.itpdf-wk{background:rgba(5,8,22,0.55);border:1px solid ' + PDF.border + ';border-radius:10px;padding:8px 6px;text-align:center}',
    '.itpdf-wk--filled{border-color:rgba(148,163,184,0.25)}',
    '.itpdf-wk--active{background:linear-gradient(180deg,rgba(47,107,255,0.95),rgba(30,69,180,0.98));border-color:rgba(124,178,255,0.55);box-shadow:0 0 16px ' + PDF.glow + '}',
    '.itpdf-wk-lbl{font-size:9px;font-weight:800;letter-spacing:0.08em;color:' + PDF.muted + ';margin-bottom:4px}',
    '.itpdf-wk--active .itpdf-wk-lbl{color:rgba(248,250,252,0.85)}',
    '.itpdf-wk-val{font-size:16px;font-weight:800;color:' + PDF.text + ';letter-spacing:0.02em}',
    '.itpdf-wk--active .itpdf-wk-val{color:' + PDF.text + '}',
    '.itpdf-wk .itpdf-chip{margin-top:6px;font-size:9px}',
    '.itpdf-wk-note{font-size:10px;color:' + PDF.muted + ';margin-top:6px;line-height:1.3}',
    '.itpdf-wk--active .itpdf-wk-note{color:rgba(248,250,252,0.8)}',
    '.itpdf-footer{text-align:center;color:' + PDF.muted + ';font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;margin-top:26px;padding-top:14px;border-top:1px solid ' + PDF.borderSoft + '}',
    '@media print{@page{margin:8mm;size:A4}body{padding:0}}',
    '@media (max-width:520px){.itpdf-meta{max-width:100%}.itpdf-ex-badges{max-width:100%;justify-content:flex-start}}',
  ].join('');
}

/**
 * Genera el .html imprimible y lo abre en pestaña (mobile) o descarga (desktop), misma lógica que el antiguo panel PDF en App.
 */
export function exportRoutinePdfHtml(r, rows, es, toast2, theme) {
  var textMain = theme.textMain;
  var bgCard = theme.bgCard;
  var border = theme.border;
  var darkMode = theme.darkMode;
  var textMuted = theme.textMuted;
  var currentWeek = typeof theme.currentWeek === 'number' ? theme.currentWeek : 0;
  var inner = buildRoutinePdfInnerHtml(
    r,
    rows,
    textMain,
    bgCard,
    border,
    darkMode,
    textMuted,
    es,
    currentWeek
  );
  var fontLink =
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">';
  var styles = buildPdfStylesheet();
  var fullHtml =
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' +
    esc(r.name) +
    ' · Iron Track</title>' +
    fontLink +
    '<style>' +
    styles +
    '</style></head><body>' +
    inner +
    '<scr' +
    'ipt>window.onload=function(){window.print();}</' +
    'ipt></body></html>';
  var blob = new Blob([fullHtml], { type: 'text/html' });
  var url = URL.createObjectURL(blob);
  var baseName = 'IronTrack-' + String(r.name).replace(/\s+/g, '-') + '.html';
  if (ironTrackPreferPdfOpenInNewTab()) {
    var win = window.open(url, '_blank', 'noopener,noreferrer');
    if (win) {
      toast2(
        es
          ? 'Abierto en una pestaña. Ahí podés imprimir o compartir sin tapar la app.'
          : 'Opened in a new tab — print or share from there without covering the app.'
      );
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 120000);
    } else {
      var aPop = document.createElement('a');
      aPop.href = url;
      aPop.download = baseName;
      aPop.rel = 'noopener noreferrer';
      document.body.appendChild(aPop);
      aPop.click();
      aPop.remove();
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 3000);
      toast2(es ? 'Descarga iniciada (ventana emergente bloqueada).' : 'Download started (popup blocked).');
    }
  } else {
    var a = document.createElement('a');
    a.href = url;
    a.download = baseName;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast2('Archivo descargado - abrilo y se imprime solo');
  }
}
