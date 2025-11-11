import { NextResponse } from 'next/server';
import { callDocument } from '@/lib/cs/functionsClient';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const orderNo = body?.orderNo;

    if (!orderNo) {
      return NextResponse.json({ error: 'orderNo 필드는 필수입니다.' }, { status: 400 });
    }

    const documentType = body?.documentType;
    const data = await callDocument({ orderNo, documentType });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[api/cs/document] 오류', error);
    return NextResponse.json(
      {
        error: '문서 링크 조회 중 오류가 발생했습니다.',
        details: error?.message ?? error,
      },
      { status: 500 },
    );
  }
}
