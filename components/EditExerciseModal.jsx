import React, { useState, useEffect, useRef } from 'react';
import useDialogA11y from './modals/useDialogA11y.js';
import ProgressionWeeksEditor from './routines/ProgressionWeeksEditor.jsx';
import { initWeeksFull, detectWeekCount, ensureWeeks, weeksForSave, autocompleteWeeks } from './routines/progressionEditorLogic.js';

const METODOS = [
  { id: 'carga',  label: '+ Carga',   desc: 'Subir kg c/semana — completá los valores de cada semana abajo' },
  { id: 'reps',   label: '+ Reps',    desc: 'Más reps, mismo peso — completá los valores de cada semana abajo' },
  { id: 'series', label: '+ Series',  desc: 'Más series c/semana — completá los valores de cada semana abajo' },
  { id: 'pausa',  label: '− Pausa',   desc: 'Reducir descanso — completá los valores de cada semana abajo' },
  { id: 'manual', label: 'Manual',    desc: 'Definís vos los valores de cada semana' },
];

// ─── Styles ──────────────────────────────────────────────────────────────────
const ACTIVE_COLOR = '#22c55e';

// ─────────────────────────────────────────────────────────────────────────────

export function EditExerciseModal({ exercise, onSave, onClose, darkMode = true }) {
  const BG       = darkMode ? '#0f172a' : '#F0F4F8';
  const BG_CARD  = darkMode ? '#1e293b' : '#FFFFFF';
  const BG_WEEK  = darkMode ? '#0f172a' : '#EEF2F7';
  const BORDER_INACTIVE = darkMode ? 'rgba(255,255,255,0.15)' : '#E2E8F0';
  const TEXT_MUTED = darkMode ? '#94a3b8' : '#64748B';
  const TEXT_LABEL = darkMode ? '#64748b' : '#64748B';
  const TEXT_MAIN  = darkMode ? '#f1f5f9' : '#0F1923';

  const baseInput = {
    background: BG,
    color: TEXT_MAIN,
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

  const [sets,       setSets]       = useState('3');
  const [reps,       setReps]       = useState('8-10');
  const [kg,         setKg]         = useState('');
  const [pause,      setPause]      = useState('90');
  const [progresion, setProgresion] = useState('manual');
  // `weeks` guarda TODAS las semanas del ejercicio (aunque superen el selector); `weekCount` es lo que se muestra y se guarda.
  const [weeks,      setWeeks]      = useState(() => initWeeksFull(exercise?.weeks));
  const [weekCount,  setWeekCount]  = useState(() => detectWeekCount(exercise?.weeks));
  const [initialWeekCount, setInitialWeekCount] = useState(() => detectWeekCount(exercise?.weeks));

  useEffect(() => {
    if (exercise) {
      setSets(String(exercise.sets  ?? '3'));
      setReps(String(exercise.reps  ?? '8-10'));
      setKg(String(exercise.kg      ?? ''));
      setPause(String(exercise.pause ?? '90'));
      setProgresion(exercise.progresion ?? 'manual');
      setWeeks(initWeeksFull(exercise.weeks));
      setWeekCount(detectWeekCount(exercise.weeks));
      setInitialWeekCount(detectWeekCount(exercise.weeks));
    } else {
      setSets('3'); setReps('8-10'); setKg('');
      setPause('90'); setProgresion('manual');
      setWeeks(initWeeksFull(null));
      setWeekCount(detectWeekCount(null));
      setInitialWeekCount(detectWeekCount(null));
    }
  }, [exercise]);

  // Dialogo modal: foco, Tab atrapado y retorno de foco. El fondo y Escape NO cierran (se perdian los valores tipeados); se cierra con "x".
  const dialogRef = useRef(null);
  useDialogA11y({ open: true, containerRef: dialogRef });

  const autocompletar = () => {
    if (progresion === 'manual') return;
    setWeeks(prev => autocompleteWeeks(prev, { sets, reps, kg, pause }, progresion, weekCount));
  };

  const handleSave = () => {
    onSave({
      sets,
      reps,
      kg,
      pause,
      progresion,
      weeks: weeksForSave(weeks, weekCount, pause),
    });
  };

  return (
    <div
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
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={'Editar ejercicio: ' + (exercise?.name || '')}
        onClick={e => e.stopPropagation()}
        style={{
          background: BG_CARD,
          margin: '24px 16px 0',
          borderRadius: 18,
          padding: '20px 16px 24px',
          width: '100%',
          maxWidth: 1080,
          alignSelf: 'flex-start',
        }}
      >
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ flex: 1, fontSize: 17, fontWeight: 800, color: TEXT_MAIN, wordBreak: 'break-word', lineHeight: 1.3 }}>
            {exercise?.name || 'Nuevo ejercicio'}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 20 }}>
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
        <ProgressionWeeksEditor
          weeks={weeks} count={weekCount} initialCount={initialWeekCount}
          onWeeksChange={setWeeks}
          onCountChange={(n) => { setWeeks(prev => ensureWeeks(prev, n)); setWeekCount(n); }}
          base={{ sets, reps, kg, pause }} method={progresion}
          theme={{ bg: BG, input: BG, card: BG_CARD, border: BORDER_INACTIVE, text: TEXT_MAIN, muted: TEXT_MUTED, accent: '#2563EB' }}
        />

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
