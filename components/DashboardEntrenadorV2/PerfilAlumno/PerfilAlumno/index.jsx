import HeaderResumen from "./HeaderResumen";
import AtencionAhora from "./AtencionAhora";
import ListaRevisar  from "./lista-revisar.jsx";
import ListaAlumnos  from "./ListaAlumnos";

// ─── Lógica de priorización ───────────────────────────────────────────────────
// Calcula días sin entrenar y deriva prioridad sin depender de priorizarAlumnos.js
// (para mantener este módulo autocontenido).

function calcularDias(alumnoId, sesiones) {
  const propias = (sesiones || [])
    .filter(s => s.alumno_id === alumnoId)
    .sort((a, b) => new Date(b.created_at || b.fecha) - new Date(a.created_at || a.fecha));
  if (!propias.length) return null;
  return Math.floor((Date.now() - new Date(propias[0].created_at || propias[0].fecha)) / 86400000);
}

function derivarEstado(alumno, dias, pagosEstado, routines) {
  if (dias === null || dias >= 5)
    return { nivel: 0, color: "#ef4444", problema: dias === null ? "Sin sesiones registradas" : `${dias} días sin entrenar` };
  if (pagosEstado?.[alumno.id] === "vencido")
    return { nivel: 1, color: "#f59e0b", problema: "Pago vencido" };
  if (pagosEstado?.[alumno.id] === "pendiente")
    return { nivel: 2, color: "#f59e0b", problema: "Pago pendiente" };
  if (routines && !routines.some(r => r.alumno_id === alumno.id))
    return { nivel: 3, color: "#f59e0b", problema: "Sin rutina asignada" };
  if (dias < 3)
    return { nivel: 5, color: "#22c55e", problema: "Al día" };
  return { nivel: 4, color: "#636870", problema: `${dias} días sin entrenar` };
}

function mapearAlumno(alumno, sesiones, pagosEstado, routines) {
  const dias = calcularDias(alumno.id, sesiones);
  const estado = derivarEstado(alumno, dias, pagosEstado, routines);
  return {
    id: alumno.id,
    nombre: alumno.nombre || alumno.email || "Alumno",
    problema: estado.problema,
    color: estado.color,
    nivel: estado.nivel,
    // Para ListaAlumnos
    estado: estado.problema,
    estadoColor: estado.color,
    // Referencia al objeto original por si los handlers lo necesitan
    _raw: alumno,
  };
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function DashboardEntrenadorV2({
  alumnos = [],
  sesiones = [],
  pagosEstado = {},
  routines = [],
  session = null,
  onVerAlumno,
  onChatAlumno,
}) {
  // Nombre del entrenador desde la sesión
  const nombre = session?.user?.user_metadata?.nombre
    || session?.user?.email?.split("@")[0]
    || "Coach";

  // Mapear y ordenar todos los alumnos por nivel de prioridad
  const mapeados = alumnos
    .map(a => mapearAlumno(a, sesiones, pagosEstado, routines))
    .sort((a, b) => a.nivel - b.nivel);

  // Separar por zona
  const necesitanAtencion = mapeados.filter(a => a.nivel <= 3);
  const principal  = necesitanAtencion[0] ?? null;
  const aRevisar   = necesitanAtencion.slice(1, 5);       // hasta 4
  const todosResto = mapeados.filter(a => a.nivel > 3);   // lista general

  // Métricas para el header
  const totalSesiones  = sesiones.length;
  const sinEntrenar    = mapeados.filter(a => a.nivel === 0).length;
  const pagosPendientes = alumnos.filter(
    a => pagosEstado?.[a.id] === "pendiente" || pagosEstado?.[a.id] === "vencido"
  ).length;

  // Handlers — pasan el objeto original a los callbacks existentes en App.jsx
  const handleVer     = (a) => onVerAlumno?.(a._raw);
  const handleMensaje = (a) => onChatAlumno?.(a._raw);

  return (
    <div style={{ paddingBottom: 32 }}>
      <HeaderResumen
        nombre={nombre}
        sesiones={totalSesiones}
        sinEntrenar={sinEntrenar}
        pagos={pagosPendientes || null}
      />

      <AtencionAhora
        alumno={principal}
        onVer={handleVer}
        onMensaje={handleMensaje}
      />

      <ListaRevisar
        alumnos={aRevisar}
        onSeleccionar={handleVer}
      />

      <ListaAlumnos
        alumnos={todosResto}
        onSeleccionar={handleVer}
      />
    </div>
  );
}
