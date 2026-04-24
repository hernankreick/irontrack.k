import React from 'react';
import './routines-ui.css';
import { coachSpace as S } from '../coachUiScale.js';

export function RoutineSkeleton({ darkMode, border, count = 3 }) {
  const cards = Array.from({ length: count });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: S.blockGap }}>
      {cards.map((_, i) => (
        <div
          key={'sk-' + i}
          className="it-routine-card-wrap"
          style={{
            border: `1px solid ${border}`,
            borderRadius: 12,
            overflow: 'hidden',
            background: darkMode ? 'rgba(17,28,43,0.85)' : '#f8fafc',
            padding: 16,
          }}
        >
          <div className="it-routine-skeleton-line" style={{ height: 22, width: '55%', marginBottom: 12 }} />
          <div className="it-routine-skeleton-line" style={{ height: 12, width: '38%', marginBottom: 16 }} />
          <div className="it-routine-skeleton-line" style={{ height: 40, width: '100%', marginBottom: 10 }} />
          <div className="it-routine-skeleton-line" style={{ height: 40, width: '100%' }} />
        </div>
      ))}
    </div>
  );
}
