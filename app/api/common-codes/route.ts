import { NextRequest } from 'next/server';
import { AppApiError, toAppApiError } from '@/lib/api/errors';
import { fail, ok } from '@/lib/api/response';
import { requireAdminRouteContext } from '@/lib/server/admin-ownership';
import { createAdminClient } from '@/utils/supabase/admin';
import { logAudit } from '@/utils/audit';

export async function GET(request: NextRequest) {
  try {
    const db = createAdminClient();
    const { searchParams } = new URL(request.url);
    const groupCode = searchParams.get('group_code');
    const isActive = searchParams.get('is_active');

    let query = db
      .from('common_codes')
      .select('*')
      .order('sort_order', { ascending: true });

    if (groupCode) {
      query = query.eq('group_code', groupCode);
    }

    if (isActive !== null) {
        query = query.eq('is_active', isActive === 'true');
    } else {
        query = query.eq('is_active', true); // Default active only
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching common codes:', error);
      if (error.code === '42P01') { // undefined_table
          return ok([]);
      }
      throw new AppApiError({ error: error.message, code: 'INTERNAL_ERROR', status: 500 });
    }

    return ok(data || []);
  } catch (error: unknown) {
    console.error('GET /api/common-codes error:', error);
    const apiError = toAppApiError(error, { error: '공통코드 조회에 실패했습니다.', code: 'INTERNAL_ERROR', status: 500 });
    return fail(apiError.code || 'INTERNAL_ERROR', apiError.message, { status: apiError.status, details: apiError.details });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { db, userId } = await requireAdminRouteContext('manage:products', request);
    const body = await request.json().catch(() => ({}));
    const groupCode = String(body?.group_code || '').trim();
    const code = String(body?.code || '').trim();
    const label = String(body?.label || '').trim();
    const sortOrder = Number.isFinite(Number(body?.sort_order)) ? Number(body.sort_order) : 0;
    const isActive = body?.is_active === undefined ? true : Boolean(body.is_active);

    if (!groupCode || !code || !label) {
      throw new AppApiError({ error: 'group_code, code, label은 필수입니다.', code: 'BAD_REQUEST', status: 400 });
    }

    const { data, error } = await db
      .from('common_codes')
      .insert([{ group_code: groupCode, code, label, sort_order: sortOrder, is_active: isActive }])
      .select()
      .single();

    if (error) {
      throw new AppApiError({ error: error.message, code: 'INTERNAL_ERROR', status: 500 });
    }

    await logAudit({
      actionType: 'CREATE',
      resourceType: 'settings',
      resourceId: String(data?.id || `${groupCode}:${code}`),
      newValue: data,
      reason: `common code created by ${userId}`,
    });

    return ok(data, { status: 201 });
  } catch (error: unknown) {
    const apiError = toAppApiError(error, { error: '공통코드 저장에 실패했습니다.', code: 'INTERNAL_ERROR', status: 500 });
    return fail(apiError.code || 'INTERNAL_ERROR', apiError.message, { status: apiError.status, details: apiError.details });
  }
}
