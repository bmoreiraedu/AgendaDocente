import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

const passwordError = (password: string) => {
  if (password.length < 12) return 'Use pelo menos 12 caracteres.'
  if (!/[a-z]/.test(password)) return 'Inclua ao menos uma letra minúscula.'
  if (!/[A-Z]/.test(password)) return 'Inclua ao menos uma letra maiúscula.'
  if (!/\d/.test(password)) return 'Inclua ao menos um número.'
  if (!/[^A-Za-z0-9]/.test(password)) return 'Inclua ao menos um símbolo.'
  return null
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const authorization = request.headers.get('Authorization')
  if (!authorization) return json({ error: 'Sessão obrigatória.' }, 401)

  try {
    const { password } = await request.json() as { password?: unknown }
    if (typeof password !== 'string') return json({ error: 'Senha inválida.' }, 400)
    const weakPassword = passwordError(password)
    if (weakPassword) return json({ error: weakPassword }, 400)

    const projectUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const caller = createClient(projectUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: callerData, error: callerError } = await caller.auth.getUser()
    if (callerError || !callerData.user) return json({ error: 'Sessão inválida.' }, 401)

    const admin = createClient(projectUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: current, error: currentError } = await admin.auth.admin.getUserById(callerData.user.id)
    if (currentError || !current.user) return json({ error: 'Usuário não encontrado.' }, 404)
    if (current.user.app_metadata.must_change_password !== true) {
      return json({ ok: true, alreadyCompleted: true })
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(current.user.id, {
      password,
      app_metadata: { ...current.user.app_metadata, must_change_password: false },
    })
    if (updateError) return json({ error: updateError.message }, 400)
    return json({ ok: true })
  } catch {
    return json({ error: 'Não foi possível concluir o primeiro acesso.' }, 400)
  }
})
