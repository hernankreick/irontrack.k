import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext, MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, DragOverlay, pointerWithin, closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { Copy, Trash2, Plus, Pencil } from 'lucide-react';
import { ExerciseCard } from './ExerciseCard.jsx';
import { coachType, coachSpace, coachTypeMobile, coachSpaceMobile } from './coachUiScale.js';
import { irontrackMsg as M } from '../lib/irontrackMsg.js';

const BLOCK_ACCENT = {
  warmup:    'var(--block-warmup)',
  exercises: 'var(--block-main)',
};

// ── One drag-sortable block (warmup or exercises) ─────────────────────
function SortableBlock({
  exercises,
  label,
  addExerciseLabel,
  count,
  accent,
  onAddExercise,
  onEditExercise,
  onDeleteExercise,
  onReorderBlock,
  blockKey,
  darkMode = true,
  lang = 'es',
  addButtonClassName = '',
  textMain,
  textMuted,
  isUnder768 = false,
}) {
  const T = isUnder768 ? coachTypeMobile : coachType;
  const S = isUnder768 ? coachSpaceMobile : coachSpace;
  const [activeId, setActiveId] = useState(null);
  const blockRef = useRef(null);

  // Mouse: arrastre inmediato tras 5 px. Táctil: pulsación sostenida (250 ms, tolerancia 8 px) para que deslizar el dedo sobre el asa sea
  // SCROLL y no mueva ejercicios por accidente (antes el asa bloqueaba el scroll y un roce de 5 px ya arrastraba). Teclado: Espacio + flechas.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  // pointerWithin necesita coordenadas del puntero: con el teclado no existen, así que se usa el centro más cercano.
  const collision = (args) => (args.pointerCoordinates ? pointerWithin(args) : closestCenter(args));
  const moveBy = (exId, dir) => {
    const i = exercises.findIndex((e) => e.id === exId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= exercises.length) return;
    onReorderBlock(arrayMove(exercises, i, j));
  };
  // El overlay del arrastre es position:fixed: se monta dentro de .it-routines-root (conserva las variables de tema) y fuera de la tarjeta.
  const [overlayHost, setOverlayHost] = useState(null);
  useLayoutEffect(() => {
    if (blockRef.current) setOverlayHost(blockRef.current.closest('.it-routines-root') || document.body);
  }, []);

  const activeExercise = activeId ? exercises.find(e => e.id === activeId) : null;

  return (
    <div ref={blockRef} style={{
      background: 'var(--block-bg)',
      border: '1px solid var(--card-border)',
      borderRadius: 'var(--radius-card)',
      padding: `${S.blockGap - 2}px ${S.gridGapTight}px`,
      marginBottom: S.gridTight,
    }}>
      {/* Block header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: count > 0 ? S.gridTight : 6,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: S.gridTight }}>
          <span aria-hidden="true" style={{
            width: 8, height: 8, borderRadius: '50%',
            background: accent, display: 'inline-block', flexShrink: 0,
          }} />
          <span style={{
            ...T.tableHeader,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: accent,
          }}>
            {label}
          </span>
        </div>
        <span style={{
          ...T.subtitle,
          color: 'var(--text-muted)',
        }}>
          {count}
        </span>
      </div>

      {/* Sortable exercises */}
      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        // Auto-scroll: el valor por defecto de dnd-kit activa el scroll cuando el dedo entra en el 20 % inferior/superior de la pantalla. En un
        // iPhone eso es casi toda la mitad de abajo de la lista (y la barra fija «Guardar cambios»): la página se desplazaba bajo el dedo
        // mientras se arrastraba y el soltado caía en otro lugar (o no reordenaba). Se reduce la zona a 12 % y la velocidad.
        autoScroll={{ threshold: { x: 0, y: 0.12 }, acceleration: 6 }}
        onDragCancel={() => setActiveId(null)}
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
              onDelete={(exId) => onDeleteExercise(exId, blockKey)}
              onMove={moveBy}
              canMoveUp={exercises.indexOf(ex) > 0}
              canMoveDown={exercises.indexOf(ex) < exercises.length - 1}
              lang={lang}
              isUnder768={isUnder768}
            />
          ))}
        </SortableContext>

        {(() => {
          const overlay = (
            <DragOverlay>
              {activeExercise ? (
                <ExerciseCard
                  exercise={activeExercise}
                  onEdit={() => {}}
                  onDelete={() => {}}
                  lang={lang}
                  isUnder768={isUnder768}
                />
              ) : null}
            </DragOverlay>
          );
          return overlayHost ? createPortal(overlay, overlayHost) : null;
        })()}
      </DndContext>

      {/* Add button */}
      <button
        type="button"
        className={addButtonClassName || undefined}
        onClick={onAddExercise}
        style={{
          width: '100%',
          marginTop: count > 0 ? 4 : 0,
          padding: '8px',
          background: 'transparent',
          border: `1px dashed ${accent}`,
          borderRadius: 'var(--radius-control)',
          color: accent,
          ...T.label,
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
          fontFamily: 'inherit',
          textTransform: 'uppercase',
          letterSpacing: '.5px',
          minHeight: 44,
        }}
      >
        <Plus size={14} aria-hidden="true" />
        {addExerciseLabel}
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
  onRenameDay,
  lang = 'es',
  darkMode = true,
  textMain = '#0f172a',
  textMuted = '#64748b',
  isUnder768 = false,
  /** Clases CSS opcionales (p. ej. microinteracciones en vista Rutinas). */
  premiumAddButtonClass = '',
}) {
  const T = isUnder768 ? coachTypeMobile : coachType;
  const S = isUnder768 ? coachSpaceMobile : coachSpace;
  var dayTitleColor = 'var(--text)';
  var dayInputColor = 'var(--text)';
  const warmup    = day.warmup    || [];
  const exercises = day.exercises || [];

  const [editandoNombre, setEditandoNombre] = useState(false);
  const [nombre, setNombre] = useState(day.name);

  useEffect(
    function () {
      setNombre(day.name);
    },
    [day.name]
  );

  const guardarNombre = () => {
    setEditandoNombre(false);
    if (onRenameDay) onRenameDay(day.id, nombre);
  };

  return (
    <div style={{ marginBottom: S.gridGap }}>
      {/* Day header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: S.gridTight,
      }}>
        {editandoNombre ? (
          <input
            autoFocus
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            onBlur={guardarNombre}
            onKeyDown={e => e.key === 'Enter' && guardarNombre()}
            style={{
              flex: 1, minWidth: 0,
              ...T.bodyLg,
              fontWeight: 700,
              color: dayInputColor,
              background: 'transparent', border: 'none',
              borderBottom: '1px solid #3b82f6',
              outline: 'none', padding: '2px 0',
              fontFamily: 'inherit',
            }}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
            <span style={{ ...T.bodyLg, fontWeight: 700, color: dayTitleColor }}>
              {nombre}
            </span>
            <button
              type="button"
              aria-label={M(lang, 'Renombrar día', 'Rename day', 'Renomear dia')}
              onClick={() => setEditandoNombre(true)}
              style={{
                width: 44, height: 44, background: 'transparent', border: 'none',
                cursor: 'pointer', color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 8, flexShrink: 0,
              }}
            >
              <Pencil size={15} />
            </button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            aria-label={M(lang, 'Copiar día', 'Copy day', 'Copiar dia')}
            onClick={onCopyDay}
            style={{
              width: 44, height: 44, background: 'transparent', border: 'none',
              cursor: 'pointer', color: '#a3e635',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 8,
            }}
            title={M(lang, 'Copiar día', 'Copy day', 'Copiar dia')}
          >
            <Copy size={16} />
          </button>
          <button
            type="button"
            aria-label={M(lang, 'Eliminar día', 'Delete day', 'Eliminar dia')}
            onClick={onDeleteDay}
            style={{
              width: 44, height: 44, background: 'transparent', border: 'none',
              cursor: 'pointer', color: '#f87171',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 8,
            }}
            title={M(lang, 'Eliminar día', 'Delete day', 'Eliminar dia')}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* ENTRADA EN CALOR */}
      <SortableBlock
        blockKey="warmup"
        label={M(lang, 'Entrada en calor', 'Warm-up', 'Aquecimento')}
        addExerciseLabel={M(lang, 'Agregar ejercicios', 'Add exercises', 'Adicionar exercícios')}
        accent={BLOCK_ACCENT.warmup}
        exercises={warmup}
        count={warmup.length}
        onAddExercise={onAddWarmup}
        onEditExercise={onEditExercise}
        onDeleteExercise={onDeleteExercise}
        onReorderBlock={onReorderWarmup}
        darkMode={darkMode}
        lang={lang}
        textMain={textMain}
        textMuted={textMuted}
        isUnder768={isUnder768}
        addButtonClassName={premiumAddButtonClass}
      />

      {/* BLOQUE PRINCIPAL */}
      <SortableBlock
        blockKey="exercises"
        label={M(lang, 'Bloque principal', 'Main block', 'Bloco principal')}
        addExerciseLabel={M(lang, 'Agregar ejercicios', 'Add exercises', 'Adicionar exercícios')}
        accent={BLOCK_ACCENT.exercises}
        exercises={exercises}
        count={exercises.length}
        onAddExercise={onAddExercise}
        onEditExercise={onEditExercise}
        onDeleteExercise={onDeleteExercise}
        onReorderBlock={onReorderExercises}
        darkMode={darkMode}
        lang={lang}
        textMain={textMain}
        textMuted={textMuted}
        isUnder768={isUnder768}
        addButtonClassName={premiumAddButtonClass}
      />
    </div>
  );
}
