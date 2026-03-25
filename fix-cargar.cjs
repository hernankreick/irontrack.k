// fix-cargar.cjs — Agrega cargarSesionesGlobales
const fs = require("fs");
let c = fs.readFileSync("App.jsx", "utf8");

const marker = 'const es = lang==="es";';
const idx = c.indexOf(marker);
if (idx === -1) { console.log("ERROR: no encontre marker"); process.exit(1); }

// Verificar que no existe ya
if (c.includes("const cargarSesionesGlobales")) {
  console.log("YA EXISTE cargarSesionesGlobales - no hago nada");
  process.exit(0);
}

const fn = [
  "",
  "",
  "  const cargarSesionesGlobales = React.useCallback(async function(alumnosActuales) {",
  "    var lista = alumnosActuales || alumnos;",
  "    if(!lista || lista.length === 0) {",
  "      try {",
  "        var sbAlumnos = await sb.getAlumnos('entrenador_principal');",
  "        if(sbAlumnos && sbAlumnos.length > 0) { setAlumnos(sbAlumnos); lista = sbAlumnos; }",
  "        else return;",
  "      } catch(e) { return; }",
  "    }",
  "    try {",
  "      var ids = lista.map(function(a){return a.id}).filter(function(id){return id && typeof id === 'string'});",
  "      if(ids.length === 0) return;",
  "      var idsStr = ids.join(',');",
  "      var results = await Promise.all([",
  "        sbFetch('sesiones?alumno_id=in.(' + idsStr + ')&select=*&order=created_at.desc&limit=500'),",
  "        sbFetch('progreso?alumno_id=in.(' + idsStr + ')&select=alumno_id,ejercicio_id,kg,reps,fecha&order=created_at.desc&limit=3000'),",
  "      ]);",
  "      if(results[0] && Array.isArray(results[0])) setSesionesGlobales(results[0]);",
  "      if(results[1] && Array.isArray(results[1])) {",
  "        var idx2 = {};",
  "        results[1].forEach(function(reg) {",
  "          if(!idx2[reg.alumno_id]) idx2[reg.alumno_id] = [];",
  "          idx2[reg.alumno_id].push(reg);",
  "        });",
  "        setProgresoGlobal(idx2);",
  "      }",
  "    } catch(e) { console.error('[cargarSesionesGlobales]', e); }",
  "  }, [alumnos]);",
  "",
  "  useEffect(function() {",
  "    if(sessionData && sessionData.role==='entrenador') {",
  "      var init = async function() {",
  "        var sbAlumnos = await sb.getAlumnos('entrenador_principal') || [];",
  "        setAlumnos(sbAlumnos);",
  "        if(sbAlumnos.length > 0) cargarSesionesGlobales(sbAlumnos);",
  "      };",
  "      init();",
  "      var intervalo = setInterval(function() { cargarSesionesGlobales(); }, 30000);",
  "      return function() { clearInterval(intervalo); };",
  "    }",
  "  }, [sessionData]);",
  "",
  "  "
].join("\n");

c = c.replace(marker, fn + marker);

fs.writeFileSync("App.jsx", c, "utf8");

// Verificar
var v = fs.readFileSync("App.jsx", "utf8");
var has = v.includes("const cargarSesionesGlobales");
var vlines = v.split(/\r?\n/).length;
console.log("LISTO - cargarSesionesGlobales agregado");
console.log("Verificacion:", has ? "OK" : "FALLO");
console.log("Lineas:", vlines);
