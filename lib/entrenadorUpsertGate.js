// Con RLS v1 (docs/rls-v1) solo un entrenador autorizado puede escribir en `entrenadores`. Una cuenta de alumno (app_metadata.alumno_id, o sesion
// local de rol alumno) no debe intentar el upsert: la base lo rechazaria en cada inicio de sesion y dejaria un error en consola.
// Es solo una cortesia de la interfaz: la autorizacion real la impone la base, no este chequeo.
export function debeRegistrarEntrenador(user, sesionLocal) {
  if (!user || !user.id) return false;
  var meta = user.app_metadata && typeof user.app_metadata === "object" ? user.app_metadata : null;
  if (meta && meta.alumno_id != null && String(meta.alumno_id) !== "") return false;
  if (sesionLocal && typeof sesionLocal === "object" && sesionLocal.role === "alumno") return false;
  return true;
}
