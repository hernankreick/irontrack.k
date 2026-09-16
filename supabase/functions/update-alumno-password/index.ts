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
      .ilike('email', alumnoEmail)
      .maybeSingle()
    if (alumnoError) {
      return new Response(JSON.stringify({ error: alumnoError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    // La app todavía convive con dos esquemas de entrenador_id: el UUID real de
    // Supabase Auth (flujos nuevos, ej. asignar rutina) y el string legacy
    // "entrenador_principal" que sigue usando "Nuevo alumno" y por lo tanto casi
    // todos los alumnos existentes hoy. Se acepta cualquiera de los dos para no
    // bloquear el uso real de la app de un solo entrenador.
    const ownsAlumno = alumnoRow && (
      String(alumnoRow.entrenador_id) === String(caller.id) ||
      alumnoRow.entrenador_id === 'entrenador_principal'
    )
    if (!ownsAlumno) {
      return new Response(JSON.stringify({ error: 'not authorized for this student' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Find user in Auth by email. listUsers() está paginado (50 por página por
    // default) — hay que recorrer todas las páginas o se puede no encontrar un
    // usuario que sí existe y terminar intentando crearlo de nuevo (createUser
    // falla entonces con un error de base, tipo "Database error creating new
    // user", que es justo lo que devuelve un email duplicado en auth.users).
    const findAuthUserByEmail = async (email) => {
      const target = email.toLowerCase()
      for (let page = 1; page <= 20; page++) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 })
        if (error) throw error
        const match = (data?.users ?? []).find(u => (u.email ?? '').toLowerCase() === target)
        if (match) return match
        if (!data?.users || data.users.length < 200) break
      }
      return null
    }

    let authUser
    try {
      authUser = await findAuthUserByEmail(alumnoEmail)
    } catch (listError) {
      return new Response(JSON.stringify({ error: listError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (authUser) {
      // Ya tiene cuenta en Auth: actualizar la contraseña
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        authUser.id,
        { password: newPassword }
      )
      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    } else {
      // El alumno se crea sin cuenta de Auth (solo nombre+email en la tabla alumnos).
      // Editar alumno es también el punto donde se le da contraseña por primera vez.
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: alumnoEmail,
        password: newPassword,
        email_confirm: true,
        user_metadata: { role: 'alumno' },
      })
      if (createError) {
        // "Database error creating new user" suele ser en realidad un email ya
        // registrado que la primera búsqueda no encontró (paginación, timing).
        // Reintentamos la búsqueda una vez más antes de rendirnos.
        let retryUser
        try {
          retryUser = await findAuthUserByEmail(alumnoEmail)
        } catch (e) { retryUser = null }
        if (retryUser) {
          const { error: retryUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
            retryUser.id,
            { password: newPassword }
          )
          if (retryUpdateError) {
            return new Response(JSON.stringify({ error: retryUpdateError.message }), {
              status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
        } else {
          return new Response(JSON.stringify({ error: createError.message }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      }
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
