import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  blockAxisLabel,
  blockRelativeReference,
  buildTrainingVolumeModel,
  fetchTrainingVolumeRows,
  formatDayRange,
  formatDayRow,
  formatDayShort,
  formatVolume,
  stepPeriod,
} from '../../lib/trainingVolume.js';

const BAR_AREA_H = 36;
const TAP = 44; // target tactil minimo (iOS HIG)

function langOf(msg) {
  return msg('es', 'en') === 'en' ? 'en' : 'es';
}

function buildBarsAriaLabel(blocks, msg) {
  const parts = blocks.map(function (b) {
    return formatDayShort(b.startDay) + ' ' + msg('al', 'to') + ' ' + formatDayShort(b.endDay) + ': ' + formatVolume(b.kg);
  });
  return msg('Volumen por bloque de 7 días, del más antiguo al más reciente. ', 'Volume per 7-day block, oldest to most recent. ') + parts.join('; ') + '.';
}

function Chevron({ dir, color }) {
  const d = dir === 'left' ? 'M14 5l-7 7 7 7' : 'M10 5l7 7-7 7';
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d={d} stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Presentacional puro (sin efectos): recibe el modelo de computeTrainingVolume. */
export function TrainingVolumeCardView({ model, _dm, textMuted, msg, onOpenDetail }) {
  if (!model || !model.showCard) return null;
  const lang = langOf(msg);
  const strong = _dm ? '#E2E8F0' : '#0F172A';
  const neutral = textMuted || (_dm ? '#94A3B8' : '#64748B');
  const barMuted = _dm ? '#475569' : '#CBD5E1';
  const barRecent = '#2563EB';
  const max = Math.max.apply(null, model.blocks.map(function (b) { return b.kg; }));
  return (
    <div
      data-testid="training-volume-card"
      style={{
        marginTop: 10, padding: '10px 12px 2px', borderRadius: 10,
        background: _dm ? '#162234' : '#EEF2F7',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: strong }}>
          {msg('Volumen de entrenamiento', 'Training volume')}
        </span>
        <details style={{ position: 'relative' }}>
          <summary
            aria-label={msg('Qué significa esta tarjeta', 'What this card means')}
            style={{
              listStyle: 'none', cursor: 'pointer', width: 18, height: 18, borderRadius: 9,
              border: '1px solid ' + neutral, color: neutral, fontSize: 11, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
            }}
          >
            ?
          </summary>
          <div
            style={{
              marginTop: 6, fontSize: 11, lineHeight: 1.35, color: neutral,
              display: 'flex', flexDirection: 'column', gap: 4,
            }}
          >
            <span>{msg('El porcentaje compara únicamente ejercicios que registraste en ambos períodos.', 'The percentage only compares exercises you logged in both periods.')}</span>
            <span>{msg('Más volumen no siempre significa mejor rendimiento.', 'More volume does not always mean better performance.')}</span>
            <span>{msg('No incluye ejercicios con peso corporal ni de tiempo.', 'It does not include bodyweight or timed exercises.')}</span>
          </div>
        </details>
      </div>
      <div style={{ fontSize: 10, color: neutral, fontWeight: 600, marginTop: 1 }}>
        {msg('Últimas 4 semanas · kg × reps', 'Last 4 weeks · kg × reps')}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginTop: 6 }}>
        <span data-testid="training-volume-total" style={{ fontSize: 22, fontWeight: 800, color: strong, fontVariantNumeric: 'tabular-nums' }}>
          {formatVolume(model.currentTotal)}
        </span>
        {model.showPct && (
          <span data-testid="training-volume-pct" style={{ fontSize: 11, fontWeight: 700, color: neutral, whiteSpace: 'nowrap' }}>
            {model.pctLabel} {msg('vs 4 sem. anteriores', 'vs previous 4 wks')}
          </span>
        )}
      </div>
      <div
        role="img"
        aria-label={buildBarsAriaLabel(model.blocks, msg)}
        data-testid="training-volume-bars"
        style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 8 }}
      >
        {model.blocks.map(function (b) {
          const recent = b.key === 'B4';
          const h = b.kg > 0 && max > 0 ? Math.max(3, Math.round((b.kg / max) * BAR_AREA_H)) : 2;
          return (
            <div key={b.key} data-block={b.key} data-kg={Math.round(b.kg)} style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
              <div style={{ height: BAR_AREA_H, display: 'flex', alignItems: 'flex-end' }}>
                <div
                  style={{
                    width: '100%', height: h, borderRadius: 3,
                    background: recent ? barRecent : barMuted,
                    opacity: b.kg > 0 ? 1 : 0.6,
                  }}
                />
              </div>
              <div style={{ fontSize: 9, marginTop: 3, color: recent ? strong : neutral, fontWeight: recent ? 700 : 500, whiteSpace: 'nowrap' }}>
                {blockAxisLabel(b, lang)}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          data-testid="training-volume-open-detail"
          onClick={onOpenDetail}
          style={{
            minHeight: TAP, padding: '0 4px', background: 'transparent', border: 'none', cursor: 'pointer',
            color: neutral, fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
            WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
          }}
        >
          {msg('Ver detalle', 'View details')} ›
        </button>
      </div>
    </div>
  );
}

/** Detalle de un periodo (presentacional puro). `selected` = indice 0..3 (B1..B4). */
export function TrainingVolumeDetailView({ model, selected, onSelect, onBack, _dm, textMuted, msg }) {
  if (!model || !model.showCard) return null;
  const lang = langOf(msg);
  const idx = stepPeriod(selected, 0, model.blocks.length);
  const period = model.blocks[idx];
  const strong = _dm ? '#E2E8F0' : '#0F172A';
  const neutral = textMuted || (_dm ? '#94A3B8' : '#64748B');
  const line = _dm ? 'rgba(148,163,184,.18)' : 'rgba(15,23,42,.10)';
  const isFirst = idx === 0;
  const isLast = idx === model.blocks.length - 1;
  const iconBtn = function (disabled) {
    return {
      width: TAP, height: TAP, minWidth: TAP, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'transparent', border: 'none', borderRadius: 22, cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.3 : 1, padding: 0, WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
    };
  };
  return (
    <div data-testid="training-volume-detail" style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px 32px', color: strong }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: 56 }}>
        <button
          type="button"
          data-testid="training-volume-back"
          aria-label={msg('Volver', 'Back')}
          onClick={onBack}
          style={Object.assign(iconBtn(false), { marginLeft: -12 })}
        >
          <Chevron dir="left" color={strong} />
        </button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.2 }}>{msg('Detalle de volumen', 'Volume detail')}</div>
          <div style={{ fontSize: 12, color: neutral, fontWeight: 600, lineHeight: 1.3 }}>
            {msg('Historial de las últimas 4 semanas', 'History of the last 4 weeks')}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12 }}>
        <button
          type="button"
          data-testid="training-volume-prev"
          aria-label={msg('Período anterior', 'Previous period')}
          disabled={isFirst}
          onClick={function () { if (onSelect) onSelect(stepPeriod(idx, -1, model.blocks.length)); }}
          style={iconBtn(isFirst)}
        >
          <Chevron dir="left" color={strong} />
        </button>
        <div aria-live="polite" style={{ textAlign: 'center', minWidth: 0 }}>
          <div data-testid="training-volume-range" style={{ fontSize: 16, fontWeight: 800 }}>
            {formatDayRange(period.startDay, period.endDay, lang)}
          </div>
          <div data-testid="training-volume-reference" style={{ fontSize: 12, color: neutral, fontWeight: 600 }}>
            {blockRelativeReference(period, lang)}
          </div>
        </div>
        <button
          type="button"
          data-testid="training-volume-next"
          aria-label={msg('Período siguiente', 'Next period')}
          disabled={isLast}
          onClick={function () { if (onSelect) onSelect(stepPeriod(idx, 1, model.blocks.length)); }}
          style={iconBtn(isLast)}
        >
          <Chevron dir="right" color={strong} />
        </button>
      </div>

      <div aria-hidden="true" style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 6 }}>
        {model.blocks.map(function (b, i) {
          return <span key={b.key} style={{ width: 6, height: 6, borderRadius: 3, background: i === idx ? '#2563EB' : line }} />;
        })}
      </div>

      <div style={{ textAlign: 'center', marginTop: 18 }}>
        <div data-testid="training-volume-period-total" style={{ fontSize: 32, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
          {formatVolume(period.kg)}
        </div>
        <div style={{ fontSize: 12, color: neutral, fontWeight: 600, marginTop: 2 }}>
          {msg('Volumen de la semana', 'Volume for the week')}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: neutral, paddingBottom: 8, borderBottom: '1px solid ' + line }}>
          {msg('Entrenamientos', 'Workouts')}
        </div>
        {period.days.length === 0 ? (
          <div data-testid="training-volume-empty" style={{ fontSize: 13, color: neutral, padding: '14px 0' }}>
            {msg('Sin entrenamientos registrados en este período.', 'No workouts logged in this period.')}
          </div>
        ) : (
          period.days.map(function (d) {
            return (
              <div
                key={d.day}
                data-testid="training-volume-day"
                data-day={d.day}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 48, borderBottom: '1px solid ' + line }}
              >
                <span style={{ fontSize: 14, fontWeight: 600 }}>{formatDayRow(d.day, lang)}</span>
                <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatVolume(d.kg)}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/**
 * Card "Volumen de entrenamiento". Lee filas crudas de `progreso` (paginadas, sin el tope de 50 sets de
 * `progress`) y las combina con las series locales aun no sincronizadas. Si la lectura falla o queda
 * incompleta, la card se oculta (nunca muestra 0 kg). "Ver detalle" abre el detalle por periodo.
 */
export default function StudentTrainingVolumeCard({ alumnoId, progress, routines, fetchPage, _dm, textMuted, msg }) {
  const [remote, setRemote] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState(3); // B4 = periodo mas reciente
  const backRef = useRef(null);

  useEffect(function () {
    let cancelled = false;
    setRemote(null);
    if (!alumnoId) return undefined;
    fetchTrainingVolumeRows(fetchPage, alumnoId, { now: new Date() })
      .then(function (res) { if (!cancelled) setRemote(res); })
      .catch(function () { if (!cancelled) setRemote({ complete: false, rows: [] }); });
    return function () { cancelled = true; };
  }, [alumnoId, fetchPage]);

  const model = useMemo(function () {
    return buildTrainingVolumeModel(remote, progress, routines, new Date());
  }, [remote, progress, routines]);

  const visible = !!(model && model.showCard);
  const open = detailOpen && visible;

  // Si la card deja de ser visible (p. ej. lectura incompleta), el detalle no debe reabrirse solo despues.
  useEffect(function () { if (!visible) setDetailOpen(false); }, [visible]);

  // Detalle abierto: sin scroll del fondo (Safari/iPhone), Escape cierra, foco en "volver".
  useEffect(function () {
    if (!open || typeof document === 'undefined') return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e) { if (e.key === 'Escape') setDetailOpen(false); }
    document.addEventListener('keydown', onKey);
    if (backRef.current && backRef.current.focus) backRef.current.focus();
    return function () {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function openDetail() { setSelected(3); setDetailOpen(true); }
  function closeDetail() { setDetailOpen(false); }

  const overlay = open && typeof document !== 'undefined'
    ? createPortal(
        <div
          ref={function (el) { backRef.current = el ? el.querySelector('[data-testid="training-volume-back"]') : null; }}
          role="dialog"
          aria-modal="true"
          aria-label={msg('Detalle de volumen', 'Volume detail')}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 3000,
            background: _dm ? '#0B1522' : '#FFFFFF', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <TrainingVolumeDetailView
            model={model}
            selected={selected}
            onSelect={setSelected}
            onBack={closeDetail}
            _dm={_dm}
            textMuted={textMuted}
            msg={msg}
          />
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <TrainingVolumeCardView model={model} _dm={_dm} textMuted={textMuted} msg={msg} onOpenDetail={openDetail} />
      {overlay}
    </>
  );
}
