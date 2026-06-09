# IronTrack

## Contexto del proyecto
IronTrack es una PWA React + Vite + Supabase para entrenadores y alumnos.

La app permite:
- Crear rutinas por semanas.
- Asignar rutinas a alumnos.
- Registrar sesiones de entrenamiento.
- Trackear progreso.
- Calcular y persistir PRs.
- Mostrar semana actual, progreso real y PRs correctamente.

## Estructura clave de datos
- Una rutina tiene semanas.
- Cada semana tiene días.
- Cada día tiene ejercicios.
- El progreso se registra por sesión.
- Cada registro de progreso debe conservar la semana correspondiente.
- Los PRs se calculan por ejercicio, se actualizan automáticamente y no deben resetearse.

## Reglas críticas
- Nunca romper la relación rutina → semana → día.
- Nunca guardar progreso sin semana.
- No desincronizar rutina y progreso.
- No sobrescribir PRs existentes.
- No cambiar estructura de datos sin actualizar toda la lógica relacionada.
- No modificar Supabase, RLS, rutinas, progreso, PRs, chat o notificaciones sin auditoría previa.

## Forma de trabajo
- Priorizar consistencia de datos.
- Priorizar fixes mínimos.
- Preferir cambios pequeños, mecánicos y seguros.
- No hacer refactors grandes salvo pedido explícito.
- Si el pedido dice “auditoría”, “analizar” o “no modificar”, no modificar archivos.
- Después de modificar código, ejecutar npm run build.
- Informar siempre:
  - archivos modificados
  - líneas aproximadas
  - qué cambió
  - resultado del build

## Comandos
- Instalar dependencias: npm install
- Build: npm run build

## Errores a evitar
- No guardar semana en progreso.
- Desincronizar rutina y progreso.
- Resetear o sobrescribir PRs.
- Cambiar estructura sin actualizar lógica.
- Romper vista alumno, sesión activa o cálculo de semana actual.
