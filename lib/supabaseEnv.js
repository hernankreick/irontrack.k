// Lectura validada de la conexion a Supabase. Sin valores de respaldo: si falta o es un marcador de ejemplo, la app queda
// "sin base de datos" (no se emite ninguna peticion de red) en lugar de usar otra conexion.

const PLACEHOLDER_RE = /(your|tu[-_]|example|changeme|xxxx|<|>|\.\.\.|placeholder)/i;

export function readSupabaseEnv(env) {
  var e = env || {};
  var url = typeof e.VITE_SUPABASE_URL === "string" ? e.VITE_SUPABASE_URL.trim() : "";
  var key = typeof e.VITE_SUPABASE_ANON_KEY === "string" ? e.VITE_SUPABASE_ANON_KEY.trim() : "";
  var reason = "";
  if (!url) reason = "VITE_SUPABASE_URL no esta definida";
  else if (!key) reason = "VITE_SUPABASE_ANON_KEY no esta definida";
  else {
    var parsed = null;
    try { parsed = new URL(url); } catch (err) { parsed = null; }
    if (!parsed || (parsed.protocol !== "https:" && parsed.protocol !== "http:")) reason = "VITE_SUPABASE_URL no es una URL http(s) valida";
    else if (PLACEHOLDER_RE.test(url) || PLACEHOLDER_RE.test(key) || key.length < 20) reason = "las variables de Supabase contienen valores de ejemplo";
  }
  if (reason) return { configured: false, url: "", key: "", reason: reason };
  return { configured: true, url: url.replace(/\/+$/, ""), key: key, reason: "" };
}
