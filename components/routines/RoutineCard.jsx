import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, MoreVertical, ChevronDown, ClipboardList, Check, User } from 'lucide-react';
import { Ic } from '../Ic.jsx';
import { DaySection } from '../DaySection.jsx';
import { resolveExerciseTitle, pickVideoUrl, sanitizeRoutineDaysForWrite } from '../../lib/exerciseResolve.js';
import { coachType, coachSpace, coachTypeMobile, coachSpaceMobile } from '../coachUiScale.js';
import { irontrackMsg as M } from '../../lib/irontrackMsg.js';
import { toTitleCase, initialsOf } from '../../lib/textFormat.js';
import RoutineCardActionMenu from './RoutineCardActionMenu.jsx';
import RoutineDeleteConfirmModals from './RoutineDeleteConfirmModals.jsx';
import RoutineCardTitleMeta from './RoutineCardTitleMeta.jsx';
import RoutineRestartModal from './RoutineRestartModal.jsx';
import './routines-ui.css';

function useIsUnder768() {
  const [v, setV] = React.useState(typeof window !== 'undefined' && window.innerWidth < 768);
  React.useEffect(function () {
    var mq = window.matchMedia('(max-width: 767px)');
    function onChange() { setV(mq.matches); }
    mq.addEventListener('change', onChange);
    return function () { mq.removeEventListener('change', onChange); };
  }, []);
  return v;
}

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
  onRestartRoutine,
}) {
  const isUnder768 = useIsUnder768();
  const T = isUnder768 ? coachTypeMobile : coachType;
  const S = isUnder768 ? coachSpaceMobile : coachSpace;
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
  const [restartOpen, setRestartOpen] = useState(false);
  const [restartSubmitting, setRestartSubmitting] = useState(false);
  const [restartError, setRestartError] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);
  const assignTriggerRef = useRef(null);
  const assignPopoverRef = useRef(null);
  const [assignPopCoords, setAssignPopCoords] = useState(null);
  const [selectedAlumnoIds, setSelectedAlumnoIds] = useState(function () {
    return r.alumno_id != null && r.alumno_id !== '' ? [String(r.alumno_id)] : [];
  });
  // Último alumno guardado (para el estado "dirty" del botón Guardar).
  const [savedAlumnoIds, setSavedAlumnoIds] = useState(function () {
    return r.alumno_id != null && r.alumno_id !== '' ? [String(r.alumno_id)] : [];
  });
  const [saveError, setSaveError] = useState('');
  // Firma del contenido (nombre/días/nota) en el último guardado, para no perder
  // la posibilidad de guardar ediciones de días aunque el alumno no cambie.
  const contentSig = JSON.stringify([r.name, r.days, r.note || '']);
  const savedContentSigRef = useRef(contentSig);

  useEffect(
    function () {
      var ids = r.alumno_id != null && r.alumno_id !== '' ? [String(r.alumno_id)] : [];
      setSelectedAlumnoIds(ids);
      setSavedAlumnoIds(ids);
      savedContentSigRef.current = JSON.stringify([r.name, r.days, r.note || '']);
    },
    [r.id]
  );

  var alumnoDirty =
    selectedAlumnoIds.length !== savedAlumnoIds.length ||
    selectedAlumnoIds.some(function (id) {
      return savedAlumnoIds.indexOf(String(id)) === -1;
    });
  var contentDirty = !r.saved || contentSig !== savedContentSigRef.current;
  var isDirty = alumnoDirty || contentDirty;
  var hasAlumno = selectedAlumnoIds.length > 0;
  var headerStatus = alumnoDirty ? 'dirty' : savedAlumnoIds.length > 0 ? 'assigned' : 'none';

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
      return toTitleCase(alumnoNombreById(selectedAlumnoIds[0]) || r.alumno || selectedAlumnoIds[0]);
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
    setSaveError('');
    var saveFailedMsg = M(lang, 'Error al guardar', 'Could not save', 'Erro ao salvar');
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
        es_plantilla: !!rActual.es_plantilla,
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
          setSaveError(saveFailedMsg);
          toast2(saveFailedMsg);
          setSaving(false);
          return;
        }
      }

      var newCards = [];
      if (ids.length > 1) {
        var extraResults = await Promise.all(
          ids.slice(1).map(function (xid) {
            var xnm = alumnoNombreById(xid);
            return sb.createRutina({
              nombre: rActual.name,
              alumno_id: xid,
              datos: { days: daysCopy, alumno: xnm, note: rActual.note || '' },
              fecha_inicio: fechaInicio,
            }).then(function (res2) {
              return { res2: res2, aid: xid, nm: xnm };
            });
          })
        );
        for (var xi = 0; xi < extraResults.length; xi++) {
          var xr = extraResults[xi];
          if (xr.res2 && xr.res2[0]) {
            newCards.push({
              id: xr.res2[0].id,
              name: rActual.name,
              days: rActual.days,
              alumno_id: xr.aid,
              alumno: xr.nm,
              note: rActual.note || '',
              saved: true,
              collapsed: true,
            });
          }
        }
      }
      if (newCards.length) {
        setRoutines(function (p) {
          return p.concat(newCards);
        });
      }

      setSelectedAlumnoIds(primary ? [String(primary)] : []);
      setSavedAlumnoIds(primary ? [String(primary)] : []);
      savedContentSigRef.current = JSON.stringify([rActual.name, rActual.days, rActual.note || '']);
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
      setSaveError(saveFailedMsg);
      toast2(saveFailedMsg);
    }
    setSaving(false);
  };

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

  function requestDeleteRoutine() {
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
  }

  // "Reiniciar rutina" solo aplica a una rutina asignada a un alumno y ya guardada en el servidor.
  var assignedAlumnoId = r.alumno_id != null && r.alumno_id !== '' ? String(r.alumno_id) : '';
  var restartAlumno = assignedAlumnoId
    ? (alumnos || []).find(function (a) {
        return String(a.id) === assignedAlumnoId;
      })
    : null;
  var restartAlumnoName = (restartAlumno && (restartAlumno.nombre || restartAlumno.email)) || r.alumno || '';
  var canRestart =
    !!assignedAlumnoId &&
    !r.es_plantilla &&
    typeof onRestartRoutine === 'function' &&
    (!!r.saved ||
      (Array.isArray(rutinasSBEntrenador) &&
        rutinasSBEntrenador.some(function (rs) {
          return rs && String(rs.id) === String(r.id);
        })));

  function requestRestartRoutine() {
    setMenuOpen(false);
    setRestartError('');
    setRestartOpen(true);
  }

  function restartErrorText(res) {
    var reason = res && res.reason;
    if (reason === 'migracion_pendiente') {
      return M(
        lang,
        'Falta actualizar la base de datos (migración de ciclo). Avisá al administrador.',
        'The database needs the cycle migration first. Contact the administrator.',
        'Falta atualizar o banco de dados (migração de ciclo). Avise o administrador.'
      );
    }
    if (reason === 'sin_filas') {
      return M(lang, 'No tenés permiso para reiniciar esta rutina.', 'You do not have permission to restart this routine.', 'Você não tem permissão para reiniciar esta rotina.');
    }
    if (reason === 'no_asignada' || reason === 'alumno_distinto' || reason === 'rutina_inexistente') {
      return M(lang, 'La rutina ya no está asignada a este alumno.', 'The routine is no longer assigned to this athlete.', 'A rotina não está mais atribuída a este aluno.');
    }
    return M(lang, 'No se pudo reiniciar la rutina. Probá de nuevo.', 'Could not restart the routine. Please try again.', 'Não foi possível reiniciar a rotina. Tente novamente.');
  }

  const confirmRestartRoutine = async function (cargas) {
    if (restartSubmitting || !canRestart) return;
    setRestartSubmitting(true);
    setRestartError('');
    try {
      var res = await onRestartRoutine(r.id, cargas);
      if (res && res.ok) {
        setRestartOpen(false);
        toast2(M(lang, 'Rutina reiniciada ✓ Semana 1, Día 1', 'Routine restarted ✓ Week 1, Day 1', 'Rotina reiniciada ✓ Semana 1, Dia 1'));
      } else {
        var text = restartErrorText(res);
        setRestartError(text);
        toast2(text);
      }
    } catch (e) {
      console.error('[restart routine]', e);
      var text2 = restartErrorText(null);
      setRestartError(text2);
      toast2(text2);
    } finally {
      setRestartSubmitting(false);
    }
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

  const saveLabel = saving
    ? M(lang, 'Guardando', 'Saving', 'Salvando')
    : !isDirty
      ? M(lang, 'Guardado', 'Saved', 'Salvo')
      : !hasAlumno && savedAlumnoIds.length === 0 && !contentDirty
        ? M(lang, 'Asignar', 'Assign', 'Atribuir')
        : M(lang, 'Guardar', 'Save', 'Salvar');
  const saveDisabled = saving || !isDirty;
  const saveActive = !saveDisabled;
  const singleAlumnoName =
    selectedAlumnoIds.length === 1
      ? toTitleCase(alumnoNombreById(selectedAlumnoIds[0]) || r.alumno || '')
      : '';
  const avatarText =
    selectedAlumnoIds.length === 1
      ? initialsOf(singleAlumnoName)
      : selectedAlumnoIds.length > 1
        ? '+' + selectedAlumnoIds.length
        : '';

  return (
    <div
      ref={cardRootRef}
      className="it-routine-card-wrap routines-card-enter"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid ' + (alumnoDirty ? 'var(--card-border-active)' : 'var(--card-border)'),
        borderRadius: 'var(--radius-card)',
        padding: 16,
        marginBottom: 12,
        boxSizing: 'border-box',
        ['--stagger-delay']: staggerMs + 'ms',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <RoutineCardTitleMeta
            r={r}
            nombreLocal={nombreLocal}
            editandoNombre={editandoNombre}
            setNombreLocal={setNombreLocal}
            guardarNombreRutina={guardarNombreRutina}
            setEditandoNombre={setEditandoNombre}
            status={headerStatus}
            totalEx={totalEx}
            expanded={!collapsed}
            onOpen={() => setCollapsed((c) => !c)}
            lang={lang}
            M={M}
            Ic={Ic}
          />

          <RoutineCardActionMenu
            menuOpen={menuOpen}
            menuPopCoords={menuPopCoords}
            menuRef={menuRef}
            menuDropdownRef={menuDropdownRef}
            darkMode={darkMode}
            border={border}
            textMain={textMain}
            textMuted={textMuted}
            lang={lang}
            M={M}
            Ic={Ic}
            MoreVertical={MoreVertical}
            Pencil={Pencil}
            ClipboardList={ClipboardList}
            onToggleMenu={() => setMenuOpen((o) => !o)}
            onEditRoutine={openEditRoutine}
            onEditName={() => {
              setMenuOpen(false);
              setEditandoNombre(true);
            }}
            onDuplicate={duplicateRoutine}
            canRestart={canRestart}
            onRequestRestart={requestRestartRoutine}
            onRequestDelete={requestDeleteRoutine}
          />
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
          <div ref={assignTriggerRef} style={{ flex: '1 1 180px', minWidth: 0 }}>
            <button
              type="button"
              className="it-routine-btn hov"
              onClick={() => setAssignOpen((o) => !o)}
              aria-expanded={assignOpen}
              aria-haspopup="listbox"
              style={{
                width: '100%',
                height: 48,
                textAlign: 'left',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                border: '1px solid var(--card-border)',
                borderRadius: 'var(--radius-control)',
                padding: '0 12px',
                fontSize: 14,
                fontWeight: 600,
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: hasAlumno ? 'var(--accent)' : 'var(--neutral-bg)',
                  color: hasAlumno ? 'var(--on-accent)' : 'var(--text-muted)',
                  fontSize: 11,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {hasAlumno ? avatarText : <User size={14} aria-hidden="true" />}
              </span>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: hasAlumno ? 'var(--text)' : 'var(--text-muted)',
                }}
              >
                {assigneeButtonLabel()}
              </span>
              <ChevronDown
                size={18}
                aria-hidden="true"
                style={{ color: 'var(--text-muted)', flexShrink: 0, transform: assignOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}
              />
            </button>
          </div>

          <button
            type="button"
            className="it-routine-btn hov"
            onClick={handleSave}
            disabled={saveDisabled}
            aria-live="polite"
            style={{
              background: saveActive || saving ? 'var(--accent)' : 'var(--neutral-bg)',
              color: saveActive || saving ? 'var(--on-accent)' : 'var(--text-muted)',
              border: 'none',
              borderRadius: 'var(--radius-control)',
              height: 48,
              padding: '0 18px',
              fontSize: 14,
              fontWeight: 700,
              cursor: saveDisabled ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minWidth: 120,
              justifyContent: 'center',
              whiteSpace: 'nowrap',
              flex: '0 0 auto',
            }}
          >
            {saving ? (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                style={{ animation: 'spin .7s linear infinite' }}
                aria-hidden="true"
              >
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            ) : !isDirty ? (
              <Check size={16} aria-hidden="true" />
            ) : null}
            {saveLabel}
          </button>
        </div>

        {saveError && (
          <div role="alert" style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)', marginTop: 8 }}>
            {saveError}
          </div>
        )}

        {lastSaved && !saveError && (
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Ic name="check-circle" size={12} color="var(--success)" />
            {M(lang, 'Guardado a las', 'Saved at', 'Salvo às')}{' '}
            {lastSaved.toLocaleTimeString(
              lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-BR' : 'es-AR',
              { hour: '2-digit', minute: '2-digit' }
            )}
          </div>
        )}
      </div>

      {!collapsed && (
        <div style={{ paddingTop: 16 }}>
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
                isUnder768={isUnder768}
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
                onReorderWarmup={async (newList) => {
                  let savedDays;
                  setRoutines((p) =>
                    p.map((rr) => {
                      if (rr.id !== r.id) return rr;
                      savedDays = rr.days.map((dd, ddi) =>
                        ddi !== di ? dd : { ...dd, warmup: newList }
                      );
                      return { ...rr, days: savedDays };
                    })
                  );
                  setHasUnsaved(true);
                  if (r.saved && sb) {

                    try {
                      await sb.updateRutina(r.id, {
                        nombre: r.name,
                        alumno_id: r.alumno_id || null,
                        datos: { days: sanitizeRoutineDaysForWrite(savedDays), alumno: r.alumno || '', note: r.note || '' },
                      });
                    } catch (e) { console.error('[onReorderWarmup] persist error', e); }
                  }
                }}
                onReorderExercises={async (newList) => {
                  let savedDays;
                  setRoutines((p) =>
                    p.map((rr) => {
                      if (rr.id !== r.id) return rr;
                      savedDays = rr.days.map((dd, ddi) =>
                        ddi !== di ? dd : { ...dd, exercises: newList }
                      );
                      return { ...rr, days: savedDays };
                    })
                  );
                  setHasUnsaved(true);
                  if (r.saved && sb) {

                    try {
                      await sb.updateRutina(r.id, {
                        nombre: r.name,
                        alumno_id: r.alumno_id || null,
                        datos: { days: sanitizeRoutineDaysForWrite(savedDays), alumno: r.alumno || '', note: r.note || '' },
                      });
                    } catch (e) { console.error('[onReorderExercises] persist error', e); }
                  }
                }}
              />
            );
          })}
          <button
            type="button"
            className="it-routine-btn it-routine-add-day hov"
            onClick={addEmptyDay}
            style={{
              width: '100%',
              marginTop: S.gridGapTight,
              border: '1px solid var(--card-border)',
              borderRadius: 'var(--radius-card)',
              padding: '16px 18px',
              background: 'var(--surface-2)',
              color: 'var(--text)',
              fontFamily: 'inherit',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 12,
              textAlign: 'left',
            }}
          >
            <span className="it-routine-add-day__icon" aria-hidden="true">
              <Ic name="plus" size={18} color="#2563EB" />
            </span>
            <span className="it-routine-add-day__copy">
              <span className="it-routine-add-day__title">
                {M(lang, 'Agregar día', 'Add day', 'Adicionar dia')}
              </span>
              <span className="it-routine-add-day__subtitle">
                {M(lang, 'Nuevo bloque de rutina', 'New routine block', 'Novo bloco de rotina')}
              </span>
            </span>
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
              background: 'var(--surface-2)',
              border: '1px solid var(--card-border)',
              borderRadius: 'var(--radius-control)',
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
                      minHeight: 44,
                      cursor: 'pointer',
                      fontSize: 14,
                      color: 'var(--text)',
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
                      {toTitleCase(a.nombre || a.email)}
                    </span>
                  </label>
                );
              })
            )}
          </div>,
          document.body
        )}

      <RoutineRestartModal
        open={restartOpen}
        alumnoName={restartAlumnoName}
        loading={restartSubmitting}
        errorText={restartError}
        onCancel={function () {
          if (!restartSubmitting) setRestartOpen(false);
        }}
        onConfirm={confirmRestartRoutine}
        M={M}
        lang={lang}
      />

      <RoutineDeleteConfirmModals
        deleteRoutineTarget={deleteRoutineTarget}
        deleteRoutineSubmitting={deleteRoutineSubmitting}
        pendingDeleteDay={pendingDeleteDay}
        confirmDeleteRoutine={confirmDeleteRoutine}
        setDeleteRoutineTarget={setDeleteRoutineTarget}
        runDeleteDay={runDeleteDay}
        setPendingDeleteDay={setPendingDeleteDay}
        M={M}
        lang={lang}
      />
    </div>
  );
}
