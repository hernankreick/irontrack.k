// Biblioteca: buscador y boton "Ordenar" (vista angosta) con area tactil minima de 44 px.
//   node scripts/test-libraryTouch44.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(path.join(ROOT, "components/library/LibraryManagementToolbar.jsx"), "utf8");
const narrow = src.slice(src.indexOf("{libNarrow && ("), src.indexOf("Filter toggle button"));
assert.ok(narrow.length > 100, "no se encontro el bloque libNarrow");
assert.match(narrow, /type="search"[\s\S]*?minHeight: 44/, "buscador angosto sin minHeight 44");
assert.match(narrow, /<button[\s\S]*?minHeight: 44, minWidth: 44[\s\S]*?Ordenar/, "boton Ordenar angosto sin 44x44");
console.log("ok - libraryTouch44");
