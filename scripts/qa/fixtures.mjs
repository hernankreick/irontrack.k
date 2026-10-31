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

// Escenarios opt-in de Progreso -> Evolucion de carga (QA_PROGRESO_SCENARIO=vacio|una|varias|hueco|masdatos).
// Sin la variable, la rutina y la tabla progreso quedan EXACTAMENTE como antes (baseline de qa:ui intacto).
export const PROGRESO_SCENARIO = () => process.env.QA_PROGRESO_SCENARIO || "";
const fmtDMY = (d) => String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return fmtDMY(d); };
// Tercer valor = progreso.semana 0-based (como en produccion). kg FICTICIOS del ejercicio de calentamiento "gcsq" (primer ejercicio del dia, el que Progreso selecciona por defecto).
const PROGRESO_ROWS = {
  vacio: [],
  una: [[0, 40, 0]],
  varias: [[14, 40, 0], [14, 37.5, 0], [7, 42.5, 1]],
  hueco: [[14, 40, 0], [0, 37.5, 2]],
  // Opt-in: semanas consecutivas con decimales y rango grande (la ultima fecha cae en la semana siguiente si el bloque lo permite).
  masdatos: [[14, 62.5, 0], [7, 87.5, 1], [0, 142.5, 2], [-7, 120, 3]],
};
export function progresoRows(alumnoId) {
  const rows = PROGRESO_ROWS[PROGRESO_SCENARIO()];
  if (!rows || alumnoId !== ALUMNOS[0].id) return [];
  return rows.map(([ago, kg, wk], i) => ({ alumno_id: alumnoId, ejercicio_id: "gcsq", kg: String(kg), reps: "8", fecha: daysAgo(ago), semana: wk, created_at: "2026-01-0" + (i + 1) + "T10:00:00" }));
}

// Escenario opt-in de la ficha del alumno (QA_ALUMNO_CARD=base|largo): rutina de 3 (o 5) dias, Semana 2 con 2 dias realizados.
// "largo": nombre, correo y titulo de rutina extensos. Sin la variable todo queda EXACTAMENTE como antes (baseline de qa:ui intacto).
export const ALUMNO_CARD_SCENARIO = () => process.env.QA_ALUMNO_CARD || "";
const CARD_EX = (pfx, names) => names.map(([name, sets, reps], i) => ({ id: pfx + i, name, sets, reps }));
function alumnoCardRutina(alumno) {
  const largo = ALUMNO_CARD_SCENARIO() === "largo";
  const nDays = largo ? 5 : 3;
  const days = Array.from({ length: nDays }, (_, d) => ({
    name: "Día " + (d + 1),
    label: "Día " + (d + 1),
    warmup: CARD_EX("wu" + d + "_", [["T90", 2, "8-10"], ["Rotacion toracica", 2, "8-10"], ["Puente de gluteos 1 pierna", 2, "8"], ["Bicho muerto con disco", 3, "12"]]),
    exercises: CARD_EX("ex" + d + "_", [["Sentadilla goblet", 4, "8"], ["Press banca con mancuernas", 4, "10"], ["Remo con barra", 3, "10"]]),
  }));
  return {
    id: "rr-" + alumno.id.slice(-2),
    nombre: largo ? "Rutina de fuerza e hipertrofia para temporada de competencia" : "Rutina Full body",
    alumno_id: alumno.id,
    entrenador_id: "entrenador_principal",
    es_plantilla: false,
    created_at: "2026-01-02T10:00:00",
    datos: { alumno: alumno.nombre, semana_activa: 2, days },
  };
}
export function sesionesRows() {
  if (!ALUMNO_CARD_SCENARIO()) return [];
  return ALUMNOS.flatMap((a) => [0, 1].map((dia) => ({ id: "ses-" + a.id.slice(-2) + "-" + dia, alumno_id: a.id, rutina_id: "rr-" + a.id.slice(-2), rutina_nombre: alumnoCardRutina(a).nombre, dia_idx: dia, dia_label: "Día " + (dia + 1), semana: 2, fecha: "20/10/2026", hora: "18:00", ejercicios: "", created_at: "2026-10-20T18:00:0" + dia })));
}
// Escenario opt-in de navegacion del Dashboard (QA_DASH_NAV=1, scripts/qa/dashboard-nav.mjs): Ana inactiva (sin sesiones), Beto con
// baja actividad (entreno hace 15 dias: antes de la semana pasada con cualquier dia de hoy, dentro de los 21 dias) y Cami sin rutina; hay una rutina local para el flujo de asignacion. Sin la variable, nada cambia.
export const DASH_NAV_SCENARIO = () => process.env.QA_DASH_NAV === "1";
const dmyHace = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear(); };
export function dashNavSesiones() {
  const b = ALUMNOS[1];
  const t = new Date(); t.setDate(t.getDate() - 15); t.setHours(15, 0, 0, 0);
  // D5: Cami (sin rutina) tiene una sesion de HOY sin rutina asignada: sigue «Sin rutina» pero aparece en «Actividad reciente» (14 dias),
  // que es desde donde el QA abre su ficha (Beto, hace 15 dias, queda fuera de esa ventana).
  const c = ALUMNOS[2];
  const hoy = new Date(); hoy.setHours(10, 0, 0, 0);
  const hoySes = { id: "ses-nav-2", alumno_id: c.id, rutina_id: null, rutina_nombre: "", dia_idx: 0, dia_label: "Dia 1", semana: 1, fecha: dmyHace(0), hora: "10:00", ejercicios: "", created_at: hoy.toISOString() };
  return [hoySes, { id: "ses-nav-1", alumno_id: b.id, rutina_id: "rr-" + b.id.slice(-2), rutina_nombre: "Rutina " + b.nombre, dia_idx: 0, dia_label: "Dia 1", semana: 1, fecha: dmyHace(15), hora: "15:00", ejercicios: "", created_at: t.toISOString() }];
}

