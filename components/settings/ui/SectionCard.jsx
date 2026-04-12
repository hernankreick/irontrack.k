import React from 'react';

export default function SectionCard({ title, subtitle, children, premium }) {
  const pad = premium ? 'p-7 md:p-8' : 'p-6 md:p-7';
  return (
    <section
      className={`group w-full overflow-hidden rounded-[22px] border ${pad} transition-all duration-300 md:hover:-translate-y-0.5 md:hover:shadow-[0_12px_32px_rgba(0,0,0,0.35)]`}
      style={{
        background: '#0d1424',
        borderColor: 'rgba(255,255,255,0.08)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
      }}
    >
      {title ? (
        <div className="mb-6 border-b pb-4" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <h3
            className="text-xl font-semibold tracking-tight text-white md:text-2xl"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            {title}
          </h3>
          {subtitle ? <p className="mt-2 text-sm text-white/80">{subtitle}</p> : null}
        </div>
      ) : null}
      <div className="space-y-5">{children}</div>
    </section>
  );
}
