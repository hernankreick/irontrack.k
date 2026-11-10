// Maqueta comparativa (SOLO diseno, datos ficticios, sin Supabase ni guardado) de dos rediseños del modal de ejercicio:
//   A = tabla vertical compacta (una fila por semana)   B = planilla horizontal (semanas como columnas).
// Ambos leen y escriben el MISMO estado, asi que lo editado en uno se ve identico en el otro. No reemplaza EditExModal/EditExerciseModal.
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  METODOS, FIELDS, EXERCISE_NAME, BASE_INICIAL, semanasIniciales,
  deltaHint, autocompletar, setCell, copyWeek, fillRight,
} from './progresionEditorDemoData.js';

const C = { bg: '#0F1923', card: '#162234', border: '#2D4057', text: '#FFFFFF', muted: '#8B9AB2', accent: '#2563EB', ok: '#22C55E' };

const CSS = `
.pe-root{min-height:100vh;min-height:100dvh;box-sizing:border-box;background:rgba(0,0,0,.92);color:${C.text};font-family:'Geist Sans',system-ui,sans-serif;padding:max(12px,env(safe-area-inset-top)) 16px max(24px,env(safe-area-inset-bottom))}
.pe-root *{box-sizing:border-box}
.pe-bar{max-width:1100px;margin:0 auto 12px;display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;background:#0b121b;border:1px dashed ${C.border};border-radius:12px;padding:10px 12px}
.pe-bar h1{font-size:13px;margin:0;font-weight:700;letter-spacing:.3px;color:${C.muted};flex:1 1 220px}
.pe-bar h1 b{color:${C.text}}
.pe-seg{display:inline-flex;border:1px solid ${C.border};border-radius:10px;overflow:hidden}
.pe-seg button{min-height:44px;min-width:44px;padding:0 14px;background:transparent;color:${C.muted};border:0;font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.pe-seg button[aria-pressed=true]{background:${C.accent};color:#fff}
.pe-seg+.pe-seg{margin-left:0}
.pe-lbl{font-size:11px;font-weight:700;letter-spacing:.5px;color:${C.muted};display:flex;align-items:center;gap:8px}
.pe-reset{min-height:44px;padding:0 12px;background:transparent;color:${C.muted};border:1px solid ${C.border};border-radius:10px;font:inherit;font-size:12px;font-weight:600;cursor:pointer}
.pe-shell{max-width:1080px;margin:0 auto 6px;background:${C.card};border:1px solid ${C.border};border-radius:16px;display:flex;flex-direction:column;overflow:hidden}
.pe-shell--single{max-height:calc(100dvh - 90px)}
.pe-head{display:flex;align-items:center;gap:10px;padding:14px 20px 10px}
.pe-ico{width:36px;height:36px;border-radius:8px;background:${C.accent}22;color:${C.accent};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0}
.pe-title{font-size:22px;font-weight:800;flex:1;min-width:0}
.pe-tag{font-size:11px;font-weight:700;letter-spacing:.5px;border:1px solid ${C.border};border-radius:999px;padding:3px 10px;color:${C.muted}}
.pe-x{min-width:44px;min-height:44px;background:transparent;border:0;color:${C.muted};font-size:22px;cursor:pointer;border-radius:10px}
.pe-body{overflow-y:auto;padding:0 20px 8px;flex:1 1 auto;-webkit-overflow-scrolling:touch}
.pe-sec{font-size:11px;font-weight:700;letter-spacing:.8px;color:${C.muted};text-transform:uppercase;margin:0 0 6px}
.pe-top{display:grid;grid-template-columns:minmax(300px,380px) 1fr;gap:8px 28px;align-items:start;margin-bottom:12px}
.pe-base{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.pe-fl{font-size:10px;font-weight:600;letter-spacing:.5px;color:${C.muted};margin-bottom:3px;display:block}
.pe-in{width:100%;height:40px;background:${C.bg};color:${C.text};border:1px solid ${C.border};border-radius:8px;font:inherit;font-size:15px;font-variant-numeric:tabular-nums;text-align:center;padding:0 4px;outline:none}
.pe-in:focus{border-color:${C.accent};box-shadow:0 0 0 2px ${C.accent}55}
.pe-in::placeholder{color:#4a5d75}
.pe-methods{display:flex;flex-wrap:wrap;gap:8px}
.pe-m{min-height:40px;padding:0 12px;border-radius:8px;background:transparent;border:1px solid ${C.border};color:${C.muted};font:inherit;font-size:12px;font-weight:700;cursor:pointer}
.pe-mrow{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin-top:8px;font-size:12px;color:${C.muted}}
.pe-auto{min-height:36px;padding:0 12px;border-radius:8px;background:${C.accent};color:#fff;border:0;font:inherit;font-size:12px;font-weight:700;cursor:pointer}
.pe-auto[disabled]{opacity:.4;cursor:default}
.pe-tbl{width:100%;border-collapse:separate;border-spacing:0 4px;table-layout:fixed}
.pe-tbl th{font-size:10px;font-weight:700;letter-spacing:.5px;color:${C.muted};text-align:center;padding:0 3px 2px;white-space:nowrap}
.pe-tbl td{padding:0 3px;vertical-align:middle;position:relative}
.pe-tbl td:first-child,.pe-tbl th:first-child{padding-left:0}
.pe-wk{height:40px;display:flex;align-items:center;gap:6px;font-size:13px;font-weight:800;color:${C.accent};background:${C.accent}1f;border-radius:8px;padding:0 10px;white-space:nowrap}
.pe-wkbtn{width:100%;border:0;font:inherit;cursor:default}
.pe-dot{width:7px;height:7px;border-radius:50%;background:${C.ok};display:inline-block}
.pe-chip{position:absolute;top:-6px;right:0;font-size:9px;font-weight:800;line-height:1;padding:2px 4px;border-radius:5px;background:${C.bg};border:1px solid currentColor;pointer-events:none;z-index:1}
.pe-ghost{height:40px;width:100%;display:flex;align-items:center;gap:8px;background:transparent;border:1px dashed ${C.border};border-radius:8px;color:${C.muted};font:inherit;font-size:12px;padding:0 10px;cursor:pointer;text-align:left;overflow:hidden}
.pe-ghost span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pe-ghost--has{border-style:solid;color:${C.text}}
.pe-note{display:flex;gap:6px;align-items:center}
.pe-note .pe-in{text-align:left;padding:0 10px;font-size:13px}
.pe-sm{min-width:40px;height:40px;border-radius:8px;background:transparent;border:1px solid ${C.border};color:${C.muted};font:inherit;font-size:14px;cursor:pointer;padding:0 8px;flex-shrink:0}
.pe-sm:hover,.pe-m:hover,.pe-x:hover{border-color:${C.accent};color:#fff}
.pe-noterow{display:none}
.pe-tint{background:var(--tint)!important}
.pe-foot{display:flex;gap:8px;padding:12px 20px;border-top:1px solid ${C.border};background:${C.card}}
.pe-btn{min-height:44px;border-radius:10px;font:inherit;font-weight:800;font-size:14px;cursor:pointer;border:1px solid ${C.border};background:transparent;color:${C.text}}
.pe-btn--p{background:${C.accent};border-color:${C.accent};flex:2}
.pe-btn--s{flex:1}
.pe-meas{max-width:1080px;margin:0 auto 22px;font-size:11px;color:${C.muted};font-family:ui-monospace,Menlo,monospace;display:flex;flex-wrap:wrap;gap:4px 14px;padding:4px 6px}
.pe-meas b{color:${C.text};font-weight:600}
.pe-toast{position:fixed;left:50%;bottom:max(16px,env(safe-area-inset-bottom));transform:translateX(-50%);background:#fff;color:#0F1923;padding:10px 16px;border-radius:10px;font-size:13px;font-weight:700;z-index:20;max-width:92vw;text-align:center}
.pe-reopen{display:block;margin:40px auto;min-height:44px;padding:0 20px;border-radius:10px;border:1px solid ${C.accent};background:${C.accent}22;color:#fff;font:inherit;font-weight:700;cursor:pointer}

/* ---- Diseño B: semanas = columnas ---- */
.pe-xl{width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid ${C.border};border-radius:12px;background:${C.bg}}
.pe-xt{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;min-width:var(--minw,0)}
.pe-xt th,.pe-xt td{padding:6px 5px;text-align:center;vertical-align:middle;border-bottom:1px solid ${C.border}33}
.pe-xt tr:last-child td{border-bottom:0}
.pe-xt .pe-vc{position:sticky;left:0;z-index:2;background:${C.card};text-align:left;padding:6px 10px;width:var(--vw,118px);border-right:1px solid ${C.border}}
.pe-xt thead th{background:${C.card};padding:8px 5px 6px}
.pe-xt thead .pe-vc{z-index:3}
.pe-wh{display:flex;flex-direction:column;align-items:center;gap:4px}
.pe-whl{font-size:12px;font-weight:800;letter-spacing:.5px;color:#fff;background:${C.accent};border-radius:999px;padding:3px 12px}
.pe-cp{height:26px;min-width:44px;font-size:11px;font-weight:700;border-radius:6px;background:transparent;border:1px solid ${C.border};color:${C.muted};cursor:pointer;font-family:inherit;padding:0 6px}
.pe-cp:hover{border-color:${C.accent};color:#fff}
.pe-cp[disabled]{opacity:.25;cursor:default}
.pe-vn{display:flex;align-items:center;justify-content:space-between;gap:4px;font-size:12px;font-weight:700;color:${C.muted};letter-spacing:.4px}
.pe-fillbtn{width:28px;height:28px;border-radius:6px;background:transparent;border:1px solid ${C.border};color:${C.muted};cursor:pointer;font-size:12px;padding:0}
.pe-fillbtn:hover{border-color:${C.accent};color:#fff}
.pe-xt .pe-in{height:40px}
.pe-nb{width:100%;min-height:36px;border-radius:8px;border:1px dashed ${C.border};background:transparent;color:${C.muted};font:inherit;font-size:12px;cursor:pointer;display:inline-flex;gap:6px;align-items:center;justify-content:center}
.pe-nb[aria-expanded=true]{border-style:solid;border-color:${C.accent};color:#fff}
.pe-nb--has{color:#fff}
.pe-notes{padding:8px 10px;display:grid;gap:6px;border-top:1px solid ${C.border}}
.pe-nl{display:flex;gap:8px;align-items:center}
.pe-nl b{font-size:11px;color:${C.accent};min-width:52px}
.pe-nl .pe-in{text-align:left;padding:0 10px;font-size:13px}
.pe-hint{font-size:11px;color:${C.muted};margin:6px 2px 0}

@media (max-width:1100px){.pe-top{grid-template-columns:1fr}}
@media (max-width:640px){
  .pe-root{padding-left:8px;padding-right:8px}
  .pe-head{padding:12px 14px 8px}.pe-body{padding:0 14px 8px}.pe-foot{padding:10px 14px}
  .pe-title{font-size:19px}
  .pe-in{height:44px;font-size:16px}
  .pe-xt .pe-in{height:44px}
  .pe-m{min-height:44px}
  .pe-shell--single{max-height:none}
  .pe-wk{position:relative}.pe-wk .pe-dot{position:absolute;top:6px;right:6px;width:6px;height:6px}
  .pe-xl{--vw:84px}
  .pe-tbl col.pe-nc,.pe-tbl col.pe-cc{display:none}
  .pe-tbl col.pe-wc{width:60px!important}
  .pe-tbl th.pe-hn,.pe-tbl td.pe-nc,.pe-tbl th.pe-hc,.pe-tbl td.pe-cc{display:none}
  .pe-tbl{border-spacing:0 6px}
  .pe-wk{height:44px;padding:0 6px;justify-content:center;font-size:12px}
  .pe-wkbtn{cursor:pointer;border:1px solid transparent}
  .pe-noterow{display:table-row}
  .pe-noterow td{padding:0 0 2px}
  .pe-noterow.is-closed{display:none}
  .pe-sm{height:44px;min-width:44px}
  .pe-chip{top:-7px}
  .pe-xt .pe-vc{padding:6px 8px;width:var(--vw,84px)}
  .pe-fillbtn{display:none}
  .pe-vn{font-size:11px}
  .pe-meas{display:none}
}
@media (min-width:641px){.pe-mobhint{display:none}}
`;

