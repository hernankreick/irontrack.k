import React, { useState, useCallback, useRef } from 'react';
import { Ic } from './Ic.jsx';
import { ExerciseCard } from './ExerciseCard.jsx';
import { emptyDays } from '../lib/routineTemplates.js';
import { fmtP } from '../lib/timeFormat.js';

const uid = () => Math.random().toString(36).slice(2, 9);

// ── SVG: Icono mancuerna para estado vacío ──────────────────────────
function DumbbellIcon({ color }) {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4v16M18 4v16M3 8h3M18 8h3M3 16h3M18 16h3M6 8h12M6 16h12"/>
    </svg>
  );
}

// ── SVG: Grip handle de 6 puntos ────────────────────────────────────
function GripIcon({ color }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill={color}>
      <circle cx="4" cy="3" r="1.2"/><circle cx="10" cy="3" r="1.2"/>
      <circle cx="4" cy="7" r="1.2"/><circle cx="10" cy="7" r="1.2"/>
      <circle cx="4" cy="11" r="1.2"/><circle cx="10" cy="11" r="1.2"/>
    </svg>
  );
}

// ── Accordion de día ────────────────────────────────────────────────
function DayAccordion({
  r, d, di, es, darkMode, border, textMain, textMuted, bgSub,
  allEx, PATS, setRoutines, setEditEx, setAddExModal,
  setAddExSearch, setAddExPat, setAddExSelectedIds,
  setDupDayModal, toast2, btn,
}) {
  const [open, setOpen] = useState(false);

  const warmupCount = (d.warmup || []).length;
  const mainCount   = (d.exercises || []).length;
  const totalEx     = warmupCount + mainCount;
  const warmupMin   = warmupCount * 2;

  const moveEx = useCallback((bloque, fromIdx, toIdx) => {
    setRoutines(p => p.map(rr => rr.id !== r.id ? rr : {
      ...rr,
      days: rr.days.map((dd, ddi) => {
        if (ddi !== di) return dd;
        const arr = [...(dd[bloque] || [])];
        const [item] = arr.splice(fromIdx, 1);
        arr.splice(toIdx, 0, item);
        return { ...dd, [bloque]: arr };
      }),
    }));
  }, [r.id, di, setRoutines]);

  const renderExList = (exList, bloque) => exList.map((ex, ei) => {
    const info = allEx.find(e => e.id === ex.id);
    const pat  = PATS[info?.pattern] || Object.values(PATS)[0] || { icon: 'E', color: textMuted };
    const removeEx = () => setRoutines(p => p.map(rr => rr.id !== r.id ? rr : {
      ...rr,
      days: rr.days.map((dd, ddi) =>
        ddi === di ? { ...dd, [bloque]: dd[bloque].filter((_, eei) => eei !== ei) } : dd
      ),
    }));
    return (
      <ExerciseCard
        key={ei}
        ex={ex} info={info} es={es} darkMode={darkMode}
        border={border} textMain={textMain} textMuted={textMuted} bgSub={bgSub}
        fmtP={fmtP}
        canUp={ei > 0} canDown={ei < exList.length - 1}
        onMoveUp={() => ei > 0 && moveEx(bloque, ei, ei - 1)}
        onMoveDown={() => ei < exList.length - 1 && moveEx(bloque, ei, ei + 1)}
        onEdit={() => setEditEx({ rId: r.id, dIdx: di, eIdx: ei, bloque, ex: { ...ex } })}
        onRemove={removeEx}
      />
    );
  });

  const openAddEx = (bloque) => {
    setAddExModal({ rId: r.id, dIdx: di, bloque });
    setAddExSearch('');
    setAddExPat(null);
    setAddExSelectedIds([]);
  };

  const accentWarmup  = '#F59E0B';
  const accentMain    = '#2563EB';
  const bgAccordion   = darkMode ? '#0F1923' : '#F8FAFC';
  const bgBlock       = darkMode ? '#162234' : '#F0F4F8';
  const borderActive  = accentMain + '55';

  // ── Estilo bloque (warmup / main) ─────────────────────────────────
  const blockStyle = (accent) => ({
    background: bgBlock,
    borderRadius: 12,
    padding: '12px 14px',
    marginBottom: 10,
    border: `1px solid ${accent}33`,
  });

  // ── Botón AÑADIR dentro del bloque ────────────────────────────────
  const addBtnStyle = (accent) => ({
    background: `${accent}14`,
    color: accent,
    border: `1px solid ${accent}33`,
    borderRadius: 8,
    padding: '5px 10px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontFamily: 'inherit',
    letterSpacing: '.5px',
  });

  // ── Botón duplicar día (sutil, solo icono) ─────────────────────────
  const dupBtnStyle = {
    background: 'transparent',
    border: `1px solid ${border}`,
    borderRadius: 8,
    padding: '6px 8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    color: textMuted,
    transition: 'background .15s, color .15s',
    minWidth: 36,
    minHeight: 36,
    justifyContent: 'center',
  };

  return (
    <div style={{
      borderRadius: 14,
      border: `1px solid ${open ? borderActive : border}`,
      marginBottom: 8,
      overflow: 'hidden',
      transition: 'border-color .2s',
      background: bgAccordion,
    }}>

      {/* ── Header del día ── */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '14px 16px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          textAlign: 'left', minHeight: 60,
        }}
      >
        {/* Número de día */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: open ? accentMain : (darkMode ? '#1E2D40' : '#E2E8F0'),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 800,
            color: open ? '#fff' : textMuted,
            transition: 'background .2s, color .2s',
          }}>{di + 1}</div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 16, fontWeight: 800, color: textMain,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {d.label || `${es ? 'Día' : 'Day'} ${di + 1}`}
            </div>

            {/* Chips resumen — más sutiles */}
            <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' }}>
              {warmupCount > 0 && (
                <span style={{
                  fontSize: 10, color: accentWarmup, fontWeight: 600,
                  background: accentWarmup + '14', borderRadius: 5,
                  padding: '1px 6px', letterSpacing: '.3px',
                }}>
                  {es ? 'CALOR' : 'WARMUP'} · {warmupCount}
                  {warmupMin > 0 ? ` · ${warmupMin}min` : ''}
                </span>
              )}
              <span style={{
                fontSize: 10, color: textMuted, fontWeight: 600,
                background: darkMode ? '#1E2D40' : '#E2E8F0',
                borderRadius: 5, padding: '1px 6px', letterSpacing: '.3px',
              }}>
                {mainCount} {es ? 'ejercicios' : 'exercises'}
              </span>
              {totalEx === 0 && (
                <span style={{ fontSize: 10, color: textMuted, opacity: .6 }}>
                  {es ? 'SIN EJERCICIOS' : 'EMPTY'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Acciones + chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* Duplicar día — botón sutil, solo icono */}
          <button
            className="hov"
            onClick={(e) => {
              e.stopPropagation();
              if (r.days.length < 2) { toast2(es ? 'No hay otros días' : 'No other days'); return; }
              setDupDayModal({ rId: r.id, dIdx: di, days: r.days, selected: [], sourceDay: d });
            }}
            style={dupBtnStyle}
            title={es ? 'Copiar ejercicios a otro día' : 'Copy to another day'}
          >
            <Ic name="copy" size={14} color={textMuted} />
          </button>

          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: darkMode ? '#1E2D40' : '#E2E8F0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'transform .2s',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}>
            <Ic name="chevron-down" size={16} color={textMuted} />
          </div>
        </div>
      </button>

      {/* ── Contenido expandido ── */}
      {open && (
        <div style={{ padding: '0 16px 16px' }}>

          {/* Nombre editable del día */}
          <div style={{ marginBottom: 14 }}>
            <input
              value={d.label || ''}
              onChange={(e) => {
                const val = e.target.value;
                setRoutines(p => p.map(rr => rr.id !== r.id ? rr : {
                  ...rr,
                  days: rr.days.map((dd, ddi) => ddi === di ? { ...dd, label: val } : dd),
                }));
              }}
              placeholder={es ? 'Nombre del día, ej: Pierna A' : 'Day name, e.g. Leg A'}
              style={{
                width: '100%', background: bgBlock, color: textMain,
                border: `1px solid ${border}`, borderRadius: 10,
                padding: '8px 12px', fontSize: 14, fontWeight: 700,
                fontFamily: 'inherit', outline: 'none',
              }}
            />
          </div>

          {/* ── BLOQUE: Entrada en calor ── */}
          <div style={blockStyle(accentWarmup)}>
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: warmupCount > 0 ? 10 : 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 3, height: 16, borderRadius: 2, background: accentWarmup, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: accentWarmup, letterSpacing: 1 }}>
                  {es ? 'ENTRADA EN CALOR' : 'WARM UP'}
                </span>
                {warmupCount > 0 && (
                  <span style={{ fontSize: 11, color: textMuted, fontWeight: 600 }}>({warmupCount})</span>
                )}
              </div>
              <button className="hov" onClick={() => openAddEx('warmup')} style={addBtnStyle(accentWarmup)}>
                <Ic name="plus" size={13} color={accentWarmup} />
                {es ? 'AÑADIR' : 'ADD'}
              </button>
            </div>

            {warmupCount > 0
              ? renderExList(d.warmup || [], 'warmup')
              : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 0 6px', gap: 8 }}>
                  <DumbbellIcon color={accentWarmup + '55'} />
                  <span style={{ fontSize: 12, color: textMuted, textAlign: 'center', lineHeight: 1.5 }}>
                    {es ? 'Sin ejercicios. Usá «Añadir» para sumar calentamiento.' : 'No exercises. Use «Add» to add warm-up.'}
                  </span>
                </div>
              )
            }
          </div>

          {/* ── BLOQUE: Bloque principal ── */}
          <div style={blockStyle(accentMain)}>
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: mainCount > 0 ? 10 : 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 3, height: 16, borderRadius: 2, background: accentMain, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: accentMain, letterSpacing: 1 }}>
                  {es ? 'BLOQUE PRINCIPAL' : 'MAIN BLOCK'}
                </span>
                <span style={{ fontSize: 11, color: textMuted, fontWeight: 600 }}>({mainCount})</span>
              </div>
              <button className="hov" onClick={() => openAddEx('exercises')} style={addBtnStyle(accentMain)}>
                <Ic name="plus" size={13} color={accentMain} />
                {es ? 'AÑADIR' : 'ADD'}
              </button>
            </div>

            {mainCount > 0
              ? renderExList(d.exercises || [], 'exercises')
              : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 0 6px', gap: 8 }}>
                  <DumbbellIcon color={accentMain + '55'} />
                  <span style={{ fontSize: 12, color: textMuted, textAlign: 'center', lineHeight: 1.5 }}>
                    {es ? 'Sin ejercicios. Usá «Añadir» para sumar al bloque principal.' : 'No exercises. Use «Add» for the main block.'}
                  </span>
                </div>
              )
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tarjeta de rutina ────────────────────────────────────────────────
function RutinaCard({
  r, es, darkMode, border, textMain, textMuted, bgCard, bgSub,
  allEx, PATS, setRoutines, setEditEx, setAddExModal,
  setAddExSearch, setAddExPat, setAddExSelectedIds,
  setDupDayModal, alumnos, sb, setAssignRoutineId, toast2, btn, card, routines,
}) {
  const [collapsed, setCollapsed] = useState(!!r.collapsed);
  const [saving, setSaving]       = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  const totalEx = r.days.reduce((a, d) => a + (d.exercises || []).length + (d.warmup || []).length, 0);

  const handleSave = async () => {
    setSaving(true);
    try {
      const rActual  = routines.find(x => x.id === r.id) || r;
      const payload  = {
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
          setRoutines(p => p.map(rr => rr.id === rActual.id ? { ...rr, id: res[0].id, saved: true } : rr));
        }
      }
      setLastSaved(new Date());
      toast2(es ? 'Rutina guardada ✓' : 'Routine saved ✓');
    } catch (e) {
      toast2('Error al guardar');
    }
    setSaving(false);
  };

  const bgHeader  = darkMode ? '#111C2B' : '#EEF2F7';

  // ── Botón de acción sutil (duplicar / eliminar) ───────────────────
  const ghostBtn = (hoverColor) => ({
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
            <div style={{ fontSize: 22, fontWeight: 900, color: textMain, lineHeight: 1.1, wordBreak: 'break-word' }}>
              {r.name}
            </div>
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

          {/* Acciones de rutina — sutiles, solo iconos */}
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
                    warmup: (d.warmup || []).map(e => ({ ...e })),
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

            {/* Colapsar / expandir */}
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
              <Ic name={collapsed ? 'chevron-down' : 'chevron-up'} size={15} color={textMuted} />
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

          {/* ── Botón GUARDAR — único elemento de acción destacado ── */}
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
            {saving
              ? (
                <>
                  {/* Spinner SVG inline */}
                  <svg
                    width="14" height="14" viewBox="0 0 24 24"
                    fill="none" stroke="#fff" strokeWidth="2.5"
                    strokeLinecap="round"
                    style={{ animation: 'spin .7s linear infinite' }}
                  >
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                  {es ? 'GUARDANDO' : 'SAVING'}
                </>
              )
              : (
                <>
                  <Ic name="save" size={14} color="#fff" />
                  {es ? 'GUARDAR' : 'SAVE'}
                </>
              )
            }
          </button>
        </div>

        {lastSaved && (
          <div style={{ fontSize: 11, color: textMuted, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Ic name="check-circle" size={11} color="#22C55E" />
            {es ? 'Guardado a las' : 'Saved at'} {lastSaved.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>

      {/* ── Días (acordeones) ── */}
      {!collapsed && (
        <div style={{ padding: '12px 16px 16px' }}>
          {r.days.map((d, di) => (
            <DayAccordion
              key={`${di}-${(d.exercises || []).length}-${(d.warmup || []).length}`}
              r={r} d={d} di={di}
              es={es} darkMode={darkMode} border={border}
              textMain={textMain} textMuted={textMuted} bgSub={bgSub}
              allEx={allEx} PATS={PATS}
              setRoutines={setRoutines} setEditEx={setEditEx}
              setAddExModal={setAddExModal} setAddExSearch={setAddExSearch}
              setAddExPat={setAddExPat} setAddExSelectedIds={setAddExSelectedIds}
              setDupDayModal={setDupDayModal} toast2={toast2} btn={btn}
            />
          ))}
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

  return (
    <>
      {/* Keyframe para spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ paddingBottom: 24 }}>

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
          <Ic name="camera" size={16} />
          {es ? 'ESCANEAR RUTINA EXISTENTE' : 'SCAN EXISTING ROUTINE'}
        </button>

        {/* ── Botón nueva rutina ── */}
        <button className="hov" style={{
          width: '100%', marginBottom: 16, padding: '14px',
          background: '#2563EB', border: 'none',
          borderRadius: 12, color: '#fff', fontSize: 17, fontWeight: 800,
          cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          minHeight: 52,
        }} onClick={() => setNewR({
          templateId: 'blank', name: '', numDays: 3,
          days: emptyDays(3, es), note: '', alumno: '', showAdvanced: false,
        })}>
          <Ic name="plus" size={18} color="#fff" />
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
              allEx={allEx} PATS={PATS}
              setRoutines={setRoutines} setEditEx={setEditEx}
              setAddExModal={setAddExModal} setAddExSearch={setAddExSearch}
              setAddExPat={setAddExPat} setAddExSelectedIds={setAddExSelectedIds}
              setDupDayModal={setDupDayModal}
              alumnos={alumnos} sb={sb} setAssignRoutineId={setAssignRoutineId}
              toast2={toast2} btn={btn} card={card} routines={routines}
            />
          ))
        )}
      </div>
    </>
  );
}
