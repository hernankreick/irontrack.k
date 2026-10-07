// Parser compartido de progreso.fecha. Contrato de escritura: new Date().toLocaleDateString("es-AR") => d/m/yyyy.
// Nunca usa Date.parse / new Date(string) sobre strings d/m/yyyy (new Date("5/10/2026") es 10 de mayo).

/** Numero de dia (dias desde 1970-01-01, calendario UTC). */
export function dayNum(y, m, d) {
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

/**
 * Parser estricto de progreso.fecha: SOLO d/m/yyyy. Devuelve el numero de dia o null.
 * Nunca usa Date.parse / new Date(string) y jamas convierte una fecha invalida en "ahora".
 */
export function parseFechaDMY(value) {
  if (typeof value !== "string") return null;
  var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!m) return null;
  var d = Number(m[1]);
  var mo = Number(m[2]);
  var y = Number(m[3]);
  if (y < 2000 || y > 2100) return null;
  var dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dayNum(y, mo, d);
}

/** Igual que parseFechaDMY pero devuelve un Date a medianoche LOCAL (o null). */
export function parseFechaDMYToLocalDate(value) {
  var day = parseFechaDMY(value);
  if (day == null) return null;
  var u = new Date(day * 86400000);
  return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate());
}
