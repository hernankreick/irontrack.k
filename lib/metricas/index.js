// Nucleo UNICO de metricas de Progreso y Estadisticas del entrenador (E1). Funciones puras, sin React ni Supabase.
// Cada metrica tiene una sola definicion (ver el encabezado de cada modulo); las pantallas se conectan en E2.
//   volumen.js     volumen kg x reps (sin ejercicios por tiempo; incluye custom) y comparacion like-for-like entre periodos
//   pr.js          records de carga sobre el historial completo; eventos PR (primer registro no cuenta; uno por ejercicio y dia);
//                  historialPorDia clasifica cada dia de un ejercicio (primera marca / PR / iguala) con la misma definicion
//   adherencia.js  adherencia a la rutina asignada (sin duplicar el mismo dia; validadas por el entrenador aparte)
//   racha.js       racha de semanas de calendario consecutivas con sesiones completadas
//   tipoCarga.js   que ejercicios son por tiempo (unica clasificacion)
//   fechas.js      numeros de dia de calendario y semanas lunes-domingo

export * from "./fechas.js";
export * from "./tipoCarga.js";
export * from "./volumen.js";
export * from "./pr.js";
export * from "./adherencia.js";
export * from "./racha.js";