const methodOf = (id) => METODOS.find((m) => m.id === id) || METODOS[4];

function useKeyNav() {
  // Navegacion tipo planilla: Enter/↑/↓ mueven entre filas, ←/→ entre columnas cuando el cursor esta en el borde.
  return (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement) || t.dataset.r == null) return;
    let dr = 0, dc = 0;
    if (e.key === 'ArrowDown' || e.key === 'Enter') dr = 1;
    else if (e.key === 'ArrowUp') dr = -1;
    else if (e.key === 'ArrowRight' && t.selectionStart === t.value.length) dc = 1;
    else if (e.key === 'ArrowLeft' && t.selectionEnd === 0) dc = -1;
    else return;
    const root = t.closest('[data-grid]');
    const next = root && root.querySelector(`[data-r="${Number(t.dataset.r) + dr}"][data-c="${Number(t.dataset.c) + dc}"]`);
    if (next) { e.preventDefault(); next.focus(); }
  };
}

function Cell({ value, onChange, placeholder, r, c, label, tint, chip, chipColor, mode }) {
  return (
    <>
      <input className="pe-in" style={tint ? { background: tint } : undefined} value={value} placeholder={placeholder}
        inputMode={mode || 'decimal'} aria-label={label} data-r={r} data-c={c}
        onFocus={(e) => e.target.select()} onChange={(e) => onChange(e.target.value)} />
      {chip ? <span className="pe-chip" style={{ color: chipColor }} aria-hidden="true">{chip}</span> : null}
    </>
  );
}

