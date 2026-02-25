import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/utils/rbac';

const normalize = (value: unknown) => String(value || '').trim();

const isBarcodeFormatValid = (barcode: string) => {
  // 운영에서 흔히 쓰는 숫자형 바코드 길이 범위 허용
  return /^[0-9]{8,18}$/.test(barcode);
};

const isForbiddenError = (error: unknown) =>
  error instanceof Error && error.message.includes('Unauthorized');

export async function POST(request: NextRequest) {
  try {
    await requirePermission('manage:products', request);
    const body = await request.json();
    const barcode = normalize(body?.barcode);
    const productDbNo = normalize(body?.product_db_no);
    const excludeProductId = normalize(body?.exclude_product_id);

    const result = {
      barcode: {
        provided: Boolean(barcode),
        isValidFormat: true,
        isDuplicate: false,
        conflictProductId: null as string | null,
      },
      productDbNo: {
        provided: Boolean(productDbNo),
        isDuplicate: false,
        conflictProductId: null as string | null,
      },
      isOk: true,
    };

    if (barcode) {
      result.barcode.isValidFormat = isBarcodeFormatValid(barcode);
      if (result.barcode.isValidFormat) {
        let barcodeQuery = supabaseAdmin
          .from('products')
          .select('id')
          .eq('barcode', barcode)
          .limit(1);
        if (excludeProductId) {
          barcodeQuery = barcodeQuery.neq('id', excludeProductId);
        }
        const { data: barcodeConflict } = await barcodeQuery.maybeSingle();
        if (barcodeConflict?.id) {
          result.barcode.isDuplicate = true;
          result.barcode.conflictProductId = barcodeConflict.id;
        }
      }
    }

    if (productDbNo) {
      let dbNoQuery = supabaseAdmin
        .from('products')
        .select('id')
        .eq('product_db_no', productDbNo)
        .limit(1);
      if (excludeProductId) {
        dbNoQuery = dbNoQuery.neq('id', excludeProductId);
      }
      const { data: dbNoConflict } = await dbNoQuery.maybeSingle();
      if (dbNoConflict?.id) {
        result.productDbNo.isDuplicate = true;
        result.productDbNo.conflictProductId = dbNoConflict.id;
      }
    }

    result.isOk =
      (!barcode || (result.barcode.isValidFormat && !result.barcode.isDuplicate)) &&
      (!productDbNo || !result.productDbNo.isDuplicate);

    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error('POST /api/admin/products/validate-identifiers error:', error);
    return NextResponse.json(
      { error: error.message || '식별값 검증 실패' },
      { status: isForbiddenError(error) ? 403 : 500 }
    );
  }
}

