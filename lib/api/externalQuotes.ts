import supabaseAdmin from '@/lib/supabase-admin';
import {
  CreateExternalQuoteInquiryInput,
  ExternalQuoteInquiry,
  MonthlyOutboundRange,
  QuoteInquiryStatus,
} from '@/types';

export const MONTHLY_OUTBOUND_RANGE_VALUES: MonthlyOutboundRange[] = [
  '0_1000',
  '1000_2000',
  '2000_3000',
  '3000_5000',
  '5000_10000',
  '10000_30000',
  '30000_plus',
];

const DEFAULT_STATUS: QuoteInquiryStatus = 'new';

function mapExternalQuoteRow(row: any): ExternalQuoteInquiry {
  return {
    id: row.id,
    companyName: row.company_name,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    monthlyOutboundRange: row.monthly_outbound_range,
    skuCount: row.sku_count,
    productCategories: row.product_categories ?? [],
    extraServices: row.extra_services ?? [],
    memo: row.memo,
    status: row.status,
    ownerUserId: row.owner_user_id,
    source: row.source,
    assignedTo: row.assigned_to,
    quoteFileUrl: row.quote_file_url,
    quoteSentAt: row.quote_sent_at ? new Date(row.quote_sent_at) : null,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
  };
}

export async function createExternalQuoteInquiry(
  input: CreateExternalQuoteInquiryInput,
): Promise<ExternalQuoteInquiry> {
  const payload = {
    company_name: input.companyName.trim(),
    contact_name: input.contactName.trim(),
    email: input.email.trim(),
    phone: input.phone?.trim() || null,
    monthly_outbound_range: input.monthlyOutboundRange,
    sku_count: typeof input.skuCount === 'number' ? input.skuCount : null,
    product_categories: Array.isArray(input.productCategories) ? input.productCategories : [],
    extra_services: Array.isArray(input.extraServices) ? input.extraServices : [],
    memo: input.memo?.trim() || null,
    status: input.status ?? DEFAULT_STATUS,
    owner_user_id: input.ownerUserId ?? null,
    source: input.source ?? 'web_form',
  };

  const { data, error } = await supabaseAdmin
    .from('external_quote_inquiry')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    console.error('[createExternalQuoteInquiry] insert failed', error);
    throw new Error('외부 견적 문의 저장에 실패했습니다.');
  }

  return mapExternalQuoteRow(data);
}

export async function getExternalQuoteInquiries(filters?: {
  status?: QuoteInquiryStatus;
  source?: string;
  limit?: number;
  offset?: number;
}): Promise<ExternalQuoteInquiry[]> {
  let query = supabaseAdmin.from('external_quote_inquiry').select('*');

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.source) {
    query = query.eq('source', filters.source);
  }

  query = query.order('created_at', { ascending: false });

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[getExternalQuoteInquiries] select failed', error);
    throw new Error('견적 문의 목록 조회에 실패했습니다.');
  }

  return (data || []).map(mapExternalQuoteRow);
}

export async function updateExternalQuoteInquiry(
  id: string,
  updates: {
    status?: QuoteInquiryStatus;
    ownerUserId?: string | null;
    assignedTo?: string | null;
    quoteFileUrl?: string | null;
    quoteSentAt?: Date | null;
  },
): Promise<ExternalQuoteInquiry> {
  const payload: any = {};

  if (updates.status) {
    payload.status = updates.status;
  }

  if (updates.ownerUserId !== undefined) {
    payload.owner_user_id = updates.ownerUserId;
  }

  if (updates.assignedTo !== undefined) {
    payload.assigned_to = updates.assignedTo;
  }

  if (updates.quoteFileUrl !== undefined) {
    payload.quote_file_url = updates.quoteFileUrl;
  }

  if (updates.quoteSentAt !== undefined) {
    payload.quote_sent_at = updates.quoteSentAt;
  }

  const { data, error } = await supabaseAdmin
    .from('external_quote_inquiry')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error('[updateExternalQuoteInquiry] update failed', error);
    throw new Error('견적 문의 업데이트에 실패했습니다.');
  }

  return mapExternalQuoteRow(data);
}

