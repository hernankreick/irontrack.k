// Puente entre App.jsx (que conoce el cliente autenticado) y la interfaz de "Prescrito vs. ejecutado" (components/prescrito), sin pasar props por
// los componentes intermedios. App registra { activo, cargar } una vez; la interfaz lo consulta al montarse.
//   activo: bandera de BUILD (VITE_IRONTRACK_COPIAS_PRESCRIPCION). Apagada => la interfaz no se muestra y no hace ninguna lectura.
//   cargar(alumnoId, { propio }) => Promise<resultado de cargarPrescritoEjecutado>
var host = { activo: false, cargar: null };
export function registrarHostPrescritoEjecutado(h) { host = { activo: !!(h && h.activo), cargar: h && typeof h.cargar === "function" ? h.cargar : null }; }
export function obtenerHostPrescritoEjecutado() { return host; }
