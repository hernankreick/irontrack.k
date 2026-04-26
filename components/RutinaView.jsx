import React, { useState, useRef, useLayoutEffect, useEffect, useMemo, useCallback } from 'react';
import { EditExerciseModal } from './EditExerciseModal.jsx';
import { emptyDays } from '../lib/routineTemplates.js';
import { sanitizeExerciseSnapshotForWrite, sanitizeRoutineDaysForWrite } from '../lib/exerciseResolve.js';
import { coachType as T, coachSpace as S } from './coachUiScale.js';
import { irontrackMsg as M } from '../lib/irontrackMsg.js';
import { filterRoutinesByChip } from './routines/RoutineFilters.jsx';
import { RoutineSkeleton } from './routines/RoutineSkeleton.jsx';
import { UnsavedChangesBar } from './routines/UnsavedChangesBar.jsx';
import { RoutineCard } from './routines/RoutineCard.jsx';
import { RoutinesTopSection } from './routines/RoutinesTopSection.jsx';
import './routines/routines-ui.css';

// ── SVG: Icono mancuerna para estado vacío ──────────────────────────
function DumbbellIcon({ color }) {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4v16M18 4v16M3 8h3M18 8h3M3 16h3M18 16h3M6 8h12M6 16h12"/>
    </svg>
  );
}

