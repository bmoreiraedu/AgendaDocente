import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''

export const hasSupabaseConfig = /^https?:\/\//.test(url)
  && publishableKey.length > 20
  && !url.includes('YOUR_PROJECT')
  && !publishableKey.includes('YOUR_PUBLISHABLE_KEY')

export const supabase: SupabaseClient | null = hasSupabaseConfig
  ? createClient(url, publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.')
  return supabase
}
