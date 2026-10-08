import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parseCoachConfig, provisionStudentAuth } from './provisioning.js'

// update-alumno-password (S0.6.1)
//
// Body: { alumnoId, newPassword }.  El email NO se acepta del cliente: se lee de public.alumnos.
// Solo el entrenador autenticado puede llamarla (ver provisioning.js). Server-side:
//   - si alumnos.auth_uid existe: cambia la contrasena de ESE Auth user;
//   - si es NULL: localiza (o crea) el Auth user del email de la fila, vincula alumnos.auth_uid y cambia la contrasena.
//
// Secrets / configuracion (solo en el entorno de la funcion, nunca en el cliente):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (provistos por Supabase)
//   COACH_AUTH_UIDS  (opcional, recomendado) uuids de Auth del/los entrenador/es, separados por coma.
//                    Si esta definido es la UNICA evidencia aceptada para autorizar al caller.
//   COACH_EMAILS     (opcional) emails del entrenador; default entrenador@irontrack.app. Solo se usa si
//                    COACH_AUTH_UIDS esta vacio, y exige email confirmado.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    let payload: { alumnoId?: unknown; newPassword?: unknown } = {}
    try {
      payload = await req.json()
    } catch (_e) {
      return json(400, { error: 'invalid json body' })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const coach = parseCoachConfig({
      COACH_AUTH_UIDS: Deno.env.get('COACH_AUTH_UIDS') ?? '',
      COACH_EMAILS: Deno.env.get('COACH_EMAILS') ?? '',
    })

    const result = await provisionStudentAuth(
      { admin: supabaseAdmin, coach, log: console },
      {
        authorization: req.headers.get('Authorization') ?? '',
        alumnoId: payload.alumnoId as string,
        newPassword: payload.newPassword as string,
      },
    )
    return json(result.status, result.body)
  } catch (_e) {
    // No se serializa el error (podria arrastrar datos del request): respuesta generica.
    console.error('[update-alumno-password] unexpected error')
    return json(500, { error: 'internal error' })
  }
})
