import React, { useEffect, useMemo, useState } from 'react';
import SectionCard from './ui/SectionCard.jsx';
import Toggle from './ui/Toggle.jsx';

const LS = 'it_notif_prefs';

const ITEMS = [
  { id: 'nuevo_alumno', emoji: '🧑‍🎓', title: 'Nuevos alumnos', desc: 'Cuando un alumno se da de alta o acepta invitación.' },
  { id: 'mensaje', emoji: '💬', title: 'Mensajes', desc: 'Mensajes nuevos en el chat.' },
  { id: 'pago', emoji: '💳', title: 'Pagos y vencimientos', desc: 'Recordatorios de cuotas o estados de pago.' },
  { id: 'rutina', emoji: '📋', title: 'Rutinas', desc: 'Cambios en rutinas asignadas o completadas.' },
  { id: 'sesion', emoji: '🏋️', title: 'Sesiones', desc: 'Resumen cuando un alumno registra entreno.' },
  { id: 'sistema', emoji: '⚙️', title: 'Sistema', desc: 'Actualizaciones y avisos de la plataforma.' },
];

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
      <SectionCard title="Alertas" subtitle="Elegí qué notificaciones querés recibir en el dispositivo.">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-bold text-white">Modo maestro</div>
            <div className="text-sm" style={{ color: '#64748b' }}>
              Activa o desactiva todas las alertas a la vez.
            </div>
          </div>
          <Toggle checked={master} onChange={onMaster} />
        </div>
        <div className="mb-6 text-sm font-bold" style={{ color: '#22C55E' }}>
          {activeCount} de 6 activas
        </div>
        <div className="flex flex-col space-y-4">
          {ITEMS.map((it) => (
            <div
              key={it.id}
              className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
              style={{ borderColor: 'rgba(255,255,255,0.08)' }}
            >
              <div className="flex gap-3">
                <span className="text-2xl">{it.emoji}</span>
                <div>
                  <div className="font-bold text-white">{it.title}</div>
                  <div className="text-sm" style={{ color: '#64748b' }}>
                    {it.desc}
                  </div>
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
      </SectionCard>

      <SectionCard title="Horas de silencio" subtitle="No molestar en este rango (referencia local).">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-bold text-white">Silencio programado</span>
          <Toggle
            checked={quietOn}
            onChange={(v) => {
              setQuietOn(v);
              persist(master, switches, { enabled: v, from: quietFrom, to: quietTo });
            }}
          />
        </div>
        {quietOn ? (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <input
              type="time"
              className="min-h-[44px] rounded-lg border px-3 py-2 text-white"
              style={{ borderColor: 'rgba(255,255,255,0.08)', background: '#0a0f1a' }}
              value={quietFrom}
              onChange={(e) => {
                const v = e.target.value;
                setQuietFrom(v);
                persist(master, switches, { enabled: quietOn, from: v, to: quietTo });
              }}
            />
            <span style={{ color: '#64748b' }}>—</span>
            <input
              type="time"
              className="min-h-[44px] rounded-lg border px-3 py-2 text-white"
              style={{ borderColor: 'rgba(255,255,255,0.08)', background: '#0a0f1a' }}
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
