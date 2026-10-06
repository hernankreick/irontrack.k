import React, { useEffect, useMemo, useState } from 'react';
import {
  collectRoutineExerciseDefs,
  computeTrainingVolume,
  fetchTrainingVolumeRows,
  formatDayShort,
  formatVolume,
  mergeRemoteAndLocalRows,
  todayDayNum,
} from '../../lib/trainingVolume.js';

const BAR_AREA_H = 36;

/** Bloques de 7 dias alineados a hoy (no son semanas calendario). */
function blockLabel(key, msg) {
  if (key === 'B1') return msg('hace 3 sem', '3 wks ago');
  if (key === 'B2') return msg('hace 2 sem', '2 wks ago');
  if (key === 'B3') return msg('hace 1 sem', '1 wk ago');
  return msg('últ. 7 días', 'last 7 days');
}

function buildBarsAriaLabel(blocks, msg) {
  const parts = blocks.map(function (b) {
    return formatDayShort(b.startDay) + ' ' + msg('al', 'to') + ' ' + formatDayShort(b.endDay) + ': ' + Math.round(b.kg) + ' kg';
  });
  return msg('Volumen por bloque de 7 días, del más antiguo al más reciente. ', 'Volume per 7-day block, oldest to most recent. ') + parts.join('; ') + '.';
}

/** Presentacional puro (sin efectos): recibe el modelo de computeTrainingVolume. */
export function TrainingVolumeCardView({ model, _dm, textMuted, msg }) {
  if (!model || !model.showCard) return null;
  const strong = _dm ? '#E2E8F0' : '#0F172A';
  const neutral = textMuted || (_dm ? '#94A3B8' : '#64748B');
  const barMuted = _dm ? '#475569' : '#CBD5E1';
  const barRecent = '#2563EB';
  const max = Math.max.apply(null, model.blocks.map(function (b) { return b.kg; }));
  return (
    <div
      data-testid="training-volume-card"
      style={{
        marginTop: 10, padding: '10px 12px', borderRadius: 10,
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
                {blockLabel(b.key, msg)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Card "Volumen de entrenamiento". Lee filas crudas de `progreso` (paginadas, sin el tope de 50 sets de
 * `progress`) y las combina con las series locales aun no sincronizadas. Si la lectura falla o queda
 * incompleta, la card se oculta (nunca muestra 0 kg).
 */
export default function StudentTrainingVolumeCard({ alumnoId, progress, routines, fetchPage, _dm, textMuted, msg }) {
  const [remote, setRemote] = useState(null);

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
    if (!remote || !remote.complete) return null;
    const rows = mergeRemoteAndLocalRows(remote.rows, progress);
    return computeTrainingVolume(rows, {
      today: todayDayNum(new Date()),
      complete: true,
      routineExerciseDefs: collectRoutineExerciseDefs(routines),
    });
  }, [remote, progress, routines]);

  return <TrainingVolumeCardView model={model} _dm={_dm} textMuted={textMuted} msg={msg} />;
}
