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

  // 1. getUser는 세션 갱신을 위해 필수 (여기서 JWT 검증 및 갱신 일어남)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  type ProfileWithLocks = {
    status: string | null
    deleted_at: string | null
    locked_until: string | null
    role: string | null
    can_access_admin: boolean | null
  }
  type ProfileBase = {
    status: string | null
    role: string | null
    can_access_admin: boolean | null
  }

  // 프로필 조회 함수 (필요할 때만 호출)
  const getProfileForAccess = async () => {
    const primary = await supabase
      .from('user_profiles')
      .select('status, deleted_at, locked_until, role, can_access_admin')
      .eq('id', user?.id)
      .maybeSingle()

    if (!primary.error) {
      return { profile: primary.data as ProfileWithLocks | null, error: null, supportsLockFields: true }
    }

    if (/column .* does not exist/i.test(primary.error.message)) {
      const fallback = await supabase
        .from('user_profiles')
        .select('status, role, can_access_admin')
        .eq('id', user?.id)
        .maybeSingle()
      return { profile: fallback.data as ProfileBase | null, error: fallback.error, supportsLockFields: false }
    }

    return { profile: primary.data as ProfileWithLocks | null, error: primary.error, supportsLockFields: true }
  }

  const path = request.nextUrl.pathname;

  // 2. API Admin 보호
  if (path.startsWith('/api/admin')) {
    if (!user) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { profile, error, supportsLockFields } = await getProfileForAccess()
    const profileWithLocks = supportsLockFields ? (profile as ProfileWithLocks | null) : null
    const isLocked =
      supportsLockFields &&
      !!profileWithLocks?.locked_until &&
      new Date(profileWithLocks.locked_until).getTime() > Date.now()
    const isDeleted = supportsLockFields && !!profileWithLocks?.deleted_at

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
    
    return supabaseResponse
  }

  // 3. 페이지 접근 제어
  const protectedPaths = [
    '/admin',
    '/dashboard',
    '/inventory', 
    '/inbound',
    '/outbound',
    '/orders',
    '/management',
    '/operations',
    '/settings',
    '/ops',
    '/portal/dashboard',
    '/portal/orders',
    '/portal/inventory',
    '/portal/settings'
  ]

  // 환경변수 체크 예외
  if (path.startsWith('/admin/env-check')) {
    return supabaseResponse
  }

  const isProtectedPath = protectedPaths.some(p => path.startsWith(p))

  // 비로그인 접근 차단
  if (!user && isProtectedPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }

  // 로그인 유저의 상태 체크 (보호된 경로 접근 시)
  if (user && isProtectedPath) {
    const { profile, error, supportsLockFields } = await getProfileForAccess()
    const profileWithLocks = supportsLockFields ? (profile as ProfileWithLocks | null) : null
    const isLocked =
      supportsLockFields &&
      !!profileWithLocks?.locked_until &&
      new Date(profileWithLocks.locked_until).getTime() > Date.now()
    const isDeleted = supportsLockFields && !!profileWithLocks?.deleted_at

    if (error || !profile || isDeleted || profile.status !== 'active' || isLocked) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', 'account_suspended')
      return NextResponse.redirect(url)
    }
    
    // Admin 전용 경로 체크
    const isAdminPath =
      path.startsWith('/admin') ||
      path.startsWith('/users') ||
      path.startsWith('/ops')

    if (isAdminPath && !path.startsWith('/admin/env-check')) {
      if (!profile.can_access_admin && profile.role !== 'admin') {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }
  }

  // 로그인 상태에서 로그인 페이지 접근 시 리다이렉트
  if (user && path === '/login') {
    // 여기서도 상태 체크를 해야 무한 루프나 잠긴 계정의 오동작을 막음
    const { profile, error, supportsLockFields } = await getProfileForAccess()
    const profileWithLocks = supportsLockFields ? (profile as ProfileWithLocks | null) : null
    const isLocked =
      supportsLockFields &&
      !!profileWithLocks?.locked_until &&
      new Date(profileWithLocks.locked_until).getTime() > Date.now()
    const isDeleted = supportsLockFields && !!profileWithLocks?.deleted_at

    if (!error && profile && !isDeleted && profile.status === 'active' && !isLocked) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder content (images, etc)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
