export const PRIORIDAD = {
  CRITICO: { nivel: 0, etiqueta: "Inactivo", color: "#ef4444", fondo: "#3a1212" },
  PAGO:    { nivel: 1, etiqueta: "Pago",     color: "#f59e0b", fondo: "#2d2010" },
  RUTINA:  { nivel: 2, etiqueta: "Sin rutina",color: "#f59e0b", fondo: "#2d2010" },
  PROGRESO:{ nivel: 3, etiqueta: "Revisión", color: "#60a5fa", fondo: "#0e1e38" },
  ESTABLE: { nivel: 4, etiqueta: "Al día",   color: "#4ade80", fondo: "#0e2e1a" },
};

/**
 * Determina la prioridad de un alumno basándose en sus datos.
 *
 * Estructura esperada de cada alumno:
 * {
 *   id: string,
 *   nombre: string,
 *   diasSinEntrenar: number,       // días desde el último entrenamiento
 *   pagoVencidoDias: number,       // 0 si está al día
 *   tieneRutina: boolean,
 *   tieneNuevoPR: boolean,         // marcador de PR nuevo esta semana
 *   descripcion?: string,          // texto adicional libre (opcional)
 * }
 */
export function calcularPrioridad(alumno) {
  if (alumno.diasSinEntrenar >= 5) return PRIORIDAD.CRITICO;
  if (alumno.pagoVencidoDias > 0) return PRIORIDAD.PAGO;
  if (!alumno.tieneRutina)        return PRIORIDAD.RUTINA;
  if (alumno.tieneNuevoPR)        return PRIORIDAD.PROGRESO;
  return PRIORIDAD.ESTABLE;
}

/**
 * Recibe la lista completa de alumnos y devuelve los priorizados,
 * excluyendo los ESTABLE y limitando a `limite` (default 5).
 *
 * Devuelve array de objetos: { ...alumno, prioridad }
 */
export function priorizarAlumnos(alumnos, limite = 5) {
  return alumnos
    .map((alumno) => ({
      ...alumno,
      prioridad: calcularPrioridad(alumno),
    }))
    .filter((a) => a.prioridad.nivel < PRIORIDAD.ESTABLE.nivel)
    .sort((a, b) => a.prioridad.nivel - b.prioridad.nivel)
    .slice(0, limite);
}
