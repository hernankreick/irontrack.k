import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Save, Pencil, MoreVertical, ChevronDown, ClipboardList } from 'lucide-react';
import { DeleteConfirmModal } from '../DeleteConfirmModal.jsx';
import { Ic } from '../Ic.jsx';
import { DaySection } from '../DaySection.jsx';
import { resolveExerciseTitle, pickVideoUrl, sanitizeRoutineDaysForWrite } from '../../lib/exerciseResolve.js';
import { coachType as T, coachSpace as S } from '../coachUiScale.js';
import { irontrackMsg as M } from '../../lib/irontrackMsg.js';
import './routines-ui.css';

const uid = () => Math.random().toString(36).slice(2, 9);

const dayUid = () => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch (e) {}
  return 'day_' + uid();
};

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
  setRutinasSBEntrenador,
  rutinasSBEntrenador = [],
}) {
  const [collapsed, setCollapsed] = useState(!!r.collapsed);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [nombreLocal, setNombreLocal] = useState(r.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const menuDropdownRef = useRef(null);
  const cardRootRef = useRef(null);
  const [menuPopCoords, setMenuPopCoords] = useState(null);
  const [deleteRoutineTarget, setDeleteRoutineTarget] = useState(null);
  const [deleteRoutineSubmitting, setDeleteRoutineSubmitting] = useState(false);
  const [pendingDeleteDay, setPendingDeleteDay] = useState(null);
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

  var updateMenuPopCoords = useCallback(function () {
    var el = menuRef.current;
    if (!el) return;
    var rect = el.getBoundingClientRect();
    var menuW = 200;
    var approxH = 200;
    var gap = 6;
    var pad = 8;
    var vh = window.innerHeight;
    var vw = window.innerWidth;
    var left = rect.right - menuW;
    if (left < pad) left = pad;
    if (left + menuW > vw - pad) left = Math.max(pad, vw - pad - menuW);
    var top = rect.bottom + gap;
    if (top + approxH > vh - pad && rect.top - gap - approxH >= pad) {
      top = rect.top - approxH - gap;
    } else if (top + approxH > vh - pad) {
      top = Math.max(pad, vh - pad - approxH);
    }
    setMenuPopCoords({ top: top, left: left, width: menuW });
  }, []);

  useLayoutEffect(
    function () {
      if (!menuOpen) {
        setMenuPopCoords(null);
        return undefined;
      }
      updateMenuPopCoords();
      var raf = requestAnimationFrame(updateMenuPopCoords);
      function onWin() {
        updateMenuPopCoords();
      }
      window.addEventListener('resize', onWin);
      window.addEventListener('scroll', onWin, true);
      return function () {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', onWin);
        window.removeEventListener('scroll', onWin, true);
      };
    },
    [menuOpen, updateMenuPopCoords]
  );

  useEffect(() => {
    if (!menuOpen) return undefined;
    function onDoc(e) {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      if (menuDropdownRef.current && menuDropdownRef.current.contains(e.target)) return;
      setMenuOpen(false);
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
    var padRow = 28;
    var cb = 26;
    var charPx = 7.1;
    var measureRow = function (s) {
      return Math.ceil(String(s || '').length * charPx) + cb + padRow;
    };
    var hdr = M(lang, 'Asignar a', 'Assign to', 'Atribuir a');
    var wPop = Math.ceil(hdr.length * 6) + padRow;
    if (!alumnos.length) {
      wPop = Math.max(
        wPop,
        measureRow(M(lang, 'No hay alumnos cargados', 'No athletes yet', 'Ainda sem alunos'))
      );
    } else {
      for (var i = 0; i < alumnos.length; i++) {
        var ax = alumnos[i];
        var nm = (ax && (ax.nombre || ax.email)) || '';
        wPop = Math.max(wPop, measureRow(nm));
      }
    }
    var btnLabel = '';
    if (selectedAlumnoIds.length === 0) {
      btnLabel = M(lang, 'Elegir alumnos…', 'Choose athletes…', 'Escolher alunos…');
    } else if (selectedAlumnoIds.length === 1) {
      var aid0 = selectedAlumnoIds[0];
      var a0 = alumnos.find(function (x) {
        return String(x.id) === String(aid0);
      });
      btnLabel = (a0 && (a0.nombre || a0.email)) || String(aid0);
    } else {
      btnLabel =
        String(selectedAlumnoIds.length) + ' ' + M(lang, 'alumnos', 'athletes', 'alunos');
    }
    wPop = Math.max(wPop, measureRow(btnLabel) + 28, 168);
    var maxCap = Math.min(420, vw - pad * 2);
    var width = Math.min(wPop + 10, maxCap);
    var left = rect.left;
    if (left + width > vw - pad) left = Math.max(pad, vw - pad - width);
    if (left < pad) left = pad;
    setAssignPopCoords({ top: top, left: left, width: width, maxHeight: maxH });
  }, [alumnos, lang, selectedAlumnoIds]);

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
    [assignOpen, updateAssignPopCoords, selectedAlumnoIds]
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

  const openEditRoutine = useCallback(
    function () {
      setMenuOpen(false);
      setCollapsed(false);
      setRoutines(function (p) {
        return p.map(function (rr) {
          return String(rr.id) === String(r.id) ? Object.assign({}, rr, { collapsed: false }) : rr;
        });
      });
      requestAnimationFrame(function () {
        if (cardRootRef.current) {
          cardRootRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      });
    },
    [r.id, setRoutines]
  );

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

  function runDeleteDay() {
    if (!pendingDeleteDay) return;
    var di = pendingDeleteDay.di;
    setPendingDeleteDay(null);
    setRoutines(function (p) {
      return p.map(function (rr) {
        if (rr.id !== r.id) return rr;
        return Object.assign({}, rr, {
          days: rr.days.filter(function (_, i) {
            return i !== di;
          }),
        });
      });
    });
    setHasUnsaved(true);
  }

  function addEmptyDay() {
    setRoutines(function (prev) {
      return prev.map(function (rr) {
        if (rr.id !== r.id) return rr;
        var currentDays = Array.isArray(rr.days) ? rr.days : [];
        var nextNum = currentDays.length + 1;
        var dayName = M(lang, 'Día', 'Day', 'Dia') + ' ' + nextNum;
        return Object.assign({}, rr, {
          days: currentDays.concat([
            {
              id: dayUid(),
              label: dayName,
              name: dayName,
              title: dayName,
              warmup: [],
              exercises: [],
              notes: '',
              config: {},
            },
          ]),
        });
      });
    });
    setHasUnsaved(true);
    toast2(M(lang, 'Día agregado', 'Day added', 'Dia adicionado'));
  }

  const confirmDeleteRoutine = async function () {
    if (!deleteRoutineTarget || deleteRoutineSubmitting) return;
    var id = deleteRoutineTarget.id;
    var wasSaved = !!deleteRoutineTarget.saved;
    setDeleteRoutineSubmitting(true);
    try {
      if (wasSaved && sb && typeof sb.deleteRutina === 'function') {
        await sb.deleteRutina(id);
        if (typeof setRutinasSBEntrenador === 'function') {
          try {
            var fresh = await sb.getRutinasByEntrenador();
            if (Array.isArray(fresh)) {
              setRutinasSBEntrenador(fresh);
            } else {
              setRutinasSBEntrenador(function (prev) {
                return (prev || []).filter(function (x) {
                  return String(x.id) !== String(id);
                });
              });
            }
          } catch (_syncErr) {
            setRutinasSBEntrenador(function (prev) {
              return (prev || []).filter(function (x) {
                return String(x.id) !== String(id);
              });
            });
          }
        }
      }
      setRoutines(function (p) {
        return p.filter(function (x) {
          return String(x.id) !== String(id);
        });
      });
      toast2(M(lang, 'Rutina eliminada', 'Routine deleted', 'Rotina excluída') + ' ✓');
      setDeleteRoutineTarget(null);
    } catch (e) {
      toast2(
        M(
          lang,
          'No se pudo eliminar la rutina. Probá de nuevo.',
          'Could not delete the routine. Please try again.',
          'Não foi possível excluir a rotina. Tente novamente.'
        )
      );
    } finally {
      setDeleteRoutineSubmitting(false);
    }
  };

  const staggerMs = Math.min(cardIndex * 40, 80);

  return (
    <div
      ref={cardRootRef}
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
            </div>
            {menuOpen && menuPopCoords && typeof document !== 'undefined' &&
              createPortal(
                <div
                  ref={menuDropdownRef}
                  className="it-routine-menu-pop is-open it-routine-menu-pop--portal"
                  style={{
                    position: 'fixed',
                    top: menuPopCoords.top,
                    left: menuPopCoords.left,
                    width: menuPopCoords.width,
                    minWidth: menuPopCoords.width,
                    background: darkMode ? '#0f172a' : '#fff',
                    border: `1px solid ${border}`,
                    borderRadius: 10,
                    boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
                    padding: 4,
                    zIndex: 100,
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
                    onClick={openEditRoutine}
                  >
                    <ClipboardList size={14} color={textMuted} />
                    {M(lang, 'Editar rutina', 'Edit routine', 'Editar rotina')}
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
                    onClick={() => {
                      setMenuOpen(false);
                      var onServer =
                        !!r.saved ||
                        (Array.isArray(rutinasSBEntrenador) &&
                          rutinasSBEntrenador.some(function (rs) {
                            return rs && String(rs.id) === String(r.id);
                          }));
                      setDeleteRoutineTarget({
                        id: r.id,
                        name: String(nombreLocal || r.name || '').trim() || null,
                        saved: onServer,
                      });
                    }}
                  >
                    <Ic name="trash-2" size={14} color="#f87171" />
                    {M(lang, 'Eliminar rutina', 'Delete routine', 'Excluir rotina')}
                  </button>
                </div>,
                document.body
              )}

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
          <div
            ref={assignTriggerRef}
            style={{ flex: '0 1 auto', minWidth: 0, maxWidth: 'calc(100% - 118px)' }}
          >
            <button
              type="button"
              className="it-routine-btn hov"
              onClick={() => setAssignOpen((o) => !o)}
              aria-expanded={assignOpen}
              aria-haspopup="listbox"
              style={{
                width: 'max-content',
                maxWidth: '100%',
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
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>
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
          {(Array.isArray(r.days) ? r.days : []).map((d, di) => {
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
                  if (!Array.isArray(r.days) || !r.days[di]) {
                    toast2(M(lang, 'No se pudo duplicar el día', 'Could not duplicate day', 'Não foi possível duplicar o dia'));
                    return;
                  }
                  setDupDayModal({ rId: r.id, dIdx: di, days: r.days, selected: [], sourceDay: d });
                }}
                onDeleteDay={() => {
                  setPendingDeleteDay({
                    di: di,
                    dayLabel: String(d.label || M(lang, `Día ${di + 1}`, `Day ${di + 1}`, `Dia ${di + 1}`)),
                  });
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
          <button
            type="button"
            className="it-routine-btn it-routine-btn--ghost hov"
            onClick={addEmptyDay}
            style={{
              width: '100%',
              marginTop: S.gridGapTight,
              border: `1px dashed ${border}`,
              borderRadius: 10,
              padding: '12px 14px',
              background: darkMode ? 'rgba(37,99,235,0.08)' : 'rgba(37,99,235,0.05)',
              color: '#2563EB',
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Ic name="plus" size={16} color="#2563EB" />
            {M(lang, '+ Agregar día', '+ Add day', '+ Adicionar dia')}
          </button>
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
                    <span
                      style={{
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '100%',
                      }}
                    >
                      {a.nombre || a.email}
                    </span>
                  </label>
                );
              })
            )}
          </div>,
          document.body
        )}

      <DeleteConfirmModal
        open={!!deleteRoutineTarget}
        zIndex={10000}
        tone="danger"
        onCancel={function () {
          if (deleteRoutineSubmitting) return;
          setDeleteRoutineTarget(null);
        }}
        onConfirm={function () {
          void confirmDeleteRoutine();
        }}
        title={M(lang, 'Eliminar rutina', 'Delete routine', 'Excluir rotina')}
        message={M(
          lang,
          'Esta acción no se puede deshacer. La rutina se eliminará definitivamente.',
          'This action cannot be undone. The routine will be permanently deleted.',
          'Esta ação não pode ser desfeita. A rotina será excluída permanentemente.'
        )}
        subjectName={deleteRoutineTarget && deleteRoutineTarget.name}
        confirmLabel={M(lang, 'Eliminar', 'Delete', 'Excluir')}
        cancelLabel={M(lang, 'Cancelar', 'Cancel', 'Cancelar')}
        loading={deleteRoutineSubmitting}
        loadingLabel={M(lang, 'Eliminando…', 'Deleting…', 'Excluindo…')}
      />

      <DeleteConfirmModal
        open={!!pendingDeleteDay}
        zIndex={10000}
        tone="danger"
        onCancel={function () {
          setPendingDeleteDay(null);
        }}
        onConfirm={runDeleteDay}
        title={M(lang, 'Eliminar día', 'Delete day', 'Excluir dia')}
        message={M(
          lang,
          'Esta acción no se puede deshacer. El día se quitará de la rutina.',
          'This action cannot be undone. The day will be removed from the routine.',
          'Esta ação não pode ser desfeita. O dia será removido da rotina.'
        )}
        subjectName={pendingDeleteDay ? pendingDeleteDay.dayLabel : ''}
        confirmLabel={M(lang, 'Eliminar', 'Delete', 'Excluir')}
        cancelLabel={M(lang, 'Cancelar', 'Cancel', 'Cancelar')}
      />
    </div>
  );
}
