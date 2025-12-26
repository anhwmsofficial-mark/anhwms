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

  // 로그인 성공 후 역할(Role) 확인하여 리다이렉트 경로 결정
  if (data.user) {
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', data.user.id)
      .single()

    const role = userProfile?.role

    if (role === 'partner') {
      redirect('/portal/dashboard')
    } else if (role === 'admin' || role === 'manager' || role === 'staff') {
      redirect('/dashboard') // 또는 /admin/dashboard
    } else {
      // 역할이 없거나 알 수 없는 경우 기본 대시보드로
      redirect('/dashboard')
    }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
