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
      className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
      style={{ borderColor: 'rgba(255,255,255,0.08)' }}
    >
      <div className="flex items-center justify-between gap-3 sm:w-40">
        <span className="font-bold text-white">{d.label}</span>
        <Toggle checked={disp[idx].activo} onChange={(v) => setDay(idx, { activo: v })} />
      </div>
      {disp[idx].activo ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="time"
            className="min-h-[44px] rounded-lg border px-3 py-2 text-white"
            style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}
            value={disp[idx].desde}
            onChange={(e) => setDay(idx, { desde: e.target.value })}
          />
          <span style={{ color: '#64748b' }}>—</span>
          <input
            type="time"
            className="min-h-[44px] rounded-lg border px-3 py-2 text-white"
            style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}
            value={disp[idx].hasta}
            onChange={(e) => setDay(idx, { hasta: e.target.value })}
          />
        </div>
      ) : (
        <span className="text-sm font-semibold" style={{ color: '#64748b' }}>
          No disponible
        </span>
      )}
    </div>
  );

  return (
    <div className="flex flex-col space-y-8">
      <SectionCard premium title="Datos del negocio" subtitle="Nombre comercial y contacto.">
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-white/80">Marca y contacto</h3>
            <label className="block">
              <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>
                Nombre del gimnasio / marca
              </span>
              <input
                className="min-h-[44px] w-full rounded-xl border px-4 py-3 text-[15px] text-white outline-none"
                style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', fontFamily: 'inherit' }}
                value={nombreGimnasio}
                onChange={(e) => setNombreGimnasio(e.target.value)}
                placeholder="Iron Track Gym"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>
                Teléfono comercial
              </span>
              <input
                className="min-h-[44px] w-full rounded-xl border px-4 py-3 text-[15px] text-white outline-none"
                style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', fontFamily: 'inherit' }}
                value={telComercial}
                onChange={(e) => setTelComercial(e.target.value)}
                placeholder="+54 …"
              />
            </label>
          </div>

          <div className="space-y-4 border-t border-white/10 pt-6">
            <h3 className="text-sm font-medium text-white/80">Capacidad</h3>
            <div className="mb-2 flex items-end justify-between gap-2">
              <div>
                <div className="text-3xl font-black text-white">{capMax}</div>
                <div className="text-sm" style={{ color: '#64748b' }}>
                  Cupos disponibles: <span style={{ color: '#22C55E' }}>{cuposLibres}</span> (alumnos actuales: {alumnosCount ?? 0})
                </div>
              </div>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              value={capMax}
              onChange={(e) => setCapMax(Number(e.target.value))}
              className="h-3 w-full cursor-pointer accent-[#2563EB]"
            />
          </div>

          <div className="space-y-4 border-t border-white/10 pt-6">
            <h3 className="text-sm font-medium text-white/80">Moneda</h3>
            <p className="text-sm" style={{ color: '#64748b' }}>
              Visualización de montos y reportes.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {MONEDAS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMoneda(m)}
                  className="min-h-[44px] rounded-xl border font-bold uppercase tracking-wide"
                  style={{
                    borderColor: moneda === m ? '#2563EB' : 'rgba(255,255,255,0.1)',
                    background: moneda === m ? 'rgba(37,99,235,0.2)' : 'rgba(255,255,255,0.04)',
                    color: '#fff',
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard premium title="Disponibilidad semanal" subtitle="Horarios en los que atendés consultas o clases.">
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-white/80">Disponibilidad</h3>
            <div className="flex flex-col space-y-3">
              {DIAS.slice(0, 4).map((d, i) => renderDayRow(d, i))}
            </div>
          </div>
          <div className="space-y-4 border-t border-white/10 pt-6">
            <h3 className="text-sm font-medium text-white/80">Fin de semana</h3>
            <div className="flex flex-col space-y-3">
              {DIAS.slice(4).map((d, i) => renderDayRow(d, i + 4))}
            </div>
          </div>
        </div>
      </SectionCard>

      <StickyActionBar>
        <Btn className="w-full" onClick={onSave}>
          {saved ? 'GUARDADO ✓' : 'GUARDAR NEGOCIO'}
        </Btn>
        {saved ? (
          <span className="text-xs opacity-90" style={{ color: '#22C55E' }}>
            Listo
          </span>
        ) : null}
      </StickyActionBar>

      <div className="mt-8 hidden flex-wrap items-center gap-3 lg:flex">
        <Btn onClick={onSave}>{saved ? 'GUARDADO ✓' : 'GUARDAR NEGOCIO'}</Btn>
        {saved ? (
          <span className="text-xs opacity-90" style={{ color: '#22C55E' }}>
            Listo
          </span>
        ) : null}
      </div>
    </div>
  );
}
