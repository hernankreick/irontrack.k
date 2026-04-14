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
        className="w-full max-w-md rounded-2xl border p-5 shadow-2xl"
        style={{ background: '#0d1424', borderColor: 'rgba(255,255,255,0.1)' }}
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
    <div className="flex flex-col space-y-8">
      <SectionCard title="Datos" subtitle="Exportá una copia de referencia (demo).">
        <div className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <svg
              className="size-12 shrink-0 text-sky-400/90"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              aria-hidden
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <div>
              <h3 className="text-lg font-semibold text-white">Exportaciones</h3>
              <div className="mt-6 flex flex-wrap gap-3">
                <Btn variant="ghost" className="h-11 sm:shrink-0" onClick={exportJson}>
                  EXPORTAR JSON
                </Btn>
                <Btn variant="ghost" className="h-11 sm:shrink-0" onClick={exportCsv}>
                  EXPORTAR CSV
                </Btn>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Sesión" subtitle="Salís de la app sin borrar datos en servidor (solo sesión local).">
        <div className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <svg
              className="size-12 shrink-0 text-sky-400/90"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              aria-hidden
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <div>
              <h3 className="text-lg font-semibold text-white">Sesión actual</h3>
              <div className="mt-6">
                <Btn variant="ghost" className="h-11 sm:shrink-0" onClick={() => setLogoutOpen(true)}>
                  CERRAR SESIÓN
                </Btn>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard titleDanger dangerTone title="Eliminar cuenta" subtitle="Acción irreversible para datos locales vinculados a esta sesión.">
        {deleteStep === 0 ? (
          <div className="space-y-5">
            <h3 className="text-lg font-semibold text-white">Zona crítica</h3>
            <div className="mt-6">
              <Btn
                variant="danger"
                className="h-11 sm:shrink-0"
                onClick={() => {
                  setDeleteStep(1);
                  setDeletePhrase('');
                }}
              >
                QUIERO ELIMINAR MI CUENTA
              </Btn>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <h3 className="mb-6 text-lg font-semibold text-white">Confirmación</h3>
            <div className="mt-6 flex gap-3 rounded-xl border border-red-500/25 bg-red-500/10 p-4">
              <svg
                className="mt-0.5 size-5 shrink-0 text-red-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <p className="text-sm text-white/80">
                Escribí <span className="font-mono text-white">ELIMINAR</span> para confirmar. Se cerrará la sesión (signOut) y se limpiará el almacenamiento local.
              </p>
            </div>
            <div className="space-y-5">
              <input
                className="h-11 min-h-[44px] w-full rounded-lg border border-red-500/35 bg-[#0a0f1a] px-4 font-mono text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                value={deletePhrase}
                onChange={(e) => setDeletePhrase(e.target.value)}
                placeholder="ELIMINAR"
                autoComplete="off"
              />
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Btn variant="danger" className="h-11 sm:shrink-0" disabled={!deleteEnabled} onClick={doDelete}>
                ELIMINAR CUENTA
              </Btn>
              <Btn variant="ghost" small className="h-11 sm:shrink-0" onClick={() => setDeleteStep(0)}>
                CANCELAR
              </Btn>
            </div>
          </div>
        )}
      </SectionCard>

      {logoutOpen ? (
        <Modal onBackdrop={() => setLogoutOpen(false)}>
          <div className="mb-2 text-lg font-black text-white">¿Cerrar sesión?</div>
          <p className="mb-4 text-sm" style={{ color: '#94a3b8' }}>
            Vas a salir de la app. Podés volver a entrar cuando quieras.
          </p>
          <div className="flex flex-wrap gap-2">
            <Btn variant="ghost" onClick={() => setLogoutOpen(false)}>
              VOLVER
            </Btn>
            <Btn
              variant="danger"
              onClick={doLogout}
            >
              SÍ, CERRAR SESIÓN
            </Btn>
          </div>
        </Modal>
      ) : null}

    </div>
  );
}
