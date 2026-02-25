import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/utils/rbac';
import {
  buildProductDbNo,
  generateAutoBarcode,
  generateAutoSku,
  resolveCustomerCode,
  resolveCustomerMasterId,
  sanitizeCode,
} from '@/lib/domain/products/identifiers';

type BulkItem = {
  rowNo?: number;
  name?: string;
  category?: string;
  barcode?: string;
  sku?: string;
  manageName?: string;
  userCode?: string;
  unit?: string;
  minStock?: number;
  price?: number;
  costPrice?: number;
  location?: string;
  description?: string;
  manufactureDate?: string;
  expiryDate?: string;
  optionSize?: string;
  optionColor?: string;
  optionLot?: string;
  optionEtc?: string;
};
const isForbiddenError = (error: unknown) =>
  error instanceof Error && error.message.includes('Unauthorized');

const normalizeCategoryValue = (value: string, categories: Array<{ code: string; name_ko: string; name_en: string }>) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return { nameKo: '', code: '' };
  const found = categories.find((category) => {
    return (
      String(category.code || '').toLowerCase() === normalized ||
      String(category.name_ko || '').toLowerCase() === normalized ||
      String(category.name_en || '').toLowerCase() === normalized
    );
  });
  return {
    nameKo: String(found?.name_ko || ''),
    code: sanitizeCode(String(found?.code || ''), 4),
  };
};

const toNullableText = (value: unknown) => {
  const text = String(value ?? '').trim();
  return text || null;
};

const toNumber = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export async function POST(request: NextRequest) {
  try {
    await requirePermission('manage:products', request);
    const body = await request.json();
    const inputCustomerId = String(body?.customer_id || '').trim();
    const customerId = inputCustomerId ? await resolveCustomerMasterId(supabaseAdmin, inputCustomerId) : null;
    const items = Array.isArray(body?.items) ? (body.items as BulkItem[]) : [];

    if (!inputCustomerId || !customerId) {
      return NextResponse.json({ error: '고객사는 필수입니다.' }, { status: 400 });
    }
    if (!items.length) {
      return NextResponse.json({ error: '등록할 데이터가 없습니다.' }, { status: 400 });
    }
    if (items.length > 1000) {
      return NextResponse.json({ error: '한 번에 최대 1000건까지 등록할 수 있습니다.' }, { status: 400 });
    }

    const [{ data: categories, error: categoryError }, { data: customerBrand }, { data: fallbackBrand }] = await Promise.all([
      supabaseAdmin.from('product_categories').select('code, name_ko, name_en'),
      supabaseAdmin
        .from('brand')
        .select('id')
        .eq('customer_master_id', customerId)
        .eq('status', 'ACTIVE')
        .order('is_default_brand', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from('brand')
        .select('id')
        .eq('status', 'ACTIVE')
        .order('is_default_brand', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);
    const resolvedBrandId = customerBrand?.id ?? fallbackBrand?.id ?? null;
    const seenBarcodes = new Set<string>();
    const seenDbNos = new Set<string>();


    if (categoryError || !categories) {
      return NextResponse.json({ error: '카테고리 정보를 불러오지 못했습니다.' }, { status: 500 });
    }
    const customerCode = await resolveCustomerCode(supabaseAdmin, customerId);

    let successCount = 0;
    const failedRows: Array<{ rowNo: number; reason: string }> = [];

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const rowNo = Number(item.rowNo || index + 2);

      try {
        const name = String(item.name || '').trim();
        const categoryResolved = normalizeCategoryValue(String(item.category || ''), categories);
        const category = categoryResolved.nameKo;
        const categoryCode = categoryResolved.code;
        if (!name) throw new Error('제품명은 필수입니다.');
        if (!category || !categoryCode) throw new Error('카테고리 매칭에 실패했습니다.');

        const barcode = String(item.barcode || '').trim() || generateAutoBarcode();
        const sku = String(item.sku || '').trim() || generateAutoSku();
        const productDbNo = buildProductDbNo(customerCode, barcode, categoryCode);

        // 업로드 파일 내 중복 선검증
        if (seenBarcodes.has(barcode)) {
          throw new Error('업로드 파일 내 바코드 중복');
        }
        if (seenDbNos.has(productDbNo)) {
          throw new Error('업로드 파일 내 제품DB번호 중복');
        }
        seenBarcodes.add(barcode);
        seenDbNos.add(productDbNo);

        // DB 중복 선검증
        const { data: dupBarcode } = await supabaseAdmin
          .from('products')
          .select('id')
          .eq('barcode', barcode)
          .limit(1)
          .maybeSingle();
        if (dupBarcode?.id) {
          throw new Error('기존 데이터와 바코드 중복');
        }

        const { data: dupDbNo } = await supabaseAdmin
          .from('products')
          .select('id')
          .eq('product_db_no', productDbNo)
          .limit(1)
          .maybeSingle();
        if (dupDbNo?.id) {
          throw new Error('기존 데이터와 제품DB번호 중복');
        }

        const payload = {
          customer_id: customerId,
          name,
          manage_name: toNullableText(item.manageName),
          user_code: toNullableText(item.userCode),
          sku,
          barcode,
          product_db_no: productDbNo,
          category,
          manufacture_date: toNullableText(item.manufactureDate),
          expiry_date: toNullableText(item.expiryDate),
          option_size: toNullableText(item.optionSize),
          option_color: toNullableText(item.optionColor),
          option_lot: toNullableText(item.optionLot),
          option_etc: toNullableText(item.optionEtc),
          quantity: 0,
          unit: String(item.unit || '').trim() || 'EA',
          min_stock: toNumber(item.minStock, 0),
          price: toNumber(item.price, 0),
          cost_price: toNumber(item.costPrice, 0),
          location: toNullableText(item.location),
          description: toNullableText(item.description),
          status: 'ACTIVE',
          product_type: 'NORMAL',
          ...(resolvedBrandId ? { brand_id: resolvedBrandId } : {}),
        };

        const { error } = await supabaseAdmin.from('products').insert([payload]);
        if (error) throw error;
        successCount += 1;
      } catch (error: any) {
        const raw = error?.message || '등록 실패';
        let reason = raw;
        if (/duplicate key value/i.test(raw) && /product_db_no/i.test(raw)) {
          reason = '기존 데이터와 제품DB번호 중복';
        } else if (/duplicate key value/i.test(raw) && /\bsku\b/i.test(raw)) {
          reason = '기존 데이터와 SKU 중복';
        }
        failedRows.push({ rowNo, reason });
      }
    }

    return NextResponse.json({
      data: {
        successCount,
        failCount: failedRows.length,
        failedRows,
      },
    });
  } catch (error: any) {
    console.error('POST /api/admin/products/bulk error:', error);
    return NextResponse.json({ error: error.message || '대량 등록 실패' }, { status: isForbiddenError(error) ? 403 : 500 });
  }
}