export function alumnosRows() {
  if (ALUMNO_CARD_SCENARIO() !== "largo") return ALUMNOS;
  return ALUMNOS.map((a, i) => i ? a : { ...a, nombre: "Maria Fernanda de los Angeles Gonzalez Etcheverry", email: "maria.fernanda.gonzalez.etcheverry.entrenamiento@example.invalid" });
}

export function rutinaDe(alumno) {
  if (ALUMNO_CARD_SCENARIO()) return alumnoCardRutina(alumno);
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
  const ls = { it_onboard_done: "1", it_dark: process.env.QA_THEME === "light" ? "false" : "true", it_lang: "es", it_week: "0", it_pg: "{}" };
  if (role === "alumno") {
    const a = ALUMNOS[0];
    ls.it_session = JSON.stringify({ role: "alumno", name: a.nombre, alumnoId: a.id, entrenadorId: EID });
    ls.it_rt = JSON.stringify([{ ...rutinaDe(a), name: "Rutina Prueba", days: rutinaDe(a).datos.days, saved: true }]);
    return ls;
  }
  ls.it_session = JSON.stringify({ role: "entrenador", name: "Entrenador Prueba", email: "coach@example.invalid", entrenadorId: EID });
  ls.it_rt = DASH_NAV_SCENARIO() ? JSON.stringify([{ id: "rt-local-nav", name: "Rutina local QA", days: [{ label: "Dia 1", warmup: [], exercises: [{ name: "Sentadilla", sets: 3, reps: "8" }] }], saved: true }]) : "[]";
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
    const rows = alumnosRows();
    return { status: 200, body: id && id.startsWith("eq.") ? rows.filter((a) => a.id === id.slice(3)) : rows };
  }
  if (table.startsWith("rutinas")) {
    const aq = search.get("alumno_id");
    let rows = ALUMNOS.map(rutinaDe);
    if (DASH_NAV_SCENARIO()) rows = rows.filter((r) => r.alumno_id !== ALUMNOS[2].id);
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
  if (table.startsWith("sesiones") && DASH_NAV_SCENARIO()) {
    const v = search.get("alumno_id");
    return { status: 200, body: dashNavSesiones().filter((r) => !(v && v.startsWith("eq.")) || r.alumno_id === v.slice(3)) };
  }
  if (table.startsWith("sesiones") && ALUMNO_CARD_SCENARIO()) {
    const eq = (k) => { const v = search.get(k); return v && v.startsWith("eq.") ? v.slice(3) : null; };
    const aid = eq("alumno_id"), rid = eq("rutina_id"), sem = eq("semana");
    if (search.get("rutina_id") === "is.null") return { status: 200, body: [] };
    return { status: 200, body: sesionesRows().filter((r) => (!aid || r.alumno_id === aid) && (!rid || r.rutina_id === rid) && (!sem || String(r.semana) === sem)) };
  }
  if (table.startsWith("entrenadores")) return { status: 200, body: [{ id: EID, email: "coach@example.invalid", nombre: "Entrenador Prueba" }] };
  return { status: 200, body: [] };
}
