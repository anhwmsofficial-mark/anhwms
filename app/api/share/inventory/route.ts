import { NextRequest } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { logShareAccessAudit } from '@/lib/shareAudit';
import { verifyPassword } from '@/lib/share';
import { fail, getRouteContext, ok } from '@/lib/api/response';
import { createRequestLogger } from '@/lib/api/request-log';
import {
  fetchInventoryVolumePage,
  fetchInventoryVolumeRowsBatched,
  INVENTORY_VOLUME_DEFAULT_PREVIEW_LIMIT,
  INVENTORY_VOLUME_EXPORT_MAX_ROWS,
  INVENTORY_VOLUME_PAGE_MAX_LIMIT,
  parsePositiveInt,
} from '@/lib/inventory-volume-query';
import {
  clearSharePasswordFailures,
  enforcePublicShareRateLimit,
  ensureSharePasswordBackoff,
  publicShareNotFoundError,
  publicSharePasswordError,
  registerSharePasswordFailure,
} from '@/lib/share/security';

type ShareRow = {
  id: string;
  slug: string;
  customer_id: string;
  date_from: string | null;
  date_to: string | null;
  expires_at: string | null;
  password_hash: string | null;
  password_salt: string | null;
};

const INVENTORY_SHARE_COLUMNS =
  'sheet_name, record_date, row_no, item_name, opening_stock_raw, closing_stock_raw, header_order, raw_data';

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

async function loadRowsByShare(
  share: ShareRow,
  options?: {
    cursor?: number;
    limit?: number;
    paginated?: boolean;
  },
) {
  const db = createAdminClient();
  const filters = {
    customerId: share.customer_id,
    dateFrom: share.date_from,
    dateTo: share.date_to,
  };

  try {
    if (options?.paginated) {
      const cursor = Math.max(options.cursor || 0, 0);
      const limit = Math.min(
        Math.max(options.limit || INVENTORY_VOLUME_DEFAULT_PREVIEW_LIMIT, 1),
        INVENTORY_VOLUME_PAGE_MAX_LIMIT,
      );
      const page = await fetchInventoryVolumePage(db, filters, INVENTORY_SHARE_COLUMNS, {
        offset: cursor,
        limit: limit + 1,
      });
      const hasMore = page.length > limit;
      const rows = hasMore ? page.slice(0, limit) : page;
      return {
        rows,
        pagination: {
          mode: 'cursor',
          cursor,
          limit,
          nextCursor: hasMore ? cursor + rows.length : null,
          hasMore,
          returnedRows: rows.length,
          truncated: false,
        },
      };
    }

    const loaded = await fetchInventoryVolumeRowsBatched(
      db,
      filters,
      INVENTORY_SHARE_COLUMNS,
      { maxRows: INVENTORY_VOLUME_EXPORT_MAX_ROWS },
    );
    return {
      rows: loaded.rows,
      pagination: {
        mode: 'legacy',
        cursor: 0,
        limit: loaded.totalFetched,
        nextCursor: null,
        hasMore: false,
        returnedRows: loaded.totalFetched,
        truncated: loaded.truncated,
      },
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : '공유 데이터 조회에 실패했습니다.',
      rows: [] as Record<string, unknown>[],
      pagination: {
        mode: options?.paginated ? 'cursor' : 'legacy',
        cursor: options?.cursor || 0,
        limit: options?.limit || INVENTORY_VOLUME_DEFAULT_PREVIEW_LIMIT,
        nextCursor: null,
        hasMore: false,
        returnedRows: 0,
        truncated: false,
      },
    };
  }
}

