import type { SupabaseClient } from '@supabase/supabase-js';

const CHO = ['G', 'KK', 'N', 'D', 'TT', 'R', 'M', 'B', 'PP', 'S', 'SS', 'NG', 'J', 'JJ', 'CH', 'K', 'T', 'P', 'H'];
const JUNG = ['A', 'AE', 'YA', 'YAE', 'EO', 'E', 'YEO', 'YE', 'O', 'WA', 'WAE', 'OE', 'YO', 'U', 'WEO', 'WE', 'WI', 'YU', 'EU', 'UI', 'I'];
const JONG = ['', 'K', 'K', 'KS', 'N', 'NJ', 'NH', 'T', 'L', 'LK', 'LM', 'LB', 'LS', 'LT', 'LP', 'LH', 'M', 'P', 'PS', 'T', 'T', 'NG', 'T', 'T', 'K', 'T', 'P', 'H'];

export const generateAutoBarcode = () => {
  const base = `${Date.now()}${Math.floor(100 + Math.random() * 900)}`;
  return base.slice(-13);
};

export const generateAutoSku = () => {
  const ts = Date.now().toString().slice(-8);
  const rand = Math.floor(100 + Math.random() * 900);
  return `AUTO-${ts}-${rand}`;
};

export const sanitizeCode = (value: string, maxLength = 12) =>
  String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, maxLength);

const shouldRegenerateCustomerCode = (code: string) => {
  const normalized = sanitizeCode(code, 20);
  if (!normalized) return true;
  if (/^[0-9A-F]{8,20}$/.test(normalized)) return true;
  if (/^CM[0-9]{3,}$/.test(normalized)) return true;
  if (/^CUST[0-9A-F]{4,}$/.test(normalized)) return true;
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

export const buildProductDbNo = (customerCode: string, barcode: string, categoryCode: string) =>
  `${sanitizeCode(customerCode, 12)}${String(barcode || '').trim()}${sanitizeCode(categoryCode, 4)}`;

export const resolveCustomerMasterId = async (db: SupabaseClient, inputId: string) => {
  const rawId = String(inputId || '').trim();
  if (!rawId) return null;

  const { data: directCustomer } = await db
    .from('customer_master')
    .select('id')
    .eq('id', rawId)
    .maybeSingle();
  if (directCustomer?.id) return String(directCustomer.id);

  const { data: partner } = await db
    .from('partners')
    .select('id, name')
    .eq('id', rawId)
    .maybeSingle();
  if (!partner?.id) return null;

  const { data: byName } = await db
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
    const { data: duplicate } = await db
      .from('customer_master')
      .select('id')
      .eq('code', candidate)
      .maybeSingle();
    if (!duplicate) {
      finalCode = candidate;
      break;
    }
  }

  const { data: created, error: createError } = await db
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

export const resolveCustomerCode = async (db: SupabaseClient, customerId: string) => {
  const { data: customer } = await db
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
    const { data: partner } = await db
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

    const { data: duplicate } = await db
      .from('customer_master')
      .select('id')
      .eq('code', candidate)
      .maybeSingle();

    if (!duplicate || duplicate.id === customerId) {
      if (customer?.id && (!customer?.code || shouldRegenerateCustomerCode(customer.code))) {
        await db.from('customer_master').update({ code: candidate }).eq('id', customerId);
      }
      return candidate;
    }
  }

  return sanitizeCode(`CUST${customerId.replace(/-/g, '')}`, 12) || 'CUST';
};

export const resolveCategoryCode = async (db: SupabaseClient, categoryInput: string) => {
  const normalized = String(categoryInput || '').trim().toLowerCase();
  const { data: categories } = await db
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
