import 'server-only';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { logger } from '@/lib/logger';
import { createClient } from '@/utils/supabase/server';

type ActorKeyType = 'user' | 'bearer' | 'ip' | 'anonymous';

type RateLimitInput = {
  request: Request;
  scope: string;
  limit: number;
  windowSeconds: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
  actorKeyType: ActorKeyType;
  headers: Record<string, string>;
};

type BumpRateLimitRow = {
  request_count: number;
  window_start: string;
  window_end: string;
};

function parseBearerToken(request: Request) {
  const header =
    request.headers.get('authorization') || request.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function decodeJwtSub(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
      sub?: string;
    };
    return payload.sub || null;
  } catch {
    return null;
  }
}

function extractClientIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-client-ip') ||
    null
  );
}

function toSafeActorKey(value: string, prefix: string) {
  const trimmed = value.trim();
  if (!trimmed) return `${prefix}:unknown`;
  return `${prefix}:${trimmed}`.slice(0, 240);
}

async function resolveActorKey(request: Request): Promise<{ actorKey: string; actorKeyType: ActorKeyType }> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id || null;
    if (userId) {
      return { actorKey: toSafeActorKey(userId, 'user'), actorKeyType: 'user' };
    }
  } catch {
    // 인증 컨텍스트가 없어도 fallback으로 진행
  }

  const bearer = parseBearerToken(request);
  if (bearer) {
    const sub = decodeJwtSub(bearer);
    if (sub) {
      return { actorKey: toSafeActorKey(sub, 'bearer'), actorKeyType: 'bearer' };
    }
  }

  const ip = extractClientIp(request);
  if (ip) {
    return { actorKey: toSafeActorKey(ip, 'ip'), actorKeyType: 'ip' };
  }

  return { actorKey: 'anonymous:unknown', actorKeyType: 'anonymous' };
}

function buildRateLimitHeaders(result: {
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}) {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.resetAt),
    'Retry-After': String(result.retryAfterSeconds),
  };
}

export async function enforceRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  const { request, scope, limit, windowSeconds } = input;
  const nowMs = Date.now();
  const { actorKey, actorKeyType } = await resolveActorKey(request);

  const { data, error } = await supabaseAdmin.rpc('bump_api_rate_limit', {
    p_scope: scope,
    p_actor_key: actorKey,
    p_actor_key_type: actorKeyType,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    logger.error(error, {
      scope: 'rateLimit',
      action: 'bump_api_rate_limit',
      rateLimitScope: scope,
      actorKeyType,
    });
    // 레이트리밋 장애는 요청 자체를 막지 않고 fail-open 처리
    const fallbackReset = Math.floor((nowMs + windowSeconds * 1000) / 1000);
    return {
      allowed: true,
      limit,
      remaining: limit,
      resetAt: fallbackReset,
      retryAfterSeconds: windowSeconds,
      actorKeyType,
      headers: buildRateLimitHeaders({
        limit,
        remaining: limit,
        resetAt: fallbackReset,
        retryAfterSeconds: windowSeconds,
      }),
    };
  }

  const row = (Array.isArray(data) ? data[0] : data) as BumpRateLimitRow | null;
  const currentCount = Number(row?.request_count || 1);
  const windowEndMs = row?.window_end ? Date.parse(row.window_end) : nowMs + windowSeconds * 1000;
  const resetAt = Math.floor(windowEndMs / 1000);
  const retryAfterSeconds = Math.max(1, Math.ceil((windowEndMs - nowMs) / 1000));
  const remaining = Math.max(0, limit - currentCount);
  const allowed = currentCount <= limit;

  return {
    allowed,
    limit,
    remaining,
    resetAt,
    retryAfterSeconds,
    actorKeyType,
    headers: buildRateLimitHeaders({
      limit,
      remaining,
      resetAt,
      retryAfterSeconds,
    }),
  };
}
