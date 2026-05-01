import React from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowDown, ArrowUp, ChevronDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  mergeSetsForExercise,
  exercisesWithData,
  exerciseMatchesMuscleFilter,
  parseProgressDate,
  filterRowsByRange,
  movingAverage,
  progressivePRMasks,
} from './progressMetrics.js'

const MUSCLE_FILTERS = [
  'Todos',
  'Espalda',
  'Pecho',
  'Piernas',
  'Cuadriceps',
  'Gluteos',
  'Biceps',
  'Triceps',
  'Hombros',
  'Core',
  'Full Body',
]

const SORT_OPTS = [
  { value: 'mejora', labelEs: 'Mayor mejora', labelEn: 'Best improvement' },
  { value: 'reciente', labelEs: 'Más reciente', labelEn: 'Most recent' },
  { value: 'alfa', labelEs: 'Alfabético', labelEn: 'Alphabetical' },
  { value: 'peso', labelEs: 'Mayor peso', labelEn: 'Highest weight' },
]

function shortDateLabel(fecha) {
  const d = parseProgressDate(fecha)
  if (!d) return String(fecha || '').slice(0, 8)
  try {
    return format(d, 'd MMM', { locale: es })
  } catch {
    return String(fecha).slice(0, 8)
  }
}

function metricValue(row, mode) {
  const kg = parseFloat(row.kg) || 0
  const reps = parseInt(row.reps, 10) || 0
  if (mode === 'peso') return kg
  if (mode === 'reps') return reps
  return (kg * reps) / 1000
}

function metricUnit(mode, es) {
  if (mode === 'peso') return 'kg'
  if (mode === 'reps') return es ? 'rep' : 'reps'
  return es ? 'ton' : 'ton'
}

function MiniSpark({ values, accent }) {
  const h = 22
  const w = 58
  const pad = 2
  const vals = (values || []).map((v) => Number(v) || 0)
  if (!vals.length) return <svg width={w} height={h} aria-hidden />
  const mx = Math.max(...vals, 1e-6)
  const denom = vals.length > 1 ? vals.length - 1 : 1
  const pts = vals.map((v, i) => {
    const x = pad + (i / denom) * (w - pad * 2)
    const y = pad + (1 - v / mx) * (h - pad * 2)
    return `${x},${y}`
  })
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0 overflow-visible" aria-hidden>
      <polyline
        fill="none"
        stroke={accent}
        strokeWidth={2.1}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts.join(' ')}
      />
    </svg>
  )
}

