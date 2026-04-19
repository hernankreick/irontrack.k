import React from 'react';

/**
 * Panel de sección (Settings v2). Solo presentación: título, subtítulo, cuerpo.
 * Props estables: title, subtitle, children, titleDanger, dangerTone
 */
export default function SectionCard({ title, subtitle, children, titleDanger, dangerTone }) {
  const frame = dangerTone
    ? 'border border-red-500/30 bg-gradient-to-b from-red-950/40 to-[#0a0f18]'
    : 'border border-white/[0.07] bg-[#0b111c]/90';

  return (
    <section
      className={`relative w-full min-w-0 overflow-hidden rounded-2xl ${frame} shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset,0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-md`}
    >
      <div className="px-6 py-7 sm:px-8 sm:py-8 lg:px-10 lg:py-9">
        {title ? (
          <header className="mb-8 border-b border-white/[0.06] pb-7">
            {titleDanger || dangerTone ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-red-400/90">Acción sensible</p>
            ) : null}
            <h2
              className={`${titleDanger || dangerTone ? 'mt-2' : ''} text-lg font-semibold tracking-tight sm:text-xl ${titleDanger || dangerTone ? 'text-red-100' : 'text-white'}`}
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              {title}
            </h2>
            {subtitle ? <p className="mt-3 text-sm leading-relaxed text-white/50">{subtitle}</p> : null}
          </header>
        ) : null}
        <div className="flex min-w-0 flex-col gap-8 lg:gap-10">{children}</div>
      </div>
    </section>
  );
}
