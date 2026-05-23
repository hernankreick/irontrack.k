export function buildCoachWelcomeSteps({ msg, routinesReady, alumnosReady, actions }) {
  return [
    {
      icon: "👋",
      title: "IRON TRACK",
      subtitle: msg("Configurá tu cuenta en 3 pasos", "Set up your account in 3 steps"),
      body: null,
      items: [
        { n: 1, text: msg("Creá tu primera rutina", "Create your first routine"), done: routinesReady },
        { n: 2, text: msg("Agregá un alumno", "Add an athlete"), done: alumnosReady },
        { n: 3, text: msg("Asignale la rutina", "Assign the routine"), done: false },
      ],
      cta: msg("EMPEZAR →", "GET STARTED →"),
      action: actions.start,
    },
    {
      icon: "📋",
      title: msg("Paso 1 — Rutina", "Step 1 — Routine"),
      subtitle: msg("Creá tu primera rutina", "Create your first routine"),
      body: msg("Organizá los días, ejercicios y series. La podés editar cuando quieras.", "Organize days, exercises and sets. You can edit it anytime."),
      cta: routinesReady ? msg("Rutina lista ✓ → Siguiente", "Routine ready ✓ → Next") : msg("CREAR RUTINA →", "CREATE ROUTINE →"),
      action: actions.routine,
      skip: actions.skipRoutine,
    },
    {
      icon: "👥",
      title: msg("Paso 2 — Alumno", "Step 2 — Athlete"),
      subtitle: msg("Agregá tu primer alumno", "Add your first athlete"),
      body: msg("Creá su acceso con email y contraseña. Desde ALUMNOS podés ver su historial.", "Create their access. From ATHLETES you can see their history."),
      cta: alumnosReady ? msg("Alumno listo ✓ → Siguiente", "Athlete ready ✓ → Next") : msg("AGREGAR ALUMNO →", "ADD ATHLETE →"),
      action: actions.alumno,
      skip: actions.skipAlumno,
    },
    {
      icon: "🚀",
      title: msg("¡Todo listo!", "All set!"),
      subtitle: msg("Ya podés usar IRON TRACK", "You're ready to use IRON TRACK"),
      body: msg("Desde el dashboard vas a ver la actividad de tus alumnos y quién necesita atención.", "From the dashboard see your athletes' activity and who needs attention."),
      cta: msg("ABRIR IRON TRACK 💪", "OPEN IRON TRACK 💪"),
      action: actions.finish,
    },
  ];
}
