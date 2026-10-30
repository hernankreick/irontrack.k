// Verifica por HTTP que la vista previa Open Graph funcione sin JS ni autenticacion:
//   - GET /og-image.png  -> 200, Content-Type image/png, firma PNG, 1200x630 (no el index.html del rewrite SPA)
//   - GET /              -> 200 y el HTML inicial ya trae og:image / og:title / twitter:card
// Uso:
//   node scripts/qa/og-image-http.mjs                         build local (variables ficticias) servido como vercel.json
//   node scripts/qa/og-image-http.mjs --url https://<deploy>  contra una Preview o Production ya desplegada
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const i = process.argv.indexOf("--url");
let base = i > 0 ? process.argv[i + 1].replace(/\/+$/, "") : null;
let server = null, tmp = null;

if (!base) {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "irontrack-og-"));
  const env = { ...process.env, VITE_SUPABASE_URL: "https://example.invalid", VITE_SUPABASE_ANON_KEY: "ci-dummy-anon-key" };
  const r = spawnSync("npx", ["vite", "build", "--outDir", tmp, "--emptyOutDir"], { cwd: ROOT, env, encoding: "utf8" });
  if (r.status !== 0) { console.error(r.stdout + r.stderr); process.exit(1); }
  // Igual que Vercel con vercel.json: primero el archivo estatico si existe, si no index.html (rewrite "/(.*)").
  const types = { ".png": "image/png", ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css" };
  server = http.createServer((req, res) => {
    const p = path.join(tmp, decodeURIComponent(new URL(req.url, "http://x").pathname));
    const file = p.startsWith(tmp) && fs.existsSync(p) && fs.statSync(p).isFile() ? p : path.join(tmp, "index.html");
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    res.end(fs.readFileSync(file));
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  base = "http://127.0.0.1:" + server.address().port;
}

const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log((ok ? "OK   " : "FAIL ") + name + (detail ? "  " + detail : "")); };

try {
  const img = await fetch(base + "/og-image.png?v=2", { redirect: "manual", headers: { "User-Agent": "WhatsApp/2.23 A" } });
  const buf = Buffer.from(await img.arrayBuffer());
  const ct = img.headers.get("content-type") || "";
  check("/og-image.png responde HTTP 200", img.status === 200, "status " + img.status);
  check("Content-Type image/png", /^image\/png\b/.test(ct), ct);
  check("cuerpo con firma PNG (no index.html)", buf.length > 8 && buf.readUInt32BE(0) === 0x89504e47 && !/<html/i.test(buf.toString("latin1", 0, 512)), buf.length + " B");
  check("dimensiones 1200x630", buf.length > 24 && buf.readUInt32BE(16) === 1200 && buf.readUInt32BE(20) === 630);

  const page = await fetch(base + "/", { redirect: "manual", headers: { "User-Agent": "facebookexternalhit/1.1" } });
  const html = await page.text();
  check("/ responde HTTP 200", page.status === 200, "status " + page.status);
  for (const tag of ['property="og:image" content="https://irontrack-k.vercel.app/og-image.png?v=2"', 'property="og:title" content="IronTrack"', 'property="og:url"', 'property="og:description"', 'name="twitter:card" content="summary_large_image"']) {
    check("HTML inicial trae " + tag.split(" ")[0], html.includes(tag));
  }
} catch (e) {
  check("conexion a " + base, false, String(e && (e.cause || e.message)));
} finally {
  if (server) server.close();
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
}

const bad = results.filter((x) => !x).length;
console.log("\nOG HTTP (" + base + "): " + (results.length - bad) + "/" + results.length + " correctos");
process.exit(bad ? 1 : 0);
