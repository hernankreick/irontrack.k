// «Nota del día» (ficha del alumno, vista entrenador): reglas del envío, sin React ni red. Las usan StudentsSection y los tests.
//
// Contrato real de sb.setNota (App.jsx): sbFetch("notas", "POST", data) con «Prefer: return=representation».
//   - éxito          -> array con la fila insertada (PostgREST devuelve la representación);
//   - error HTTP     -> null (sbFetch registra el error y NO lanza);
//   - falla de red   -> la promesa rechaza (fetch lanza);
//   - JSON inválido  -> la promesa rechaza (JSON.parse lanza).
// Solo un array con al menos una fila confirma el guardado; cualquier otra respuesta se informa como error y el borrador se conserva.

/** Interpreta la respuesta de sb.setNota: { ok: true } solo con la fila insertada confirmada. */
export function resultadoEnvioNota(res) {
  if (res == null) return { ok: false, motivo: "rechazada" };
  if (Array.isArray(res) && res.length > 0 && res[0] && typeof res[0] === "object") return { ok: true };
  return { ok: false, motivo: "sin_confirmar" };
}

/** Texto que muestra el textarea: el borrador solo es visible en la ficha del alumno para el que se escribió. */
export function notaVisible(texto, duenoId, alumnoId) {
  return duenoId != null && alumnoId != null && String(duenoId) === String(alumnoId) ? String(texto || "") : "";
}

/** Al abrir la ficha de `abiertoId`: el borrador de otro alumno se descarta (contraer/expandir la misma ficha lo conserva). */
export function debeDescartarBorrador(duenoId, abiertoId) {
  return duenoId != null && abiertoId != null && String(duenoId) !== String(abiertoId);
}

/**
 * Envíos de nota con candado síncrono por alumno: dos toques en el mismo ciclo producen UNA sola solicitud.
 * enviar({ alumnoId, texto, ejecutar(textoLimpio) -> Promise<respuesta de sb.setNota>, onInicio(id), onResultado(id, resultado) })
 * El candado se libera siempre (éxito, error HTTP, red o respuesta sin confirmar) antes de avisar el resultado.
 */
export function crearEnviosNota() {
  const enCurso = new Set();
  return {
    enCurso: function (alumnoId) { return enCurso.has(String(alumnoId)); },
    enviar: async function (o) {
      const id = String(o.alumnoId);
      const limpio = String(o.texto || "").trim();
      if (!limpio) return { ok: false, motivo: "vacia", omitido: true };
      if (enCurso.has(id)) return { ok: false, motivo: "en_curso", omitido: true };
      enCurso.add(id);
      if (typeof o.onInicio === "function") o.onInicio(id);
      let resultado;
      try {
        resultado = resultadoEnvioNota(await o.ejecutar(limpio));
      } catch (e) {
        resultado = { ok: false, motivo: "red", error: e };
      } finally {
        enCurso.delete(id);
      }
      if (typeof o.onResultado === "function") o.onResultado(id, resultado);
      return resultado;
    },
  };
}

/**
 * Qué hacer cuando vuelve el envío de la nota del alumno `id`, según la ficha que está abierta AHORA (vista = { abierto, dueno }):
 *   - éxito: vaciar el borrador SOLO si sigue siendo de ese alumno; aviso de éxito (con el nombre si su ficha ya no está abierta);
 *   - error: conservar el borrador; error visible solo en la ficha de ese alumno (nunca en la de otro); un único aviso.
 * Devuelve { limpiarBorrador, error: { alumnoId, texto } | null, aviso }.
 */
export function decidirResultadoNota(o) {
  const id = String(o.alumnoId);
  const vista = o.vista || {};
  const msg = o.msg;
  const enVista = vista.abierto != null && String(vista.abierto) === id;
  const sufijo = enVista || !o.quien ? "" : " · " + o.quien;
  const r = o.resultado || {};
  if (r.ok) {
    return { limpiarBorrador: vista.dueno != null && String(vista.dueno) === id, error: null, aviso: msg("Nota enviada ✓", "Note sent ✓") + sufijo };
  }
  const texto = r.motivo === "sin_confirmar"
    ? msg("No se pudo confirmar el envío de la nota. Intentá de nuevo.", "Could not confirm the note was sent. Please try again.")
    : msg("No se pudo enviar la nota. Revisá la conexión e intentá de nuevo.", "Could not send the note. Check your connection and try again.");
  return { limpiarBorrador: false, error: enVista ? { alumnoId: id, texto: texto } : null, aviso: texto + sufijo };
}
