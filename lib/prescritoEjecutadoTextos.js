// Textos (es / en / pt) y formato de "Prescrito vs. ejecutado". Puro. Todo estado sin datos se explica con palabras: nada se resume en un numero engañoso.
import { irontrackMsg as M } from "./irontrackMsg.js";

var ESTADOS = {
  verificable: ["Comparada", "Compared", "Comparada"],
  sin_copia: ["Sin copia de lo prescrito", "No prescription copy", "Sem cópia do prescrito"],
  ambigua: ["Prescripción ambigua", "Ambiguous prescription", "Prescrição ambígua"],
  copia_cache: ["Copia sin confirmar", "Unconfirmed copy", "Cópia não confirmada"],
  sin_finalizar: ["Sin cierre confirmado", "Finish not confirmed", "Sem encerramento confirmado"],
  validacion_manual_sin_series: ["Validada por el entrenador", "Validated by the coach", "Validada pelo treinador"],
  semana_inconsistente: ["Semana inconsistente", "Inconsistent week", "Semana inconsistente"],
  series_sin_vinculo: ["Series sin vincular", "Unlinked sets", "Séries sem vínculo"],
};
var EXPLICACIONES = {
  verificable: ["Hay copia de lo prescrito, la sesión está cerrada y las series están vinculadas.", "There is a copy of what was prescribed, the session is closed and the sets are linked.", "Há cópia do prescrito, a sessão está encerrada e as séries estão vinculadas."],
  sin_copia: ["No se guardó qué se había prescrito (es anterior a esta función o se entrenó sin conexión al iniciar). No se compara con la rutina actual porque pudo cambiar.", "What was prescribed was not saved (it predates this feature or the workout started offline). It is not compared with the current routine because it may have changed.", "O prescrito não foi guardado (é anterior a esta função ou começou offline). Não se compara com a rotina atual porque pode ter mudado."],
  ambigua: ["Hay más de una versión de lo prescrito para esta sesión; no se elige ninguna.", "There is more than one version of what was prescribed for this session; none is chosen.", "Há mais de uma versão do prescrito para esta sessão; nenhuma é escolhida."],
  copia_cache: ["La copia de lo prescrito no está confirmada como guardada en el servidor.", "The prescription copy is not confirmed as saved on the server.", "A cópia do prescrito não está confirmada no servidor."],
  sin_finalizar: ["No hay constancia de que esta sesión se haya cerrado; no se puede comparar.", "There is no record that this session was finished; it cannot be compared.", "Não há registro de que esta sessão foi encerrada; não pode ser comparada."],
  validacion_manual_sin_series: ["El entrenador la validó a mano: no hay series registradas para comparar.", "The coach validated it by hand: there are no logged sets to compare.", "O treinador validou manualmente: não há séries registradas."],
  semana_inconsistente: ["La semana de la sesión, de la copia o de las series no coincide.", "The week of the session, the copy or the sets does not match.", "A semana da sessão, da cópia ou das séries não coincide."],
  series_sin_vinculo: ["Hay series de esa fecha que no se pueden asociar con certeza a esta sesión (sesiones anteriores a la identidad).", "There are sets from that date that cannot be linked with certainty to this session (sessions before identity).", "Há séries dessa data que não podem ser associadas com certeza a esta sessão."],
};
var RESULTADOS = {
  cumple: ["Cumplió", "Met", "Cumpriu", "✓"],
  por_encima: ["Por encima", "Above", "Acima", "▲"],
  por_debajo: ["Por debajo", "Below", "Abaixo", "▼"],
  mixto: ["Mixto", "Mixed", "Misto", "◐"],
  no_comparable: ["No comparable", "Not comparable", "Não comparável", "–"],
};
var MOTIVOS = {
  prescripcion_vacia: ["no había valor prescrito", "no value was prescribed", "não havia valor prescrito"],
  prescripcion_no_numerica: ["la prescripción no es un número", "the prescription is not a number", "a prescrição não é um número"],
  prescripcion_texto: ["la prescripción es un texto libre", "the prescription is free text", "a prescrição é texto livre"],
  sin_series_ejecutadas: ["no hay series registradas", "no sets logged", "sem séries registradas"],
  valor_ejecutado_invalido: ["un valor registrado no es válido", "a logged value is not valid", "um valor registrado não é válido"],
  unidad_de_series_no_garantizada: ["no se guarda si fueron segundos o repeticiones", "it is not stored whether it was seconds or reps", "não se guarda se eram segundos ou repetições"],
  distancia_sin_unidad_registrada: ["la distancia no tiene unidad registrada", "distance has no recorded unit", "a distância não tem unidade registrada"],
  kg_ejecutado_vacio_o_cero: ["la carga registrada es 0 o está vacía", "the logged load is 0 or empty", "a carga registrada é 0 ou vazia"],
  peso_corporal_con_carga_ejecutada: ["se registró carga en un ejercicio de peso corporal", "load was logged on a bodyweight exercise", "carga registrada em exercício de peso corporal"],
  faltantes_sin_evidencia_de_registro_completo: ["faltan series pero no se puede asegurar que no se hicieron (puede haber registros sin sincronizar)", "sets are missing but we cannot be sure they were not done (some logs may be unsynced)", "faltam séries mas não é possível garantir que não foram feitas (pode haver registros sem sincronizar)"],
};
var PORCENTAJE = {
  sin_sesiones_verificables: ["ninguna sesión se pudo comparar", "no session could be compared", "nenhuma sessão pôde ser comparada"],
  variable_no_comparable_en_algun_ejercicio: ["algún ejercicio no es comparable en esta variable", "some exercise is not comparable on this variable", "algum exercício não é comparável nesta variável"],
  sin_sesiones: ["no hay sesiones", "no sessions", "sem sessões"],
};

