import { mergeRutinasAsignadas } from './routineAssignment.js';

export async function getSupabaseSessionUserId(supabaseClient) {
  if (!supabaseClient || !supabaseClient.auth || typeof supabaseClient.auth.getSession !== "function") {
    return { session: null, userId: "", error: new Error("Supabase Auth no disponible") };
  }

  try {
    var sessionResult = await supabaseClient.auth.getSession();
    if (sessionResult.error) {
      return { session: null, userId: "", error: sessionResult.error };
    }
    var session = sessionResult.data && sessionResult.data.session;
    var userId = session?.user?.id ? String(session.user.id) : "";
    return { session: session || null, userId: userId, error: null };
  } catch (e) {
    return { session: null, userId: "", error: e };
  }
}

export function getAlumnoIdsFromScope(alumnosScope) {
  var listaAlumnos = Array.isArray(alumnosScope) && alumnosScope.length > 0 ? alumnosScope : [];
  return (listaAlumnos || []).map(function (a) { return a && a.id; }).filter(Boolean);
}

export async function loadRutinasByEntrenador({ sb, entrenadorId }) {
  if (!sb || typeof sb.getRutinasByEntrenador !== "function") return null;
  return sb.getRutinasByEntrenador(entrenadorId);
}

export async function loadRutinasByAlumnoIds({ sb, alumnoIds }) {
  if (!sb || typeof sb.getRutinasByAlumnoIds !== "function") return null;
  var ids = (alumnoIds || []).map(function (id) { return String(id); }).filter(Boolean);
  if (ids.length === 0) return null;
  return sb.getRutinasByAlumnoIds(ids);
}

export async function loadCoachRutinas({ supabaseClient, sb, alumnosScope }) {
  var auth = await getSupabaseSessionUserId(supabaseClient);
  if (auth.error || !auth.userId) {
    return {
      session: auth.session,
      sessionUserId: auth.userId,
      sessionError: auth.error,
      entrenadorId: auth.userId,
      alumnoIds: getAlumnoIdsFromScope(alumnosScope),
      result: null,
      fallbackResult: null,
      mergedResult: null,
    };
  }

  var result = await loadRutinasByEntrenador({ sb: sb, entrenadorId: auth.userId });
  var alumnoIds = getAlumnoIdsFromScope(alumnosScope);
  var fallbackResult = alumnoIds.length > 0
    ? await loadRutinasByAlumnoIds({ sb: sb, alumnoIds: alumnoIds })
    : null;
  var mergedResult = mergeRutinasAsignadas(result || [], Array.isArray(fallbackResult) ? fallbackResult : []);

  return {
    session: auth.session,
    sessionUserId: auth.userId,
    sessionError: null,
    entrenadorId: auth.userId,
    alumnoIds: alumnoIds,
    result: result,
    fallbackResult: fallbackResult,
    mergedResult: mergedResult,
  };
}
