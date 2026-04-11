import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import { MetricPill } from './MetricPill.jsx';

const BLOCK_COLORS = {
  warmup: '#f59e0b',
  main:   '#3b82f6',
  cool:   '#22c55e',
  cardio: '#a855f7',
};

const BLOCK_LABELS = {
  warmup: 'WARMUP',
  main:   'MAIN',
  cool:   'COOL',
  cardio: 'CARDIO',
};

export function ExerciseCard({ exercise, onEdit, onDelete }) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: exercise.id });

  const color = BLOCK_COLORS[exercise.block] || BLOCK_COLORS.main;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        background: '#1e293b',
        borderRadius: 10,
        borderLeft: `3px solid ${color}`,
        marginBottom: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px',
      }}
    >
      {/* Grip handle */}
      <div
        {...attributes}
        {...listeners}
        style={{
          color: 'rgba(148,163,184,0.4)',
          cursor: 'grab',
          touchAction: 'none',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <GripVertical size={16} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14,
          fontWeight: 700,
          wordBreak: 'break-word',
          color: '#f1f5f9',
          marginBottom: 2,
          lineHeight: 1.3,
        }}>
          {exercise.name}
        </div>
        <div style={{
          fontSize: 11,
          textTransform: 'uppercase',
          color,
          letterSpacing: '.5px',
          marginBottom: 6,
        }}>
          {BLOCK_LABELS[exercise.block] || exercise.block}
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <MetricPill label="Series" value={exercise.sets} />
          <MetricPill label="Reps"   value={exercise.reps} />
          <MetricPill label="Kg"     value={exercise.kg}   highlight />
          <MetricPill label="RPE"    value={exercise.rpe} />
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
        <button
          onClick={() => onEdit(exercise)}
          style={{
            width: 44, height: 44,
            background: 'transparent', border: 'none',
            cursor: 'pointer', color: '#60a5fa',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 8,
          }}
        >
          <Pencil size={16} />
        </button>
        <button
          onClick={() => onDelete(exercise.id)}
          style={{
            width: 44, height: 44,
            background: 'transparent', border: 'none',
            cursor: 'pointer', color: '#f87171',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 8,
          }}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