function DetailChart({
  datosAsc,
  metricMode,
  rangeKey,
  exId,
  accent,
  prHex,
  bgHex,
  es,
}) {
  const filtered = React.useMemo(
    () => filterRowsByRange(datosAsc, rangeKey),
    [datosAsc, rangeKey]
  )

  const sorted = React.useMemo(() => {
    return [...filtered].sort((a, b) => {
      const ta = parseProgressDate(a.fecha)?.getTime() ?? 0
      const tb = parseProgressDate(b.fecha)?.getTime() ?? 0
      return ta - tb
    })
  }, [filtered])

  const yVals = sorted.map((r) => metricValue(r, metricMode))
  const metricKey =
    metricMode === 'peso' ? 'peso' : metricMode === 'reps' ? 'reps' : 'volumen'
  const prFlags = progressivePRMasks(sorted, metricKey)
  const maWin = sorted.length >= 4 ? 3 : 2
  const ma = movingAverage(yVals, maWin)

  const gradId = `sp-area-${exId}-${metricMode}`
  const W = 320
  const H = 160
  const padL = 34
  const padR = 8
  const padT = 10
  const padB = 28

  if (sorted.length < 2) {
    return (
      <div
        className="rounded-[14px] border px-5 py-8 text-center text-[12px] leading-relaxed"
        style={{
          borderColor: 'rgba(74, 101, 133, 0.42)',
          background: 'rgba(10, 15, 26, 0.32)',
          color: 'var(--sp-muted)',
        }}
      >
        {es ? 'Necesitás al menos 2 registros en este rango' : 'Need at least 2 logs in this range'}
      </div>
    )
  }

  const maxY = Math.max(...yVals, 1e-6)
  const minY = Math.min(...yVals, 0)
  const span = maxY - minY || 1

  const xPos = (i) => padL + (i / Math.max(sorted.length - 1, 1)) * (W - padL - padR)
  const yPos = (v) => padT + (1 - (v - minY) / span) * (H - padT - padB)

  const linePts = yVals.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ')
  const maPts = ma
    .map((v, i) => `${xPos(i)},${yPos(v)}`)
    .join(' ')

  const bottomY = H - padB
  const firstX = xPos(0)
  const lastX = xPos(sorted.length - 1)
  const areaPath = `M ${firstX} ${bottomY} L ${yVals
    .map((v, i) => `${xPos(i)} ${yPos(v)}`)
    .join(' L ')} L ${lastX} ${bottomY} Z`

  const ticks = [0, 1, 2].map((i) => minY + (span * i) / 2)

  const xLabels = [
    sorted[0]?.fecha,
    sorted[Math.floor(sorted.length / 2)]?.fecha,
    sorted[sorted.length - 1]?.fecha,
  ]

  const fmtTick = (v) => {
    if (metricMode === 'volumen') return (Math.round(v * 100) / 100).toLocaleString()
    if (metricMode === 'peso') return (Math.round(v * 10) / 10).toLocaleString()
    return String(Math.round(v))
  }

  return (
    <div className="w-full">
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="block max-h-[200px]"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity={0.28} />
            <stop offset="100%" stopColor={accent} stopOpacity={0} />
          </linearGradient>
        </defs>

        {[0, 1, 2].map((i) => {
          const yy = padT + ((H - padT - padB) * i) / 2
          return (
            <line
              key={`g-${i}`}
              x1={padL}
              x2={W - padR}
              y1={yy}
              y2={yy}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
          )
        })}

        {ticks.map((tv, i) => (
          <text
            key={`tk-${i}`}
            x={4}
            y={yPos(tv) + 3}
            fill="rgba(243,244,246,0.45)"
            fontSize={9}
            fontVariantNumeric="tabular-nums"
          >
            {fmtTick(tv)}
          </text>
        ))}

        <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />

        <polyline
          fill="none"
          stroke={accent}
          strokeWidth={1.8}
          strokeLinejoin="round"
          strokeLinecap="round"
          points={linePts}
        />

        <polyline
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth={1}
          strokeDasharray="3 3"
          points={maPts}
        />

        {sorted.map((_, i) => (
          <circle
            key={`dot-${i}`}
            cx={xPos(i)}
            cy={yPos(yVals[i])}
            r={2}
            fill={bgHex}
            stroke={accent}
            strokeWidth={1.25}
          />
        ))}

        {sorted.map((_, i) =>
          prFlags[i] ? (
            <polygon
              key={`pr-${i}`}
              points={`${xPos(i)},${yPos(yVals[i]) - 5} ${xPos(i) + 5},${yPos(yVals[i])} ${xPos(i)},${yPos(yVals[i]) + 5} ${xPos(i) - 5},${yPos(yVals[i])}`}
              fill={prHex}
              stroke={bgHex}
              strokeWidth={1}
            />
          ) : null
        )}

        {xLabels.map((dt, i) => {
          const xi = i === 0 ? xPos(0) : i === 1 ? xPos(Math.floor((sorted.length - 1) / 2)) : xPos(sorted.length - 1)
          return (
            <text
              key={`xl-${i}`}
              x={xi}
              y={H - 4}
              textAnchor={i === 0 ? 'start' : i === 1 ? 'middle' : 'end'}
              fill="rgba(243,244,246,0.45)"
              fontSize={9}
            >
              {dt ? shortDateLabel(dt) : ''}
            </text>
          )
        })}
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px]" style={{ color: 'var(--sp-muted)' }}>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-px w-4 rounded-full" style={{ background: accent }} />
          {metricMode === 'peso' && (es ? 'Peso (kg)' : 'Weight (kg)')}
          {metricMode === 'reps' && (es ? 'Repeticiones' : 'Reps')}
          {metricMode === 'volumen' && (es ? 'Volumen (ton)' : 'Volume (ton)')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-px w-4 border-t border-dashed border-[rgba(255,255,255,0.35)]" />
          {es ? 'Promedio móvil' : 'Moving average'}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rotate-45 border border-[var(--sp-bg)]" style={{ background: prHex }} />
          PR
        </span>
      </div>
    </div>
  )
}

