'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

type LoginProfile = {
  role: string | null
  status: string | null
  deleted_at?: string | null
  locked_until?: string | null
}

function isLoginProfileActive(profile: LoginProfile | null | undefined) {
  if (!profile) return false
  const isLocked =
    !!profile.locked_until && new Date(profile.locked_until).getTime() > Date.now()
  return profile.status === 'active' && !profile.deleted_at && !isLocked
}

export async function login(formData: FormData) {
  const supabase = await createClient()
  const db = supabaseAdmin as any

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  if (data.user) {
    const userId = data.user.id

    // 사용자 역할 조회 (RLS 우회)
    let role: string | null = null
    try {
      const { data: profile, error: profileError } = await db
        .from('user_profiles')
        .select('role,status,deleted_at,locked_until')
        .eq('id', userId)
        .maybeSingle()

      if (profileError) {
        console.error('Login profile fetch error (user_profiles):', profileError)
      }
      role = profile?.role || null

      if (profile && !isLoginProfileActive(profile)) {
        await supabase.auth.signOut()
        return { error: '비활성화되었거나 잠긴 계정입니다. 관리자에게 문의하세요.' }
      }

      // 프로필이 없다면 기본 프로필 생성
      if (!role) {
        const username = data.user.email?.split('@')[0] || 'user'
        const metadataOrgId =
          typeof data.user.user_metadata?.org_id === 'string'
            ? (data.user.user_metadata.org_id as string)
            : null
        let resolvedOrgId = metadataOrgId
        if (!resolvedOrgId) {
          const { data: defaultOrg } = await db
            .from('org')
            .select('id')
            .limit(1)
            .maybeSingle()
          resolvedOrgId = defaultOrg?.id || null
        }
        await db.from('user_profiles').upsert({
          id: userId,
          email: data.user.email,
          full_name: data.user.user_metadata?.full_name || data.user.email,
          display_name: data.user.user_metadata?.display_name || username,
          org_id: resolvedOrgId,
          role: 'viewer',
          can_access_admin: false,
          can_access_dashboard: true,
          can_manage_users: false,
          can_manage_inventory: false,
          can_manage_orders: false,
          status: 'active',
        })
        role = 'viewer'
      }

      await db
        .from('user_profiles')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', userId)
    } catch (err) {
      console.error('Login role resolution error:', err)
      return { error: '사용자 권한 정보를 불러올 수 없습니다.' }
    }

    // 명시적인 권한 체크
    if (role === 'partner') {
      redirect('/portal/dashboard')
    } else if (['admin', 'manager', 'operator', 'viewer', 'staff'].includes(role || '')) {
      redirect('/dashboard')
    } else {
      // 권한이 없는 경우 (일반 유저 등)
      // 관리자 화면으로 보내면 안됨 -> 파트너 포털이나 대기 화면으로
      console.warn(`User ${data.user.email} has no role: ${role}`)
      redirect('/portal/dashboard') // 기본값 변경 (보안상 더 안전)
    }
  }

  revalidatePath('/', 'layout')
  redirect('/login') // 실패 시 로그인 페이지 유지
}
