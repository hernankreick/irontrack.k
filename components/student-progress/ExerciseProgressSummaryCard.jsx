import React from 'react'

export default function ExerciseProgressSummaryCard({
  ex,
  name,
  datos,
  ultimo,
  pct,
  trend,
  kgSeries,
  atPR,
  isOpen,
  accent,
  es,
  MiniSpark,
  trendGlyph,
  pctColor,
  cn,
  ChevronDown,
  setExpandedEx,
}) {
  return (
    <button
      type="button"
      className="flex w-full flex-col gap-4 text-left"
      style={{
        background: 'transparent',
        padding: '20px 18px',
        boxSizing: 'border-box',
        minHeight: 120,
      }}
      onClick={() => setExpandedEx(isOpen ? null : ex.id)}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border"
          style={{
            borderColor: 'rgba(111,143,184,0.54)',
            background: 'rgba(7, 16, 28, 0.56)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)',
          }}
        >
        {trendGlyph(trend)}
      </div>
      <div className="min-w-0 flex-1">
        <span
          className="block font-semibold text-[16px]"
          style={{
            color: 'var(--sp-fg)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'normal',
            lineHeight: 1.15,
            marginBottom: 4,
          }}
        >
          {name}
        </span>
      </div>
        <ChevronDown
          className={cn('mt-0.5 h-9 w-9 shrink-0 rounded-full p-2 transition-transform', isOpen && 'rotate-180')}
          strokeWidth={2}
          style={{
            color: 'rgba(226,232,240,0.82)',
            background: 'rgba(74,101,133,0.28)',
          }}
        />
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-[12px]" style={{ color: 'var(--sp-muted)' }}>
          {atPR && (
            <span
              className="shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide"
              style={{
                background: 'linear-gradient(180deg, #FBBF24, #F59E0B)',
                color: '#07111f',
                border: '1px solid rgba(255, 214, 102, 0.55)',
              }}
            >
              PR
            </span>
          )}
          {ultimo ? (
            <>
              <span className="min-w-0 break-words text-[13px] leading-snug">
                {ultimo.kg}kg × {ultimo.reps}
              </span>
            </>
          ) : (
            '—'
          )}
      </div>
      <div className="flex min-w-0 flex-wrap items-end gap-3">
        <div className="min-w-0">
          <span
            className="num block tabular-nums leading-none"
            style={{
              fontFamily: "'DM Mono',monospace",
              fontSize: 38,
              fontWeight: 800,
              color: 'var(--sp-fg)',
            }}
          >
            {ultimo ? `${ultimo.kg}` : '—'}
          </span>
          <span className="block text-[11px] font-semibold uppercase leading-none" style={{ color: 'var(--sp-muted)' }}>
            kg
          </span>
        </div>
        {pct != null && datos.length >= 2 && (
          <span
            className="mb-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums"
            style={{
              color: pctColor(pct),
              background: pct > 0 ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255,255,255,0.04)',
            }}
          >
            {pct > 0 ? '+' : ''}
            {pct}%
          </span>
        )}
        <div className="ml-auto flex min-w-[72px] justify-end pb-1">
          <MiniSpark values={kgSeries.slice(-6)} accent={accent} />
        </div>
      </div>
    </button>
  )
}
