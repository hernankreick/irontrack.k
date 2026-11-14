// «Marcar pagado» (H6): helpers puros, sin React. La escritura sigue siendo la de siempre: sb.updateAlumno(id, { ultimo_pago_confirmado: ISO }).
//
// Contrato de sb.updateAlumno (App.jsx: sbFetch PATCH con "Prefer: return=representation"):
//   - error HTTP        -> null (sbFetch ya lo registro en consola)
//   - falla de red      -> lanza
//   - PATCH aplicado    -> arreglo con la(s) fila(s) actualizada(s)
//   - PATCH sin efecto  -> [] (ninguna fila coincidio, p. ej. RLS) => el pago NO quedo guardado
// Antes un [] se tomaba como exito (![] es false). Aca solo cuenta como guardado un arreglo NO vacio.

/** true solo si la respuesta de updateAlumno confirma al menos una fila actualizada. */
export function pagoGuardado(respuesta) {
  return Array.isArray(respuesta) && respuesta.length > 0;
}

/** Etiqueta del alumno para mensajes (nombre, o email). */
export function nombreAlumno(alumno) {
  return (alumno && (alumno.nombre || alumno.email)) || "";
}

/**
 * Registra el pago de UN alumno. Devuelve { ok: true, ahora } o { ok: false, motivo: "rechazado" | "red" }; nunca lanza.
 * `ahora` es el instante escrito (para reflejarlo en la lista solo cuando el guardado se confirmo).
 */
export async function registrarPagoAlumno(sb, alumno, ahora) {
  var instante = ahora instanceof Date ? ahora : new Date();
  var iso = instante.toISOString();
  try {
    var respuesta = await sb.updateAlumno(alumno.id, { ultimo_pago_confirmado: iso });
    if (!pagoGuardado(respuesta)) return { ok: false, motivo: "rechazado" };
    return { ok: true, ahora: iso };
  } catch (e) {
    console.error("[marcarPagado]", e);
    return { ok: false, motivo: "red" };
  }
}

/**
 * C-01: texto de estado de pago para la tarjeta del alumno (vista del entrenador). Solo hechos: la fecha del ultimo pago
 * confirmado o "sin pago registrado" (no hay regla de vencimiento definida, asi que no se inventa un "vencido").
 * Devuelve { texto, registrado }.
 */
export function estadoPagoAlumno(ultimoPagoConfirmado, es) {
  var d = ultimoPagoConfirmado ? new Date(ultimoPagoConfirmado) : null;
  if (!d || isNaN(d.getTime())) return { texto: es ? "Sin pago registrado" : "No payment recorded", registrado: false };
  var dd = String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0");
  return { texto: (es ? "Pagó el " : "Paid on ") + dd, registrado: true };
}
