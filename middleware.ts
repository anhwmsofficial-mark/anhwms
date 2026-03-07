import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

const smokeBypassPaths = new Set([
  '/api/health',
  '/api/health/import-staging',
  '/api/admin/inbound-share',
  '/api/admin/inventory/volume/share',
  '/api/share/inbound',
  '/api/share/inventory',
  '/api/share/inbound/download', // Added based on typical usage
  '/api/share/inventory/download', // Fixed typo in previous list if any
  '/api/admin/inventory/volume/download', // Added based on lint command
])

function shouldBypassCiSmoke(request: NextRequest) {
  const smokeBypassToken = (process.env.CI_SMOKE_BYPASS_TOKEN || '').trim()
  if (!smokeBypassToken) return false

  const requestToken = (request.headers.get('x-ci-smoke-bypass') || '').trim()
  if (requestToken !== smokeBypassToken) return false

  return smokeBypassPaths.has(request.nextUrl.pathname)
}

export async function middleware(request: NextRequest) {
  // 1. Request ID Generation
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
  request.headers.set('x-request-id', requestId)

  if (shouldBypassCiSmoke(request)) {
    const response = NextResponse.next()
    response.headers.set('x-request-id', requestId)
    return response
  }

  const response = await updateSession(request)
  
  // Ensure response exists (updateSession might return it)
  if (response) {
    response.headers.set('x-request-id', requestId)
  }
  
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
