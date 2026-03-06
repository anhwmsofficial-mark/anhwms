import supabaseAdmin from '@/lib/supabase-admin';
import {
  ExternalQuoteInquiry,
  InternationalQuoteInquiry,
  QuoteInquirySalesStage,
  QuoteInquiryStatus,
} from '@/types';

type InquiryType = 'external' | 'international';

type InquiryUserProfile = {
  id: string;
  email: string | null;
  display_name: string | null;
  full_name: string | null;
};

type ExternalQuoteRow = {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  monthly_outbound_range: string;
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

type InternationalQuoteRow = {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  destination_countries: string[] | null;
  shipping_method: string | null;
  monthly_shipment_volume: string;
  avg_box_weight: number | null;
  sku_count: number | null;
  product_categories: string[] | null;
  product_characteristics: string[] | null;
  customs_support_needed: boolean | null;
  trade_terms: string | null;
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

export type AdminQuoteInquiry =
  | (ExternalQuoteInquiry & { type: 'domestic' })
  | (InternationalQuoteInquiry & { type: 'international' });

const db = supabaseAdmin as unknown as {
  from: (table: string) => any;
};

const getProfileName = (profile?: InquiryUserProfile | null) =>
  profile?.display_name || profile?.full_name || profile?.email || null;

async function getUserProfileMap(userIds: Array<string | null | undefined>) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean))) as string[];
  if (uniqueIds.length === 0) return new Map<string, InquiryUserProfile>();

  const { data, error } = await db
    .from('user_profiles')
    .select('id,email,display_name,full_name')
    .in('id', uniqueIds);

  if (error) {
    console.error('[adminQuoteInquiries] failed to fetch profile map', error);
    throw new Error('담당자 정보를 불러오지 못했습니다.');
  }

  return new Map((data || []).map((row: InquiryUserProfile) => [row.id, row]));
}

function mapExternalQuoteRow(
  row: ExternalQuoteRow,
  profileMap: Map<string, InquiryUserProfile>,
): AdminQuoteInquiry {
  return {
    id: row.id,
    type: 'domestic',
    companyName: row.company_name,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    monthlyOutboundRange: row.monthly_outbound_range as ExternalQuoteInquiry['monthlyOutboundRange'],
    skuCount: row.sku_count,
    productCategories: row.product_categories ?? [],
    extraServices: row.extra_services ?? [],
    memo: row.memo,
    status: row.status,
    ownerUserId: row.owner_user_id,
    ownerName: getProfileName(profileMap.get(row.owner_user_id || '')),
    source: row.source,
    assignedTo: row.assigned_to,
    assignedToName: getProfileName(profileMap.get(row.assigned_to || '')),
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

function mapInternationalQuoteRow(
  row: InternationalQuoteRow,
  profileMap: Map<string, InquiryUserProfile>,
): AdminQuoteInquiry {
  return {
    id: row.id,
    type: 'international',
    companyName: row.company_name,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    destinationCountries: row.destination_countries ?? [],
    shippingMethod: row.shipping_method as InternationalQuoteInquiry['shippingMethod'],
    monthlyShipmentVolume:
      row.monthly_shipment_volume as InternationalQuoteInquiry['monthlyShipmentVolume'],
    avgBoxWeight: row.avg_box_weight,
    skuCount: row.sku_count,
    productCategories: row.product_categories ?? [],
    productCharacteristics: row.product_characteristics ?? [],
    customsSupportNeeded: row.customs_support_needed ?? false,
    tradeTerms: row.trade_terms as InternationalQuoteInquiry['tradeTerms'],
    memo: row.memo,
    status: row.status,
    ownerUserId: row.owner_user_id,
    ownerName: getProfileName(profileMap.get(row.owner_user_id || '')),
    source: row.source,
    assignedTo: row.assigned_to,
    assignedToName: getProfileName(profileMap.get(row.assigned_to || '')),
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

export async function listAdminQuoteInquiries(filters?: {
  status?: QuoteInquiryStatus | null;
}): Promise<AdminQuoteInquiry[]> {
  let externalQuery = db.from('external_quote_inquiry').select('*').order('created_at', { ascending: false });
  let internationalQuery = db.from('international_quote_inquiry').select('*').order('created_at', { ascending: false });

  if (filters?.status) {
    externalQuery = externalQuery.eq('status', filters.status);
    internationalQuery = internationalQuery.eq('status', filters.status);
  }

  const [externalResult, internationalResult] = await Promise.all([externalQuery, internationalQuery]);

  if (externalResult.error) throw externalResult.error;
  if (internationalResult.error) throw internationalResult.error;

  const externalRows = (externalResult.data || []) as ExternalQuoteRow[];
  const internationalRows = (internationalResult.data || []) as InternationalQuoteRow[];

  const profileMap = await getUserProfileMap([
    ...externalRows.flatMap((row) => [row.owner_user_id, row.assigned_to]),
    ...internationalRows.flatMap((row) => [row.owner_user_id, row.assigned_to]),
  ]);

  return [
    ...externalRows.map((row) => mapExternalQuoteRow(row, profileMap)),
    ...internationalRows.map((row) => mapInternationalQuoteRow(row, profileMap)),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getAdminQuoteInquiryById(
  id: string,
  inquiryType: InquiryType,
): Promise<AdminQuoteInquiry | null> {
  const table =
    inquiryType === 'international' ? 'international_quote_inquiry' : 'external_quote_inquiry';

  const { data, error } = await db.from(table).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as ExternalQuoteRow | InternationalQuoteRow;
  const profileMap = await getUserProfileMap([row.owner_user_id, row.assigned_to]);

  return inquiryType === 'international'
    ? mapInternationalQuoteRow(row as InternationalQuoteRow, profileMap)
    : mapExternalQuoteRow(row as ExternalQuoteRow, profileMap);
}