function pick(tabla, k, lang, i) { var t = tabla[k]; return t ? M(lang, t[0], t[1], t[2]) : String(k); }
export function etiquetaEstado(estado, lang) { return pick(ESTADOS, estado, lang); }
export function explicacionEstado(estado, lang) { return pick(EXPLICACIONES, estado, lang); }
export function textoMotivo(motivo, lang) { return pick(MOTIVOS, motivo, lang); }
export function textoResultado(resultado, lang) { var t = RESULTADOS[resultado] || RESULTADOS.no_comparable; return { texto: M(lang, t[0], t[1], t[2]), icono: t[3], clave: RESULTADOS[resultado] ? resultado : "no_comparable" }; }
export function tituloSemana(w, lang) { return M(lang, "Ciclo ", "Cycle ", "Ciclo ") + w.ciclo + " · " + M(lang, "Semana ", "Week ", "Semana ") + (w.semana == null ? "?" : w.semana); }
export function estadoResumen(estado, lang) {
  return { completo: M(lang, "Todas las sesiones comparadas", "All sessions compared", "Todas as sessões comparadas"), parcial: M(lang, "Comparación parcial", "Partial comparison", "Comparação parcial"),
    sin_datos_para_comparar: M(lang, "Sin datos para comparar", "No data to compare", "Sem dados para comparar"), sin_sesiones: M(lang, "Sin sesiones", "No sessions", "Sem sessões") }[estado] || String(estado);
}
/** { texto, nota }: "75 %" si es calculable; "—" con la razon si no (nunca un numero inventado). */
export function textoPorcentaje(p, lang) {
  if (p && p.valor != null) return { texto: p.valor + " %", nota: null };
  return { texto: "—", nota: p && p.motivo ? pick(PORCENTAJE, p.motivo, lang) : null };
}
/** Texto de una variable de un ejercicio: prescrito vs. ejecutado en una linea, y su resultado. */
export function textoVariable(nombre, v, lang) {
  var res = textoResultado(v && v.resultado, lang);
  var presc = v && v.prescrito && v.prescrito.texto !== undefined && String(v.prescrito.texto).trim() !== "" ? String(v.prescrito.texto) : "—";
  var ej = v && v.ejecutado;
  var hecho = "—";
  if (ej) {
    if (nombre === "series") hecho = String(ej.cantidad);
    else if (Array.isArray(ej.valores)) hecho = ej.valores.join(", ") + (ej.unidad === "kg" ? " kg" : "");
  }
  return { prescrito: presc, ejecutado: hecho, resultado: res, motivo: v && v.estado !== "comparable" && v.motivo ? textoMotivo(v.motivo, lang) : null };
}
export function nombreVariable(nombre, lang) { return { series: M(lang, "Series", "Sets", "Séries"), reps: M(lang, "Repeticiones", "Reps", "Repetições"), kg: M(lang, "Carga", "Load", "Carga") }[nombre] || nombre; }
export function estadoEjercicio(e, lang) {
  var s = e && e.variables && e.variables.series;
  if (s && s.estado === "comparable") {
    if (s.resultado === "por_debajo") return s.ejecutado.cantidad === 0 ? M(lang, "Omitido", "Skipped", "Omitido") : M(lang, "Parcial", "Partial", "Parcial");
    return M(lang, "Completo", "Completed", "Completo");
  }
  if (s && s.motivo === "faltantes_sin_evidencia_de_registro_completo") return M(lang, "Sin evidencia de si se hizo", "Unknown whether done", "Sem evidência se foi feito");
  return M(lang, "No comparable", "Not comparable", "Não comparável");
}
