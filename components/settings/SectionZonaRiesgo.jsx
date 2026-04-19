import React, { useState } from 'react';
import SectionCard from './ui/SectionCard.jsx';
import Btn from './ui/Btn.jsx';
import { supabase } from '../../lib/supabaseClient.js';
import { clearAllIronTrackPrefixedKeys } from '../../lib/irontrackLocalStorage.js';

function Modal({ children, onBackdrop }) {
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={onBackdrop}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-2xl border p-6 shadow-2xl"
        style={{ background: '#0b111c', borderColor: 'rgba(255,255,255,0.1)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  );
}

export default function SectionZonaRiesgo({ toast2, syncStateWithLocalStorage, onClose }) {
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState(0);
  const [deletePhrase, setDeletePhrase] = useState('');

  const exportJson = () => {
    let session = null;
    try {
      session = JSON.parse(localStorage.getItem('it_session') || 'null');
    } catch (e) {
      session = null;
    }
    const blob = new Blob([JSON.stringify({ session, exportedAt: new Date().toISOString() }, null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `irontrack-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast2('Exportación JSON lista ✓');
  };

  const exportCsv = () => {
    const rows = [['clave', 'valor']];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('it_')) continue;
      rows.push([k, String(localStorage.getItem(k) || '').slice(0, 500)]);
    }
    const esc = (c) => `"${String(c).replace(/"/g, '""')}"`;
    const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `irontrack-keys-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast2('Exportación CSV lista ✓');
  };

  const doLogout = async () => {
    setLogoutOpen(false);
    try {
      if (supabase) await supabase.auth.signOut();
    } catch (e) {}
    try {
      clearAllIronTrackPrefixedKeys();
    } catch (e) {}
    syncStateWithLocalStorage();
    onClose && onClose();
    window.location.href = window.location.pathname || '/';
  };

  const doDelete = async () => {
    if (deletePhrase !== 'ELIMINAR') return;
    try {
      if (supabase) await supabase.auth.signOut();
    } catch (e) {}
    try {
      clearAllIronTrackPrefixedKeys();
    } catch (e) {}
    syncStateWithLocalStorage();
    onClose && onClose();
    window.location.href = window.location.pathname || '/';
  };

  const deleteEnabled = deletePhrase === 'ELIMINAR';

  return (
    <div className="mx-auto flex min-w-0 w-full max-w-[40rem] flex-col gap-10 border-l-2 border-red-500/35 pl-5 sm:pl-7">
      <SectionCard title="Sesión" subtitle="Salir del dispositivo actual sin borrar datos remotos.">
        <p className="text-sm leading-relaxed text-white/45">
          Cerrá la sesión local. Podés volver a entrar cuando quieras.
        </p>
        <Btn variant="ghost" className="mt-6 h-12 w-full text-[12px] sm:w-auto sm:px-10" onClick={() => setLogoutOpen(true)}>
          CERRAR SESIÓN
        </Btn>
      </SectionCard>

      <SectionCard title="Datos" subtitle="Exportaciones de referencia (demo).">
        <p className="text-sm leading-relaxed text-white/45">
          JSON con la sesión actual o CSV con claves locales <span className="font-mono text-white/60">it_*</span>.
        </p>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row">
          <Btn variant="ghost" className="h-12 flex-1 text-[12px]" onClick={exportJson}>
            EXPORTAR JSON
          </Btn>
          <Btn variant="ghost" className="h-12 flex-1 text-[12px]" onClick={exportCsv}>
            EXPORTAR CSV
          </Btn>
        </div>
      </SectionCard>

      <SectionCard titleDanger dangerTone title="Acciones críticas" subtitle="Zona de eliminación irreversible para datos locales vinculados a esta sesión.">
        {deleteStep === 0 ? (
          <div className="flex flex-col gap-8">
            <p className="text-sm leading-relaxed text-red-100/80">
              Avanzá solo si entendés que se limpiará el almacenamiento local y se cerrará la sesión.
            </p>
            <Btn
              variant="danger"
              className="h-12 w-full text-[12px] sm:w-auto sm:px-10"
              onClick={() => {
                setDeleteStep(1);
                setDeletePhrase('');
              }}
            >
              QUIERO ELIMINAR MI CUENTA
            </Btn>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            <div className="flex gap-3 rounded-2xl border border-red-500/30 bg-red-950/40 p-5">
              <svg className="mt-0.5 size-5 shrink-0 text-red-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <p className="min-w-0 text-sm leading-relaxed text-red-50/90">
                Escribí <span className="font-mono font-semibold text-white">ELIMINAR</span> para confirmar. Se ejecutará signOut y limpieza local.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-red-200/70" htmlFor="it-zr-delete-phrase">
                Confirmación
              </label>
              <input
                id="it-zr-delete-phrase"
                className="h-12 w-full rounded-xl border border-red-500/40 bg-[#070b14] px-4 font-mono text-white outline-none focus:border-red-400 focus:ring-2 focus:ring-red-500/20"
                value={deletePhrase}
                onChange={(e) => setDeletePhrase(e.target.value)}
                placeholder="ELIMINAR"
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Btn variant="danger" className="h-12 flex-1 text-[12px]" disabled={!deleteEnabled} onClick={doDelete}>
                ELIMINAR CUENTA
              </Btn>
              <Btn variant="ghost" small className="h-12 flex-1 text-[12px] sm:flex-none sm:px-8" onClick={() => setDeleteStep(0)}>
                CANCELAR
              </Btn>
            </div>
          </div>
        )}
      </SectionCard>

      {logoutOpen ? (
        <Modal onBackdrop={() => setLogoutOpen(false)}>
          <div className="text-lg font-semibold text-white">¿Cerrar sesión?</div>
          <p className="mt-2 text-sm text-white/50">Vas a salir de la app en este dispositivo.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Btn variant="ghost" onClick={() => setLogoutOpen(false)}>
              VOLVER
            </Btn>
            <Btn variant="danger" onClick={doLogout}>
              SÍ, CERRAR SESIÓN
            </Btn>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
