import { NextRequest } from 'next/server';
import { callShipmentStatus, callOutboundStatus, callInboundStatus } from '@/lib/cs/functionsClient';
import { requirePermission } from '@/utils/rbac';
import { fail, getRouteContext, ok } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { getErrorMessage } from '@/lib/errorHandler';

type StatusType = 'shipment' | 'outbound' | 'inbound';

interface StatusRequestBody {
  type: StatusType;
  params: Record<string, unknown>;
}

const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const toOptionalNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

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
          orderNo: toOptionalString(body.params?.orderNo),
          trackingNo: toOptionalString(body.params?.trackingNo),
          limit: toOptionalNumber(body.params?.limit),
        });
        return ok(data, { requestId: ctx.requestId });
      }
      case 'outbound': {
        const data = await callOutboundStatus({
          orderNo: toOptionalString(body.params?.orderNo),
          outboundId: toOptionalString(body.params?.outboundId),
          productName: toOptionalString(body.params?.productName),
          limit: toOptionalNumber(body.params?.limit),
        });
        return ok(data, { requestId: ctx.requestId });
      }
      case 'inbound': {
        const data = await callInboundStatus({
          asnNo: toOptionalString(body.params?.asnNo),
          inboundId: toOptionalString(body.params?.inboundId),
          productName: toOptionalString(body.params?.productName),
          limit: toOptionalNumber(body.params?.limit),
        });
        return ok(data, { requestId: ctx.requestId });
      }
      default:
        return fail('BAD_REQUEST', `지원되지 않는 type: ${body.type}`, { status: 400, requestId: ctx.requestId });
    }
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message.includes('Unauthorized') ? 403 : 500;
    logger.error(error as Error, { ...ctx, scope: 'api' });
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR', '상태 조회 중 오류가 발생했습니다.', {
      status,
      requestId: ctx.requestId,
      details: message,
    });
  }
}
