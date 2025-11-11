import { NextResponse } from 'next/server';
import { callShipmentStatus, callOutboundStatus, callInboundStatus } from '@/lib/cs/functionsClient';

type StatusType = 'shipment' | 'outbound' | 'inbound';

interface StatusRequestBody {
  type: StatusType;
  params: Record<string, any>;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as StatusRequestBody;

    if (!body?.type) {
      return NextResponse.json({ error: 'type 필드는 필수입니다.' }, { status: 400 });
    }

    switch (body.type) {
      case 'shipment': {
        const data = await callShipmentStatus({
          orderNo: body.params?.orderNo,
          trackingNo: body.params?.trackingNo,
          limit: body.params?.limit,
        });
        return NextResponse.json(data);
      }
      case 'outbound': {
        const data = await callOutboundStatus({
          orderNo: body.params?.orderNo,
          outboundId: body.params?.outboundId,
          productName: body.params?.productName,
          limit: body.params?.limit,
        });
        return NextResponse.json(data);
      }
      case 'inbound': {
        const data = await callInboundStatus({
          asnNo: body.params?.asnNo,
          inboundId: body.params?.inboundId,
          productName: body.params?.productName,
          limit: body.params?.limit,
        });
        return NextResponse.json(data);
      }
      default:
        return NextResponse.json({ error: `지원되지 않는 type: ${body.type}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[api/cs/status] 오류', error);
    return NextResponse.json(
      {
        error: '상태 조회 중 오류가 발생했습니다.',
        details: error?.message ?? error,
      },
      { status: 500 },
    );
  }
}
