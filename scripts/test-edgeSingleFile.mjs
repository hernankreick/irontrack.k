// La version de UN solo archivo (index.single.ts) debe ser exactamente core.js + index.ts, sin imports locales.   node scripts/test-edgeSingleFile.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSingle } from "./build-edge-single.mjs";

const dir = new URL("../supabase/functions/update-alumno-password/", import.meta.url);
const core = readFileSync(new URL("core.js", dir), "utf8"), index = readFileSync(new URL("index.ts", dir), "utf8");
const single = readFileSync(new URL("index.single.ts", dir), "utf8");
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok -", name); };

t("index.single.ts coincide con lo generado desde core.js + index.ts (no esta desactualizado)", () => assert.equal(single, buildSingle(core, index)));
t("sin imports locales ni exports (editor web: un solo archivo)", () => {
  assert.ok(!/from\s+['"]\.{1,2}\//.test(single), "import relativo");
  assert.ok(!/^export\s/m.test(single), "export");
});
t("unico import externo: supabase-js desde esm.sh (mismo que index.ts)", () => {
  const imps = single.match(/^import .*$/gm) || [];
  assert.equal(imps.length, 1);
  assert.ok(index.includes(imps[0]));
});
t("contiene la logica de core.js literal (cada linea de core.js sin el export)", () => {
  const coreNorm = core.replace(/^export (async function)/m, "$1").trimEnd();
  assert.ok(single.includes(coreNorm));
});
t("contiene el servidor de index.ts literal (desde corsHeaders)", () => {
  const from = index.indexOf("const corsHeaders"); assert.ok(from > 0);
  assert.ok(single.includes(index.slice(from).trimEnd()));
});
t("no hay secretos embebidos", () => assert.ok(!/eyJ[A-Za-z0-9_-]{20,}|sb_secret_|service_role\s*[:=]\s*['"][^'"]{10,}/.test(single)));
console.log(`${n} comprobaciones OK`);
