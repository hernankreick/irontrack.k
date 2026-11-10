// Demo del PDF de rutina con el exportador REAL (lib/routinePdfExport.js) y rutinas ficticias de 4 a 8 semanas (y casos especiales).
// Vista previa del documento, apertura/impresion para guardar como PDF y descarga del HTML. No usa login ni red propia.
import React, { useMemo, useRef, useState } from 'react';
import { buildRoutinePdfRows, buildRoutinePdfDocumentHtml, exportRoutinePdfHtml } from '../../lib/routinePdfExport.js';
import { RUTINAS_DEMO } from './pdfRutinaDemoData.js';

const C = { bg: '#0F1923', card: '#162234', border: '#2D4057', muted: '#8B9AB2', accent: '#2563EB' };

function docDe(id) {
  const caso = RUTINAS_DEMO.find((x) => x.id === id) || RUTINAS_DEMO[0];
  const r = caso.build();
  const rows = buildRoutinePdfRows(r, { allEx: [], es: true, progress: {}, currentWeek: 0 });
  return { r, rows, caso };
}

function Vista({ id, titulo, onToast }) {
  const { r, rows } = useMemo(() => docDe(id), [id]);
  const html = useMemo(() => buildRoutinePdfDocumentHtml(r, rows, true, { currentWeek: 0 }, { autoPrint: false }), [r, rows]);
  const frame = useRef(null);
  const [h, setH] = useState(700);
  const ajustar = () => {
    try { setH(Math.max(400, frame.current.contentDocument.documentElement.scrollHeight + 8)); } catch (e) { /* mismo origen: no deberia fallar */ }
  };
  const btn = { minHeight: 44, padding: '0 14px', borderRadius: 10, border: '1px solid ' + C.border, background: 'transparent', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 };
  const descargar = () => {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'IronTrack-' + r.name.replace(/\s+/g, '-') + '.html';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };
  return (
    <section style={{ marginBottom: 22 }} aria-label={titulo}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <div style={{ flex: '1 1 180px', fontSize: 14, fontWeight: 800 }}>{titulo}: {r.name}</div>
        <button type="button" style={{ ...btn, background: C.accent, borderColor: C.accent }}
          onClick={() => exportRoutinePdfHtml(r, rows, true, onToast, { currentWeek: 0 })}>Abrir y guardar como PDF</button>
        <button type="button" style={btn} onClick={() => { try { frame.current.contentWindow.print(); } catch (e) { onToast('No se pudo abrir la impresión'); } }}>Imprimir esta vista</button>
        <button type="button" style={btn} onClick={descargar}>Descargar HTML</button>
      </div>
      <iframe ref={frame} title={'Vista previa ' + titulo} srcDoc={html} onLoad={ajustar}
        style={{ width: '100%', height: h, border: '1px solid ' + C.border, borderRadius: 12, background: '#050816', display: 'block' }} />
    </section>
  );
}

export default function PdfRutinaDemo() {
  const [a, setA] = useState('4');
  const [b, setB] = useState('');
  const [toast, setToast] = useState('');
  const aviso = (t) => { setToast(t); setTimeout(() => setToast(''), 3500); };
  const sel = { display: 'block', width: '100%', minHeight: 44, marginTop: 6, padding: '0 10px', borderRadius: 10, border: '1px solid ' + C.border, background: C.card, color: '#fff', fontFamily: 'inherit', fontSize: 16 };
  return (
    <div style={{ minHeight: '100dvh', background: C.bg, color: '#fff', fontFamily: "'Geist Sans',system-ui,sans-serif", padding: '14px 12px 40px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ fontSize: 18, margin: '0 0 4px' }}>Demo · PDF de rutina (4 a 8 semanas)</h1>
        <p style={{ fontSize: 12, color: C.muted, margin: '0 0 12px', lineHeight: 1.45 }}>
          Rutinas ficticias, sin login ni datos reales. Es el documento real del exportador. En iPhone: “Abrir y guardar como PDF” abre el documento en una pestaña y el diálogo de impresión; ahí elegí Compartir → Guardar en Archivos (o “Imprimir” → pellizcar la vista previa para abrirla como PDF). Safari no descarga un .pdf directo desde la web.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <label style={{ flex: '1 1 200px', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: C.muted }}>RUTINA
            <select aria-label="Rutina" value={a} onChange={(e) => setA(e.target.value)} style={sel}>
              {RUTINAS_DEMO.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </label>
          <label style={{ flex: '1 1 200px', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: C.muted }}>COMPARAR CON (OPCIONAL)
            <select aria-label="Comparar con" value={b} onChange={(e) => setB(e.target.value)} style={sel}>
              <option value="">Ninguna</option>
              {RUTINAS_DEMO.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </label>
        </div>
        <Vista key={'a' + a} id={a} titulo="Rutina A" onToast={aviso} />
        {b ? <Vista key={'b' + b} id={b} titulo="Rutina B" onToast={aviso} /> : null}
      </div>
      {toast ? <div role="status" style={{ position: 'fixed', left: '50%', bottom: 16, transform: 'translateX(-50%)', background: '#fff', color: C.bg, padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, maxWidth: '92vw', textAlign: 'center' }}>{toast}</div> : null}
    </div>
  );
}
