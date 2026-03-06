 
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/utils/rbac';
import { fail, ok } from '@/lib/api/response';
import { getErrorMessage } from '@/lib/errorHandler';

const safeParseJson = (value: unknown) => {
  if (!value || typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

type AuditRow = {
  old_value?: string | null;
  new_value?: string | null;
} & Record<string, unknown>;

export async function GET(request: NextRequest) {
  try {
    await requirePermission('manage:orders', request);
    const { searchParams } = new URL(request.url);
    const parsedPage = parseInt(searchParams.get('page') || '1');
    const parsedLimit = parseInt(searchParams.get('limit') || '20');
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 20;
    const actionType = searchParams.get('action');
    const resourceType = searchParams.get('resource');
    const actorId = searchParams.get('actorId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const keyword = (searchParams.get('q') || '').trim();

    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (actionType) query = query.eq('action_type', actionType);
    if (resourceType) query = query.eq('resource_type', resourceType);
    if (actorId) query = query.eq('actor_id', actorId);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);
    if (keyword) {
      const escaped = keyword.replace(/[%_]/g, '\\$&');
      query = query.or(`reason.ilike.%${escaped}%,resource_id.ilike.%${escaped}%`);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    const logs = ((data || []) as AuditRow[]).map((row) => ({
      ...row,
      old_value: safeParseJson(row.old_value),
      new_value: safeParseJson(row.new_value),
    }));

    return ok({
      data: logs,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: unknown) {
    console.error('GET /api/admin/audit-logs error:', error);
    const message = getErrorMessage(error);
    const status = String(message || '').includes('Unauthorized') ? 403 : 500;
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR', message || '감사 로그 조회 실패', { status });
  }
}
