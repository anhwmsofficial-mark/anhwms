import { NextRequest, NextResponse } from 'next/server';
import { getExternalQuoteInquiries } from '@/lib/api/externalQuotes';
import { QuoteInquiryStatus } from '@/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') as QuoteInquiryStatus | null;
    const source = searchParams.get('source');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const inquiries = await getExternalQuoteInquiries({
      status: status || undefined,
      source: source || undefined,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });

    return NextResponse.json({ data: inquiries }, { status: 200 });
  } catch (error) {
    console.error('[GET /api/admin/quote-inquiries] error:', error);
    return NextResponse.json(
      { error: '견적 문의 목록 조회에 실패했습니다.' },
      { status: 500 },
    );
  }
}

