import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getEnv } from '@/lib/env'

export async function createClient() {
  const cookieStore = await cookies()
  const env = getEnv()
  
  // 환경변수 우선순위: getEnv() -> process.env
  const supabaseUrl = (env.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
  const supabaseKey = (env.supabaseAnonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  })
}

