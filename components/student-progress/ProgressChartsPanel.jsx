import React from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowDown, ArrowUp, ChevronDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import ExerciseProgressDetails from './ExerciseProgressDetails.jsx'
import ExerciseProgressSummaryCard from './ExerciseProgressSummaryCard.jsx'
import ProgressChartsToolbar from './ProgressChartsToolbar.jsx'
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
        className="flex min-h-[78px] items-center justify-center rounded-[14px] border px-5 py-5 text-center text-[15px] leading-[1.35]"
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
      <div className="my-3 flex flex-col gap-5 py-3">
        <div className="min-h-[96px] rounded-[24px] border border-[var(--sp-stroke)] bg-[var(--sp-surface)]" />
        <div className="min-h-[96px] rounded-[24px] border border-[var(--sp-stroke)] bg-[var(--sp-surface)]" />
      </div>
    )
  }

  if (emptySkeleton) {
    return (
      <div className="my-3 flex flex-col gap-5 pb-2 pt-1">
        {[0, 1, 2].map((i) => (
          <div
            key={`sk-${i}`}
            className="box-border min-h-[96px] rounded-[24px] border border-dashed border-[var(--sp-stroke)] bg-[var(--sp-surface)]/40"
            style={{ marginTop: i === 0 ? 4 : undefined, marginBottom: i === 2 ? 4 : undefined }}
          />
        ))}
        <p className="mt-6 text-center text-[12px] leading-relaxed" style={{ color: 'var(--sp-muted)' }}>
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
      <ProgressChartsToolbar
        activeCount={activeCount}
        totalCount={items.length}
        showAll={showAll}
        setShowAll={setShowAll}
        muscle={muscle}
        setMuscle={setMuscle}
        sortBy={sortBy}
        setSortBy={setSortBy}
        muscleOpen={muscleOpen}
        setMuscleOpen={setMuscleOpen}
        sortOpen={sortOpen}
        setSortOpen={setSortOpen}
        accent={accent}
        es={es}
        MUSCLE_FILTERS={MUSCLE_FILTERS}
        SORT_OPTS={SORT_OPTS}
      />

      <div className="flex flex-col gap-4 px-1">
        {limited.map(({ ex, datos, datosAsc, pr, ultimo, pct, trend, name, kgSeries, atPR }) => {
          const isOpen = expandedEx === ex.id
          const hist = [...datos].reverse()

          return (
            <div
              key={ex.id}
              className="overflow-hidden rounded-[24px] border transition-colors"
              style={{
                borderColor: isOpen ? 'rgba(111, 143, 184, 0.72)' : 'rgba(90, 121, 160, 0.56)',
                background:
                  'linear-gradient(135deg, rgba(28, 47, 72, 0.95), rgba(12, 23, 37, 0.96))',
                boxSizing: 'border-box',
                boxShadow: isOpen
                  ? '0 18px 42px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255,255,255,0.08)'
                  : '0 10px 24px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255,255,255,0.06)',
              }}
            >
              <ExerciseProgressSummaryCard
                ex={ex}
                name={name}
                datos={datos}
                ultimo={ultimo}
                pct={pct}
                trend={trend}
                kgSeries={kgSeries}
                atPR={atPR}
                isOpen={isOpen}
                accent={accent}
                es={es}
                MiniSpark={MiniSpark}
                trendGlyph={trendGlyph}
                pctColor={pctColor}
                cn={cn}
                ChevronDown={ChevronDown}
                setExpandedEx={setExpandedEx}
              />

              {isOpen && (
                <ExerciseProgressDetails
                  ex={ex}
                  datosAsc={datosAsc}
                  hist={hist}
                  pr={pr}
                  metricTab={metricTab}
                  rangeKey={rangeKey}
                  setMetricTab={setMetricTab}
                  setRangeKey={setRangeKey}
                  accent={accent}
                  es={es}
                  DetailChart={DetailChart}
                  pctColor={pctColor}
                />
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
