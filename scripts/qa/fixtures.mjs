// Datos FICTICIOS para el QA visual. Nada de esto toca Supabase ni datos reales:
// el navegador responde a "mock-sb.invalid" con estas filas (ver lib.mjs).
export const MOCK_HOST = "mock-sb.invalid";
export const EID = "11111111-1111-4111-8111-111111111111";

export const ALUMNOS = [
  ["Ana Prueba", "22222222-2222-4222-8222-222222222221"],
  ["Beto Prueba", "22222222-2222-4222-8222-222222222222"],
  ["Cami Prueba", "22222222-2222-4222-8222-222222222223"],
].map(([nombre, id]) => ({
  id,
  nombre,
  email: nombre.split(" ")[0].toLowerCase() + "@example.invalid",
  entrenador_id: "entrenador_principal",
  created_at: "2026-01-01T10:00:00.000000",
}));

export function rutinaDe(alumno) {
  return {
    id: "rr-" + alumno.id.slice(-2),
    nombre: "Rutina " + alumno.nombre,
    alumno_id: alumno.id,
    entrenador_id: "entrenador_principal",
    es_plantilla: false,
    created_at: "2026-01-02T10:00:00",
    datos: {
      alumno: alumno.nombre,
      semana_activa: 1,
      days: [
        {
          name: "Dia 1",
          label: "Dia 1",
          warmup: [],
          exercises: [{ name: "Sentadilla", sets: 3, reps: "8", weeks: [0, 1, 2, 3].map(() => ({ sets: "3", reps: "8", kg: "", note: "", pausa: "" })) }],
        },
      ],
    },
  };
}

// Sesion de localStorage que la app lee al arrancar (rol entrenador o alumno).
export function sessionSeed(role) {
  const ls = { it_onboard_done: "1", it_dark: "true", it_lang: "es", it_week: "0", it_pg: "{}" };
  if (role === "alumno") {
    const a = ALUMNOS[0];
    ls.it_session = JSON.stringify({ role: "alumno", name: a.nombre, alumnoId: a.id, entrenadorId: EID });
    ls.it_rt = JSON.stringify([{ ...rutinaDe(a), name: "Rutina Prueba", days: rutinaDe(a).datos.days, saved: true }]);
    return ls;
  }
  ls.it_session = JSON.stringify({ role: "entrenador", name: "Entrenador Prueba", email: "coach@example.invalid", entrenadorId: EID });
  ls.it_rt = "[]";
  const exp = Math.floor(Date.now() / 1000) + 86400 * 30;
  const jwt = "eyJhbGciOiJIUzI1NiJ9." + Buffer.from(JSON.stringify({ sub: EID, exp })).toString("base64url") + ".sig";
  ls["sb-" + MOCK_HOST.split(".")[0] + "-auth-token"] = JSON.stringify({
    access_token: jwt, refresh_token: "rt", expires_in: 2592000, expires_at: exp, token_type: "bearer",
    user: { id: EID, email: "coach@example.invalid", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} },
  });
  return ls;
}

// Respuesta simulada de PostgREST. Devuelve { status, body, headers? } o null si no hay fila definida.
export function respond({ method, table, search }) {
  if (method === "HEAD") return { status: 200, headers: { "content-range": "*/0" }, body: "" };
  if (method !== "GET") return { status: 200, body: [] };
  if (table.startsWith("alumnos")) {
    const id = search.get("id");
    return { status: 200, body: id && id.startsWith("eq.") ? ALUMNOS.filter((a) => a.id === id.slice(3)) : ALUMNOS };
  }
  if (table.startsWith("rutinas")) {
    const aq = search.get("alumno_id");
    let rows = ALUMNOS.map(rutinaDe);
    if (aq && aq.startsWith("eq.")) rows = rows.filter((r) => r.alumno_id === aq.slice(3));
    return { status: 200, body: rows };
  }
  if (table.startsWith("entrenadores")) return { status: 200, body: [{ id: EID, email: "coach@example.invalid", nombre: "Entrenador Prueba" }] };
  return { status: 200, body: [] };
}
