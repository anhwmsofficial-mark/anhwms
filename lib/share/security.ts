import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { AppApiError } from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import { createTrackedAdminClient } from '@/utils/supabase/admin-client';

type ShareKind = 'inbound' | 'inventory';
type ShareRateLimitAction = 'read' | 'verify' | 'download' | 'password-fail';
type ActorKeyType = 'ip' | 'anonymous';

type RateLimitRow = {
  request_count: number;
  window_end: string;
};

type FailureWindowRow = {
  request_count: number;
  updated_at: string | null;
  window_end: string;
};

const GENERIC_NOT_FOUND_MESSAGE = '공유 정보를 확인할 수 없습니다.';
const GENERIC_PASSWORD_FAILURE_MESSAGE = '공유 정보를 확인할 수 없습니다.';

function extractClientIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || null;
  }
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-client-ip') ||
    null
  );
}

function sanitizeRateLimitKey(value: string) {
  return value.replace(/[^a-zA-Z0-9:_-]/g, '_').slice(0, 240);
}

function getRateLimitActor(request: Request): { actorKey: string; actorKeyType: ActorKeyType } {
  const ip = extractClientIp(request);
  if (!ip) {
    return {
      actorKey: 'share:anonymous',
      actorKeyType: 'anonymous',
    };
  }

  return {
    actorKey: sanitizeRateLimitKey(`share:ip:${ip}`),
    actorKeyType: 'ip',
  };
}

function getScopedLimit(action: ShareRateLimitAction) {
  switch (action) {
    case 'read':
      return { limit: 30, windowSeconds: 60 };
    case 'verify':
      return { limit: 12, windowSeconds: 300 };
    case 'download':
      return { limit: 10, windowSeconds: 300 };
    case 'password-fail':
      return { limit: 20, windowSeconds: 3600 };
    default:
      return { limit: 10, windowSeconds: 300 };
  }
}

function buildScope(kind: ShareKind, action: ShareRateLimitAction, shareKey: string) {
  return sanitizeRateLimitKey(`share:${kind}:${action}:${shareKey}`);
}

function getBackoffSeconds(failureCount: number) {
  if (failureCount >= 8) return 30 * 60;
  if (failureCount >= 6) return 10 * 60;
  if (failureCount >= 4) return 5 * 60;
  if (failureCount >= 3) return 60;
  return 0;
}

async function bumpScopedCounter(
  db: SupabaseClient,
  scope: string,
  actorKey: string,
  actorKeyType: ActorKeyType,
  windowSeconds: number,
) {
  const { data, error } = await db.rpc('bump_api_rate_limit', {
    p_scope: scope,
    p_actor_key: actorKey,
    p_actor_key_type: actorKeyType,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    throw new AppApiError({
      error: '요청 제한 상태를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.',
      code: 'RATE_LIMIT_UNAVAILABLE',
      status: 503,
    });
  }

  const row = (Array.isArray(data) ? data[0] : data) as RateLimitRow | null;
  const requestCount = Number(row?.request_count || 1);
  const windowEnd = row?.window_end ? Date.parse(row.window_end) : Date.now() + windowSeconds * 1000;
  const retryAfterSeconds = Math.max(1, Math.ceil((windowEnd - Date.now()) / 1000));

  return {
    requestCount,
    retryAfterSeconds,
  };
}

async function getFailureWindow(db: SupabaseClient, scope: string, actorKey: string) {
  const { data, error } = await db
    .from('api_rate_limits')
    .select('request_count, updated_at, window_end')
    .eq('scope', scope)
    .eq('actor_key', actorKey)
    .order('window_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AppApiError({
      error: '요청 제한 상태를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.',
      code: 'RATE_LIMIT_UNAVAILABLE',
      status: 503,
    });
  }

  return (data as FailureWindowRow | null) || null;
}

