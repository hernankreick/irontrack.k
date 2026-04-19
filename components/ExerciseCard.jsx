import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import { pickVideoUrl } from '../lib/exerciseResolve.js';
import { coachType as T, coachSpace as S } from './coachUiScale.js';

const BLOCK_COLORS = {
  warmup: '#f59e0b',
  main:   '#3b82f6',
  cool:   '#22c55e',
  cardio: '#a855f7',
};

function compactSummary(ex) {
  const parts = [];
  if (ex.sets || ex.reps) parts.push(`${ex.sets || '?'}×${ex.reps || '?'}`);
  if (ex.kg)    parts.push(`${ex.kg}kg`);
  if (ex.pause) parts.push(`${ex.pause}s`);
  if (ex.rpe)   parts.push(`RPE ${ex.rpe}`);
  return parts.join(' · ');
}

export function ExerciseCard({ exercise, onEdit, onDelete }) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: exercise.id });

  const color = BLOCK_COLORS[exercise.block] || BLOCK_COLORS.main;
  const summary = compactSummary(exercise);
  const videoHref = pickVideoUrl(exercise);

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
        marginBottom: S.chipGridGap - 4,
        display: 'flex',
        alignItems: 'center',
        gap: S.gridTight,
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
          ...T.bodySemibold,
          fontWeight: 700,
          wordBreak: 'break-word',
          color: '#f1f5f9',
          lineHeight: 1.3,
          marginBottom: summary ? 2 : 0,
        }}>
          {exercise.name}
        </div>
        {summary && (
          <div style={{ ...T.meta, color: '#64748b' }}>
            {summary}
          </div>
        )}
      </div>

      {/* Video button */}
      {videoHref && (
        <a
          href={videoHref}
          target="_blank"
          rel="noreferrer"
          onClick={e => e.stopPropagation()}
          style={{
            width: 44, height: 44, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#94a3b8', textDecoration: 'none',
            ...T.control,
            borderRadius: 8,
          }}
        >
          ▶
        </a>
      )}

      {/* Edit */}
      <button
        onClick={() => onEdit(exercise)}
        style={{
          width: 44, height: 44, flexShrink: 0,
          background: 'transparent', border: 'none',
          cursor: 'pointer', color: '#60a5fa',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 8,
        }}
      >
        <Pencil size={16} />
      </button>

      {/* Delete */}
      <button
        onClick={() => onDelete(exercise.id)}
        style={{
          width: 44, height: 44, flexShrink: 0,
          background: 'transparent', border: 'none',
          cursor: 'pointer', color: '#f87171',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 8,
        }}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
