import { fmtP } from './timeFormat.js';

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

/**
 * Misma marca que la vista previa PDF que había en App (antes del flujo sin modal): HTML imprimible.
 */
export function buildRoutinePdfInnerHtml(r, rows, textMain, bgCard, border, darkMode, textMuted) {
  const rpeColors2 = { 6: '#22C55E', 7: '#22C55E', 8: '#60A5FA', 9: '#8B9AB2', 10: '#2563EB' };
  const parts = [];
  parts.push('<div style="padding:16px">');
  parts.push(
    '<div style="background:#2563EB;border-radius:12px;padding:8px 16px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">' +
      '<span style="font-size:22px;font-weight:900;letter-spacing:2px;color:#fff">IRON TRACK</span>' +
      '<span style="font-size:13px;color:#1E2D40;font-weight:700">PLAN DE ENTRENAMIENTO</span>' +
      '</div>'
  );
  parts.push(
    '<div style="font-size:28px;font-weight:900;letter-spacing:1px;margin-bottom:4px">' + esc(r.name) + '</div>'
  );
  parts.push(
    '<div style="font-size:13px;color:#8B9AB2;margin-bottom:16px">' +
      esc(r.created) +
      ' · ' +
      r.days.length +
      ' dias' +
      (r.note ? ' · ' + esc(r.note) : '') +
      '</div>'
  );

  rows.forEach(function (row, ri) {
    const pdfRowKey = (r.id || 'rut') + '-pdf-' + ri + '-' + row.type + '-' + (row.ex?.id || row.exName || row.label || '');
    void pdfRowKey;
    if (row.type === 'day') {
      parts.push(
        '<div style="font-size:15px;font-weight:700;color:' +
          esc(textMain) +
          ';letter-spacing:2px;border-bottom:2px solid #243040;padding-bottom:4px;margin:16px 0 8px">' +
          esc(row.label) +
          '</div>'
      );
      return;
    }
    if (row.type === 'warmup-header') {
      parts.push(
        '<div style="display:flex;align-items:center;gap:8px;padding:4px 8px;background:#2563EB11;border:1px solid #243040;border-radius:8px;margin-bottom:8px">' +
          '<div style="width:3px;height:14px;background:#8B9AB2;border-radius:2px"></div>' +
          '<span style="font-size:15px;font-weight:800;color:#8B9AB2;letter-spacing:1px">ENTRADA EN CALOR</span>' +
          '</div>'
      );
      return;
    }
    if (row.type === 'warmup-ex') {
      const wks =
        row.wks ||
        [
          { s: row.ex.sets || '-', r: row.ex.reps || '-', kg: '', filled: false, active: false },
          { s: row.ex.sets || '-', r: row.ex.reps || '-', kg: '', filled: false, active: false },
          { s: row.ex.sets || '-', r: row.ex.reps || '-', kg: '', filled: false, active: false },
          { s: row.ex.sets || '-', r: row.ex.reps || '-', kg: '', filled: false, active: false },
        ];
      parts.push(
        '<div style="background:' +
          esc(bgCard) +
          ';border-radius:12px;padding:8px 12px;margin-bottom:8px;border:1px solid ' +
          esc(border) +
          '">' +
          '<div style="font-size:15px;font-weight:700;color:' +
          esc(textMain) +
          ';margin-bottom:8px">' +
          esc(row.exName) +
          '</div>' +
          '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px">'
      );
      wks.forEach(function (w, wi) {
        const fz1 = w.active ? 10 : 8;
        const fz2 = w.active ? 16 : 13;
        const pb = w.active ? '10px 4px' : '7px 4px';
        const mb = w.active ? 5 : 3;
        const bord = w.active ? '2px solid #2563EB' : w.filled ? '1px solid #243040' : '1px solid ' + border;
        parts.push(
          '<div style="background:' +
            (w.active ? '#2563EB' : '#162234') +
            ';border-radius:8px;padding:' +
            pb +
            ';text-align:center;border:' +
            bord +
            '">' +
            '<div style="font-size:' +
            fz1 +
            'px;font-weight:700;letter-spacing:1px;color:' +
            (w.active ? '#FFFFFF' : '#8B9AB2') +
            ';margin-bottom:' +
            mb +
            'px">' +
            (w.active ? '→ ' : ' ') +
            'SEM ' +
            (wi + 1) +
            '</div>' +
            '<div style="font-size:' +
            fz2 +
            'px;font-weight:800;color:' +
            (w.active ? '#FFFFFF' : w.filled ? '#FFFFFF' : '#8B9AB2') +
            '">' +
            esc(w.s) +
            '×' +
            esc(w.r) +
            '</div>' +
            (w.kg
              ? '<div style="font-size:11px;font-weight:700;color:' +
                (w.active ? '#FFFFFF' : '#8B9AB2') +
                ';margin-top:4px">' +
                esc(w.kg) +
                'kg</div>'
              : '') +
            '</div>'
        );
      });
      parts.push('</div></div>');
      return;
    }
    if (row.type === 'main-header') {
      parts.push(
        '<div style="display:flex;align-items:center;gap:8px;padding:4px 8px;background:#2563EB11;border:2px solid #243040;border-radius:8px;margin-bottom:8px;margin-top:8px">' +
          '<div style="width:3px;height:16px;background:#8B9AB2;border-radius:2px"></div>' +
          '<span style="font-size:15px;font-weight:800;color:#8B9AB2;letter-spacing:1px">BLOQUE PRINCIPAL</span>' +
          '</div>'
      );
      return;
    }

    const exName = row.exName;
    const col = row.col;
    const ex = row.ex;
    const wks = row.wks;
    const lastRpe = row.lastRpe;
    const info = row.info;

    parts.push(
      '<div style="background:#1E2D40;border:1px solid ' +
        esc(col) +
        '44;border-radius:12px;padding:12px;margin-bottom:8px">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
        '<div style="width:3px;align-self:stretch;border-radius:2px;background:' +
        esc(col) +
        ';flex-shrink:0"></div>' +
        '<div style="flex:1">' +
        '<div style="font-size:22px;font-weight:800;color:' +
        esc(textMain) +
        ';margin-bottom:4px">' +
        esc(exName) +
        '</div>' +
        '<div style="font-size:13px;color:#8B9AB2">' +
        esc(info?.muscle || '') +
        ' · ' +
        esc(info?.equip || '') +
        '</div>' +
        '</div>' +
        '<div style="display:flex;gap:4px;flex-shrink:0;align-items:center">'
    );
    if (ex.kg) {
      parts.push(
        '<span style="background:' +
          (darkMode ? '#162234' : '#E2E8F0') +
          ';border-radius:6px;padding:4px 8px;font-size:13px;font-weight:700;color:' +
          esc(textMain) +
          '">' +
          esc(ex.kg) +
          'kg</span>'
      );
    }
    if (ex.pause) {
      parts.push(
        '<span style="background:' +
          (darkMode ? '#162234' : '#E2E8F0') +
          ';border-radius:6px;padding:4px 8px;font-size:13px;color:' +
          esc(textMuted) +
          '">' +
          esc(fmtP(ex.pause)) +
          '</span>'
      );
    }
    if (lastRpe) {
      const rc = rpeColors2[lastRpe] || '#2563EB';
      parts.push(
        '<span style="background:' +
          rc +
          '33;border:1px solid ' +
          rc +
          '66;border-radius:6px;padding:4px 8px;font-size:13px;font-weight:800;color:' +
          rc +
          '">RPE ' +
          esc(lastRpe) +
          '</span>'
      );
    }
    parts.push('</div></div>');
    parts.push('<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px">');
    wks.forEach(function (w, wi) {
      const bord = w.active ? '2px solid #2563EB' : w.filled ? '1px solid #243040' : '1px solid ' + border;
      parts.push(
        '<div style="background:' +
          (w.active ? '#2563EB' : '#162234') +
          ';border-radius:8px;padding:8px 4px;text-align:center;border:' +
          bord +
          '">' +
          '<div style="font-size:11px;font-weight:700;letter-spacing:0.3px;color:' +
          (w.active ? '#FFFFFF' : '#8B9AB2') +
          ';margin-bottom:4px">' +
          (w.active ? '→ ' : ' ') +
          'SEM ' +
          (wi + 1) +
          '</div>' +
          '<div style="font-size:18px;font-weight:900;color:' +
          (w.active ? '#fff' : w.filled ? '#FFFFFF' : '#8B9AB2') +
          '">' +
          esc(w.s) +
          'x' +
          esc(w.r) +
          '</div>'
      );
      if (w.kg) {
        parts.push(
          '<div style="font-size:13px;font-weight:700;color:' +
            (w.active ? '#FFFFFF' : '#8B9AB2') +
            ';margin-top:4px">' +
            esc(w.kg) +
            'kg</div>'
        );
      }
      if (w.note) {
        parts.push(
          '<div style="font-size:11px;color:#8B9AB2;margin-top:4px">' + esc(w.note) + '</div>'
        );
      }
      parts.push('</div>');
    });
    parts.push('</div></div>');
  });

  parts.push(
    '<div style="text-align:center;color:#8B9AB2;font-size:11px;margin-top:20px;padding-top:8px;border-top:1px solid ' +
      esc(border) +
      '">Generado con IRON TRACK</div>'
  );
  parts.push('</div>');
  return parts.join('');
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
  var inner = buildRoutinePdfInnerHtml(r, rows, textMain, bgCard, border, darkMode, textMuted);
  var styles = [
    '*{box-sizing:border-box;margin:0;padding:0}',
    'body{background:#07080d;color:#e2e8f0;font-family:\'Arial Narrow\',Arial,sans-serif;padding:16px;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    '.tag{display:inline-block;border-radius:6px;padding:2px 8px;font-size:12px;font-weight:700;margin-right:4px}',
    '@media print{@page{margin:5mm;size:A4}button{display:none!important}}',
  ].join('');
  var fullHtml =
    '<!DOCTYPE html><html><head><meta charset=utf-8><title>' +
    esc(r.name) +
    ' - Iron Track</title><style>' +
    styles +
    '</style></head><body>' +
    inner +
    '<scr' +
    'ipt>window.onload=function(){window.print();}</' +
    'script></body></html>';
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
      toast2(
        es ? 'Descarga iniciada (ventana emergente bloqueada).' : 'Download started (popup blocked).'
      );
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
