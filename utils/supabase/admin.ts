import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { getEnv } from '@/lib/env'

export function createAdminClient() {
  const env = getEnv()
  const supabaseUrl = (env.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
  const serviceRoleKey = (env.supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY for admin client')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })
}
