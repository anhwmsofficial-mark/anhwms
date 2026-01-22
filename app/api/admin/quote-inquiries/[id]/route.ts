import { NextRequest, NextResponse } from 'next/server';
import { updateExternalQuoteInquiry } from '@/lib/api/externalQuotes';
import { supabase } from '@/lib/supabase';
import { QuoteInquiryStatus } from '@/types';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updates: {
      status?: QuoteInquiryStatus;
      ownerUserId?: string | null;
      assignedTo?: string | null;
      quoteFileUrl?: string | null;
      quoteSentAt?: Date | null;
    } = {};

    if (body.status) {
      updates.status = body.status as QuoteInquiryStatus;
    }

    if (body.owner_user_id !== undefined || body.ownerUserId !== undefined) {
      updates.ownerUserId = body.owner_user_id ?? body.ownerUserId;
    }

    if (body.assignedTo !== undefined || body.assigned_to !== undefined) {
      updates.assignedTo = body.assignedTo ?? body.assigned_to;
    }

    if (body.quoteFileUrl !== undefined || body.quote_file_url !== undefined) {
      updates.quoteFileUrl = body.quoteFileUrl ?? body.quote_file_url;
    }

    if (body.quoteSentAt !== undefined || body.quote_sent_at !== undefined) {
      const dateValue = body.quoteSentAt ?? body.quote_sent_at;
      updates.quoteSentAt = dateValue ? new Date(dateValue) : null;
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // 견적 문의 삭제
    const { error } = await supabase
      .from('external_quote_inquiry')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json(
      { message: '견적 문의가 삭제되었습니다.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('[DELETE /api/admin/quote-inquiries/[id]] error:', error);
    return NextResponse.json(
      { error: '견적 문의 삭제에 실패했습니다.' },
      { status: 500 },
    );
  }
}