export function ProgressChartsPanel({
  progress,
  EX,
  allEx,
  es,
  sbData,
  loadingSb,
  emptySkeleton,
}) {
  const [expandedEx, setExpandedEx] = React.useState(null)
  const [muscle, setMuscle] = React.useState('Todos')
  const [sortBy, setSortBy] = React.useState('mejora')
  const [muscleOpen, setMuscleOpen] = React.useState(false)
  const [sortOpen, setSortOpen] = React.useState(false)
  const [showAll, setShowAll] = React.useState(false)
  const [metricTab, setMetricTab] = React.useState('peso')
  const [rangeKey, setRangeKey] = React.useState('3M')

  const accent = 'var(--sp-accent)'
  const prHex = 'var(--sp-pr)'
  const bgHex = 'var(--sp-bg)'

  const exConDatos = React.useMemo(() => {
    return exercisesWithData(allEx, EX, progress, sbData).filter((e) => {
      if (!exerciseMatchesMuscleFilter(e, muscle)) return false
      return mergeSetsForExercise(e.id, progress, sbData).length > 0
    })
  }, [allEx, EX, progress, sbData, muscle])

  const items = React.useMemo(() => {
    const rows = exConDatos.map((e) => {
      const datos = mergeSetsForExercise(e.id, progress, sbData)
      const pr = Math.max(...datos.map((d) => d.kg), 0)
      const ultimo = datos[datos.length - 1]
      const primero = datos[0]
      const pct =
        datos.length >= 2 && primero.kg > 0 ? Math.round(((ultimo.kg - primero.kg) / primero.kg) * 100) : null
      let trend = 'neutral'
      if (pct != null && pct > 0) trend = 'up'
      if (pct != null && pct < 0) trend = 'down'
      const lastDate = datos.map((d) => parseProgressDate(d.fecha)).filter(Boolean)
      const lastTs = lastDate.length ? Math.max(...lastDate.map((d) => d.getTime())) : 0
      const kgSeries = datos.slice(-8).map((d) => d.kg)
      const atPR = pr > 0 && ultimo && Math.abs(ultimo.kg - pr) < 0.05
      return {
        ex: e,
        datos,
        datosAsc: [...datos].sort((a, b) => {
          const ta = parseProgressDate(a.fecha)?.getTime() ?? 0
          const tb = parseProgressDate(b.fecha)?.getTime() ?? 0
          return ta - tb
        }),
        pr,
        ultimo,
        pct,
        trend,
        name: es ? e.name : e.nameEn || e.name,
        lastTs,
        improvement: pct ?? 0,
        kgSeries,
        atPR,
      }
    })
    const sorted = [...rows]
    if (sortBy === 'mejora') sorted.sort((a, b) => b.improvement - a.improvement)
    else if (sortBy === 'reciente') sorted.sort((a, b) => b.lastTs - a.lastTs)
    else if (sortBy === 'alfa') sorted.sort((a, b) => a.name.localeCompare(b.name))
    else if (sortBy === 'peso') sorted.sort((a, b) => b.pr - a.pr)
    return sorted
  }, [exConDatos, progress, sbData, es, sortBy])

  const activeCount = items.length
  const limited = showAll ? items : items.slice(0, 10)

  React.useEffect(() => {
    if (!muscleOpen && !sortOpen) return
    const fn = () => {
      setMuscleOpen(false)
      setSortOpen(false)
    }
    window.addEventListener('click', fn)
    return () => window.removeEventListener('click', fn)
  }, [muscleOpen, sortOpen])

  if (loadingSb) {
    return (
      <div className="flex flex-col gap-4 py-2">
        <div className="h-[96px] rounded-[12px] border border-[var(--sp-stroke)] bg-[var(--sp-surface)]" />
        <div className="h-[96px] rounded-[12px] border border-[var(--sp-stroke)] bg-[var(--sp-surface)]" />
      </div>
    )
  }

  if (emptySkeleton) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={`sk-${i}`}
            className="h-[96px] rounded-[12px] border border-dashed border-[var(--sp-stroke)] bg-[var(--sp-surface)]/40"
          />
        ))}
        <p className="text-center text-[12px] leading-relaxed" style={{ color: 'var(--sp-muted)' }}>
          {es
            ? 'Tus ejercicios aparecerán aquí en cuanto registres tu primera sesión.'
            : 'Your exercises will show up here after you log your first session.'}
        </p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--sp-muted)' }}>
          {es ? 'Registrá sets con peso para ver tu progreso por ejercicio.' : 'Log weighted sets to see progress per exercise.'}
        </p>
      </div>
    )
  }

  const trendGlyph = (trend) => {
    const common = 'h-4 w-4 shrink-0'
    if (trend === 'up') return <ArrowUp className={common} strokeWidth={2.25} style={{ color: accent }} />
    if (trend === 'down')
      return <ArrowDown className={common} strokeWidth={2.25} style={{ color: 'rgba(243,244,246,0.55)' }} />
    return <Minus className={common} strokeWidth={2.25} style={{ color: 'rgba(243,244,246,0.35)' }} />
  }

  const pctColor = (pct) => {
    if (pct == null) return 'var(--sp-muted)'
    if (pct > 0) return accent
    if (pct < 0) return 'var(--sp-danger)'
    return 'var(--sp-muted)'
  }

  return (
    <div className="flex flex-col gap-5 px-0 pt-4">
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
        {items.length > 10 && (
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

      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <button
            type="button"
            className="inline-flex min-h-[42px] items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-medium"
            style={{
              borderColor: 'rgba(111, 143, 184, 0.52)',
              background: 'linear-gradient(180deg, rgba(36, 55, 82, 0.92), rgba(19, 33, 52, 0.92))',
              color: 'var(--sp-fg)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)',
            }}
            onClick={(e) => {
              e.stopPropagation()
              setMuscleOpen((o) => !o)
              setSortOpen(false)
            }}
          >
            {es ? 'Músculo' : 'Muscle'} · {muscle}
            <ChevronDown className="h-3.5 w-3.5 opacity-60" strokeWidth={2.25} />
          </button>
          {muscleOpen && (
            <div
              className="absolute left-0 top-full z-20 mt-1 max-h-52 min-w-[200px] overflow-y-auto rounded-[12px] border p-1 shadow-xl"
              style={{
                borderColor: 'var(--sp-stroke)',
                background: 'var(--sp-surface-high)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {MUSCLE_FILTERS.map((m) => (
                <button
                  key={m}
                  type="button"
                  className="block w-full rounded-lg px-3 py-2 text-left text-[12px]"
                  style={{
                    background: m === muscle ? 'rgba(59, 130, 246, 0.18)' : 'transparent',
                    color: 'var(--sp-fg)',
                  }}
                  onClick={() => {
                    setMuscle(m)
                    setMuscleOpen(false)
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            className="inline-flex min-h-[42px] items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-medium"
            style={{
              borderColor: 'rgba(111, 143, 184, 0.52)',
              background: 'linear-gradient(180deg, rgba(36, 55, 82, 0.92), rgba(19, 33, 52, 0.92))',
              color: 'var(--sp-fg)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)',
            }}
            onClick={(e) => {
              e.stopPropagation()
              setSortOpen((o) => !o)
              setMuscleOpen(false)
            }}
          >
            {SORT_OPTS.find((o) => o.value === sortBy)?.[es ? 'labelEs' : 'labelEn']}
            <ChevronDown className="h-3.5 w-3.5 opacity-60" strokeWidth={2.25} />
          </button>
          {sortOpen && (
            <div
              className="absolute left-0 top-full z-20 mt-1 min-w-[200px] rounded-[12px] border p-1 shadow-xl"
              style={{
                borderColor: 'var(--sp-stroke)',
                background: 'var(--sp-surface-high)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {SORT_OPTS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className="block w-full rounded-lg px-3 py-2 text-left text-[12px]"
                  style={{
                    background:
                      o.value === sortBy ? 'rgba(59, 130, 246, 0.18)' : 'transparent',
                    color: 'var(--sp-fg)',
                  }}
                  onClick={() => {
                    setSortBy(o.value)
                    setSortOpen(false)
                  }}
                >
                  {es ? o.labelEs : o.labelEn}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {limited.map(({ ex, datos, datosAsc, pr, ultimo, pct, trend, name, kgSeries, atPR }) => {
          const isOpen = expandedEx === ex.id
          const hist = [...datos].reverse()

          return (
            <div
              key={ex.id}
              className="overflow-hidden rounded-[18px] border transition-colors"
              style={{
                borderColor: isOpen ? 'rgba(111, 143, 184, 0.72)' : 'rgba(90, 121, 160, 0.56)',
                background:
                  'linear-gradient(135deg, rgba(28, 47, 72, 0.95), rgba(12, 23, 37, 0.96))',
                boxShadow: isOpen
                  ? '0 18px 42px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255,255,255,0.08)'
                  : '0 10px 24px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255,255,255,0.06)',
              }}
            >
              <button
                type="button"
                className="flex w-full min-h-[144px] flex-col gap-4 px-5 py-5 text-left sm:min-h-[132px]"
                style={{ background: 'transparent' }}
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
                      lineHeight: 1.22,
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
                        fontFamily: "'Barlow Condensed',sans-serif",
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

              {isOpen && (
                <div
                  className="mx-4 mb-4 rounded-[17px] border px-4 pb-5 pt-4"
                  style={{
                    borderColor: 'rgba(90, 121, 160, 0.5)',
                    background: 'linear-gradient(180deg, rgba(28, 47, 72, 0.64), rgba(10, 18, 30, 0.42))',
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
                        className="min-h-[42px] rounded-[11px] px-4 py-2 text-[13px] font-semibold transition-colors"
                        style={{
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
                          className="min-h-[38px] rounded-[10px] px-3.5 py-1.5 text-[12px] font-semibold tabular-nums"
                          style={{
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
              )}
            </div>
          )
        })}
      </div>

      {!showAll && items.length > 10 && (
        <button
          type="button"
          className="mx-auto mt-1 block border-0 bg-transparent text-[12px] font-semibold"
          style={{ color: accent }}
          onClick={() => setShowAll(true)}
        >
          {es ? 'Ver todos los ejercicios' : 'View all exercises'}
        </button>
      )}
    </div>
  )
}
