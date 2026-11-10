import React, { useLayoutEffect, useRef, useState } from 'react';
import {
  METHOD_FIELD, weekOptionsFor, weeksLostByReducing, setWeekField, copyWeekValues, fillRowRight, deltaHint,
} from './progressionEditorLogic.js';

// Valores por semana del editor de ejercicio: selector de semanas + planilla (escritorio, semanas = columnas) o tabla vertical (movil,
// una semana por fila). El diseno se elige SOLO por el ancho disponible del contenedor; el estado (valores, notas abiertas) vive aqui y en
// el editor padre, asi que cambiar de tamano/orientacion no pierde nada. No guarda ni consulta nada: el padre decide el guardado.

const FIELDS = [
  { key: 'sets', label: 'Series', head: 'SERIES' },
  { key: 'reps', label: 'Reps', head: 'REPS' },
  { key: 'kg', label: 'Kg', head: 'KG' },
  { key: 'pausa', label: 'Pausa', head: 'PAUSA (s)' },
];
const METHOD_COLOR = { carga: '#2563EB', reps: '#22C55E', series: '#8B5CF6', pausa: '#F59E0B', manual: '#8B9AB2' };
const LABEL_W = 118;
const COL_W = 92;

const CSS = `
.pw-root{--pw-in-h:40px;font-family:inherit;color:var(--pw-text);margin-bottom:12px}
.pw-root *{box-sizing:border-box}
.pw-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin-bottom:8px}
.pw-sec{font-size:12px;font-weight:700;letter-spacing:.5px;color:var(--pw-muted);text-transform:uppercase}
.pw-seg{display:inline-flex;border:1px solid var(--pw-border);border-radius:10px;overflow:hidden}
.pw-seg button{min-height:36px;min-width:40px;padding:0 12px;background:transparent;color:var(--pw-muted);border:0;font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.pw-seg button[aria-pressed=true]{background:var(--pw-accent);color:#fff}
.pw-confirm{display:flex;flex-wrap:wrap;align-items:center;gap:8px;background:#F59E0B1f;border:1px solid #F59E0B;border-radius:10px;padding:8px 10px;margin-bottom:8px;font-size:12px}
.pw-confirm span{flex:1 1 220px}
.pw-cbtn{min-height:36px;padding:0 12px;border-radius:8px;border:1px solid var(--pw-border);background:transparent;color:var(--pw-text);font:inherit;font-size:12px;font-weight:700;cursor:pointer}
.pw-cbtn--d{background:#F59E0B;border-color:#F59E0B;color:#0F1923}
.pw-in{width:100%;height:var(--pw-in-h);background:var(--pw-input);color:var(--pw-text);border:1px solid var(--pw-border);border-radius:8px;font:inherit;font-size:15px;font-variant-numeric:tabular-nums;text-align:center;padding:0 4px;outline:none}
.pw-in:focus{border-color:var(--pw-accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--pw-accent) 35%,transparent)}
.pw-in::placeholder{color:var(--pw-muted);opacity:.55}
.pw-chip{position:absolute;top:-6px;right:0;font-size:9px;font-weight:800;line-height:1;padding:2px 4px;border-radius:5px;background:var(--pw-input);border:1px solid currentColor;pointer-events:none;z-index:1;white-space:nowrap}
.pw-dot{width:7px;height:7px;border-radius:50%;background:#22C55E;display:inline-block;flex-shrink:0}
.pw-sm{min-width:40px;height:40px;border-radius:8px;background:transparent;border:1px solid var(--pw-border);color:var(--pw-muted);font:inherit;font-size:14px;cursor:pointer;padding:0 8px;flex-shrink:0}
.pw-sm:hover,.pw-cp:hover,.pw-fill:hover{border-color:var(--pw-accent);color:var(--pw-text)}
.pw-hint{font-size:11px;color:var(--pw-muted);margin:6px 2px 0}
/* A: tabla vertical */
.pw-tbl{width:100%;border-collapse:separate;border-spacing:0 4px;table-layout:fixed}
.pw-tbl th{font-size:10px;font-weight:700;letter-spacing:.5px;color:var(--pw-muted);text-align:center;padding:0 3px 2px;white-space:nowrap}
.pw-tbl td{padding:0 3px;vertical-align:middle;position:relative}
.pw-tbl td:first-child,.pw-tbl th:first-child{padding-left:0}
.pw-wk{width:100%;height:var(--pw-in-h);display:flex;align-items:center;justify-content:center;gap:6px;font:inherit;font-size:13px;font-weight:800;color:var(--pw-accent);background:color-mix(in srgb,var(--pw-accent) 14%,transparent);border:1px solid transparent;border-radius:8px;padding:0 6px;white-space:nowrap;cursor:pointer;position:relative}
.pw-wk .pw-dot{position:absolute;top:5px;right:5px;width:6px;height:6px}
.pw-noterow td{padding:0 0 2px}
.pw-note{display:flex;gap:6px;align-items:center}
.pw-note .pw-in{text-align:left;padding:0 10px;font-size:13px}
/* B: planilla */
.pw-xl{width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--pw-border);border-radius:12px;background:var(--pw-input)}
.pw-xt{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed}
.pw-xt th,.pw-xt td{padding:6px 5px;text-align:center;vertical-align:middle;border-bottom:1px solid var(--pw-border)}
.pw-xt tr:last-child td{border-bottom:0}
.pw-xt .pw-vc{position:sticky;left:0;z-index:2;background:var(--pw-card);text-align:left;padding:6px 10px;border-right:1px solid var(--pw-border)}
.pw-xt thead th{background:var(--pw-card);padding:8px 5px 6px}
.pw-xt thead .pw-vc{z-index:3}
.pw-xt td{position:relative}
.pw-wh{display:flex;flex-direction:column;align-items:center;gap:4px}
.pw-whl{font-size:12px;font-weight:800;letter-spacing:.5px;color:#fff;background:var(--pw-accent);border-radius:999px;padding:3px 12px}
.pw-cp{height:26px;min-width:44px;font-size:11px;font-weight:700;border-radius:6px;background:transparent;border:1px solid var(--pw-border);color:var(--pw-muted);cursor:pointer;font-family:inherit;padding:0 6px}
.pw-cp[disabled]{opacity:.25;cursor:default}
.pw-vn{display:flex;align-items:center;justify-content:space-between;gap:4px;font-size:12px;font-weight:700;color:var(--pw-muted);letter-spacing:.4px}
.pw-fill{width:28px;height:28px;border-radius:6px;background:transparent;border:1px solid var(--pw-border);color:var(--pw-muted);cursor:pointer;font-size:12px;padding:0}
.pw-nb{width:100%;min-height:36px;border-radius:8px;border:1px dashed var(--pw-border);background:transparent;color:var(--pw-muted);font:inherit;font-size:12px;cursor:pointer;display:inline-flex;gap:6px;align-items:center;justify-content:center}
.pw-nb[aria-expanded=true]{border-style:solid;border-color:var(--pw-accent);color:var(--pw-text)}
.pw-notes{padding:8px 10px;display:grid;gap:6px;border-top:1px solid var(--pw-border);background:var(--pw-card)}
.pw-nl{display:flex;gap:8px;align-items:center}
.pw-nl b{font-size:11px;color:var(--pw-accent);min-width:52px}
.pw-nl .pw-in{text-align:left;padding:0 10px;font-size:13px}
.pw-compact{--pw-in-h:44px}
.pw-compact .pw-in{font-size:16px}
.pw-compact .pw-seg button{min-height:44px;min-width:44px}
.pw-compact .pw-sm{height:44px;min-width:44px}
.pw-compact .pw-cbtn{min-height:44px}
`;

