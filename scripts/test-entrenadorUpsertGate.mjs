// lib/entrenadorUpsertGate.js: una cuenta de alumno no intenta registrarse en `entrenadores` (RLS v1). node scripts/test-entrenadorUpsertGate.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { debeRegistrarEntrenador as f } from "../lib/entrenadorUpsertGate.js";
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok -", name); };
t("entrenador (sin vinculo ni sesion local de alumno) si; sin usuario no", () => { assert.equal(f({ id: "u1" }, null), true); assert.equal(f({ id: "u1", app_metadata: {} }, { role: "entrenador" }), true); assert.equal(f(null, null), false); assert.equal(f({}, null), false); });
t("cuenta vinculada a un alumno o sesion local de alumno: no", () => { assert.equal(f({ id: "u", app_metadata: { alumno_id: "x" } }, null), false); assert.equal(f({ id: "u", app_metadata: { alumno_id: 7 } }, null), false); assert.equal(f({ id: "u" }, { role: "alumno" }), false); });
t("App.jsx usa la compuerta antes del upsert", () => { const a = readFileSync(new URL("../App.jsx", import.meta.url), "utf8"); const i = a.indexOf("function upsertEntrenador(user)"); assert.ok(i > 0); assert.ok(a.slice(i, i + 700).includes("debeRegistrarEntrenador(user, sesionLocalUp)")); });
console.log("\n" + n + " pruebas OK");
