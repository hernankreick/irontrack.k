export function StudentProgressWeeklyVolumeHero({
  volModel,
  daysHit,
  metaDays,
  es,
  HeroSparkSvg,
  formatTonnes,
}) {
  return (
    <section className="mb-1">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--sp-muted)' }}>
        {es ? 'Volumen de la semana' : 'Weekly volume'}
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-end gap-2">
          <span
            className="num leading-none tabular-nums"
            style={{
              fontFamily: "'DM Mono',monospace",
              fontSize: 56,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: 'var(--sp-fg)',
            }}
          >
            {formatTonnes(volModel.volWeekTon)}
          </span>
          <span className="pb-2 text-[13px] font-medium" style={{ color: 'var(--sp-muted)' }}>
            ton
          </span>
        </div>
        <HeroSparkSvg series={volModel.sparkDaily} accent="#3b82f6" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {volModel.deltaPct != null && volModel.deltaPct !== 0 ? (
          <span
            className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums"
            style={{
              background: 'rgba(59, 130, 246, 0.14)',
              color: 'var(--sp-accent)',
            }}
          >
            {volModel.deltaPct > 0 ? '+' : ''}
            {volModel.deltaPct}%
          </span>
        ) : null}
        <span className="text-[11px]" style={{ color: 'var(--sp-muted)' }}>
          {es ? 'vs semana pasada' : 'vs last week'}
        </span>
      </div>

      <div className="mt-6 flex items-end justify-between gap-3">
        <div className="flex flex-1 justify-between gap-1">
          {volModel.weekBars.map((b) => (
            <div key={b.dayKey} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full max-w-[28px] rounded-sm"
                style={{
                  height: 22,
                  border:
                    b.isToday && !b.hit
                      ? '1px dashed rgba(243,244,246,0.28)'
                      : b.hit
                        ? 'none'
                        : '1px solid var(--sp-stroke)',
                  background: b.hit ? 'rgba(59, 130, 246, 0.35)' : 'transparent',
                }}
              />
              <span className="text-[9px] font-semibold" style={{ color: 'var(--sp-muted)' }}>
                {b.letter}
              </span>
            </div>
          ))}
        </div>
        <div className="shrink-0 text-right">
          <div
            className="num tabular-nums leading-none"
            style={{
              fontFamily: "'DM Mono',monospace",
              fontSize: 18,
              fontWeight: 800,
              color: 'var(--sp-fg)',
            }}
          >
            {daysHit}/{metaDays}
          </div>
          <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--sp-muted)' }}>
            {es ? 'Meta sem' : 'Week goal'}
          </div>
        </div>
      </div>
    </section>
  )
}
