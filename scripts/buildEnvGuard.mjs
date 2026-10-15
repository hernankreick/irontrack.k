// Controles de build para separar Production y Preview (se usan desde vite.config.js).
//  - Production (VERCEL_ENV=production o VITE_REQUIRE_SUPABASE=1): las variables de Supabase son obligatorias; si faltan el build FALLA.
//  - Preview (VERCEL_ENV=preview): no puede apuntar al proyecto de PRODUCCION (falla), salvo VITE_ALLOW_PROD_IN_PREVIEW=1.
//    Sin variables, el build sale pero la app queda sin base de datos (aviso).
import { readSupabaseEnv } from "../lib/supabaseEnv.js";

export const PROD_SUPABASE_REF = "ilcdexckizxtcxopfxlq";

export function checkBuildEnv(opts) {
  var env = (opts && opts.env) || {};
  var vercelEnv = (opts && opts.vercelEnv) || "";
  var s = readSupabaseEnv(env);
  var errors = [], warnings = [];
  var requireDb = vercelEnv === "production" || env.VITE_REQUIRE_SUPABASE === "1";
  if (!s.configured) {
    if (requireDb) errors.push("Build de PRODUCCION sin conexion a Supabase: " + s.reason + ". Defini VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el entorno Production de Vercel.");
    else warnings.push("Sin conexion a Supabase (" + s.reason + "): la app se construye pero queda sin base de datos (modo inerte).");
  } else if (vercelEnv === "preview" && s.url.indexOf(PROD_SUPABASE_REF) !== -1 && env.VITE_ALLOW_PROD_IN_PREVIEW !== "1") {
    errors.push("Un build de PREVIEW apunta a la base de PRODUCCION. Quita VITE_SUPABASE_* del entorno Preview de Vercel (o usa un proyecto de QA). " +
      "Solo para una excepcion consciente: VITE_ALLOW_PROD_IN_PREVIEW=1.");
  }
  return { errors: errors, warnings: warnings, configured: s.configured };
}
