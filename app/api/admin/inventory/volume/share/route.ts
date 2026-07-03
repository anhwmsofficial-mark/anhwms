import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AppApiError, toAppApiError } from '@/lib/api/errors';
import { fail, ok } from '@/lib/api/response';
import { requireAdminRouteContext, resolveCustomerWithinOrg } from '@/lib/server/admin-ownership';
import { generateSlug, hashPassword } from '@/lib/share';
import { logAudit } from '@/utils/audit';

type SharePayload = {
  slug: string;
  customer_id: string;
  date_from: string | null;
  date_to: string | null;
  expires_at: string | null;
  password_hash: string | null;
  password_salt: string | null;
  created_by: string;
};

const DEFAULT_SHARE_EXPIRY_DAYS = 7;
const MAX_SHARE_EXPIRY_DAYS = 30;

const customerQuerySchema = z.object({
  customer_id: z.string().trim().uuid('customer_id 형식이 올바르지 않습니다.'),
});

const createShareSchema = z.object({
  customer_id: z.string().trim().uuid('customer_id 형식이 올바르지 않습니다.'),
  date_from: z.string().trim().optional().nullable(),
  date_to: z.string().trim().optional().nullable(),
  expires_at: z.string().trim().optional().nullable(),
  password: z
    .string()
    .max(128, '비밀번호는 128자 이하여야 합니다.')
    .optional()
    .nullable(),
});

const deleteShareSchema = z.object({
  id: z.string().trim().uuid('id 형식이 올바르지 않습니다.'),
});

