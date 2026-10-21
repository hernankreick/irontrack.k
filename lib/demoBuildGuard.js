// Decide si un build es de DEMO (interfaz del alumno con datos ficticios, sin Supabase). Nunca en Production.
//
//   - Se pide explicitamente con IRONTRACK_DEMO=1 (local/CI) o, en una Preview de Vercel, con una rama cuyo nombre empieza por "demo/".
//   - Production con IRONTRACK_DEMO=1 => el build FALLA (no se publica una app de demo ni con datos de produccion).
//   - Una rama "demo/..." nunca activa el demo en Production (la regla exige VERCEL_ENV=preview).
//   - En Vercel con VERCEL_ENV desconocido o distinto de preview/development el demo no se activa (fail-closed).
export function decideDemoBuild(env) {
  const e = env || {};
  const vercel = !!e.VERCEL;
  const target = String(e.VERCEL_ENV || "").toLowerCase();
  const flag = String(e.IRONTRACK_DEMO || "") === "1";
  const branchDemo = vercel && target === "preview" && /^demo\//.test(String(e.VERCEL_GIT_COMMIT_REF || ""));
  const requested = flag || branchDemo;
  if (!requested) return { demo: false };
  if (vercel && target === "production") {
    return { demo: false, error: "demo: IRONTRACK_DEMO=1 no esta permitido en Production. Quita la variable; el build de Production no incluye ni admite el modo demo." };
  }
  if (vercel && target !== "preview" && target !== "development") {
    return { demo: false, error: "demo: entorno de Vercel desconocido (" + (target || "sin VERCEL_ENV") + "); el modo demo solo se permite en Preview/Development." };
  }
  return { demo: true };
}
