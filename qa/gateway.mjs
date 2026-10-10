// Gateway local minimo (equivale a Kong de Supabase): /auth/v1 -> GoTrue, /rest/v1 -> PostgREST, /functions/v1/<fn> -> funcion en Node.
// Solo escucha en loopback. La Edge Function se ejecuta con la MISMA logica (core.js) pero en Node, no en Deno.
import http from "node:http";
import { createClient } from "@supabase/supabase-js";
import { assertLocalSupabaseUrl } from "./guard.mjs";
import { serviceKey } from "./keys.mjs";
import { handleUpdateAlumnoPassword } from "../supabase/functions/update-alumno-password/core.js";

const PORT = Number(process.env.QA_GATEWAY_PORT || 54321);
const PUBLIC_URL = assertLocalSupabaseUrl(`http://127.0.0.1:${PORT}`);
const TARGETS = { "/auth/v1": { host: "127.0.0.1", port: 9999 }, "/rest/v1": { host: "127.0.0.1", port: 3000 } };
const admin = createClient(PUBLIC_URL, serviceKey(), { auth: { persistSession: false, autoRefreshToken: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer, accept-profile, content-profile, x-supabase-api-version",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Expose-Headers": "content-range",
};

http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
  const url = req.url || "/";
  if (url.startsWith("/functions/v1/update-alumno-password")) {
    const chunks = []; for await (const c of req) chunks.push(c);
    let body = null; try { body = JSON.parse(Buffer.concat(chunks).toString() || "null"); } catch (e) {}
    const callerToken = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const out = await handleUpdateAlumnoPassword({ callerToken, body, admin });
    res.writeHead(out.status, { ...cors, "Content-Type": "application/json" });
    return res.end(JSON.stringify(out.body));
  }
  const prefix = Object.keys(TARGETS).find((p) => url.startsWith(p));
  if (!prefix) { res.writeHead(404, cors); return res.end("not found"); }
  const t = TARGETS[prefix];
  const upstream = http.request({ host: t.host, port: t.port, method: req.method, path: url.slice(prefix.length) || "/",
    headers: { ...req.headers, host: `${t.host}:${t.port}` } }, (r) => {
    const h = { ...r.headers }; delete h["access-control-allow-origin"];
    res.writeHead(r.statusCode || 502, { ...h, ...cors }); r.pipe(res);
  });
  upstream.on("error", (e) => { res.writeHead(502, cors); res.end(String(e)); });
  req.pipe(upstream);
}).listen(PORT, "127.0.0.1", () => console.log(`[qa-gateway] http://127.0.0.1:${PORT}`));
