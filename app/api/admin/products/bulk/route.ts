import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

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

const generateAutoSku = () => {
  const ts = Date.now().toString().slice(-8);
  const rand = Math.floor(100 + Math.random() * 900);
  return `AUTO-${ts}-${rand}`;
};

const buildProductDbNo = (customerId: string, barcode: string, category: string) => {
  const customerPart = normalizeCustomerId(customerId);
  const categoryPart = normalizeCategoryCode(category);
  return `${customerPart}${barcode}${categoryPart}`;
};

const normalizeCategoryValue = (value: string, categories: Array<{ code: string; name_ko: string; name_en: string }>) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  const found = categories.find((category) => {
    return (
      String(category.code || '').toLowerCase() === normalized ||
      String(category.name_ko || '').toLowerCase() === normalized ||
      String(category.name_en || '').toLowerCase() === normalized
    );
  });
  return found?.name_ko || '';
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
    const body = await request.json();
    const customerId = String(body?.customer_id || '').trim();
    const items = Array.isArray(body?.items) ? (body.items as BulkItem[]) : [];

    if (!customerId) {
      return NextResponse.json({ error: '고객사는 필수입니다.' }, { status: 400 });
    }
    if (!items.length) {
      return NextResponse.json({ error: '등록할 데이터가 없습니다.' }, { status: 400 });
    }
    if (items.length > 1000) {
      return NextResponse.json({ error: '한 번에 최대 1000건까지 등록할 수 있습니다.' }, { status: 400 });
    }

    const [{ data: categories, error: categoryError }, { data: brand }] = await Promise.all([
      supabaseAdmin.from('product_categories').select('code, name_ko, name_en'),
      supabaseAdmin
        .from('brand')
        .select('id')
        .eq('status', 'ACTIVE')
        .order('is_default_brand', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    if (categoryError || !categories) {
      return NextResponse.json({ error: '카테고리 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    let successCount = 0;
    const failedRows: Array<{ rowNo: number; reason: string }> = [];

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const rowNo = Number(item.rowNo || index + 2);

      try {
        const name = String(item.name || '').trim();
        const category = normalizeCategoryValue(String(item.category || ''), categories);
        if (!name) throw new Error('제품명은 필수입니다.');
        if (!category) throw new Error('카테고리 매칭에 실패했습니다.');

        const barcode = String(item.barcode || '').trim() || generateAutoBarcode();
        const sku = String(item.sku || '').trim() || generateAutoSku();
        const productDbNo = buildProductDbNo(customerId, barcode, category);

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
          ...(brand?.id ? { brand_id: brand.id } : {}),
        };

        const { error } = await supabaseAdmin.from('products').insert([payload]);
        if (error) throw error;
        successCount += 1;
      } catch (error: any) {
        failedRows.push({ rowNo, reason: error?.message || '등록 실패' });
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
    return NextResponse.json({ error: error.message || '대량 등록 실패' }, { status: 500 });
  }
}
