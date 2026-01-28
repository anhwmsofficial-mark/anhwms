import { NextRequest, NextResponse } from 'next/server';
import { updateExternalQuoteInquiry } from '@/lib/api/externalQuotes';
import { updateInternationalQuoteInquiry } from '@/lib/api/internationalQuotes';
import supabaseAdmin from '@/lib/supabase-admin';
import { QuoteInquiryStatus } from '@/types';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const inquiryType = body.inquiryType ?? body.inquiry_type ?? 'external';

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

    const updatedInquiry =
      inquiryType === 'international'
        ? await updateInternationalQuoteInquiry(id, updates)
        : await updateExternalQuoteInquiry(id, updates);

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
    const { searchParams } = new URL(req.url);
    const inquiryType = searchParams.get('type') ?? 'external';

    // 견적 문의 삭제
    const table =
      inquiryType === 'international' ? 'international_quote_inquiry' : 'external_quote_inquiry';
    const { error } = await supabaseAdmin
      .from(table)
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