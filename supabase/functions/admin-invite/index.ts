// ─── admin-invite Edge Function ───────────────────────────────────────────────
// Deploy via: Supabase Dashboard → Edge Functions → New function → paste code
// Or: supabase functions deploy admin-invite (requires Supabase CLI)
//
// Required env vars (set automatically in hosted Supabase):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Actions:
//   invite — invites a user by email (sends magic-link), upserts profile with role
//   delete  — permanently deletes a user from auth.users (cascades to profiles)
// ──────────────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verify caller is an authenticated admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (callerProfile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
    }

    const body = await req.json()
    const { action } = body

    // ── Invite ────────────────────────────────────────────────────────────────
    if (action === 'invite') {
      const { email, role = 'visualizador', nome } = body
      const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { nome },
      })
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders })
      }
      // Upsert profile row with the chosen role
      await supabaseAdmin
        .from('profiles')
        .upsert({ id: data.user.id, email, role, nome: nome || null }, { onConflict: 'id' })
      return new Response(
        JSON.stringify({ user: { id: data.user.id, email } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── Delete ────────────────────────────────────────────────────────────────
    if (action === 'delete') {
      const { userId } = body
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders })
      }
      return new Response(
        JSON.stringify({ ok: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: corsHeaders }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: corsHeaders }
    )
  }
})
