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
  const cls = 'size-12 shrink-0 text-sky-400/90';
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

  return (
    <div className="flex flex-col space-y-8">
      <SectionCard titleDanger title="Alertas" subtitle="Elegí qué notificaciones querés recibir en el dispositivo.">
        <div className="space-y-5">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-base font-semibold text-white">Modo maestro</div>
                <div className="mt-1 text-sm text-white/50">Activa o desactiva todas las alertas a la vez.</div>
              </div>
              <Toggle checked={master} onChange={onMaster} />
            </div>
          </div>
          <div className="text-xs font-medium opacity-90" style={{ color: '#22C55E' }}>
            {activeCount} de 6 activas
          </div>
          <div>
            <h3 className="mb-3 text-lg font-semibold text-white">Tipos de alerta</h3>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
          {ITEMS.map((it) => (
            <div
              key={it.id}
              className="flex flex-col gap-3 border-b border-white/5 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between lg:border lg:border-white/10 lg:rounded-2xl lg:bg-white/[0.02] lg:p-6 lg:last:border-b"
            >
              <div className="flex gap-5">
                <NotifTypeIcon name={it.icon} />
                <div>
                  <div className="text-base font-semibold text-white">{it.title}</div>
                  <div className="mt-1 text-sm text-white/50">{it.desc}</div>
                </div>
              </div>
              <Toggle
                checked={!!switches[it.id]}
                onChange={(v) => setOne(it.id, v)}
                size="sm"
              />
            </div>
          ))}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Horas de silencio" subtitle="No molestar en este rango (referencia local).">
        <div className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Silencio programado</h3>
              <span className="mt-1 block text-sm text-white/50">Definí el rango horario en tu dispositivo.</span>
            </div>
            <Toggle
              checked={quietOn}
              onChange={(v) => {
                setQuietOn(v);
                persist(master, switches, { enabled: v, from: quietFrom, to: quietTo });
              }}
            />
          </div>
        {quietOn ? (
          <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-5">
            <input
              type="time"
              className="h-11 min-h-[44px] rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={quietFrom}
              onChange={(e) => {
                const v = e.target.value;
                setQuietFrom(v);
                persist(master, switches, { enabled: quietOn, from: v, to: quietTo });
              }}
            />
            <span className="text-white/40">—</span>
            <input
              type="time"
              className="h-11 min-h-[44px] rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={quietTo}
              onChange={(e) => {
                const v = e.target.value;
                setQuietTo(v);
                persist(master, switches, { enabled: quietOn, from: quietFrom, to: v });
              }}
            />
          </div>
        ) : null}
        </div>
      </SectionCard>
    </div>
  );
}
