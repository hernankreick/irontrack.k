export function StudentProgressKpiStrip({ kpiRows }) {
  return (
    <div
      className="grid grid-cols-4 rounded-[24px] border"
      style={{
        borderColor: 'rgba(90,121,160,0.48)',
        background: 'linear-gradient(135deg, rgba(28,47,72,0.9), rgba(11,22,36,0.94))',
        boxSizing: 'border-box',
        overflow: 'hidden',
        minHeight: 0,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      {kpiRows.map((k, idx) => (
        <div
          key={k.id}
          className="flex min-h-0 flex-col justify-center text-center"
          style={{
            boxSizing: 'border-box',
            padding: '16px 8px',
            borderLeft: idx > 0 ? '1px solid var(--sp-stroke)' : undefined,
          }}
        >
          <div
            className="text-[9px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: 'var(--sp-muted)', lineHeight: 1.35, wordBreak: 'normal' }}
          >
            {k.label}
          </div>
          <div
            className="num mt-1 tabular-nums leading-none"
            style={{
              fontFamily: "'DM Mono',monospace",
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: k.pr ? 'var(--sp-pr)' : 'var(--sp-fg)',
            }}
          >
            {k.val == null || k.val === '' ? '—' : k.val}
          </div>
          <div className="mt-1 text-[9.5px]" style={{ color: 'var(--sp-muted)', lineHeight: 1.45, wordBreak: 'normal' }}>
            {k.sub}
          </div>
        </div>
      ))}
    </div>
  )
}
