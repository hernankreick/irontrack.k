import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handleUpdateAlumnoPassword } from './core.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const callerToken = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    let body = null
    try { body = await req.json() } catch (_e) { body = null }
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    const { status, body: out } = await handleUpdateAlumnoPassword({ callerToken, body, admin })
    return new Response(JSON.stringify(out), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
