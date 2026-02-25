/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server';
import { callShipmentStatus, callOutboundStatus, callInboundStatus } from '@/lib/cs/functionsClient';
import { requirePermission } from '@/utils/rbac';
import { fail, getRouteContext, ok } from '@/lib/api/response';
import { logger } from '@/lib/logger';

type StatusType = 'shipment' | 'outbound' | 'inbound';

interface StatusRequestBody {
  type: StatusType;
  params: Record<string, any>;
}

export async function POST(request: NextRequest) {
  const ctx = getRouteContext(request, 'POST /api/cs/status');
  try {
    await requirePermission('read:orders', request);
    const body = (await request.json()) as StatusRequestBody;

    if (!body?.type) {
      return fail('BAD_REQUEST', 'type 필드는 필수입니다.', { status: 400, requestId: ctx.requestId });
    }

    switch (body.type) {
      case 'shipment': {
        const data = await callShipmentStatus({
          orderNo: body.params?.orderNo,
          trackingNo: body.params?.trackingNo,
          limit: body.params?.limit,
        });
        return ok(data, { requestId: ctx.requestId });
      }
      case 'outbound': {
        const data = await callOutboundStatus({
          orderNo: body.params?.orderNo,
          outboundId: body.params?.outboundId,
          productName: body.params?.productName,
          limit: body.params?.limit,
        });
        return ok(data, { requestId: ctx.requestId });
      }
      case 'inbound': {
        const data = await callInboundStatus({
          asnNo: body.params?.asnNo,
          inboundId: body.params?.inboundId,
          productName: body.params?.productName,
          limit: body.params?.limit,
        });
        return ok(data, { requestId: ctx.requestId });
      }
      default:
        return fail('BAD_REQUEST', `지원되지 않는 type: ${body.type}`, { status: 400, requestId: ctx.requestId });
    }
  } catch (error: any) {
    const status = error?.message?.includes('Unauthorized') ? 403 : 500;
    logger.error(error as Error, { ...ctx, scope: 'api' });
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR', '상태 조회 중 오류가 발생했습니다.', {
      status,
      requestId: ctx.requestId,
      details: error?.message ?? error,
    });
  }
}
