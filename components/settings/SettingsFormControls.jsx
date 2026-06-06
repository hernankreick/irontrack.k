import React, { createContext, useContext } from 'react';

const DEFAULT_SETTINGS_PALETTE = {
  bg: '#0B0E11',
  card: '#111827',
  border: '#1A2535',
  blue: '#2563EB',
  blueL: '#3B82F6',
  green: '#22C55E',
  red: '#EF4444',
  text: '#F1F5F9',
  muted: '#64748B',
  sub: '#94A3B8',
  chrome: '#0D1117',
  navActiveBg: '#1D2D50',
  navInactiveDangerText: '#FCA5A5',
  currencySelBg: '#1D2D50',
  proBadgeBg: '#1A2E1A',
  proBadgeBorder: '#166534',
  subscriptionBanner: 'linear-gradient(135deg, #1D2D50 0%, #0F1829 100%)',
  deleteDisabledBg: '#4B1A1A',
  deleteBtnDisabledFg: '#fff',
  deleteWarnText: '#FCA5A5',
  dangerCardBorder: '#4B1A1A',
};

export const SettingsPaletteContext = createContext(null);

export function useSettingsPalette() {
  const p = useContext(SettingsPaletteContext);
  if (!p) return DEFAULT_SETTINGS_PALETTE;
  return p;
}

export function Row({ label, desc, children }) {
  const C = useSettingsPalette();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, padding: '14px 18px',
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 10, marginBottom: 6,
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{desc}</div>}
      </div>
      {children}
    </div>
  );
}

export function SectionTitle({ children }) {
  const C = useSettingsPalette();
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, letterSpacing: '1px',
      textTransform: 'uppercase', color: C.muted,
      marginBottom: 10, marginTop: 4,
    }}>{children}</div>
  );
}

export function Input({ label, value, onChange, type = 'text', placeholder }) {
  const C = useSettingsPalette();
  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: '0.8px',
          textTransform: 'uppercase', color: C.muted, marginBottom: 6,
        }}>{label}</div>
      )}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', background: C.bg, border: `1px solid ${C.border}`,
          borderRadius: 8, padding: '10px 14px', fontSize: 14,
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
    <div style={{
      display: 'flex', gap: 4,
      background: C.bg, border: `1px solid ${C.border}`,
      borderRadius: 8, padding: 3,
    }}>
      {options.map(o => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          style={{
            padding: '6px 14px', borderRadius: 6, border: 'none',
            cursor: 'pointer', fontSize: 12, fontWeight: 500,
            fontFamily: 'inherit',
            background: value === o.id ? C.blue : 'transparent',
            color: value === o.id ? '#fff' : C.muted,
          }}
        >{o.label}</button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange }) {
  const C = useSettingsPalette();
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: 40, height: 22, borderRadius: 11, border: 'none',
        cursor: 'pointer', padding: 0, flexShrink: 0,
        background: checked ? C.blue : C.border,
        position: 'relative', transition: 'background .2s',
      }}
    >
      <span style={{
        position: 'absolute', width: 16, height: 16,
        background: '#fff', borderRadius: '50%',
        top: 3, left: checked ? 21 : 3,
        transition: 'left .2s',
      }} />
    </button>
  );
}

export function SaveBtn({ onClick, saved, savedHint, saveLabel, savedLabel }) {
  const C = useSettingsPalette();
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20, gap: 10, alignItems: 'center' }}>
      {saved && <span style={{ fontSize: 12, color: C.green }}>{savedHint ?? 'Saved ✓'}</span>}
      <button
        type="button"
        onClick={onClick}
        style={{
          background: C.blue, color: '#fff', border: 'none',
          borderRadius: 8, padding: '10px 24px',
          fontSize: 12, fontWeight: 700, letterSpacing: '0.5px',
          textTransform: 'uppercase', cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >{saved ? (savedLabel ?? 'SAVED ✓') : (saveLabel ?? 'SAVE')}</button>
    </div>
  );
}
