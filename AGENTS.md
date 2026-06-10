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
- Cada semana tiene dias.
- Cada dia tiene ejercicios.
- El progreso se registra por sesion.
- Cada registro de progreso debe conservar la semana correspondiente.
- Los PRs se calculan por ejercicio, se actualizan automaticamente y no deben resetearse.

## Reglas criticas
- Nunca romper la relacion rutina -> semana -> dia.
- Nunca guardar progreso sin semana.
- No desincronizar rutina y progreso.
- No sobrescribir PRs existentes.
- No cambiar estructura de datos sin actualizar toda la logica relacionada.
- No modificar Supabase, RLS, rutinas, progreso, PRs, chat o notificaciones sin auditoria previa.

## Forma de trabajo
- Priorizar consistencia de datos.
- Priorizar fixes minimos.
- Preferir cambios pequenos, mecanicos y seguros.
- No hacer refactors grandes salvo pedido explicito.
- Si el pedido dice "auditoria", "analizar" o "no modificar", no modificar archivos.
- Despues de modificar codigo, ejecutar npm run build.
- Informar siempre:
  - archivos modificados
  - lineas aproximadas
  - que cambio
  - resultado del build

## Comandos
- Instalar dependencias: npm install
- Build: npm run build

## Errores a evitar
- No guardar semana en progreso.
- Desincronizar rutina y progreso.
- Resetear o sobrescribir PRs.
- Cambiar estructura sin actualizar logica.
- Romper vista alumno, sesion activa o calculo de semana actual.