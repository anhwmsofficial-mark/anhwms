/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server';
import { callCreateTicket } from '@/lib/cs/functionsClient';
import { requirePermission } from '@/utils/rbac';
import { fail, getRouteContext, ok } from '@/lib/api/response';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const ctx = getRouteContext(request, 'POST /api/cs/ticket');
  try {
    await requirePermission('manage:orders', request);
    const body = await request.json();
    const summary = body?.summary;

    if (!summary) {
      return fail('BAD_REQUEST', 'summary 필드는 필수입니다.', { status: 400, requestId: ctx.requestId });
    }

    const payload = {
      partnerId: body?.partnerId,
      conversationId: body?.conversationId,
      summary,
      description: body?.description,
      priority: body?.priority,
      assignee: body?.assignee,
      tags: Array.isArray(body?.tags) ? body.tags : undefined,
    };

    const data = await callCreateTicket(payload);
    return ok(data, { status: 201, requestId: ctx.requestId });
  } catch (error: any) {
    const status = error?.message?.includes('Unauthorized') ? 403 : 500;
    logger.error(error as Error, { ...ctx, scope: 'api' });
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR', 'CS 티켓 생성 중 오류가 발생했습니다.', {
      status,
      requestId: ctx.requestId,
      details: error?.message ?? error,
    });
  }
}
