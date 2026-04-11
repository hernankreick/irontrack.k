import React, { useState } from 'react';
import {
  DndContext, PointerSensor, useSensor, useSensors, DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { Copy, Trash2, Plus } from 'lucide-react';
import { ExerciseCard } from './ExerciseCard.jsx';

const BLOCK_ACCENT = {
  warmup:    '#f59e0b',
  exercises: '#3b82f6',
};

// ── One drag-sortable block (warmup or exercises) ─────────────────────
function SortableBlock({
  exercises,
  label,
  count,
  accent,
  onAddExercise,
  onEditExercise,
  onDeleteExercise,
  onReorderBlock,
  blockKey,
}) {
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const activeExercise = activeId ? exercises.find(e => e.id === activeId) : null;

  return (
    <div style={{
      background: '#0f172a',
      border: `1px solid ${accent}22`,
      borderRadius: 12,
      padding: '10px 12px',
      marginBottom: 10,
    }}>
      {/* Block header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: count > 0 ? 10 : 6,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 3, height: 14, borderRadius: 2,
            background: accent, display: 'inline-block', flexShrink: 0,
          }} />
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: accent,
          }}>
            {label}
          </span>
        </div>
        <span style={{
          fontSize: 13,
          fontWeight: 600,
          color: '#475569',
        }}>
          {count}
        </span>
      </div>

      {/* Sortable exercises */}
      <DndContext
        sensors={sensors}
        onDragStart={({ active }) => setActiveId(active.id)}
        onDragEnd={({ active, over }) => {
          setActiveId(null);
          if (!over || active.id === over.id) return;
          const oldIdx = exercises.findIndex(e => e.id === active.id);
          const newIdx = exercises.findIndex(e => e.id === over.id);
          onReorderBlock(arrayMove(exercises, oldIdx, newIdx));
        }}
      >
        <SortableContext
          items={exercises.map(e => e.id)}
          strategy={verticalListSortingStrategy}
        >
          {exercises.map(ex => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              onEdit={onEditExercise}
              onDelete={onDeleteExercise}
            />
          ))}
        </SortableContext>

        <DragOverlay>
          {activeExercise ? (
            <ExerciseCard
              exercise={activeExercise}
              onEdit={() => {}}
              onDelete={() => {}}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Add button */}
      <button
        onClick={onAddExercise}
        style={{
          width: '100%',
          marginTop: count > 0 ? 4 : 0,
          padding: '8px',
          background: 'transparent',
          border: `1px dashed ${accent}55`,
          borderRadius: 8,
          color: accent,
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
          fontFamily: 'inherit',
          letterSpacing: '.3px',
          minHeight: 44,
        }}
      >
        <Plus size={13} />
        AÑADIR
      </button>
    </div>
  );
}

// ── DaySection ────────────────────────────────────────────────────────
export function DaySection({
  day,           // { id, name, warmup: [], exercises: [] }
  onCopyDay,
  onDeleteDay,
  onAddWarmup,
  onAddExercise,
  onEditExercise,
  onDeleteExercise,
  onReorderWarmup,
  onReorderExercises,
}) {
  const warmup    = day.warmup    || [];
  const exercises = day.exercises || [];

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Day header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <span style={{
          fontSize: 15, fontWeight: 700, color: '#f1f5f9',
        }}>
          {day.name}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={onCopyDay}
            style={{
              width: 44, height: 44, background: 'transparent', border: 'none',
              cursor: 'pointer', color: '#a3e635',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 8,
            }}
            title="Copiar dia"
          >
            <Copy size={16} />
          </button>
          <button
            onClick={onDeleteDay}
            style={{
              width: 44, height: 44, background: 'transparent', border: 'none',
              cursor: 'pointer', color: '#f87171',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 8,
            }}
            title="Eliminar dia"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* ENTRADA EN CALOR */}
      <SortableBlock
        blockKey="warmup"
        label="Entrada en calor"
        accent={BLOCK_ACCENT.warmup}
        exercises={warmup}
        count={warmup.length}
        onAddExercise={onAddWarmup}
        onEditExercise={onEditExercise}
        onDeleteExercise={onDeleteExercise}
        onReorderBlock={onReorderWarmup}
      />

      {/* BLOQUE PRINCIPAL */}
      <SortableBlock
        blockKey="exercises"
        label="Bloque principal"
        accent={BLOCK_ACCENT.exercises}
        exercises={exercises}
        count={exercises.length}
        onAddExercise={onAddExercise}
        onEditExercise={onEditExercise}
        onDeleteExercise={onDeleteExercise}
        onReorderBlock={onReorderExercises}
      />
    </div>
  );
}
