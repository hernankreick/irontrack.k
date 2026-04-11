import React from 'react';

export function MetricPill({ label, value, highlight }) {
  return (
    <div style={{
      background: highlight ? 'rgba(59,130,246,0.15)' : 'rgba(148,163,184,0.07)',
      border: `1px solid ${highlight ? 'rgba(59,130,246,0.25)' : 'transparent'}`,
      borderRadius: 7,
      padding: '4px 9px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 13,
        fontWeight: 700,
        color: highlight ? '#93c5fd' : '#e2e8f0',
      }}>
        {value ?? '–'}
      </span>
      <span style={{
        fontSize: 10,
        textTransform: 'uppercase',
        color: '#64748b',
        letterSpacing: '.5px',
      }}>
        {label}
      </span>
    </div>
  );
}
