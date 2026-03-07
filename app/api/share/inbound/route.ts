import { NextRequest } from 'next/server';
import { createTrackedAdminClient } from '@/utils/supabase/admin-client';
import { logShareAccessAudit } from '@/lib/shareAudit';
import { verifyPassword } from '@/lib/share';
import { fail, getRouteContext, ok } from '@/lib/api/response';
import { createRequestLogger } from '@/lib/api/request-log';
import {
  clearSharePasswordFailures,
  enforcePublicShareRateLimit,
  ensureSharePasswordBackoff,
  publicShareNotFoundError,
  publicSharePasswordError,
  registerSharePasswordFailure,
} from '@/lib/share/security';

function isExpired(expiresAt?: string | null) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

function getErrorStatus(error: unknown) {
  return error instanceof Error && 'status' in error ? Number((error as any).status) : 500;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '공유 정보를 확인할 수 없습니다.';
}

function getErrorCodeByStatus(status: number) {
  if (status === 400) return 'BAD_REQUEST';
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 404) return 'NOT_FOUND';
  if (status === 410) return 'LINK_EXPIRED';
  if (status === 429) return 'RATE_LIMITED';
  return 'INTERNAL_ERROR';
}

export async function GET(request: NextRequest) {
  const route = 'GET /api/share/inbound';
  const ctx = getRouteContext(request, route);
  const requestLog = createRequestLogger({
    requestId: ctx.requestId,
    route: ctx.route,
    action: 'share_inbound_read',
  });
  try {
    const { searchParams } = new URL(request.url);
    const slug = String(searchParams.get('slug') || '').trim();
    if (!slug) {
      return fail('BAD_REQUEST', 'slug가 필요합니다.', { status: 400, requestId: ctx.requestId });
    }

    await enforcePublicShareRateLimit(request, 'inbound', 'read', slug);

    const db = createTrackedAdminClient({ route: 'share_inbound' });
    const { data, error } = await db
      .from('inbound_receipt_shares')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error || !data) {
      throw publicShareNotFoundError();
    }

    if (isExpired(data.expires_at)) {
      await logShareAccessAudit(request, {
        action: 'VIEW',
        route,
        result: 'denied',
        shareId: data.id,
        slug,
        reason: 'share_expired',
      });
      requestLog.failure({ message: '공유 링크가 만료되었습니다.', status: 410, code: 'LINK_EXPIRED' }, {
        error: '공유 링크가 만료되었습니다.',
        code: 'LINK_EXPIRED',
        status: 410,
      });
      return fail('LINK_EXPIRED', '공유 링크가 만료되었습니다.', { status: 410, requestId: ctx.requestId });
    }

    const requiresPassword = Boolean(data.password_hash && data.password_salt);
    if (requiresPassword) {
      await logShareAccessAudit(request, {
        action: 'VIEW',
        route,
        result: 'success',
        shareId: data.id,
        slug,
        reason: 'share_lookup_success_password_required',
      });
      requestLog.success();
      return ok({
        requiresPassword: true,
        language_default: data.language_default,
        expires_at: data.expires_at,
      }, { requestId: ctx.requestId });
    }

    await db
      .from('inbound_receipt_shares')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', data.id);

    await logShareAccessAudit(request, {
      action: 'VIEW',
      route,
      result: 'success',
      shareId: data.id,
      slug,
      reason: 'share_lookup_success',
    });

    requestLog.success();
    return ok({
      requiresPassword: false,
      share: {
        content: data.content,
        summary_ko: data.summary_ko,
        summary_en: data.summary_en,
        summary_zh: data.summary_zh,
        language_default: data.language_default,
        expires_at: data.expires_at,
      },
    }, { requestId: ctx.requestId });
  } catch (error: unknown) {
    const status = getErrorStatus(error);
    const message = getErrorMessage(error);
    await logShareAccessAudit(request, {
      action: 'VIEW',
      route,
      result: 'denied',
      reason: 'share_lookup_blocked',
    });
    requestLog.failure(error, {
      error: message,
      code: getErrorCodeByStatus(status),
      status,
    });
    return fail(getErrorCodeByStatus(status), message, {
      status,
      requestId: ctx.requestId,
    });
  }
}

export async function POST(request: NextRequest) {
  const route = 'POST /api/share/inbound';
  const ctx = getRouteContext(request, route);
  const requestLog = createRequestLogger({
    requestId: ctx.requestId,
    route: ctx.route,
    action: 'share_inbound_verify',
  });
  try {
    const body = await request.json().catch(() => ({}));
    const slug = String(body?.slug || '').trim();
    const password = String(body?.password || '').trim();
    if (!slug) {
      return fail('BAD_REQUEST', 'slug가 필요합니다.', { status: 400, requestId: ctx.requestId });
    }

    await enforcePublicShareRateLimit(request, 'inbound', 'verify', slug);
    await ensureSharePasswordBackoff(request, 'inbound', slug);

    const db = createTrackedAdminClient({ route: 'share_inbound' });
    const { data, error } = await db
      .from('inbound_receipt_shares')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error || !data) {
      throw publicShareNotFoundError();
    }

    if (isExpired(data.expires_at)) {
      await logShareAccessAudit(request, {
        action: 'VIEW',
        route,
        result: 'denied',
        shareId: data.id,
        slug,
        reason: 'share_expired',
      });
      requestLog.failure({ message: '공유 링크가 만료되었습니다.', status: 410, code: 'LINK_EXPIRED' }, {
        error: '공유 링크가 만료되었습니다.',
        code: 'LINK_EXPIRED',
        status: 410,
      });
      return fail('LINK_EXPIRED', '공유 링크가 만료되었습니다.', { status: 410, requestId: ctx.requestId });
    }

    if (!data.password_hash || !data.password_salt) {
      throw publicSharePasswordError();
    }

    const verified = verifyPassword(password, data.password_salt, data.password_hash);
    if (!verified) {
      const failure = await registerSharePasswordFailure(request, 'inbound', slug);
      await logShareAccessAudit(request, {
        action: 'VIEW',
        route,
        result: 'password-fail',
        shareId: data.id,
        slug,
        reason: `share_password_verification_failed:${failure.failureCount}`,
      });
      throw publicSharePasswordError();
    }

    await clearSharePasswordFailures(request, 'inbound', slug);

    await db
      .from('inbound_receipt_shares')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', data.id);

    await logShareAccessAudit(request, {
      action: 'VIEW',
      route,
      result: 'success',
      shareId: data.id,
      slug,
      reason: 'share_password_verified',
    });

    requestLog.success();
    return ok({
      share: {
        content: data.content,
        summary_ko: data.summary_ko,
        summary_en: data.summary_en,
        summary_zh: data.summary_zh,
        language_default: data.language_default,
        expires_at: data.expires_at,
      },
    }, { requestId: ctx.requestId });
  } catch (error: unknown) {
    const status = getErrorStatus(error);
    const message = getErrorMessage(error);
    requestLog.failure(error, {
      error: message,
      code: getErrorCodeByStatus(status),
      status,
    });
    return fail(getErrorCodeByStatus(status), message, {
      status,
      requestId: ctx.requestId,
    });
  }
}
