import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handleNotify, makeIsCoachAccount, PUSH_HEADINGS } from './core.js'

// Secretos (se configuran con `supabase secrets set`, nunca en el repo):
//   ONESIGNAL_REST_API_KEY  clave privada de OneSignal (la NUEVA, ya rotada)
//   ONESIGNAL_APP_ID        opcional; si falta se usa el App ID publico de la app
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase automaticamente.
const DEFAULT_ONESIGNAL_APP_ID = '8c5e2bd1-2ac8-497a-93eb-fd07e5ce74d7' // publico (ya va en el bundle web)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const admin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

const deps = {
  corsHeaders,

  getUser: async (token: string) => {
    const { data, error } = await admin.auth.getUser(token)
    if (error || !data?.user) return null
    return { id: data.user.id, email: data.user.email ?? '' }
  },

  getAlumno: async (alumnoId: string) => {
    const { data, error } = await admin
      .from('alumnos')
      .select('id, entrenador_id, email, onesignal_id')
      .eq('id', alumnoId)
      .maybeSingle()
    if (error) throw error
    return data
  },

  // Ver makeIsCoachAccount en core.js. COACH_USER_IDS (opcional, separado por comas) endurece el
  // caso en que la tabla `entrenadores` sea escribible por cualquier usuario autenticado.
  isCoachAccount: makeIsCoachAccount({
    allowList: (Deno.env.get('COACH_USER_IDS') ?? '').split(',').map((x) => x.trim()).filter(Boolean),
    coachExists: async (id: string) => {
      const { data, error } = await admin.from('entrenadores').select('id').eq('id', id).maybeSingle()
      if (error) throw error
      return !!data
    },
    emailIsAlumno: async (email: string) => {
      const { data, error } = await admin.from('alumnos').select('id').ilike('email', email).limit(1)
      if (error) throw error
      return !!(data && data.length)
    },
  }),

  sendPush: async ({ playerId, mensaje }: { playerId: string; mensaje: string }) => {
    const apiKey = Deno.env.get('ONESIGNAL_REST_API_KEY')
    if (!apiKey) throw new Error('ONESIGNAL_REST_API_KEY not configured')
    const r = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Basic ' + apiKey },
      body: JSON.stringify({
        app_id: Deno.env.get('ONESIGNAL_APP_ID') ?? DEFAULT_ONESIGNAL_APP_ID,
        include_player_ids: [playerId],
        headings: PUSH_HEADINGS,
        contents: { en: mensaje, es: mensaje },
      }),
    })
    return { ok: r.ok, status: r.status }
  },
}

Deno.serve((req) => handleNotify(req, deps))
