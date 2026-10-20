import React from 'react';
import BaseModal from '../modals/BaseModal.jsx';
import { detectOrphanSessions, confirmOrphanSessions, validateOrphanSession, advanceWeekAfterValidation } from '../../lib/orphanSessions.js';
import { applySemanaActivaToRutinas } from '../../lib/rutinaOperationalState.js';
import { resolveExerciseTitle } from '../../lib/exerciseResolve.js';

// "Descartar" solo oculta el aviso en la UI (en memoria, hasta recargar la app): no borra nada ni usa localStorage.
const dismissedKeys = new Set();

function mergeSesiones(prev, incoming) {
  var seen = {};
  return (incoming || []).concat(prev || []).filter(function (s) {
    var k = s && s.id != null ? String(s.id) : null;
    if (k == null) return true;
    if (seen[k]) return false;
    seen[k] = true;
    return true;
  });
}

/**
 * Aviso "Sesión sin finalizar" en la ficha del alumno (vista entrenador): el alumno registro series pero no finalizo el
 * entrenamiento, asi que no hay fila en `sesiones`. El entrenador puede validarla eligiendo el dia.
 */
export default function StudentOrphanSession({
  alumno,
  rutina,
  progreso = [],
  sesiones = [],
  allEx = [],
  sb,
  setAlumnoSesiones,
  setRutinasSB,
  setRutinasSBEntrenador,
  toast2,
  es,
  msg,
  textMain,
  textMuted,
  coachAluSurface,
  coachAluBorderSoft,
}) {
  const [, bump] = React.useState(0);
  const [openKey, setOpenKey] = React.useState(null);
  const [diaSel, setDiaSel] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const days = (rutina && rutina.datos && Array.isArray(rutina.datos.days)) ? rutina.datos.days : [];
  // Candidatos con los datos locales (acotados: getSesiones limit 10, lista global 500). Solo se muestran los que la DB confirma como
  // huerfanos, asi un roster grande no produce avisos falsos sobre sesiones ya finalizadas. Si la lectura falla, no se muestra nada.
  const candidates = React.useMemo(function () {
    return detectOrphanSessions({ progreso: progreso, sesiones: sesiones, rutina: rutina, alumnoId: alumno && alumno.id });
  }, [progreso, sesiones, rutina, alumno && alumno.id]);
  const candidatesSig = String(alumno && alumno.id) + "|" + String(rutina && rutina.id) + "|" + candidates.map(function (o) { return o.key; }).join(",");
  const [confirmed, setConfirmed] = React.useState({ sig: "", list: [] });

  React.useEffect(function () {
    if (!candidates.length) return undefined;
    var cancelled = false;
    confirmOrphanSessions({ sb: sb, progreso: progreso, sesiones: sesiones, rutina: rutina, alumnoId: alumno.id })
      .then(function (list) { if (!cancelled) setConfirmed({ sig: candidatesSig, list: list }); })
      .catch(function (e) { console.error("[confirmarSesionesHuerfanas]", e); if (!cancelled) setConfirmed({ sig: candidatesSig, list: [] }); });
    return function () { cancelled = true; };
  }, [candidatesSig]);

  const candidateKeys = candidates.map(function (o) { return o.key; });
  const orphans = confirmed.sig === candidatesSig
    ? confirmed.list.filter(function (o) { return candidateKeys.indexOf(o.key) >= 0; })
    : [];
  const visible = orphans.filter(function (o) { return !dismissedKeys.has(String(alumno.id) + "|" + o.key); });
  const current = visible.find(function (o) { return o.key === openKey; }) || null;

  if (!visible.length) return null;

  function exerciseName(id) {
    var inRoutine = null;
    days.forEach(function (d) {
      [].concat(d.warmup || [], d.exercises || []).forEach(function (ex) { if (!inRoutine && ex && String(ex.id) === String(id)) inRoutine = ex; });
    });
    var info = (allEx || []).find(function (e) { return String(e.id) === String(id); }) || null;
    return resolveExerciseTitle(info, inRoutine, es) || String(id);
  }

  function open(o) {
    setError("");
    setDiaSel(o.diaIdxSugerido != null ? String(o.diaIdxSugerido) : "");
    setOpenKey(o.key);
  }

  function close() {
    if (busy) return;
    setOpenKey(null);
    setError("");
  }

  function discard() {
    if (busy || !current) return;
    dismissedKeys.add(String(alumno.id) + "|" + current.key);
    setOpenKey(null);
    bump(function (n) { return n + 1; });
  }

  async function validate() {
    if (busy || !current || diaSel === "") return;
    setBusy(true);
    setError("");
    try {
      const res = await validateOrphanSession({
        sb: sb,
        alumnoId: alumno.id,
        rutina: rutina,
        orphan: current,
        diaIdx: Number(diaSel),
      });
      // getSesiones del alumno ordena por created_at y corta en 10: la fila validada lleva created_at del dia entrenado y podria quedar
      // fuera de esa pagina, asi que se incorpora al estado en vez de re-pedir la lista.
      if (res.status === "saved") {
        setAlumnoSesiones(function (prev) { return mergeSesiones(prev, [res.row]); });
        toast2(msg("Sesión validada ✓", "Session validated ✓"));
      } else {
        setAlumnoSesiones(function (prev) { return mergeSesiones(prev, res.rows); });
        toast2(msg("Esa sesión ya estaba registrada", "That session was already recorded"));
      }
      setOpenKey(null);
      // Si con esta sesion la semana queda completa, se habilita la siguiente ya (el mismo chequeo que corre al abrir la ficha). No puede
      // fallar la validacion: la sesion ya esta guardada y, si el chequeo falla, se reintenta al volver a abrir la ficha.
      const week = await advanceWeekAfterValidation({ sb: sb, alumnoId: alumno.id, rutina: rutina });
      if (week.status === "advanced") {
        const apply = function (prev) { return applySemanaActivaToRutinas(prev, week.rutinaId, week.semanaActiva); };
        if (typeof setRutinasSB === "function") setRutinasSB(apply);
        if (typeof setRutinasSBEntrenador === "function") setRutinasSBEntrenador(apply);
        toast2(msg("Semana completa: pasó a la semana " + week.semanaActiva, "Week complete: moved to week " + week.semanaActiva));
      }
    } catch (e) {
      console.error("[validarSesionHuerfana]", e);
      setError(msg("No se pudo validar la sesión. Intentá de nuevo.", "Could not validate the session. Please try again."));
      toast2(msg("Error al validar la sesión", "Error validating the session"));
    } finally {
      setBusy(false);
    }
  }

  const byExercise = current ? current.ejercicios.map(function (id) {
    var sets = current.sets.filter(function (s) { return s.ejercicio_id === id; });
    return { id: id, sets: sets };
  }) : [];
  const btn = { border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" };

  return (
    <div style={{ marginBottom: 8 }}>
      {visible.map(function (o) {
        return (
          <button
            key={o.key}
            type="button"
            onClick={function () { open(o); }}
            style={{
              display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
              marginBottom: 6, padding: "10px 12px", borderRadius: 10,
              background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.45)", color: textMain,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: "rgba(245,158,11,0.25)", color: "#f59e0b", whiteSpace: "nowrap" }}>
              {msg("Sesión sin finalizar", "Unfinished session")}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: textMuted }}>
              {o.fecha} · {o.sets.length} {msg("sets", "sets")}
            </span>
          </button>
        );
      })}

      <BaseModal open={!!current} onClose={close} maxWidth={440}>
        {current && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: textMain, marginBottom: 4 }}>{msg("Validar sesión no finalizada", "Validate unfinished session")}</div>
            <div style={{ fontSize: 13, color: textMuted, marginBottom: 14 }}>
              {alumno.nombre || alumno.email} · {current.fecha} · {msg("Semana", "Week")} {current.semanaSesion}
            </div>
            <div style={{ maxHeight: 220, overflowY: "auto", marginBottom: 14, border: "1px solid " + coachAluBorderSoft, borderRadius: 10, padding: "6px 12px", background: coachAluSurface }}>
              {byExercise.map(function (e) {
                return (
                  <div key={e.id} style={{ padding: "6px 0" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: textMain }}>{exerciseName(e.id)}</div>
                    <div style={{ fontSize: 12, color: textMuted }}>
                      {e.sets.map(function (s) { return (Number(s.kg) > 0 ? s.kg + "kg × " : "") + s.reps; }).join("  ·  ")}
                    </div>
                  </div>
                );
              })}
            </div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: textMuted, marginBottom: 6 }}>{msg("Día de la rutina", "Routine day")}</label>
            <select
              value={diaSel}
              disabled={busy}
              onChange={function (e) { setDiaSel(e.target.value); }}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, fontSize: 14, fontFamily: "inherit", marginBottom: 6, border: "1px solid " + coachAluBorderSoft, background: coachAluSurface, color: textMain }}
            >
              {current.diaIdxSugerido == null && <option value="">{msg("Elegí el día…", "Choose the day…")}</option>}
              {days.map(function (d, i) {
                return <option key={i} value={String(i)}>{(i + 1) + ". " + (d.label || (msg("Día ", "Day ") + (i + 1)))}</option>;
              })}
            </select>
            {current.diaIdxSugerido == null && (
              <div style={{ fontSize: 12, color: textMuted, marginBottom: 6 }}>{msg("No se pudo inferir el día con certeza.", "The day could not be inferred with certainty.")}</div>
            )}
            {error && <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: "#ef4444", margin: "8px 0" }}>{error}</div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14, flexWrap: "wrap" }}>
              <button type="button" disabled={busy} onClick={discard} style={Object.assign({}, btn, { background: "transparent", color: textMuted, border: "1px solid " + coachAluBorderSoft })}>
                {msg("Descartar", "Dismiss")}
              </button>
              <button type="button" disabled={busy || diaSel === ""} onClick={validate} style={Object.assign({}, btn, { background: "#22c55e", color: "#fff", opacity: busy || diaSel === "" ? 0.6 : 1 })}>
                {busy ? msg("Validando…", "Validating…") : msg("Validar", "Validate")}
              </button>
            </div>
          </div>
        )}
      </BaseModal>
    </div>
  );
}