function BaseRow({ base, setBase }) {
  return (
    <div className="pe-base">
      {FIELDS.map((f) => {
        const k = f.key === 'pausa' ? 'pause' : f.key;
        return (
          <label key={k}>
            <span className="pe-fl">{f.short}</span>
            <input className="pe-in" value={base[k]} inputMode={f.key === 'reps' ? 'text' : 'decimal'} aria-label={'Base ' + f.label}
              onFocus={(e) => e.target.select()} onChange={(e) => setBase({ ...base, [k]: e.target.value })} />
          </label>
        );
      })}
    </div>
  );
}

function Methods({ method, setMethod, onAuto }) {
  const m = methodOf(method);
  return (
    <div>
      <div className="pe-methods" role="group" aria-label="Método de progresión">
        {METODOS.map((x) => (
          <button key={x.id} type="button" className="pe-m" aria-pressed={method === x.id} onClick={() => setMethod(x.id)}
            style={method === x.id ? { borderColor: x.color, background: x.color + '22', color: x.color } : undefined}>{x.label}</button>
        ))}
      </div>
      <div className="pe-mrow">
        <span>{m.desc}{method === 'manual' ? '' : ' — se resalta lo que progresa'}</span>
        <button type="button" className="pe-auto" disabled={method === 'manual'} onClick={onAuto}>Autocompletar semanas</button>
      </div>
    </div>
  );
}

