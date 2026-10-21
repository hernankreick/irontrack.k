// Modo demo de la interfaz del alumno (datos ficticios, sin backend). Es una constante de COMPILACION: vite.config.js la define como
// `true` solo en un build de demo explicito (ver lib/demoBuildGuard.js) y como `false` en cualquier otro, incluido Production, donde el
// codigo de demo se elimina del bundle (no existe ni se puede activar en runtime).
export const DEMO_MODE = typeof __IRONTRACK_DEMO__ !== "undefined" && __IRONTRACK_DEMO__ === true;

/** API de demo registrada por demo/bootDemo.js antes de montar la app (solo existe en builds de demo). */
export function demoApi() {
  return DEMO_MODE ? globalThis.__IRONTRACK_DEMO_API__ || null : null;
}
