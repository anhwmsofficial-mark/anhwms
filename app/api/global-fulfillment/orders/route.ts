import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { toAppApiError } from '@/lib/api/errors';
import { requirePermission } from '@/utils/rbac';
import { fail, getRouteContext, ok } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { getErrorMessage } from '@/lib/errorHandler';

// GET: 주문 목록 조회
export async function GET(request: NextRequest) {
  const ctx = getRouteContext(request, 'GET /api/global-fulfillment/orders');
  try {
    await requirePermission('read:orders', request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const step = searchParams.get('step');

    const db = supabase as unknown as { from: (table: string) => any };
    let query = db
      .from('global_fulfillment_orders')
      .select(`
        *,
        customer:global_customers(*)
      `)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (step) {
      query = query.eq('current_step', step);
    }

    const { data, error } = await query;

    if (error) throw error;

    return ok(data, { requestId: ctx.requestId });
  } catch (error: unknown) {
    logger.error(error as Error, { ...ctx, scope: 'api' });
    const apiError = toAppApiError(error, {
      error: getErrorMessage(error) || 'Failed to fetch orders',
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

// POST: 새 주문 생성
export async function POST(request: NextRequest) {
  const ctx = getRouteContext(request, 'POST /api/global-fulfillment/orders');
  try {
    await requirePermission('manage:orders', request);
    const body = await request.json();

    const db = supabase as unknown as { from: (table: string) => any };
    const { data, error } = await db
      .from('global_fulfillment_orders')
      .insert({
        order_number: body.orderNumber,
        customer_id: body.customerId,
        platform_order_id: body.platformOrderId,
        current_step: 'drop_shipping',
        status: 'pending',
        origin_country: body.originCountry || 'CN',
        destination_country: body.destinationCountry || 'KR',
        warehouse_location: body.warehouseLocation,
        shipping_method: body.shippingMethod,
        ordered_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return ok(data, { status: 201, requestId: ctx.requestId });
  } catch (error: unknown) {
    logger.error(error as Error, { ...ctx, scope: 'api' });
    const apiError = toAppApiError(error, {
      error: getErrorMessage(error) || 'Failed to create order',
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

