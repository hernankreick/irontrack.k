// Vista previa Open Graph: metadatos en el HTML estatico (sin JS), imagen 1200x630 real con el
// isotipo sin baldosa, y favicon / iconos PWA / manifest intactos.
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import zlib from "node:zlib";

const SITE = "https://irontrack-k.vercel.app";
const IMG = SITE + "/og-image.png?v=2";
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

// Sin baldosa: alrededor del isotipo (y donde estaba la baldosa 288x288 en x 456-743, y 64-351)
// solo hay fondo #0A0F1A. Se decodifica el PNG (RGB 8 bits) y se recorre el marco entre la caja
// del simbolo (alfa > 0 de isotipo-onboarding.png escalado: x 468-737, y 71-348, +2 px de antialiasing) y un margen exterior.
// Tolerancia 2 niveles: el brillo azul inferior del diseno empieza en y~351 (+1/+2); la baldosa difiere >= 10.
function decodeRgb(buf) {
  let pos = 8, w = 0, h = 0, idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString("ascii", pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); assert.equal(data[8], 8); assert.equal(data[9], 2, "PNG RGB"); assert.equal(data[12], 0); }
    if (type === "IDAT") idat.push(data);
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * 3, out = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= 3 ? out[y * stride + x - 3] : 0, b = y ? out[(y - 1) * stride + x] : 0, c = x >= 3 && y ? out[(y - 1) * stride + x - 3] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f];
      out[y * stride + x] = (line[x] + pred) & 255;
    }
  }
  return { w, px: (x, y) => [...out.subarray((y * w + x) * 3, (y * w + x) * 3 + 3)] };
}
const og = decodeRgb(png);
let frame = 0, off = [];
for (let y = 30; y < 352; y++) for (let x = 420; x < 780; x++) {
  if (x >= 466 && x <= 739 && y >= 69 && y <= 350) continue;
  frame++;
  const [r, g, b] = og.px(x, y);
  if (Math.max(Math.abs(r - 10), Math.abs(g - 15), Math.abs(b - 26)) > 2) off.push(x + "," + y + "=" + [r, g, b]);
}
assert.equal(frame, 360 * 322 - 274 * 282, "marco completo recorrido");
assert.deepEqual(off.slice(0, 5), [], "sin contorno ni tono de baldosa alrededor del isotipo (" + off.length + " px distintos de #0A0F1A)");

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
