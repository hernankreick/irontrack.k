import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const callerToken = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!callerToken) {
      return new Response(JSON.stringify({ error: 'missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { alumnoEmail, newPassword } = await req.json()
    if (!alumnoEmail || !newPassword) {
      return new Response(JSON.stringify({ error: 'alumnoEmail and newPassword required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Identify the caller (must be a logged-in coach) from their JWT
    const { data: { user: caller }, error: callerError } = await supabaseAdmin.auth.getUser(callerToken)
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: 'invalid session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Only the alumno's own coach can reset their password
    const { data: alumnoRow, error: alumnoError } = await supabaseAdmin
      .from('alumnos')
      .select('id, entrenador_id')
      .eq('email', alumnoEmail)
      .maybeSingle()
    if (alumnoError) {
      return new Response(JSON.stringify({ error: alumnoError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    if (!alumnoRow || String(alumnoRow.entrenador_id) !== String(caller.id)) {
      return new Response(JSON.stringify({ error: 'not authorized for this student' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Find user in Auth by email
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) {
      return new Response(JSON.stringify({ error: listError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const authUser = users.find(u => u.email === alumnoEmail)
    if (!authUser) {
      return new Response(JSON.stringify({ error: 'user not found in auth' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Update password via Admin SDK
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      authUser.id,
      { password: newPassword }
    )

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
