import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const generateAutoBarcode = () => {
  const base = `${Date.now()}${Math.floor(100 + Math.random() * 900)}`;
  return base.slice(-13);
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

const resolveCategoryCode = async (categoryInput: string) => {
  const normalized = String(categoryInput || '').trim().toLowerCase();
  const { data: categories } = await supabaseAdmin
    .from('product_categories')
    .select('code, name_ko, name_en');

  const found = (categories || []).find((category) => {
    return (
      String(category.code || '').toLowerCase() === normalized ||
      String(category.name_ko || '').toLowerCase() === normalized ||
      String(category.name_en || '').toLowerCase() === normalized
    );
  });

  return sanitizeCode(found?.code || '', 4) || 'ETC';
};

const buildProductDbNo = (customerCode: string, barcode: string, categoryCode: string) => {
  return `${sanitizeCode(customerCode, 12)}${String(barcode || '').trim()}${sanitizeCode(categoryCode, 4)}`;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const inputCustomerId = (body?.customer_id || '').toString().trim();
    const category = (body?.category || '').toString().trim();
    let barcode = (body?.barcode || '').toString().trim();
    const customerId = inputCustomerId ? await resolveCustomerMasterId(inputCustomerId) : null;

    if (!inputCustomerId || !customerId) {
      return NextResponse.json({ error: '고객사는 필수입니다.' }, { status: 400 });
    }
    if (!category) {
      return NextResponse.json({ error: '카테고리는 필수입니다.' }, { status: 400 });
    }

    if (!barcode) {
      barcode = generateAutoBarcode();
    }

    const customerCode = await resolveCustomerCode(customerId);
    const categoryCode = await resolveCategoryCode(category);

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
        return NextResponse.json({ error: '제품DB번호 중복 검사에 실패했습니다.' }, { status: 500 });
      }

      if (!exists) {
        return NextResponse.json(
          {
            data: {
              barcode,
              product_db_no: productDbNo,
              customer_code: customerCode,
              category_code: categoryCode,
            },
          },
          { status: 200 }
        );
      }

      barcode = generateAutoBarcode();
      productDbNo = buildProductDbNo(customerCode, barcode, categoryCode);
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
