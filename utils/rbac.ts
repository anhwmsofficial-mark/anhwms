import { createClient } from '@/utils/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { hasRolePermission, type UserRole } from '@/lib/auth/permissions'

const parseBearerToken = (request?: Request) => {
  const header = request?.headers.get('authorization') || request?.headers.get('Authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

const getAuthenticatedUser = async (request?: Request) => {
  const bearerToken = parseBearerToken(request)
  if (bearerToken) {
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
    const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()
    if (!supabaseUrl || !supabaseAnonKey) return null

    const bearerClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await bearerClient.auth.getUser(bearerToken)
    if (error || !data.user) return null
    return data.user
  }

  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  return data.user || null
}

export const getCurrentUser = async (request?: Request) => {
  const authUser = await getAuthenticatedUser(request)
  if (!authUser) return null

  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle()

  return profile ? { ...authUser, ...profile } : authUser
}

export async function hasPermission(permission: string, request?: Request): Promise<boolean> {
  const user = await getCurrentUser(request)
  if (!user) return false
  const userStatus = String((user as { status?: string }).status || 'active').toLowerCase()
  if (userStatus !== 'active') return false
  
  const role = (user.role as UserRole) || 'staff' // 기본값 staff
  return hasRolePermission(role, permission)
}

export async function requirePermission(permission: string, request?: Request) {
  const allowed = await hasPermission(permission, request)
  if (!allowed) {
    throw new Error(`Unauthorized: Missing permission ${permission}`)
  }
}

