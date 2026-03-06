import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

declare global {
  // eslint-disable-next-line no-var
  var __anhSupabaseBrowserClientLocal: SupabaseClient | undefined
}

let browserClient: SupabaseClient | null = globalThis.__anhSupabaseBrowserClientLocal ?? null

export function createClient() {
  // Reuse a single browser client to avoid multiple GoTrue instances
  if (browserClient) return browserClient

  // Ensure environment variables are loaded
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
  const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()

  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase environment variables are missing.')
  }

  browserClient = createBrowserClient(supabaseUrl, supabaseKey)
  globalThis.__anhSupabaseBrowserClientLocal = browserClient
  return browserClient
}

