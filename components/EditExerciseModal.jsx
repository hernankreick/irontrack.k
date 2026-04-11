import React, { useState, useEffect } from 'react';

const METODOS = [
  { id: 'carga',  label: '+ Carga',   desc: 'Subir kg c/semana — completá los valores de cada semana abajo' },
  { id: 'reps',   label: '+ Reps',    desc: 'Más reps, mismo peso — completá los valores de cada semana abajo' },
  { id: 'series', label: '+ Series',  desc: 'Más series c/semana — completá los valores de cada semana abajo' },
  { id: 'pausa',  label: '− Pausa',   desc: 'Reducir descanso — completá los valores de cada semana abajo' },
  { id: 'manual', label: 'Manual',    desc: 'Definís vos los valores de cada semana' },
];

function initWeeks(exercise) {
  const w = [...(exercise?.weeks || [])];
  while (w.length < 4) w.push({ sets: '', reps: '', kg: '', note: '', pausa: '' });
  return w.slice(0, 4).map(wk => ({
    sets:  wk.sets  ?? '',
    reps:  wk.reps  ?? '',
    kg:    wk.kg    ?? '',
    note:  wk.note  ?? '',
    pausa: wk.pausa ?? '',
  }));
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const BG       = '#0f172a';
const BG_CARD  = '#1e293b';
const BG_WEEK  = '#0f172a';
const BORDER_INACTIVE = 'rgba(255,255,255,0.15)';
const ACTIVE_COLOR    = '#22c55e';
const TEXT_MUTED      = '#94a3b8';
const TEXT_LABEL      = '#64748b';

const baseInput = {
  background: BG,
  color: '#f1f5f9',
  border: `1px solid ${BORDER_INACTIVE}`,
  borderRadius: 10,
  padding: '10px 8px',
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  textAlign: 'center',
};

const sectionLabel = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '1px',
  color: TEXT_LABEL,
  textTransform: 'uppercase',
  marginBottom: 10,
};

const fieldLabel = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '.5px',
  color: TEXT_LABEL,
  textTransform: 'uppercase',
  marginBottom: 6,
  display: 'block',
};

// ─────────────────────────────────────────────────────────────────────────────

