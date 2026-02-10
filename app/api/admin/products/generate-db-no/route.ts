import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const normalizeCategoryCode = (category: string) => {
  const cleaned = (category || '').replace(/[^0-9a-zA-Z가-힣]/g, '');
  if (!cleaned) return 'UNK';
  return cleaned.slice(0, 3).toUpperCase();
};

const normalizeCustomerId = (customerId: string) => customerId.replace(/-/g, '').slice(0, 8);

const generateAutoBarcode = () => {
  const base = `${Date.now()}${Math.floor(100 + Math.random() * 900)}`;
  return base.slice(-13);
};

const buildProductDbNo = (customerId: string, barcode: string, category: string) => {
  const customerPart = normalizeCustomerId(customerId);
  const categoryPart = normalizeCategoryCode(category);
  return `${customerPart}${barcode}${categoryPart}`;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const customerId = (body?.customer_id || '').toString().trim();
    const category = (body?.category || '').toString().trim();
    let barcode = (body?.barcode || '').toString().trim();

    if (!customerId) {
      return NextResponse.json({ error: '고객사는 필수입니다.' }, { status: 400 });
    }
    if (!category) {
      return NextResponse.json({ error: '카테고리는 필수입니다.' }, { status: 400 });
    }

    if (!barcode) {
      barcode = generateAutoBarcode();
    }

    // product_db_no는 유니크 제약이 있으므로 충돌 시 barcode를 재생성해서 재시도합니다.
    let productDbNo = buildProductDbNo(customerId, barcode, category);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data: exists, error } = await supabaseAdmin
        .from('products')
        .select('id')
        .eq('product_db_no', productDbNo)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error checking duplicate product_db_no:', error);
        return NextResponse.json({ error: '제품DB번호 중복 검사에 실패했습니다.' }, { status: 500 });
      }

      if (!exists) {
        return NextResponse.json(
          {
            data: {
              barcode,
              product_db_no: productDbNo,
            },
          },
          { status: 200 }
        );
      }

      barcode = generateAutoBarcode();
      productDbNo = buildProductDbNo(customerId, barcode, category);
    }

    return NextResponse.json(
      { error: '제품DB번호 생성에 실패했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    );
  } catch (error: any) {
    console.error('POST /api/admin/products/generate-db-no error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
