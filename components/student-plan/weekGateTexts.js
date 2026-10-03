// Textos compartidos del estado "SEMANA COMPLETADA" (banner del plan, drawer de bienvenida y lista de dias).
// Una sola fuente para que no puedan divergir. `msg(es, en, pt)` es el traductor de la app.
export function getWeekGateTexts(gate, msg) {
  const total = gate && gate.totalDays ? gate.totalDays : 0;
  const next = gate && gate.nextWeekNumber ? gate.nextWeekNumber : 0;
  return {
    badge: msg("SEMANA COMPLETADA ✓", "WEEK COMPLETED ✓", "SEMANA CONCLUÍDA ✓"),
    daysLine: total + " " + msg("DE", "OF", "DE") + " " + total + " " + msg("DÍAS", "DAYS", "DIAS"),
    body: msg("Completaste todos tus entrenamientos de esta semana.", "You finished all your workouts this week.", "Você concluiu todos os treinos desta semana."),
    nextLine: msg("Próximo", "Next", "Próximo") + ": " + msg("Semana", "Week", "Semana") + " " + next + " · " + msg("Día", "Day", "Dia") + " 1",
    available: msg("Disponible el lunes", "Available on Monday", "Disponível na segunda-feira"),
    viewRoutine: msg("VER RUTINA", "VIEW ROUTINE", "VER ROTINA"),
  };
}
