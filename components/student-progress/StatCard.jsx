import React from 'react'
import { cn } from '@/lib/utils'

/**
 * Tarjeta de métrica (Sesiones, PRs del mes, Racha, Mejora) — alumno / progreso.
 */
export default function StatCard({ icon, iconBg, value, label, sub, highlight }) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-5 rounded-2xl border border-[#1e3050] bg-[#131b2e] !p-6 transition-colors hover:bg-[#162038]',
        highlight && 'animate-pulse-pr border-[#4ade80]/30 bg-[#4ade80]/5'
      )}
    >
      <div className="mb-4 w-full">
        <div
          className={cn(
            'inline-flex max-w-full items-center justify-center rounded-xl p-4',
            iconBg
          )}
        >
          {icon}
        </div>
      </div>
      <div className="text-2xl font-extrabold tabular-nums leading-tight text-[#f0f6ff]">{value}</div>
      <div className="w-full">
        <div className="text-[11px] font-bold uppercase tracking-wide text-[#f0f6ff]">{label}</div>
        <div className="mt-1 text-[11px] leading-snug text-[#7c8db0]">{sub}</div>
      </div>
    </div>
  )
}
