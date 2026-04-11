import React, { useState, useEffect } from 'react';

const METODOS = [
  { id: 'carga',  label: '+ Carga',   desc: 'Subir kg c/semana',      color: '#2563EB' },
  { id: 'reps',   label: '+ Reps',    desc: 'Más reps, mismo peso',   color: '#22C55E' },
  { id: 'series', label: '+ Series',  desc: 'Más series c/semana',    color: '#8B5CF6' },
  { id: 'pausa',  label: '− Pausa',   desc: 'Reducir descanso',       color: '#F59E0B' },
  { id: 'manual', label: 'Manual',    desc: 'Definís vos c/semana',   color: '#8B9AB2' },
];

function initWeeks(exercise) {
  const w = [...(exercise?.weeks || [])];
  while (w.length < 4) w.push({ sets: '', reps: '', kg: '', note: '', pausa: '' });
  return w.slice(0, 4).map(wk => ({
    sets:  wk.sets  || '',
    reps:  wk.reps  || '',
    kg:    wk.kg    || '',
    note:  wk.note  || '',
    pausa: wk.pausa || '',
  }));
}

export function EditExerciseModal({ exercise, onSave, onClose }) {
  const [sets,       setSets]       = useState('3');
  const [reps,       setReps]       = useState('8-10');
  const [kg,         setKg]         = useState('');
  const [pause,      setPause]      = useState('90');
  const [rpe,        setRpe]        = useState('');
  const [progresion, setProgresion] = useState('manual');
  const [weeks,      setWeeks]      = useState(() => initWeeks(null));

  // Populate form when exercise changes
  useEffect(() => {
    if (exercise) {
      setSets(exercise.sets       ?? '3');
      setReps(exercise.reps       ?? '8-10');
      setKg(exercise.kg           ?? '');
      setPause(exercise.pause     ?? '90');
      setRpe(exercise.rpe         ?? '');
      setProgresion(exercise.progresion ?? 'manual');
      setWeeks(initWeeks(exercise));
    } else {
      setSets('3'); setReps('8-10'); setKg(''); setPause('90');
      setRpe(''); setProgresion('manual'); setWeeks(initWeeks(null));
    }
  }, [exercise]);

  const updW = (wi, field, val) =>
    setWeeks(prev => prev.map((w, i) => i === wi ? { ...w, [field]: val } : w));

  // ── Autocompletar semanas basado en el método ──
  const autocompletar = () => {
    if (progresion === 'manual' || progresion === 'pausa') return;
    const base = { sets, reps, kg, pausa: pause };
    setWeeks(prev => prev.map((w, i) => {
      if (i === 0) return { ...w, sets: w.sets || sets, reps: w.reps || reps, kg: w.kg || kg, pausa: w.pausa || pause };
      const prev_w = prev[i - 1];
      if (progresion === 'carga') {
        const kgBase = parseFloat(prev_w.kg || kg || 0);
        return { ...w, sets: w.sets || sets, reps: w.reps || reps, kg: String(Math.round((kgBase + 2.5) * 10) / 10), pausa: w.pausa || pause };
      }
      if (progresion === 'reps') {
        const repsBase = parseInt(prev_w.reps || reps || 8);
        return { ...w, sets: w.sets || sets, reps: String(repsBase + 1), kg: w.kg || kg, pausa: w.pausa || pause };
      }
      if (progresion === 'series') {
        const setsBase = parseInt(prev_w.sets || sets || 3);
        return { ...w, sets: String(setsBase + 1), reps: w.reps || reps, kg: w.kg || kg, pausa: w.pausa || pause };
      }
      return w;
    }));
  };

  const handleSave = () => {
    const formData = {
      sets,
      reps,
      kg,
      pause,
      rpe,
      progresion,
      weeks: weeks.map(w => ({ ...w, pausa: w.pausa || pause })),
    };
    onSave(formData);
  };

  // ── Styles ──
  const bg     = '#0F1923';
  const bgCard = '#162234';
  const border = '#2D4057';
  const textMuted = '#8B9AB2';

  const inp = {
    background: bg,
    color: '#FFFFFF',
    border: `1px solid ${border}`,
    borderRadius: 8,
    padding: '8px 6px',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };

  const methodColor = METODOS.find(m => m.id === progresion)?.color || '#8B9AB2';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,.92)',
        zIndex: 125,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: bgCard,
          margin: '20px 16px',
          borderRadius: 16,
          padding: '20px 16px',
          maxWidth: 500,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8, flexShrink: 0,
            background: methodColor + '22',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: methodColor,
          }}>
            {exercise ? '✏' : '+'}
          </div>
          <div style={{ flex: 1, fontSize: 18, fontWeight: 800, color: '#fff', wordBreak: 'break-word' }}>
            {exercise?.name || 'Nuevo ejercicio'}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none',
              color: textMuted, fontSize: 22, cursor: 'pointer',
              padding: '4px 8px', lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* ── Configuración Base ── */}
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.5px', color: textMuted, marginBottom: 8 }}>
          CONFIGURACIÓN BASE
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 10, color: textMuted, marginBottom: 4, fontWeight: 600 }}>SERIES</div>
            <input style={{ ...inp, textAlign: 'center' }} value={sets} onChange={e => setSets(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: textMuted, marginBottom: 4, fontWeight: 600 }}>REPS</div>
            <input style={{ ...inp, textAlign: 'center' }} value={reps} onChange={e => setReps(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: textMuted, marginBottom: 4, fontWeight: 600 }}>KG</div>
            <input style={{ ...inp, textAlign: 'center' }} value={kg} onChange={e => setKg(e.target.value)} placeholder="—" />
          </div>
          <div>
            <div style={{ fontSize: 10, color: textMuted, marginBottom: 4, fontWeight: 600 }}>PAUSA (s)</div>
            <input style={{ ...inp, textAlign: 'center' }} value={pause} onChange={e => setPause(e.target.value)} placeholder="seg" />
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: textMuted, marginBottom: 4, fontWeight: 600 }}>RPE</div>
          <input
            type="number" min="1" max="10"
            style={{ ...inp, width: 'auto', minWidth: 80 }}
            value={rpe}
            onChange={e => setRpe(e.target.value)}
            placeholder="1-10"
          />
        </div>

        {/* ── Método de Progresión ── */}
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.5px', color: textMuted, marginBottom: 8 }}>
          MÉTODO DE PROGRESIÓN
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {METODOS.map(m => (
            <button
              key={m.id}
              onClick={() => setProgresion(m.id)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: `1px solid ${progresion === m.id ? m.color : border}`,
                background: progresion === m.id ? m.color + '22' : 'transparent',
                color: progresion === m.id ? m.color : textMuted,
                fontSize: 12, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {progresion !== 'manual' && (
          <div style={{
            background: bg, borderRadius: 8, padding: '8px 12px',
            marginBottom: 12, fontSize: 12, color: textMuted,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          }}>
            <span>{METODOS.find(m => m.id === progresion)?.desc}</span>
            <button
              onClick={autocompletar}
              style={{
                background: methodColor + '22',
                border: `1px solid ${methodColor}44`,
                borderRadius: 6,
                padding: '4px 10px',
                color: methodColor,
                fontSize: 11, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
              }}
            >
              Autocompletar semanas
            </button>
          </div>
        )}

        {/* ── Valores por Semana ── */}
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.5px', color: textMuted, marginBottom: 8 }}>
          VALORES POR SEMANA
        </div>
        {weeks.map((w, wi) => {
          // Delta hint vs semana anterior
          let hint = null;
          if (wi > 0 && progresion !== 'manual') {
            const prev = weeks[wi - 1];
            if (progresion === 'carga'  && prev.kg    && w.kg)    hint = (parseFloat(w.kg)    - parseFloat(prev.kg)    > 0 ? '+' : '') + Math.round((parseFloat(w.kg)    - parseFloat(prev.kg))    * 10) / 10 + ' kg';
            if (progresion === 'reps'   && prev.reps   && w.reps)  hint = (parseInt(w.reps)   - parseInt(prev.reps)   > 0 ? '+' : '') + (parseInt(w.reps)   - parseInt(prev.reps))   + ' reps';
            if (progresion === 'series' && prev.sets   && w.sets)  hint = (parseInt(w.sets)   - parseInt(prev.sets)   > 0 ? '+' : '') + (parseInt(w.sets)   - parseInt(prev.sets))   + ' series';
            if (progresion === 'pausa'  && prev.pausa  && w.pausa) hint = (parseInt(w.pausa)  - parseInt(prev.pausa)  > 0 ? '+' : '') + (parseInt(w.pausa)  - parseInt(prev.pausa))  + 's pausa';
          }

          return (
            <div key={wi} style={{ background: bg, borderRadius: 12, padding: '10px 12px', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: methodColor }}>SEM {wi + 1}</div>
                {hint && <span style={{ fontSize: 11, color: '#22C55E', fontWeight: 700 }}>{hint}</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 10, color: textMuted, marginBottom: 4, fontWeight: 600 }}>SERIES</div>
                  <input style={{ ...inp, textAlign: 'center' }} value={w.sets}  onChange={e => updW(wi, 'sets',  e.target.value)} placeholder={sets} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: textMuted, marginBottom: 4, fontWeight: 600 }}>REPS</div>
                  <input style={{ ...inp, textAlign: 'center' }} value={w.reps}  onChange={e => updW(wi, 'reps',  e.target.value)} placeholder={reps} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: textMuted, marginBottom: 4, fontWeight: 600 }}>KG</div>
                  <input style={{ ...inp, textAlign: 'center' }} value={w.kg}    onChange={e => updW(wi, 'kg',    e.target.value)} placeholder={kg || '—'} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: textMuted, marginBottom: 4, fontWeight: 600 }}>PAUSA</div>
                  <input style={{ ...inp, textAlign: 'center' }} value={w.pausa} onChange={e => updW(wi, 'pausa', e.target.value)} placeholder={pause + 's'} />
                </div>
              </div>
              <input
                style={{ ...inp }}
                value={w.note}
                onChange={e => updW(wi, 'note', e.target.value)}
                placeholder="Nota de semana (opcional)"
              />
            </div>
          );
        })}

        {/* ── Botones ── */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '12px',
              background: 'transparent',
              border: `1px solid ${border}`,
              borderRadius: 10, color: textMuted,
              fontSize: 13, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            CANCELAR
          </button>
          <button
            onClick={handleSave}
            style={{
              flex: 2, padding: '12px',
              background: '#2563EB', border: 'none',
              borderRadius: 10, color: '#fff',
              fontSize: 14, fontWeight: 700,
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
