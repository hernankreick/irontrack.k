import React from 'react';

export default function SectionCard({ title, subtitle, children, titleDanger, dangerTone }) {
  const shell = dangerTone
    ? 'border border-red-500/30 bg-red-500/5'
    : 'border border-white/[0.07] bg-[#0d1424]';
  const headBorder = dangerTone ? 'border-red-500/20' : 'border-white/[0.07]';
  return (
    <section
      className={`group w-full overflow-hidden rounded-2xl p-4 transition-shadow duration-300 ${shell} md:hover:-translate-y-0.5 md:hover:shadow-[0_12px_32px_rgba(0,0,0,0.35)]`}
    >
      {title ? (
        <div className={`mb-4 space-y-2 border-b ${headBorder} pb-4 lg:mb-5 lg:pb-5`}>
          <h3
            className={`text-xs font-semibold tracking-tight ${titleDanger ? 'text-red-400' : 'text-white'}`}
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '12px' }}
          >
            {title}
          </h3>
          {subtitle ? <p className="text-sm text-white/60">{subtitle}</p> : null}
        </div>
      ) : null}
      <div className="space-y-5 lg:space-y-6">{children}</div>
    </section>
  );
}
