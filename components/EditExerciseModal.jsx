import React, { useState, useEffect } from 'react';
import { Check } from 'lucide-react';

export function EditExerciseModal({ exercise, onSave, onClose }) {
  const [form, setForm] = useState({
    name: '',
    sets: '',
    reps: '',
    kg: '',
    rpe: '',
    block: 'main',
  });

  useEffect(() => {
    if (exercise) {
      setForm({
        name:  exercise.name  ?? '',
        sets:  exercise.sets  ?? '',
        reps:  exercise.reps  ?? '',
        kg:    exercise.kg    ?? '',
        rpe:   exercise.rpe   ?? '',
        block: exercise.block ?? 'main',
      });
    } else {
      setForm({ name: '', sets: '', reps: '', kg: '', rpe: '', block: 'main' });
    }
  }, [exercise]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const inputStyle = {
    width: '100%',
    background: '#0f172a',
    color: '#f1f5f9',
    border: '1px solid rgba(148,163,184,0.2)',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle = {
    fontSize: 11,
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '.5px',
    marginBottom: 4,
    display: 'block',
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.75)',
        zIndex: 100,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#1e293b',
          borderRadius: '18px 18px 0 0',
          maxWidth: 500,
          width: '100%',
          padding: '24px 20px 36px',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', marginBottom: 20 }}>
          {exercise ? 'Editar ejercicio' : 'Nuevo ejercicio'}
        </div>

        {/* Nombre */}
        <div style={{ marginBottom: 14 }}>
          <span style={labelStyle}>Nombre</span>
          <input
            type="text"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="Nombre del ejercicio"
            style={inputStyle}
          />
        </div>

        {/* Series / Reps / Kg / RPE */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <span style={labelStyle}>Series</span>
            <input
              type="number"
              value={form.sets}
              onChange={e => set('sets', e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <span style={labelStyle}>Reps</span>
            <input
              type="text"
              value={form.reps}
              onChange={e => set('reps', e.target.value)}
              placeholder="8-10"
              style={inputStyle}
            />
          </div>
          <div>
            <span style={labelStyle}>Kg</span>
            <input
              type="number"
              value={form.kg}
              onChange={e => set('kg', e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <span style={labelStyle}>RPE (1-10)</span>
            <input
              type="number"
              min="1" max="10"
              value={form.rpe}
              onChange={e => set('rpe', e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Bloque */}
        <div style={{ marginBottom: 24 }}>
          <span style={labelStyle}>Bloque</span>
          <select
            value={form.block}
            onChange={e => set('block', e.target.value)}
            style={inputStyle}
          >
            <option value="warmup">Warmup</option>
            <option value="main">Main</option>
            <option value="cool">Cool</option>
            <option value="cardio">Cardio</option>
          </select>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px',
              background: 'transparent',
              border: '1px solid rgba(148,163,184,0.2)',
              borderRadius: 12,
              color: '#94a3b8',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(form)}
            style={{
              flex: 2,
              padding: '12px',
              background: '#3b82f6',
              border: 'none',
              borderRadius: 12,
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Check size={16} />
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
