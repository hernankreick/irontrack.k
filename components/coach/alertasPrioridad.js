// D6.2 — Orden y limite visible de la campana del entrenador (CoachNotificationCenter).
//
// Antes: buildCoachAlerts cortaba en 12 ANTES de la campana (con varios entrenamientos completados se perdian alertas de seguimiento y
// el contador no las contaba) y la campana reordenaba solo por fecha (los «Entrenamiento completo» quedaban arriba de un «Sin rutina»).
// Ahora el conjunto llega completo y aca se ordena con criterios que YA existian, sin puntuaciones nuevas:
//   1. no leidas antes que leidas (lo pendiente nunca queda escondido detras de lo ya visto);
//   2. las que piden una accion del entrenador (mensaje, seguimiento, adherencia) antes que los logros (category "logro");
//   3. la severidad existente de buildCoachAlerts (0 mensajes / sin rutina, 1 inactivo / terminada / entrenamientos, 2 a 1 sesion / baja);
//   4. la mas reciente primero (atMs); sin fecha, el orden original.
// Se muestran las primeras LIMITE_VISIBLE y el resto queda accesible con «Ver N más». El contador y «Marcar leídas» usan el conjunto
// completo. Modulo puro: sin React ni Supabase.

export var LIMITE_VISIBLE = 12;

/** La notificacion pide una accion del entrenador (no es un logro). Es tambien el criterio del filtro «Importantes». */
export function requiereSeguimiento(item) {
  return !!item && item.category !== "logro";
}

/** Una sola notificacion por id (la primera). */
export function sinDuplicados(items) {
  var seen = {};
  return (Array.isArray(items) ? items : []).filter(function (x) {
    if (!x || x.id == null || seen[x.id]) return false;
    seen[x.id] = true;
    return true;
  });
}

function sev(x) {
  return typeof x.severity === "number" ? x.severity : 9;
}

/** Orden de la campana (ver encabezado). `readIds`: ids leidos con los que se ordena. No modifica `items`. */
export function ordenarNotificaciones(items, readIds) {
  var leido = {};
  (readIds || []).forEach(function (id) {
    leido[String(id)] = true;
  });
  return sinDuplicados(items)
    .map(function (x, i) {
      return { x: x, i: i };
    })
    .sort(function (A, B) {
      var a = A.x;
      var b = B.x;
      var la = leido[a.id] ? 1 : 0;
      var lb = leido[b.id] ? 1 : 0;
      if (la !== lb) return la - lb;
      var ra = requiereSeguimiento(a) ? 0 : 1;
      var rb = requiereSeguimiento(b) ? 0 : 1;
      if (ra !== rb) return ra - rb;
      if (sev(a) !== sev(b)) return sev(a) - sev(b);
      if (a.atMs != null && b.atMs != null && a.atMs !== b.atMs) return b.atMs - a.atMs;
      if (a.atMs != null && b.atMs == null) return -1;
      if (a.atMs == null && b.atMs != null) return 1;
      return A.i - B.i;
    })
    .map(function (o) {
      return o.x;
    });
}

/** Cuantas no leidas hay en el conjunto completo (el numero de la campana). */
export function contarNoLeidas(items, readIds) {
  var leido = {};
  (readIds || []).forEach(function (id) {
    leido[String(id)] = true;
  });
  return sinDuplicados(items).filter(function (x) {
    return !leido[x.id];
  }).length;
}
