import { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppApiError, toAppApiError } from '@/lib/api/errors';
import { fail, getRouteContext, ok } from '@/lib/api/response';
import { createRequestLogger } from '@/lib/api/request-log';
import { requireAdminRouteContext, assertReceiptBelongsToOrg } from '@/lib/server/admin-ownership';
import { generateSlug, hashPassword } from '@/lib/share';
import { logAudit } from '@/utils/audit';

function normalizeShareCreateError(error: { message?: string } | null | undefined) {
  const message = (error?.message || '').toLowerCase();
  if (!message) return '공유 링크 생성 중 알 수 없는 오류가 발생했습니다.';
  if (message.includes('violates foreign key constraint')) {
    return '대상 인수증을 찾을 수 없습니다. 화면을 새로고침 후 다시 시도해 주세요.';
  }
  if (message.includes('duplicate key') && message.includes('slug')) {
    return '공유 토큰 충돌이 발생했습니다. 다시 시도해 주세요.';
  }
  if (message.includes('permission denied') || message.includes('row-level security')) {
    return '공유 권한이 없어 링크를 생성할 수 없습니다. 관리자에게 문의해 주세요.';
  }
  if (message.includes('schema cache')) {
    return 'DB 스키마 캐시가 아직 반영되지 않았습니다. 잠시 후 다시 시도해 주세요.';
  }
  return error?.message || '공유 링크 생성에 실패했습니다.';
}

function isSlugDuplicateError(error: { message?: string } | null | undefined) {
  const message = (error?.message || '').toLowerCase();
  return message.includes('duplicate key') && message.includes('slug');
}

async function ensureUniqueSlug(db: SupabaseClient, length = 7) {
  for (let i = 0; i < 6; i += 1) {
    const slug = generateSlug(length);
    const { data } = await db
      .from('inbound_receipt_shares')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!data) return slug;
  }
  return generateSlug(length + 1);
}

async function loadOwnedShare(db: SupabaseClient, shareId: string, orgId: string) {
  const { data, error } = await db
    .from('inbound_receipt_shares')
    .select('*')
    .eq('id', shareId)
    .maybeSingle();

  if (error) {
    throw new AppApiError({ error: error.message, code: 'INTERNAL_ERROR', status: 500 });
  }
  if (!data?.receipt_id) {
    throw new AppApiError({ error: '공유 링크를 찾을 수 없습니다.', code: 'NOT_FOUND', status: 404 });
  }

  await assertReceiptBelongsToOrg(db, String(data.receipt_id), orgId);
  return data as Record<string, any>;
}

export async function GET(request: NextRequest) {
  const ctx = getRouteContext(request, 'GET /api/admin/inbound-share');
  let actor: string | null = null;
  let tenantId: string | null = null;
  const requestLog = createRequestLogger({
    requestId: ctx.requestId,
    route: ctx.route,
    action: 'inbound_share_list',
  });

  try {
    const { db, orgId, userId } = await requireAdminRouteContext('manage:orders', request);
    actor = userId;
    const { searchParams } = new URL(request.url);
    const receiptId = String(searchParams.get('receipt_id') || '').trim();
    if (!receiptId) {
      throw new AppApiError({ error: 'receipt_id가 필요합니다.', code: 'BAD_REQUEST', status: 400 });
    }

    const receipt = await assertReceiptBelongsToOrg(db, receiptId, orgId);
    tenantId = String(receipt.org_id || orgId || '');

    const { data, error } = await db
      .from('inbound_receipt_shares')
      .select('*')
      .eq('receipt_id', receiptId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new AppApiError({ error: error.message, code: 'INTERNAL_ERROR', status: 500 });
    }

    requestLog.success({ actor, tenantId });
    return ok(
      (data || []).map((row: any) => ({
        ...row,
        has_password: Boolean(row.password_hash && row.password_salt),
        password_hash: undefined,
        password_salt: undefined,
      })),
      { requestId: ctx.requestId },
    );
  } catch (error: unknown) {
    const apiError = toAppApiError(error, { error: '공유 링크 조회에 실패했습니다.', code: 'INTERNAL_ERROR', status: 500 });
    requestLog.failure(apiError, { error: '공유 링크 조회에 실패했습니다.', code: 'INTERNAL_ERROR', status: 500 }, { actor, tenantId });
    return fail(apiError.code || 'INTERNAL_ERROR', apiError.message, {
      status: apiError.status,
      requestId: ctx.requestId,
      details: apiError.details,
    });
  }
}

