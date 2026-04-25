/**
 * Genera assets/lottie/irontrack-app-icon.json
 * Intro ~2s (0–119) + 1 ciclo idle (120–239) con “respiración” del anillo.
 * En apps: playOnce 0–119, luego setMinFrame(120) + loop 120–239.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const FR = 60;
const INTRO_END = 120;
const LOOP_END = 240;
const W = 400;
const H = 400;
const CX = W / 2;
const CY = H / 2;

const hex = (h, a = 1) => {
  const n = h.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  return [r, g, b, a];
};

/** Keyframes numéricos + ease-in-out suave (handles tipo AE). */
const EIO = {
  o: { x: [0.42], y: [0] },
  i: { x: [0.58], y: [1] },
};

function kfRaw(pairs, ease = true) {
  const frames = pairs.map(({ t, v, h }) => {
    const k = { t, s: Array.isArray(v) ? v : [v] };
    if (h) k.h = 1;
    return k;
  });
  if (!ease) return frames;
  return frames.map((k, idx) => {
    if (k.h) return k;
    const o = { ...k };
    if (idx < frames.length - 1) o.o = EIO.o;
    if (idx > 0) o.i = EIO.i;
    return o;
  });
}

function kf(pairs) {
  return kfRaw(pairs, true);
}

function anim(kfs) {
  return { a: 1, k: kfs };
}
function stat(v) {
  return { a: 0, k: v };
}

// --- Timeline (orden: fondo → anillo 0–75% → barra → mancuerna → idle respiro) ---
const bgOpacity = kf([
  { t: 0, v: 0 },
  { t: 14, v: 100 },
]);

const trackOpacity = kf([
  { t: 0, v: 0 },
  { t: 6, v: 0 },
  { t: 18, v: 100 },
]);

const trimEnd = kf([
  { t: 0, v: 0 },
  { t: 20, v: 0 },
  { t: 84, v: 75 },
  { t: 119, v: 75, h: 1 },
  { t: 120, v: 75 },
  { t: 180, v: 78 },
  { t: 239, v: 75 },
]);

const trimGlow = kf([
  { t: 0, v: 0 },
  { t: 20, v: 0 },
  { t: 84, v: 75 },
  { t: 119, v: 75, h: 1 },
  { t: 120, v: 75 },
  { t: 180, v: 78 },
  { t: 239, v: 75 },
]);

const glowOpacity = kf([
  { t: 0, v: 0 },
  { t: 20, v: 0 },
  { t: 70, v: 40 },
  { t: 119, v: 46, h: 1 },
  { t: 120, v: 42 },
  { t: 180, v: 56 },
  { t: 239, v: 42 },
]);

const strokeW = kf([
  { t: 0, v: 11, h: 1 },
  { t: 119, v: 11, h: 1 },
  { t: 120, v: 11 },
  { t: 180, v: 12.2 },
  { t: 239, v: 11 },
]);

const barOpacity = kf([
  { t: 0, v: 0 },
  { t: 78, v: 0 },
  { t: 108, v: 100 },
]);

const barScale = kf([
  { t: 0, v: 94 },
  { t: 78, v: 94 },
  { t: 108, v: 100 },
]).map((k) => ({ ...k, s: [k.s[0], k.s[0], 100] }));

/** Rebote: segmentos lineales para overshoot suave (termina antes del frame 120). */
const dbPosX = kfRaw(
  [
    { t: 0, v: CX - 34 },
    { t: 90, v: CX - 34 },
    { t: 102, v: CX + 3 },
    { t: 110, v: CX - 0.5 },
    { t: 118, v: CX },
  ],
  false,
);

function layerSolid(ind, nm, color, opacityK) {
  return {
    ddd: 0,
    ind,
    ty: 1,
    nm,
    sr: 1,
    st: 0,
    op: LOOP_END,
    ip: 0,
    hd: false,
    bm: 0,
    sc: color,
    sw: W,
    sh: H,
    ks: {
      o: opacityK,
      r: stat(0),
      p: stat([CX, CY, 0]),
      a: stat([CX, CY, 0]),
      s: stat([100, 100, 100]),
    },
  };
}

function trGroup() {
  return {
    ty: "tr",
    p: stat([0, 0]),
    a: stat([0, 0]),
    s: stat([100, 100]),
    r: stat(0),
    o: stat(100),
    sk: stat(0),
    sa: stat(0),
    nm: "Transform",
  };
}

function ellipseGroup({ nm, size, strokeW, strokeC, trimE, trimO = -90, opacity = stat(100), strokeWAnim = null }) {
  const stroke = {
    ty: "st",
    c: strokeC,
    o: opacity,
    w: strokeWAnim ?? stat(strokeW),
    lc: 2,
    lj: 2,
    ml: 4,
    bm: 0,
    nm: "Stroke",
    d: [],
  };
  return {
    ty: "gr",
    it: [
      { ty: "el", d: 1, s: stat([size, size]), p: stat([0, 0]), nm: "Ellipse" },
      stroke,
      { ty: "tm", s: stat(0), e: trimE, o: stat(trimO), m: 1, nm: "Trim" },
      trGroup(),
    ],
    nm,
    np: 4,
    bm: 0,
  };
}