function useKeyNav() {
  return (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement) || t.dataset.r == null) return;
    let dr = 0, dc = 0;
    if (e.key === 'ArrowDown' || e.key === 'Enter') dr = 1;
    else if (e.key === 'ArrowUp') dr = -1;
    else if (e.key === 'ArrowRight' && t.selectionStart === t.value.length) dc = 1;
    else if (e.key === 'ArrowLeft' && t.selectionEnd === 0) dc = -1;
    else return;
    const root = t.closest('[data-pw-grid]');
    const next = root && root.querySelector('[data-r="' + (Number(t.dataset.r) + dr) + '"][data-c="' + (Number(t.dataset.c) + dc) + '"]');
    if (next) { e.preventDefault(); next.focus(); }
  };
}

function Cell({ value, onChange, placeholder, r, c, label, mode, tint, chip, chipColor }) {
  return (
    <>
      <input className="pw-in" style={tint ? { background: tint } : undefined} value={value} placeholder={placeholder}
        inputMode={mode} aria-label={label} data-r={r} data-c={c}
        onFocus={(e) => e.target.select()} onChange={(e) => onChange(e.target.value)} />
      {chip ? <span className="pw-chip" style={{ color: chipColor }} aria-hidden="true">{chip}</span> : null}
    </>
  );
}

