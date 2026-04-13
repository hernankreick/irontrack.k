import React from 'react'
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ArrowRight,
  ArrowUp,
  ChevronDown,
  Filter,
  ArrowUpDown,
  Trophy,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  mergeSetsForExercise,
  exercisesWithData,
  exerciseMatchesMuscleFilter,
  parseProgressDate,
} from './progressMetrics.js'

const PRIMARY = '#2563eb'
const PR_ORANGE = '#f59e0b'
const TICK = '#7c8db0'

function shortDateLabel(fecha) {
  const d = parseProgressDate(fecha)
  if (!d) return String(fecha || '').slice(0, 8)
  try {
    return format(d, 'd MMM', { locale: es })
  } catch {
    return String(fecha).slice(0, 8)
  }
}

function ChartBlock({ datos, exId }) {
  const maxKg = Math.max(...datos.map((d) => d.kg), 0)
  const chartData = datos.map((d) => ({
    ...d,
    dateLabel: shortDateLabel(d.fecha),
    isPR: d.kg === maxKg && maxKg > 0,
  }))

  if (datos.length < 2) {
    return (
      <div className="py-6 text-center text-xs text-[#7c8db0]">Necesitás al menos 2 registros</div>
    )
  }

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const p = payload[0].payload
    return (
      <div
        className="rounded-lg border px-3 py-2 text-xs shadow-lg"
        style={{ background: '#131b2e', borderColor: '#1e3050', color: '#f0f6ff' }}
      >
        <div className="font-semibold text-[#7c8db0]">{p.fecha}</div>
        <div className="mt-1 font-bold text-[#f0f6ff]">
          {p.kg} kg × {p.reps}
        </div>
      </div>
    )
  }

  const gradId = `grad-${exId}`

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.35} />
              <stop offset="100%" stopColor={PRIMARY} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="dateLabel"
            tick={{ fill: TICK, fontSize: 10 }}
            axisLine={{ stroke: '#1e3050' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: TICK, fontSize: 10 }}
            axisLine={{ stroke: '#1e3050' }}
            tickLine={false}
            width={36}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#1e3050' }} />
          <Area
            type="monotone"
            dataKey="kg"
            stroke="transparent"
            fill={`url(#${gradId})`}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="kg"
            stroke={PRIMARY}
            strokeWidth={2}
            dot={(props) => {
              const { cx, cy, payload } = props
              const r = payload.isPR ? 6 : 4
              const fill = payload.isPR ? PR_ORANGE : PRIMARY
              return <circle cx={cx} cy={cy} r={r} fill={fill} stroke="#0d1117" strokeWidth={2} />
            }}
            activeDot={{ r: 7, stroke: '#0d1117', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

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
  { value: 'mejora', label: 'Mayor mejora' },
  { value: 'reciente', label: 'Más reciente' },
  { value: 'alfa', label: 'Alfabético' },
  { value: 'peso', label: 'Mayor peso' },
]

export function ProgressChartsPanel({ progress, EX, allEx, es, sbData, loadingSb }) {
  const [expandedEx, setExpandedEx] = React.useState(null)
  const [muscle, setMuscle] = React.useState('Todos')
  const [sortBy, setSortBy] = React.useState('mejora')

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
      const pct = datos.length >= 2 && primero.kg > 0 ? Math.round(((ultimo.kg - primero.kg) / primero.kg) * 100) : 0
      let trend = 'neutral'
      if (pct > 0) trend = 'up'
      if (pct < 0) trend = 'down'
      const lastDate = datos.map((d) => parseProgressDate(d.fecha)).filter(Boolean)
      const lastTs = lastDate.length ? Math.max(...lastDate.map((d) => d.getTime())) : 0
      return {
        ex: e,
        datos,
        pr,
        ultimo,
        pct,
        trend,
        name: es ? e.name : e.nameEn || e.name,
        lastTs,
        improvement: pct,
      }
    })
    const sorted = [...rows]
    if (sortBy === 'mejora') sorted.sort((a, b) => b.improvement - a.improvement)
    else if (sortBy === 'reciente') sorted.sort((a, b) => b.lastTs - a.lastTs)
    else if (sortBy === 'alfa') sorted.sort((a, b) => a.name.localeCompare(b.name))
    else if (sortBy === 'peso') sorted.sort((a, b) => b.pr - a.pr)
    return sorted
  }, [exConDatos, progress, sbData, es, sortBy])

  if (loadingSb) {
    return (
      <div className="space-y-2 py-4">
        <div className="sk h-20 rounded-xl" />
        <div className="sk h-20 rounded-xl" />
        <div className="sk h-20 rounded-xl" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="px-2 py-10 text-center">
        <div className="mb-3 text-4xl">📊</div>
        <div className="mb-2 text-lg font-bold text-[#f0f6ff]">{es ? 'Sin datos aún' : 'No data yet'}</div>
        <p className="text-sm leading-relaxed text-[#7c8db0]">
          {es ? 'Registrá sets con peso para ver tu progreso.' : 'Log sets with weight to see your progress.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#4ade80]">
          {es ? 'PROGRESO POR EJERCICIO' : 'PROGRESS BY EXERCISE'} ({items.length})
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={muscle} onValueChange={setMuscle}>
            <SelectTrigger className="h-11 w-full sm:w-[200px]">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Filter className="h-4 w-4 shrink-0 text-[#7c8db0]" />
                <SelectValue placeholder={es ? 'Grupo muscular' : 'Muscle group'} />
              </div>
            </SelectTrigger>
            <SelectContent>
              {MUSCLE_FILTERS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-11 w-full sm:w-[200px]">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <ArrowUpDown className="h-4 w-4 shrink-0 text-[#7c8db0]" />
                <SelectValue placeholder={es ? 'Ordenar' : 'Sort'} />
              </div>
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {items.map(({ ex, datos, pr, ultimo, pct, trend, name, improvement }) => {
        const isOpen = expandedEx === ex.id
        const strong = improvement >= 10
        const weightColor = strong ? '#4ade80' : '#06b6d4'

        return (
          <div
            key={ex.id}
            className={cn(
              'overflow-hidden rounded-xl border transition-colors',
              strong ? 'border-[#4ade80]/30 bg-[#4ade80]/5' : 'border-[#1e3050] bg-[#131b2e]'
            )}
          >
            <button
              type="button"
              className="flex w-full min-h-[44px] items-center gap-3 p-3 text-left"
              onClick={() => setExpandedEx(isOpen ? null : ex.id)}
            >
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                  trend === 'up' ? 'bg-[#4ade80]/20 text-[#4ade80]' : 'bg-[#1a2540] text-[#7c8db0]'
                )}
              >
                {trend === 'up' ? <ArrowUp className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-[#f0f6ff]">{name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[#7c8db0]">
                  <span>
                    {es ? 'Último' : 'Last'}: {ultimo.kg}kg × {ultimo.reps}
                  </span>
                  {datos.length >= 2 && (
                    <span className="font-bold text-[#4ade80]">
                      {pct > 0 ? '+' : ''}
                      {pct}%
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-xl font-black tabular-nums" style={{ color: weightColor }}>
                  {pr}kg
                </span>
                <Badge variant="pr" className="border-[#eab308]/50 text-[#eab308]">
                  PR
                </Badge>
              </div>
              <ChevronDown
                className={cn('h-5 w-5 shrink-0 text-[#7c8db0] transition-transform', isOpen && 'rotate-180')}
              />
            </button>

            {isOpen && (
              <div className="sp-slide-down border-t border-[#1e3050] px-3 pb-3 pt-2">
                <ChartBlock datos={datos} exId={ex.id} />
                <div className="mt-3">
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#7c8db0]">
                    {es ? 'HISTORIAL' : 'HISTORY'} ({datos.length})
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {[...datos].reverse().slice(0, 8).map((d, i) => {
                      const esPR = d.kg >= pr && pr > 0
                      return (
                        <div
                          key={`${ex.id}-h-${i}-${d.fecha}-${d.kg}`}
                          className={cn(
                            'flex items-center justify-between rounded-lg px-2 py-2 text-xs',
                            esPR
                              ? 'border border-[#f59e0b]/30 bg-[#f59e0b]/10 text-[#fbbf24]'
                              : 'bg-[#1a2540]/80 text-[#f0f6ff]'
                          )}
                        >
                          <span className={esPR ? 'text-[#fbbf24]/90' : 'text-[#7c8db0]'}>{d.fecha}</span>
                          <span className="flex items-center gap-2 font-bold">
                            {d.kg}kg × {d.reps}
                            {esPR && <Trophy className="h-3.5 w-3.5 text-[#f59e0b]" />}
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
  )
}
