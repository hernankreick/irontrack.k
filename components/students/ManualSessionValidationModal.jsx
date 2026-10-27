import React from 'react';
import BaseModal from '../modals/BaseModal.jsx';
import { loadWeekCompletion, validateManualSession, mergeSesionesById } from '../../lib/manualSessionValidation.js';
import { advanceWeekAfterValidation } from '../../lib/orphanSessions.js';
import { applySemanaActivaToRutinas } from '../../lib/rutinaOperationalState.js';

/**
 * "Validar sesión manualmente" (menú ⋮ de la rutina, ficha del alumno): el entrenador marca como completado un día pendiente de la
 * semana actual cuando el alumno entrenó pero no registró ejercicios ni finalizó. Ver lib/manualSessionValidation.js.
 */
export default function ManualSessionValidationModal({
  open,
  onClose,
  alumno,
  rutina,
  semana,
  sb,
  setAlumnoSesiones,
  setRutinasSB,
  setRutinasSBEntrenador,
  toast2,
  msg,
  textMain,
  textMuted,
  coachAluSurface,
  coachAluBorderSoft,
}) {
  const [loading, setLoading] = React.useState(false);
  const [completed, setCompleted] = React.useState([]);
  const [selected, setSelected] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  // Guard de reentrada: el estado `busy` llega un render tarde, un doble tap rapido podria disparar dos validaciones.
  const inFlight = React.useRef(false);

  const days = (rutina && rutina.datos && Array.isArray(rutina.datos.days)) ? rutina.datos.days : [];
  const alumnoId = alumno && alumno.id;
  const rutinaId = rutina && rutina.id;

  React.useEffect(function () {
    if (!open || !rutina) return undefined;
    var cancelled = false;
    setSelected(null);
    setError("");
    setLoading(true);
    loadWeekCompletion({ sb: sb, alumnoId: alumnoId, rutina: rutina, semana: semana })
      .then(function (r) { if (!cancelled) setCompleted(r.completed); })
      .catch(function (e) {
        console.error("[validarSesionManual:lectura]", e);
        if (!cancelled) { setCompleted([]); setError(msg("No se pudo leer el estado de la semana. Cerrá y volvé a intentar.", "Could not read the week status. Close and try again.")); }
      })
      .finally(function () { if (!cancelled) setLoading(false); });
    return function () { cancelled = true; };
  }, [open, alumnoId, rutinaId, semana]);

  function close() {
    if (busy) return;
    onClose();
  }

  async function confirm() {
    if (inFlight.current || selected == null) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const res = await validateManualSession({ sb: sb, alumnoId: alumnoId, rutina: rutina, diaIdx: selected, semana: semana });
      if (res.status === "saved") {
        setAlumnoSesiones(function (prev) { return mergeSesionesById(prev, [res.row]); });
        toast2(msg("Sesión validada ✓", "Session validated ✓"));
      } else {
        setAlumnoSesiones(function (prev) { return mergeSesionesById(prev, res.rows); });
        toast2(msg("Ese día ya estaba completado", "That day was already completed"));
      }
      onClose();
      // Mismo chequeo de semana que corre al abrir la ficha: si la semana queda completa, semana_activa avanza (monotono, idempotente).
      // No puede fallar la validacion: la sesion ya esta guardada y, si falla, se reintenta al volver a abrir la ficha.
      const week = await advanceWeekAfterValidation({ sb: sb, alumnoId: alumnoId, rutina: rutina });
      if (week.status === "advanced") {
        const apply = function (prev) { return applySemanaActivaToRutinas(prev, week.rutinaId, week.semanaActiva); };
        if (typeof setRutinasSB === "function") setRutinasSB(apply);
        if (typeof setRutinasSBEntrenador === "function") setRutinasSBEntrenador(apply);
        toast2(msg("Semana completa: pasó a la semana " + week.semanaActiva, "Week complete: moved to week " + week.semanaActiva));
      }
    } catch (e) {
      console.error("[validarSesionManual]", e);
      setError(msg("No se pudo validar la sesión. Intentá de nuevo.", "Could not validate the session. Please try again."));
      toast2(msg("Error al validar la sesión", "Error validating the session"));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const btn = { border: "none", borderRadius: 10, padding: "10px 16px", minHeight: 44, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" };
  const dayLabel = function (i) { return (days[i] && days[i].label) || (msg("Día ", "Day ") + (i + 1)); };
  const title = msg("Validar sesión manualmente", "Validate session manually");

  return (
    <BaseModal open={!!open} onClose={close} maxWidth={440} ariaLabel={title}>
      {open && rutina && (
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: textMain, marginBottom: 4 }}>{title}</div>
          <div style={{ fontSize: 13, color: textMuted, marginBottom: 14 }}>
            {(alumno && (alumno.nombre || alumno.email)) || ""} · {rutina.nombre || rutina.name} · {msg("Semana", "Week")} {semana}
          </div>

          {selected == null ? (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: textMuted, marginBottom: 8 }}>{msg("Elegí el día pendiente que el alumno realizó", "Choose the pending day the athlete did")}</div>
              {loading && <div style={{ fontSize: 13, color: textMuted, padding: "12px 0" }}>{msg("Cargando…", "Loading…")}</div>}
              {!loading && days.map(function (d, i) {
                const done = completed.indexOf(i) >= 0;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={done || !!error}
                    onClick={function () { setSelected(i); }}
                    aria-label={dayLabel(i) + " — " + (done ? msg("completado", "completed") : msg("pendiente", "pending"))}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%", textAlign: "left", minHeight: 48,
                      marginBottom: 6, padding: "10px 12px", borderRadius: 10, fontFamily: "inherit", fontSize: 14, fontWeight: 700, color: textMain,
                      cursor: done || error ? "default" : "pointer", opacity: done ? 0.7 : 1,
                      background: done ? "rgba(34,197,94,0.10)" : coachAluSurface,
                      border: "1px solid " + (done ? "rgba(34,197,94,0.45)" : coachAluBorderSoft),
                    }}
                  >
                    <span>{(i + 1) + ". " + dayLabel(i)}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, whiteSpace: "nowrap", color: done ? "#22c55e" : "#f59e0b" }}>
                      {done ? msg("✓ Completado", "✓ Completed") : msg("Pendiente", "Pending")}
                    </span>
                  </button>
                );
              })}
              {!loading && !error && days.length > 0 && completed.length >= days.length && (
                <div style={{ fontSize: 13, color: textMuted, marginTop: 4 }}>{msg("Todos los días de esta semana ya están completados.", "All days of this week are already completed.")}</div>
              )}
              {error && <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: "#ef4444", margin: "8px 0" }}>{error}</div>}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
                <button type="button" onClick={close} style={Object.assign({}, btn, { background: "transparent", color: textMuted, border: "1px solid " + coachAluBorderSoft })}>
                  {msg("Cerrar", "Close")}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: textMain, marginBottom: 8 }}>{(selected + 1) + ". " + dayLabel(selected)}</div>
              <div style={{ fontSize: 14, color: textMain, lineHeight: 1.45, marginBottom: 6 }}>
                {msg(
                  "¿Confirmás que el alumno realizó este entrenamiento? La sesión quedará marcada como completada manualmente, aunque no tenga ejercicios registrados.",
                  "Do you confirm the athlete did this workout? The session will be marked as manually completed, even without logged exercises."
                )}
              </div>
              {error && <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: "#ef4444", margin: "8px 0" }}>{error}</div>}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14, flexWrap: "wrap" }}>
                <button type="button" disabled={busy} onClick={function () { setSelected(null); setError(""); }} style={Object.assign({}, btn, { background: "transparent", color: textMuted, border: "1px solid " + coachAluBorderSoft })}>
                  {msg("Volver", "Back")}
                </button>
                <button type="button" disabled={busy} onClick={confirm} style={Object.assign({}, btn, { background: "#22c55e", color: "#fff", opacity: busy ? 0.6 : 1 })}>
                  {busy ? msg("Validando…", "Validating…") : msg("Confirmar", "Confirm")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </BaseModal>
  );
}
