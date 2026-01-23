import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Ensure environment variables are loaded
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase environment variables are missing.')
    // Fallback or early error handling could be here, but for now we let it fail gracefully or log.
  }

  return createBrowserClient(supabaseUrl, supabaseKey)
}

