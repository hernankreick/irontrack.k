// Chat coach-alumno: recuperacion de los ULTIMOS mensajes, criterio de exito del envio y destino de los CTA globales del Dashboard.
// Logica pura (sin React ni red) para poder probarla con mocks.
//
// Esquema confirmado en Supabase (solo lectura, information_schema): mensajes.id uuid NOT NULL, created_at timestamp SIN zona (nullable),
// alumno_id uuid (nullable).

export const CHAT_PAGE_LIMIT = 50;

/**
 * Ruta REST de los ultimos `limit` mensajes de un alumno, del mas nuevo al mas viejo.
 *  - created_at.desc.nullslast: en PostgreSQL DESC pone los NULL primero; con nullslast un mensaje sin fecha nunca desplaza a los recientes
 *    (queda como el mas viejo).
 *  - id.desc: desempate estable cuando varios mensajes comparten created_at (id es uuid: el orden entre empatados es determinista pero no
 *    cronologico; el empate exacto de un timestamp con microsegundos es muy poco probable).
 */
export function mensajesPath(alumnoId, limit) {
  const n = Number.isInteger(limit) && limit > 0 ? limit : CHAT_PAGE_LIMIT;
  return "mensajes?alumno_id=eq." + encodeURIComponent(String(alumnoId)) + "&select=*&order=created_at.desc.nullslast,id.desc&limit=" + n;
}

/** Filas (mas nuevo primero) -> orden cronologico (mas viejo primero) para pintar. `null` (error) se conserva como `null`. */
export function enOrdenCronologico(rows) {
  return Array.isArray(rows) ? rows.slice().reverse() : null;
}

/** Agrega `msg` al final salvo que ya este (mismo id): el polling puede traerlo antes de que termine el envio. */
export function appendUnique(list, msg) {
  const base = Array.isArray(list) ? list : [];
  if (msg && msg.id != null && base.some((m) => m && m.id != null && String(m.id) === String(msg.id))) return base;
  return base.concat([msg]);
}

/** El envio solo cuenta como guardado si el servidor devolvio la fila creada (Prefer: return=representation). */
export function isSavedMessage(res) {
  return Array.isArray(res) && res.length > 0 && !!res[0] && typeof res[0] === "object" && res[0].id != null;
}

/**
 * Ejecuta el envio y lo clasifica. `addFn` es sb.addMensaje: devuelve la fila creada, `null` ante un error HTTP (403/500...) y LANZA ante un
 * error de red. Nunca lanza.
 * @returns {Promise<{ok:true, mensaje:object} | {ok:false, reason:"servidor"|"red"}>}
 */
export async function enviarMensaje(addFn, payload) {
  let res;
  try {
    res = await addFn(payload);
  } catch (e) {
    return { ok: false, reason: "red" };
  }
  return isSavedMessage(res) ? { ok: true, mensaje: res[0] } : { ok: false, reason: "servidor" };
}

/** Texto de error para el usuario (nunca el error crudo del servidor). */
export function mensajeErrorEnvio(reason, es) {
  if (reason === "red") {
    return es ? "Sin conexión. Tu mensaje sigue acá; tocá ▶ para reintentar." : "No connection. Your message is still here; tap ▶ to retry.";
  }
  return es ? "No se pudo enviar. Tu mensaje sigue acá; tocá ▶ para reintentar." : "Could not send. Your message is still here; tap ▶ to retry.";
}

/** Candado SINCRONO contra doble envio (el estado de React llega tarde: dos toques en el mismo ciclo ven `false`). */
export function createSendLock() {
  let busy = false;
  return {
    get busy() { return busy; },
    async run(fn) {
      if (busy) return undefined;
      busy = true;
      try { return await fn(); } finally { busy = false; }
    },
  };
}

/**
 * CTA GLOBAL "Enviar mensaje" del Dashboard (no tiene un alumno asociado): nunca abre un chat con un alumno elegido por posicion. Lleva a
 * Alumnos con el filtro adecuado para que el entrenador elija a quien escribirle.
 */
export function resolveDashboardMessageTarget(counts) {
  const c = counts || {};
  if (!(c.todos > 0)) return { empty: true };
  return { empty: false, tab: "alumnos", filter: c.inactivos > 0 ? "inactivos" : "todos" };
}
