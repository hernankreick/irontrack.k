import React, { useState } from 'react';
import SectionCard from './ui/SectionCard.jsx';
import Btn from './ui/Btn.jsx';
import { supabase } from '../../lib/supabaseClient.js';

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
      localStorage.clear();
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
      localStorage.clear();
    } catch (e) {}
    syncStateWithLocalStorage();
    onClose && onClose();
    window.location.href = window.location.pathname || '/';
  };

  const deleteEnabled = deletePhrase === 'ELIMINAR';

  return (
    <div className="flex flex-col space-y-8">
      <SectionCard title="Datos" subtitle="Exportá una copia de referencia (demo).">
        <div className="flex flex-wrap gap-3">
          <Btn variant="ghost" onClick={exportJson}>
            EXPORTAR JSON
          </Btn>
          <Btn variant="ghost" onClick={exportCsv}>
            EXPORTAR CSV
          </Btn>
        </div>
      </SectionCard>

      <SectionCard title="Sesión" subtitle="Salís de la app sin borrar datos en servidor (solo sesión local).">
        <Btn variant="ghost" onClick={() => setLogoutOpen(true)}>
          CERRAR SESIÓN
        </Btn>
      </SectionCard>

      <SectionCard title="Eliminar cuenta" subtitle="Acción irreversible para datos locales vinculados a esta sesión.">
        {deleteStep === 0 ? (
          <Btn
            variant="danger"
            onClick={() => {
              setDeleteStep(1);
              setDeletePhrase('');
            }}
          >
            QUIERO ELIMINAR MI CUENTA
          </Btn>
        ) : (
          <div className="flex flex-col gap-5">
            <p className="text-sm" style={{ color: '#94a3b8' }}>
              Escribí <span className="font-mono text-white">ELIMINAR</span> para confirmar. Se cerrará la sesión (signOut) y se limpiará el almacenamiento local.
            </p>
            <input
              className="min-h-[44px] w-full rounded-xl border px-4 py-3 font-mono text-white outline-none"
              style={{ borderColor: 'rgba(239,68,68,0.35)', background: '#0a0f1a' }}
              value={deletePhrase}
              onChange={(e) => setDeletePhrase(e.target.value)}
              placeholder="ELIMINAR"
              autoComplete="off"
            />
            <Btn variant="danger" disabled={!deleteEnabled} onClick={doDelete}>
              ELIMINAR CUENTA
            </Btn>
            <Btn variant="ghost" small onClick={() => setDeleteStep(0)}>
              CANCELAR
            </Btn>
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
