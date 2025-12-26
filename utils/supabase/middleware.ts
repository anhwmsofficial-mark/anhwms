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
        cookiesToSet.forEach(({ name, value, options }) =>
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
    '/portal/dashboard', // 파트너 포털 내부도 보호
    '/portal/orders',
    '/portal/inventory',
    '/portal/settings'
  ]

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

  // 로그인 상태에서 루트(/)나 로그인(/login) 접근 시
  if (user) {
    // 1. 로그인 페이지 접근 시 대시보드로 이동
    if (request.nextUrl.pathname === '/login') {
      // 사용자 권한 확인 (쿠키나 메타데이터 활용) - 여기서는 간단히 처리
      // 실제로는 users 테이블 조회해서 admin이면 /admin/dashboard, partner면 /portal/dashboard로 보내야 함
      // 미들웨어에서 DB 조회를 최소화하기 위해, 로그인 시 쿠키에 role을 저장하거나 여기서 간단히 분기
      
      // 일단 기본 대시보드로 이동 (로그인 페이지의 리다이렉트 로직이 더 정확할 수 있음)
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard' 
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
