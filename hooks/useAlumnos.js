// ── hooks/useAlumnos.js ──────────────────────────────────────────────────
import { useState, useCallback, useRef } from 'react';
import { cleanActiveCoachAlumnos } from '../lib/appHelpers.js';
import { supabase } from '../lib/supabaseClient.js';
import { ALUMNOS_STATUS, createAlumnosController } from '../lib/coachAlumnosLoad.js';

export function useAlumnos({ sb }) {

  // ── Estados ──────────────────────────────────────────────────────────
  // `alumnos` y `alumnosStatus` los gobierna un unico controlador (ver lib/coachAlumnosLoad.js).
  const [alumnosSnap,     setAlumnosSnap]     = useState({ alumnos: [], status: ALUMNOS_STATUS.IDLE });
  const sbRef = useRef(sb);
  sbRef.current = sb;
  const ctrlRef = useRef(null);
  if (!ctrlRef.current) {
    ctrlRef.current = createAlumnosController({
      fetchRows: (entrenadorId) => sbRef.current.getAlumnosStrict(entrenadorId),
      clean: cleanActiveCoachAlumnos,
      onChange: setAlumnosSnap,
    });
  }
  const ctrl = ctrlRef.current;
  const alumnos = alumnosSnap.alumnos;
  const alumnosStatus = alumnosSnap.status;
  // Misma firma que setState: las escrituras locales (alta/baja/edicion) invalidan consultas en vuelo.
  const setAlumnos = ctrl.mutate;
  const cargarAlumnos = ctrl.load;
  const refrescarAlumnos = ctrl.refresh;
  const resetAlumnos = ctrl.reset;
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

  const notifyAlumno = useCallback(async (alumnoId, mensaje) => {
    try {
      const alumno = alumnos.find(a => a.id === alumnoId);
      if (!alumno?.onesignal_id) return;
      // El envio lo hace la Edge Function notify-alumno (clave privada solo en el servidor).
      const { error } = await supabase.functions.invoke('notify-alumno', {
        body: { alumnoId, mensaje },
      });
      if (error) console.log('Push error:', error);
    } catch (e) {
      console.log('Push error:', e);
    }
  }, [alumnos]);

  return {
    // Estados
    alumnos,         setAlumnos,
    alumnosStatus,
    refrescarAlumnos, resetAlumnos,
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
