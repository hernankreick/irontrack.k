// Reproduce localmente los builds del CI (.github/workflows/ci.yml) con variables FICTICIAS.  Uso:  npm run qa:builds
//   1) build normal (placeholder, sin host real)   2) Preview simulado   3) Production simulado con configuracion valida
//   4) Production SIN variables: DEBE fallar.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "irontrack-builds-"));
const base = { ...process.env, VITE_SUPABASE_URL: "https://example.invalid", VITE_SUPABASE_ANON_KEY: "ci-dummy-anon-key" };
const build = (name, env, outDir) => spawnSync("npx", ["vite", "build", "--outDir", path.join(tmp, outDir), "--emptyOutDir"], { cwd: ROOT, env, encoding: "utf8" });
const scan = (outDir, target) => spawnSync("node", ["scripts/check-bundle-target.mjs", path.join(tmp, outDir, "assets"), "--target", target], { cwd: ROOT, encoding: "utf8" });
const steps = [];
const record = (name, ok, detail = "") => { steps.push({ name, ok }); console.log((ok ? "OK   " : "FAIL ") + name + (detail ? "  " + detail : "")); };

let r = build("normal", base, "dist");
const assets = path.join(tmp, "dist", "assets");
const leaked = r.status === 0 && fs.readdirSync(assets).some((f) => /supabase\.co/.test(fs.readFileSync(path.join(assets, f), "utf8")));
record("build normal con variables ficticias (sin host real en el bundle)", r.status === 0 && !leaked);

r = build("preview", { ...base, VERCEL: "1", VERCEL_ENV: "preview" }, "preview");
let s = r.status === 0 ? scan("preview", "preview") : r;
record("Preview simulado + escaner de bundle", r.status === 0 && s.status === 0, (s.stdout || "").trim().split("\n").pop());

const prod = { ...base, VERCEL: "1", VERCEL_ENV: "production", VITE_SUPABASE_URL: "https://ci-simulado.example.com", VITE_SUPABASE_ANON_KEY: "ci-simulada-anon-key-0123456789" };
r = build("production", prod, "prod");
s = r.status === 0 ? scan("prod", "production") : r;
record("Production simulado (configuracion valida) + escaner", r.status === 0 && s.status === 0, (s.stdout || "").trim().split("\n").pop());

r = build("production-sin-config", { ...base, VERCEL: "1", VERCEL_ENV: "production", VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "" }, "neg");
record("Production sin variables debe FALLAR", r.status !== 0);

fs.rmSync(tmp, { recursive: true, force: true });
const bad = steps.filter((x) => !x.ok);
console.log("\nBuilds: " + (steps.length - bad.length) + "/" + steps.length + " correctos");
process.exit(bad.length ? 1 : 0);