export async function POST(request: NextRequest) {
  const ctx = getRouteContext(request, 'POST /api/admin/inbound-share');
  let actor: string | null = null;
  let tenantId: string | null = null;
  const requestLog = createRequestLogger({
    requestId: ctx.requestId,
    route: ctx.route,
    action: 'inbound_share_create',
  });

  try {
    const { db, userId, orgId } = await requireAdminRouteContext('manage:orders', request);
    actor = userId;
    const body = await request.json().catch(() => ({}));
    const receiptId = String(body?.receipt_id || '').trim();
    if (!receiptId) {
      throw new AppApiError({ error: 'receipt_id가 필요합니다.', code: 'BAD_REQUEST', status: 400 });
    }

    const receipt = await assertReceiptBelongsToOrg(db, receiptId, orgId);
    tenantId = String(receipt.org_id || orgId || '');

    const password = (body?.password || '').trim();
    const passwordData = password ? hashPassword(password) : null;

    let createdData: Record<string, any> | null = null;
    let createdSlug = '';
    let lastError: { message?: string } | null = null;

    // Handle rare race conditions where slug can collide under concurrency.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const slug = await ensureUniqueSlug(db);
      const payload = {
        receipt_id: receiptId,
        org_id: receipt.org_id,
        tenant_id: receipt.org_id,
        slug,
        expires_at: body?.expires_at ?? null,
        password_salt: passwordData?.salt ?? null,
        password_hash: passwordData?.hash ?? null,
        language_default: body?.language_default ?? 'ko',
        summary_ko: body?.summary_ko ?? null,
        summary_en: body?.summary_en ?? null,
        summary_zh: body?.summary_zh ?? null,
        content: body?.content ?? {},
        created_by: userId,
      };

      const { data, error } = await db
        .from('inbound_receipt_shares')
        .insert(payload)
        .select('*')
        .single();
      if (!error) {
        createdData = data;
        createdSlug = slug;
        break;
      }
      lastError = error as any;
      if (!isSlugDuplicateError(error)) break;
    }

    if (!createdData || !createdSlug) {
      const safeMessage = normalizeShareCreateError(lastError);
      requestLog.failure(lastError, {
        error: safeMessage,
        code: 'INBOUND_SHARE_CREATE_FAILED',
        status: 500,
      }, { actor, tenantId });
      return fail('INBOUND_SHARE_CREATE_FAILED', safeMessage, { status: 500, requestId: ctx.requestId });
    }

    await logAudit({
      actionType: 'CREATE',
      resourceType: 'orders',
      resourceId: String(createdData.id || createdSlug),
      newValue: { receipt_id: receiptId, slug: createdSlug, expires_at: createdData.expires_at },
      reason: 'Inbound share created',
    });

    let shareBaseUrl = 'https://www.anhwms.com';
    const configuredSiteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').trim();
    if (configuredSiteUrl) {
      try {
        // Normalize to origin to prevent accidental path prefixes (e.g. "/inbound").
        shareBaseUrl = new URL(configuredSiteUrl).origin;
      } catch {
        shareBaseUrl = 'https://www.anhwms.com';
      }
    } else {
      shareBaseUrl = new URL(request.url).origin;
    }

    requestLog.success({ actor, tenantId });
    return ok({
      data: {
        ...createdData,
        has_password: Boolean(createdData.password_hash && createdData.password_salt),
        password_hash: undefined,
        password_salt: undefined,
      },
      shareUrl: `${shareBaseUrl}/share/inbound/${createdSlug}`,
    }, { requestId: ctx.requestId });
  } catch (error: unknown) {
    const apiError = toAppApiError(error, { error: '공유 링크 생성 중 서버 오류가 발생했습니다.', code: 'INBOUND_SHARE_INTERNAL_ERROR', status: 500 });
    requestLog.failure(apiError, {
      error: '공유 링크 생성 중 서버 오류가 발생했습니다.',
      code: 'INBOUND_SHARE_INTERNAL_ERROR',
      status: 500,
    }, { actor, tenantId });
    return fail(apiError.code || 'INBOUND_SHARE_INTERNAL_ERROR', apiError.message, {
      status: apiError.status,
      requestId: ctx.requestId,
      details: apiError.details,
    });
  }
}

