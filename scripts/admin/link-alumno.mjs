// CLI de vinculacion (IT-002a). Lo ejecuta el PROPIETARIO en su maquina; nunca desde la sesion de agentes.
//
//   Requisitos: npm ci (usa @supabase/supabase-js del repo).
//   Variables de entorno (no se imprimen): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, COACH_UIDS (los mismos UIDs del secreto de la funcion)
//   Cargar la clave sin dejarla en el historial de la shell:  read -rs SUPABASE_SERVICE_ROLE_KEY; export SUPABASE_SERVICE_ROLE_KEY
//
//   Dry-run (por defecto):  node scripts/admin/link-alumno.mjs --project-ref <ref> --alumno-id <id de la ficha> --auth-id <uid de la cuenta>
//   Aplicar:                ... --apply --confirm <alumno-id>:<primeros 8 del auth-id>
//   Deshacer (individual):  ... --rollback [--apply --confirm <igual>]
//   Proveedor distinto de email (excepcional): --allow-non-email-provider
//
// Solo escribe app_metadata.alumno_id. Ver link-alumno-core.mjs para las reglas. El --confirm es un control contra errores de copiado,
// NO sustituye la verificacion de titularidad con el alumno por otro canal.
import { runLink, exitCodeFor } from './link-alumno-core.mjs';

const die = (m, code = 1) => { console.error('ABORTA: ' + m); process.exit(code); };

// ---- argumentos: estrictos (sin valores que empiecen con --, sin repetidos, sin posicionales, sin modo masivo) ----
const argv = process.argv.slice(2);
const VALUE = new Set(['--alumno-id', '--auth-id', '--confirm', '--project-ref']);
const FLAGS = new Set(['--apply', '--rollback', '--allow-non-email-provider']);
const vals = {};
const flags = new Set();
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (VALUE.has(a)) {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) die('falta el valor de ' + a);
    if (a in vals) die('opcion repetida: ' + a);
    vals[a] = v;
    i++;
  } else if (FLAGS.has(a)) {
    if (flags.has(a)) die('opcion repetida: ' + a);
    flags.add(a);
  } else {
    die('opcion desconocida o argumento sobrante; no hay modo masivo: una cuenta por ejecucion');
  }
}
const arg = (k) => vals['--' + k];
const flag = (k) => flags.has('--' + k);

// ---- entorno: el host debe ser EXACTAMENTE <ref de 20 caracteres>.supabase.co y el operador confirma el proyecto ----
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) die('faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno');
let ref;
try {
  const u = new URL(url);
  const m = /^([a-z0-9]{20})\.supabase\.co$/.exec(u.hostname);
  if (u.protocol !== 'https:' || !m || u.username || u.password || u.port) throw new Error('host');
  ref = m[1];
} catch (_e) {
  die('SUPABASE_URL debe ser https://<ref de 20 caracteres>.supabase.co');
}
console.log('Proyecto destino: ' + ref + ' (la referencia no es un secreto; verificar que sea el proyecto correcto)');
if (arg('project-ref') !== ref) die('indicar --project-ref con la referencia del proyecto para confirmar a cual se apunta');

const coachUids = String(process.env.COACH_UIDS || '').split(',').map((s) => s.trim()).filter(Boolean);

// ---- ejecucion ----
let res;
try {
  const { createClient } = await import('@supabase/supabase-js');
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  res = await runLink({
    admin,
    alumnoId: arg('alumno-id'),
    authId: arg('auth-id'),
    coachUids,
    mode: flag('rollback') ? 'rollback' : 'link',
    apply: flag('apply'),
    confirm: arg('confirm'),
    allowProviders: flag('allow-non-email-provider'),
  });
} catch (_e) {
  die('error inesperado antes o durante la ejecucion; verificar la cuenta a mano en Authentication > Users', 2);
}
for (const l of res.log) console.log(l);
console.log((res.ok ? 'RESULTADO: ' : 'ABORTA: ') + res.code + ' - ' + res.message);
process.exit(exitCodeFor(res));
