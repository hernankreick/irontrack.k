import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, MoreVertical, Pencil, Play, Trash2 } from 'lucide-react';
import { pickVideoUrl } from '../lib/exerciseResolve.js';
import { irontrackMsg as M } from '../lib/irontrackMsg.js';
import { DeleteConfirmModal } from './DeleteConfirmModal.jsx';
import { coachType, coachTypeMobile } from './coachUiScale.js';

function compactSummary(ex) {
  const parts = [];
  if (ex.sets || ex.reps) parts.push(`${ex.sets || '?'}×${ex.reps || '?'}`);
  if (ex.kg) parts.push(`${ex.kg} kg`);
  // El descanso solo se muestra si es > 0 (o si es un texto no numérico cargado a mano).
  if (ex.pause) {
    const n = parseFloat(ex.pause);
    if (Number.isNaN(n) ? String(ex.pause).trim() !== '' : n > 0) {
      parts.push(Number.isNaN(n) ? String(ex.pause) : `${n} s`);
    }
  }
  if (ex.rpe) parts.push(`RPE ${ex.rpe}`);
  return parts.join(' · ');
}

const iconBtn = {
  width: 44,
  height: 44,
  flexShrink: 0,
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-muted)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 'var(--radius-control)',
  padding: 0,
};

export function ExerciseCard({
  exercise, onEdit, onDelete,
  lang = 'es',
  isUnder768 = false,
}) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: exercise.id });

  const T = isUnder768 ? coachTypeMobile : coachType;
  const summary = compactSummary(exercise);
  const videoHref = pickVideoUrl(exercise);

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuCoords, setMenuCoords] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const menuBtnRef = useRef(null);
  const menuPopRef = useRef(null);

  const updateCoords = useCallback(function () {
    const el = menuBtnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const w = 180;
    const approxH = 100;
    const pad = 8;
    let left = rect.right - w;
    if (left < pad) left = pad;
    let top = rect.bottom + 4;
    if (top + approxH > window.innerHeight - pad) top = Math.max(pad, rect.top - approxH - 4);
    setMenuCoords({ top, left, width: w });
  }, []);

  useLayoutEffect(function () {
    if (!menuOpen) {
      setMenuCoords(null);
      return undefined;
    }
    updateCoords();
    window.addEventListener('resize', updateCoords);
    window.addEventListener('scroll', updateCoords, true);
    return function () {
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords, true);
    };
  }, [menuOpen, updateCoords]);

  useEffect(function () {
    if (!menuOpen) return undefined;
    function onDoc(e) {
      if (menuBtnRef.current && menuBtnRef.current.contains(e.target)) return;
      if (menuPopRef.current && menuPopRef.current.contains(e.target)) return;
      setMenuOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return function () {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const menuItem = {
    width: '100%',
    minHeight: 44,
    textAlign: 'left',
    padding: '10px 12px',
    border: 'none',
    borderRadius: 8,
    background: 'transparent',
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        background: 'var(--surface-2)',
        border: '1px solid var(--card-border)',
        borderRadius: 14,
        minHeight: 64,
        marginBottom: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '8px 4px 8px 0',
        boxSizing: 'border-box',
      }}
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={M(lang, 'Reordenar ejercicio', 'Reorder exercise', 'Reordenar exercício')}
        style={{ ...iconBtn, cursor: 'grab', touchAction: 'none' }}
      >
        <GripVertical size={18} aria-hidden="true" />
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          ...T.bodySemibold,
          fontSize: 15,
          fontWeight: 700,
          overflowWrap: 'break-word',
          color: 'var(--text)',
          lineHeight: 1.3,
          marginBottom: summary ? 2 : 0,
        }}>
          {exercise.name}
        </div>
        {summary && (
          <div style={{ ...T.meta, color: 'var(--text-muted)' }}>
            {summary}
          </div>
        )}
      </div>

      {/* Video */}
      {videoHref && (
        <a
          href={videoHref}
          target="_blank"
          rel="noreferrer"
          onClick={e => e.stopPropagation()}
          aria-label={M(lang, 'Ver video del ejercicio', 'Watch exercise video', 'Ver vídeo do exercício')}
          style={{ ...iconBtn, textDecoration: 'none' }}
        >
          <Play size={18} aria-hidden="true" />
        </a>
      )}

      {/* Menú ⋮ */}
      <button
        ref={menuBtnRef}
        type="button"
        onClick={() => setMenuOpen(o => !o)}
        aria-expanded={menuOpen}
        aria-haspopup="true"
        aria-label={M(lang, 'Más acciones del ejercicio', 'More exercise actions', 'Mais ações do exercício')}
        style={iconBtn}
      >
        <MoreVertical size={20} aria-hidden="true" />
      </button>

      {menuOpen && menuCoords && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuPopRef}
            style={{
              position: 'fixed',
              top: menuCoords.top,
              left: menuCoords.left,
              width: menuCoords.width,
              background: 'var(--surface-2)',
              border: '1px solid var(--card-border)',
              borderRadius: 'var(--radius-control)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
              padding: 4,
              zIndex: 100,
            }}
          >
            <button
              type="button"
              className="it-routine-menu-item"
              style={menuItem}
              onClick={() => { setMenuOpen(false); onEdit(exercise); }}
            >
              <Pencil size={14} aria-hidden="true" />
              {M(lang, 'Editar', 'Edit', 'Editar')}
            </button>
            <button
              type="button"
              className="it-routine-menu-item it-routine-menu-item--danger"
              style={{ ...menuItem, color: 'var(--danger)', fontWeight: 700 }}
              onClick={() => { setMenuOpen(false); setConfirmOpen(true); }}
            >
              <Trash2 size={14} aria-hidden="true" />
              {M(lang, 'Eliminar', 'Delete', 'Excluir')}
            </button>
          </div>,
          document.body
        )}

      <DeleteConfirmModal
        open={confirmOpen}
        zIndex={10000}
        tone="danger"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => { setConfirmOpen(false); onDelete(exercise.id); }}
        title={M(lang, 'Eliminar ejercicio', 'Delete exercise', 'Excluir exercício')}
        message={M(
          lang,
          'El ejercicio se quitará de este bloque.',
          'The exercise will be removed from this block.',
          'O exercício será removido deste bloco.'
        )}
        subjectName={exercise.name}
        confirmLabel={M(lang, 'Eliminar', 'Delete', 'Excluir')}
        cancelLabel={M(lang, 'Cancelar', 'Cancel', 'Cancelar')}
      />
    </div>
  );
}
