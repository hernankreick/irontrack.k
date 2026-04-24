import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Save, Pencil, MoreVertical, ChevronDown } from 'lucide-react';
import { Ic } from '../Ic.jsx';
import { DaySection } from '../DaySection.jsx';
import { resolveExerciseTitle, pickVideoUrl, sanitizeRoutineDaysForWrite } from '../../lib/exerciseResolve.js';
import { coachType as T, coachSpace as S } from '../coachUiScale.js';
import { irontrackMsg as M } from '../../lib/irontrackMsg.js';
import './routines-ui.css';

const uid = () => Math.random().toString(36).slice(2, 9);

function routineDayDisplayName(d, di, lang) {
  var raw = d.label != null ? String(d.label).trim() : '';
  if (!raw) return M(lang, 'Día', 'Day', 'Dia') + ' ' + (di + 1);
  var mm = raw.match(/^(Día|Day|Dia)\s+(\d+)$/i);
  if (mm) return M(lang, 'Día', 'Day', 'Dia') + ' ' + mm[2];
  return raw;
}

export function RoutineCard({
  r,
  es,
  lang,
  darkMode,
  border,
  textMain,
  textMuted,
  bgCard,
  bgSub,
  allEx,
  setRoutines,
  toast2,
  card,
  routines,
  setDupDayModal,
  alumnos,
  sb,
  setAssignRoutineId,
  setHasUnsaved,
  setEditingExercise,
  onOpenLibrary,
  cardIndex = 0,
}) {
  const [collapsed, setCollapsed] = useState(!!r.collapsed);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [nombreLocal, setNombreLocal] = useState(r.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const assignTriggerRef = useRef(null);
  const assignPopoverRef = useRef(null);
  const [assignPopCoords, setAssignPopCoords] = useState(null);
  const [selectedAlumnoIds, setSelectedAlumnoIds] = useState(function () {
    return r.alumno_id != null && r.alumno_id !== '' ? [String(r.alumno_id)] : [];
  });

  useEffect(
    function () {
      setSelectedAlumnoIds(r.alumno_id != null && r.alumno_id !== '' ? [String(r.alumno_id)] : []);
    },
    [r.id]
  );

  useEffect(() => {
    if (!menuOpen) return undefined;
    function onDoc(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return function () {
      document.removeEventListener('mousedown', onDoc);
    };
  }, [menuOpen]);

  var updateAssignPopCoords = useCallback(function () {
    var el = assignTriggerRef.current;
    if (!el) return;
    var rect = el.getBoundingClientRect();
    var gap = 8;
    var pad = 10;
    var vh = window.innerHeight;
    var vw = window.innerWidth;
    var belowSpace = vh - rect.bottom - gap - pad;
    var aboveSpace = rect.top - gap - pad;
    var want = 300;
    var maxH = Math.min(want, belowSpace);
    var top = rect.bottom + gap;
    if (maxH < 100 && aboveSpace > belowSpace) {
      maxH = Math.min(want, aboveSpace);
      top = rect.top - gap - maxH;
      if (top < pad) top = pad;
    }
    maxH = Math.max(120, maxH);
    var left = rect.left;
    var width = Math.max(rect.width, 200);
    if (left + width > vw - pad) left = Math.max(pad, vw - pad - width);
    if (left < pad) left = pad;
    setAssignPopCoords({ top: top, left: left, width: width, maxHeight: maxH });
  }, []);

  useLayoutEffect(
    function () {
      if (!assignOpen) {
        setAssignPopCoords(null);
        return undefined;
      }
      updateAssignPopCoords();
      var raf = requestAnimationFrame(updateAssignPopCoords);
      function onWin() {
        updateAssignPopCoords();
      }
      window.addEventListener('resize', onWin);
      window.addEventListener('scroll', onWin, true);
      return function () {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', onWin);
        window.removeEventListener('scroll', onWin, true);
      };
    },
    [assignOpen, updateAssignPopCoords]
  );

  useEffect(() => {
    if (!assignOpen) return undefined;
    function onDoc(e) {
      var t = assignTriggerRef.current;
      var p = assignPopoverRef.current;
      if (t && t.contains(e.target)) return;
      if (p && p.contains(e.target)) return;
      setAssignOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return function () {
      document.removeEventListener('mousedown', onDoc);
    };
  }, [assignOpen]);

  const guardarNombreRutina = () => {
    setEditandoNombre(false);
    setRoutines((p) => p.map((rr) => (rr.id === r.id ? { ...rr, name: nombreLocal } : rr)));
    setHasUnsaved(true);
  };

  const totalEx = r.days.reduce(
    (a, d) => a + (d.exercises || []).length + (d.warmup || []).length,
    0
  );

  function alumnoNombreById(aid) {
    if (aid == null || aid === '') return '';
    var a = alumnos.find(function (x) {
      return String(x.id) === String(aid);
    });
    return (a && (a.nombre || a.email)) || '';
  }

  function assigneeButtonLabel() {
    if (selectedAlumnoIds.length === 0) {
      return M(lang, 'Elegir alumnos…', 'Choose athletes…', 'Escolher alunos…');
    }
    if (selectedAlumnoIds.length === 1) {
      return alumnoNombreById(selectedAlumnoIds[0]) || selectedAlumnoIds[0];
    }
    return (
      String(selectedAlumnoIds.length) +
      ' ' +
      M(lang, 'alumnos', 'athletes', 'alunos')
    );
  }

  function toggleAlumnoSelection(aid) {
    var key = String(aid);
    setSelectedAlumnoIds(function (prev) {
      var have = prev.some(function (x) {
        return String(x) === key;
      });
      var next = have
        ? prev.filter(function (x) {
            return String(x) !== key;
          })
        : prev.concat([key]);
      setHasUnsaved(true);
      return next;
    });
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      const rActual = routines.find((x) => x.id === r.id) || r;
      var ids = selectedAlumnoIds.map(String).filter(Boolean);
      var primary = ids.length ? ids[0] : null;
      var daysCopy = sanitizeRoutineDaysForWrite(rActual.days);
      var fechaInicio = new Date().toLocaleDateString('es-AR');
      var primaryName = alumnoNombreById(primary);
      var currentId = rActual.id;
      var isSaved = !!rActual.saved;

      var primaryPayload = {
        nombre: rActual.name,
        alumno_id: primary || null,
        datos: {
          days: daysCopy,
          alumno: primaryName,
          note: rActual.note || '',
        },
        entrenador_id: 'entrenador_principal',
      };

      if (isSaved) {
        await sb.updateRutina(currentId, primaryPayload);
        setRoutines(function (p) {
          return p.map(function (rr) {
            return String(rr.id) === String(currentId)
              ? Object.assign({}, rr, { alumno_id: primary || null, alumno: primaryName })
              : rr;
          });
        });
      } else {
        var res = await sb.createRutina(Object.assign({}, primaryPayload, { fecha_inicio: fechaInicio }));
        if (res && res[0]) {
          currentId = res[0].id;
          isSaved = true;
          setRoutines(function (p) {
            return p.map(function (rr) {
              return String(rr.id) === String(rActual.id)
                ? Object.assign({}, rr, {
                    id: res[0].id,
                    alumno_id: primary || null,
                    alumno: primaryName,
                    saved: true,
                  })
                : rr;
            });
          });
        } else {
          toast2(M(lang, 'Error al guardar', 'Could not save', 'Erro ao salvar'));
          setSaving(false);
          return;
        }
      }

      var newCards = [];
      for (var i = 1; i < ids.length; i++) {
        var aid = ids[i];
        var nm = alumnoNombreById(aid);
        var res2 = await sb.createRutina({
          nombre: rActual.name,
          alumno_id: aid,
          datos: {
            days: daysCopy,
            alumno: nm,
            note: rActual.note || '',
          },
          entrenador_id: 'entrenador_principal',
          fecha_inicio: fechaInicio,
        });
        if (res2 && res2[0]) {
          newCards.push({
            id: res2[0].id,
            name: rActual.name,
            days: rActual.days,
            alumno_id: aid,
            alumno: nm,
            note: rActual.note || '',
            saved: true,
            collapsed: true,
          });
        }
      }
      if (newCards.length) {
        setRoutines(function (p) {
          return p.concat(newCards);
        });
      }

      setSelectedAlumnoIds(primary ? [String(primary)] : []);
      setAssignOpen(false);
      setLastSaved(new Date());
      toast2(
        ids.length > 1
          ? M(
              lang,
              'Rutina asignada a varios alumnos ✓',
              'Routine saved for multiple athletes ✓',
              'Rotina atribuída a vários alunos ✓'
            )
          : M(lang, 'Rutina guardada ✓', 'Routine saved ✓', 'Rotina salva ✓')
      );
    } catch (e) {
      toast2(M(lang, 'Error al guardar', 'Could not save', 'Erro ao salvar'));
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

  const duplicateRoutine = () => {
    setMenuOpen(false);
    const copia = {
      ...r,
      id: uid(),
      name: r.name + ' (copia)',
      days: r.days.map((d) => ({
        ...d,
        warmup: (d.warmup || []).map((e) => ({ ...e })),
        exercises: (d.exercises || []).map((e) => ({ ...e })),
      })),
      collapsed: false,
      saved: false,
    };
    setRoutines((p) => [...p, copia]);
    setAssignRoutineId(copia.id);
    toast2(M(lang, 'Rutina duplicada', 'Routine duplicated', 'Rotina duplicada') + ' ✓');
  };

  const deleteRoutine = () => {
    setMenuOpen(false);
    if (!confirm(M(lang, `¿Eliminar "${r.name}"?`, `Delete "${r.name}"?`, `Excluir "${r.name}"?`))) return;
    setRoutines((p) => p.filter((x) => x.id !== r.id));
    toast2(M(lang, 'Rutina eliminada', 'Routine deleted', 'Rotina excluída') + ' ✓');
  };

  const staggerMs = Math.min(cardIndex * 40, 80);

  return (
    <div
      className="it-routine-card-wrap routines-card-enter"
      style={{
        ...card,
        padding: 0,
        overflow: 'hidden',
        marginBottom: S.blockGap,
        ['--stagger-delay']: staggerMs + 'ms',
      }}
    >
      <div style={{ background: bgHeader, padding: `${S.gridGapTight}px ${S.cardPadding}px ${S.blockGap}px` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {editandoNombre ? (
              <input
                autoFocus
                value={nombreLocal}
                onChange={(e) => setNombreLocal(e.target.value)}
                onBlur={guardarNombreRutina}
                onKeyDown={(e) => e.key === 'Enter' && guardarNombreRutina()}
                style={{
                  ...T.numberStat,
                  color: textMain,
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid #3b82f6',
                  outline: 'none',
                  padding: '2px 0',
                  fontFamily: 'inherit',
                  width: '100%',
                }}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ ...T.numberStat, color: textMain, lineHeight: 1.1, wordBreak: 'break-word' }}>
                  {nombreLocal}
                </div>
                <button
                  type="button"
                  onClick={() => setEditandoNombre(true)}
                  className="it-routine-btn"
                  style={{
                    width: 44,
                    height: 44,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 8,
                    flexShrink: 0,
                  }}
                >
                  <Pencil size={15} />
                </button>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                gap: S.gridTight,
                marginTop: 6,
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              {selectedAlumnoIds.length > 0 ? (
                <span
                  className="it-routine-badge--assigned"
                  style={{
                    background: '#22C55E18',
                    color: '#4ade80',
                    border: '1px solid rgba(74, 222, 128, 0.35)',
                    borderRadius: 6,
                    padding: '3px 8px',
                    ...T.tableHeader,
                    fontSize: 10,
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {M(lang, 'Asignada', 'Assigned', 'Atribuída')}
                </span>
              ) : (
                <span
                  className="it-routine-badge--unassigned"
                  style={{
                    background: 'rgba(15, 23, 42, 0.65)',
                    color: '#94a3b8',
                    border: `1px solid ${border}`,
                    borderRadius: 6,
                    padding: '3px 8px',
                    ...T.tableHeader,
                    fontSize: 10,
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {M(lang, 'Sin asignar', 'Unassigned', 'Não atribuída')}
                </span>
              )}
              <span style={{ ...T.meta, color: textMuted, fontWeight: 600 }}>
                {r.days.length} {M(lang, 'días', 'days', 'dias')} · {totalEx}{' '}
                {M(lang, 'ejercicios', 'exercises', 'exercícios')}
              </span>
              {r.scanned && (
                <span
                  style={{
                    background: '#2563EB22',
                    color: '#2563EB',
                    border: '1px solid #60a5fa33',
                    borderRadius: 6,
                    padding: '2px 8px',
                    ...T.tableHeader,
                    letterSpacing: '0.04em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Ic name="image" size={11} color="#2563EB" />
                  {M(lang, 'Escaneada', 'Scanned', 'Digitalizada')}
                </span>
              )}
              {r.saved && (
                <span
                  style={{
                    background: '#22C55E15',
                    color: '#22C55E',
                    borderRadius: 6,
                    padding: '2px 8px',
                    ...T.tableHeader,
                    letterSpacing: '0.04em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Ic name="check" size={11} color="#22C55E" />
                  {M(lang, 'GUARDADA', 'SAVED', 'SALVA')}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'flex-start' }}>
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button
                type="button"
                className="it-routine-btn hov"
                style={ghostBtn()}
                aria-expanded={menuOpen}
                aria-haspopup="true"
                onClick={() => setMenuOpen((o) => !o)}
                title={M(lang, 'Más acciones', 'More actions', 'Mais ações')}
              >
                <MoreVertical size={18} color={textMuted} />
              </button>
              {menuOpen ? (
                <div
                  className="it-routine-menu-pop is-open"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 6,
                    minWidth: 188,
                    background: darkMode ? '#0f172a' : '#fff',
                    border: `1px solid ${border}`,
                    borderRadius: 10,
                    boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
                    padding: 4,
                    zIndex: 20,
                  }}
                >
                  <button
                    type="button"
                    className="it-routine-menu-item hov"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 12px',
                      border: 'none',
                      borderRadius: 8,
                      background: 'transparent',
                      color: textMain,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                    onClick={() => {
                      setMenuOpen(false);
                      setEditandoNombre(true);
                    }}
                  >
                    <Pencil size={14} color={textMuted} />
                    {M(lang, 'Editar nombre', 'Edit name', 'Editar nome')}
                  </button>
                  <button
                    type="button"
                    className="it-routine-menu-item hov"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 12px',
                      border: 'none',
                      borderRadius: 8,
                      background: 'transparent',
                      color: textMain,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                    onClick={duplicateRoutine}
                  >
                    <Ic name="copy" size={14} color={textMuted} />
                    {M(lang, 'Duplicar rutina', 'Duplicate routine', 'Duplicar rotina')}
                  </button>
                  <button
                    type="button"
                    className="it-routine-menu-item it-routine-menu-item--danger hov"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 12px',
                      border: 'none',
                      borderRadius: 8,
                      background: 'transparent',
                      color: '#f87171',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                    onClick={deleteRoutine}
                  >
                    <Ic name="trash-2" size={14} color="#f87171" />
                    {M(lang, 'Eliminar rutina', 'Delete routine', 'Excluir rotina')}
                  </button>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className="it-routine-btn hov"
              onClick={() => setCollapsed((c) => !c)}
              style={{
                background: darkMode ? '#1E2D40' : '#E2E8F0',
                border: `1px solid ${darkMode ? 'transparent' : border}`,
                borderRadius: 8,
                padding: '7px 10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                ...T.label,
                fontWeight: 700,
                color: textMuted,
                letterSpacing: '.5px',
                minHeight: 36,
              }}
            >
              {collapsed ? (
                <svg
                  width={15}
                  height={15}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={textMuted}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ) : (
                <Ic name="chevron-up" size={15} color={textMuted} />
              )}
              {collapsed
                ? M(lang, 'Ver rutina', 'View routine', 'Ver rotina')
                : M(lang, 'Cerrar', 'Close', 'Fechar')}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: S.gridTight, marginTop: S.blockGap, alignItems: 'stretch' }}>
          <div ref={assignTriggerRef} style={{ flex: 1, minWidth: 0 }}>
            <button
              type="button"
              className="it-routine-btn hov"
              onClick={() => setAssignOpen((o) => !o)}
              aria-expanded={assignOpen}
              aria-haspopup="listbox"
              style={{
                width: '100%',
                textAlign: 'left',
                background: darkMode ? '#0B1220' : '#fff',
                color: textMain,
                border: `1px solid ${border}`,
                borderRadius: 10,
                padding: '10px 38px 10px 12px',
                ...T.control,
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                cursor: 'pointer',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {assigneeButtonLabel()}
              </span>
              <ChevronDown
                size={18}
                aria-hidden
                style={{ color: textMuted, flexShrink: 0, transform: assignOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}
              />
            </button>
          </div>

          <button
            type="button"
            className="it-routine-btn hov"
            onClick={handleSave}
            disabled={saving}
            style={{
              background: saving ? '#1d4ed8' : '#2563EB',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '8px 16px',
              ...T.periodTab,
              fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              opacity: saving ? 0.85 : 1,
              letterSpacing: '.5px',
              minWidth: 110,
              justifyContent: 'center',
            }}
          >
            {saving ? (
              <>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  style={{ animation: 'spin .7s linear infinite' }}
                >
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                {M(lang, 'GUARDANDO', 'SAVING', 'SALVANDO')}
              </>
            ) : (
              <>
                <Ic name="save" size={14} color="#fff" />
                {M(lang, 'GUARDAR', 'SAVE', 'SALVAR')}
              </>
            )}
          </button>
        </div>

        {lastSaved && (
          <div style={{ ...T.meta, color: textMuted, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Ic name="check-circle" size={11} color="#22C55E" />
            {M(lang, 'Guardado a las', 'Saved at', 'Salvo às')}{' '}
            {lastSaved.toLocaleTimeString(
              lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-BR' : 'es-AR',
              { hour: '2-digit', minute: '2-digit' }
            )}
          </div>
        )}
      </div>

      {!collapsed && (
        <div style={{ padding: `${S.gridGapTight}px ${S.cardPadding}px ${S.gridGap}px` }}>
          {r.days.map((d, di) => {
            const enrichList = (list) =>
              (list || []).map((ex) => {
                const lib = allEx.find((e) => e.id === ex.id);
                const vu = pickVideoUrl(lib) || pickVideoUrl(ex);
                const nm = resolveExerciseTitle(lib || null, ex, es);
                const nameEnFallback = lib?.nameEn || ex.nameEn || lib?.name || ex.name || nm;
                const { youtube: _y, videoUrl: _vv, youtube_url: _yu, ...exRest } = ex;
                return {
                  ...exRest,
                  id: ex.id || uid(),
                  name: nm,
                  nameEn: nameEnFallback,
                  video_url: vu,
                  isCustom:
                    lib?.isCustom === true ||
                    String(ex.id || '').indexOf('custom_') === 0 ||
                    !!ex.isCustom,
                };
              });

            return (
              <DaySection
                key={di}
                lang={lang}
                darkMode={darkMode}
                textMain={textMain}
                textMuted={textMuted}
                premiumAddButtonClass="it-routine-btn it-routine-btn--ghost"
                day={{
                  id: di,
                  name: routineDayDisplayName(d, di, lang),
                  warmup: enrichList(d.warmup),
                  exercises: enrichList(d.exercises),
                }}
                onCopyDay={() => {
                  if (r.days.length < 2) {
                    toast2(M(lang, 'No hay otros días', 'No other days', 'Não há outros dias'));
                    return;
                  }
                  setDupDayModal({ rId: r.id, dIdx: di, days: r.days, selected: [], sourceDay: d });
                }}
                onDeleteDay={() => {
                  if (
                    !confirm(
                      M(
                        lang,
                        `¿Eliminar "${d.label || `Día ${di + 1}`}"?`,
                        `Delete "${d.label || `Day ${di + 1}`}"?`,
                        `Excluir "${d.label || `Dia ${di + 1}`}"?`
                      )
                    )
                  ) {
                    return;
                  }
                  setRoutines((p) =>
                    p.map((rr) =>
                      rr.id !== r.id
                        ? rr
                        : {
                            ...rr,
                            days: rr.days.filter((_, i) => i !== di),
                          }
                    )
                  );
                  setHasUnsaved(true);
                }}
                onAddWarmup={() => onOpenLibrary(r.id, di, 'warmup')}
                onAddExercise={() => onOpenLibrary(r.id, di, 'exercises')}
                onRenameDay={(_, nuevoNombre) => {
                  setRoutines((p) =>
                    p.map((rr) =>
                      rr.id !== r.id
                        ? rr
                        : {
                            ...rr,
                            days: rr.days.map((dd, ddi) =>
                              ddi !== di ? dd : { ...dd, label: nuevoNombre }
                            ),
                          }
                    )
                  );
                  setHasUnsaved(true);
                }}
                onEditExercise={(exercise) => {
                  const inWarmup = (d.warmup || []).some((ex) => ex.id === exercise.id);
                  setEditingExercise({
                    routineId: r.id,
                    dayIdx: di,
                    bloque: inWarmup ? 'warmup' : 'exercises',
                    exercise,
                  });
                }}
                onDeleteExercise={(exerciseId) => {
                  setRoutines((p) =>
                    p.map((rr) =>
                      rr.id !== r.id
                        ? rr
                        : {
                            ...rr,
                            days: rr.days.map((dd, ddi) =>
                              ddi !== di
                                ? dd
                                : {
                                    ...dd,
                                    warmup: (dd.warmup || []).filter((ex) => ex.id !== exerciseId),
                                    exercises: (dd.exercises || []).filter((ex) => ex.id !== exerciseId),
                                  }
                            ),
                          }
                    )
                  );
                  setHasUnsaved(true);
                }}
                onReorderWarmup={(newList) => {
                  setRoutines((p) =>
                    p.map((rr) =>
                      rr.id !== r.id
                        ? rr
                        : {
                            ...rr,
                            days: rr.days.map((dd, ddi) =>
                              ddi !== di ? dd : { ...dd, warmup: newList }
                            ),
                          }
                    )
                  );
                  setHasUnsaved(true);
                }}
                onReorderExercises={(newList) => {
                  setRoutines((p) =>
                    p.map((rr) =>
                      rr.id !== r.id
                        ? rr
                        : {
                            ...rr,
                            days: rr.days.map((dd, ddi) =>
                              ddi !== di ? dd : { ...dd, exercises: newList }
                            ),
                          }
                    )
                  );
                  setHasUnsaved(true);
                }}
              />
            );
          })}
        </div>
      )}

      {assignOpen &&
        assignPopCoords &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={assignPopoverRef}
            role="listbox"
            aria-multiselectable="true"
            className="it-routine-assign-pop it-routine-assign-pop--portal"
            style={{
              position: 'fixed',
              top: assignPopCoords.top,
              left: assignPopCoords.left,
              width: assignPopCoords.width,
              maxHeight: assignPopCoords.maxHeight,
              overflowY: 'auto',
              zIndex: 80,
              background: darkMode ? '#0f172a' : '#fff',
              border: '1px solid ' + border,
              borderRadius: 10,
              boxShadow: '0 20px 50px rgba(0,0,0,0.55)',
              padding: '6px 0',
            }}
          >
            <div
              style={{
                padding: '6px 12px 8px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                color: textMuted,
                textTransform: 'uppercase',
              }}
            >
              {M(lang, 'Asignar a', 'Assign to', 'Atribuir a')}
            </div>
            {alumnos.length === 0 ? (
              <div style={{ padding: '10px 12px', fontSize: 13, color: textMuted }}>
                {M(lang, 'No hay alumnos cargados', 'No athletes yet', 'Ainda sem alunos')}
              </div>
            ) : (
              alumnos.map(function (a) {
                var checked = selectedAlumnoIds.some(function (id) {
                  return String(id) === String(a.id);
                });
                return (
                  <label
                    key={String(a.id)}
                    className="it-routine-assign-row hov"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: 14,
                      color: textMain,
                      fontFamily: 'inherit',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAlumnoSelection(a.id)}
                      style={{ width: 16, height: 16, accentColor: '#2563eb', flexShrink: 0, cursor: 'pointer' }}
                    />
                    <span style={{ flex: 1, minWidth: 0, fontWeight: 600 }}>{a.nombre || a.email}</span>
                  </label>
                );
              })
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