// ── Componente principal ─────────────────────────────────────────────
export function RutinaView(props) {
  const {
    setTab, border, textMuted, bgCard, textMain, darkMode, bgSub, es,
    lang: langProp,
    filtroRut = 'todas',
    setFiltroRut,
    card, setNewR, routines, setRoutines, allEx,
    toast2, setAddExModal, setAddExSearch, setAddExPat, setAddExMuscle,
    setAddExSelectedIds,     setDupDayModal, alumnos, sb, setAssignRoutineId,
    desktopCoachStableLayout = false,
    routinesLoading = false,
    rutinasSBEntrenador = [],
    setRutinasSBEntrenador,
  } = props;

  const lang = langProp || (es ? 'es' : 'en');

  const [routineSearchQuery, setRoutineSearchQuery] = useState('');
  const [routineSort, setRoutineSort] = useState('recientes');
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [editingExercise, setEditingExercise] = useState(null);
  const contentRef = useRef(null);
  const baselineRef = useRef(null);
  /** Alinea la barra fija al ancho real de la columna (shell coach desktop). */
  const [saveBarBox, setSaveBarBox] = useState({ left: 0, width: null });

  useEffect(
    function () {
      try {
        if (!hasUnsaved) {
          baselineRef.current = JSON.parse(JSON.stringify(routines));
        }
      } catch (e) {
        baselineRef.current = routines;
      }
    },
    [hasUnsaved, routines]
  );

  useLayoutEffect(
    function () {
      var el = contentRef.current;
      if (!el) return undefined;
      function update() {
        var r = el.getBoundingClientRect();
        setSaveBarBox({ left: r.left, width: r.width });
      }
      update();
      var ro = new ResizeObserver(update);
      ro.observe(el);
      window.addEventListener('resize', update);
      document.addEventListener('scroll', update, true);
      return function () {
        ro.disconnect();
        window.removeEventListener('resize', update);
        document.removeEventListener('scroll', update, true);
      };
    },
    []
  );

  useEffect(
    function () {
      if (setFiltroRut && filtroRut === 'recientes') {
        setFiltroRut('todas');
        setRoutineSort('recientes');
      }
    },
    [filtroRut, setFiltroRut]
  );

  /**
   * Rutinas guardadas en Supabase con alumno (p. ej. asignadas desde Alumnos)
   * no estaban en `routines` (localStorage). Las fusionamos por id para que
   * filtros como «Asignadas» y la lista muestren el mismo dato que el servidor.
   */
  useEffect(
    function () {
      if (!Array.isArray(rutinasSBEntrenador) || rutinasSBEntrenador.length === 0) {
        return undefined;
      }
      setRoutines(function (prev) {
        var prevList = Array.isArray(prev) ? prev : [];
        var indexById = new Map();
        for (var i = 0; i < prevList.length; i++) {
          if (prevList[i] && prevList[i].id != null) {
            indexById.set(String(prevList[i].id), i);
          }
        }
        var next = prevList.slice();
        var changed = false;
        rutinasSBEntrenador.forEach(function (rSB) {
          if (!rSB || rSB.id == null) return;
          var idKey = String(rSB.id);
          var idx = indexById.get(idKey);
          var al = (alumnos || []).find(function (a) {
            return String(a.id) === String(rSB.alumno_id);
          });
          var alumId = rSB.alumno_id != null ? rSB.alumno_id : null;
          var alumNombre = (rSB.datos && rSB.datos.alumno) || (al && (al.nombre || al.email)) || '';

          if (idx !== undefined) {
            var cur = next[idx];
            if (alumId != null && String(cur.alumno_id || '') !== String(alumId)) {
              next[idx] = Object.assign({}, cur, {
                alumno_id: alumId,
                alumno: cur.alumno || alumNombre,
                saved: cur.saved !== false,
              });
              changed = true;
            }
            return;
          }
          next.push({
            id: rSB.id,
            name: rSB.nombre || 'Rutina',
            days: Array.isArray(rSB.datos && rSB.datos.days) ? rSB.datos.days : [],
            alumno_id: alumId,
            alumno: alumNombre,
            note: (rSB.datos && rSB.datos.note) || '',
            saved: true,
            collapsed: true,
          });
          indexById.set(idKey, next.length - 1);
          changed = true;
        });
        return changed ? next : prev;
      });
    },
    [rutinasSBEntrenador, alumnos, setRoutines]
  );

  const surfaceInput = darkMode ? '#151921' : '#f1f5f9';

  const openLibrary = (routineId, dayIdx, bloque) => {
    setAddExModal({ rId: routineId, dIdx: dayIdx, bloque });
    setAddExSearch('');
    setAddExPat(null);
    setAddExMuscle(null);
    setAddExSelectedIds([]);
  };

  const handleSaveAll = async () => {
    if (!hasUnsaved) return;
    if (!sb) {
      toast2(M(lang, 'Error al guardar', 'Could not save', 'Erro ao salvar'));
      return;
    }
    const fechaInicio = new Date().toLocaleDateString('es-AR');
    try {
      for (const r of routines) {
        const days = sanitizeRoutineDaysForWrite(r.days);
        const payload = {
          nombre: r.name,
          alumno_id: r.alumno_id || null,
          datos: { days, alumno: r.alumno || '', note: r.note || '' },
          entrenador_id: 'entrenador_principal',
        };
        if (r.saved) {
          await sb.updateRutina(r.id, payload);
        } else {
          const res = await sb.createRutina(
            Object.assign({}, payload, { fecha_inicio: fechaInicio })
          );
          if (res && res[0]) {
            setRoutines((p) =>
              p.map((rr) => (rr.id === r.id ? { ...rr, id: res[0].id, saved: true } : rr))
            );
          } else {
            throw new Error('createRutina failed');
          }
        }
      }
      setHasUnsaved(false);
      toast2(M(lang, 'Cambios guardados ✓', 'Changes saved ✓', 'Alterações salvas ✓'));
    } catch (e) {
      console.error('[RutinaView] handleSaveAll', e);
      toast2(M(lang, 'Error al guardar', 'Could not save', 'Erro ao salvar'));
    }
  };

  const handleDiscardUnsaved = useCallback(() => {
    if (!hasUnsaved) return;
    if (
      !confirm(
        M(
          lang,
          '¿Descartar todos los cambios no guardados?',
          'Discard all unsaved changes?',
          'Descartar todas as alterações não salvas?'
        )
      )
    ) {
      return;
    }
    try {
      const b = baselineRef.current;
      if (b) {
        setRoutines(JSON.parse(JSON.stringify(b)));
      }
    } catch {}
    setHasUnsaved(false);
  }, [hasUnsaved, lang, setRoutines]);

  const closeEditModal = () => setEditingExercise(null);

  const handleModalSave = (formData) => {
    if (!editingExercise) return;
    const { routineId, dayIdx, exercise, bloque } = editingExercise;
    const updatedEx = sanitizeExerciseSnapshotForWrite({ ...exercise, ...formData });

    setRoutines((p) =>
      p.map((rr) =>
        rr.id !== routineId
          ? rr
          : {
              ...rr,
              days: rr.days.map((dd, di) =>
                di !== dayIdx
                  ? dd
                  : {
                      ...dd,
                      [bloque]: (dd[bloque] || []).map((ex) =>
                        ex.id === exercise.id ? updatedEx : ex
                      ),
                    }
              ),
            }
      )
    );

    setHasUnsaved(true);
    closeEditModal();
  };

  const displayRoutines = useMemo(
    function () {
      var filtered = filterRoutinesByChip(routines, filtroRut || 'todas');
      var q = routineSearchQuery.trim().toLowerCase();
      var searched = q
        ? filtered.filter(function (r) {
            return String(r.name || '')
              .toLowerCase()
              .includes(q);
          })
        : filtered;
      return routineSort === 'recientes' ? searched.slice().reverse() : searched;
    },
    [routines, filtroRut, routineSearchQuery, routineSort]
  );

  var scrollPadBottom = desktopCoachStableLayout
    ? hasUnsaved
      ? 'calc(96px + env(safe-area-inset-bottom, 0px))'
      : 'calc(20px + env(safe-area-inset-bottom, 0px))'
    : hasUnsaved
      ? 'calc(140px + env(safe-area-inset-bottom, 0px))'
      : 'calc(5.5rem + env(safe-area-inset-bottom, 0px))';

  return (
    <div
      className={'it-routines-root ' + (darkMode ? 'it-routines-root--dark' : '')}
      style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0, maxWidth: '100%' }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div
        ref={contentRef}
        className="it-routines-scroll-inner min-h-0 min-w-0 max-w-full flex-1 overflow-y-auto overflow-x-hidden"
        style={{
          paddingBottom: scrollPadBottom,
          paddingLeft: 16,
          paddingRight: 16,
          paddingTop: 8,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {setFiltroRut ? (
          <RoutinesTopSection
            lang={lang}
            darkMode={darkMode}
            border={border}
            textMain={textMain}
            textMuted={textMuted}
            surfaceInput={surfaceInput}
            filtroRut={filtroRut}
            setFiltroRut={setFiltroRut}
            searchQuery={routineSearchQuery}
            setSearchQuery={setRoutineSearchQuery}
            sortOrder={routineSort}
            setSortOrder={setRoutineSort}
            onScan={() => setTab('scanner')}
            onNewRoutine={() =>
              setNewR({
                templateId: 'blank',
                name: '',
                numDays: 3,
                days: emptyDays(3, es),
                note: '',
                alumno: '',
                showAdvanced: false,
              })
            }
          />
        ) : null}

        {/* ── Lista de rutinas ── */}
        {routinesLoading ? (
          <RoutineSkeleton darkMode={darkMode} border={border} count={3} />
        ) : routines.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: `${S.pageGap * 2}px ${S.pagePadding}px`,
              color: textMuted,
              ...T.body,
              lineHeight: 1.6,
            }}
          >
            <DumbbellIcon color={textMuted} />
            <div style={{ marginTop: S.blockGap, ...T.cardTitle, color: textMuted }}>
              {M(lang, 'Sin rutinas todavía', 'No routines yet', 'Ainda sem rotinas')}
            </div>
            <div style={{ marginTop: 4, ...T.subtitle, color: textMuted }}>
              {M(
                lang,
                'Creá tu primera rutina con el botón de arriba.',
                'Create your first routine with the button above.',
                'Crie sua primeira rotina com o botão acima.'
              )}
            </div>
          </div>
        ) : displayRoutines.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: `${S.pageGap}px ${S.pagePadding}px`,
              color: textMuted,
              ...T.body,
            }}
          >
            {M(
              lang,
              'No hay rutinas con este filtro o búsqueda.',
              'No routines match this filter or search.',
              'Nenhuma rotina com este filtro ou busca.'
            )}
          </div>
        ) : (
          displayRoutines.map((r, idx) => (
            <RoutineCard
              key={r.id}
              r={r}
              es={es}
              lang={lang}
              darkMode={darkMode}
              border={border}
              textMain={textMain}
              textMuted={textMuted}
              bgCard={bgCard}
              bgSub={bgSub}
              allEx={allEx}
              setRoutines={setRoutines}
              setDupDayModal={setDupDayModal}
              alumnos={alumnos}
              sb={sb}
              setAssignRoutineId={setAssignRoutineId}
              toast2={toast2}
              card={card}
              routines={routines}
              setHasUnsaved={setHasUnsaved}
              setEditingExercise={setEditingExercise}
              onOpenLibrary={openLibrary}
              cardIndex={idx}
              setRutinasSBEntrenador={setRutinasSBEntrenador}
              rutinasSBEntrenador={rutinasSBEntrenador}
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

      <UnsavedChangesBar
        visible={hasUnsaved}
        lang={lang}
        border={border}
        onSave={handleSaveAll}
        onDiscard={handleDiscardUnsaved}
        saveBarBox={saveBarBox}
        desktopCoachStableLayout={desktopCoachStableLayout}
      />
    </div>
  );
}
