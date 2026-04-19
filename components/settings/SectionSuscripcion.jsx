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
    <div className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3 text-sm">
        <span className="text-white/55">{label}</span>
        <span className="font-semibold tabular-nums text-white">
          {current} / {max}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
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

  const activePlan = PLANS.find((p) => p.id === plan) || PLANS[1];

  return (
    <div className="flex min-w-0 w-full max-w-none flex-col gap-10">
      <style>{`
        @keyframes itBarIn { from { width: 0; } }
        .it-bar-fill { animation: itBarIn 0.9s ease-out 1; }
      `}</style>

      <SectionCard title="Suscripción" subtitle="Un solo panel con estado, beneficios y facturación (demo).">
        <div className="rounded-2xl border border-white/[0.07] bg-gradient-to-br from-white/[0.05] to-transparent p-6 sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Estado actual</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">Plan {activePlan.name}</h3>
              <p className="mt-1 text-sm text-white/50">Uso aproximado frente a los límites del plan.</p>
            </div>
            <div className="inline-flex items-center rounded-full border border-blue-500/25 bg-blue-500/10 px-4 py-2 text-xs font-semibold text-blue-100">
              Renovación · {renewal}
            </div>
          </div>

          <div className="mt-8 grid min-w-0 grid-cols-1 gap-8 md:grid-cols-2 md:gap-10">
            <UsageBar label="Alumnos" current={alumnosCount} max={limits.alumnos} color="#3b82f6" />
            <UsageBar label="Rutinas activas" current={rutinasActivasCount} max={limits.rutinas} color="#60a5fa" />
          </div>

          <div className="mt-8 rounded-2xl border border-white/[0.06] bg-[#070b14]/70 p-5 sm:p-6">
            <UsageBar label="Sesiones mensuales (aprox.)" current={sesionesMesCount} max={limits.sesiones} color="#22c55e" />
          </div>
        </div>

        <div className="h-px w-full bg-white/[0.06]" />

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Beneficios</p>
          <p className="mt-2 text-sm text-white/50">Compará planes y elegí el que mejor encaje (demo).</p>
          <div className="mt-6 grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-3">
            {PLANS.map((p) => {
              const active = plan === p.id;
              const ring =
                p.id === 'free'
                  ? 'border-slate-400/50 bg-slate-500/10'
                  : p.id === 'pro'
                    ? 'border-blue-500/60 bg-blue-500/10'
                    : 'border-emerald-500/55 bg-emerald-500/10';
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlan(p.id)}
                  className={`flex min-h-[220px] flex-col rounded-2xl border p-6 text-left transition-all ${
                    active ? `${ring} shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset]` : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-lg font-semibold text-white">{p.name}</span>
                    {active ? (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-200">
                        Activo
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-5 flex items-baseline gap-1">
                    <span className="text-3xl font-black text-white">{p.price}</span>
                    <span className="text-sm text-white/45">{p.period}</span>
                  </div>
                  <ul className="mt-6 space-y-2.5 text-sm text-white/55">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <svg className="mt-0.5 size-4 shrink-0 text-emerald-400/90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
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

        <div className="rounded-2xl border border-blue-500/25 bg-gradient-to-r from-blue-500/15 via-blue-500/5 to-transparent p-6 sm:flex sm:items-center sm:justify-between sm:gap-8">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">CTA principal (demo)</p>
            <p className="mt-1 text-sm text-white/55">
              Plan seleccionado: <span className="font-semibold text-white">{activePlan.name}</span>. El flujo de checkout se conectará después.
            </p>
          </div>
          <div className="mt-4 shrink-0 sm:mt-0">
            <Btn className="h-12 w-full px-6 text-[12px] sm:w-auto" type="button" onClick={() => setCardOpen(true)}>
              GESTIONAR COBRO
            </Btn>
          </div>
        </div>

        <div className="h-px w-full bg-white/[0.06]" />

        <div className="rounded-2xl border border-white/[0.07] bg-[#070b14]/60 p-6 sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">Método de pago</p>
              <p className="mt-1 text-sm text-white/45">Datos enmascarados; expandí para simular el cambio de tarjeta.</p>
            </div>
            <Btn variant="ghost" small className="h-11 w-full shrink-0 sm:w-auto" onClick={() => setCardOpen((o) => !o)}>
              {cardOpen ? 'Cerrar' : 'Cambiar tarjeta'}
            </Btn>
          </div>
          <div className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 sm:p-6">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">Tarjeta</div>
            <div className="mt-2 font-mono text-lg text-white">•••• •••• •••• 4242</div>
            <div className="mt-1 text-sm text-white/45">Vence 12/28 · Visa</div>
          </div>
          {cardOpen ? (
            <div className="mt-6 space-y-5 border-t border-white/[0.07] pt-6">
              <p className="text-sm font-semibold text-white">Nueva tarjeta (demo)</p>
              <input
                className="h-12 w-full rounded-xl border border-white/[0.09] bg-[#070b14] px-4 text-white outline-none placeholder:text-white/35 focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/15"
                placeholder="Número de tarjeta (demo)"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="h-12 w-full rounded-xl border border-white/[0.09] bg-[#070b14] px-4 text-white outline-none placeholder:text-white/35 focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/15"
                  placeholder="MM/AA"
                />
                <input
                  className="h-12 w-full rounded-xl border border-white/[0.09] bg-[#070b14] px-4 text-white outline-none placeholder:text-white/35 focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/15"
                  placeholder="CVC"
                />
              </div>
              <Btn
                className="h-12 w-full text-[12px] sm:w-auto"
                onClick={() => {
                  setCardOpen(false);
                }}
              >
                GUARDAR TARJETA (DEMO)
              </Btn>
            </div>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}
