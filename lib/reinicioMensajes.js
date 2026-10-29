// Textos de los reinicios (rutina / semana) y de sus conflictos. Puro: recibe la funcion de traduccion M(lang, es, en, pt).
// Un reinicio NUNCA borra historial: los textos lo dicen explicitamente.

/** Mensaje para un resultado fallido de reiniciarRutinaCiclo ({ ok:false, reason }). */
export function textoErrorReinicio(res, M, lang) {
  var reason = res && res.reason;
  if (reason === "migracion_pendiente") {
    return M(
      lang,
      "Falta aplicar la actualización de la base de datos para reiniciar sin borrar historial. No se modificó nada. Avisá al administrador.",
      "The database update needed to restart without deleting history is not applied yet. Nothing was changed. Contact the administrator.",
      "Falta aplicar a atualização do banco de dados para reiniciar sem apagar o histórico. Nada foi alterado. Avise o administrador."
    );
  }
  if (reason === "conflicto_ciclo") {
    return M(
      lang,
      "La rutina ya fue reiniciada o cambió desde otro dispositivo. Actualizamos los datos: revisá antes de volver a intentar.",
      "The routine was already restarted or changed from another device. We refreshed the data: check it before trying again.",
      "A rotina já foi reiniciada ou mudou em outro dispositivo. Atualizamos os dados: confira antes de tentar novamente."
    );
  }
  if (reason === "sin_filas") {
    return M(lang, "No tenés permiso para reiniciar esta rutina.", "You do not have permission to restart this routine.", "Você não tem permissão para reiniciar esta rotina.");
  }
  if (reason === "no_asignada" || reason === "alumno_distinto" || reason === "rutina_inexistente") {
    return M(lang, "La rutina ya no está asignada a este alumno.", "The routine is no longer assigned to this athlete.", "A rotina não está mais atribuída a este aluno.");
  }
  return M(lang, "No se pudo reiniciar. No se modificó nada; probá de nuevo.", "Could not restart. Nothing was changed; please try again.", "Não foi possível reiniciar. Nada foi alterado; tente novamente.");
}

/** Aviso (sin borrar nada) cuando hay series registradas sin entrenamiento finalizado. null si no hay. */
export function textoSeriesSinFinalizar(resumen, M, lang) {
  if (!resumen || !(resumen.series > 0)) return null;
  var fechas = (resumen.fechas || []).slice(0, 3).join(", ");
  return M(
    lang,
    "Atención: hay " + resumen.series + " series registradas sin entrenamiento finalizado (" + fechas + "). No se borran: quedan en el historial, pero después del reinicio ya no se podrán validar como sesión.",
    "Note: there are " + resumen.series + " logged sets without a finished workout (" + fechas + "). They are not deleted: they stay in the history, but after the restart they can no longer be validated as a session.",
    "Atenção: há " + resumen.series + " séries registradas sem treino finalizado (" + fechas + "). Não são apagadas: ficam no histórico, mas após o reinício não poderão ser validadas como sessão."
  );
}

/** Aviso al alumno cuando su sesion abierta termino despues de un reinicio del entrenador. */
export function textoSesionTrasReinicio(tipo, semana, M, lang) {
  var que = tipo === "semana" ? M(lang, "tu semana", "your week", "sua semana") : M(lang, "tu rutina", "your routine", "sua rotina");
  var w = Number(semana) >= 1 ? Number(semana) : 1;
  return M(
    lang,
    "Entrenamiento guardado ✓. Tu entrenador reinició " + que + " mientras entrenabas: este entrenamiento quedó en tu historial, pero no cuenta para la nueva planificación. Continuás en la Semana " + w + ", Día 1.",
    "Workout saved ✓. Your coach restarted " + que + " while you were training: this workout stays in your history but does not count toward the new plan. You continue at Week " + w + ", Day 1.",
    "Treino salvo ✓. Seu treinador reiniciou " + que + " enquanto você treinava: este treino ficou no seu histórico, mas não conta para o novo planejamento. Você continua na Semana " + w + ", Dia 1."
  );
}

/** Aviso al alumno cuando detecta (al volver a la app o al iniciar) que el entrenador reinicio su plan. */
export function textoPlanReiniciado(tipo, semana, M, lang) {
  var w = Number(semana) >= 1 ? Number(semana) : 1;
  if (tipo === "semana") {
    return M(
      lang,
      "Tu entrenador reinició la Semana " + w + ": empezás de nuevo en el Día 1. Tus entrenamientos anteriores siguen en tu historial.",
      "Your coach restarted Week " + w + ": you start again at Day 1. Your previous workouts stay in your history.",
      "Seu treinador reiniciou a Semana " + w + ": você recomeça no Dia 1. Seus treinos anteriores continuam no histórico."
    );
  }
  return M(
    lang,
    "Tu entrenador reinició tu rutina: Semana 1, Día 1. Tus entrenamientos anteriores siguen en tu historial.",
    "Your coach restarted your routine: Week 1, Day 1. Your previous workouts stay in your history.",
    "Seu treinador reiniciou sua rotina: Semana 1, Dia 1. Seus treinos anteriores continuam no histórico."
  );
}
