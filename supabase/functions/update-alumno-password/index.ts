import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handleUpdateAlumnoPassword, parseCoachUids } from './handler.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// La logica y las reglas de autorizacion estan en handler.js (probadas en Node con un cliente simulado).
// Secreto requerido: COACH_UIDS = UIDs de Auth de los entrenadores autorizados, separados por coma.
// Sin ese secreto (o sin UUID validos) la funcion deniega todas las llamadas.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const callerToken = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    let body = null
    try { body = await req.json() } catch (_e) { body = null }

    const allowedCoachUids = parseCoachUids(Deno.env.get('COACH_UIDS'))
    if (!allowedCoachUids.length) {
      console.error('[update-alumno-password] COACH_UIDS no configurado o sin UUID validos: se deniegan todas las llamadas')
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    const { status, body: out } = await handleUpdateAlumnoPassword({ callerToken, body, admin, allowedCoachUids })
    return new Response(JSON.stringify(out), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