function shapeLayer(ind, nm, shapes, { pos, opacity = stat(100), scale = stat([100, 100, 100]), posAnim = null }) {
  return {
    ddd: 0,
    ind,
    ty: 4,
    nm,
    sr: 1,
    st: 0,
    op: LOOP_END,
    ip: 0,
    hd: false,
    ao: 0,
    bm: 0,
    hasMask: false,
    ks: {
      o: opacity,
      r: stat(0),
      p: posAnim ?? stat([...pos, 0]),
      a: stat([0, 0, 0]),
      s: scale,
    },
    shapes,
  };
}

function dumbbellGroup() {
  const G = stat(hex("#3D4450"));
  const Hi = stat(hex("#6B7280", 0.45));
  const L = 86;
  const rect = (x, y, w, h, r, c) => ({
    ty: "gr",
    it: [
      { ty: "rc", d: 1, s: stat([w, h]), p: stat([x, y]), r: stat(r), nm: "rc" },
      { ty: "fl", c, o: stat(100), nm: "fl", r: 1 },
      trGroup(),
    ],
    nm: "p",
    np: 3,
    bm: 0,
  });
  return {
    ty: "gr",
    it: [
      rect(-L - 6, 0, 14, 28, 3.5, G),
      rect(-L - 6, 0, 14, 28, 3.5, Hi),
      rect(L + 6, 0, 14, 28, 3.5, G),
      rect(L + 6, 0, 14, 28, 3.5, Hi),
      rect(0, 0, 56, 12, 3, G),
      rect(0, 0, 56, 12, 3, Hi),
      trGroup(),
    ],
    nm: "Dumbbell",
    np: 7,
    bm: 0,
  };
}

function barGroup() {
  const blue = stat(hex("#3B82F6"));
  const shine = stat(hex("#FFFFFF", 0.22));
  return {
    ty: "gr",
    it: [
      {
        ty: "gr",
        it: [
          { ty: "rc", d: 1, s: stat([16, 52]), p: stat([0, 0]), r: stat(5), nm: "Bar" },
          { ty: "fl", c: blue, o: stat(100), nm: "F", r: 1 },
          trGroup(),
        ],
        nm: "Body",
        np: 3,
        bm: 0,
      },
      {
        ty: "gr",
        it: [
          { ty: "rc", d: 1, s: stat([14, 20]), p: stat([0, -14]), r: stat(4), nm: "Sh" },
          { ty: "fl", c: shine, o: stat(100), nm: "SF", r: 1 },
          trGroup(),
        ],
        nm: "Hi",
        np: 3,
        bm: 0,
      },
      trGroup(),
    ],
    nm: "CenterBar",
    np: 3,
    bm: 0,
  };
}

const ringSize = 300;

const layers = [
  layerSolid(1, "Background", "#040910", anim(bgOpacity)),
  shapeLayer(2, "Ring Track", [ellipseGroup({
    nm: "Track",
    size: ringSize,
    strokeW: 11,
    strokeC: stat(hex("#1E293B")),
    trimE: stat(100),
    opacity: anim(trackOpacity),
  })], { pos: [CX, CY] }),
  shapeLayer(3, "Ring Glow", [ellipseGroup({
    nm: "Glow",
    size: ringSize,
    strokeW: 20,
    strokeC: stat(hex("#22D3EE", 0.5)),
    trimE: anim(trimGlow),
    opacity: anim(glowOpacity),
  })], { pos: [CX, CY] }),
  shapeLayer(4, "Ring Progress", [ellipseGroup({
    nm: "Blue",
    size: ringSize,
    strokeW: 11,
    strokeC: stat(hex("#3B82F6")),
    trimE: anim(trimEnd),
    strokeWAnim: anim(strokeW),
  })], { pos: [CX, CY] }),
  shapeLayer(5, "Dumbbell", [dumbbellGroup()], {
    pos: [CX, CY],
    posAnim: anim(dbPosX.map((k) => ({ ...k, s: [k.s[0], CY, 0] }))),
  }),
  shapeLayer(6, "Center Bar", [barGroup()], {
    pos: [CX, CY],
    opacity: anim(barOpacity),
    scale: anim(barScale),
  }),
];

const lottie = {
  v: "5.7.4",
  fr: FR,
  ip: 0,
  op: LOOP_END,
  w: W,
  h: H,
  nm: "IronTrack App Icon",
  ddd: 0,
  assets: [],
  layers,
  markers: [
    { cm: "idle_loop", tm: INTRO_END, dr: LOOP_END - INTRO_END },
    { cm: "intro_end", tm: INTRO_END, dr: 0 },
  ],
  meta: {
    g: "IronTrack",
    a: "",
    d: "Intro 2s: bg, ring 0–75%, bar, dumbbell; idle: ring breathe",
    tc: "#050a14",
  },
};

const outDir = path.join(root, "assets", "lottie");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "irontrack-app-icon.json");
fs.writeFileSync(outPath, JSON.stringify(lottie));

console.log("OK", outPath, fs.statSync(outPath).size, "bytes");
