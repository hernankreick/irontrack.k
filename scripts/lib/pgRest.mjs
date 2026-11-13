// Emulador MINIMO de la capa PostgREST sobre un PostgreSQL local real (scripts/lib/pgLocal.mjs).
// El SQL, los tipos, las restricciones, los indices y RLS son los de PostgreSQL de verdad; lo unico emulado es el transporte HTTP:
//   - POST (insert) con columnas desconocidas => 400 PGRST204 segun la "cache de esquema" (se refresca solo con reload()).
//   - errores SQL => { ok:false, status, data:{ code, message, details } } con el mismo mapeo de estado que PostgREST.
//   - GET con filtros eq / select / order / limit.
// NO es PostgREST: no valida la recarga real del esquema ni el JWT. Se usa para ejercitar el codigo del cliente contra restricciones reales.
const STATUS = { "23505": 409, "23503": 409, "23514": 400, "23502": 400, "42501": 403, "42703": 400, "22P02": 400, "22003": 400, "22001": 400 };
const ident = (s) => { if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error("identificador no permitido: " + s); return s; };

export function makeRest(pg, db, ctx) {
  const o = ctx || {};
  const role = o.role === undefined ? "authenticated" : o.role; // null => superusuario (sin RLS)
  const opts = role ? { role, claims: o.sub ? { sub: o.sub, role } : undefined } : undefined;
  let cache = null;
  const columnas = (t) => {
    if (!cache) {
      cache = {};
      for (const r of pg.rows("select table_name t, column_name c from information_schema.columns where table_schema='public' order by ordinal_position", db)) (cache[r.t] = cache[r.t] || []).push(r.c);
    }
    return cache[t] || [];
  };
  const fail = (e) => ({ ok: false, status: e.code === "42501" && role === "anon" ? 401 : STATUS[e.code] || 400, data: { code: e.code, message: e.message, details: e.detail || null, hint: null } });
  const api = {
    reload() { cache = null; }, // equivale a NOTIFY pgrst, 'reload schema' ya procesado
    async post(table, body) {
      const t = ident(table); const known = columnas(t);
      for (const k of Object.keys(body)) if (!known.includes(k)) return { ok: false, status: 400, data: { code: "PGRST204", message: "Could not find the '" + k + "' column of '" + t + "' in the schema cache", details: null, hint: null } };
      const cols = Object.keys(body).map(ident).join(", ");
      if (!cols) return { ok: false, status: 400, data: { code: "PGRST102", message: "empty body" } };
      const tag = "j" + Math.random().toString(36).slice(2, 8);
      const q = "insert into public." + t + " (" + cols + ") select " + cols + " from json_populate_record(null::public." + t + ", $" + tag + "$" + JSON.stringify(body) + "$" + tag + "$) returning *";
      const r = pg.tryRows(q, db, opts);
      return r.ok ? { ok: true, status: 201, data: r.rows } : fail(r.error);
    },
    /** path estilo PostgREST: "progreso?id=eq.X&alumno_id=eq.Y&select=a,b&order=created_at.asc&limit=5" */
    async get(pathQs) {
      const [table, qs = ""] = pathQs.split("?"); const t = ident(table);
      const p = new URLSearchParams(qs); let select = "*"; const where = []; let order = ""; let limit = "";
      for (const [k, v] of p) {
        if (k === "select") select = v.split(",").map((c) => (c === "*" ? "*" : ident(c))).join(", ");
        else if (k === "order") order = " order by " + v.split(",").map((x) => { const [c, d] = x.split("."); return ident(c) + (d === "desc" ? " desc" : " asc"); }).join(", ");
        else if (k === "limit") limit = " limit " + Number(v);
        else if (v.startsWith("eq.")) where.push(ident(k) + " = $v$" + v.slice(3).replace(/\$v\$/g, "") + "$v$");
        else if (v === "is.null") where.push(ident(k) + " is null");
        else throw new Error("filtro no soportado: " + k + "=" + v);
      }
      const q = "select " + select + " from public." + t + (where.length ? " where " + where.join(" and ") : "") + order + limit;
      const r = pg.tryRows(q, db, opts);
      return r.ok ? { ok: true, status: 200, data: r.rows } : fail(r.error);
    },
  };
  return api;
}
