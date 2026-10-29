// Cliente RPC minimo para las escrituras atomicas de rutinas.datos (migracion P0). Sin dependencias: lo usan
// lib/rutinaOperationalState.js, lib/updateRutinaSemanaActiva.js y lib/reiniciarRutinaCiclo.js. Ver lib/rutinaRpc.js.

export const RPC = {
  REINICIAR: "it_rutina_reiniciar",
  AVANZAR_SEMANA: "it_rutina_avanzar_semana",
  GUARDAR_CONTENIDO: "it_rutina_guardar_contenido",
};

/** La funcion RPC no existe en la base (migracion P0 sin aplicar) o el cliente no expone rpc(). */
export function isMissingFunctionError(error) {
  if (!error) return false;
  var code = String(error.code || "");
  if (code === "PGRST202" || code === "42883") return true;
  return /could not find the function|function .* does not exist/i.test(String(error.message || ""));
}

export function hasRpc(client) {
  return !!client && typeof client.rpc === "function";
}

/** Llama una RPC. Devuelve { data, error, missing } y nunca lanza. */
export async function callRpc(client, name, args) {
  if (!hasRpc(client)) return { data: null, error: null, missing: true };
  var res;
  try {
    res = await client.rpc(name, args);
  } catch (e) {
    return { data: null, error: e || { message: "rpc_error" }, missing: false };
  }
  if (res && res.error) return { data: null, error: res.error, missing: isMissingFunctionError(res.error) };
  var data = res ? res.data : null;
  if (data && !Array.isArray(data) && typeof data === "object") data = [data];
  return { data: Array.isArray(data) ? data : [], error: null, missing: false };
}