const toIsoDate = (value?: string | null) => {
  const normalized = String(value || '').trim().replace(/\./g, '-').replace(/\//g, '-');
  if (!normalized) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  throw new AppApiError({ error: '날짜는 YYYY-MM-DD 형식이어야 합니다.', code: 'BAD_REQUEST', status: 400 });
};

const resolveExpiresAt = (value?: string | null) => {
  const raw = String(value || '').trim();
  const now = Date.now();
  const maxExpiresAt = now + MAX_SHARE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

  if (!raw) {
    return new Date(now + DEFAULT_SHARE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  }

  const parsed = new Date(raw).getTime();
  if (!Number.isFinite(parsed)) {
    throw new AppApiError({ error: 'expires_at 형식이 올바르지 않습니다.', code: 'BAD_REQUEST', status: 400 });
  }
  if (parsed <= now) {
    throw new AppApiError({ error: 'expires_at은 현재 시각 이후여야 합니다.', code: 'BAD_REQUEST', status: 400 });
  }
  if (parsed > maxExpiresAt) {
    throw new AppApiError({
      error: `공유 링크 만료일은 최대 ${MAX_SHARE_EXPIRY_DAYS}일 이내여야 합니다.`,
      code: 'BAD_REQUEST',
      status: 400,
    });
  }

  return new Date(parsed).toISOString();
};

function dbUntyped(db: unknown) {
  return db as {
    from: (table: string) => any;
  };
}

async function ensureUniqueSlug(db: { from: (table: string) => any }, length = 7) {
  for (let i = 0; i < 6; i += 1) {
    const slug = generateSlug(length);
    const { data } = await db
      .from('inventory_volume_share')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!data) return slug;
  }
  return generateSlug(length + 1);
}

export async function GET(request: NextRequest) {
  try {
    const { db, orgId } = await requireAdminRouteContext('manage:orders', request);
    const { searchParams } = new URL(request.url);
    const parsed = customerQuerySchema.safeParse({
      customer_id: searchParams.get('customer_id') || '',
    });
    if (!parsed.success) {
      throw new AppApiError({
        error: '유효하지 않은 공유 링크 조회 요청입니다.',
        code: 'BAD_REQUEST',
        status: 400,
        details: parsed.error.flatten(),
      });
    }

    const customerId = parsed.data.customer_id;
    const customer = await resolveCustomerWithinOrg(dbUntyped(db), customerId, orgId);
    const { data, error } = await dbUntyped(db)
      .from('inventory_volume_share')
      .select('*')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      throw new AppApiError({ error: error.message, code: 'INTERNAL_ERROR', status: 500 });
    }

    return ok(
      (data || []).map((row: any) => ({
        ...row,
        has_password: Boolean(row.password_hash && row.password_salt),
        password_hash: undefined,
        password_salt: undefined,
      })),
    );
  } catch (error: unknown) {
    const apiError = toAppApiError(error, { error: '물동량 공유 링크 조회에 실패했습니다.', code: 'INTERNAL_ERROR', status: 500 });
    return fail(apiError.code || 'INTERNAL_ERROR', apiError.message, { status: apiError.status, details: apiError.details });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { db, userId, orgId } = await requireAdminRouteContext('manage:orders', request);
    const body = await request.json().catch(() => ({}));
    const parsed = createShareSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppApiError({
        error: '유효하지 않은 공유 링크 생성 요청입니다.',
        code: 'BAD_REQUEST',
        status: 400,
        details: parsed.error.flatten(),
      });
    }

    const customerId = parsed.data.customer_id;
    const dateFrom = toIsoDate(parsed.data.date_from);
    const dateTo = toIsoDate(parsed.data.date_to);
    if (dateFrom && dateTo && dateFrom > dateTo) {
      throw new AppApiError({ error: 'date_from은 date_to보다 늦을 수 없습니다.', code: 'BAD_REQUEST', status: 400 });
    }

    const expiresAt = resolveExpiresAt(parsed.data.expires_at);
    const password = String(parsed.data.password || '').trim();
    if (password && password.length < 8) {
      throw new AppApiError({ error: '공유 링크 비밀번호는 8자 이상이어야 합니다.', code: 'BAD_REQUEST', status: 400 });
    }

    const customer = await resolveCustomerWithinOrg(dbUntyped(db), customerId, orgId);
    const slug = await ensureUniqueSlug(dbUntyped(db));
    const passwordData = password ? hashPassword(password) : null;

    const payload: SharePayload = {
      slug,
      customer_id: customer.id,
      date_from: dateFrom,
      date_to: dateTo,
      expires_at: expiresAt,
      password_hash: passwordData?.hash ?? null,
      password_salt: passwordData?.salt ?? null,
      created_by: userId,
    };

    const { data, error } = await dbUntyped(db)
      .from('inventory_volume_share')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      throw new AppApiError({ error: error.message, code: 'INTERNAL_ERROR', status: 500 });
    }

    await logAudit({
      actionType: 'CREATE',
      resourceType: 'inventory',
      resourceId: String(data?.id || slug),
      newValue: { customer_id: customer.id, slug, date_from: dateFrom, date_to: dateTo, expires_at: expiresAt },
      reason: 'Inventory volume share created',
    });

    const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.anhwms.com';
    return ok({
      data: {
        ...data,
        has_password: Boolean(data.password_hash && data.password_salt),
        password_hash: undefined,
        password_salt: undefined,
      },
      shareUrl: `${base}/share/inventory/${slug}`,
    });
  } catch (error: unknown) {
    const apiError = toAppApiError(error, { error: '물동량 공유 링크 생성에 실패했습니다.', code: 'INTERNAL_ERROR', status: 500 });
    return fail(apiError.code || 'INTERNAL_ERROR', apiError.message, { status: apiError.status, details: apiError.details });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { db, orgId } = await requireAdminRouteContext('manage:orders', request);
    const { searchParams } = new URL(request.url);
    const parsed = deleteShareSchema.safeParse({
      id: searchParams.get('id') || '',
    });
    if (!parsed.success) {
      throw new AppApiError({
        error: '유효하지 않은 공유 링크 삭제 요청입니다.',
        code: 'BAD_REQUEST',
        status: 400,
        details: parsed.error.flatten(),
      });
    }

    const id = parsed.data.id;
    const { data: share, error: shareError } = await dbUntyped(db)
      .from('inventory_volume_share')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (shareError) {
      throw new AppApiError({ error: shareError.message, code: 'INTERNAL_ERROR', status: 500 });
    }
    if (!share?.customer_id) {
      throw new AppApiError({ error: '공유 링크를 찾을 수 없습니다.', code: 'NOT_FOUND', status: 404 });
    }

    const customer = await resolveCustomerWithinOrg(dbUntyped(db), String(share.customer_id), orgId);
    const { error } = await dbUntyped(db)
      .from('inventory_volume_share')
      .delete()
      .eq('id', id)
      .eq('customer_id', customer.id);
    if (error) {
      throw new AppApiError({ error: error.message, code: 'INTERNAL_ERROR', status: 500 });
    }

    await logAudit({
      actionType: 'DELETE',
      resourceType: 'inventory',
      resourceId: id,
      oldValue: share,
      reason: 'Inventory volume share deleted',
    });

    return ok({ deleted: true });
  } catch (error: unknown) {
    const apiError = toAppApiError(error, { error: '물동량 공유 링크 삭제에 실패했습니다.', code: 'INTERNAL_ERROR', status: 500 });
    return fail(apiError.code || 'INTERNAL_ERROR', apiError.message, { status: apiError.status, details: apiError.details });
  }
}
