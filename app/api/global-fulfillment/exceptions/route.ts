/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requirePermission } from '@/utils/rbac';
import { fail, getRouteContext, ok } from '@/lib/api/response';
import { logger } from '@/lib/logger';

// GET: 이상 목록 조회
export async function GET(request: NextRequest) {
  const ctx = getRouteContext(request, 'GET /api/global-fulfillment/exceptions');
  try {
    await requirePermission('read:orders', request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');

    let query = supabase
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
  } catch (error: any) {
    const status = error?.message?.includes('Unauthorized') ? 403 : 500;
    logger.error(error as Error, { ...ctx, scope: 'api' });
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR', error.message || 'Failed to fetch exceptions', {
      status,
      requestId: ctx.requestId,
    });
  }
}

// POST: 새 이상 생성
export async function POST(request: NextRequest) {
  const ctx = getRouteContext(request, 'POST /api/global-fulfillment/exceptions');
  try {
    await requirePermission('manage:orders', request);
    const body = await request.json();

    const { data, error } = await supabase
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
  } catch (error: any) {
    const status = error?.message?.includes('Unauthorized') ? 403 : 500;
    logger.error(error as Error, { ...ctx, scope: 'api' });
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR', error.message || 'Failed to create exception', {
      status,
      requestId: ctx.requestId,
    });
  }
}

