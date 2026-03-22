// ── hooks/useAlumnos.js ──────────────────────────────────────────────────
import { useState, useCallback } from 'react';

const ENTRENADOR_ID = 'entrenador_principal';
const ONESIGNAL_APP_ID = '8c5e2bd1-2ac8-497a-93eb-fd07e5ce74d7';
const ONESIGNAL_KEY = 'os_v2_app_rrpcxujkzbexve7l7ud6lttu24fxxofjnc3eke5wljs2bkhvuto27d46nxt5r7pvgtnpsrxphnbgr35vfdsiesntivkncl75aq4gyuy';

export function useAlumnos({ sb }) {

  // ── Estados ──────────────────────────────────────────────────────────
  const [alumnos,         setAlumnos]         = useState([]);
  const [sesiones,        setSesiones]        = useState([]);
  const [alumnoActivo,    setAlumnoActivo]    = useState(null);
  const [alumnoSesiones,  setAlumnoSesiones]  = useState([]);
  const [alumnoProgreso,  setAlumnoProgreso]  = useState([]);
  const [loadingSB,       setLoadingSB]       = useState(false);
  const [newAlumnoForm,   setNewAlumnoForm]   = useState(false);
  const [newAlumnoData,   setNewAlumnoData]   = useState({ nombre: '', email: '', pass: '' });
  const [newAlumnoErrors, setNewAlumnoErrors] = useState({ nombre: false, email: false });
  const [editAlumnoModal, setEditAlumnoModal] = useState(null);
  const [editAlumnoEmail, setEditAlumnoEmail] = useState('');
  const [editAlumnoPass,  setEditAlumnoPass]  = useState('');

  // ── Funciones ─────────────────────────────────────────────────────────

  const cargarAlumnos = useCallback(async () => {
    const sbAlumnos = await sb.getAlumnos(ENTRENADOR_ID) || [];
    setAlumnos(sbAlumnos);
  }, [sb]);

  const notifyAlumno = useCallback(async (alumnoId, mensaje) => {
    try {
      const alumno = alumnos.find(a => a.id === alumnoId);
      if (!alumno?.onesignal_id) return;
      await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + ONESIGNAL_KEY,
        },
        body: JSON.stringify({
          app_id:            ONESIGNAL_APP_ID,
          include_player_ids: [alumno.onesignal_id],
          headings:  { en: 'IRON TRACK 💪', es: 'IRON TRACK 💪' },
          contents:  { en: mensaje, es: mensaje },
        }),
      });
    } catch (e) {
      console.log('Push error:', e);
    }
  }, [alumnos]);

  return {
    // Estados
    alumnos,         setAlumnos,
    sesiones,        setSesiones,
    alumnoActivo,    setAlumnoActivo,
    alumnoSesiones,  setAlumnoSesiones,
    alumnoProgreso,  setAlumnoProgreso,
    loadingSB,       setLoadingSB,
    newAlumnoForm,   setNewAlumnoForm,
    newAlumnoData,   setNewAlumnoData,
    newAlumnoErrors, setNewAlumnoErrors,
    editAlumnoModal, setEditAlumnoModal,
    editAlumnoEmail, setEditAlumnoEmail,
    editAlumnoPass,  setEditAlumnoPass,
    // Funciones
    cargarAlumnos,
    notifyAlumno,
  };
}
