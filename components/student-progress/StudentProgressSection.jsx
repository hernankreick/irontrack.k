import React from 'react'
import { Trophy, Image as ImageIcon, BarChart3, Settings, Calendar, Flame, TrendingUp } from 'lucide-react'
import IronTrackLogo from '@/components/IronTrackLogo.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProgressChartsPanel } from './ProgressChartsPanel.jsx'
import { ProgressSessionsPanel } from './ProgressSessionsPanel.jsx'
import { ProgressPhotosPanel } from './ProgressPhotosPanel.jsx'
import StatCard from './StatCard.jsx'
import {
  averageImprovementPercent,
  computeDayStreak,
  countPRsThisMonth,
} from './progressMetrics.js'

/**
 * Sección Progreso (alumno) — diseño mobile-first tema oscuro.
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
  onSettings,
  onAvatarClick,
  esEntrenador = false,
}) {
  const [sbData, setSbData] = React.useState([])
  const [loadingSb, setLoadingSb] = React.useState(true)

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

  const initials = (sessionData?.name || 'U').slice(0, 2).toUpperCase()

  return (
    <div
      className="student-progress-scope flex h-full min-h-screen flex-col overflow-y-auto bg-[#0d1117] text-[#f0f6ff]"
      style={{
        fontFamily:
          "'Geist Sans', 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
        ['--background']: '#0d1117',
        ['--foreground']: '#f0f6ff',
        ['--card']: '#131b2e',
        ['--border']: '#1e3050',
        ['--muted']: '#1a2540',
        ['--muted-foreground']: '#7c8db0',
        ['--primary']: '#2563eb',
        ['--success']: '#4ade80',
        ['--warning']: '#f59e0b',
      }}
    >
      <header className="shrink-0 bg-[#0d1117] px-6 pb-2 pt-[max(1rem,env(safe-area-inset-top,0px))]">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-4">
          <div className="min-w-0 shrink">
            <IronTrackLogo
              size={20}
              color="#2563eb"
              barColor="#4ade80"
              showBar
              mode={es ? 'MODO ALUMNO' : 'ATHLETE MODE'}
              modeColor="#4ade80"
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* Mismas formas que Plan / Ejercicios (App.jsx): settings = btn rounded-lg; avatar = 36×36 rounded 10px */}
            <button
              type="button"
              className="hov flex items-center justify-center rounded-lg border-0 bg-[#2D4057] p-2 text-white"
              aria-label={es ? 'Configuración' : 'Settings'}
              onClick={() => onSettings?.()}
            >
              <Settings className="h-[18px] w-[18px]" strokeWidth={2} />
            </button>
            <button
              type="button"
              className="hov flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border-0 bg-gradient-to-br from-[#1E3A5F] to-[#2563EB] text-[13px] font-extrabold leading-none text-white"
              onClick={() => onAvatarClick?.()}
              aria-label={es ? 'Menú usuario' : 'User menu'}
            >
              {initials}
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-0 mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 px-6 pb-28 pt-6">
        <div className="mx-auto mb-4 grid w-full max-w-md grid-cols-2 gap-4 sm:gap-5 lg:max-w-none lg:grid-cols-4 lg:gap-5">
          <StatCard
            icon={<Calendar className="h-6 w-6 text-[#2563eb]" strokeWidth={2.5} />}
            iconBg="bg-[#2563eb]/20"
            value={stats.totalSessions}
            label={es ? 'Sesiones' : 'Sessions'}
            sub={es ? 'Total registradas' : 'Total logged'}
          />
          <StatCard
            icon={<Trophy className="h-6 w-6 text-[#4ade80]" strokeWidth={2.5} />}
            iconBg="bg-[#4ade80]/20"
            value={stats.prsThisMonth}
            label={es ? 'PRs del mes' : 'PRs this month'}
            sub={es ? 'Nuevos récords' : 'New records'}
            highlight
          />
          <StatCard
            icon={<Flame className="h-6 w-6 text-[#2563eb]" strokeWidth={2.5} />}
            iconBg="bg-[#2563eb]/20"
            value={`${stats.streak} ${es ? 'días' : 'days'}`}
            label={es ? 'Racha' : 'Streak'}
            sub={es ? 'Seguidos' : 'In a row'}
          />
          <StatCard
            icon={<TrendingUp className="h-6 w-6 text-[#4ade80]" strokeWidth={2.5} />}
            iconBg="bg-[#4ade80]/20"
            value={`${stats.overall > 0 ? '+' : ''}${stats.overall}%`}
            label={es ? 'Mejora total' : 'Overall Δ'}
            sub={es ? 'Promedio' : 'Average'}
            highlight
          />
        </div>

        <div className="mt-2 mb-6 w-full">
        <Tabs defaultValue="graficos" className="flex w-full flex-col gap-5">
          <TabsList className="grid h-auto min-h-12 w-full grid-cols-3 gap-8 rounded-xl py-4">
            <TabsTrigger value="sesiones" className="gap-1.5 px-4 py-4">
              <Trophy className="h-4 w-4" />
              <span className="hidden sm:inline">{es ? 'Sesiones' : 'Sessions'}</span>
              <span className="sm:hidden">Ses.</span>
            </TabsTrigger>
            <TabsTrigger value="fotos" className="gap-1.5 px-4 py-4">
              <ImageIcon className="h-4 w-4" />
              {es ? 'Fotos' : 'Photos'}
            </TabsTrigger>
            <TabsTrigger value="graficos" className="gap-1.5 px-4 py-4">
              <BarChart3 className="h-4 w-4" />
              {es ? 'Gráficos' : 'Charts'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sesiones" className="sp-fade-in mt-2">
            <ProgressSessionsPanel
              sharedParam={sharedParam}
              sb={sb}
              EX={EX}
              es={es}
              sesiones={sesiones}
              expectedDaysPerWeek={expectedDaysPerWeek}
            />
          </TabsContent>

          <TabsContent value="fotos" className="sp-fade-in mt-2">
            <ProgressPhotosPanel sharedParam={sharedParam} sb={sb} es={es} esEntrenador={esEntrenador} />
          </TabsContent>

          <TabsContent value="graficos" className="sp-fade-in mt-2">
            <ProgressChartsPanel
              progress={progress}
              EX={EX}
              allEx={allEx}
              es={es}
              sbData={sbData}
              loadingSb={loadingSb}
            />
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </div>
  )
}
