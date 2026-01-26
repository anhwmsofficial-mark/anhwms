import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null

export function createClient() {
  // Reuse a single browser client to avoid multiple GoTrue instances
  if (browserClient) return browserClient

  // Ensure environment variables are loaded
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase environment variables are missing.')
  }

  browserClient = createBrowserClient(supabaseUrl, supabaseKey)
  return browserClient
}

