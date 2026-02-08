import { NextRequest, NextResponse } from 'next/server';
import { updateExternalQuoteInquiry } from '@/lib/api/externalQuotes';
import { updateInternationalQuoteInquiry } from '@/lib/api/internationalQuotes';
import supabaseAdmin from '@/lib/supabase-admin';
import { QuoteInquiryStatus } from '@/types';
import { createClient } from '@/utils/supabase/server';
import { logAssignment, logStatusChange } from '@/lib/api/actionLogs';
import { logger } from '@/lib/logger';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const inquiryType = body.inquiryType ?? body.inquiry_type ?? 'external';
    const inquiryLogType = inquiryType === 'international' ? 'international' : 'external';
    const table =
      inquiryType === 'international' ? 'international_quote_inquiry' : 'external_quote_inquiry';

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let actorName = 'system';
    if (user) {
      const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('display_name, full_name, email')
        .eq('id', user.id)
        .maybeSingle();
      actorName =
        profile?.display_name ||
        profile?.full_name ||
        profile?.email ||
        user.email ||
        'system';
    }

    const { data: existingInquiry } = await supabaseAdmin
      .from(table)
      .select('status, assigned_to')
      .eq('id', id)
      .maybeSingle();

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

    if (updates.status && updates.status !== existingInquiry?.status) {
      await logStatusChange({
        inquiryId: id,
        inquiryType: inquiryLogType,
        actorId: user?.id || 'system',
        actorName,
        oldStatus: existingInquiry?.status || 'UNKNOWN',
        newStatus: updates.status,
      });
    }

    if (updates.assignedTo !== undefined && updates.assignedTo !== existingInquiry?.assigned_to) {
      await logAssignment({
        inquiryId: id,
        inquiryType: inquiryLogType,
        actorId: user?.id || 'system',
        actorName,
        oldAssignee: existingInquiry?.assigned_to || undefined,
        newAssignee: updates.assignedTo || 'unassigned',
      });
    }

    return NextResponse.json({ data: updatedInquiry }, { status: 200 });
  } catch (error) {
    logger.error(error as Error, { scope: 'api', route: 'PATCH /api/admin/quote-inquiries/[id]' });
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
    logger.error(error as Error, { scope: 'api', route: 'DELETE /api/admin/quote-inquiries/[id]' });
    return NextResponse.json(
      { error: '견적 문의 삭제에 실패했습니다.' },
      { status: 500 },
    );
  }
}