export async function PATCH(request: NextRequest) {
  const ctx = getRouteContext(request, 'PATCH /api/admin/inbound-share');
  let actor: string | null = null;
  let tenantId: string | null = null;
  const requestLog = createRequestLogger({
    requestId: ctx.requestId,
    route: ctx.route,
    action: 'inbound_share_update',
  });

  try {
    const { db, orgId, userId } = await requireAdminRouteContext('manage:orders', request);
    actor = userId;
    const body = await request.json().catch(() => ({}));
    const id = String(body?.id || '').trim();
    if (!id) {
      throw new AppApiError({ error: 'id가 필요합니다.', code: 'BAD_REQUEST', status: 400 });
    }

    const share = await loadOwnedShare(db, id, orgId);
    tenantId = String(share.org_id || share.tenant_id || orgId || '');
    const updates = body?.updates || {};
    const payload: Record<string, any> = {};
    if ('expires_at' in updates) payload.expires_at = updates.expires_at;
    if ('language_default' in updates) payload.language_default = updates.language_default;
    if ('summary_ko' in updates) payload.summary_ko = updates.summary_ko;
    if ('summary_en' in updates) payload.summary_en = updates.summary_en;
    if ('summary_zh' in updates) payload.summary_zh = updates.summary_zh;
    if ('content' in updates) payload.content = updates.content;

    const { data, error } = await db
      .from('inbound_receipt_shares')
      .update(payload)
      .eq('id', id)
      .eq('receipt_id', share.receipt_id)
      .select()
      .single();

    if (error) {
      throw new AppApiError({ error: error.message, code: 'INTERNAL_ERROR', status: 500 });
    }

    await logAudit({
      actionType: 'UPDATE',
      resourceType: 'orders',
      resourceId: id,
      oldValue: share,
      newValue: payload,
      reason: 'Inbound share updated',
    });

    requestLog.success({ actor, tenantId });
    return ok({
      ...data,
      has_password: Boolean(data.password_hash && data.password_salt),
      password_hash: undefined,
      password_salt: undefined,
    }, { requestId: ctx.requestId });
  } catch (error: unknown) {
    const apiError = toAppApiError(error, { error: '공유 링크 수정에 실패했습니다.', code: 'INTERNAL_ERROR', status: 500 });
    requestLog.failure(apiError, {
      error: '공유 링크 수정에 실패했습니다.',
      code: 'INTERNAL_ERROR',
      status: 500,
    }, { actor, tenantId });
    return fail(apiError.code || 'INTERNAL_ERROR', apiError.message, {
      status: apiError.status,
      requestId: ctx.requestId,
      details: apiError.details,
    });
  }
}

export async function DELETE(request: NextRequest) {
  const ctx = getRouteContext(request, 'DELETE /api/admin/inbound-share');
  let actor: string | null = null;
  let tenantId: string | null = null;
  const requestLog = createRequestLogger({
    requestId: ctx.requestId,
    route: ctx.route,
    action: 'inbound_share_delete',
  });

  try {
    const { db, orgId, userId } = await requireAdminRouteContext('manage:orders', request);
    actor = userId;
    const { searchParams } = new URL(request.url);
    const id = String(searchParams.get('id') || '').trim();
    if (!id) {
      throw new AppApiError({ error: 'id가 필요합니다.', code: 'BAD_REQUEST', status: 400 });
    }

    const share = await loadOwnedShare(db, id, orgId);
    tenantId = String(share.org_id || share.tenant_id || orgId || '');
    const { error } = await db
      .from('inbound_receipt_shares')
      .delete()
      .eq('id', id)
      .eq('receipt_id', share.receipt_id);

    if (error) {
      throw new AppApiError({ error: error.message, code: 'INTERNAL_ERROR', status: 500 });
    }

    await logAudit({
      actionType: 'DELETE',
      resourceType: 'orders',
      resourceId: id,
      oldValue: share,
      reason: 'Inbound share deleted',
    });

    requestLog.success({ actor, tenantId });
    return ok({ deleted: true }, { requestId: ctx.requestId });
  } catch (error: unknown) {
    const apiError = toAppApiError(error, { error: '공유 링크 삭제에 실패했습니다.', code: 'INTERNAL_ERROR', status: 500 });
    requestLog.failure(apiError, {
      error: '공유 링크 삭제에 실패했습니다.',
      code: 'INTERNAL_ERROR',
      status: 500,
    }, { actor, tenantId });
    return fail(apiError.code || 'INTERNAL_ERROR', apiError.message, {
      status: apiError.status,
      requestId: ctx.requestId,
      details: apiError.details,
    });
  }
}