export default function ProgressionWeeksEditor({ weeks, count, initialCount, onCountChange, onWeeksChange, base, method, theme }) {
  const rootRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [openNotes, setOpenNotes] = useState(() => new Set());
  const [pending, setPending] = useState(null); // { to, lost:[indices] }
  const nav = useKeyNav();

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const measure = () => setWidth(el.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const wide = width >= 640 && width >= LABEL_W + count * COL_W;
  const rows = weeks.slice(0, count);
  const mField = METHOD_FIELD[method] || null;
  const mColor = METHOD_COLOR[method] || METHOD_COLOR.manual;
  const options = weekOptionsFor(initialCount);

  const upd = (i, f, v) => onWeeksChange(setWeekField(weeks, i, f, v));
  const toggleNote = (i) => setOpenNotes((p) => { const q = new Set(p); if (q.has(i)) q.delete(i); else q.add(i); return q; });
  const requestCount = (n) => {
    if (n === count) return;
    if (n < count) {
      const lost = weeksLostByReducing(weeks, count, n);
      if (lost.length) { setPending({ to: n, lost }); return; }
    }
    setPending(null);
    onCountChange(n);
  };
  const lostText = (lost) => (lost.length === 1 ? 'la semana ' + (lost[0] + 1) : 'las semanas ' + lost.map((i) => i + 1).join(', '));
  const cssVars = {
    '--pw-bg': theme.bg, '--pw-input': theme.input, '--pw-card': theme.card, '--pw-border': theme.border,
    '--pw-text': theme.text, '--pw-muted': theme.muted, '--pw-accent': theme.accent,
  };
  const ph = (f) => (f.key === 'pausa' ? String(base.pause) : String(base[f.key] ?? ''));
  const mode = (f) => (f.key === 'reps' ? 'text' : 'decimal');

  return (
    <div ref={rootRef} className={'pw-root' + (wide ? '' : ' pw-compact')} style={cssVars} data-layout={wide ? 'planilla' : 'tabla'}>
      <style>{CSS}</style>
      <div className="pw-bar">
        <div className="pw-sec">Valores por semana</div>
        <div className="pw-seg" role="group" aria-label="Cantidad de semanas">
          {options.map((n) => (
            <button key={n} type="button" aria-pressed={count === n} aria-label={n + ' semanas'} onClick={() => requestCount(n)}>{n}</button>
          ))}
        </div>
        <span className="pw-hint" style={{ margin: 0 }}>semanas</span>
      </div>
      {pending ? (
        <div className="pw-confirm" role="alertdialog" aria-label="Confirmar reducción de semanas">
          <span>Al reducir a {pending.to} semanas se descartarán al guardar los datos de {lostText(pending.lost)}. ¿Reducir?</span>
          <button type="button" className="pw-cbtn" onClick={() => setPending(null)}>Mantener</button>
          <button type="button" className="pw-cbtn pw-cbtn--d" onClick={() => { const to = pending.to; setPending(null); onCountChange(to); }}>Reducir a {pending.to}</button>
        </div>
      ) : null}

      {wide ? (
        <div data-pw-grid onKeyDown={nav}>
          <div className="pw-xl">
            <table className="pw-xt">
              <colgroup><col style={{ width: LABEL_W }} />{rows.map((_, i) => <col key={i} />)}</colgroup>
              <thead>
                <tr>
                  <th className="pw-vc" scope="col" style={{ fontSize: 10, letterSpacing: 0.5, color: theme.muted }}>VARIABLE</th>
                  {rows.map((_, i) => (
                    <th key={i} scope="col">
                      <div className="pw-wh">
                        <span className="pw-whl">SEM {i + 1}</span>
                        <button type="button" className="pw-cp" disabled={i >= count - 1} aria-label={'Copiar semana ' + (i + 1) + ' a semana ' + (i + 2)} title="Copiar esta semana a la siguiente"
                          onClick={() => onWeeksChange(copyWeekValues(weeks, i, i + 1))}>copiar →</button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FIELDS.map((f, ri) => {
                  const hot = mField === f.key;
                  return (
                    <tr key={f.key}>
                      <th className="pw-vc" scope="row">
                        <div className="pw-vn"><span style={hot ? { color: mColor } : undefined}>{f.head}</span>
                          <button type="button" className="pw-fill" aria-label={'Repetir ' + f.label + ' de la semana 1 en todas'} title="Repetir el valor de Sem 1 en todas las semanas"
                            onClick={() => onWeeksChange(fillRowRight(weeks, f.key, 0, count))}>⇥</button>
                        </div>
                      </th>
                      {rows.map((w, i) => (
                        <td key={i}>
                          <Cell value={w[f.key]} r={ri} c={i} label={'Semana ' + (i + 1) + ' ' + f.label} placeholder={ph(f)} mode={mode(f)}
                            onChange={(v) => upd(i, f.key, v)} tint={hot ? mColor + '1a' : undefined}
                            chip={hot && i > 0 ? deltaHint(method, rows[i - 1], w) : ''} chipColor={mColor} />
                        </td>
                      ))}
                    </tr>
                  );
                })}
                <tr>
                  <th className="pw-vc" scope="row"><div className="pw-vn"><span>NOTA</span></div></th>
                  {rows.map((w, i) => (
                    <td key={i}>
                      <button type="button" className="pw-nb" aria-expanded={openNotes.has(i)} aria-label={'Nota semana ' + (i + 1)} onClick={() => toggleNote(i)}>
                        {w.note ? <span className="pw-dot" /> : <span aria-hidden="true">＋</span>}<span>{w.note ? 'ver' : 'nota'}</span>
                      </button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            {[...openNotes].filter((i) => i < count).sort((a, b) => a - b).length ? (
              <div className="pw-notes">
                {[...openNotes].filter((i) => i < count).sort((a, b) => a - b).map((i) => (
                  <div className="pw-nl" key={i}>
                    <b>SEM {i + 1}</b>
                    <input className="pw-in" autoFocus value={weeks[i].note} placeholder="Nota de semana (opcional)" aria-label={'Nota semana ' + (i + 1)} onChange={(e) => upd(i, 'note', e.target.value)} />
                    <button type="button" className="pw-sm" aria-label="Cerrar nota" onClick={() => toggleNote(i)}>✕</button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <div className="pw-hint">Flechas/Enter mueven entre celdas · “copiar →” duplica la semana · ⇥ repite el valor de Sem 1 en toda la fila.</div>
        </div>
      ) : (
        <div data-pw-grid onKeyDown={nav}>
          <table className="pw-tbl">
            <colgroup><col style={{ width: 62 }} /><col /><col /><col /><col /></colgroup>
            <thead>
              <tr>
                <th>SEM</th>
                {FIELDS.map((f) => <th key={f.key} style={mField === f.key ? { color: mColor } : undefined}>{f.head}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((w, i) => {
                const open = openNotes.has(i);
                return (
                  <React.Fragment key={i}>
                    <tr>
                      <td>
                        <button type="button" className="pw-wk" aria-label={'Semana ' + (i + 1) + ': abrir o cerrar nota'} aria-expanded={open} onClick={() => toggleNote(i)}>
                          SEM {i + 1}{w.note ? <span className="pw-dot" aria-hidden="true" /> : null}
                        </button>
                      </td>
                      {FIELDS.map((f, ci) => {
                        const hot = mField === f.key;
                        return (
                          <td key={f.key}>
                            <Cell value={w[f.key]} r={i} c={ci} label={'Semana ' + (i + 1) + ' ' + f.label} placeholder={ph(f)} mode={mode(f)}
                              onChange={(v) => upd(i, f.key, v)} tint={hot ? mColor + '1a' : undefined}
                              chip={hot && i > 0 ? deltaHint(method, rows[i - 1], w) : ''} chipColor={mColor} />
                          </td>
                        );
                      })}
                    </tr>
                    {open ? (
                      <tr className="pw-noterow">
                        <td colSpan={5}>
                          <div className="pw-note">
                            <input className="pw-in" autoFocus value={w.note} placeholder={'Nota de semana ' + (i + 1) + ' (opcional)'} aria-label={'Nota semana ' + (i + 1)} onChange={(e) => upd(i, 'note', e.target.value)} />
                            {i > 0 ? <button type="button" className="pw-sm" aria-label={'Copiar semana ' + i + ' a semana ' + (i + 1)} title="Copiar valores de la semana anterior" onClick={() => onWeeksChange(copyWeekValues(weeks, i - 1, i))}>⧉</button> : null}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          <div className="pw-hint">Tocá “SEM n” para abrir su nota y copiar la semana anterior (⧉).</div>
        </div>
      )}
    </div>
  );
}
