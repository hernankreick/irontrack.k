// Vista previa Open Graph: metadatos en el HTML estatico (sin JS), imagen 1200x630 real y
// favicon / iconos PWA / manifest intactos.
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";

const SITE = "https://irontrack-k.vercel.app";
const IMG = SITE + "/og-image.png?v=1";
const DESC = "Planificá, registrá y seguí tus entrenamientos";

const html = fs.readFileSync("index.html", "utf8");
const head = html.slice(0, html.indexOf("</head>"));
assert.ok(head.length > 0, "index.html tiene <head>");

function meta(attr, key) {
  const re = new RegExp('<meta\\s+' + attr + '="' + key.replace(/[.:]/g, "\\$&") + '"\\s+content="([^"]*)"\\s*/?>', "g");
  const found = [...head.matchAll(re)].map((m) => m[1]);
  assert.equal(found.length, 1, key + " aparece exactamente una vez en <head>");
  return found[0];
}

assert.equal(meta("name", "description"), DESC);
assert.equal(meta("property", "og:type"), "website");
assert.equal(meta("property", "og:title"), "IronTrack");
assert.equal(meta("property", "og:description"), DESC);
assert.equal(meta("property", "og:url"), SITE + "/");
assert.equal(meta("property", "og:image"), IMG, "og:image con URL absoluta y publica");
assert.equal(meta("property", "og:image:secure_url"), IMG);
assert.equal(meta("property", "og:image:type"), "image/png");
assert.equal(meta("property", "og:image:width"), "1200");
assert.equal(meta("property", "og:image:height"), "630");
assert.ok(meta("property", "og:image:alt").length > 0);
assert.equal(meta("name", "twitter:card"), "summary_large_image");
assert.equal(meta("name", "twitter:title"), "IronTrack");
assert.equal(meta("name", "twitter:description"), DESC);
assert.equal(meta("name", "twitter:image"), IMG);

// Ninguna URL de imagen relativa.
for (const m of head.matchAll(/(?:og|twitter):image(?::secure_url)?"\s+content="([^"]+)"/g)) {
  assert.match(m[1], /^https:\/\//, "URL absoluta https: " + m[1]);
}

// Lo existente sigue igual.
assert.match(head, /<title>IRON TRACK<\/title>/, "title intacto");
assert.match(head, /<link rel="icon" type="image\/png" sizes="32x32" href="\/icons\/favicon-32\.png" \/>/, "favicon intacto");
assert.match(head, /<link rel="apple-touch-icon" href="\/icon-1024\.png" \/>/, "apple-touch-icon intacto");
assert.match(head, /<link rel="manifest" href="\/manifest\.webmanifest"\/>/, "manifest intacto");

// La imagen es un PNG real de 1200x630 y liviano (WhatsApp descarta imagenes pesadas).
const png = fs.readFileSync("public/og-image.png");
assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "firma PNG");
assert.equal(png.toString("ascii", 12, 16), "IHDR");
assert.equal(png.readUInt32BE(16), 1200, "ancho 1200");
assert.equal(png.readUInt32BE(20), 630, "alto 630");
assert.ok(png.length < 300 * 1024, "og-image.png < 300 KB (" + png.length + " B)");

const hash = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
const intact = {
  "public/favicon.ico": "9c3ccf819bb1d4fbd54feac2afb777fee61e452d9c8851f87624a0a0b742dea4",
  "public/icon-1024.png": "4d8a6b0060d7116c7e48546e66fbe32a58086a309ea4c71243eb4f829c64d980",
  "public/icon-192x192.png": "9c3ccf819bb1d4fbd54feac2afb777fee61e452d9c8851f87624a0a0b742dea4",
  "public/icon-512x512.png": "2062fd5003cfb452477e740a020baa72f39311bca9c699b58db5de5c1df30987",
  "public/isotipo-onboarding.png": "817fc4bab602cf01041e46f57af6f02de0fe42840434a4dabb7fbc7d606d64b0",
  "public/manifest.json": "8466b5690e8a454dddce864e76973865dbfa6b2e7412b8412194d59e4649cb57",
  "public/manifest.webmanifest": "8466b5690e8a454dddce864e76973865dbfa6b2e7412b8412194d59e4649cb57",
  "public/icons/apple-touch-icon.png": "76266670e7e2c7c65fb28fa54be4eb7dc26b43f337249e59b060fbb62767baee",
  "public/icons/favicon-32.png": "f332819b80a88b4dfbd900259e9c6f847e9fcdd1ab6ddbbc7628bd3da021fabd",
  "public/icons/icon-192.png": "623d2c58a654393f1e036701d2cd7c472996bfe2c3287ff45bfde0d4ec4acb9a",
  "public/icons/icon-192-maskable.png": "623d2c58a654393f1e036701d2cd7c472996bfe2c3287ff45bfde0d4ec4acb9a",
  "public/icons/icon-512.png": "482607b150e96b6ac2be55fb3c629133280da0acf108e1ca370ded0d8999a273",
  "public/icons/icon-512-maskable.png": "482607b150e96b6ac2be55fb3c629133280da0acf108e1ca370ded0d8999a273",
  "public/icons/irontrack-icon-final.png": "727fd4709639be7b4f755b6829e8c033694351425e068dd8d9bf056cf914bd31",
};
for (const [f, h] of Object.entries(intact)) assert.equal(hash(f), h, f + " no cambio");

console.log("test-ogMeta: OK");
