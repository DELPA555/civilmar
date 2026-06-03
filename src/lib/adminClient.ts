import { createClient } from '@supabase/supabase-js'

// Cliente con service role — SOLO usar en funciones admin del frontend
// El service role key bypasses RLS y permite gestionar usuarios de Auth
const SUPABASE_URL         = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY as string

export const adminClient = SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null
