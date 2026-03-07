import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createClient } from '@/utils/supabase/server';
import { getErrorMessage } from '@/lib/errorHandler';
import { escapeLike } from '@/lib/utils';

const normalizeBarcode = (input: string) => input.replace(/\s|-/g, '');

type ProductSearchRow = {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  category?: string | null;
  customer_id?: string | null;
  brand_id?: string | null;
  barcodes?: Array<{ barcode: string; barcode_type?: string; is_primary?: boolean }>;
  brand?: { customer_master_id?: string; name_ko?: string } | null;
};

export async function GET(request: NextRequest) {
  try {
    const db = supabaseAdmin as unknown as {
      from: (table: string) => any;
    };
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
      let rows: ProductSearchRow[] = [];
      let total = 0;

      if (clientId) {
        const [byCustomer, byBrand] = await Promise.all([
          db
            .from('products')
            .select(baseSelect, { count: 'exact' })
            .eq('customer_id', clientId)
            .order('created_at', { ascending: false })
            .limit(200),
          db
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

        rows = [
          ...((byCustomer.data || []) as unknown as ProductSearchRow[]),
          ...((byBrand.data || []) as unknown as ProductSearchRow[]),
        ];
        total = (byCustomer.count || 0) + (byBrand.count || 0);
      } else {
        const listQuery = db
          .from('products')
          .select(baseSelect, { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        const { data, error, count } = await listQuery;
        if (error) {
          console.error('Product list error:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        rows = (data || []) as unknown as ProductSearchRow[];
        total = count || 0;
      }

      const uniq = Array.from(new Map(rows.map((p) => [p.id, p])).values());
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
    const search = escapeLike(q);
    const barcodeCandidate = normalizeBarcode(q);

    const buildTextQuery = () =>
      db
        .from('products')
        .select(baseSelect)
        .or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`)
        .limit(20);

    let textResults: ProductSearchRow[] = [];
    if (clientId) {
      const [byCustomer, byBrand] = await Promise.all([
        buildTextQuery().eq('customer_id', clientId),
        buildTextQuery().eq('brand.customer_master_id', clientId),
      ]);
      textResults = [
        ...((byCustomer.data || []) as unknown as ProductSearchRow[]),
        ...((byBrand.data || []) as unknown as ProductSearchRow[]),
      ];
    } else {
      const { data } = await buildTextQuery();
      textResults = (data || []) as unknown as ProductSearchRow[];
    }

    let barcodeProductIds: string[] = [];
    if (barcodeCandidate.length >= 4) {
      const barcodeQuery = db
        .from('product_barcodes')
        .select('product_id')
        .ilike('barcode', `%${escapeLike(barcodeCandidate)}%`)
        .limit(20);

      const { data: barcodeHits } = await barcodeQuery;
      barcodeProductIds = (barcodeHits || []).map((b: any) => b.product_id);
    }

    let barcodeResults: ProductSearchRow[] = [];
    if (barcodeProductIds.length > 0) {
      const barcodeProductsQuery = db
        .from('products')
        .select(baseSelect)
        .in('id', barcodeProductIds)
        .limit(20);

      if (clientId) {
        const [byCustomer, byBrand] = await Promise.all([
          db
            .from('products')
            .select(baseSelect)
            .in('id', barcodeProductIds)
            .eq('customer_id', clientId)
            .limit(20),
          barcodeProductsQuery.eq('brand.customer_master_id', clientId),
        ]);
        barcodeResults = [
          ...((byCustomer.data || []) as unknown as ProductSearchRow[]),
          ...((byBrand.data || []) as unknown as ProductSearchRow[]),
        ];
      } else {
        const { data } = await barcodeProductsQuery;
        barcodeResults = (data || []) as unknown as ProductSearchRow[];
      }
    }

    const merged = [...(textResults || []), ...barcodeResults];
    const uniq = Array.from(new Map(merged.map((p) => [p.id, p])).values());

    return NextResponse.json({
      data: uniq,
      pagination: { page: 1, limit: 20, total: uniq.length, totalPages: 1 }
    });
  } catch (error: unknown) {
    console.error('GET /api/products/search error:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
