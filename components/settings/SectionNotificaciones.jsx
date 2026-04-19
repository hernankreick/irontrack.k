import React, { useEffect, useMemo, useState } from 'react';
import SectionCard from './ui/SectionCard.jsx';
import Toggle from './ui/Toggle.jsx';

const LS = 'it_notif_prefs';

const ITEMS = [
  { id: 'nuevo_alumno', title: 'Nuevos alumnos', desc: 'Cuando un alumno se da de alta o acepta invitación.', icon: 'user' },
  { id: 'mensaje', title: 'Mensajes', desc: 'Mensajes nuevos en el chat.', icon: 'message' },
  { id: 'pago', title: 'Pagos y vencimientos', desc: 'Recordatorios de cuotas o estados de pago.', icon: 'card' },
  { id: 'rutina', title: 'Rutinas', desc: 'Cambios en rutinas asignadas o completadas.', icon: 'clipboard' },
  { id: 'sesion', title: 'Sesiones', desc: 'Resumen cuando un alumno registra entreno.', icon: 'activity' },
  { id: 'sistema', title: 'Sistema', desc: 'Actualizaciones y avisos de la plataforma.', icon: 'settings' },
];

function NotifTypeIcon({ name }) {
  const cls = 'size-11 shrink-0 text-sky-400/90';
  switch (name) {
    case 'user':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'message':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case 'card':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
        </svg>
      );
    case 'clipboard':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <rect x="8" y="2" width="8" height="4" rx="1" />
        </svg>
      );
    case 'activity':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      );
    case 'settings':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      );
    default:
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
  }
}

function load() {
  try {
    const raw = localStorage.getItem(LS);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function save(data) {
  try {
    localStorage.setItem(LS, JSON.stringify(data));
  } catch (e) {}
}

export default function SectionNotificaciones() {
  const [master, setMaster] = useState(true);
  const [switches, setSwitches] = useState(() => {
    const o = {};
    ITEMS.forEach((i) => {
      o[i.id] = true;
    });
    return o;
  });
  const [quietOn, setQuietOn] = useState(false);
  const [quietFrom, setQuietFrom] = useState('22:00');
  const [quietTo, setQuietTo] = useState('07:00');

  useEffect(() => {
    const p = load();
    if (!p) return;
    if (typeof p.master === 'boolean') setMaster(p.master);
    if (p.items && typeof p.items === 'object') setSwitches((prev) => ({ ...prev, ...p.items }));
    if (p.quiet) {
      setQuietOn(!!p.quiet.enabled);
      if (p.quiet.from) setQuietFrom(p.quiet.from);
      if (p.quiet.to) setQuietTo(p.quiet.to);
    }
  }, []);

  const persist = (nextMaster, nextSwitches, nextQuiet) => {
    const data = {
      master: nextMaster,
      items: nextSwitches,
      quiet: nextQuiet || { enabled: quietOn, from: quietFrom, to: quietTo },
    };
    save(data);
  };

  const activeCount = useMemo(() => ITEMS.filter((i) => switches[i.id]).length, [switches]);

  const setOne = (id, v) => {
    setSwitches((prev) => {
      const next = { ...prev, [id]: v };
      const allOn = ITEMS.every((i) => next[i.id]);
      setMaster(allOn);
      persist(allOn, next);
      return next;
    });
  };

  const onMaster = (v) => {
    setMaster(v);
    setSwitches((prev) => {
      const next = {};
      ITEMS.forEach((i) => {
        next[i.id] = v;
      });
      persist(v, next);
      return next;
    });
  };

  const rowBase =
    'grid min-w-0 grid-cols-1 gap-5 px-5 py-6 sm:grid-cols-12 sm:items-center sm:gap-6 sm:px-6 sm:py-6';

  return (
    <div className="flex min-w-0 flex-col gap-10">
      <SectionCard titleDanger title="Alertas" subtitle="Control granular de notificaciones en el dispositivo.">
        <div className={`${rowBase} rounded-2xl border border-white/[0.07] bg-white/[0.02]`}>
          <div className="min-w-0 sm:col-span-9">
            <p className="text-base font-semibold text-white">Modo maestro</p>
            <p className="mt-1 text-sm leading-relaxed text-white/45">Activa o desactiva todas las categorías al mismo tiempo.</p>
          </div>
          <div className="flex justify-end sm:col-span-3">
            <Toggle checked={master} onChange={onMaster} />
          </div>
        </div>

        <p className="text-xs font-semibold text-emerald-400/90">
          {activeCount} de 6 categorías activas
        </p>

        <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#070b14]/50">
          {ITEMS.map((it, index) => (
            <div
              key={it.id}
              className={`${rowBase} ${index < ITEMS.length - 1 ? 'border-b border-white/[0.06]' : ''}`}
            >
              <div className="flex min-w-0 items-start gap-4 sm:col-span-9">
                <NotifTypeIcon name={it.icon} />
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-white">{it.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-white/45">{it.desc}</p>
                </div>
              </div>
              <div className="flex justify-end sm:col-span-3">
                <Toggle checked={!!switches[it.id]} onChange={(v) => setOne(it.id, v)} size="sm" />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Horas de silencio" subtitle="Referencia local para no molestar.">
        <div className={`${rowBase} rounded-2xl border border-white/[0.07] bg-white/[0.02]`}>
          <div className="min-w-0 sm:col-span-9">
            <p className="text-base font-semibold text-white">Silencio programado</p>
            <p className="mt-1 text-sm leading-relaxed text-white/45">Definí el rango horario en el que preferís no recibir alertas.</p>
          </div>
          <div className="flex justify-end sm:col-span-3">
            <Toggle
              checked={quietOn}
              onChange={(v) => {
                setQuietOn(v);
                persist(master, switches, { enabled: v, from: quietFrom, to: quietTo });
              }}
            />
          </div>
        </div>

        {quietOn ? (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#070b14]/50 px-5 py-5 sm:px-6">
            <span className="w-full text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40 sm:w-auto">Rango</span>
            <input
              type="time"
              className="h-11 min-h-[44px] w-[min(100%,10rem)] rounded-xl border border-white/[0.09] bg-[#070b14] px-3 text-white focus:border-blue-500/80 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
              value={quietFrom}
              onChange={(e) => {
                const v = e.target.value;
                setQuietFrom(v);
                persist(master, switches, { enabled: quietOn, from: v, to: quietTo });
              }}
            />
            <span className="text-white/35">—</span>
            <input
              type="time"
              className="h-11 min-h-[44px] w-[min(100%,10rem)] rounded-xl border border-white/[0.09] bg-[#070b14] px-3 text-white focus:border-blue-500/80 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
              value={quietTo}
              onChange={(e) => {
                const v = e.target.value;
                setQuietTo(v);
                persist(master, switches, { enabled: quietOn, from: quietFrom, to: v });
              }}
            />
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}
