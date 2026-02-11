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

const generateAutoBarcode = () => {
  const base = `${Date.now()}${Math.floor(100 + Math.random() * 900)}`;
  return base.slice(-13);
};

const generateAutoSku = () => {
  const ts = Date.now().toString().slice(-8);
  const rand = Math.floor(100 + Math.random() * 900);
  return `AUTO-${ts}-${rand}`;
};

const CHO = ['G', 'KK', 'N', 'D', 'TT', 'R', 'M', 'B', 'PP', 'S', 'SS', 'NG', 'J', 'JJ', 'CH', 'K', 'T', 'P', 'H'];
const JUNG = ['A', 'AE', 'YA', 'YAE', 'EO', 'E', 'YEO', 'YE', 'O', 'WA', 'WAE', 'OE', 'YO', 'U', 'WEO', 'WE', 'WI', 'YU', 'EU', 'UI', 'I'];
const JONG = ['', 'K', 'K', 'KS', 'N', 'NJ', 'NH', 'T', 'L', 'LK', 'LM', 'LB', 'LS', 'LT', 'LP', 'LH', 'M', 'P', 'PS', 'T', 'T', 'NG', 'T', 'T', 'K', 'T', 'P', 'H'];

const sanitizeCode = (value: string, maxLength = 12) =>
  String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, maxLength);

const romanizeKorean = (input: string) => {
  let out = '';
  for (const ch of String(input || '')) {
    const code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) {
      const syllable = code - 0xac00;
      const cho = Math.floor(syllable / 588);
      const jung = Math.floor((syllable % 588) / 28);
      const jong = syllable % 28;
      out += `${CHO[cho]}${JUNG[jung]}${JONG[jong]}`;
      continue;
    }
    if ((code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
      out += ch;
    }
  }
  return out;
};

const createEnglishCustomerCode = (name: string, customerId: string) => {
  const romanized = sanitizeCode(romanizeKorean(name), 10);
  if (romanized) return romanized;
  const compact = sanitizeCode(customerId.replace(/-/g, ''), 6);
  return `CUST${compact || '000001'}`;
};

const resolveCustomerCode = async (customerId: string) => {
  const { data: customer } = await supabaseAdmin
    .from('customer_master')
    .select('id, code, name')
    .eq('id', customerId)
    .maybeSingle();

  if (customer?.code) {
    return sanitizeCode(customer.code, 12) || 'CUST';
  }

  const nameCandidate = String(customer?.name || '').trim();
  let candidateBase = createEnglishCustomerCode(nameCandidate, customerId);

  if (!candidateBase) {
    const { data: partner } = await supabaseAdmin
      .from('partners')
      .select('name')
      .eq('id', customerId)
      .maybeSingle();
    candidateBase = createEnglishCustomerCode(String(partner?.name || ''), customerId);
  }

  for (let i = 0; i < 100; i += 1) {
    const suffix = i === 0 ? '' : String(i + 1);
    const candidate = sanitizeCode(`${candidateBase}${suffix}`, 12);
    if (!candidate) continue;

    const { data: duplicate } = await supabaseAdmin
      .from('customer_master')
      .select('id')
      .eq('code', candidate)
      .maybeSingle();

    if (!duplicate || duplicate.id === customerId) {
      if (customer?.id && !customer?.code) {
        await supabaseAdmin.from('customer_master').update({ code: candidate }).eq('id', customerId);
      }
      return candidate;
    }
  }

  return sanitizeCode(`CUST${customerId.replace(/-/g, '')}`, 12) || 'CUST';
};

const buildProductDbNo = (customerCode: string, barcode: string, categoryCode: string) => {
  return `${sanitizeCode(customerCode, 12)}${String(barcode || '').trim()}${sanitizeCode(categoryCode, 4)}`;
};

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
    const customerCode = await resolveCustomerCode(customerId);

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
