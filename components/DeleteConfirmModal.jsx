import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, HelpCircle, LogOut, Trash2 } from 'lucide-react';

/**
 * Diálogo modal propio (sin window.confirm) para acciones destructivas o confirmación.
 * tone=danger: estética rosa/coral; tone=caution: ámbar; tone=neutral: acciones no destructivas.
 */
export function DeleteConfirmModal({
  open,
  onCancel,
  onConfirm,
  title,
  message,
  subjectName,
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  /** @type {'danger' | 'caution' | 'neutral'} */
  tone = 'danger',
  /** Icono superior (neutral) cuando no aplica help: p. ej. salir. */
  useLogoutIcon = false,
  loading = false,
  /** Texto mientras loading (ej. "Eliminando…") */
  loadingLabel = 'Eliminando…',
  requireAcknowledge = false,
  acknowledgeLabel = 'Entiendo que esta acción no se puede deshacer',
  variant = 'default',
  zIndex = 10000,
}) {
  const cancelRef = useRef(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const titleId = useId();
  const descId = useId();

  const updateNarrow = useCallback(function () {
    if (typeof window === 'undefined') return;
    setNarrow(window.matchMedia('(max-width: 480px)').matches);
  }, []);

  useEffect(
    function () {
      if (typeof window === 'undefined' || !window.matchMedia) return undefined;
      var m = window.matchMedia('(max-width: 480px)');
      updateNarrow();
      function h() {
        updateNarrow();
      }
      m.addEventListener('change', h);
      return function () {
        m.removeEventListener('change', h);
      };
    },
    [updateNarrow]
  );

  useEffect(
    function () {
      if (open) setAcknowledged(false);
    },
    [open, title, message]
  );

  useEffect(
    function () {
      if (!open) return undefined;
      function onKey(e) {
        if (e.key === 'Escape' && !loading) {
          e.preventDefault();
          onCancel();
        }
      }
      document.addEventListener('keydown', onKey);
      return function () {
        document.removeEventListener('keydown', onKey);
      };
    },
    [open, loading, onCancel]
  );

  useEffect(
    function () {
      if (!open) return undefined;
      var t = setTimeout(function () {
        if (cancelRef.current && !loading) {
          try {
            cancelRef.current.focus();
          } catch (e) {}
        }
      }, 0);
      return function () {
        clearTimeout(t);
      };
    },
    [open, loading]
  );

  if (!open || typeof document === 'undefined') return null;

  var isDanger = tone === 'danger';
  var isCaution = tone === 'caution';
  var isNeutral = tone === 'neutral';
  var isWorkoutExit = variant === 'workoutExit';

  var iconWrap = { bg: 'rgba(239,68,68,.18)', color: '#fb7185' };
  var Icon = Trash2;
  var iconPx = 30;
  if (isCaution) {
    iconWrap = { bg: 'rgba(245, 158, 11, 0.18)', color: '#fbbf24' };
    Icon = AlertTriangle;
    iconPx = 28;
  } else if (isNeutral) {
    iconWrap = { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' };
    Icon = HelpCircle;
    iconPx = 28;
  }

  var confirmStyle = isDanger
    ? {
        background: 'linear-gradient(135deg, #fb7185, #ef4444)',
        color: '#fff',
        boxShadow: '0 12px 32px rgba(239,68,68,.35)',
        border: 'none',
      }
    : isCaution
      ? {
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          color: '#fff',
          boxShadow: '0 12px 32px rgba(245, 158, 11, 0.35)',
          border: 'none',
        }
      : {
          background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
          color: '#fff',
          boxShadow: '0 12px 32px rgba(37, 99, 235, 0.32)',
          border: 'none',
        };

  if (isNeutral && useLogoutIcon) {
    Icon = LogOut;
  }

  if (isWorkoutExit) {
    iconWrap = { bg: 'rgba(249, 115, 22, 0.10)', color: '#fb923c', border: '1px solid rgba(249, 115, 22, 0.20)' };
    Icon = AlertTriangle;
    iconPx = 24;
    confirmStyle = {
      background: '#f97316',
      color: '#fff',
      boxShadow: '0 10px 28px rgba(249, 115, 22, 0.28)',
      border: 'none',
    };
  }

  var titleFont = isWorkoutExit ? 18 : narrow ? 21 : 24;
  var py = isWorkoutExit ? 18 : narrow ? 24 : 32;
  var maxW = isWorkoutExit ? 320 : 520;
  var confirmDisabled = loading || (requireAcknowledge && !acknowledged);

  return createPortal(
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: zIndex,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: narrow ? 16 : 24,
        background: isWorkoutExit ? 'rgba(2, 6, 23, 0.62)' : 'rgba(2, 6, 23, 0.72)',
        backdropFilter: isWorkoutExit ? 'blur(4px)' : 'blur(8px)',
        WebkitBackdropFilter: isWorkoutExit ? 'blur(4px)' : 'blur(8px)',
      }}
      onMouseDown={function (e) {
        if (loading) return;
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? descId : undefined}
        onMouseDown={function (e) {
          e.stopPropagation();
        }}
        style={{
          width: 'min(' + maxW + 'px, calc(100vw - ' + (isWorkoutExit ? '48px' : '32px') + '))',
          maxWidth: 'min(' + maxW + 'px, calc(100vw - ' + (isWorkoutExit ? '48px' : '32px') + '))',
          background: 'rgba(15, 23, 42, 0.92)',
          border: '1px solid rgba(148, 163, 184, 0.28)',
          borderRadius: isWorkoutExit ? 22 : 24,
          boxShadow: isWorkoutExit ? '0 18px 60px rgba(0,0,0,.38)' : '0 24px 80px rgba(0,0,0,.45)',
          padding: py,
          fontFamily: 'Inter, system-ui, sans-serif',
          animation: isWorkoutExit ? 'it-workout-exit-card-in 200ms ease-out both' : undefined,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: isWorkoutExit ? 8 : 0 }}>
          <div
            style={{
              width: isWorkoutExit ? 44 : 64,
              height: isWorkoutExit ? 44 : 64,
              borderRadius: '50%',
              background: iconWrap.bg,
              border: iconWrap.border || 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: isWorkoutExit ? 0 : 20,
            }}
            aria-hidden
          >
            <Icon size={iconPx} color={iconWrap.color} strokeWidth={2} />
          </div>
          <h2
            id={titleId}
            style={{
              margin: 0,
              fontSize: titleFont,
              fontWeight: isWorkoutExit ? 600 : 800,
              color: '#fff',
              lineHeight: 1.2,
            }}
          >
            {title}
          </h2>
          {message != null && message !== '' && (
            <p
              id={descId}
              style={{
                margin: isWorkoutExit ? 0 : '14px 0 0',
                fontSize: isWorkoutExit ? 14 : 15,
                fontWeight: 500,
                color: isWorkoutExit ? 'rgb(148, 163, 184)' : 'rgba(226, 232, 240, 0.82)',
                lineHeight: isWorkoutExit ? 1.55 : 1.5,
                maxWidth: isWorkoutExit ? 280 : 440,
                whiteSpace: 'pre-line',
              }}
            >
              {message}
            </p>
          )}
          {subjectName != null && String(subjectName).trim() ? (
            <div
              style={{
                marginTop: 16,
                display: 'inline-block',
                maxWidth: '100%',
                background: 'rgba(148, 163, 184, 0.12)',
                border: '1px solid rgba(148, 163, 184, 0.18)',
                borderRadius: 14,
                padding: '10px 14px',
                fontSize: 15,
                fontWeight: 700,
                color: 'rgba(241, 245, 249, 0.95)',
                wordBreak: 'break-word',
              }}
            >
              {subjectName}
            </div>
          ) : null}
          {requireAcknowledge ? (
            <label
              style={{
                marginTop: 18,
                width: '100%',
                maxWidth: 440,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                textAlign: 'left',
                color: 'rgba(241, 245, 249, 0.92)',
                fontSize: 14,
                fontWeight: 700,
                lineHeight: 1.4,
                cursor: loading ? 'default' : 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={acknowledged}
                disabled={loading}
                onChange={function (e) {
                  setAcknowledged(e.target.checked);
                }}
                style={{
                  width: 18,
                  height: 18,
                  marginTop: 1,
                  accentColor: '#ef4444',
                  flexShrink: 0,
                  cursor: loading ? 'default' : 'pointer',
                }}
              />
              <span>{acknowledgeLabel}</span>
            </label>
          ) : null}
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: isWorkoutExit ? 'column-reverse' : narrow ? 'column-reverse' : 'row',
            flexWrap: 'wrap',
            gap: isWorkoutExit ? 8 : 12,
            marginTop: isWorkoutExit ? 18 : 28,
          }}
        >
          <button
            type="button"
            ref={cancelRef}
            disabled={loading}
            onClick={onCancel}
            className={isWorkoutExit ? 'it-workout-exit-cancel' : undefined}
            style={{
              flex: isWorkoutExit ? '0 0 auto' : '1 1 160px',
              width: isWorkoutExit ? '100%' : undefined,
              minHeight: isWorkoutExit ? 44 : 52,
              borderRadius: isWorkoutExit ? 14 : 16,
              border: isWorkoutExit ? '1px solid rgb(71, 85, 105)' : '1px solid rgba(148, 163, 184, 0.32)',
              background: isWorkoutExit ? 'transparent' : 'rgba(148, 163, 184, 0.08)',
              color: isWorkoutExit ? 'rgb(203, 213, 225)' : '#fff',
              fontSize: 15,
              fontWeight: isWorkoutExit ? 500 : 800,
              cursor: loading ? 'default' : 'pointer',
              fontFamily: 'inherit',
              opacity: loading ? 0.5 : 1,
              transition: isWorkoutExit ? 'background-color 160ms ease, transform 160ms ease' : undefined,
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={confirmDisabled}
            onClick={onConfirm}
            className={isWorkoutExit ? 'it-workout-exit-confirm' : undefined}
            style={{
              flex: isWorkoutExit ? '0 0 auto' : '1 1 160px',
              width: isWorkoutExit ? '100%' : undefined,
              minHeight: isWorkoutExit ? 48 : 52,
              borderRadius: isWorkoutExit ? 14 : 16,
              fontSize: isWorkoutExit ? 18 : 15,
              fontWeight: isWorkoutExit ? 500 : 800,
              cursor: loading ? 'wait' : confirmDisabled ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              ...confirmStyle,
              opacity: confirmDisabled ? 0.55 : 1,
              transition: isWorkoutExit ? 'background-color 160ms ease, transform 160ms ease, box-shadow 160ms ease' : undefined,
            }}
          >
            {loading ? loadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
