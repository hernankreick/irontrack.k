// Inserción IDEMPOTENTE de una serie en `progreso` (usa progreso.id uuid como clave de la operación).
//
// Cada serie tiene un opId (UUID v4, lib/pendingSyncQueue.js) que se envía como progreso.id en el POST inicial y en TODOS los reintentos.
// Si el servidor ya guardó la fila (respuesta perdida o timeout), el reintento recibe 409/23505 sobre ESE id. Eso NO se toma como éxito:
// se lee la fila por id y solo se confirma si pertenece al mismo alumno y coincide con la serie (misma operación). Cualquier otro 409,
// una fila ilegible/ausente, de otro alumno o distinta => no confirmado (la serie queda en cola).
//
// Sin acceso a red: post(payload) y getById(id) se inyectan y devuelven { ok, status, data } (o lanzan ante una falla de red).
import { isConfirmedProgressInsert, isUuid, isSameProgressRow } from "./workoutSession.js";

// 23505 sobre la clave primaria `progreso_pkey` (nunca cualquier 409 ni otra restriccion unica).
//  - Si PostgREST trae el detalle ("Key (id)=(<uuid>) already exists."), debe ser ESTE id.
//  - Con RLS activo Postgres OMITE ese detalle (details: null): entonces se acepta solo si la restriccion nombrada es progreso_pkey. Como el
//    payload lleva un id propio, un conflicto de la clave primaria solo puede ser sobre ese id; la fila se verifica igualmente despues.
export function isIdConflict(res, id) {
  if (!res || res.ok || res.status !== 409) return false;
  var d = res.data;
  if (!d || typeof d !== "object" || String(d.code) !== "23505") return false;
  var details = String(d.details || "").toLowerCase();
  if (details) return details.indexOf("(id)=(" + String(id).toLowerCase() + ")") !== -1;
  return String(d.message || "").toLowerCase().indexOf('unique constraint "progreso_pkey"') !== -1;
}

/**
 * Devuelve las filas [{...}] si la serie quedó confirmada (insertada ahora o ya existente y verificada), o null si no se pudo confirmar.
 * Lanza solo si post() o getById() lanzan (falla de red): el que llama (persistSetConfirmed) lo trata como no confirmado.
 */
export async function postProgressIdempotent(io, payload) {
  var res = await io.post(payload);
  if (res && res.ok) return isConfirmedProgressInsert(res.data) ? res.data : null;
  if (!payload || !isUuid(payload.id) || !isIdConflict(res, payload.id)) return null;
  var got = null;
  try { got = await io.getById(payload.id); } catch (e) { return null; }
  if (!got || !got.ok || !Array.isArray(got.data) || got.data.length !== 1) return null;
  return isSameProgressRow(got.data[0], payload) ? got.data : null;
}
