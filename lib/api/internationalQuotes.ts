import supabaseAdmin from '@/lib/supabase-admin';
import {
  CreateInternationalQuoteInquiryInput,
  InternationalQuoteInquiry,
  MonthlyShipmentVolume,
  QuoteInquiryStatus,
  ShippingMethod,
  TradeTerms,
} from '@/types';

export const MONTHLY_SHIPMENT_VOLUME_VALUES: MonthlyShipmentVolume[] = [
  '0_100',
  '100_500',
  '500_1000',
  '1000_3000',
  '3000_plus',
];

export const SHIPPING_METHOD_VALUES: ShippingMethod[] = ['air', 'express', 'sea', 'combined'];

export const TRADE_TERMS_VALUES: TradeTerms[] = ['FOB', 'DDP', 'EXW', 'CIF', 'not_sure'];

const DEFAULT_STATUS: QuoteInquiryStatus = 'new';

function mapInternationalQuoteRow(row: any): InternationalQuoteInquiry {
  return {
    id: row.id,
    companyName: row.company_name,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    destinationCountries: row.destination_countries ?? [],
    shippingMethod: row.shipping_method,
    monthlyShipmentVolume: row.monthly_shipment_volume,
    avgBoxWeight: row.avg_box_weight,
    skuCount: row.sku_count,
    productCategories: row.product_categories ?? [],
    productCharacteristics: row.product_characteristics ?? [],
    customsSupportNeeded: row.customs_support_needed ?? false,
    tradeTerms: row.trade_terms,
    memo: row.memo,
    status: row.status,
    ownerUserId: row.owner_user_id,
    source: row.source,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
  };
}

export async function createInternationalQuoteInquiry(
  input: CreateInternationalQuoteInquiryInput,
): Promise<InternationalQuoteInquiry> {
  const payload = {
    company_name: input.companyName.trim(),
    contact_name: input.contactName.trim(),
    email: input.email.trim(),
    phone: input.phone?.trim() || null,
    destination_countries: Array.isArray(input.destinationCountries)
      ? input.destinationCountries
      : [],
    shipping_method: input.shippingMethod || null,
    monthly_shipment_volume: input.monthlyShipmentVolume,
    avg_box_weight: typeof input.avgBoxWeight === 'number' ? input.avgBoxWeight : null,
    sku_count: typeof input.skuCount === 'number' ? input.skuCount : null,
    product_categories: Array.isArray(input.productCategories) ? input.productCategories : [],
    product_characteristics: Array.isArray(input.productCharacteristics)
      ? input.productCharacteristics
      : [],
    customs_support_needed: input.customsSupportNeeded ?? false,
    trade_terms: input.tradeTerms || null,
    memo: input.memo?.trim() || null,
    status: input.status ?? DEFAULT_STATUS,
    owner_user_id: input.ownerUserId ?? null,
    source: input.source ?? 'web_form',
  };

  const { data, error } = await supabaseAdmin
    .from('international_quote_inquiry')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    console.error('[createInternationalQuoteInquiry] insert failed', error);
    throw new Error('해외배송 견적 문의 저장에 실패했습니다.');
  }

  return mapInternationalQuoteRow(data);
}

export async function getInternationalQuoteInquiries(filters?: {
  status?: QuoteInquiryStatus;
  source?: string;
  limit?: number;
  offset?: number;
}): Promise<InternationalQuoteInquiry[]> {
  let query = supabaseAdmin.from('international_quote_inquiry').select('*');

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
    console.error('[getInternationalQuoteInquiries] select failed', error);
    throw new Error('해외배송 견적 문의 목록 조회에 실패했습니다.');
  }

  return (data || []).map(mapInternationalQuoteRow);
}

export async function updateInternationalQuoteInquiry(
  id: string,
  updates: {
    status?: QuoteInquiryStatus;
    ownerUserId?: string | null;
    assignedTo?: string | null;
    quoteFileUrl?: string | null;
    quoteSentAt?: Date | null;
  },
): Promise<InternationalQuoteInquiry> {
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
    .from('international_quote_inquiry')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error('[updateInternationalQuoteInquiry] update failed', error);
    throw new Error('해외배송 견적 문의 업데이트에 실패했습니다.');
  }

  return mapInternationalQuoteRow(data);
}

