import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

const smokeBypassPaths = new Set([
  '/api/health',
  '/api/health/import-staging',
  '/api/admin/inbound-share',
  '/api/admin/inventory/volume/share',
  '/api/share/inbound',
  '/api/share/inventory',
])

function shouldBypassCiSmoke(request: NextRequest) {
  const smokeBypassToken = (process.env.CI_SMOKE_BYPASS_TOKEN || '').trim()
  if (!smokeBypassToken) return false

  const requestToken = (request.headers.get('x-ci-smoke-bypass') || '').trim()
  if (requestToken !== smokeBypassToken) return false

  return smokeBypassPaths.has(request.nextUrl.pathname)
}

export async function middleware(request: NextRequest) {
  if (shouldBypassCiSmoke(request)) {
    return NextResponse.next()
  }

  return updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
