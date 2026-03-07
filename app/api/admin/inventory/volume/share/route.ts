import { NextRequest } from 'next/server';
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

const toIsoDate = (value?: string | null) => {
  if (!value) return null;
  const normalized = String(value).trim().replace(/\./g, '-').replace(/\//g, '-');
  if (!normalized) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  return null;
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
    const customerId = String(searchParams.get('customer_id') || '').trim();
    if (!customerId) {
      throw new AppApiError({ error: 'customer_id가 필요합니다.', code: 'BAD_REQUEST', status: 400 });
    }

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
    const customerId = String(body?.customer_id || '').trim();
    const dateFrom = toIsoDate(body?.date_from);
    const dateTo = toIsoDate(body?.date_to);
    const expiresAtRaw = String(body?.expires_at || '').trim();
    const expiresAt = expiresAtRaw ? new Date(expiresAtRaw).toISOString() : null;
    const password = String(body?.password || '').trim();

    if (!customerId) {
      throw new AppApiError({ error: 'customer_id가 필요합니다.', code: 'BAD_REQUEST', status: 400 });
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
    const id = String(searchParams.get('id') || '').trim();
    if (!id) {
      throw new AppApiError({ error: 'id가 필요합니다.', code: 'BAD_REQUEST', status: 400 });
    }

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
