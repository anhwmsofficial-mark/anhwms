import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import { toAppApiError } from '@/lib/api/errors';
import { requirePermission } from '@/utils/rbac';
import { fail, getRouteContext, ok } from '@/lib/api/response';
import { logger } from '@/lib/logger';

const orderStatuses = ['pending', 'in_progress', 'completed', 'delayed', 'error'] as const;
const processSteps = [
  'drop_shipping',
  'preparation',
  'wave_management',
  'second_sorting',
  'inspection',
  'package_check',
  'weight_check',
  'completed',
  'exception',
  'returned',
] as const;

const listOrdersQuerySchema = z.object({
  status: z.enum(orderStatuses).optional(),
  step: z.enum(processSteps).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

const createOrderSchema = z.object({
  orderNumber: z.string().trim().min(1).max(100),
  customerId: z.string().uuid(),
  platformOrderId: z.string().trim().max(100).optional().nullable(),
  originCountry: z.string().trim().length(2).default('CN'),
  destinationCountry: z.string().trim().length(2).default('KR'),
  warehouseLocation: z.string().trim().max(120).optional().nullable(),
  shippingMethod: z.string().trim().max(80).optional().nullable(),
});

// GET: 주문 목록 조회
export async function GET(request: NextRequest) {
  const ctx = getRouteContext(request, 'GET /api/global-fulfillment/orders');
  try {
    await requirePermission('read:global_fulfillment', request);
    const { searchParams } = new URL(request.url);
    const parsed = listOrdersQuerySchema.safeParse({
      status: searchParams.get('status') || undefined,
      step: searchParams.get('step') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
    });

    if (!parsed.success) {
      return fail('BAD_REQUEST', '유효하지 않은 조회 조건입니다.', {
        status: 400,
        requestId: ctx.requestId,
        details: parsed.error.flatten(),
      });
    }

    const { status, step, limit, offset } = parsed.data;

    const supabase = await createClient();
    const db = supabase as unknown as { from: (table: string) => any };
    let query = db
      .from('global_fulfillment_orders')
      .select(`
        *,
        customer:global_customers(*)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

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
      error: '해외배송 주문 목록을 불러오지 못했습니다.',
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
    await requirePermission('manage:global_fulfillment', request);
    const body = await request.json().catch(() => null);
    const parsed = createOrderSchema.safeParse(body);

    if (!parsed.success) {
      return fail('BAD_REQUEST', '유효하지 않은 주문 생성 요청입니다.', {
        status: 400,
        requestId: ctx.requestId,
        details: parsed.error.flatten(),
      });
    }

    const input = parsed.data;
    const supabase = await createClient();
    const db = supabase as unknown as { from: (table: string) => any };
    const { data, error } = await db
      .from('global_fulfillment_orders')
      .insert({
        order_number: input.orderNumber,
        customer_id: input.customerId,
        platform_order_id: input.platformOrderId ?? null,
        current_step: 'drop_shipping',
        status: 'pending',
        origin_country: input.originCountry,
        destination_country: input.destinationCountry,
        warehouse_location: input.warehouseLocation ?? null,
        shipping_method: input.shippingMethod ?? null,
        ordered_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return ok(data, { status: 201, requestId: ctx.requestId });
  } catch (error: unknown) {
    logger.error(error as Error, { ...ctx, scope: 'api' });
    const apiError = toAppApiError(error, {
      error: '해외배송 주문을 생성하지 못했습니다.',
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

