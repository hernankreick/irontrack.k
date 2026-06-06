import React from 'react';

export default function SettingsProfileSummaryCard({
  C,
  initialsText,
  displayName,
  email,
  proActiveLabel,
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 12, padding: '16px 18px', marginBottom: 20,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
        background: `linear-gradient(135deg, ${C.blue}, #7C3AED)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: 'Bebas Neue, sans-serif',
      }}>{initialsText}</div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.text }}>{displayName}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{email}</div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: C.proBadgeBg, border: `1px solid ${C.proBadgeBorder}`,
          borderRadius: 20, padding: '2px 10px', marginTop: 6,
          fontSize: 11, fontWeight: 600, color: C.green,
        }}>{proActiveLabel}</div>
      </div>
    </div>
  );
}
