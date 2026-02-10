import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createClient } from '@/utils/supabase/server';

const normalizeBarcode = (input: string) => input.replace(/\s|-/g, '');

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    const clientId = searchParams.get('clientId') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
    const offset = (page - 1) * limit;

    const baseSelect =
      'id, name, sku, barcode, category, customer_id, brand_id, barcodes:product_barcodes(barcode, barcode_type, is_primary), brand:brand_id(customer_master_id, name_ko)';

    // 1) 목록 탭: q가 없으면 기본 리스트 반환
    if (!q) {
      let rows: any[] = [];
      let total = 0;

      if (clientId) {
        const [byCustomer, byBrand] = await Promise.all([
          supabaseAdmin
            .from('products')
            .select(baseSelect, { count: 'exact' })
            .eq('customer_id', clientId)
            .order('created_at', { ascending: false })
            .limit(200),
          supabaseAdmin
            .from('products')
            .select(baseSelect, { count: 'exact' })
            .eq('brand.customer_master_id', clientId)
            .order('created_at', { ascending: false })
            .limit(200),
        ]);

        if (byCustomer.error && byBrand.error) {
          console.error('Product list error:', byCustomer.error || byBrand.error);
          return NextResponse.json({ error: '제품 목록 조회에 실패했습니다.' }, { status: 500 });
        }

        rows = [...(byCustomer.data || []), ...(byBrand.data || [])];
        total = (byCustomer.count || 0) + (byBrand.count || 0);
      } else {
        const listQuery = supabaseAdmin
          .from('products')
          .select(baseSelect, { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        const { data, error, count } = await listQuery;
        if (error) {
          console.error('Product list error:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        rows = data || [];
        total = count || 0;
      }

      const uniq = Array.from(new Map(rows.map((p: any) => [p.id, p])).values());
      const paged = clientId ? uniq.slice(offset, offset + limit) : uniq;

      return NextResponse.json({
        data: paged,
        pagination: {
          page,
          limit,
          total: clientId ? uniq.length : total,
          totalPages: Math.ceil((clientId ? uniq.length : total) / limit),
        },
      });
    }

    // 2) 검색 탭: 이름/sku/barcode + barcode table 통합 검색
    const search = q;
    const barcodeCandidate = normalizeBarcode(q);

    const buildTextQuery = () =>
      supabaseAdmin
        .from('products')
        .select(baseSelect)
        .or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`)
        .limit(20);

    let textResults: any[] = [];
    if (clientId) {
      const [byCustomer, byBrand] = await Promise.all([
        buildTextQuery().eq('customer_id', clientId),
        buildTextQuery().eq('brand.customer_master_id', clientId),
      ]);
      textResults = [...(byCustomer.data || []), ...(byBrand.data || [])];
    } else {
      const { data } = await buildTextQuery();
      textResults = data || [];
    }

    let barcodeProductIds: string[] = [];
    if (barcodeCandidate.length >= 4) {
      let barcodeQuery = supabaseAdmin
        .from('product_barcodes')
        .select('product_id')
        .ilike('barcode', `%${barcodeCandidate}%`)
        .limit(20);

      const { data: barcodeHits } = await barcodeQuery;
      barcodeProductIds = (barcodeHits || []).map((b) => b.product_id);
    }

    let barcodeResults: any[] = [];
    if (barcodeProductIds.length > 0) {
      let barcodeProductsQuery = supabaseAdmin
        .from('products')
        .select(baseSelect)
        .in('id', barcodeProductIds)
        .limit(20);

      if (clientId) {
        const [byCustomer, byBrand] = await Promise.all([
          supabaseAdmin
            .from('products')
            .select(baseSelect)
            .in('id', barcodeProductIds)
            .eq('customer_id', clientId)
            .limit(20),
          barcodeProductsQuery.eq('brand.customer_master_id', clientId),
        ]);
        barcodeResults = [...(byCustomer.data || []), ...(byBrand.data || [])];
      } else {
        const { data } = await barcodeProductsQuery;
        barcodeResults = data || [];
      }
    }

    const merged = [...(textResults || []), ...barcodeResults];
    const uniq = Array.from(new Map(merged.map((p: any) => [p.id, p])).values());

    return NextResponse.json({
      data: uniq,
      pagination: { page: 1, limit: 20, total: uniq.length, totalPages: 1 }
    });
  } catch (error: any) {
    console.error('GET /api/products/search error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
