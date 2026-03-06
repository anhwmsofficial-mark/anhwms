import supabaseAdmin from '@/lib/supabase-admin';
import {
  CreateExternalQuoteInquiryInput,
  ExternalQuoteInquiry,
  MonthlyOutboundRange,
  QuoteInquirySalesStage,
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

type ExternalQuoteRow = {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  monthly_outbound_range: MonthlyOutboundRange;
  sku_count: number | null;
  product_categories: string[] | null;
  extra_services: string[] | null;
  memo: string | null;
  status: QuoteInquiryStatus;
  owner_user_id: string | null;
  source: string | null;
  assigned_to: string | null;
  sales_stage: QuoteInquirySalesStage | null;
  expected_revenue: number | null;
  win_probability: number | null;
  lost_reason: string | null;
  quote_file_url: string | null;
  quote_sent_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function mapExternalQuoteRow(row: ExternalQuoteRow): ExternalQuoteInquiry {
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
    salesStage: row.sales_stage,
    expectedRevenue: row.expected_revenue,
    winProbability: row.win_probability,
    lostReason: row.lost_reason,
    quoteFileUrl: row.quote_file_url,
    quoteSentAt: row.quote_sent_at ? new Date(row.quote_sent_at) : null,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
  };
}

export async function createExternalQuoteInquiry(
  input: CreateExternalQuoteInquiryInput,
): Promise<ExternalQuoteInquiry> {
  const db = supabaseAdmin as unknown as {
    from: (table: string) => any;
  };
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

  const { data, error } = await db
    .from('external_quote_inquiry')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    console.error('[createExternalQuoteInquiry] insert failed', error);
    throw new Error('외부 견적 문의 저장에 실패했습니다.');
  }

  return mapExternalQuoteRow(data as ExternalQuoteRow);
}

export async function getExternalQuoteInquiries(filters?: {
  status?: QuoteInquiryStatus;
  source?: string;
  limit?: number;
  offset?: number;
}): Promise<ExternalQuoteInquiry[]> {
  const db = supabaseAdmin as unknown as {
    from: (table: string) => any;
  };
  let query = db.from('external_quote_inquiry').select('*');

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

  return ((data || []) as ExternalQuoteRow[]).map(mapExternalQuoteRow);
}

export async function updateExternalQuoteInquiry(
  id: string,
  updates: {
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
  },
): Promise<ExternalQuoteInquiry> {
  const db = supabaseAdmin as unknown as {
    from: (table: string) => any;
  };
  const payload: Record<string, unknown> = {};

  if (updates.companyName !== undefined) {
    payload.company_name = updates.companyName.trim();
  }

  if (updates.contactName !== undefined) {
    payload.contact_name = updates.contactName.trim();
  }

  if (updates.email !== undefined) {
    payload.email = updates.email.trim().toLowerCase();
  }

  if (updates.phone !== undefined) {
    payload.phone = updates.phone?.trim() || null;
  }

  if (updates.skuCount !== undefined) {
    payload.sku_count = updates.skuCount;
  }

  if (updates.memo !== undefined) {
    payload.memo = updates.memo?.trim() || null;
  }

  if (updates.status) {
    payload.status = updates.status;
  }

  if (updates.ownerUserId !== undefined) {
    payload.owner_user_id = updates.ownerUserId;
  }

  if (updates.assignedTo !== undefined) {
    payload.assigned_to = updates.assignedTo;
  }

  if (updates.salesStage !== undefined) {
    payload.sales_stage = updates.salesStage;
  }

  if (updates.expectedRevenue !== undefined) {
    payload.expected_revenue = updates.expectedRevenue;
  }

  if (updates.winProbability !== undefined) {
    payload.win_probability = updates.winProbability;
  }

  if (updates.lostReason !== undefined) {
    payload.lost_reason = updates.lostReason?.trim() || null;
  }

  if (updates.source !== undefined) {
    payload.source = updates.source?.trim() || null;
  }

  if (updates.quoteFileUrl !== undefined) {
    payload.quote_file_url = updates.quoteFileUrl;
  }

  if (updates.quoteSentAt !== undefined) {
    payload.quote_sent_at = updates.quoteSentAt;
  }

  const { data, error } = await db
    .from('external_quote_inquiry')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error('[updateExternalQuoteInquiry] update failed', error);
    throw new Error('견적 문의 업데이트에 실패했습니다.');
  }

  return mapExternalQuoteRow(data as ExternalQuoteRow);
}

