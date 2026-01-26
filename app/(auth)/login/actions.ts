'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function login(formData: FormData) {
  const supabase = await createClient()

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
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle()

      if (profileError) {
        console.error('Login profile fetch error (user_profiles):', profileError)
      }
      role = profile?.role || null

      // fallback: users 테이블 확인
      if (!role) {
        const { data: legacyProfile, error: legacyError } = await supabaseAdmin
          .from('users')
          .select('role')
          .eq('id', userId)
          .maybeSingle()
        if (legacyError) {
          console.error('Login profile fetch error (users):', legacyError)
        }
        role = legacyProfile?.role || null
      }

      // 프로필이 없다면 기본 프로필 생성
      if (!role) {
        const username = data.user.email?.split('@')[0] || 'user'
        await supabaseAdmin.from('users').upsert({
          id: userId,
          email: data.user.email,
          username,
          role: 'staff',
          status: 'active',
        })
        await supabaseAdmin.from('user_profiles').upsert({
          id: userId,
          email: data.user.email,
          full_name: data.user.user_metadata?.full_name || data.user.email,
          display_name: data.user.user_metadata?.display_name || username,
          role: 'viewer',
          status: 'active',
        })
        role = 'staff'
      }
    } catch (err) {
      console.error('Login role resolution error:', err)
      return { error: '사용자 권한 정보를 불러올 수 없습니다.' }
    }

    // 명시적인 권한 체크
    if (role === 'partner') {
      redirect('/portal/dashboard')
    } else if (['admin', 'manager', 'staff', 'operator'].includes(role || '')) {
      // operator는 내부적으로 staff로 간주
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