export async function enforcePublicShareRateLimit(
  request: Request,
  kind: ShareKind,
  action: Exclude<ShareRateLimitAction, 'password-fail'>,
  shareKey: string,
) {
  const db = createTrackedAdminClient({ route: 'share_security' }) as unknown as SupabaseClient;
  const { actorKey, actorKeyType } = getRateLimitActor(request);
  const { limit, windowSeconds } = getScopedLimit(action);
  const scope = buildScope(kind, action, shareKey);
  const result = await bumpScopedCounter(db, scope, actorKey, actorKeyType, windowSeconds);

  if (result.requestCount > limit) {
    logger.warn('Public share rate limit exceeded', {
      scope: 'share',
      kind,
      action,
      shareKey,
      actorKeyType,
      retryAfterSeconds: result.retryAfterSeconds,
    });
    throw new AppApiError({
      error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
      code: 'RATE_LIMITED',
      status: 429,
      details: { retryAfterSeconds: result.retryAfterSeconds },
    });
  }
}

export async function ensureSharePasswordBackoff(
  request: Request,
  kind: ShareKind,
  shareKey: string,
) {
  const db = createTrackedAdminClient({ route: 'share_security' }) as unknown as SupabaseClient;
  const { actorKey } = getRateLimitActor(request);
  const scope = buildScope(kind, 'password-fail', shareKey);
  const failureRow = await getFailureWindow(db, scope, actorKey);

  if (!failureRow?.updated_at) {
    return;
  }

  const failureCount = Number(failureRow.request_count || 0);
  const backoffSeconds = getBackoffSeconds(failureCount);
  if (backoffSeconds <= 0) {
    return;
  }

  const lockedUntil = Date.parse(failureRow.updated_at) + backoffSeconds * 1000;
  const retryAfterSeconds = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
  if (retryAfterSeconds <= 0) {
    return;
  }

  logger.warn('Public share password temporarily locked', {
    scope: 'share',
    kind,
    shareKey,
    failureCount,
    retryAfterSeconds,
  });

  throw new AppApiError({
    error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    code: 'RATE_LIMITED',
    status: 429,
    details: { retryAfterSeconds, locked: true },
  });
}

export async function registerSharePasswordFailure(
  request: Request,
  kind: ShareKind,
  shareKey: string,
) {
  const db = createTrackedAdminClient({ route: 'share_security' }) as unknown as SupabaseClient;
  const { actorKey, actorKeyType } = getRateLimitActor(request);
  const { windowSeconds } = getScopedLimit('password-fail');
  const scope = buildScope(kind, 'password-fail', shareKey);
  const result = await bumpScopedCounter(db, scope, actorKey, actorKeyType, windowSeconds);
  const failureCount = result.requestCount;
  const backoffSeconds = getBackoffSeconds(failureCount);

  logger.warn('Public share password verification failed', {
    scope: 'share',
    kind,
    shareKey,
    failureCount,
    backoffSeconds,
  });

  return {
    failureCount,
    backoffSeconds,
  };
}

export async function clearSharePasswordFailures(
  request: Request,
  kind: ShareKind,
  shareKey: string,
) {
  const db = createTrackedAdminClient({ route: 'share_security' }) as unknown as SupabaseClient;
  const { actorKey } = getRateLimitActor(request);
  const scope = buildScope(kind, 'password-fail', shareKey);

  const { error } = await db.from('api_rate_limits').delete().eq('scope', scope).eq('actor_key', actorKey);
  if (error) {
    logger.warn('Failed to clear share password failures', {
      scope: 'share',
      kind,
      shareKey,
      error: error.message,
    });
  }
}

export function publicShareNotFoundError() {
  return new AppApiError({
    error: GENERIC_NOT_FOUND_MESSAGE,
    code: 'NOT_FOUND',
    status: 404,
  });
}

export function publicSharePasswordError() {
  return new AppApiError({
    error: GENERIC_PASSWORD_FAILURE_MESSAGE,
    code: 'UNAUTHORIZED',
    status: 401,
  });
}
