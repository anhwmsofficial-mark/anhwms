import { NextRequest } from 'next/server';
import { updateExternalQuoteInquiry } from '@/lib/api/externalQuotes';
import { updateInternationalQuoteInquiry } from '@/lib/api/internationalQuotes';
import { getAdminQuoteInquiryById } from '@/lib/api/adminQuoteInquiries';
import supabaseAdmin from '@/lib/supabase-admin';
import { QuoteInquirySalesStage, QuoteInquiryStatus } from '@/types';
import { createClient } from '@/utils/supabase/server';
import { logAssignment, logStatusChange } from '@/lib/api/actionLogs';
import { notifyAssignment, notifyStatusChange } from '@/lib/api/notifications';
import { logger } from '@/lib/logger';
import { fail, ok } from '@/lib/api/response';
import { requirePermission } from '@/utils/rbac';

const supabaseAdminUntyped = supabaseAdmin as unknown as {
  from: (table: string) => any;
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission('manage:orders', req);
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const inquiryType = (searchParams.get('type') ?? 'external') as 'external' | 'international';
    const inquiry = await getAdminQuoteInquiryById(id, inquiryType);

    if (!inquiry) {
      return fail('NOT_FOUND', '견적 문의를 찾을 수 없습니다.', { status: 404 });
    }

    return ok(inquiry, { status: 200 });
  } catch (error) {
    logger.error(error as Error, { scope: 'api', route: 'GET /api/admin/quote-inquiries/[id]' });
    return fail('INTERNAL_ERROR', '견적 문의 조회에 실패했습니다.', { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission('manage:orders', req);
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
      const { data: profile } = await supabaseAdminUntyped
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

    const { data: existingInquiry } = await supabaseAdminUntyped
      .from(table)
      .select('status, assigned_to, company_name')
      .eq('id', id)
      .maybeSingle();
    const existingInquiryRow = existingInquiry as {
      status?: string;
      assigned_to?: string | null;
      company_name?: string | null;
    } | null;

    const updates: {
      companyName?: string;
      contactName?: string;
      email?: string;
      phone?: string | null;
      skuCount?: number | null;
      memo?: string | null;
      status?: QuoteInquiryStatus;
      ownerUserId?: string | null;
      assignedTo?: string | null;
      salesStage?: QuoteInquirySalesStage | null;
      expectedRevenue?: number | null;
      winProbability?: number | null;
      lostReason?: string | null;
      source?: string | null;
      quoteFileUrl?: string | null;
      quoteSentAt?: Date | null;
    } = {};

    if (body.companyName !== undefined || body.company_name !== undefined) {
      updates.companyName = body.companyName ?? body.company_name;
    }

    if (body.contactName !== undefined || body.contact_name !== undefined) {
      updates.contactName = body.contactName ?? body.contact_name;
    }

    if (body.email !== undefined) {
      updates.email = body.email;
    }

    if (body.phone !== undefined) {
      updates.phone = body.phone;
    }

    if (body.skuCount !== undefined || body.sku_count !== undefined) {
      updates.skuCount = body.skuCount ?? body.sku_count;
    }

    if (body.memo !== undefined) {
      updates.memo = body.memo;
    }

    if (body.status) {
      updates.status = body.status as QuoteInquiryStatus;
    }

    if (body.owner_user_id !== undefined || body.ownerUserId !== undefined) {
      updates.ownerUserId = body.owner_user_id ?? body.ownerUserId;
    }

    if (body.assignedTo !== undefined || body.assigned_to !== undefined) {
      updates.assignedTo = body.assignedTo ?? body.assigned_to;
    }

    if (body.salesStage !== undefined || body.sales_stage !== undefined) {
      updates.salesStage = (body.salesStage ?? body.sales_stage) as QuoteInquirySalesStage | null;
    }

    if (body.expectedRevenue !== undefined || body.expected_revenue !== undefined) {
      const value = body.expectedRevenue ?? body.expected_revenue;
      updates.expectedRevenue = value === '' || value === null ? null : Number(value);
    }

    if (body.winProbability !== undefined || body.win_probability !== undefined) {
      const value = body.winProbability ?? body.win_probability;
      updates.winProbability = value === '' || value === null ? null : Number(value);
    }

    if (body.lostReason !== undefined || body.lost_reason !== undefined) {
      updates.lostReason = body.lostReason ?? body.lost_reason;
    }

    if (body.source !== undefined) {
      updates.source = body.source;
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

    if (updates.status && updates.status !== existingInquiryRow?.status) {
      await logStatusChange({
        inquiryId: id,
        inquiryType: inquiryLogType,
        actorId: user?.id || 'system',
        actorName,
        oldStatus: existingInquiryRow?.status || 'UNKNOWN',
        newStatus: updates.status,
      });

      if (updates.ownerUserId) {
        await notifyStatusChange({
          userId: updates.ownerUserId,
          inquiryId: id,
          inquiryType: inquiryLogType,
          companyName: existingInquiryRow?.company_name || id,
          oldStatus: existingInquiryRow?.status || 'UNKNOWN',
          newStatus: updates.status,
        }).catch((notificationError) => {
          logger.error(notificationError as Error, {
            scope: 'api',
            route: 'PATCH /api/admin/quote-inquiries/[id]',
            action: 'notifyStatusChange',
          });
        });
      }
    }

    if (updates.assignedTo !== undefined && updates.assignedTo !== existingInquiryRow?.assigned_to) {
      await logAssignment({
        inquiryId: id,
        inquiryType: inquiryLogType,
        actorId: user?.id || 'system',
        actorName,
        oldAssignee: existingInquiryRow?.assigned_to || undefined,
        newAssignee: updates.assignedTo || 'unassigned',
      });

      if (updates.assignedTo) {
        await notifyAssignment({
          assigneeId: updates.assignedTo,
          inquiryId: id,
          inquiryType: inquiryLogType,
          companyName: existingInquiryRow?.company_name || id,
        }).catch((notificationError) => {
          logger.error(notificationError as Error, {
            scope: 'api',
            route: 'PATCH /api/admin/quote-inquiries/[id]',
            action: 'notifyAssignment',
          });
        });
      }
    }

    return ok(updatedInquiry, { status: 200 });
  } catch (error) {
    logger.error(error as Error, { scope: 'api', route: 'PATCH /api/admin/quote-inquiries/[id]' });
    return fail('INTERNAL_ERROR', '견적 문의 업데이트에 실패했습니다.', { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission('manage:orders', req);
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const inquiryType = searchParams.get('type') ?? 'external';

    // 견적 문의 삭제
    const table =
      inquiryType === 'international' ? 'international_quote_inquiry' : 'external_quote_inquiry';
    const { error } = await supabaseAdminUntyped
      .from(table)
      .delete()
      .eq('id', id);

    if (error) throw error;

    return ok({ message: '견적 문의가 삭제되었습니다.' }, { status: 200 });
  } catch (error) {
    logger.error(error as Error, { scope: 'api', route: 'DELETE /api/admin/quote-inquiries/[id]' });
    return fail('INTERNAL_ERROR', '견적 문의 삭제에 실패했습니다.', { status: 500 });
  }
}