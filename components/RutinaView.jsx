import React, { useState } from 'react';
import { ScanLine, Plus, Save, Pencil } from 'lucide-react';
import { Ic } from './Ic.jsx';
import { DaySection } from './DaySection.jsx';
import { EditExerciseModal } from './EditExerciseModal.jsx';
import { emptyDays } from '../lib/routineTemplates.js';

const uid = () => Math.random().toString(36).slice(2, 9);

// ── SVG: Icono mancuerna para estado vacío ──────────────────────────
function DumbbellIcon({ color }) {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4v16M18 4v16M3 8h3M18 8h3M3 16h3M18 16h3M6 8h12M6 16h12"/>
    </svg>
  );
}

// ── Tarjeta de rutina ────────────────────────────────────────────────
function RutinaCard({
  r, es, darkMode, border, textMain, textMuted, bgCard, bgSub,
  allEx, setRoutines, toast2, btn, card, routines,
  setDupDayModal, alumnos, sb, setAssignRoutineId,
  setHasUnsaved, setEditingExercise, onOpenLibrary,
}) {
  const [collapsed, setCollapsed]         = useState(!!r.collapsed);
  const [saving, setSaving]               = useState(false);
  const [lastSaved, setLastSaved]         = useState(null);
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [nombreLocal, setNombreLocal]     = useState(r.name);

  const guardarNombreRutina = () => {
    setEditandoNombre(false);
    setRoutines(p => p.map(rr => rr.id === r.id ? { ...rr, name: nombreLocal } : rr));
    setHasUnsaved(true);
  };

  const totalEx = r.days.reduce(
    (a, d) => a + (d.exercises || []).length + (d.warmup || []).length,
    0
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const rActual = routines.find(x => x.id === r.id) || r;
      const payload = {
        nombre: rActual.name,
        alumno_id: rActual.alumno_id || null,
        datos: { days: rActual.days, alumno: rActual.alumno || '', note: rActual.note || '' },
        entrenador_id: 'entrenador_principal',
      };
      if (rActual.saved) {
        await sb.updateRutina(rActual.id, payload);
      } else {
        const res = await sb.createRutina(payload);
        if (res && res[0]) {
          setRoutines(p => p.map(rr =>
            rr.id === rActual.id ? { ...rr, id: res[0].id, saved: true } : rr
          ));
        }
      }
      setLastSaved(new Date());
      toast2(es ? 'Rutina guardada ✓' : 'Routine saved ✓');
    } catch (e) {
      toast2('Error al guardar');
    }
    setSaving(false);
  };

  const bgHeader = darkMode ? '#111C2B' : '#EEF2F7';

  const ghostBtn = () => ({
    background: 'transparent',
    border: `1px solid ${border}`,
    borderRadius: 8,
    padding: '7px 9px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: textMuted,
    minWidth: 36,
    minHeight: 36,
    transition: 'background .15s, border-color .15s, color .15s',
  });

  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden', marginBottom: 12 }}>

      {/* ── Header de la rutina ── */}
      <div style={{ background: bgHeader, padding: '16px 16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {editandoNombre ? (
              <input
                autoFocus
                value={nombreLocal}
                onChange={e => setNombreLocal(e.target.value)}
                onBlur={guardarNombreRutina}
                onKeyDown={e => e.key === 'Enter' && guardarNombreRutina()}
                style={{
                  fontSize: 22, fontWeight: 900, color: textMain,
                  background: 'transparent', border: 'none',
                  borderBottom: '1px solid #3b82f6',
                  outline: 'none', padding: '2px 0',
                  fontFamily: 'inherit', width: '100%',
                  lineHeight: 1.2,
                }}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: textMain, lineHeight: 1.1, wordBreak: 'break-word' }}>
                  {nombreLocal}
                </div>
                <button
                  onClick={() => setEditandoNombre(true)}
                  style={{
                    width: 44, height: 44, background: 'transparent', border: 'none',
                    cursor: 'pointer', color: '#64748b',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 8, flexShrink: 0,
                  }}
                >
                  <Pencil size={15} />
                </button>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: textMuted, fontWeight: 600 }}>
                {r.days.length} {es ? 'días' : 'days'} · {totalEx} {es ? 'ejercicios' : 'exercises'}
              </span>
              {r.scanned && (
                <span style={{
                  background: '#2563EB22', color: '#2563EB',
                  border: '1px solid #60a5fa33', borderRadius: 6,
                  padding: '2px 8px', fontSize: 10, fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  <Ic name="image" size={11} color="#2563EB" />
                  {es ? 'Escaneada' : 'Scanned'}
                </span>
              )}
              {r.saved && (
                <span style={{
                  background: '#22C55E15', color: '#22C55E',
                  borderRadius: 6, padding: '2px 8px',
                  fontSize: 10, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '.5px',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  <Ic name="check" size={11} color="#22C55E" />
                  {es ? 'GUARDADA' : 'SAVED'}
                </span>
              )}
            </div>
          </div>

          {/* Acciones de rutina */}
          <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
            <button
              className="hov"
              title={es ? 'Duplicar rutina' : 'Duplicate routine'}
              style={ghostBtn()}
              onClick={() => {
                const copia = {
                  ...r,
                  id: uid(),
                  name: r.name + ' (copia)',
                  days: r.days.map(d => ({
                    ...d,
                    warmup:    (d.warmup    || []).map(e => ({ ...e })),
                    exercises: (d.exercises || []).map(e => ({ ...e })),
                  })),
                  collapsed: false,
                  saved: false,
                };
                setRoutines(p => [...p, copia]);
                setAssignRoutineId(copia.id);
                toast2((es ? 'Rutina duplicada' : 'Routine duplicated') + ' ✓');
              }}
            >
              <Ic name="copy" size={15} color={textMuted} />
            </button>

            <button
              className="hov"
              title={es ? 'Eliminar rutina' : 'Delete routine'}
              style={ghostBtn()}
              onClick={() => {
                if (!confirm(es ? `¿Eliminar "${r.name}"?` : `Delete "${r.name}"?`)) return;
                setRoutines(p => p.filter(x => x.id !== r.id));
                toast2((es ? 'Rutina eliminada' : 'Routine deleted') + ' ✓');
              }}
            >
              <Ic name="trash-2" size={15} color={textMuted} />
            </button>

            <button
              className="hov"
              onClick={() => setCollapsed(c => !c)}
              style={{
                background: darkMode ? '#1E2D40' : '#E2E8F0',
                border: 'none', borderRadius: 8,
                padding: '7px 10px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 12, fontWeight: 700, color: textMuted,
                textTransform: 'uppercase', letterSpacing: '.5px',
                minHeight: 36,
              }}
            >
              {collapsed ? (
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ) : (
                <Ic name="chevron-up" size={15} color={textMuted} />
              )}
              {collapsed ? (es ? 'VER' : 'VIEW') : (es ? 'CERRAR' : 'CLOSE')}
            </button>
          </div>
        </div>

        {/* Asignar alumno + GUARDAR */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <select
            value={r.alumno_id || ''}
            onChange={e => {
              const v = e.target.value;
              setRoutines(p => p.map(rr => rr.id === r.id
                ? { ...rr, alumno_id: v, alumno: alumnos.find(a => a.id === v)?.nombre || '' }
                : rr
              ));
            }}
            style={{
              flex: 1,
              background: darkMode ? '#0B1220' : '#fff',
              color: textMuted,
              border: `1px solid ${border}`,
              borderRadius: 10,
              padding: '8px 12px',
              fontSize: 14,
              fontFamily: 'inherit',
            }}
          >
            <option value="">{es ? 'Sin asignar' : 'Unassigned'}</option>
            {alumnos.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>

          {/* Botón GUARDAR por rutina */}
          <button
            className="hov"
            onClick={handleSave}
            disabled={saving}
            style={{
              background: saving ? '#1d4ed8' : '#2563EB',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              opacity: saving ? 0.85 : 1,
              textTransform: 'uppercase',
              letterSpacing: '.5px',
              minWidth: 110,
              justifyContent: 'center',
              transition: 'background .15s, opacity .15s',
            }}
          >
            {saving ? (
              <>
                <svg
                  width="14" height="14" viewBox="0 0 24 24"
                  fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"
                  style={{ animation: 'spin .7s linear infinite' }}
                >
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                {es ? 'GUARDANDO' : 'SAVING'}
              </>
            ) : (
              <>
                <Ic name="save" size={14} color="#fff" />
                {es ? 'GUARDAR' : 'SAVE'}
              </>
            )}
          </button>
        </div>

        {lastSaved && (
          <div style={{ fontSize: 11, color: textMuted, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Ic name="check-circle" size={11} color="#22C55E" />
            {es ? 'Guardado a las' : 'Saved at'}{' '}
            {lastSaved.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>

      {/* ── Días (DaySection) ── */}
      {!collapsed && (
        <div style={{ padding: '12px 16px 16px' }}>
          {r.days.map((d, di) => {
            // Enrich exercises with display name (lookup in allEx by id)
            const enrichList = (list) => (list || []).map(ex => ({
              ...ex,
              id:   ex.id || uid(),
              name: allEx.find(e => e.id === ex.id)?.name || ex.name || ex.id || '',
            }));

            return (
              <DaySection
                key={di}
                day={{
                  id:        di,
                  name:      d.label || `${es ? 'Día' : 'Day'} ${di + 1}`,
                  warmup:    enrichList(d.warmup),
                  exercises: enrichList(d.exercises),
                }}
                onCopyDay={() => {
                  if (r.days.length < 2) { toast2(es ? 'No hay otros días' : 'No other days'); return; }
                  setDupDayModal({ rId: r.id, dIdx: di, days: r.days, selected: [], sourceDay: d });
                }}
                onDeleteDay={() => {
                  if (!confirm(es
                    ? `¿Eliminar "${d.label || `Día ${di + 1}`}"?`
                    : `Delete day ${di + 1}?`
                  )) return;
                  setRoutines(p => p.map(rr => rr.id !== r.id ? rr : {
                    ...rr, days: rr.days.filter((_, i) => i !== di),
                  }));
                  setHasUnsaved(true);
                }}
                onAddWarmup={() => onOpenLibrary(r.id, di, 'warmup')}
                onAddExercise={() => onOpenLibrary(r.id, di, 'exercises')}
                onRenameDay={(_, nuevoNombre) => {
                  setRoutines(p => p.map(rr => rr.id !== r.id ? rr : {
                    ...rr,
                    days: rr.days.map((dd, ddi) =>
                      ddi !== di ? dd : { ...dd, label: nuevoNombre }
                    ),
                  }));
                  setHasUnsaved(true);
                }}
                onEditExercise={(exercise) => {
                  // Determine which bloque the exercise belongs to
                  const inWarmup = (d.warmup || []).some(ex => ex.id === exercise.id);
                  setEditingExercise({
                    routineId: r.id,
                    dayIdx:    di,
                    bloque:    inWarmup ? 'warmup' : 'exercises',
                    exercise,
                  });
                }}
                onDeleteExercise={(exerciseId) => {
                  setRoutines(p => p.map(rr => rr.id !== r.id ? rr : {
                    ...rr,
                    days: rr.days.map((dd, ddi) => ddi !== di ? dd : {
                      ...dd,
                      warmup:    (dd.warmup    || []).filter(ex => ex.id !== exerciseId),
                      exercises: (dd.exercises || []).filter(ex => ex.id !== exerciseId),
                    }),
                  }));
                  setHasUnsaved(true);
                }}
                onReorderWarmup={(newList) => {
                  setRoutines(p => p.map(rr => rr.id !== r.id ? rr : {
                    ...rr,
                    days: rr.days.map((dd, ddi) =>
                      ddi !== di ? dd : { ...dd, warmup: newList }
                    ),
                  }));
                  setHasUnsaved(true);
                }}
                onReorderExercises={(newList) => {
                  setRoutines(p => p.map(rr => rr.id !== r.id ? rr : {
                    ...rr,
                    days: rr.days.map((dd, ddi) =>
                      ddi !== di ? dd : { ...dd, exercises: newList }
                    ),
                  }));
                  setHasUnsaved(true);
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────
export function RutinaView(props) {
  const {
    setTab, border, textMuted, bgCard, textMain, darkMode, bgSub, es,
    setFiltroRut, btn, card, setNewR, routines, setRoutines, allEx, PATS,
    setEditEx, toast2, setAddExModal, setAddExSearch, setAddExPat,
    setAddExSelectedIds, setDupDayModal, alumnos, sb, setAssignRoutineId,
  } = props;

  const [hasUnsaved, setHasUnsaved]           = useState(false);
  const [editingExercise, setEditingExercise] = useState(null);

  const openLibrary = (routineId, dayIdx, bloque) => {
    setAddExModal({ rId: routineId, dIdx: dayIdx, bloque });
    setAddExSearch('');
    setAddExPat(null);
    setAddExSelectedIds([]);
  };

  const handleSaveAll = async () => {
    if (!hasUnsaved) return;
    try {
      for (const r of routines) {
        const payload = {
          nombre: r.name,
          alumno_id: r.alumno_id || null,
          datos: { days: r.days, alumno: r.alumno || '', note: r.note || '' },
          entrenador_id: 'entrenador_principal',
        };
        if (r.saved) {
          await sb.updateRutina(r.id, payload);
        } else {
          const res = await sb.createRutina(payload);
          if (res && res[0]) {
            setRoutines(p => p.map(rr =>
              rr.id === r.id ? { ...rr, id: res[0].id, saved: true } : rr
            ));
          }
        }
      }
      setHasUnsaved(false);
      toast2(es ? 'Cambios guardados ✓' : 'Changes saved ✓');
    } catch (e) {
      toast2('Error al guardar');
    }
  };

  const closeEditModal = () => setEditingExercise(null);

  const handleModalSave = (formData) => {
    if (!editingExercise) return;
    const { routineId, dayIdx, exercise, bloque } = editingExercise;
    const updatedEx = { ...exercise, ...formData };

    setRoutines(p => p.map(rr => rr.id !== routineId ? rr : {
      ...rr,
      days: rr.days.map((dd, di) => di !== dayIdx ? dd : {
        ...dd,
        [bloque]: (dd[bloque] || []).map(ex =>
          ex.id === exercise.id ? updatedEx : ex
        ),
      }),
    }));

    setHasUnsaved(true);
    closeEditModal();
  };

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ paddingBottom: 140 }}>

        {/* ── Botón escanear ── */}
        <button className="hov" onClick={() => setTab('scanner')} style={{
          width: '100%', marginBottom: 10, padding: '10px 16px',
          background: 'transparent', border: `1px solid ${border}`,
          borderRadius: 12, color: textMuted, fontSize: 14, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          textTransform: 'uppercase', letterSpacing: '.5px',
          minHeight: 44,
        }}>
          <ScanLine size={16} />
          {es ? 'ESCANEAR RUTINA EXISTENTE' : 'SCAN EXISTING ROUTINE'}
        </button>

        {/* ── Botón nueva rutina ── */}
        <button className="hov" style={{
          width: '100%', marginBottom: 16, padding: '14px',
          background: '#3b82f6', border: 'none',
          borderRadius: 12, color: '#fff', fontSize: 17, fontWeight: 800,
          cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          minHeight: 52,
        }} onClick={() => setNewR({
          templateId: 'blank', name: '', numDays: 3,
          days: emptyDays(3, es), note: '', alumno: '', showAdvanced: false,
        })}>
          <Plus size={18} color="#fff" />
          {es ? 'NUEVA RUTINA' : 'NEW ROUTINE'}
        </button>

        {/* ── Lista de rutinas ── */}
        {routines.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '40px 20px',
            color: textMuted, fontSize: 14, lineHeight: 1.6,
          }}>
            <DumbbellIcon color={textMuted} />
            <div style={{ marginTop: 12, fontWeight: 700, fontSize: 16 }}>
              {es ? 'Sin rutinas todavía' : 'No routines yet'}
            </div>
            <div style={{ marginTop: 4 }}>
              {es ? 'Creá tu primera rutina con el botón de arriba.' : 'Create your first routine above.'}
            </div>
          </div>
        ) : (
          routines.map(r => (
            <RutinaCard
              key={r.id}
              r={r}
              es={es} darkMode={darkMode} border={border}
              textMain={textMain} textMuted={textMuted}
              bgCard={bgCard} bgSub={bgSub}
              allEx={allEx}
              setRoutines={setRoutines}
              setDupDayModal={setDupDayModal}
              alumnos={alumnos} sb={sb} setAssignRoutineId={setAssignRoutineId}
              toast2={toast2} btn={btn} card={card} routines={routines}
              setHasUnsaved={setHasUnsaved}
              setEditingExercise={setEditingExercise}
              onOpenLibrary={openLibrary}
            />
          ))
        )}
      </div>

      {/* ── EditExerciseModal (solo para lápiz / editar) ── */}
      {editingExercise && (
        <EditExerciseModal
          exercise={editingExercise.exercise}
          onClose={closeEditModal}
          onSave={handleModalSave}
        />
      )}

      {/* ── Sticky save bar ── */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        padding: '12px 16px',
        background: 'rgba(15,23,42,0.95)',
        backdropFilter: 'blur(12px)',
        borderTop: `1px solid ${border}`,
        display: hasUnsaved ? 'flex' : 'none',
        justifyContent: 'center',
        zIndex: 35,
      }}>
        <button
          onClick={handleSaveAll}
          disabled={!hasUnsaved}
          style={{
            maxWidth: 500,
            width: '100%',
            padding: '13px',
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 700,
            fontFamily: 'inherit',
            cursor: hasUnsaved ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'all .25s',
            ...(hasUnsaved
              ? {
                  background: '#22c55e',
                  border: 'none',
                  color: '#fff',
                  boxShadow: '0 0 20px rgba(34,197,94,0.35)',
                }
              : {
                  background: 'transparent',
                  border: '1.5px dashed rgba(148,163,184,0.25)',
                  color: '#64748b',
                }
            ),
          }}
        >
          <Save size={16} />
          {hasUnsaved
            ? (es ? 'Guardar cambios' : 'Save changes')
            : (es ? 'Sin cambios' : 'No changes')
          }
        </button>
      </div>
    </>
  );
}
