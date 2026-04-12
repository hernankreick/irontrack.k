import React, { useMemo, useState } from 'react';
import SectionCard from './ui/SectionCard.jsx';
import Btn from './ui/Btn.jsx';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: '/mes',
    features: ['Hasta 5 alumnos', 'Rutinas básicas', 'Soporte por email'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$19',
    period: '/mes',
    features: ['Alumnos ilimitados', 'Rutinas avanzadas', 'Chat integrado', 'Prioridad soporte'],
  },
  {
    id: 'business',
    name: 'Business',
    price: '$49',
    period: '/mes',
    features: ['Todo Pro', 'Marca blanca', 'API & exportaciones', 'Account manager'],
  },
];

function UsageBar({ label, current, max, color }) {
  const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;
  return (
    <div>
      <div className="mb-3 flex justify-between text-sm">
        <span style={{ color: '#94a3b8' }}>{label}</span>
        <span className="font-bold text-white">
          {current} / {max}
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div
          className="it-bar-fill h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: color,
            transition: 'width 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      </div>
    </div>
  );
}

export default function SectionSuscripcion({ alumnosCount, rutinasActivasCount, sesionesMesCount }) {
  const [plan, setPlan] = useState('pro');
  const [cardOpen, setCardOpen] = useState(false);

  const limits = useMemo(
    () => ({
      alumnos: 50,
      rutinas: 40,
      sesiones: 200,
    }),
    []
  );

  const renewal = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
  }, []);

  return (
    <div className="flex flex-col space-y-8">
      <style>{`
        @keyframes itBarIn {
          from { width: 0; }
        }
        .it-bar-fill { animation: itBarIn 0.9s ease-out 1; }
      `}</style>

      <SectionCard title="Uso actual" subtitle="Respecto a los límites de tu plan.">
        <div className="space-y-5">
          <div>
            <h3 className="mb-3 text-lg font-semibold text-white">Consumo</h3>
            <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-2">
              <UsageBar label="Alumnos" current={alumnosCount} max={limits.alumnos} color="#2563EB" />
              <UsageBar label="Rutinas activas" current={rutinasActivasCount} max={limits.rutinas} color="#60a5fa" />
            </div>
          </div>
          <div className="border-t border-white/10 pt-5">
            <div className="space-y-5 rounded-2xl bg-white/[0.02] p-6">
              <UsageBar label="Sesiones mensuales (aprox.)" current={sesionesMesCount} max={limits.sesiones} color="#22C55E" />
            </div>
          </div>
          <div className="border-t border-white/10 pt-5">
            <div
              className="inline-flex rounded-full px-3 py-1.5 text-xs font-bold"
              style={{ background: 'rgba(37,99,235,0.15)', color: '#93c5fd' }}
            >
              Próxima renovación: {renewal}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Planes" subtitle="Elegí el que mejor se adapte a tu estudio.">
        <div className="space-y-5">
          <h3 className="mb-6 text-lg font-semibold text-white">Comparar planes</h3>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {PLANS.map((p) => {
            const active = plan === p.id;
            const activeBorder =
              p.id === 'free'
                ? 'border-slate-400 bg-slate-500/10 shadow-[0_0_0_1px_rgba(148,163,184,0.45)]'
                : p.id === 'pro'
                  ? 'border-[#2563EB] bg-blue-500/10 shadow-[0_0_0_1px_rgba(37,99,235,0.4)]'
                  : 'border-[#22C55E] bg-emerald-500/10 shadow-[0_0_0_1px_rgba(34,197,94,0.4)]';
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlan(p.id)}
                className={`flex h-auto min-h-[36px] flex-col rounded-2xl border p-7 text-left transition-all ${
                  active ? activeBorder : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
              >
                <div className="mb-6 flex items-center justify-between gap-2">
                  <span className="text-xl font-black text-white">{p.name}</span>
                  {active ? (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: '#22C55E', color: '#052e16' }}>
                      ACTIVO
                    </span>
                  ) : null}
                </div>
                <div className="mb-6 flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white">{p.price}</span>
                  <span className="text-white/50">{p.period}</span>
                </div>
                <ul className="mb-8 space-y-3 text-sm text-white/50">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <svg className="mt-0.5 size-5 shrink-0 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Método de pago" subtitle="Datos enmascarados; expandí para simular cambio de tarjeta.">
        <div className="space-y-5">
          <div className="space-y-5">
            <h3 className="mb-6 text-lg font-semibold text-white">Método de pago</h3>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">
              <div className="mb-6 flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-white/80">Tarjeta</div>
                  <div className="font-mono text-lg text-white">•••• •••• •••• 4242</div>
                  <div className="mt-1 text-sm text-white/50">
                    Vence 12/28 · Visa
                  </div>
                </div>
                <Btn variant="ghost" small className="h-11 sm:shrink-0" onClick={() => setCardOpen((o) => !o)}>
                  {cardOpen ? 'CERRAR' : 'CAMBIAR'}
                </Btn>
              </div>
              {cardOpen ? (
                <div className="mt-6 flex flex-col space-y-5 border-t border-white/10 pt-5">
                  <h3 className="mb-6 text-lg font-semibold text-white">Nueva tarjeta</h3>
                  <div className="space-y-5">
                    <input
                      className="h-11 min-h-[44px] w-full rounded-lg border border-white/10 bg-white/5 px-4 text-white outline-none placeholder:text-white/40 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="Número de tarjeta (demo)"
                    />
                  </div>
                  <div className="space-y-5 border-t border-white/10 pt-5">
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        className="h-11 min-h-[44px] rounded-lg border border-white/10 bg-white/5 px-4 text-white outline-none placeholder:text-white/40 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        placeholder="MM/AA"
                      />
                      <input
                        className="h-11 min-h-[44px] rounded-lg border border-white/10 bg-white/5 px-4 text-white outline-none placeholder:text-white/40 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        placeholder="CVC"
                      />
                    </div>
                  </div>
                  <div className="mt-8">
                    <Btn
                      className="h-11 w-full sm:w-auto"
                      onClick={() => {
                        setCardOpen(false);
                      }}
                    >
                      GUARDAR TARJETA (DEMO)
                    </Btn>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
