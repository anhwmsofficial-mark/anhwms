import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { QuoteInquiryStatus } from '@/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') as QuoteInquiryStatus | null;
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    // 국내 견적과 해외 견적을 통합 조회
    let domesticQuery = supabase
      .from('external_quote_inquiry')
      .select('*')
      .order('created_at', { ascending: false });

    let internationalQuery = supabase
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
      ...item,
      type: 'domestic',
      companyName: item.company_name,
      contactName: item.contact_name,
      monthlyOutboundRange: item.monthly_outbound_range,
      skuCount: item.sku_count,
      productCategories: item.product_categories,
      extraServices: item.extra_services,
    }));

    // 해외 견적에 type 필드 추가
    const internationalInquiries = (internationalResult.data || []).map((item: any) => ({
      ...item,
      type: 'international',
      companyName: item.company_name,
      contactName: item.contact_name,
      destinationCountries: item.destination_countries,
      shippingMethod: item.shipping_method,
      monthlyVolume: item.monthly_volume,
      productCharacteristics: item.product_characteristics,
    }));

    // 통합하여 날짜순으로 정렬
    const allInquiries = [...domesticInquiries, ...internationalInquiries].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
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

