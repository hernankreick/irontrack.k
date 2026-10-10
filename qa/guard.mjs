// Controles anti-produccion para las pruebas QA. Cualquier script QA debe llamar a assertLocalSupabaseUrl() antes de conectar.
export const PROD_PROJECT_REF = "ilcdexckizxtcxopfxlq";
const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export function isSafeLocalUrl(raw) {
  let u;
  try { u = new URL(String(raw)); } catch (e) { return false; }
  if (!LOOPBACK.has(u.hostname)) return false;
  if (/supabase\.(co|in|net|com)/i.test(u.hostname) || String(raw).includes(PROD_PROJECT_REF)) return false;
  return true;
}

export function assertLocalSupabaseUrl(raw, label = "SUPABASE_URL") {
  if (!isSafeLocalUrl(raw)) {
    throw new Error(`[QA GUARD] ${label} no es loopback o apunta a Supabase hospedado/produccion. Se aborta sin conectar.`);
  }
  return String(raw);
}

/** El host de un request del navegador esta permitido solo si es loopback (los QA no deben salir a internet). */
export function isAllowedBrowserHost(hostname) {
  return LOOPBACK.has(hostname) || hostname === "127.0.0.1";
}

// irontrack_qa = stack nativo (qa/stack.sh); postgres = base por defecto de `supabase start` (Docker). Siempre loopback:54322.
export function assertLocalDb(host, port, db) {
  if (!LOOPBACK.has(host) || String(port) !== "54322" || !["irontrack_qa", "postgres"].includes(db)) {
    throw new Error(`[QA GUARD] solo se permite 127.0.0.1:54322/{irontrack_qa|postgres} (recibido ${host}:${port}/${db}).`);
  }
}
