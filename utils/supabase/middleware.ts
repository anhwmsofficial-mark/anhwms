import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { canAccessAdmin, isActiveProfile } from '@/lib/auth/accessPolicy'

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
    data: { user: cookieUser },
  } = await supabase.auth.getUser()
  const bearerHeader = request.headers.get('authorization') || request.headers.get('Authorization') || ''
  const bearerToken = bearerHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || null
  let user = cookieUser
  const bearerDb =
    bearerToken
      ? createSupabaseClient(supabaseUrl, supabaseKey, {
          global: {
            headers: {
              Authorization: `Bearer ${bearerToken}`,
            },
          },
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        })
      : null
  if (!user && bearerToken) {
    const { data: bearerData } = await supabase.auth.getUser(bearerToken)
    user = bearerData.user || null
  }

  type ProfileWithLocks = {
    status: string | null
    deleted_at: string | null
    locked_until: string | null
    role: string | null
    can_access_admin: boolean | null
  }
  const schemaMismatchCode = 'SCHEMA_MISMATCH'

  const getMissingColumn = (message: string) => {
    const match = message.match(/column\s+["']?([a-zA-Z0-9_]+)["']?\s+does not exist/i)
    return match?.[1] ?? null
  }

  // 프로필 조회 함수 (필요할 때만 호출)
  const getProfileForAccess = async () => {
    const profileDb = bearerDb ?? supabase
    const primary = await profileDb
      .from('user_profiles')
      .select('status, deleted_at, locked_until, role, can_access_admin')
      .eq('id', user?.id)
      .maybeSingle()

    if (!primary.error) {
      return { profile: primary.data as ProfileWithLocks | null, error: null, supportsLockFields: true }
    }

    if (/column .* does not exist/i.test(primary.error.message)) {
      const missingColumn = getMissingColumn(primary.error.message)
      const schemaError = new Error(`${schemaMismatchCode}: user_profiles.${missingColumn || 'unknown'}`)
      console.error(schemaMismatchCode, {
        route: request.nextUrl.pathname,
        query_target: 'user_profiles',
        missing_column: missingColumn,
        message: primary.error.message,
      })
      return { profile: null, error: schemaError, supportsLockFields: true }
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
    if (error && error.message.includes(schemaMismatchCode)) {
      return new NextResponse(
        JSON.stringify({ code: schemaMismatchCode, error: 'DB 스키마 불일치가 감지되었습니다. 마이그레이션 상태를 확인하세요.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
    const profileWithLocks = supportsLockFields ? (profile as ProfileWithLocks | null) : null
    const isActive = isActiveProfile(profileWithLocks)
    if (!profile || error || !isActive) {
      return new NextResponse(JSON.stringify({ error: 'Account not active' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!canAccessAdmin(profileWithLocks)) {
      return new NextResponse(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    
    return supabaseResponse
  }

  // 2-1. 비공개 API 기본 보호 (admin 외 경로)
  if (path.startsWith('/api/')) {
    const publicApiPrefixes = [
      '/api/external-quote',
      '/api/international-quote',
      '/api/quote/calculate',
      '/api/products/search',
      '/api/share/inbound',
      '/api/share/inventory',
      '/api/share/inventory/download',
      '/api/share/translate',
    ]
    const isPublicApi = publicApiPrefixes.some((prefix) => path.startsWith(prefix))
    if (!isPublicApi && !user) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
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
    if (error && error.message.includes(schemaMismatchCode)) {
      return new NextResponse('DB schema mismatch detected. Please run migrations.', { status: 500 })
    }
    const profileWithLocks = supportsLockFields ? (profile as ProfileWithLocks | null) : null
    const isActive = isActiveProfile(profileWithLocks)
    if (error || !profile || !isActive) {
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
      if (!canAccessAdmin(profileWithLocks)) {
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
    if (error && error.message.includes(schemaMismatchCode)) {
      return new NextResponse('DB schema mismatch detected. Please run migrations.', { status: 500 })
    }
    const profileWithLocks = supportsLockFields ? (profile as ProfileWithLocks | null) : null
    if (!error && isActiveProfile(profileWithLocks)) {
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
