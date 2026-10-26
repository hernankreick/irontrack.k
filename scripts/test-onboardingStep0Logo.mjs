// Paso 1 del onboarding: isotipo sin baldosa, zona segura superior y sin desplazamiento fijo.
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";

const step = fs.readFileSync("components/onboarding/OnboardingStep0.jsx", "utf8");
const icon = fs.readFileSync("components/IronTrackAppIcon.jsx", "utf8");

assert.match(step, /ONBOARD_ISOTIPO_SRC = "\/isotipo-onboarding\.png"/, "usa el isotipo recortado");
assert.ok(!/src=.*icon-1024|"\/icon-1024\.png"/.test(step), "Step0 no usa icon-1024.png");
assert.ok(!/<IronTrackAppIcon/.test(step), "Step0 no usa IronTrackAppIcon");
assert.match(step, /alt="IronTrack"/);
assert.match(step, /width=\{512\}\s+height=\{512\}/, "dimensiones explicitas");
assert.match(step, /var\(--it-safe-top, env\(safe-area-inset-top, 0px\)\)/, "safe-area superior");
assert.match(step, /env\(safe-area-inset-bottom/, "safe-area inferior del CTA");
assert.ok(!/translateY\(-4%\)/.test(step), "sin translateY(-4%)");
assert.ok(!/justifyContent: "center",\s*\n\s*transform/.test(step));
assert.match(step, /position: "fixed",\s*inset: 0,\s*height: "100%"/, "raiz fija sobre el area visible (inset:0)");
assert.ok(!/height: "100dvh"/.test(step) && !/minHeight: "100dvh"/.test(step), "la raiz no depende de 100dvh");
assert.ok(!/position: "sticky"/.test(step), "sin sticky");
const iScroll = step.indexOf('data-onb-scroll'), iBottom = step.indexOf('data-onb-bottom');
assert.ok(iScroll > 0 && iBottom > iScroll, "bloque inferior despues del area de scroll");
const scrollStyle = step.slice(iScroll, iBottom);
assert.match(scrollStyle, /flex: "1 1 auto",\s*minHeight: 0/);
assert.match(scrollStyle, /overflowY: "auto"/);
assert.match(scrollStyle, /overscrollBehavior: "contain"/);
assert.match(scrollStyle, /24px 16px"/, "padding-bottom del scroll 16px");
assert.match(scrollStyle, /WebkitOverflowScrolling: "touch"/);
// El bloque inferior (CTA) es hermano del scroll: nada con data-onb-bottom dentro del area con scroll.
const bottomStyle = step.slice(iBottom, iBottom + 700);
assert.match(bottomStyle, /flex: "0 0 auto"/);
assert.match(bottomStyle, /max\(12px, env\(safe-area-inset-bottom, 0px\)\)/);
assert.match(bottomStyle, /borderTop/);
assert.ok(step.indexOf("EMPEZAR GRATIS") > iBottom, "CTA dentro del bloque inferior");
assert.ok(step.indexOf("Paso 1 de 4") > iBottom, "Paso 1 de 4 dentro del bloque inferior");
assert.ok(!/transform: "translateY\(-/.test(step.replace(/translateY\(14px\)/g, "")), "sin desplazamientos fijos");
assert.match(step, /fontSize: 13,/, "subtitulos de tarjeta >= 13 px");
assert.match(step, /minHeight: 44,/, "enlace de cuenta con objetivo tactil 44 px");
assert.match(step, /margin: "auto 0"/, "centrado sin recorte superior");

assert.match(icon, /OFFICIAL_ICON_SRC = "\/icon-1024\.png"/, "IronTrackAppIcon por defecto intacto (splash/login)");
const hash = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
assert.equal(hash("public/icon-1024.png"), "4d8a6b0060d7116c7e48546e66fbe32a58086a309ea4c71243eb4f829c64d980", "icon-1024.png no cambio");
assert.equal(hash("assets/IronTrack-app-icon-1024.png"), "96a7f42bc34da4a1256e19875d154487cbedb6156a0ecc86e1cb0ec01faca520");
const sz = fs.statSync("public/isotipo-onboarding.png").size;
assert.ok(sz > 1000 && sz < 150 * 1024, "peso del isotipo < 150 KB: " + sz);
const png = fs.readFileSync("public/isotipo-onboarding.png");
assert.equal(png.readUInt32BE(16), 512); assert.equal(png.readUInt32BE(20), 512);
console.log("test-onboardingStep0Logo: OK");
