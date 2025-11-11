import { NextResponse } from 'next/server';
import { callInventoryBySku } from '@/lib/cs/functionsClient';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sku = body?.sku;

    if (!sku) {
      return NextResponse.json({ error: 'sku 필드는 필수입니다.' }, { status: 400 });
    }

    const data = await callInventoryBySku({ sku });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[api/cs/inventory] 오류', error);
    return NextResponse.json(
      {
        error: '재고 조회 중 오류가 발생했습니다.',
        details: error?.message ?? error,
      },
      { status: 500 },
    );
  }
}
