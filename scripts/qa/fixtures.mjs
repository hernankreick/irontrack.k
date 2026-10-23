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

// Escenarios opt-in de Progreso -> Evolucion de carga (QA_PROGRESO_SCENARIO=vacio|una|varias|hueco).
// Sin la variable, la rutina y la tabla progreso quedan EXACTAMENTE como antes (baseline de qa:ui intacto).
export const PROGRESO_SCENARIO = () => process.env.QA_PROGRESO_SCENARIO || "";
const fmtDMY = (d) => String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return fmtDMY(d); };
// kg FICTICIOS del ejercicio de calentamiento "gcsq" (primer ejercicio del dia, el que Progreso selecciona por defecto).
const PROGRESO_ROWS = {
  vacio: [],
  una: [[0, 40]],
  varias: [[14, 40], [14, 37.5], [7, 42.5]],
  hueco: [[14, 40], [0, 37.5]],
};
export function progresoRows(alumnoId) {
  const rows = PROGRESO_ROWS[PROGRESO_SCENARIO()];
  if (!rows || alumnoId !== ALUMNOS[0].id) return [];
  return rows.map(([ago, kg], i) => ({ alumno_id: alumnoId, ejercicio_id: "gcsq", kg: String(kg), reps: "8", fecha: daysAgo(ago), semana: 1, created_at: "2026-01-0" + (i + 1) + "T10:00:00" }));
}

export function rutinaDe(alumno) {
  const withIds = !!PROGRESO_SCENARIO();
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
          warmup: withIds ? [{ id: "gcsq", name: "Sentadilla de copa", sets: 2, reps: "10", weeks: [] }] : [],
          exercises: [{ ...(withIds ? { id: "sq" } : {}), name: "Sentadilla", sets: 3, reps: "8", weeks: [0, 1, 2, 3].map(() => ({ sets: "3", reps: "8", kg: "", note: "", pausa: "" })) }],
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

// Ejercicios propios FICTICIOS con etiquetas largas y titulo de 4 lineas. Opt-in extra (QA_CUSTOM_LONG=1), solo para library-cards-overflow.
const CUSTOM_LONG = [
  ["custom_qa_2", "Prensa propia de prueba", "Cuadriceps/Gluteos/Abductores"],
  ["custom_qa_3", "Curl femoral propio de prueba", "Isquios/Gluteos/Abductores"],
  ["custom_qa_4", "Ejercicio propio ficticio con un titulo larguisimo que ocupa cuatro lineas completas en pantallas angostas de telefono", "Cuadriceps/Gluteos/Abductores/Isquiotibiales"],
].map(([id, name, muscle]) => ({ id, entrenador_id: EID, name, name_en: name, pattern: "rodilla", muscle, equip: "Libre", video_url: "https://youtu.be/dQw4w9WgXcQ", is_custom: true }));

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
  // Ejercicios propios FICTICIOS (tarjeta con 3 acciones: editar, video y borrar). Opt-in (QA_CUSTOM_EX=1) para no alterar el baseline de qa:ui.
  if (table.startsWith("ejercicios_custom") && process.env.QA_CUSTOM_EX === "1") {
    return { status: 200, body: [{ id: "custom_qa_1", entrenador_id: EID, name: "Ejercicio propio de prueba con nombre largo", name_en: "Custom test exercise with a long name", pattern: "empuje", muscle: "Pecho, Triceps", equip: "Libre", video_url: "https://youtu.be/dQw4w9WgXcQ", is_custom: true }, ...(process.env.QA_CUSTOM_LONG === "1" ? CUSTOM_LONG : [])] };
  }
  if (table.startsWith("progreso") && PROGRESO_SCENARIO()) {
    return { status: 200, body: ALUMNOS.flatMap((a) => progresoRows(a.id)) };
  }
  if (table.startsWith("entrenadores")) return { status: 200, body: [{ id: EID, email: "coach@example.invalid", nombre: "Entrenador Prueba" }] };
  return { status: 200, body: [] };
}
