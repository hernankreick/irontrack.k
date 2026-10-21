// Plugin de Vite: corre el guard de entorno en `vite build`, sin importar como lo invoque la plataforma
// (npm run build, vite build directo o buildCommand propio). No actua en `vite dev`.
import { runEnvTargetGuard, printGuardResult } from "./envTargetGuard.js";
import { decideDemoBuild } from "./demoBuildGuard.js";

export function envTargetGuardPlugin() {
  return {
    name: "irontrack-env-target-guard",
    apply: "build",
    configResolved(config) {
      if (decideDemoBuild(process.env).demo) {
        // Build de demo: URL y clave de Supabase se reemplazan por vacios en el bundle (vite.config.js), asi que no hay destino que validar.
        console.log("[env-target] DEMO build: Supabase neutralizado (URL y clave vacias en el bundle) => OK");
        return;
      }
      let out;
      try {
        out = runEnvTargetGuard({ root: config.root, env: process.env, effective: config.env || {} });
      } catch (e) {
        // Un fallo INTERNO del guard (no una validacion) nunca debe tumbar Production ni builds locales; en Preview/Development es fail-closed.
        const hosted = !!process.env.VERCEL;
        const prod = (process.env.VERCEL_ENV || "").toLowerCase() === "production";
        console.log("[env-target] error interno del guard: " + (e && e.message ? e.message : "desconocido"));
        if (hosted && !prod) throw new Error("env-target: el guard fallo y el build no es Production (fail-closed).");
        return;
      }
      printGuardResult(out);
      if (out.result.status === "fail") {
        throw new Error("env-target: build bloqueado. Ver mensajes [env-target] arriba (Preview/Development no pueden usar un .env versionado ni el Supabase de produccion; Production exige VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY validas).");
      }
    },
  };
}
