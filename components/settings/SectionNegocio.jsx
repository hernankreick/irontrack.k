import React, { useEffect, useState } from 'react';
import SectionCard from './ui/SectionCard.jsx';
import Btn from './ui/Btn.jsx';
import StickyActionBar from './ui/StickyActionBar.jsx';
import Toggle from './ui/Toggle.jsx';
import { supabase } from '../../lib/supabaseClient.js';

const LS_KEY = 'it_coach_negocio';

const MONEDAS = ['ARS', 'USD', 'EUR', 'COP', 'MXN', 'CLP', 'PEN', 'BRL'];

const DIAS = [
  { key: 'lun', label: 'Lun' },
  { key: 'mar', label: 'Mar' },
  { key: 'mie', label: 'Mié' },
  { key: 'jue', label: 'Jue' },
  { key: 'vie', label: 'Vie' },
  { key: 'sab', label: 'Sáb' },
  { key: 'dom', label: 'Dom' },
];

function defaultDisp() {
  return DIAS.map(() => ({ activo: true, desde: '08:00', hasta: '20:00' }));
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export default function SectionNegocio({ toast2, sb, entrenadorId, alumnosCount }) {
  const [nombreGimnasio, setNombreGimnasio] = useState('');
  const [telComercial, setTelComercial] = useState('');
  const [capMax, setCapMax] = useState(30);
  const [moneda, setMoneda] = useState('ARS');
  const [disp, setDisp] = useState(defaultDisp);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const local = loadLocal();
    if (local) {
      setNombreGimnasio(local.nombre_gimnasio || '');
      setTelComercial(local.telefono_comercial || '');
      if (typeof local.capacidad_max === 'number') setCapMax(local.capacidad_max);
      if (local.moneda) setMoneda(local.moneda);
      if (Array.isArray(local.disponibilidad) && local.disponibilidad.length === 7) setDisp(local.disponibilidad);
    }
    (async () => {
      if (sb && typeof sb.getEntrenador === 'function') {
        const rows = await sb.getEntrenador(entrenadorId);
        const row = rows && rows[0];
        if (row) {
          if (row.nombre_gimnasio) setNombreGimnasio(row.nombre_gimnasio);
          if (row.telefono_comercial) setTelComercial(row.telefono_comercial);
          if (row.capacidad_max != null) setCapMax(Number(row.capacidad_max));
          if (row.moneda) setMoneda(row.moneda);
          try {
            if (row.disponibilidad_json) {
              const d = typeof row.disponibilidad_json === 'string' ? JSON.parse(row.disponibilidad_json) : row.disponibilidad_json;
              if (Array.isArray(d) && d.length === 7) setDisp(d);
            }
          } catch (e) {}
        }
      }
    })();
  }, [sb, entrenadorId]);

  const cuposLibres = Math.max(0, capMax - (alumnosCount || 0));

  const onSave = async () => {
    const payload = {
      nombre_gimnasio: nombreGimnasio.trim(),
      telefono_comercial: telComercial.trim(),
      capacidad_max: capMax,
      moneda,
      disponibilidad: disp,
    };
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(payload));
    } catch (e) {}

    let ok = false;

    if (supabase) {
      try {
        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr) console.error('[SectionNegocio] getUser', authErr);
        else if (authData && authData.user) {
          const u = authData.user;
          const row = {
            nombre_gimnasio: payload.nombre_gimnasio,
            telefono_comercial: payload.telefono_comercial,
            capacidad_max: payload.capacidad_max,
            moneda: payload.moneda,
            disponibilidad_json: payload.disponibilidad,
          };
          const { data: updated, error: upErr } = await supabase
            .from('entrenadores')
            .update(row)
            .eq('id', u.id)
            .select();
          if (upErr) {
            console.error('[SectionNegocio] update entrenadores', upErr);
          } else if (updated && updated.length > 0) {
            ok = true;
          } else {
            const { data: inserted, error: insErr } = await supabase
              .from('entrenadores')
              .upsert(
                {
                  id: u.id,
                  email: u.email ?? null,
                  ...row,
                },
                { onConflict: 'id' }
              )
              .select();
            if (insErr) console.error('[SectionNegocio] upsert entrenadores', insErr);
            else if (inserted && inserted.length > 0) ok = true;
          }
        }
      } catch (e) {
        console.error('[SectionNegocio] supabase save', e);
      }
    }

    if (!ok && sb && typeof sb.updateEntrenador === 'function') {
      const res = await sb.updateEntrenador(entrenadorId, {
        nombre_gimnasio: payload.nombre_gimnasio,
        telefono_comercial: payload.telefono_comercial,
        capacidad_max: payload.capacidad_max,
        moneda: payload.moneda,
        disponibilidad_json: JSON.stringify(payload.disponibilidad),
      });
      ok = res !== null;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
    toast2(ok ? 'Negocio guardado en la nube ✓' : 'Negocio guardado localmente ✓');
  };

  const setDay = (idx, patch) => {
    setDisp((prev) => {
      const n = [...prev];
      n[idx] = { ...n[idx], ...patch };
      return n;
    });
  };

  const renderDayRow = (d, idx) => (
    <div
      key={d.key}
      className="grid min-w-0 grid-cols-1 gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-4 sm:grid-cols-12 sm:items-center sm:px-5 sm:py-4"
    >
      <div className="flex min-w-0 items-center justify-between gap-3 sm:col-span-4">
        <span className="text-sm font-semibold text-white">{d.label}</span>
        <Toggle checked={disp[idx].activo} onChange={(v) => setDay(idx, { activo: v })} />
      </div>
      {disp[idx].activo ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:col-span-8 sm:justify-end">
          <input
            type="time"
            className="h-11 min-h-[44px] w-[min(100%,9.75rem)] rounded-xl border border-white/[0.09] bg-[#070b14] px-3 text-white focus:border-blue-500/80 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
            value={disp[idx].desde}
            onChange={(e) => setDay(idx, { desde: e.target.value })}
          />
          <span className="text-white/35">—</span>
          <input
            type="time"
            className="h-11 min-h-[44px] w-[min(100%,9.75rem)] rounded-xl border border-white/[0.09] bg-[#070b14] px-3 text-white focus:border-blue-500/80 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
            value={disp[idx].hasta}
            onChange={(e) => setDay(idx, { hasta: e.target.value })}
          />
        </div>
      ) : (
        <span className="text-sm font-medium text-slate-500 sm:col-span-8 sm:text-right">No disponible</span>
      )}
    </div>
  );

  return (
    <div className="flex min-w-0 flex-col gap-9 pb-4 lg:pb-0">
      <div className="grid min-w-0 grid-cols-1 gap-9 lg:grid-cols-2 lg:gap-10">
        <SectionCard title="Identidad del negocio" subtitle="Nombre comercial y contacto visible.">
          <div className="grid min-w-0 grid-cols-1 gap-7 md:grid-cols-2 md:gap-x-8">
            <div className="min-w-0 space-y-2 md:col-span-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500" htmlFor="it-negocio-nombre">
                Nombre del gimnasio / marca
              </label>
              <input
                id="it-negocio-nombre"
                className="h-12 w-full rounded-xl border border-white/[0.09] bg-[#070b14] px-4 text-[15px] text-white outline-none placeholder:text-white/35 focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/15"
                style={{ fontFamily: 'inherit' }}
                value={nombreGimnasio}
                onChange={(e) => setNombreGimnasio(e.target.value)}
                placeholder="Iron Track Gym"
              />
            </div>
            <div className="min-w-0 space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500" htmlFor="it-negocio-tel">
                Teléfono comercial
              </label>
              <input
                id="it-negocio-tel"
                className="h-12 w-full rounded-xl border border-white/[0.09] bg-[#070b14] px-4 text-[15px] text-white outline-none placeholder:text-white/35 focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/15"
                style={{ fontFamily: 'inherit' }}
                value={telComercial}
                onChange={(e) => setTelComercial(e.target.value)}
                placeholder="+54 …"
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Operación" subtitle="Cupos máximos y moneda de referencia.">
          <div className="grid min-w-0 grid-cols-1 gap-10 lg:grid-cols-2 lg:items-start lg:gap-10">
            <div className="min-w-0 space-y-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Capacidad</p>
                <div className="mt-2 flex items-end gap-3">
                  <span className="text-4xl font-black tabular-nums text-white">{capMax}</span>
                  <span className="pb-1 text-xs text-white/45">alumnos máx.</span>
                </div>
                <p className="mt-3 text-sm text-white/45">
                  Libres: <span className="font-semibold text-emerald-400">{cuposLibres}</span>
                  <span className="text-white/30"> · </span>
                  Actuales: <span className="text-white/70">{alumnosCount ?? 0}</span>
                </p>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                value={capMax}
                onChange={(e) => setCapMax(Number(e.target.value))}
                className="h-3 w-full min-w-0 cursor-pointer accent-blue-500"
              />
            </div>
            <div className="min-w-0 space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Moneda</p>
                <p className="mt-1 text-sm text-white/45">Para montos y reportes.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                {MONEDAS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMoneda(m)}
                    className={`h-11 rounded-xl border text-xs font-bold uppercase tracking-wide transition-colors ${
                      moneda === m
                        ? 'border-blue-500/80 bg-blue-500/15 text-blue-100'
                        : 'border-white/[0.08] bg-transparent text-white/70 hover:border-white/[0.14] hover:bg-white/[0.04]'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Disponibilidad" subtitle="Franjas por día. Desactivá el día si no atendés.">
        <div className="grid min-w-0 grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-12">
          <div className="flex min-w-0 flex-col gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">Semana · lun a jue</p>
            <div className="flex flex-col gap-3">{DIAS.slice(0, 4).map((d, i) => renderDayRow(d, i))}</div>
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">Fin de semana · vie a dom</p>
            <div className="flex flex-col gap-3">{DIAS.slice(4).map((d, i) => renderDayRow(d, i + 4))}</div>
          </div>
        </div>
      </SectionCard>

      <StickyActionBar>
        <Btn className="h-12 w-full text-[12px]" onClick={onSave}>
          {saved ? 'GUARDADO ✓' : 'GUARDAR NEGOCIO'}
        </Btn>
        {saved ? <span className="text-center text-xs text-emerald-400/95">Listo</span> : null}
      </StickyActionBar>

      <div className="hidden flex-wrap items-center justify-end gap-4 border-t border-white/[0.08] pt-8 lg:flex">
        <Btn className="h-12 px-8 text-[12px]" onClick={onSave}>
          {saved ? 'GUARDADO ✓' : 'GUARDAR NEGOCIO'}
        </Btn>
        {saved ? <span className="text-xs text-emerald-400/95">Listo</span> : null}
      </div>
    </div>
  );
}
