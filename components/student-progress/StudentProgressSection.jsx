import React from 'react'
import { Medal } from 'lucide-react'
import { ProgressChartsPanel } from './ProgressChartsPanel.jsx'
import { ProgressSessionsPanel } from './ProgressSessionsPanel.jsx'
import { ProgressPhotosPanel } from './ProgressPhotosPanel.jsx'
import {
  averageImprovementPercent,
  computeDayStreak,
  countPRsThisMonth,
  buildWeeklyVolumeModel,
  hasAnyTrainingData,
  trainingDaysThisWeek,
} from './progressMetrics.js'

function HeroSparkSvg({ series, accent }) {
  const w = 108
  const h = 56
  const pad = 4
  const vals = series.map((v) => Number(v) || 0)
  if (!vals.length) return <svg width={w} height={h} aria-hidden />
  const mx = Math.max(...vals, 1e-9)
  const denom = vals.length > 1 ? vals.length - 1 : 1
  const coords = vals.map((v, i) => {
    const x = pad + (i / denom) * (w - pad * 2)
    const y = pad + (1 - v / mx) * (h - pad * 2)
    return [x, y]
  })
  const lineJoined = coords.map(([x, y]) => `${x},${y}`).join(' ')
  const bottom = h - pad
  const firstX = coords[0][0]
  const lastX = coords[coords.length - 1][0]
  const areaPath = `M ${firstX},${bottom} L ${coords.map(([x, y]) => `${x},${y}`).join(' L ')} L ${lastX},${bottom} Z`
  const [lx, ly] = coords[coords.length - 1]

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0 overflow-visible" aria-hidden>
      <defs>
        <linearGradient id="hero-sp-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity={0.35} />
          <stop offset="100%" stopColor={accent} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#hero-sp-fill)" stroke="none" />
      <polyline
        fill="none"
        stroke={accent}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={lineJoined}
      />
      <circle cx={lx} cy={ly} r={3} fill={accent} stroke="#0F1923" strokeWidth={1.25} />
    </svg>
  )
}

