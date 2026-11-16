import { NextRequest } from 'next/server';
import { ensurePermission } from '@/lib/actions/auth';
import { fail } from '@/lib/api/response';
import { logActivity } from '@/lib/audit-logger';
import { SMARTSTORE_DETAIL_PERMISSION } from '@/lib/auth/permissions';
import { createClient } from '@/utils/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CommerceCredentialsError } from './naver';
import { PublishLimitError } from './apply';
import { SmartstoreSchemaError } from './repository';
import type { AuditWriter } from './service';

export async function guardSmartstoreDetail(request: NextRequest, route: string) {
  const permission = await ensurePermission(SMARTSTORE_DETAIL_PERMISSION, request);
  if (!permission.ok) {
    return {
      error: fail(permission.code || 'FORBIDDEN', permission.error, { status: permission.status || 403 }),
      actorId: null,
      audit: null as AuditWriter | null,
    };
  }
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return {
      error: fail('UNAUTHORIZED', '인증이 필요합니다.', { status: 401 }),
      actorId: null,
      audit: null,
    };
  }
  const audit: AuditWriter = async (entry) => {
    await logActivity(userClient as unknown as SupabaseClient, {
      action: entry.action,
      entityType: 'SMARTSTORE_DETAIL',
      entityId: entry.entityId,
      metadata: entry.metadata,
      route,
      requestId: request.headers.get('x-request-id'),
    });
  };
  return { error: null, actorId: user.id, audit };
}

export function smartstoreErrorResponse(error: unknown) {
  if (error instanceof SmartstoreSchemaError) {
    return fail('SCHEMA_MISMATCH', error.message, { status: 503 });
  }
  if (error instanceof CommerceCredentialsError) {
    return fail('CONFLICT', error.message, { status: 409 });
  }
  if (error instanceof PublishLimitError) {
    return fail('CONFLICT', error.message, { status: 409 });
  }
  const message = error instanceof Error ? error.message : '요청을 처리하지 못했습니다.';
  const status = message.includes('숫자') || message.includes('없습니다') || message.includes('중복') || message.includes('30')
    ? 400
    : 500;
  return fail(status === 400 ? 'BAD_REQUEST' : 'INTERNAL_ERROR', message, { status });
}
