import React, { useState } from 'react';
import {
  DndContext, PointerSensor, useSensor, useSensors, DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { Copy, Trash2, Plus } from 'lucide-react';
import { ExerciseCard } from './ExerciseCard.jsx';

export function DaySection({
  day,
  onCopyDay,
  onDeleteDay,
  onAddExercise,
  onEditExercise,
  onDeleteExercise,
  onReorder,
}) {
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const exercises = day.exercises || [];
  const activeExercise = activeId ? exercises.find(e => e.id === activeId) : null;

  function handleDragStart({ active }) {
    setActiveId(active.id);
  }

  function handleDragEnd({ active, over }) {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const oldIndex = exercises.findIndex(e => e.id === active.id);
    const newIndex = exercises.findIndex(e => e.id === over.id);
    onReorder(day.id, arrayMove(exercises, oldIndex, newIndex));
  }

  const iconBtn = (color) => ({
    width: 44, height: 44,
    background: 'transparent', border: 'none',
    cursor: 'pointer', color,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 8,
  });

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 8,
      }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>
          {day.name}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onCopyDay} style={iconBtn('#a3e635')} title="Copiar día">
            <Copy size={16} />
          </button>
          <button onClick={onDeleteDay} style={iconBtn('#f87171')} title="Eliminar día">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Sortable list */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
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

      {/* Add exercise */}
      <button
        onClick={onAddExercise}
        style={{
          width: '100%',
          marginTop: 4,
          padding: '10px',
          background: 'transparent',
          border: '1.5px dashed rgba(148,163,184,0.3)',
          borderRadius: 10,
          color: '#64748b',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          fontFamily: 'inherit',
        }}
      >
        <Plus size={14} />
        Agregar ejercicio
      </button>
    </div>
  );
}
