import React from 'react'

export default function ExerciseProgressDetails({
  ex,
  datosAsc,
  hist,
  pr,
  metricTab,
  rangeKey,
  setMetricTab,
  setRangeKey,
  accent,
  es,
  DetailChart,
  pctColor,
}) {
  return (
    <div
      className="mx-[18px] mb-5 rounded-[22px] border px-[18px] pb-6 pt-[18px]"
      style={{
        borderColor: 'rgba(90, 121, 160, 0.5)',
        background: 'linear-gradient(180deg, rgba(28, 47, 72, 0.64), rgba(10, 18, 30, 0.42))',
        boxSizing: 'border-box',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {[
          { id: 'peso', labEs: 'Peso', labEn: 'Weight' },
          { id: 'reps', labEs: 'Reps', labEn: 'Reps' },
          { id: 'volumen', labEs: 'Volumen', labEn: 'Volume' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            className="rounded-[11px] text-[13px] font-semibold transition-colors"
            style={{
              minHeight: 52,
              padding: '14px 16px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              whiteSpace: 'normal',
              boxSizing: 'border-box',
              background:
                metricTab === t.id
                  ? 'linear-gradient(180deg, rgba(37,99,235,0.86), rgba(29,78,216,0.62))'
                  : 'rgba(7,16,28,0.42)',
              color: metricTab === t.id ? 'var(--sp-fg)' : 'var(--sp-muted)',
              border: `1px solid ${metricTab === t.id ? 'rgba(96, 165, 250, 0.46)' : 'rgba(90, 121, 160, 0.34)'}`,
            }}
            onClick={() => setMetricTab(t.id)}
          >
            {es ? t.labEs : t.labEn}
          </button>
        ))}
        <div className="ml-auto flex flex-wrap gap-2">
          {['1M', '3M', '6M', '1A'].map((rk) => (
            <button
              key={rk}
              type="button"
              className="rounded-[10px] text-[12px] font-semibold tabular-nums"
              style={{
                minHeight: 44,
                padding: '10px 14px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                whiteSpace: 'normal',
                boxSizing: 'border-box',
                background: rangeKey === rk ? 'rgba(37, 99, 235, 0.24)' : 'rgba(7,16,28,0.22)',
                color: rangeKey === rk ? accent : 'var(--sp-muted)',
                border: `1px solid ${rangeKey === rk ? 'rgba(37, 99, 235, 0.35)' : 'transparent'}`,
              }}
              onClick={() => setRangeKey(rk)}
            >
              {rk}
            </button>
          ))}
        </div>
      </div>

      <DetailChart
        datosAsc={datosAsc}
        metricMode={metricTab === 'volumen' ? 'volumen' : metricTab}
        rangeKey={rangeKey}
        exId={ex.id}
        accent="#3b82f6"
        prHex="#f59e0b"
        bgHex="#0F1923"
        es={es}
      />

      <div className="mt-6">
        <div
          className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: 'rgba(243,244,246,0.5)' }}
        >
          {es ? 'Historial' : 'History'} · {hist.length}{' '}
          {es ? 'sesiones' : 'sessions'}
        </div>
        <div className="flex max-h-[264px] flex-col gap-2.5 overflow-y-auto pr-1 sp-scroll-hide">
          {hist.slice(0, 24).map((d, i) => {
            const isRowPR = pr > 0 && Math.abs(d.kg - pr) < 0.05
            const prev = hist[i + 1]
            const rowPct = prev && prev.kg ? Math.round(((d.kg - prev.kg) / prev.kg) * 100) : null
            return (
              <div
                key={`${ex.id}-h-${i}-${d.fecha}-${d.kg}`}
                className="grid min-h-[58px] grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-[13px] px-4 py-3 text-[13px] tabular-nums"
                style={{
                  borderLeft: isRowPR ? '2px solid var(--sp-pr)' : '2px solid transparent',
                  background: isRowPR ? 'rgba(245, 158, 11, 0.09)' : 'rgba(36,55,82,0.45)',
                  color: 'var(--sp-fg)',
                }}
              >
                <span className="min-w-0 truncate" style={{ color: 'var(--sp-muted)' }}>{d.fecha}</span>
                <span className="font-semibold text-right">
                  {d.kg}kg × {d.reps}
                </span>
                <span className="min-w-[42px] text-right font-semibold" style={{ color: pctColor(rowPct) }}>
                  {rowPct == null ? '—' : `${rowPct > 0 ? '+' : ''}${rowPct}%`}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
