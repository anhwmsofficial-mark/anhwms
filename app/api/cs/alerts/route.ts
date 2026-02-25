/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { createClient } from '@/utils/supabase/server';
import { fail, getRouteContext, ok } from '@/lib/api/response';
import { requirePermission } from '@/utils/rbac';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const ctx = getRouteContext(request, 'GET /api/cs/alerts');
  try {
    await requirePermission('read:orders', request);
    const auth = await createClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) {
      return fail('UNAUTHORIZED', 'Unauthorized', { status: 401, requestId: ctx.requestId });
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('cs_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    const items = (data ?? []).map((alert) => ({
      id: alert.id,
      type: alert.type,
      ref: alert.ref,
      partnerId: alert.partner_id,
      severity: alert.severity,
      status: alert.status,
      message: alert.message,
      metadata: alert.metadata,
      createdAt: alert.created_at,
      resolvedAt: alert.resolved_at,
      resolvedBy: alert.resolved_by,
    }));

    return ok({ items }, { requestId: ctx.requestId });
  } catch (error: any) {
    const status = error?.message?.includes('Unauthorized') ? 403 : 500;
    logger.error(error as Error, { ...ctx, scope: 'api' });
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR', '알림 조회 중 오류가 발생했습니다.', {
      status,
      requestId: ctx.requestId,
      details: error?.message ?? error,
    });
  }
}
