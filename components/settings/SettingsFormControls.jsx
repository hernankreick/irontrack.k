import React, { createContext, useContext } from 'react';
import coachSettingsPalette from './coachSettingsPalette.js';

const DEFAULT_SETTINGS_PALETTE = coachSettingsPalette(true);

export const SettingsPaletteContext = createContext(null);

export function useSettingsPalette() {
  const p = useContext(SettingsPaletteContext);
  if (!p) return DEFAULT_SETTINGS_PALETTE;
  return p;
}

export function Row({ label, desc, children, inline = false }) {
  const C = useSettingsPalette();
  // < 768 px: etiqueta y descripcion arriba, control abajo a ancho completo (salvo `inline`, p. ej. interruptores).
  return (
    <div className={inline ? undefined : 'it-set-row'} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, padding: '14px 18px',
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: C.rCard, marginBottom: 8,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{desc}</div>}
      </div>
      {children}
    </div>
  );
}

export function SectionTitle({ children }) {
  const C = useSettingsPalette();
  return (
    <div className="it-set-title" style={{
      fontSize: 11, fontWeight: 600, letterSpacing: '1px',
      textTransform: 'uppercase', color: C.muted,
      marginBottom: 10, marginTop: 4,
    }}>{children}</div>
  );
}

export function Input({ label, value, onChange, type = 'text', placeholder }) {
  const C = useSettingsPalette();
  return (
    <div>
      {label && (
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: '0.8px',
          textTransform: 'uppercase', color: C.muted, marginBottom: 6,
        }}>{label}</div>
      )}
      <input
        className="it-set-input"
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', background: C.control, border: `1px solid ${C.borderStrong}`,
          borderRadius: C.rCtrl, padding: '10px 14px', fontSize: 14,
          color: C.text, fontFamily: 'inherit', boxSizing: 'border-box',
          outline: 'none',
        }}
      />
    </div>
  );
}

export function BtnGroup({ options, value, onChange }) {
  const C = useSettingsPalette();
  return (
    <div className="it-set-btngroup" style={{
      display: 'flex', gap: 4,
      background: C.control, border: `1px solid ${C.borderStrong}`,
      borderRadius: C.rCtrl, padding: 3,
    }}>
      {options.map(o => (
        <button
          key={o.id}
          type="button"
          className="it-set-btn"
          onClick={() => onChange(o.id)}
          style={{
            padding: '6px 14px', borderRadius: C.rCtrl - 2, border: 'none',
            cursor: 'pointer', fontSize: 12, fontWeight: value === o.id ? 700 : 500,
            fontFamily: 'inherit',
            background: value === o.id ? C.blue : 'transparent',
            color: value === o.id ? C.onBlue : C.sub,
          }}
        >{o.label}</button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange }) {
  const C = useSettingsPalette();
  // El boton es el area tactil (44 x 44 px en < 768 px); la pista visual de 40 x 22 va centrada dentro.
  return (
    <button
      type="button"
      className="it-set-toggle"
      role="switch"
      aria-checked={!!checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 40, height: 22, border: 'none', background: 'transparent',
        cursor: 'pointer', padding: 0, flexShrink: 0,
        position: 'relative',
      }}
    >
      <span style={{
        position: 'absolute', left: '50%', top: '50%', width: 40, height: 22,
        transform: 'translate(-50%, -50%)', borderRadius: 11,
        background: checked ? C.blue : C.borderStrong,
        transition: 'background .2s',
      }}>
        <span style={{
          position: 'absolute', width: 16, height: 16,
          background: C.onBlue, borderRadius: '50%',
          top: 3, left: checked ? 21 : 3,
          transition: 'left .2s',
        }} />
      </span>
    </button>
  );
}

export function SaveBtn({ onClick, saved, savedHint, saveLabel, savedLabel }) {
  const C = useSettingsPalette();
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20, gap: 10, alignItems: 'center' }}>
      {saved && <span style={{ fontSize: 12, color: C.green }}>{savedHint ?? 'Saved ✓'}</span>}
      <button className="coach-tap"
        type="button"
        onClick={onClick}
        style={{
          background: C.blue, color: C.onBlue, border: 'none',
          borderRadius: C.rCtrl, padding: '10px 24px',
          fontSize: 12, fontWeight: 700, letterSpacing: '0.5px',
          textTransform: 'uppercase', cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >{saved ? (savedLabel ?? 'SAVED ✓') : (saveLabel ?? 'SAVE')}</button>
    </div>
  );
}
