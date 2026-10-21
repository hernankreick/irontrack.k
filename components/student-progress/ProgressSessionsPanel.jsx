import React from 'react'
import { CheckCircle2, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

export function ProgressSessionsPanel({ sharedParam, sb, EX, es, sesiones: sesionesProp, expectedDaysPerWeek }) {
  const expDays = Math.max(1, parseInt(expectedDaysPerWeek, 10) || 3)

  const [sesionesData, setSesionesData] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [openWeek, setOpenWeek] = React.useState(null)

  React.useEffect(() => {
    if (sesionesProp && sesionesProp.length > 0) {
      setSesionesData(sesionesProp)
      setLoading(false)
    }
  }, [sesionesProp])

  React.useEffect(() => {
    if (sesionesProp && sesionesProp.length > 0) return
    const load = async () => {
      try {
        const rutData = JSON.parse(atob(sharedParam))
        const alumnoId = rutData.alumnoId
        if (alumnoId) {
          const ses = await sb.getSesiones(alumnoId)
          setSesionesData(ses || [])
        }
      } catch {
        /* noop */
      }
      setLoading(false)
    }
    load()
  }, [sharedParam, sb, sesionesProp])

  React.useEffect(() => {
    if (!sesionesData.length) return
    const weeks = [...new Set(sesionesData.map((s) => Number(s.semana) || 0))]
    const maxW = Math.max(...weeks, 0)
    setOpenWeek((prev) => (prev != null ? prev : maxW))
  }, [sesionesData])

  const byWeek = React.useMemo(() => {
    const m = {}
    sesionesData.forEach((s) => {
      const w = Number(s.semana) || 0
      if (!m[w]) m[w] = []
      m[w].push(s)
    })
    Object.keys(m).forEach((w) => {
      m[w].sort((a, b) => {
        const da = new Date(a.created_at || a.fecha || 0).getTime()
        const db = new Date(b.created_at || b.fecha || 0).getTime()
        return db - da
      })
    })
    return m
  }, [sesionesData])

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        {[1, 2, 3].map((i) => (
          <div
            key={`sk-ses-${i}`}
            className="sk h-16 rounded-[12px]"
            style={{ border: '1px solid var(--sp-stroke, #2D4057)', background: 'var(--sp-surface, #1E2D40)' }}
          />
        ))}
      </div>
    )
  }

  if (sesionesData.length === 0) {
    return (
      <div className="py-10 text-center">
        <div className="mb-2 text-lg font-semibold" style={{ color: 'var(--sp-fg, #f3f4f6)' }}>
          {es ? 'Sin sesiones aún' : 'No sessions yet'}
        </div>
        <p className="text-sm" style={{ color: 'rgba(243,244,246,0.5)' }}>
          {es
            ? 'Completá tu primer entrenamiento para ver el historial aquí'
            : 'Complete your first workout to see your history here'}
        </p>
      </div>
    )
  }

  const weekKeys = Object.keys(byWeek)
    .map(Number)
    .sort((a, b) => b - a)

  return (
    <div className="flex flex-col gap-6">
      {weekKeys.map((wk) => {
        const list = byWeek[wk]
        const dayLabels = list.map((s) => (s.dia_label || '').trim()).filter(Boolean)
        const uniqueDays = dayLabels.length ? new Set(dayLabels).size : list.length
        const done = uniqueDays >= expDays
        const wkDisplay = list[0]?.semana != null && list[0]?.semana !== '' ? list[0].semana : wk
        const label = (es ? 'Semana ' : 'Week ') + wkDisplay
        const expanded = openWeek === wk
        const ratio = `${Math.min(uniqueDays, expDays)}/${expDays}`

        return (
          <div
            key={`hist-wk-${wk}`}
            className="overflow-hidden rounded-[12px] border border-[var(--sp-stroke,#2D4057)] bg-[var(--sp-surface,#1E2D40)]"
            style={{ borderColor: 'rgba(255,255,255,0.065)' }}
          >
            <button
              type="button"
              className={cn(
                'flex min-h-[48px] w-full items-center justify-between gap-2 px-4 py-4 text-left transition-colors',
                expanded ? 'bg-[var(--sp-surface-high,#162234)]' : ''
              )}
              style={{ background: expanded ? undefined : 'var(--sp-surface,#1E2D40)' }}
              onClick={() => setOpenWeek(expanded ? null : wk)}
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex transition-transform"
                  style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                >
                  <ChevronRight className="h-5 w-5" strokeWidth={2} style={{ color: '#3b82f6' }} />
                </span>
                <span className="text-base font-bold" style={{ color: 'var(--sp-fg,#f3f4f6)' }}>
                  {label}
                </span>
              </div>
              <Badge
                variant="default"
                className="shrink-0 border text-[11px]"
                style={{
                  borderColor: done ? 'rgba(59, 130, 246, 0.35)' : 'rgba(255,255,255,0.065)',
                  background: done ? 'rgba(59, 130, 246, 0.14)' : 'transparent',
                  color: '#3b82f6',
                }}
              >
                {ratio}
              </Badge>
            </button>

            {expanded && (
              <div
                className="flex flex-col gap-6 border-t px-2 py-4"
                style={{ borderColor: 'var(--sp-stroke, #2D4057)', background: 'rgba(15, 25, 35, 0.55)' }}
              >
                {list.map((s, i) => (
                  <div
                    key={s.id || `sesion-${wk}-${i}`}
                    className="rounded-[12px] border p-3"
                    style={{ borderColor: 'var(--sp-stroke, #2D4057)', background: 'var(--sp-surface,#1E2D40)' }}
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <CheckCircle2
                          className="mt-0.5 h-5 w-5 shrink-0"
                          strokeWidth={2}
                          style={{ color: '#3b82f6' }}
                        />
                        <div>
                          <div className="font-bold" style={{ color: 'var(--sp-fg,#f3f4f6)' }}>
                            {s.dia_label || (es ? 'Sesión' : 'Session')}
                          </div>
                          <div className="mt-0.5 text-xs" style={{ color: 'rgba(243,244,246,0.5)' }}>
                            {s.fecha}
                            {s.hora ? ` · ${s.hora}` : ''}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'rgba(243,244,246,0.45)' }}>
                      {s.rutina_nombre || ''}
                    </div>
                    {s.ejercicios && (
                      <div className="flex flex-wrap gap-1.5">
                        {s.ejercicios.split(',').map((exId) => {
                          const ex = EX.find((e) => e.id === exId.trim())
                          return ex ? (
                            <span
                              key={`${s.id}-${exId}`}
                              className="rounded-md px-2 py-1 text-[11px] font-semibold"
                              style={{
                                background: 'var(--sp-surface-high,#162234)',
                                color: 'rgba(243,244,246,0.55)',
                              }}
                            >
                              {es ? ex.name : ex.nameEn || ex.name}
                            </span>
                          ) : null
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
