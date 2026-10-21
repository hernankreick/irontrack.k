// Guard de entorno de build: impide que una Preview/Development de Vercel se construya apuntando al Supabase de produccion.
//
// Contexto: las VITE_* se incrustan en el bundle al construir, y Vite lee `.env` del repo si el entorno de la
// plataforma no define la variable. Un `.env` versionado hace que una Preview sin variables propias apunte a produccion.
//
// Reglas (solo para builds en Vercel que NO son Production; Production nunca falla, solo advierte):
//   R1  el valor viene de un archivo .env* (no de variables del entorno de la plataforma)  -> FALLA
//   R2  el host coincide con un host de produccion (comparacion por hash)                    -> FALLA
//   R3  hay allowlist de staging y el host no esta en ella                                    -> FALLA
//   R4  la URL no es valida (supabase-js la rechazaria al arrancar y la app quedaria en blanco) -> FALLA
// Nunca imprime hosts, URLs ni claves: solo veredictos, nombres de variables y hashes.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const URL_VAR = "VITE_SUPABASE_URL";
export const KEY_VAR = "VITE_SUPABASE_ANON_KEY";

/**
 * Normaliza un host para comparar: minusculas, sin espacios y SIN puntos finales ("host." es el mismo servidor que "host",
 * un nombre DNS absoluto). Conserva el puerto: "host.:8443" -> "host:8443".
 */
export function normalizeHost(host) {
  const s = String(host).trim().toLowerCase();
  const m = /^(.*?)(:\d+)?$/.exec(s);
  return m[1].replace(/\.+$/, "") + (m[2] || "");
}

export function sha256Host(host) {
  return createHash("sha256").update(normalizeHost(host)).digest("hex");
}

export function hostOf(url) {
  try {
    const host = new URL(String(url)).host;
    return host ? normalizeHost(host) : null;
  } catch { return null; }
}

