import { createClient } from '@/utils/supabase/server'
import { cache } from 'react'

export type UserRole = 'admin' | 'manager' | 'staff' | 'partner'

// 역할별 권한 정의
const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ['*'],
  manager: [
    'view:dashboard', 
    'manage:products', 'manage:inventory', 
    'manage:orders', 'view:customers',
    'view:reports',
    'inventory:count', 'inventory:adjust'
  ],
  staff: [
    'view:dashboard',
    'view:products', 'update:inventory',
    'view:orders', 'update:order_status',
    'view:tasks', 'update:tasks',
    'inventory:count'
  ],
  partner: [
    'view:own_dashboard',
    'view:own_products',
    'view:own_orders', 'create:own_orders',
    'view:own_inventory'
  ]
}

export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // user_profiles 테이블 조회 (혹은 users 테이블)
  // 마이그레이션 스크립트에서는 'users' 테이블을 사용하도록 정의함
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  return profile ? { ...user, ...profile } : user
})

export async function hasPermission(permission: string): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user) return false
  
  const role = (user.role as UserRole) || 'staff' // 기본값 staff
  const permissions = ROLE_PERMISSIONS[role] || []

  if (permissions.includes('*')) return true
  
  // 정확히 일치하거나 와일드카드 매칭 (예: manage:*)
  return permissions.some(p => {
    if (p === permission) return true
    if (p.endsWith(':*')) {
      const scope = p.split(':')[0]
      return permission.startsWith(`${scope}:`)
    }
    return false
  })
}

export async function requirePermission(permission: string) {
  const allowed = await hasPermission(permission)
  if (!allowed) {
    throw new Error(`Unauthorized: Missing permission ${permission}`)
  }
}

