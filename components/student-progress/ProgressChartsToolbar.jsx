import React from 'react'
import { ChevronDown } from 'lucide-react'

export default function ProgressChartsToolbar({
  activeCount,
  totalCount,
  showAll,
  setShowAll,
  muscle,
  setMuscle,
  sortBy,
  setSortBy,
  muscleOpen,
  setMuscleOpen,
  sortOpen,
  setSortOpen,
  accent,
  es,
  MUSCLE_FILTERS,
  SORT_OPTS,
}) {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2
              className="m-0 text-[12px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: 'rgba(203,213,225,0.78)' }}
            >
              {es ? 'Progreso por ejercicio' : 'Progress by exercise'}
            </h2>
            <span className="text-[12px] tabular-nums" style={{ color: 'var(--sp-muted)' }}>
              · {activeCount} {es ? 'activos' : 'active'}
            </span>
          </div>
        </div>
        {totalCount > 10 && (
          <button
            type="button"
            className="shrink-0 border-0 bg-transparent p-0 text-[13px] font-semibold"
            style={{ color: accent }}
            onClick={() => setShowAll(true)}
          >
            {es ? 'Ver todos' : 'View all'}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-x-3.5 gap-y-3">
        <div className="relative max-w-full">
          <button
            type="button"
            className="inline-flex h-[46px] items-center justify-between gap-4 rounded-full border py-2 pl-6 pr-5 text-[13px] font-medium leading-none"
            style={{
              width: 190,
              maxWidth: '100%',
              borderColor: 'rgba(111, 143, 184, 0.52)',
              background: 'linear-gradient(180deg, rgba(36, 55, 82, 0.92), rgba(19, 33, 52, 0.92))',
              color: 'var(--sp-fg)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)',
              boxSizing: 'border-box',
              whiteSpace: 'nowrap',
            }}
            onClick={(e) => {
              e.stopPropagation()
              setMuscleOpen((o) => !o)
              setSortOpen(false)
            }}
          >
            <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left" style={{ marginLeft: 4 }}>
              {es ? 'Músculo' : 'Muscle'} · {muscle}
            </span>
            <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 opacity-60" strokeWidth={2.25} />
          </button>
          {muscleOpen && (
            <div
              className="absolute left-2 top-full z-30 mt-2 max-h-64 w-[200px] max-w-[calc(100vw-40px)] overflow-y-auto rounded-[18px] border px-3 py-2 shadow-2xl"
              style={{
                borderColor: 'rgba(111, 143, 184, 0.42)',
                background: 'linear-gradient(180deg, rgba(28, 47, 72, 0.98), rgba(10, 18, 30, 0.98))',
                boxShadow: '0 18px 42px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.06)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {MUSCLE_FILTERS.map((m) => {
                const active = m === muscle
                return (
                  <button
                    key={m}
                    type="button"
                    className="flex min-h-10 w-full items-center justify-between gap-3 rounded-xl px-5 py-2 text-left text-[13px] font-semibold transition-colors hover:bg-[rgba(59,130,246,0.12)]"
                    style={{
                      background: active ? 'rgba(59, 130, 246, 0.22)' : 'transparent',
                      color: active ? 'var(--sp-fg)' : 'rgba(203, 213, 225, 0.86)',
                      border: active ? '1px solid rgba(96, 165, 250, 0.34)' : '1px solid transparent',
                      boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,0.05)' : 'none',
                      paddingLeft: 18,
                      width: '100%',
                    }}
                    onClick={() => {
                      setMuscle(m)
                      setMuscleOpen(false)
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate">{m}</span>
                    {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--sp-accent)' }} />}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="relative max-w-full">
          <button
            type="button"
            className="inline-flex h-[46px] items-center justify-between gap-4 rounded-full border py-2 pl-6 pr-5 text-[13px] font-medium leading-none"
            style={{
              width: 190,
              maxWidth: '100%',
              borderColor: 'rgba(111, 143, 184, 0.52)',
              background: 'linear-gradient(180deg, rgba(36, 55, 82, 0.92), rgba(19, 33, 52, 0.92))',
              color: 'var(--sp-fg)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)',
              boxSizing: 'border-box',
              whiteSpace: 'nowrap',
            }}
            onClick={(e) => {
              e.stopPropagation()
              setSortOpen((o) => !o)
              setMuscleOpen(false)
            }}
          >
            <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left" style={{ marginLeft: 4 }}>
              {SORT_OPTS.find((o) => o.value === sortBy)?.[es ? 'labelEs' : 'labelEn']}
            </span>
            <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 opacity-60" strokeWidth={2.25} />
          </button>
          {sortOpen && (
            <div
              className="absolute left-2 top-full z-30 mt-2 w-[200px] max-w-[calc(100vw-40px)] rounded-[18px] border px-3 py-2 shadow-2xl"
              style={{
                borderColor: 'rgba(111, 143, 184, 0.42)',
                background: 'linear-gradient(180deg, rgba(28, 47, 72, 0.98), rgba(10, 18, 30, 0.98))',
                boxShadow: '0 18px 42px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.06)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {SORT_OPTS.map((o) => {
                const active = o.value === sortBy
                return (
                  <button
                    key={o.value}
                    type="button"
                    className="flex min-h-10 w-full items-center justify-between gap-3 rounded-xl px-5 py-2 text-left text-[13px] font-semibold transition-colors hover:bg-[rgba(59,130,246,0.12)]"
                    style={{
                      background: active ? 'rgba(59, 130, 246, 0.22)' : 'transparent',
                      color: active ? 'var(--sp-fg)' : 'rgba(203, 213, 225, 0.86)',
                      border: active ? '1px solid rgba(96, 165, 250, 0.34)' : '1px solid transparent',
                      boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,0.05)' : 'none',
                      paddingLeft: 18,
                      width: '100%',
                    }}
                    onClick={() => {
                      setSortBy(o.value)
                      setSortOpen(false)
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate">{es ? o.labelEs : o.labelEn}</span>
                    {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--sp-accent)' }} />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
