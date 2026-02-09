import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  // 환경변수가 없을 경우 (빌드 타임 등) 안전하게 처리
  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        supabaseResponse = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const getProfileForAccess = async () => {
    const primary = await supabase
      .from('user_profiles')
      .select('status, deleted_at, locked_until, role, can_access_admin')
      .eq('id', user?.id)
      .maybeSingle()

    if (!primary.error) {
      return { profile: primary.data, error: null, supportsLockFields: true }
    }

    if (/column .* does not exist/i.test(primary.error.message)) {
      const fallback = await supabase
        .from('user_profiles')
        .select('status, role, can_access_admin')
        .eq('id', user?.id)
        .maybeSingle()
      return { profile: fallback.data, error: fallback.error, supportsLockFields: false }
    }

    return { profile: primary.data, error: primary.error, supportsLockFields: true }
  }

  // API Admin 보호 (JSON 응답)
  if (request.nextUrl.pathname.startsWith('/api/admin')) {
    if (!user) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { profile, error, supportsLockFields } = await getProfileForAccess()
    const isLocked =
      supportsLockFields &&
      !!profile?.locked_until &&
      new Date(profile.locked_until).getTime() > Date.now()
    const isDeleted = supportsLockFields && !!profile?.deleted_at

    if (!profile || error || isDeleted || profile.status !== 'active' || isLocked) {
      return new NextResponse(JSON.stringify({ error: 'Account not active' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!profile.can_access_admin && profile.role !== 'admin') {
      return new NextResponse(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  // 보호해야 할 경로 목록 (이 외에는 모두 공개)
  const protectedPaths = [
    '/admin',
    '/dashboard',
    '/inventory', 
    '/inbound',
    '/outbound',
    '/orders', // 파트너 포털의 /portal/orders와 겹치지 않게 주의 (/orders는 admin용)
    '/management',
    '/operations',
    '/settings',
    '/ops',
    '/portal/dashboard', // 파트너 포털 내부도 보호
    '/portal/orders',
    '/portal/inventory',
    '/portal/settings'
  ]

  // 환경변수 체크 페이지는 예외 처리
  if (request.nextUrl.pathname.startsWith('/admin/env-check')) {
    return supabaseResponse
  }

  const isProtectedPath = protectedPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  )

  // 보호된 경로에 비로그인 접근 시 로그인 페이지로 이동
  if (!user && isProtectedPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', request.nextUrl.pathname) // 로그인 후 원래 페이지로 돌아가기 위함
    return NextResponse.redirect(url)
  }

  // 보호된 경로는 계정 상태 확인
  if (user && isProtectedPath) {
    const { profile, error, supportsLockFields } = await getProfileForAccess()
    const isLocked =
      supportsLockFields &&
      !!profile?.locked_until &&
      new Date(profile.locked_until).getTime() > Date.now()
    const isDeleted = supportsLockFields && !!profile?.deleted_at

    if (error || !profile || isDeleted || profile.status !== 'active' || isLocked) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', 'account_suspended')
      return NextResponse.redirect(url)
    }
  }

  if (user) {
    const isAdminPath =
      request.nextUrl.pathname.startsWith('/admin') ||
      request.nextUrl.pathname.startsWith('/users') ||
      request.nextUrl.pathname.startsWith('/ops')

    if (isAdminPath && !request.nextUrl.pathname.startsWith('/admin/env-check')) {
      const { profile, error, supportsLockFields } = await getProfileForAccess()
      const isLocked =
        supportsLockFields &&
        !!profile?.locked_until &&
        new Date(profile.locked_until).getTime() > Date.now()
      const isDeleted = supportsLockFields && !!profile?.deleted_at

      if (error || !profile || isDeleted || profile.status !== 'active' || isLocked) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set('error', 'account_suspended')
        return NextResponse.redirect(url)
      }

      if (!profile.can_access_admin && profile.role !== 'admin') {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }
  }

  // 로그인 상태에서 루트(/)나 로그인(/login) 접근 시
  if (user) {
    // 1. 로그인 페이지 접근 시 유효한 계정만 대시보드로 이동
    if (request.nextUrl.pathname === '/login') {
      const { profile, error, supportsLockFields } = await getProfileForAccess()
      const isLocked =
        supportsLockFields &&
        !!profile?.locked_until &&
        new Date(profile.locked_until).getTime() > Date.now()
      const isDeleted = supportsLockFields && !!profile?.deleted_at

      if (!error && profile && !isDeleted && profile.status === 'active' && !isLocked) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}