export async function GET(request: NextRequest) {
  const route = 'GET /api/share/inventory';
  const ctx = getRouteContext(request, route);
  let slug = '';
  const requestLog = createRequestLogger({
    requestId: ctx.requestId,
    route: ctx.route,
    action: 'share_inventory_read',
  });
  try {
    const { searchParams } = new URL(request.url);
    slug = String(searchParams.get('slug') || '').trim();
    const paginated = searchParams.has('cursor') || searchParams.has('limit');
    const cursor = parsePositiveInt(searchParams.get('cursor'), 0, INVENTORY_VOLUME_EXPORT_MAX_ROWS, 0);
    const limit = parsePositiveInt(
      searchParams.get('limit'),
      INVENTORY_VOLUME_DEFAULT_PREVIEW_LIMIT,
      INVENTORY_VOLUME_PAGE_MAX_LIMIT,
      1,
    );
    if (!slug) {
      return fail('BAD_REQUEST', 'slug가 필요합니다.', { status: 400, requestId: ctx.requestId });
    }

    await enforcePublicShareRateLimit(request, 'inventory', 'read', slug);

    const db = createAdminClient();
    const { data, error } = await db
      .from('inventory_volume_share')
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
        share: {
          date_from: data.date_from,
          date_to: data.date_to,
          expires_at: data.expires_at,
        },
      }, { requestId: ctx.requestId });
    }

    const loaded = await loadRowsByShare(data as ShareRow, { cursor, limit, paginated });
    if ('error' in loaded) {
      const errorMessage = loaded.error || '공유 데이터 조회에 실패했습니다.';
      await logShareAccessAudit(request, {
        action: 'VIEW',
        route,
        result: 'denied',
        shareId: data.id,
        slug,
        reason: 'share_load_failed',
      });
      requestLog.failure({ message: errorMessage, status: 500, code: 'INTERNAL_ERROR' }, {
        error: errorMessage,
        code: 'INTERNAL_ERROR',
        status: 500,
      });
      return fail('INTERNAL_ERROR', errorMessage, { status: 500, requestId: ctx.requestId });
    }

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
        date_from: data.date_from,
        date_to: data.date_to,
        expires_at: data.expires_at,
      },
      rows: loaded.rows,
      pagination: loaded.pagination,
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
  const route = 'POST /api/share/inventory';
  const ctx = getRouteContext(request, route);
  const requestLog = createRequestLogger({
    requestId: ctx.requestId,
    route: ctx.route,
    action: 'share_inventory_verify',
  });
  try {
    const body = await request.json().catch(() => ({}));
    const slug = String(body?.slug || '').trim();
    const password = String(body?.password || '').trim();
    const paginated = body?.cursor !== undefined || body?.limit !== undefined;
    const cursor = parsePositiveInt(
      body?.cursor === undefined ? null : String(body.cursor),
      0,
      INVENTORY_VOLUME_EXPORT_MAX_ROWS,
      0,
    );
    const limit = parsePositiveInt(
      body?.limit === undefined ? null : String(body.limit),
      INVENTORY_VOLUME_DEFAULT_PREVIEW_LIMIT,
      INVENTORY_VOLUME_PAGE_MAX_LIMIT,
      1,
    );

    if (!slug) {
      return fail('BAD_REQUEST', 'slug가 필요합니다.', { status: 400, requestId: ctx.requestId });
    }

    await enforcePublicShareRateLimit(request, 'inventory', 'verify', slug);
    await ensureSharePasswordBackoff(request, 'inventory', slug);

    const db = createAdminClient();
    const { data, error } = await db
      .from('inventory_volume_share')
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
      const failure = await registerSharePasswordFailure(request, 'inventory', slug);
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

    await clearSharePasswordFailures(request, 'inventory', slug);

    const loaded = await loadRowsByShare(data as ShareRow, { cursor, limit, paginated });
    if ('error' in loaded) {
      const errorMessage = loaded.error || '공유 데이터 조회에 실패했습니다.';
      await logShareAccessAudit(request, {
        action: 'VIEW',
        route,
        result: 'denied',
        shareId: data.id,
        slug,
        reason: 'share_load_failed',
      });
      requestLog.failure({ message: errorMessage, status: 500, code: 'INTERNAL_ERROR' }, {
        error: errorMessage,
        code: 'INTERNAL_ERROR',
        status: 500,
      });
      return fail('INTERNAL_ERROR', errorMessage, { status: 500, requestId: ctx.requestId });
    }

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
        date_from: data.date_from,
        date_to: data.date_to,
        expires_at: data.expires_at,
      },
      rows: loaded.rows,
      pagination: loaded.pagination,
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