export function EditExerciseModal({ exercise, onSave, onClose }) {
  const [sets,       setSets]       = useState('3');
  const [reps,       setReps]       = useState('8-10');
  const [kg,         setKg]         = useState('');
  const [pause,      setPause]      = useState('90');
  const [progresion, setProgresion] = useState('manual');
  const [weeks,      setWeeks]      = useState(() => initWeeks(null));

  useEffect(() => {
    if (exercise) {
      setSets(String(exercise.sets  ?? '3'));
      setReps(String(exercise.reps  ?? '8-10'));
      setKg(String(exercise.kg      ?? ''));
      setPause(String(exercise.pause ?? '90'));
      setProgresion(exercise.progresion ?? 'manual');
      setWeeks(initWeeks(exercise));
    } else {
      setSets('3'); setReps('8-10'); setKg('');
      setPause('90'); setProgresion('manual');
      setWeeks(initWeeks(null));
    }
  }, [exercise]);

  const updW = (wi, field, val) =>
    setWeeks(prev => prev.map((w, i) => i === wi ? { ...w, [field]: val } : w));

  const autocompletar = () => {
    if (progresion === 'manual') return;
    setWeeks(prev => prev.map((w, i) => {
      const p = i > 0 ? prev[i - 1] : null;
      const base = {
        sets:  w.sets  || sets,
        reps:  w.reps  || reps,
        kg:    w.kg    || kg,
        note:  w.note,
        pausa: w.pausa || pause,
      };
      if (i === 0) return base;
      if (progresion === 'carga') {
        const kgPrev = parseFloat(p.kg || kg || 0);
        return { ...base, kg: String(Math.round((kgPrev + 2.5) * 10) / 10) };
      }
      if (progresion === 'reps') {
        return { ...base, reps: String(parseInt(p.reps || reps || 8) + 1) };
      }
      if (progresion === 'series') {
        return { ...base, sets: String(parseInt(p.sets || sets || 3) + 1) };
      }
      if (progresion === 'pausa') {
        const pausaPrev = parseInt(p.pausa || pause || 90);
        return { ...base, pausa: String(Math.max(15, pausaPrev - 15)) };
      }
      return base;
    }));
  };

  const handleSave = () => {
    onSave({
      sets,
      reps,
      kg,
      pause,
      progresion,
      weeks: weeks.map(w => ({ ...w, pausa: w.pausa || pause })),
    });
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.85)',
        zIndex: 200,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        display: 'flex',
        justifyContent: 'center',
        paddingBottom: 32,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: BG_CARD,
          margin: '24px 16px 0',
          borderRadius: 18,
          padding: '20px 16px 24px',
          width: '100%',
          maxWidth: 480,
          alignSelf: 'flex-start',
        }}
      >
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ flex: 1, fontSize: 17, fontWeight: 800, color: '#f1f5f9', wordBreak: 'break-word', lineHeight: 1.3 }}>
            {exercise?.name || 'Nuevo ejercicio'}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none',
              color: TEXT_MUTED, fontSize: 24, cursor: 'pointer',
              padding: '4px 8px', lineHeight: 1, flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* ══ 1. CONFIGURACIÓN BASE ══ */}
        <div style={sectionLabel}>Configuración Base</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          <div>
            <span style={fieldLabel}>Series</span>
            <input style={baseInput} value={sets} onChange={e => setSets(e.target.value)} />
          </div>
          <div>
            <span style={fieldLabel}>Reps</span>
            <input style={baseInput} value={reps} onChange={e => setReps(e.target.value)} />
          </div>
          <div>
            <span style={fieldLabel}>Kg</span>
            <input style={baseInput} value={kg} onChange={e => setKg(e.target.value)} placeholder="—" />
          </div>
          <div>
            <span style={fieldLabel}>Pausa (seg)</span>
            <input style={baseInput} value={pause} onChange={e => setPause(e.target.value)} placeholder="90" />
          </div>
        </div>

        {/* ══ 2. MÉTODO DE PROGRESIÓN ══ */}
        <div style={sectionLabel}>Método de Progresión</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {METODOS.map(m => {
            const active = progresion === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setProgresion(m.id)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: `1px solid ${active ? ACTIVE_COLOR : BORDER_INACTIVE}`,
                  background: active ? 'rgba(34,197,94,0.12)' : 'transparent',
                  color: active ? ACTIVE_COLOR : TEXT_MUTED,
                  fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all .15s',
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Texto descriptivo + autocompletar */}
        <div style={{
          background: BG,
          borderRadius: 10,
          padding: '10px 12px',
          marginBottom: 20,
          fontSize: 12,
          color: TEXT_MUTED,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}>
          <span style={{ lineHeight: 1.5 }}>
            {METODOS.find(m => m.id === progresion)?.desc}
          </span>
          {progresion !== 'manual' && (
            <button
              onClick={autocompletar}
              style={{
                background: 'rgba(34,197,94,0.12)',
                border: '1px solid rgba(34,197,94,0.3)',
                borderRadius: 7,
                padding: '5px 10px',
                color: ACTIVE_COLOR,
                fontSize: 11, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              Autocompletar semanas
            </button>
          )}
        </div>

        {/* ══ 3. VALORES POR SEMANA ══ */}
        <div style={sectionLabel}>Valores por Semana</div>
        {weeks.map((w, wi) => {
          // Delta hint vs semana anterior
          let hint = null;
          if (wi > 0 && progresion !== 'manual') {
            const p = weeks[wi - 1];
            if (progresion === 'carga'  && p.kg    && w.kg)    hint = (parseFloat(w.kg)  - parseFloat(p.kg)  > 0 ? '+' : '') + Math.round((parseFloat(w.kg)  - parseFloat(p.kg))  * 10) / 10 + ' kg';
            if (progresion === 'reps'   && p.reps  && w.reps)  hint = (parseInt(w.reps)  - parseInt(p.reps)  > 0 ? '+' : '') + (parseInt(w.reps)  - parseInt(p.reps))  + ' reps';
            if (progresion === 'series' && p.sets  && w.sets)  hint = (parseInt(w.sets)  - parseInt(p.sets)  > 0 ? '+' : '') + (parseInt(w.sets)  - parseInt(p.sets))  + ' series';
            if (progresion === 'pausa'  && p.pausa && w.pausa) hint = (parseInt(w.pausa) - parseInt(p.pausa) > 0 ? '+' : '') + (parseInt(w.pausa) - parseInt(p.pausa)) + 's pausa';
          }

          return (
            <div
              key={wi}
              style={{
                background: BG_WEEK,
                borderRadius: 12,
                padding: '12px',
                marginBottom: 8,
              }}
            >
              {/* Semana header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: ACTIVE_COLOR }}>
                  SEM {wi + 1}
                </span>
                {hint && (
                  <span style={{ fontSize: 11, color: ACTIVE_COLOR, fontWeight: 700 }}>
                    {hint}
                  </span>
                )}
              </div>

              {/* Grid 2×2 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <span style={fieldLabel}>Series</span>
                  <input style={baseInput} value={w.sets}  onChange={e => updW(wi, 'sets',  e.target.value)} placeholder={sets} />
                </div>
                <div>
                  <span style={fieldLabel}>Reps</span>
                  <input style={baseInput} value={w.reps}  onChange={e => updW(wi, 'reps',  e.target.value)} placeholder={reps} />
                </div>
                <div>
                  <span style={fieldLabel}>Kg</span>
                  <input style={baseInput} value={w.kg}    onChange={e => updW(wi, 'kg',    e.target.value)} placeholder={kg || '—'} />
                </div>
                <div>
                  <span style={fieldLabel}>Pausa</span>
                  <input style={baseInput} value={w.pausa} onChange={e => updW(wi, 'pausa', e.target.value)} placeholder={pause + 's'} />
                </div>
              </div>

              {/* Nota */}
              <input
                style={{ ...baseInput, textAlign: 'left', fontSize: 12, color: TEXT_MUTED }}
                value={w.note}
                onChange={e => updW(wi, 'note', e.target.value)}
                placeholder="Nota de semana (opcional)"
              />
            </div>
          );
        })}

        {/* ══ 4. BOTONES ══ */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '14px',
              background: 'transparent',
              border: `1px solid ${BORDER_INACTIVE}`,
              borderRadius: 12, color: TEXT_MUTED,
              fontSize: 13, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            CANCELAR
          </button>
          <button
            onClick={handleSave}
            style={{
              flex: 2, padding: '14px',
              background: '#3b82f6', border: 'none',
              borderRadius: 12, color: '#fff',
              fontSize: 14, fontWeight: 800,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            GUARDAR
          </button>
        </div>
      </div>
    </div>
  );
}
