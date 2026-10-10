// Logica de autorizacion y envio de notify-alumno, sin globals de Deno ni red:
// todas las dependencias entran por `deps`, asi se prueba en Node sin llamar a OneSignal.

export const LEGACY_COACH_ID = 'entrenador_principal'
export const MAX_MENSAJE = 500

// Mismo texto que enviaba el cliente antes de mover el envio al servidor.
export const PUSH_HEADINGS = { en: 'IRON TRACK 💪', es: 'IRON TRACK 💪' }

const json = (status, body, corsHeaders) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

// Cuenta de entrenador = esta en la allowlist opcional (COACH_USER_IDS), existe en `entrenadores`
// y su email NO pertenece a un alumno. Lecturas inyectadas para poder probarla sin base de datos.
export function makeIsCoachAccount({ allowList = [], coachExists, emailIsAlumno }) {
  return async (user) => {
    if (allowList.length && !allowList.includes(user.id)) return false
    if (!(await coachExists(user.id))) return false
    if (user.email && (await emailIsAlumno(user.email))) return false
    return true
  }
}

export function extractBearer(req) {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get('Authorization') ?? '')
  return m ? m[1].trim() : ''
}

// deps:
//   corsHeaders
//   getUser(token)            -> { id, email } | null        (valida el JWT contra Supabase Auth)
//   getAlumno(alumnoId)       -> { id, entrenador_id, email, onesignal_id } | null   (service role)
//   isCoachAccount(user)      -> boolean   (el usuario es una cuenta de entrenador, no de alumno)
//   sendPush({ playerId, mensaje })  -> { ok: boolean, status?: number }
export async function handleNotify(req, deps) {
  const { corsHeaders } = deps
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' }, corsHeaders)

  const token = extractBearer(req)
  if (!token) return json(401, { error: 'missing authorization' }, corsHeaders)

  let user = null
  try { user = await deps.getUser(token) } catch (_) { user = null }
  if (!user || !user.id) return json(401, { error: 'invalid session' }, corsHeaders)

  let body
  try { body = await req.json() } catch (_) { return json(400, { error: 'invalid json' }, corsHeaders) }
  const alumnoId = body && body.alumnoId
  const mensaje = body && body.mensaje
  if (alumnoId == null || alumnoId === '' || typeof mensaje !== 'string' || !mensaje.trim()) {
    return json(400, { error: 'alumnoId and mensaje required' }, corsHeaders)
  }
  if (mensaje.length > MAX_MENSAJE) return json(400, { error: 'mensaje too long' }, corsHeaders)

  // 1) Debe ser una cuenta de entrenador (un alumno con sesion valida NO alcanza).
  let esEntrenador = false
  try { esEntrenador = await deps.isCoachAccount(user) } catch (_) { esEntrenador = false }
  if (!esEntrenador) return json(403, { error: 'not authorized' }, corsHeaders)

  // 2) El alumno destinatario se lee del servidor; nunca se confia en datos del cliente.
  let alumno = null
  try { alumno = await deps.getAlumno(alumnoId) } catch (_) {
    return json(500, { error: 'lookup failed' }, corsHeaders)
  }
  // Misma respuesta para "no existe" y "no es tuyo": no revela que ids existen.
  if (!alumno) return json(403, { error: 'not authorized' }, corsHeaders)

  // 3) Pertenencia: UUID real del entrenador, o el id legacy usado por casi todos los alumnos.
  const ownsAlumno =
    String(alumno.entrenador_id) === String(user.id) || alumno.entrenador_id === LEGACY_COACH_ID
  if (!ownsAlumno) return json(403, { error: 'not authorized' }, corsHeaders)

  // Igual que el cliente anterior: sin onesignal_id no hay nada que enviar (no es error).
  if (!alumno.onesignal_id) return json(200, { ok: true, sent: false, reason: 'no_subscription' }, corsHeaders)

  let res
  try {
    res = await deps.sendPush({ playerId: alumno.onesignal_id, mensaje })
  } catch (_) {
    return json(502, { error: 'push provider unreachable' }, corsHeaders)
  }
  if (!res || !res.ok) return json(502, { error: 'push provider error', status: res && res.status }, corsHeaders)
  return json(200, { ok: true, sent: true }, corsHeaders)
}
