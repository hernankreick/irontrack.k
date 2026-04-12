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
      <div className="mb-1 flex justify-between text-sm">
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

      <SectionCard premium title="Uso actual" subtitle="Respecto a los límites de tu plan.">
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-white/80">Consumo</h3>
            <UsageBar label="Alumnos" current={alumnosCount} max={limits.alumnos} color="#2563EB" />
            <UsageBar label="Rutinas activas" current={rutinasActivasCount} max={limits.rutinas} color="#60a5fa" />
            <UsageBar label="Sesiones mensuales (aprox.)" current={sesionesMesCount} max={limits.sesiones} color="#22C55E" />
          </div>
          <div className="border-t border-white/10 pt-6">
            <div
              className="inline-flex rounded-full px-3 py-1.5 text-xs font-bold"
              style={{ background: 'rgba(37,99,235,0.15)', color: '#93c5fd' }}
            >
              Próxima renovación: {renewal}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard premium title="Planes" subtitle="Elegí el que mejor se adapte a tu estudio.">
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-white/80">Comparar planes</h3>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {PLANS.map((p) => {
            const active = plan === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlan(p.id)}
                className="flex min-h-[44px] flex-col rounded-[20px] border p-5 text-left transition-transform"
                style={{
                  borderColor: active ? '#2563EB' : 'rgba(255,255,255,0.08)',
                  background: active ? 'rgba(37,99,235,0.1)' : '#0a0f1a',
                  boxShadow: active ? '0 0 0 1px rgba(37,99,235,0.4)' : 'none',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-lg font-black text-white">{p.name}</span>
                  {active ? (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: '#22C55E', color: '#052e16' }}>
                      Activo
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-black text-white">{p.price}</span>
                  <span style={{ color: '#64748b' }}>{p.period}</span>
                </div>
                <ul className="mt-3 space-y-1.5 text-sm" style={{ color: '#94a3b8' }}>
                  {p.features.map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>
              </button>
            );
          })}
          </div>
        </div>
      </SectionCard>

      <SectionCard premium title="Método de pago" subtitle="Datos enmascarados; expandí para simular cambio de tarjeta.">
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-white/80">Método de pago</h3>
            <div className="rounded-xl border p-5" style={{ borderColor: 'rgba(255,255,255,0.08)', background: '#0a0f1a' }}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>
                    Tarjeta
                  </div>
                  <div className="font-mono text-lg text-white">•••• •••• •••• 4242</div>
                  <div className="text-sm" style={{ color: '#64748b' }}>
                    Vence 12/28 · Visa
                  </div>
                </div>
                <Btn variant="ghost" small onClick={() => setCardOpen((o) => !o)}>
                  {cardOpen ? 'CERRAR' : 'CAMBIAR'}
                </Btn>
              </div>
              {cardOpen ? (
                <div className="mt-6 flex flex-col space-y-4 border-t border-white/10 pt-6">
                  <h3 className="text-sm font-medium text-white/80">Nueva tarjeta</h3>
                  <input
                    className="min-h-[44px] w-full rounded-lg border px-4 py-3 text-white outline-none"
                    style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}
                    placeholder="Número de tarjeta (demo)"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      className="min-h-[44px] rounded-lg border px-4 py-3 text-white outline-none"
                      style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}
                      placeholder="MM/AA"
                    />
                    <input
                      className="min-h-[44px] rounded-lg border px-4 py-3 text-white outline-none"
                      style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}
                      placeholder="CVC"
                    />
                  </div>
                  <div className="mt-8">
                    <Btn
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
