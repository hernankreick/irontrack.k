import React from 'react'
import { Medal } from 'lucide-react'
import { ProgressChartsPanel } from './ProgressChartsPanel.jsx'
import { ProgressSessionsPanel } from './ProgressSessionsPanel.jsx'
import { ProgressPhotosPanel } from './ProgressPhotosPanel.jsx'
import { StudentProgressEmptyState } from './StudentProgressEmptyState.jsx'
import { StudentProgressKpiStrip } from './StudentProgressKpiStrip.jsx'
import { StudentProgressWeeklyVolumeHero } from './StudentProgressWeeklyVolumeHero.jsx'
import { indiceEjerciciosPorTiempo } from '../../lib/metricas/tipoCarga.js'
import {
  variacionDeCargaPromedio,
  computeDayStreakDetail,
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
  /** D7.3: rutinas del alumno, para excluir del volumen los ejercicios por tiempo. */
  routines = [],
  initialSubView = 'main',
  hideBack = false,
}) {
  const [sbData, setSbData] = React.useState([])
  const [loadingSb, setLoadingSb] = React.useState(true)
  // D7.5: 'cargando' | 'completo' | 'incompleto' (fallo una pagina o se llego al tope) | 'error' (no se pudo leer el servidor)
  const [historialEstado, setHistorialEstado] = React.useState('cargando')
  const [subView, setSubView] = React.useState(initialSubView)
  const [seenAch, setSeenAch] = React.useState(() => {
    try {
      if (localStorage.getItem('irontrack_sp_ach_seen')) {
        localStorage.setItem('it_sp_ach_seen', localStorage.getItem('irontrack_sp_ach_seen'));
        localStorage.removeItem('irontrack_sp_ach_seen');
      }
      const raw = localStorage.getItem('it_sp_ach_seen')
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
      setHistorialEstado('completo')
      return
    }
    // D7.5: historial COMPLETO paginado; nada del alumno anterior mientras carga y una respuesta tardia de otro alumno no se aplica
    let vigente = true
    setSbData([])
    setLoadingSb(true)
    setHistorialEstado('cargando')
    const carga =
      sb && typeof sb.getHistorialProgreso === 'function'
        ? sb.getHistorialProgreso(alumnoId)
        : Promise.resolve(sb.getProgreso(alumnoId)).then((rows) => ({ rows, complete: Array.isArray(rows) }))
    carga
      .then((h) => {
        if (!vigente) return
        if (h && Array.isArray(h.rows)) setSbData(h.rows)
        setHistorialEstado(!h || !Array.isArray(h.rows) ? 'error' : h.complete ? 'completo' : 'incompleto')
        setLoadingSb(false)
      })
      .catch(() => {
        if (!vigente) return
        setHistorialEstado('error')
        setLoadingSb(false)
      })
    return () => {
      vigente = false
    }
  }, [sb, sessionData?.alumnoId, sharedParam])

  // D7.5: con un historial parcial los records viejos pueden faltar: los PR no se presentan como definitivos
  const historialParcial = historialEstado === 'incompleto' || historialEstado === 'error'

  // D7.4: ejercicios por tiempo (catalogo + snapshots de la rutina): ni volumen ni PR de carga, igual que el entrenador
  const indiceTiempo = React.useMemo(() => indiceEjerciciosPorTiempo([].concat(EX || [], allEx || []), routines || []), [EX, allEx, routines])

  const stats = React.useMemo(() => {
    return {
      totalSessions: sesiones?.length ?? 0,
      prsThisMonth: historialParcial ? null : countPRsThisMonth(allEx, EX, progress, sbData, { indiceTiempo }),
      // P0-5: racha vigente (hoy o ayer) separada de la ultima y de la mejor racha historicas
      streak: computeDayStreakDetail(sesiones, progress),
      // P0-4: variacion de carga, mejor serie de la primera vs la ultima sesion; con historial parcial la primera sesion puede faltar
      loadDelta: historialParcial ? null : variacionDeCargaPromedio(allEx, EX, progress, sbData, { indiceTiempo }).pct,
    }
  }, [sesiones, allEx, EX, progress, sbData, indiceTiempo, historialParcial])

  const volModel = React.useMemo(
    // D7.3: misma regla de volumen que el entrenador (sin ejercicios por tiempo: catalogo + snapshots de la rutina del alumno)
    () => buildWeeklyVolumeModel(progress, sbData, sesiones, undefined, { indiceTiempo }),
    [progress, sbData, sesiones, indiceTiempo]
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
        localStorage.setItem('it_sp_ach_seen', JSON.stringify([...n]))
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
        // logro conseguido = mejor racha historica (una racha ya terminada no lo quita)
        unlocked: stats.streak.mejor >= 7,
        progress: `${Math.min(stats.streak.mejor, 7)}/7`,
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
      sub: historialParcial ? (es ? 'Historial incompleto' : 'Incomplete history') : es ? 'Récords' : 'Records',
      pr: true,
    },
    {
      id: 'str',
      label: es ? 'Racha' : 'Streak',
      val: !hasData ? null : stats.streak.vigente > 0 ? stats.streak.vigente : null,
      // P0-5: sin racha vigente se informa la ultima como historica (nunca como actual)
      sub:
        hasData && stats.streak.vigente === 0 && stats.streak.ultima
          ? es
            ? `Última: ${stats.streak.ultima.dias} ${stats.streak.ultima.dias === 1 ? 'día' : 'días'}`
            : `Last: ${stats.streak.ultima.dias} ${stats.streak.ultima.dias === 1 ? 'day' : 'days'}`
          : es
            ? 'Días seguidos'
            : 'Days',
    },
    {
      id: 'avg',
      // P0-4: variacion de la mejor carga (1.a vs ultima sesion), no una «mejora» global; 0 % = estable, «—» = sin datos
      label: es ? 'Var. carga' : 'Load Δ',
      val: !hasData || stats.loadDelta == null ? null : `${stats.loadDelta > 0 ? '+' : ''}${stats.loadDelta}%`,
      sub: historialParcial ? (es ? 'Historial incompleto' : 'Incomplete history') : es ? '1.ª vs últ. sesión' : 'First vs last',
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
        {subView !== 'main' && !hideBack && (
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
            {!loadingSb && historialParcial ? (
              <div
                role="status"
                data-qa="historial-alumno-incompleto"
                className="mb-4 rounded-2xl border px-4 py-3 text-[13px] leading-snug"
                style={{ borderColor: 'rgba(250, 204, 21, 0.45)', background: 'rgba(250, 204, 21, 0.08)', color: '#FDE68A' }}
              >
                {historialEstado === 'error'
                  ? es
                    ? 'No se pudo cargar tu historial desde el servidor. Se muestran solo los registros de este dispositivo: récords y PRs pueden estar incompletos.'
                    : 'Your history could not be loaded from the server. Only this device’s records are shown: records and PRs may be incomplete.'
                  : es
                    ? 'No se pudo cargar todo tu historial (falta lo más antiguo). Récords y PRs pueden estar incompletos; volvé a abrir Progreso más tarde.'
                    : 'Your full history could not be loaded (the oldest part is missing). Records and PRs may be incomplete; reopen Progress later.'}
              </div>
            ) : null}
            {!loadingSb && !hasData ? (
              <StudentProgressEmptyState
                displayName={displayName}
                es={es}
                onRegistrarPrimerEntrenamiento={onRegistrarPrimerEntrenamiento}
              />
            ) : null}

            {!loadingSb && hasData ? (
              <StudentProgressWeeklyVolumeHero
                volModel={volModel}
                daysHit={daysHit}
                metaDays={metaDays}
                es={es}
                HeroSparkSvg={HeroSparkSvg}
                formatTonnes={formatTonnes}
              />
            ) : null}

            <StudentProgressKpiStrip kpiRows={kpiRows} />

            <ProgressChartsPanel
              progress={progress}
              EX={EX}
              allEx={allEx}
              es={es}
              sbData={sbData}
              loadingSb={loadingSb}
              emptySkeleton={!loadingSb && !hasData}
              indiceTiempo={indiceTiempo}
              historialParcial={historialParcial}
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
