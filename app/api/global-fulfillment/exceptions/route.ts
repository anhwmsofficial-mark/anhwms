import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import { toAppApiError } from '@/lib/api/errors';
import { requirePermission } from '@/utils/rbac';
import { fail, getRouteContext, ok } from '@/lib/api/response';
import { logger } from '@/lib/logger';

const exceptionStatuses = ['open', 'in_progress', 'resolved', 'closed'] as const;
const exceptionSeverities = ['low', 'medium', 'high', 'critical'] as const;

const listExceptionsQuerySchema = z.object({
  status: z.enum(exceptionStatuses).optional(),
  severity: z.enum(exceptionSeverities).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

const createExceptionSchema = z.object({
  exceptionNumber: z.string().trim().min(1).max(100).optional(),
  orderId: z.string().uuid(),
  exceptionType: z.string().trim().min(1).max(80),
  severity: z.enum(exceptionSeverities).default('medium'),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  detectedBy: z.string().trim().min(1).max(80).default('system'),
});

// GET: 이상 목록 조회
export async function GET(request: NextRequest) {
  const ctx = getRouteContext(request, 'GET /api/global-fulfillment/exceptions');
  try {
    await requirePermission('read:global_fulfillment', request);
    const { searchParams } = new URL(request.url);
    const parsed = listExceptionsQuerySchema.safeParse({
      status: searchParams.get('status') || undefined,
      severity: searchParams.get('severity') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
    });

    if (!parsed.success) {
      return fail('BAD_REQUEST', '유효하지 않은 예외 조회 조건입니다.', {
        status: 400,
        requestId: ctx.requestId,
        details: parsed.error.flatten(),
      });
    }

    const { status, severity, limit, offset } = parsed.data;
    const supabase = await createClient();
    const db = supabase as unknown as { from: (table: string) => any };
    let query = db
      .from('global_exceptions')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

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
      error: '해외배송 예외 목록을 불러오지 못했습니다.',
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
    await requirePermission('manage:global_fulfillment', request);
    const body = await request.json().catch(() => null);
    const parsed = createExceptionSchema.safeParse(body);

    if (!parsed.success) {
      return fail('BAD_REQUEST', '유효하지 않은 예외 생성 요청입니다.', {
        status: 400,
        requestId: ctx.requestId,
        details: parsed.error.flatten(),
      });
    }

    const input = parsed.data;
    const supabase = await createClient();
    const db = supabase as unknown as { from: (table: string) => any };
    const { data, error } = await db
      .from('global_exceptions')
      .insert({
        exception_number: input.exceptionNumber || `EXP-${Date.now()}`,
        order_id: input.orderId,
        exception_type: input.exceptionType,
        severity: input.severity,
        title: input.title,
        description: input.description ?? null,
        detected_by: input.detectedBy,
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
      error: '해외배송 예외를 생성하지 못했습니다.',
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

