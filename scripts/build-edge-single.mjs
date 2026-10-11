// Genera supabase/functions/update-alumno-password/index.single.ts: la MISMA funcion en UN solo archivo, para pegarla en el editor
// web de Supabase (Edge Functions) desde un iPhone, donde no hay CLI ni se puede subir core.js junto a index.ts.
//   node scripts/build-edge-single.mjs          escribe el archivo
//   node scripts/build-edge-single.mjs --check  falla si el archivo generado no coincide con core.js + index.ts
// Nunca se edita a mano: la logica sigue viviendo en core.js (probada en scripts/test-updateAlumnoPassword.mjs).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "functions", "update-alumno-password");
const OUT = join(dir, "index.single.ts");

export function buildSingle(coreSrc, indexSrc) {
  const importCreate = indexSrc.split("\n").find((l) => /^import \{ createClient \} from 'https:\/\/esm\.sh\//.test(l));
  if (!importCreate) throw new Error("index.ts: no se encontro el import de createClient");
  const importCore = "import { handleUpdateAlumnoPassword } from './core.js'";
  if (!indexSrc.includes(importCore)) throw new Error("index.ts: no se encontro el import de ./core.js");
  const rest = indexSrc.replace(importCreate + "\n", "").replace(importCore + "\n", "").replace(/^\n+/, "");
  if ((coreSrc.match(/^export /gm) || []).length !== 1) throw new Error("core.js: se esperaba exactamente un `export`");
  const core = coreSrc.replace(/^export (async function handleUpdateAlumnoPassword)/m, "$1");
  return [
    "// GENERADO por scripts/build-edge-single.mjs a partir de core.js + index.ts. NO EDITAR A MANO.",
    "// Version de UN solo archivo de la Edge Function `update-alumno-password`, para el editor web de Supabase.",
    "// @ts-nocheck  (core.js es JavaScript sin anotaciones de tipos; se prueba en scripts/test-updateAlumnoPassword.mjs)",
    importCreate,
    "",
    "// ───────── core.js (logica pura) ─────────",
    core.trimEnd(),
    "",
    "// ───────── index.ts (servidor) ─────────",
    rest.trimEnd(),
    "",
  ].join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = buildSingle(readFileSync(join(dir, "core.js"), "utf8"), readFileSync(join(dir, "index.ts"), "utf8"));
  if (process.argv.includes("--check")) {
    const cur = readFileSync(OUT, "utf8");
    if (cur !== out) { console.error("index.single.ts NO coincide con core.js + index.ts: ejecutar node scripts/build-edge-single.mjs"); process.exit(1); }
    console.log("index.single.ts esta al dia");
  } else { writeFileSync(OUT, out); console.log("escrito", OUT, out.split("\n").length - 1, "lineas"); }
}
