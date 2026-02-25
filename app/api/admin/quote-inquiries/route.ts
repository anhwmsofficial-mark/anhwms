/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabase-admin';
import { QuoteInquiryStatus } from '@/types';
import { requirePermission } from '@/utils/rbac';

export async function GET(req: NextRequest) {
  try {
    await requirePermission('manage:orders', req);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') as QuoteInquiryStatus | null;
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    // 국내 견적과 해외 견적을 통합 조회
    let domesticQuery = supabaseAdmin
      .from('external_quote_inquiry')
      .select('*')
      .order('created_at', { ascending: false });

    let internationalQuery = supabaseAdmin
      .from('international_quote_inquiry')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      domesticQuery = domesticQuery.eq('status', status);
      internationalQuery = internationalQuery.eq('status', status);
    }

    if (limit) {
      const limitNum = parseInt(limit);
      domesticQuery = domesticQuery.limit(limitNum);
      internationalQuery = internationalQuery.limit(limitNum);
    }

    if (offset) {
      const offsetNum = parseInt(offset);
      domesticQuery = domesticQuery.range(offsetNum, offsetNum + (limit ? parseInt(limit) : 50) - 1);
      internationalQuery = internationalQuery.range(offsetNum, offsetNum + (limit ? parseInt(limit) : 50) - 1);
    }

    const [domesticResult, internationalResult] = await Promise.all([
      domesticQuery,
      internationalQuery,
    ]);

    if (domesticResult.error) throw domesticResult.error;
    if (internationalResult.error) throw internationalResult.error;

    // 국내 견적에 type 필드 추가
    const domesticInquiries = (domesticResult.data || []).map((item: any) => ({
      id: item.id,
      type: 'domestic',
      companyName: item.company_name,
      contactName: item.contact_name,
      email: item.email,
      phone: item.phone,
      monthlyOutboundRange: item.monthly_outbound_range,
      skuCount: item.sku_count,
      productCategories: item.product_categories ?? [],
      extraServices: item.extra_services ?? [],
      memo: item.memo,
      status: item.status,
      ownerUserId: item.owner_user_id,
      source: item.source,
      assignedTo: item.assigned_to,
      quoteFileUrl: item.quote_file_url,
      quoteSentAt: item.quote_sent_at,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }));

    // 해외 견적에 type 필드 추가
    const internationalInquiries = (internationalResult.data || []).map((item: any) => ({
      id: item.id,
      type: 'international',
      companyName: item.company_name,
      contactName: item.contact_name,
      email: item.email,
      phone: item.phone,
      destinationCountries: item.destination_countries ?? [],
      shippingMethod: item.shipping_method,
      monthlyShipmentVolume: item.monthly_shipment_volume,
      avgBoxWeight: item.avg_box_weight,
      skuCount: item.sku_count,
      productCategories: item.product_categories ?? [],
      productCharacteristics: item.product_characteristics ?? [],
      customsSupportNeeded: item.customs_support_needed ?? false,
      tradeTerms: item.trade_terms,
      memo: item.memo,
      status: item.status,
      ownerUserId: item.owner_user_id,
      source: item.source,
      assignedTo: item.assigned_to,
      quoteFileUrl: item.quote_file_url,
      quoteSentAt: item.quote_sent_at,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }));

    // 통합하여 날짜순으로 정렬
    const allInquiries = [...domesticInquiries, ...internationalInquiries].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ data: allInquiries }, { status: 200 });
  } catch (error) {
    console.error('[GET /api/admin/quote-inquiries] error:', error);
    return NextResponse.json(
      { error: '견적 문의 목록 조회에 실패했습니다.' },
      { status: 500 },
    );
  }
}

