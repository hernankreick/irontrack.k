// ═══════════════════════════════════════════════════════════════
// MOTOR DE SUGERENCIAS POR EJERCICIO
// ═══════════════════════════════════════════════════════════════
export function generarSugerenciasAlumno(registros, rutinaDatos, EX) {
  if(!registros || registros.length === 0 || !rutinaDatos) return [];
  const dias = rutinaDatos.days || [];
  const sugerencias = [];

  // Agrupar registros por ejercicio, ordenados por fecha desc
  const porEj = {};
  registros.forEach(function(r) {
    var exId = r.ejercicio_id;
    if(!porEj[exId]) porEj[exId] = [];
    porEj[exId].push({ kg: parseFloat(r.kg)||0, reps: parseInt(r.reps)||0, fecha: r.fecha, rpe: parseFloat(r.rpe)||0 });
  });

  // Para cada ejercicio de la rutina (warmup + principales)
  dias.forEach(function(dia, dIdx) {
    // Warmup (solo si tienen registros con peso)
    (dia.warmup||[]).forEach(function(ex, eIdx) {
      var exId = ex.id;
      var regs = porEj[exId];
      if(!regs || regs.length < 2) return;
      // Solo generar sugerencias para warmup con peso
      if(!regs.some(function(r){return r.kg > 0})) return;

      procesarEjercicio(exId, ex, regs, "warmup", dIdx, eIdx);
    });
    // Bloque principal
    (dia.exercises||[]).forEach(function(ex, eIdx) {
      var exId = ex.id;
      var regs = porEj[exId];
      if(!regs || regs.length < 2) return;

      procesarEjercicio(exId, ex, regs, "exercises", dIdx, eIdx);
    });
  });

  function procesarEjercicio(exId, ex, regs, bloque, dIdx, eIdx) {

      var exInfo = EX.find(function(e){ return e.id === exId; });
      var nombre = exInfo ? exInfo.name : exId;

      // Parsear rango de reps objetivo
      var repsStr = String(ex.reps||"8-10");
      var repParts = repsStr.split("-");
      var repMin = parseInt(repParts[0]) || 8;
      var repMax = parseInt(repParts[1] || repParts[0]) || repMin;

      // Ordenar por fecha (más reciente primero)
      var sorted = regs.slice().sort(function(a, b) {
        return new Date(b.fecha.split('/').reverse().join('-')) - new Date(a.fecha.split('/').reverse().join('-'));
      });

      var ultimo = sorted[0];
      var penultimo = sorted[1];
      var antepenultimo = sorted[2];

      // RPE (si no hay, estimar desde rendimiento)
      var rpeUlt = ultimo.rpe || 0;
      var rpePen = penultimo ? (penultimo.rpe || 0) : 0;

      // ── Clasificación interna (NO visible) ──
      var estado = "optimo";

      // FATIGA: cayeron reps o subió RPE con misma carga
      if(penultimo) {
        var mismaCarga = Math.abs(ultimo.kg - penultimo.kg) < 0.5;
        var cayeronReps = ultimo.reps < penultimo.reps - 1;
        var subioRPE = rpeUlt > 0 && rpePen > 0 && rpeUlt > rpePen + 0.5;
        if(mismaCarga && (cayeronReps || (subioRPE && cayeronReps))) {
          estado = "fatiga";
        }
      }

      // MUY EXIGIDO: RPE >= 9 en últimas 2
      if(rpeUlt >= 9 && rpePen >= 9) {
        estado = "muy_exigido";
      }

      // MUY FÁCIL: tope de rango + buen rendimiento en 2 sesiones
      if(ultimo.reps >= repMax && penultimo && penultimo.reps >= repMax) {
        if(rpeUlt <= 7.5 || rpeUlt === 0) {
          estado = "muy_facil";
        }
      }

      // ESTANCADO: 3 sesiones iguales
      if(antepenultimo) {
        var todosIgual = Math.abs(ultimo.kg - penultimo.kg) < 0.5 &&
                         Math.abs(ultimo.kg - antepenultimo.kg) < 0.5 &&
                         Math.abs(ultimo.reps - penultimo.reps) <= 1 &&
                         Math.abs(ultimo.reps - antepenultimo.reps) <= 1;
        if(todosIgual && estado === "optimo") {
          estado = "estancado";
        }
      }

      // ── Generar sugerencia (VISIBLE) ──
      var sugerencia = null;
      var equipo = exInfo ? exInfo.equip : "";
      var incBase = (equipo === "Barra" || equipo === "barra") ? 2.5 :
                    (equipo === "Mancuerna" || equipo === "mancuerna" || equipo === "Mancuernas" || equipo === "mancuernas") ? 1 : 2.5;

      if(estado === "muy_facil") {
        sugerencia = {
          exId: exId, nombre: nombre, estado: estado,
          accion: "Subir a " + (ultimo.kg + incBase) + "kg (+" + incBase + "kg)",
          ajuste: "Arrancar en " + repMin + " reps",
          tipo: "subir", prioridad: 1,
          sugKg: String(ultimo.kg + incBase), sugReps: String(repMin), sugSets: ex.sets||"3", sugPause: ex.pause||""
        };
      } else if(estado === "fatiga") {
        var reduccion = Math.round(ultimo.kg * 0.05 / incBase) * incBase;
        if(reduccion < incBase) reduccion = incBase;
        sugerencia = {
          exId: exId, nombre: nombre, estado: estado,
          accion: "Bajar a " + (ultimo.kg - reduccion) + "kg esta sesión",
          ajuste: "Mantener " + repMax + " reps y evaluar recuperación",
          tipo: "bajar", prioridad: 0,
          sugKg: String(ultimo.kg - reduccion), sugReps: String(repMax), sugSets: ex.sets||"3", sugPause: ex.pause||""
        };
      } else if(estado === "muy_exigido") {
        sugerencia = {
          exId: exId, nombre: nombre, estado: estado,
          accion: "Mantener carga, agregar 30s de descanso",
          ajuste: "Si no mejora en 2 sesiones, quitar 1 serie",
          tipo: "ajustar", prioridad: 1,
          sugKg: String(ultimo.kg), sugReps: ex.reps||"", sugSets: ex.sets||"3", sugPause: String(parseInt(ex.pause||90)+30)
        };
      } else if(estado === "estancado") {
        sugerencia = {
          exId: exId, nombre: nombre, estado: estado,
          accion: "Cambiar esquema: probar " + (parseInt(ex.sets||3)+1) + "×" + (repMin-2 > 0 ? repMin-2 : repMin) + " con " + (ultimo.kg+incBase) + "kg",
          ajuste: "Nuevo estímulo para romper meseta",
          tipo: "cambiar", prioridad: 2,
          sugKg: String(ultimo.kg+incBase), sugReps: String(repMin-2>0?repMin-2:repMin), sugSets: String(parseInt(ex.sets||3)+1), sugPause: ex.pause||""
        };
      } else if(estado === "optimo") {
        if(ultimo.reps < repMax) {
          sugerencia = {
            exId: exId, nombre: nombre, estado: estado,
            accion: "Mantener " + ultimo.kg + "kg",
            ajuste: "Buscar " + (ultimo.reps+1) + " reps para subir carga",
            tipo: "mantener", prioridad: 3,
            sugKg: String(ultimo.kg), sugReps: String(ultimo.reps+1), sugSets: ex.sets||"3", sugPause: ex.pause||""
          };
        }
      }

      if(sugerencia) {
        sugerencia.bloque = bloque;
        sugerencia.dIdx = dIdx;
        sugerencia.eIdx = eIdx;
        sugerencia.exData = ex;
        sugerencias.push(sugerencia);
      }
  }

  // Ordenar por prioridad (fatiga primero, luego subir, etc.)
  sugerencias.sort(function(a, b) { return a.prioridad - b.prioridad; });
  return sugerencias;
}
