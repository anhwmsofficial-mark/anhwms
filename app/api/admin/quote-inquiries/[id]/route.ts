import { NextRequest, NextResponse } from 'next/server';
import { updateExternalQuoteInquiry } from '@/lib/api/externalQuotes';
import { QuoteInquiryStatus } from '@/types';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updates: { status?: QuoteInquiryStatus; ownerUserId?: string | null } = {};

    if (body.status) {
      updates.status = body.status as QuoteInquiryStatus;
    }

    if (body.owner_user_id !== undefined || body.ownerUserId !== undefined) {
      updates.ownerUserId = body.owner_user_id ?? body.ownerUserId;
    }

    const updatedInquiry = await updateExternalQuoteInquiry(id, updates);

    return NextResponse.json({ data: updatedInquiry }, { status: 200 });
  } catch (error) {
    console.error('[PATCH /api/admin/quote-inquiries/[id]] error:', error);
    return NextResponse.json(
      { error: '견적 문의 업데이트에 실패했습니다.' },
      { status: 500 },
    );
  }
}