function formatTonnes(n) {
  if (n == null || Number.isNaN(n)) return '—'
  const v = Math.round(n * 100) / 100
  return v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

/**
 * Sección Progreso (alumno) — editorial oscuro, tokens locales.
 */
export default function StudentProgressSection({
  progress,
  EX,
  allEx,
  sesiones,
  sessionData,
  sb,
  sharedParam,
  es,
  expectedDaysPerWeek,
  onRegistrarPrimerEntrenamiento,
  esEntrenador = false,
}) {
  const [sbData, setSbData] = React.useState([])
  const [loadingSb, setLoadingSb] = React.useState(true)
  const [subView, setSubView] = React.useState('main')
  const [seenAch, setSeenAch] = React.useState(() => {
    try {
      const raw = localStorage.getItem('irontrack_sp_ach_seen')
      const j = JSON.parse(raw || '[]')
      return new Set(Array.isArray(j) ? j : [])
    } catch {
      return new Set()
    }
  })

  React.useEffect(() => {
    const alumnoId =
      sessionData?.alumnoId ||
      (sharedParam
        ? (() => {
            try {
              return JSON.parse(atob(sharedParam)).alumnoId
            } catch {
              return null
            }
          })()
        : null)
    if (!alumnoId) {
      setLoadingSb(false)
      return
    }
    sb.getProgreso(alumnoId)
      .then((prog) => {
        if (prog) setSbData(prog)
        setLoadingSb(false)
      })
      .catch(() => setLoadingSb(false))
  }, [sb, sessionData?.alumnoId, sharedParam])

  const stats = React.useMemo(() => {
    return {
      totalSessions: sesiones?.length ?? 0,
      prsThisMonth: countPRsThisMonth(allEx, EX, progress, sbData),
      streak: computeDayStreak(sesiones, progress),
      overall: averageImprovementPercent(allEx, EX, progress, sbData),
    }
  }, [sesiones, allEx, EX, progress, sbData])

  const volModel = React.useMemo(
    () => buildWeeklyVolumeModel(progress, sbData, sesiones),
    [progress, sbData, sesiones]
  )

  const hasData = React.useMemo(
    () => hasAnyTrainingData(sesiones, progress, sbData),
    [sesiones, progress, sbData]
  )

  const metaDays = Math.max(1, parseInt(expectedDaysPerWeek, 10) || 3)
  const daysHit = trainingDaysThisWeek(sesiones, progress, sbData)

  const displayName = (sessionData?.name || '').trim() || (es ? 'Atleta' : 'Athlete')

  const markAchSeen = (id) => {
    setSeenAch((prev) => {
      const n = new Set(prev)
      n.add(id)
      try {
        localStorage.setItem('irontrack_sp_ach_seen', JSON.stringify([...n]))
      } catch {
        /* noop */
      }
      return n
    })
  }

  const achievements = React.useMemo(() => {
    const list = [
      {
        id: 'first_log',
        title: es ? 'Primera serie' : 'First set',
        sub: es ? 'Registrá tu primer entrenamiento' : 'Log your first workout',
        unlocked: stats.totalSessions > 0 || hasData,
        progress: hasData ? '1/1' : '0/1',
      },
      {
        id: 'week_volume',
        title: es ? 'Volumen constante' : 'Steady volume',
        sub: es ? 'Completá 3 días en una semana' : 'Train 3 days in one week',
        unlocked: daysHit >= 3,
        progress: `${Math.min(daysHit, 3)}/3`,
      },
      {
        id: 'pr_month',
        title: es ? 'Mes de PRs' : 'PR month',
        sub: es ? 'Conseguí un PR este mes' : 'Hit a PR this month',
        unlocked: stats.prsThisMonth > 0,
        progress: `${Math.min(stats.prsThisMonth, 1)}/1`,
      },
      {
        id: 'streak7',
        title: es ? 'Racha sólida' : 'Solid streak',
        sub: es ? '7 días seguidos entrenando' : '7-day training streak',
        unlocked: stats.streak >= 7,
        progress: `${Math.min(stats.streak, 7)}/7`,
      },
      {
        id: 'sessions20',
        title: es ? 'Constancia' : 'Consistency',
        sub: es ? '20 sesiones registradas' : '20 logged sessions',
        unlocked: stats.totalSessions >= 20,
        progress: `${Math.min(stats.totalSessions, 20)}/20`,
      },
    ]
    return list
  }, [es, stats, daysHit, hasData])

  const kpiRows = [
    {
      id: 'ses',
      label: es ? 'Sesiones' : 'Sessions',
      val: !hasData ? null : stats.totalSessions > 0 ? stats.totalSessions : null,
      sub: es ? 'Total' : 'Total',
    },
    {
      id: 'pr',
      label: es ? 'PRs del mes' : 'PRs (mo)',
      val: !hasData ? null : stats.prsThisMonth > 0 ? stats.prsThisMonth : null,
      sub: es ? 'Récords' : 'Records',
      pr: true,
    },
    {
      id: 'str',
      label: es ? 'Racha' : 'Streak',
      val: !hasData ? null : stats.streak > 0 ? stats.streak : null,
      sub: es ? 'Días seguidos' : 'Days',
    },
    {
      id: 'avg',
      label: es ? 'Mejora Δ' : 'Avg Δ',
      val:
        !hasData || stats.overall === 0
          ? null
          : `${stats.overall > 0 ? '+' : ''}${stats.overall}%`,
      sub: es ? 'Promedio' : 'Avg',
    },
  ]

  /** Mismos tokens que App.jsx modo oscuro: bg / bgCard / bgSub / border / accent logo */
  const shellStyle = {
    fontFamily: "Inter, sans-serif",
    boxSizing: 'border-box',
    ['--sp-bg']: '#0B1220',
    ['--sp-surface']: '#14243A',
    ['--sp-surface-high']: '#1B314B',
    ['--sp-stroke']: 'rgba(91, 121, 160, 0.56)',
    ['--sp-fg']: '#ffffff',
    ['--sp-muted']: '#94A3B8',
    ['--sp-accent']: '#2563EB',
    ['--sp-pr']: '#F59E0B',
    ['--sp-danger']: '#EF4444',
    ['--page-gutter']: 'clamp(16px, 4.4vw, 22px)',
  }

  return (
    <div
      className="student-progress-scope flex w-full flex-col overflow-x-hidden text-white sp-scroll-hide"
      style={{
        ...shellStyle,
        background: 'var(--sp-bg)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <div
        className="relative z-0 mx-auto flex w-full max-w-[32rem] flex-col gap-9 pb-[max(11rem,calc(env(safe-area-inset-bottom, 0px) + 148px))] pt-5"
        style={{ paddingInline: 'var(--page-gutter)', boxSizing: 'border-box' }}
      >
        {subView !== 'main' && (
          <button
            type="button"
            className="mb-1 w-fit border-0 bg-transparent text-[12px] font-semibold"
            style={{ color: 'var(--sp-accent)' }}
            onClick={() => setSubView('main')}
          >
            ← {es ? 'Volver' : 'Back'}
          </button>
        )}

        {subView === 'sessions' && (
          <ProgressSessionsPanel
            sharedParam={sharedParam}
            sb={sb}
            EX={EX}
            es={es}
            sesiones={sesiones}
            expectedDaysPerWeek={expectedDaysPerWeek}
          />
        )}

        {subView === 'photos' && (
          <ProgressPhotosPanel sharedParam={sharedParam} sb={sb} es={es} esEntrenador={esEntrenador} />
        )}

        {subView === 'main' && (
          <>
            {!loadingSb && !hasData ? (
              <div
                className="rounded-[24px] border"
                style={{
                  padding: '20px 18px',
                  borderColor: 'var(--sp-stroke)',
                  boxSizing: 'border-box',
                  overflow: 'visible',
                  wordBreak: 'normal',
                  background:
                    'linear-gradient(145deg, rgba(59, 130, 246, 0.12), var(--sp-surface))',
                }}
              >
                <div
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: 20,
                    fontWeight: 700,
                    lineHeight: 1.15,
                    marginBottom: 10,
                    wordBreak: 'normal',
                  }}
                >
                  {es ? `Empecemos fuerte, ${displayName}.` : `Let's start strong, ${displayName}.`}
                </div>
                <p className="text-[13px]" style={{ color: 'var(--sp-muted)', lineHeight: 1.45, margin: 0 }}>
                  {es
                    ? 'Tu volumen y tus PRs aparecerán acá cuando registres entrenos. Empezá por una sesión completa.'
                    : 'Volume and PRs show up here once you log workouts. Start with one full session.'}
                </p>
                <button
                  type="button"
                  className="mt-4 w-full rounded-full text-[13px] font-semibold transition-colors"
                  style={{
                    minHeight: 52,
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    whiteSpace: 'normal',
                    boxSizing: 'border-box',
                    background: 'rgba(59, 130, 246, 0.18)',
                    color: 'var(--sp-accent)',
                    border: '1px solid rgba(59, 130, 246, 0.35)',
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.26)'
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.18)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.18)'
                  }}
                  onClick={() => onRegistrarPrimerEntrenamiento?.()}
                >
                  {es ? 'Registrar primer entrenamiento' : 'Log first workout'}
                </button>
              </div>
            ) : null}

            {!loadingSb && hasData ? (
              <section className="mb-1">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--sp-muted)' }}>
                  {es ? 'Volumen de la semana' : 'Weekly volume'}
                </div>
                <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
                  <div className="flex min-w-0 flex-wrap items-end gap-2">
                    <span
                      className="num leading-none tabular-nums"
                      style={{
                        fontFamily: "'Barlow Condensed',sans-serif",
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
                        fontFamily: "'Barlow Condensed',sans-serif",
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
            ) : null}

            {/* KPI strip */}
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
                      fontFamily: "'Barlow Condensed',sans-serif",
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

            <ProgressChartsPanel
              progress={progress}
              EX={EX}
              allEx={allEx}
              es={es}
              sbData={sbData}
              loadingSb={loadingSb}
              emptySkeleton={!loadingSb && !hasData}
            />

            {/* Achievements */}
            <div className="mt-5">
              <div className="mb-4 text-[12px] font-semibold uppercase tracking-[0.22em]" style={{ color: 'rgba(203,213,225,0.78)' }}>
                {es ? 'Logros' : 'Achievements'}
              </div>
              <div className="-mx-2 flex gap-4 overflow-x-auto px-2 pb-5 sp-scroll-hide">
                {achievements.map((a) => {
                  const locked = !a.unlocked
                  const showDot = a.unlocked && !seenAch.has(a.id)
                  return (
                    <button
                      key={a.id}
                      type="button"
                      className="relative flex min-h-[132px] w-[250px] shrink-0 flex-col justify-between gap-4 rounded-[24px] border text-left transition-opacity"
                      style={{
                        boxSizing: 'border-box',
                        padding: '20px 18px',
                        wordBreak: 'normal',
                        borderColor: locked ? 'rgba(111,143,184,0.44)' : 'rgba(245,158,11,0.72)',
                        borderStyle: 'solid',
                        background: locked
                          ? 'linear-gradient(135deg, rgba(28,47,72,0.82), rgba(11,22,36,0.88))'
                          : 'linear-gradient(135deg, rgba(245,158,11,0.16), rgba(22,35,52,0.94))',
                        opacity: locked ? 0.82 : 1,
                        boxShadow: locked
                          ? 'inset 0 1px 0 rgba(255,255,255,0.06)'
                          : '0 12px 28px rgba(245,158,11,0.08), inset 0 1px 0 rgba(255,255,255,0.08)',
                      }}
                      onClick={() => {
                        if (a.unlocked) markAchSeen(a.id)
                      }}
                    >
                      {showDot ? (
                        <span
                          className="absolute right-4 top-4 h-2.5 w-2.5 rounded-full"
                          style={{ background: 'var(--sp-pr)' }}
                        />
                      ) : null}
                      <div className="flex min-w-0 items-center gap-4">
                        <span
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border"
                          style={{
                            borderColor: locked ? 'rgba(148,163,184,0.24)' : 'rgba(245,158,11,0.5)',
                            background: locked ? 'rgba(7,16,28,0.48)' : 'rgba(245,158,11,0.16)',
                          }}
                        >
                          <Medal
                            className="h-5 w-5"
                            strokeWidth={2}
                            style={{ color: locked ? 'var(--sp-muted)' : 'var(--sp-pr)' }}
                          />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[15px] font-semibold" style={{ color: 'var(--sp-fg)', lineHeight: 1.15, marginBottom: 6, wordBreak: 'normal' }}>
                            {a.title}
                          </div>
                          <div className="mt-1.5 text-[13px]" style={{ color: locked ? 'var(--sp-muted)' : 'rgba(226,232,240,0.82)', lineHeight: 1.45 }}>
                            {locked ? a.sub : es ? 'Desbloqueado' : 'Unlocked'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: locked ? 'var(--sp-muted)' : 'var(--sp-pr)' }}>
                          {locked ? (es ? 'En progreso' : 'In progress') : es ? 'Logro activo' : 'Active'}
                        </div>
                        <div
                          className="inline-flex shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold tabular-nums"
                          style={{
                            color: locked ? 'var(--sp-muted)' : 'var(--sp-pr)',
                            background: locked ? 'rgba(148,163,184,0.09)' : 'rgba(245,158,11,0.14)',
                            border: `1px solid ${locked ? 'rgba(148,163,184,0.16)' : 'rgba(245,158,11,0.28)'}`,
                          }}
                        >
                          {a.unlocked ? (es ? 'Listo' : 'Done') : a.progress}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Links sesiones / fotos */}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 border-t pt-6 text-[13px] font-semibold" style={{ borderColor: 'rgba(90,121,160,0.42)' }}>
              <button
                type="button"
                className="border-0 bg-transparent p-0"
                style={{ color: 'var(--sp-accent)' }}
                onClick={() => setSubView('sessions')}
              >
                {es ? 'Historial de sesiones' : 'Session history'}
              </button>
              <span className="h-4 w-px" style={{ background: 'rgba(148,163,184,0.28)' }} />
              <button
                type="button"
                className="border-0 bg-transparent p-0"
                style={{ color: 'var(--sp-accent)' }}
                onClick={() => setSubView('photos')}
              >
                {es ? 'Fotos de progreso' : 'Progress photos'}
              </button>
            </div>

          </>
        )}
      </div>
    </div>
  )
}
