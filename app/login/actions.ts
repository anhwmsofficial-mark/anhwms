'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

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
    // 사용자 역할 조회
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', data.user.id)
      .single()

    if (profileError) {
      console.error('Login profile fetch error:', profileError)
      // 프로필 로드 실패 시 파트너 포털로 보내지 말고 에러 처리하거나
      // 안전하게 홈으로 보냄 (관리자 화면 노출 방지)
      return { error: '사용자 권한 정보를 불러올 수 없습니다.' }
    }

    const role = userProfile?.role

    // 명시적인 권한 체크
    if (role === 'partner') {
      redirect('/portal/dashboard')
    } else if (['admin', 'manager', 'staff'].includes(role || '')) {
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