function DesignA({ s }) {
  const { weeks, n, base, method, openNotes, toggleNote, upd, doCopy } = s;
  const m = methodOf(method);
  const nav = useKeyNav();
  const rows = weeks.slice(0, n);
  return (
    <div data-grid onKeyDown={nav}>
      <div className="pe-sec">Valores por semana</div>
      <table className="pe-tbl">
        <colgroup><col className="pe-wc" style={{ width: 74 }} /><col /><col /><col /><col /><col className="pe-nc" style={{ width: '34%' }} /><col className="pe-cc" style={{ width: 48 }} /></colgroup>
        <thead>
          <tr>
            <th>SEM</th>
            {FIELDS.map((f) => <th key={f.key} style={m.field === f.key ? { color: m.color } : undefined}>{f.short}</th>)}
            <th className="pe-hn" style={{ textAlign: 'left', paddingLeft: 3 }}>NOTA</th>
            <th className="pe-hc" />
          </tr>
        </thead>
        <tbody>
          {rows.map((w, i) => {
            const open = openNotes.has(i);
            const prev = i > 0 ? rows[i - 1] : null;
            const chip = prev ? deltaHint(method, prev, w) : '';
            return (
              <React.Fragment key={i}>
                <tr>
                  <td>
                    <button type="button" className="pe-wk pe-wkbtn" aria-label={'Semana ' + (i + 1) + ': abrir o cerrar nota'} aria-expanded={open} onClick={() => toggleNote(i)}>
                      SEM {i + 1}{w.note ? <span className="pe-dot" aria-hidden="true" /> : null}
                    </button>
                  </td>
                  {FIELDS.map((f, ci) => {
                    const hot = m.field === f.key;
                    return (
                      <td key={f.key}>
                        <Cell value={w[f.key]} r={i} c={ci} label={'Semana ' + (i + 1) + ' ' + f.label}
                          placeholder={f.key === 'pausa' ? base.pause : base[f.key]} mode={f.key === 'reps' ? 'text' : 'decimal'}
                          onChange={(v) => upd(i, f.key, v)} tint={hot ? m.color + '1a' : undefined}
                          chip={hot ? chip : ''} chipColor={m.color} />
                      </td>
                    );
                  })}
                  <td className="pe-nc">
                    {open ? (
                      <div className="pe-note">
                        <input className="pe-in" autoFocus value={w.note} placeholder="Nota de la semana" aria-label={'Nota semana ' + (i + 1)} onChange={(e) => upd(i, 'note', e.target.value)} />
                        <button type="button" className="pe-sm" aria-label="Cerrar nota" onClick={() => toggleNote(i)}>✕</button>
                      </div>
                    ) : (
                      <button type="button" className={'pe-ghost' + (w.note ? ' pe-ghost--has' : '')} aria-expanded="false" aria-label={'Abrir nota semana ' + (i + 1)} onClick={() => toggleNote(i)}>
                        {w.note ? <><span className="pe-dot" /><span>{w.note}</span></> : <span>＋ Agregar nota</span>}
                      </button>
                    )}
                  </td>
                  <td className="pe-cc">
                    {i > 0 ? <button type="button" className="pe-sm" title="Copiar valores de la semana anterior" aria-label={'Copiar semana ' + i + ' a semana ' + (i + 1)} onClick={() => doCopy(i - 1, i)}>⧉</button> : null}
                  </td>
                </tr>
                <tr className={'pe-noterow' + (open ? '' : ' is-closed')}>
                  <td colSpan={5}>
                    <div className="pe-note">
                      <input className="pe-in" value={w.note} placeholder={'Nota semana ' + (i + 1)} aria-label={'Nota semana ' + (i + 1) + ' (móvil)'} style={{ textAlign: 'left', padding: '0 10px' }} onChange={(e) => upd(i, 'note', e.target.value)} />
                      {i > 0 ? <button type="button" className="pe-sm" aria-label={'Copiar semana ' + i + ' a semana ' + (i + 1)} onClick={() => doCopy(i - 1, i)}>⧉</button> : null}
                    </div>
                  </td>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      <div className="pe-hint pe-mobhint">Tocá “SEM n” para abrir su nota · ⧉ copia la semana anterior.</div>
    </div>
  );
}

function DesignB({ s }) {
  const { weeks, n, base, method, openNotes, toggleNote, upd, doCopy, doFill } = s;
  const m = methodOf(method);
  const nav = useKeyNav();
  const rows = weeks.slice(0, n);
  const noteRowBase = FIELDS.length;
  const openList = [...openNotes].filter((i) => i < n).sort((a, b) => a - b);
  return (
    <div data-grid onKeyDown={nav}>
      <div className="pe-sec">Valores por semana</div>
      <div className="pe-xl" data-xl>
        <table className="pe-xt" style={{ '--minw': (n * 92 + 90) + 'px' }}>
          <colgroup><col style={{ width: 'var(--vw, 118px)' }} />{rows.map((_, i) => <col key={i} />)}</colgroup>
          <thead>
            <tr>
              <th className="pe-vc" scope="col" style={{ fontSize: 10, letterSpacing: .5, color: C.muted }}>VARIABLE</th>
              {rows.map((_, i) => (
                <th key={i} scope="col">
                  <div className="pe-wh">
                    <span className="pe-whl">SEM {i + 1}</span>
                    <button type="button" className="pe-cp" disabled={i >= n - 1} aria-label={'Copiar semana ' + (i + 1) + ' a semana ' + (i + 2)} title="Copiar esta semana a la siguiente" onClick={() => doCopy(i, i + 1)}>copiar →</button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FIELDS.map((f, ri) => {
              const hot = m.field === f.key;
              return (
                <tr key={f.key} style={hot ? { '--tint': m.color + '14' } : undefined}>
                  <th className="pe-vc" scope="row" style={hot ? { color: m.color } : undefined}>
                    <div className="pe-vn"><span style={hot ? { color: m.color } : undefined}>{f.short}</span>
                      <button type="button" className="pe-fillbtn" aria-label={'Repetir ' + f.label + ' de la semana 1 en todas'} title="Repetir el valor de Sem 1 en todas las semanas" onClick={() => doFill(f.key)}>⇥</button>
                    </div>
                  </th>
                  {rows.map((w, i) => (
                    <td key={i} className={hot ? 'pe-tint' : undefined} style={{ position: 'relative' }}>
                      <Cell value={w[f.key]} r={ri} c={i} label={'Semana ' + (i + 1) + ' ' + f.label}
                        placeholder={f.key === 'pausa' ? base.pause : base[f.key]} mode={f.key === 'reps' ? 'text' : 'decimal'}
                        onChange={(v) => upd(i, f.key, v)} tint={hot ? m.color + '1a' : undefined}
                        chip={hot && i > 0 ? deltaHint(method, rows[i - 1], w) : ''} chipColor={m.color} />
                    </td>
                  ))}
                </tr>
              );
            })}
            <tr>
              <th className="pe-vc" scope="row"><div className="pe-vn"><span>NOTA</span></div></th>
              {rows.map((w, i) => (
                <td key={i}>
                  <button type="button" className={'pe-nb' + (w.note ? ' pe-nb--has' : '')} aria-expanded={openNotes.has(i)} aria-label={'Nota semana ' + (i + 1)} onClick={() => toggleNote(i)}>
                    {w.note ? <span className="pe-dot" /> : <span aria-hidden="true">＋</span>}<span>{w.note ? 'ver' : 'nota'}</span>
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        {openList.length ? (
          <div className="pe-notes">
            {openList.map((i) => (
              <div className="pe-nl" key={i}>
                <b>SEM {i + 1}</b>
                <input className="pe-in" autoFocus value={weeks[i].note} placeholder="Nota de la semana" aria-label={'Nota semana ' + (i + 1)} onChange={(e) => upd(i, 'note', e.target.value)} />
                <button type="button" className="pe-sm" aria-label="Cerrar nota" onClick={() => toggleNote(i)}>✕</button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div className="pe-hint">Flechas/Enter mueven entre celdas · “copiar →” duplica la semana · ⇥ repite el valor de Sem 1 en toda la fila.</div>
    </div>
  );
}

function Shell({ design, s, single }) {
  const bodyRef = useRef(null);
  const shellRef = useRef(null);
  const [meas, setMeas] = useState({ h: 0, w: 0, vh: 0, hs: false });
  useLayoutEffect(() => {
    const el = bodyRef.current;
    const measure = () => {
      const xl = el && el.querySelector('[data-xl]');
      const head = shellRef.current ? shellRef.current.querySelector('.pe-head').offsetHeight : 0;
      const foot = shellRef.current ? shellRef.current.querySelector('.pe-foot').offsetHeight : 0;
      const next = { h: el ? el.scrollHeight + head + foot : 0, w: shellRef.current ? shellRef.current.offsetWidth : 0, vh: window.innerHeight, hs: !!(xl && xl.scrollWidth > xl.clientWidth + 1) };
      setMeas((p) => (p.h === next.h && p.w === next.w && p.vh === next.vh && p.hs === next.hs ? p : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (el) ro.observe(el);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  });
  const { n, base, setBase, method, setMethod, onAuto, onClose, onSave } = s;
  const fits = meas.h <= meas.vh - 90;
  return (
    <>
      <section ref={shellRef} className={'pe-shell' + (single ? ' pe-shell--single' : '')} aria-label={'Editor de ejercicio, diseño ' + design}>
        <div className="pe-head">
          <div className="pe-ico" aria-hidden="true">PI</div>
          <div className="pe-title">{EXERCISE_NAME}</div>
          <span className="pe-tag">DISEÑO {design}</span>
          <button type="button" className="pe-x" aria-label="Cerrar" onClick={onClose}>×</button>
        </div>
        <div className="pe-body" ref={bodyRef}>
          <div className="pe-top">
            <div><div className="pe-sec">Configuración base</div><BaseRow base={base} setBase={setBase} /></div>
            <div><div className="pe-sec">Método de progresión</div><Methods method={method} setMethod={setMethod} onAuto={onAuto} /></div>
          </div>
          {design === 'A' ? <DesignA s={s} /> : <DesignB s={s} />}
        </div>
        <div className="pe-foot">
          <button type="button" className="pe-btn pe-btn--s" onClick={onClose}>CANCELAR</button>
          <button type="button" className="pe-btn pe-btn--p" onClick={onSave}>GUARDAR</button>
        </div>
      </section>
      <div className="pe-meas" aria-live="off">
        <span>Diseño {design} · {n} semanas</span>
        <span>alto del editor <b>{meas.h}px</b></span>
        <span>ancho <b>{meas.w}px</b></span>
        <span>pantalla {meas.vh}px · {fits ? <b style={{ color: C.ok }}>cabe sin scroll vertical</b> : <b style={{ color: '#F59E0B' }}>requiere scroll vertical</b>}</span>
        <span>scroll horizontal: <b>{meas.hs ? 'sí' : 'no'}</b></span>
      </div>
    </>
  );
}

export default function ProgresionEditorDemo() {
  const [mode, setMode] = useState('A'); // 'A' | 'B' | 'AB'
  const [n, setN] = useState(6);
  const [base, setBase] = useState(BASE_INICIAL);
  const [weeks, setWeeks] = useState(semanasIniciales);
  const [method, setMethod] = useState('carga');
  const [openNotes, setOpenNotes] = useState(() => new Set());
  const [closed, setClosed] = useState(false);
  const [toast, setToast] = useState('');
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(''), 2400); return () => clearTimeout(t); }, [toast]);

  const s = useMemo(() => ({
    weeks, n, base, setBase, method, setMethod, openNotes,
    toggleNote: (i) => setOpenNotes((p) => { const q = new Set(p); if (q.has(i)) q.delete(i); else q.add(i); return q; }),
    upd: (i, f, v) => setWeeks((p) => setCell(p, i, f, v)),
    doCopy: (a, b) => { setWeeks((p) => copyWeek(p, a, b)); setToast('Semana ' + (a + 1) + ' copiada a semana ' + (b + 1)); },
    doFill: (f) => { setWeeks((p) => fillRight(p, f, 0, n)); setToast('Valor de Sem 1 repetido en todas las semanas'); },
    onAuto: () => setWeeks((p) => autocompletar(p, base, method, n)),
    onClose: () => setClosed(true),
    onSave: () => setToast('Demo: no se guarda nada (maqueta, sin conexión)'),
  }), [weeks, n, base, method, openNotes]);

  return (
    <div className="pe-root">
      <style>{CSS}</style>
      <div className="pe-bar">
        <h1><b>Demo · Editor de progresión semanal</b><br />Datos ficticios · no guarda nada · mismos datos en A y B</h1>
        <div className="pe-lbl">DISEÑO
          <div className="pe-seg" role="group" aria-label="Diseño">
            {[['A', 'A · Tabla'], ['B', 'B · Planilla'], ['AB', 'Ambos']].map(([k, l]) => (
              <button key={k} type="button" aria-pressed={mode === k} onClick={() => { setMode(k); setClosed(false); }}>{l}</button>
            ))}
          </div>
        </div>
        <div className="pe-lbl">SEMANAS
          <div className="pe-seg" role="group" aria-label="Cantidad de semanas">
            {[4, 6, 8].map((k) => <button key={k} type="button" aria-pressed={n === k} onClick={() => setN(k)}>{k}</button>)}
          </div>
        </div>
        <button type="button" className="pe-reset" onClick={() => { setBase(BASE_INICIAL); setWeeks(semanasIniciales()); setOpenNotes(new Set()); setMethod('carga'); }}>Restablecer datos</button>
      </div>
      {closed ? (
        <button type="button" className="pe-reopen" onClick={() => setClosed(false)}>Reabrir editor</button>
      ) : (
        <>
          {(mode === 'A' || mode === 'AB') && <Shell design="A" s={s} single={mode !== 'AB'} />}
          {(mode === 'B' || mode === 'AB') && <Shell design="B" s={s} single={mode !== 'AB'} />}
        </>
      )}
      {toast ? <div className="pe-toast" role="status">{toast}</div> : null}
    </div>
  );
}
