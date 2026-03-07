import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { toAppApiError } from '@/lib/api/errors';
import { requirePermission } from '@/utils/rbac';
import { fail, getRouteContext, ok } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { getErrorMessage } from '@/lib/errorHandler';

// GET: 이상 목록 조회
export async function GET(request: NextRequest) {
  const ctx = getRouteContext(request, 'GET /api/global-fulfillment/exceptions');
  try {
    await requirePermission('read:orders', request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');

    const db = supabase as unknown as { from: (table: string) => any };
    let query = db
      .from('global_exceptions')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (severity) {
      query = query.eq('severity', severity);
    }

    const { data, error } = await query;

    if (error) throw error;

    return ok(data, { requestId: ctx.requestId });
  } catch (error: unknown) {
    logger.error(error as Error, { ...ctx, scope: 'api' });
    const apiError = toAppApiError(error, {
      error: getErrorMessage(error) || 'Failed to fetch exceptions',
      code: 'INTERNAL_ERROR',
      status: 500,
    });
    return fail(apiError.code || 'INTERNAL_ERROR', apiError.message, {
      status: apiError.status,
      requestId: ctx.requestId,
      details: apiError.details,
    });
  }
}

// POST: 새 이상 생성
export async function POST(request: NextRequest) {
  const ctx = getRouteContext(request, 'POST /api/global-fulfillment/exceptions');
  try {
    await requirePermission('manage:orders', request);
    const body = await request.json();

    const db = supabase as unknown as { from: (table: string) => any };
    const { data, error } = await db
      .from('global_exceptions')
      .insert({
        exception_number: body.exceptionNumber || `EXP-${Date.now()}`,
        order_id: body.orderId,
        exception_type: body.exceptionType,
        severity: body.severity || 'medium',
        title: body.title,
        description: body.description,
        detected_by: body.detectedBy || 'system',
        detected_at: new Date().toISOString(),
        status: 'open',
        customer_notified: false
      })
      .select()
      .single();

    if (error) throw error;

    return ok(data, { status: 201, requestId: ctx.requestId });
  } catch (error: unknown) {
    logger.error(error as Error, { ...ctx, scope: 'api' });
    const apiError = toAppApiError(error, {
      error: getErrorMessage(error) || 'Failed to create exception',
      code: 'INTERNAL_ERROR',
      status: 500,
    });
    return fail(apiError.code || 'INTERNAL_ERROR', apiError.message, {
      status: apiError.status,
      requestId: ctx.requestId,
      details: apiError.details,
    });
  }
}

