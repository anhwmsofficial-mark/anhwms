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

const shouldRegenerateCustomerCode = (code: string) => {
  const normalized = sanitizeCode(code, 20);
  if (!normalized) return true;
  if (/^[0-9A-F]{8,20}$/.test(normalized)) return true; // UUID/랜덤 해시형
  if (/^CM[0-9]{3,}$/.test(normalized)) return true; // 마이그레이션 기본 코드형
  if (/^CUST[0-9A-F]{4,}$/.test(normalized)) return true; // 임시 fallback 코드형
  return false;
};

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

const resolveCustomerMasterId = async (inputId: string) => {
  const rawId = String(inputId || '').trim();
  if (!rawId) return null;

  const { data: directCustomer } = await supabaseAdmin
    .from('customer_master')
    .select('id')
    .eq('id', rawId)
    .maybeSingle();
  if (directCustomer?.id) return String(directCustomer.id);

  const { data: partner } = await supabaseAdmin
    .from('partners')
    .select('id, name')
    .eq('id', rawId)
    .maybeSingle();
  if (!partner?.id) return null;

  const { data: byName } = await supabaseAdmin
    .from('customer_master')
    .select('id')
    .eq('name', partner.name)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (byName?.id) return String(byName.id);

  const baseCode = createEnglishCustomerCode(String(partner.name || ''), rawId) || 'CUSTAUTO';
  let finalCode = baseCode;
  for (let i = 0; i < 100; i += 1) {
    const candidate = i === 0 ? baseCode : `${baseCode}${i + 1}`;
    const { data: duplicate } = await supabaseAdmin
      .from('customer_master')
      .select('id')
      .eq('code', candidate)
      .maybeSingle();
    if (!duplicate) {
      finalCode = candidate;
      break;
    }
  }

  const { data: created, error: createError } = await supabaseAdmin
    .from('customer_master')
    .insert([
      {
        code: finalCode,
        name: partner.name || finalCode,
        type: 'DIRECT_BRAND',
        status: 'ACTIVE',
      },
    ])
    .select('id')
    .single();

  if (createError || !created?.id) return null;
  return String(created.id);
};

const resolveCustomerCode = async (customerId: string) => {
  const { data: customer } = await supabaseAdmin
    .from('customer_master')
    .select('id, code, name')
    .eq('id', customerId)
    .maybeSingle();

  if (customer?.code && !shouldRegenerateCustomerCode(customer.code)) {
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
      if (customer?.id && (!customer?.code || shouldRegenerateCustomerCode(customer.code))) {
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
    const inputCustomerId = String(body?.customer_id || '').trim();
    const customerId = inputCustomerId ? await resolveCustomerMasterId(inputCustomerId) : null;
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
    return NextResponse.json({ error: error.message || '대량 등록 실패' }, { status: 500 });
  }
}