/** Lista separada por comas -> array de hashes en minusculas (sin vacios). */
export function parseHashList(value) {
  return String(value || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/** production | preview | development | unknown (hay VERCEL pero no VERCEL_ENV) | local (fuera de Vercel). */
export function detectTarget(env) {
  if (env.VERCEL_ENV) return String(env.VERCEL_ENV).toLowerCase();
  return env.VERCEL ? "unknown" : "local";
}

/**
 * @param {object} p
 * @param {string} p.target               ver detectTarget
 * @param {string|undefined} p.url        valor efectivo de VITE_SUPABASE_URL (despues de la precedencia de Vite)
 * @param {boolean} p.urlFromProcess      true si la variable esta definida en el entorno del proceso (no en un archivo)
 * @param {string[]} p.productionHashes   hashes sha256 de hosts de produccion
 * @param {string[]} p.stagingHashes      hashes sha256 de hosts de staging permitidos (vacio = sin allowlist)
 * @returns {{ status: "ok"|"warn"|"fail", errors: string[], warnings: string[], info: string[] }}
 */
export function evaluateEnvTarget({ target, url, urlFromProcess, productionHashes = [], stagingHashes = [] }) {
  const errors = [], warnings = [], info = [];
  const hosted = target !== "local";
  const nonProd = hosted && target !== "production";
  const present = typeof url === "string" && url.trim() !== "";
  const host = present ? hostOf(url) : null;
  const hash = host ? sha256Host(host) : null;

  if (!present) {
    info.push(URL_VAR + " ausente: el cliente de Supabase queda en null (sin backend).");
  } else if (nonProd) {
    if (!urlFromProcess) {
      errors.push("R1: " + URL_VAR + " proviene de un archivo .env* y no de las variables de entorno de la plataforma. " +
        "Defini " + URL_VAR + " y " + KEY_VAR + " para el entorno " + target + " en el panel (staging, o un valor inocuo como https://sin-backend.invalid).");
    }
    if (!host) {
      errors.push("R4: " + URL_VAR + " no es una URL valida (la app quedaria en blanco). Para desactivar el backend usa https://sin-backend.invalid.");
    } else {
      if (productionHashes.includes(hash)) errors.push("R2: " + target + " apunta al host de PRODUCCION (hash " + hash.slice(0, 12) + "...).");
      if (stagingHashes.length && !stagingHashes.includes(hash)) errors.push("R3: el host no esta en la allowlist de staging.");
    }
    if (!productionHashes.length) warnings.push("No hay hashes de produccion configurados: no se puede comprobar que el destino no sea produccion.");
  } else if (target === "production" && !urlFromProcess) {
    // Informativo para el dueño: el log de build de Vercel muestra si Production depende del .env versionado.
    warnings.push("Production toma " + URL_VAR + " de un archivo .env* y no de las variables del panel de Vercel. Definilas en el panel (ambito Production) antes de retirar el .env del seguimiento.");
  } else if (host && productionHashes.length) {
    const isProd = productionHashes.includes(hash);
    if (target === "production" && !isProd) warnings.push("production no apunta a ninguno de los hosts de produccion conocidos (revisar config/env-targets.json).");
    if (target === "local" && isProd) warnings.push("Este build local apunta al host de PRODUCCION; usa un .env.local con staging.");
  }

  // Production/local nunca bloquean el build por este guard.
  const blocking = nonProd ? errors : [];
  if (!nonProd) warnings.push(...errors.splice(0));
  return { status: blocking.length ? "fail" : warnings.length ? "warn" : "ok", errors: blocking, warnings, info };
}

/** Linea de resumen segura para logs. */
export function summarize({ target, url, key, urlFromProcess }, result) {
  const origen = url ? (urlFromProcess ? "entorno" : "archivo") : "-";
  return "[env-target] target=" + target + " " + URL_VAR + "=" + (url ? "definida" : "ausente") + " " + KEY_VAR + "=" + (key ? "definida" : "ausente") +
    " origen=" + origen + " => " + result.status.toUpperCase();
}

/** Hashes de produccion/staging: config/env-targets.json + variables PROD_SUPABASE_HOST_HASHES / STAGING_SUPABASE_HOST_HASHES. */
export function loadHashConfig(root, env = process.env) {
  let cfg = {};
  const file = path.join(root, "config", "env-targets.json");
  if (existsSync(file)) {
    try { cfg = JSON.parse(readFileSync(file, "utf8")); } catch { cfg = { _invalid: true }; }
  }
  const list = (v) => (Array.isArray(v) ? v : []).map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  return {
    productionHashes: [...new Set([...list(cfg.productionHostHashes), ...parseHashList(env.PROD_SUPABASE_HOST_HASHES)])],
    stagingHashes: [...new Set([...list(cfg.stagingHostHashes), ...parseHashList(env.STAGING_SUPABASE_HOST_HASHES)])],
    invalidConfig: !!cfg._invalid,
  };
}

/**
 * Ejecuta el guard con el valor EFECTIVO ya resuelto por Vite (config.env / loadEnv).
 * `env` es el entorno del proceso (para VERCEL_ENV y para saber si la variable viene del proceso).
 */
export function runEnvTargetGuard({ root, env = process.env, effective }) {
  const target = detectTarget(env);
  const cfg = loadHashConfig(root, env);
  const url = effective[URL_VAR], key = effective[KEY_VAR];
  const urlFromProcess = env[URL_VAR] !== undefined;
  const result = evaluateEnvTarget({ target, url, urlFromProcess, productionHashes: cfg.productionHashes, stagingHashes: cfg.stagingHashes });
  if (cfg.invalidConfig) {
    const msg = "config/env-targets.json no es JSON valido.";
    if (target !== "production" && target !== "local") { result.errors.push(msg); result.status = "fail"; } else { result.warnings.push(msg); if (result.status === "ok") result.status = "warn"; }
  }
  return { target, result, line: summarize({ target, url, key, urlFromProcess }, result) };
}

export function printGuardResult(out, log = console.log) {
  log(out.line);
  out.result.errors.forEach((e) => log("  - " + e));
  out.result.warnings.forEach((w) => log("  ! " + w));
  out.result.info.forEach((i) => log("  . " + i));
}
