import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/utils/rbac';
import {
  buildProductDbNo,
  generateAutoBarcode,
  resolveCategoryCode,
  resolveCustomerCode,
  resolveCustomerMasterId,
} from '@/lib/domain/products/identifiers';
import { getErrorMessage } from '@/lib/errorHandler';
import { toAppApiError } from '@/lib/api/errors';
import { fail, ok } from '@/lib/api/response';

export async function POST(request: NextRequest) {
  try {
    await requirePermission('manage:products', request);
    const body = await request.json();
    const inputCustomerId = (body?.customer_id || '').toString().trim();
    const category = (body?.category || '').toString().trim();
    let barcode = (body?.barcode || '').toString().trim();
    const customerId = inputCustomerId ? await resolveCustomerMasterId(supabaseAdmin, inputCustomerId) : null;

    if (!inputCustomerId || !customerId) {
      return fail('BAD_REQUEST', '고객사는 필수입니다.', { status: 400 });
    }
    if (!category) {
      return fail('BAD_REQUEST', '카테고리는 필수입니다.', { status: 400 });
    }

    if (!barcode) {
      barcode = generateAutoBarcode();
    }

    const customerCode = await resolveCustomerCode(supabaseAdmin, customerId);
    const categoryCode = await resolveCategoryCode(supabaseAdmin, category);

    // product_db_no는 유니크 제약이 있으므로 충돌 시 barcode를 재생성해서 재시도합니다.
    let productDbNo = buildProductDbNo(customerCode, barcode, categoryCode);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data: exists, error } = await supabaseAdmin
        .from('products')
        .select('id')
        .eq('product_db_no', productDbNo)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error checking duplicate product_db_no:', error);
        return fail('INTERNAL_ERROR', '제품DB번호 중복 검사에 실패했습니다.', { status: 500 });
      }

      if (!exists) {
        return ok(
          {
            barcode,
            product_db_no: productDbNo,
            customer_code: customerCode,
            category_code: categoryCode,
          },
          { status: 200 },
        );
      }

      barcode = generateAutoBarcode();
      productDbNo = buildProductDbNo(customerCode, barcode, categoryCode);
    }

    return fail('INTERNAL_ERROR', '제품DB번호 생성에 실패했습니다. 잠시 후 다시 시도해주세요.', { status: 500 });
  } catch (error: unknown) {
    const apiError = toAppApiError(error, {
      error: getErrorMessage(error) || '제품DB번호 생성 실패',
      code: 'INTERNAL_ERROR',
      status: 500,
    });
    return fail(apiError.code || 'INTERNAL_ERROR', apiError.message, {
      status: apiError.status,
      details: apiError.details,
    });
  }
}
