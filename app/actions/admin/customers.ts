'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createTrackedAdminClient } from '@/utils/supabase/admin-client';
import { ensurePermission } from '@/lib/actions/auth';
import { failFromError, type ActionResult } from '@/lib/actions/result';
import { logActivity } from '@/lib/audit-logger';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/supabase';
import { buildCustomerMasterCode } from '@/lib/domain/products/identifiers';
import {
  customerPartnerFormSchema,
  mapPartnerCategoryToLegacyType,
  type CustomerPartnerFormValues,
} from '@/lib/customers/schema';

type CustomerRow = Tables<'customer_master'> & {
  brands?: unknown[];
};
type CustomerInsert = TablesInsert<'customer_master'>;
type CustomerUpdate = TablesUpdate<'customer_master'>;
type CustomerInsertWithDocuments = CustomerInsert & {
  contract_storage_path?: string | null;
  domestic_overseas_type?: string | null;
  service_type?: string | null;
  has_business_license_document?: boolean | null;
  has_bankbook_document?: boolean | null;
  has_contract_document?: boolean | null;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  contact_status?: string | null;
};
type CustomerUpdateWithDocuments = CustomerUpdate & {
  contract_storage_path?: string | null;
  domestic_overseas_type?: string | null;
  service_type?: string | null;
  has_business_license_document?: boolean | null;
  has_bankbook_document?: boolean | null;
  has_contract_document?: boolean | null;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  contact_status?: string | null;
};

const CUSTOMER_PERM = 'view:customers';
const CUSTOMER_LIST_SELECT = `
  id,
  code,
  name,
  type,
  partner_category,
  country_code,
  business_reg_no,
  ceo_name,
  tax_invoice_email,
  contact_email,
  settlement_manager_name,
  contact_name,
  domestic_overseas_type,
  service_type,
  has_business_license_document,
  has_bankbook_document,
  has_contract_document,
  contract_start_date,
  contract_end_date,
  contact_status,
  invoice_available_status,
  billing_currency,
  billing_cycle,
  contact_phone,
  status,
  created_at
`;
const CUSTOMER_LEGACY_LIST_SELECT = `
  id,
  code,
  name,
  type,
  country_code,
  business_reg_no,
  billing_currency,
  billing_cycle,
  contact_email,
  contact_name,
  contact_phone,
  status,
  created_at
`;
const CUSTOMER_DETAIL_SELECT = `
  id,
  code,
  name,
  type,
  partner_category,
  org_id,
  tenant_id,
  country_code,
  business_reg_no,
  corporate_registration_number,
  ceo_name,
  address_line1,
  address_line2,
  business_type,
  business_item,
  tax_invoice_email,
  settlement_manager_name,
  settlement_manager_phone,
  settlement_basis_memo,
  domestic_overseas_type,
  service_type,
  has_business_license_document,
  has_bankbook_document,
  has_contract_document,
  contract_start_date,
  contract_end_date,
  contact_status,
  invoice_available_status,
  business_license_storage_path,
  bankbook_storage_path,
  contract_storage_path,
  company_phone,
  fax_number,
  website_url,
  billing_currency,
  billing_cycle,
  contact_name,
  contact_email,
  contact_phone,
  status,
  note,
  created_at,
  updated_at
`;
const CUSTOMER_LEGACY_DETAIL_SELECT = `
  id,
  code,
  name,
  type,
  org_id,
  tenant_id,
  country_code,
  business_reg_no,
  billing_currency,
  billing_cycle,
  contact_name,
  contact_email,
  contact_phone,
  address_line1,
  address_line2,
  status,
  note,
  created_at,
  updated_at
`;

async function getActorOrgId(request?: Request): Promise<ActionResult<string>> {
  const permission = await ensurePermission(CUSTOMER_PERM, request);
  if (!permission.ok) return permission as ActionResult<string>;

  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Unauthorized', status: 401, code: 'UNAUTHORIZED' };
  }

  const { data: profile, error } = await db
    .from('user_profiles')
    .select('org_id')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !profile?.org_id) {
    return { ok: false, error: '조직 정보가 없는 계정은 거래처를 관리할 수 없습니다.', status: 403 };
  }

  return { ok: true, data: String(profile.org_id) };
}

export interface CustomerListParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  partnerCategory?: string;
  status?: string;
  invoiceStatus?: string;
}

export async function listCustomersAction(
  params: CustomerListParams = {},
  request?: Request,
): Promise<ActionResult<{ data: CustomerRow[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>> {
  try {
    const orgGate = await getActorOrgId(request);
    if (!orgGate.ok) return orgGate as any;

    const orgId = orgGate.data;
    const db = createTrackedAdminClient({
      action: 'customers:list',
      route: 'listCustomersAction',
    }) as unknown as Awaited<ReturnType<typeof createClient>>;

    const page = Math.max(1, Number(params.page || 1));
    const limit = Math.min(100, Math.max(1, Number(params.limit || 20)));
    const type = String(params.type || '').trim();
    const partnerCategory = String(params.partnerCategory || '').trim();
    const status = String(params.status || '').trim();
    const invoiceStatus = String(params.invoiceStatus || '').trim();
    const offset = (page - 1) * limit;

    let query = db.from('customer_master').select(CUSTOMER_LIST_SELECT).eq('tenant_id', orgId);

    if (type) {
      query = query.eq('type', type);
    }
    if (partnerCategory) {
      query = query.eq('partner_category', partnerCategory);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (invoiceStatus) {
      query = query.eq('invoice_available_status', invoiceStatus);
    }

    query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

    const listResult = await query;
    let data = listResult.data as unknown[] | null;
    let error = listResult.error;
    if (isMissingCustomerExtensionColumn(error)) {
      let legacyQuery = db.from('customer_master').select(CUSTOMER_LEGACY_LIST_SELECT).eq('tenant_id', orgId);

      if (type) {
        legacyQuery = legacyQuery.eq('type', type);
      }
      if (status) {
        legacyQuery = legacyQuery.eq('status', status);
      }
      const legacyResult = await legacyQuery.range(offset, offset + limit - 1).order('created_at', { ascending: false });
      data = legacyResult.data;
      error = legacyResult.error;
    }
    if (error) {
      return { ok: false, error: error.message, status: 500 };
    }
    if ((!data || data.length === 0) && page === 1) {
      let orgQuery = db.from('customer_master').select(CUSTOMER_LIST_SELECT).eq('org_id', orgId);
      if (type) orgQuery = orgQuery.eq('type', type);
      if (partnerCategory) orgQuery = orgQuery.eq('partner_category', partnerCategory);
      if (status) orgQuery = orgQuery.eq('status', status);
      if (invoiceStatus) orgQuery = orgQuery.eq('invoice_available_status', invoiceStatus);
      const orgResult = await orgQuery.range(offset, offset + limit - 1).order('created_at', { ascending: false });
      if (!orgResult.error) {
        data = orgResult.data as unknown[] | null;
      }
    }
    const loaded = data?.length || 0;

    return {
      ok: true,
      data: {
        data: (data || []) as CustomerRow[],
        pagination: {
          page,
          limit,
          total: offset + loaded,
          totalPages: loaded === limit ? page + 1 : page,
        },
      },
    };
  } catch (error: unknown) {
    return failFromError(error, '거래처 목록 조회에 실패했습니다.');
  }
}

export async function getCustomerByIdAction(
  id: string,
  request?: Request,
): Promise<ActionResult<CustomerRow & { brands?: unknown[] }>> {
  try {
    const orgGate = await getActorOrgId(request);
    if (!orgGate.ok) return orgGate as any;

    const orgId = orgGate.data;
    const db = createTrackedAdminClient({
      action: 'customers:get',
      route: 'getCustomerByIdAction',
    }) as unknown as Awaited<ReturnType<typeof createClient>>;

    let result = await db.from('customer_master').select(CUSTOMER_DETAIL_SELECT).eq('id', id).maybeSingle();
    if (isMissingCustomerExtensionColumn(result.error)) {
      result = await db.from('customer_master').select(CUSTOMER_LEGACY_DETAIL_SELECT).eq('id', id).maybeSingle();
    }
    const { data, error } = result;

    if (error) {
      return { ok: false, error: error.message, status: 500 };
    }
    if (!data) {
      return { ok: false, error: 'Customer not found', status: 404 };
    }
    const row = data as unknown as CustomerRow & { brands?: unknown[] };
    if (row.tenant_id !== orgId && row.org_id !== orgId) {
      return { ok: false, error: 'Customer not found', status: 404 };
    }

    return { ok: true, data: row };
  } catch (error: unknown) {
    return failFromError(error, '거래처 상세 조회에 실패했습니다.');
  }
}

async function pickUniqueCustomerCode(db: Awaited<ReturnType<typeof createClient>>, name: string, seed: string) {
  const base = buildCustomerMasterCode(name, seed) || 'CUST';
  for (let i = 0; i < 200; i += 1) {
    const candidate = i === 0 ? base : `${base}${i + 1}`;
    const { data: dup } = await db.from('customer_master').select('id').eq('code', candidate).maybeSingle();
    if (!dup) return candidate.slice(0, 32);
  }
  return `CUST${seed.replace(/-/g, '').slice(0, 8)}`;
}

async function assertUniqueBusinessRegNo(
  db: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  brn: string,
  excludeId?: string,
) {
  let q = db
    .from('customer_master')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', orgId)
    .eq('business_reg_no', brn);
  if (excludeId) {
    q = q.neq('id', excludeId);
  }
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  if ((count || 0) > 0) {
    throw new Error('동일한 사업자등록번호가 이미 등록되어 있습니다.');
  }
}

function dbNull<T>(v: T | undefined | null): T | null {
  return v === undefined || v === null ? null : v;
}

const CUSTOMER_EXTENSION_COLUMNS = [
  'partner_category',
  'corporate_registration_number',
  'ceo_name',
  'business_type',
  'business_item',
  'tax_invoice_email',
  'settlement_manager_name',
  'settlement_manager_phone',
  'settlement_basis_memo',
  'invoice_available_status',
  'business_license_storage_path',
  'bankbook_storage_path',
  'contract_storage_path',
  'domestic_overseas_type',
  'service_type',
  'has_business_license_document',
  'has_bankbook_document',
  'has_contract_document',
  'contract_start_date',
  'contract_end_date',
  'contact_status',
  'company_phone',
  'fax_number',
  'website_url',
] as const;

function isMissingCustomerExtensionColumn(error: unknown) {
  const message = error instanceof Error ? error.message : String((error as { message?: unknown } | null)?.message || '');
  return (
    message.includes('schema cache') &&
    message.includes('customer_master') &&
    CUSTOMER_EXTENSION_COLUMNS.some((column) => message.includes(column))
  );
}

function stripCustomerExtensionColumns<T extends Record<string, unknown>>(payload: T): T {
  const next = { ...payload };
  CUSTOMER_EXTENSION_COLUMNS.forEach((column) => {
    delete next[column];
  });
  return next;
}

function formToRow(
  orgId: string,
  parsed: CustomerPartnerFormValues,
  code: string,
): CustomerInsertWithDocuments {
  const legacyType = mapPartnerCategoryToLegacyType(parsed.partner_category);
  return {
    code,
    name: parsed.name,
    type: legacyType,
    partner_category: parsed.partner_category,
    org_id: orgId,
    tenant_id: orgId,
    country_code: 'KR',
    business_reg_no: parsed.business_reg_no,
    corporate_registration_number: dbNull(parsed.corporate_registration_number),
    ceo_name: parsed.ceo_name,
    address_line1: parsed.address_line1,
    address_line2: dbNull(parsed.address_line2),
    business_type: parsed.business_type,
    business_item: parsed.business_item,
    tax_invoice_email: parsed.tax_invoice_email,
    settlement_manager_name: parsed.settlement_manager_name,
    settlement_manager_phone: parsed.settlement_manager_phone,
    settlement_basis_memo: dbNull(parsed.settlement_basis_memo),
    invoice_available_status: parsed.invoice_available_status,
    domestic_overseas_type: parsed.domestic_overseas_type,
    service_type: dbNull(parsed.service_type),
    has_business_license_document: Boolean(parsed.has_business_license_document || parsed.business_license_storage_path),
    has_bankbook_document: Boolean(parsed.has_bankbook_document || parsed.bankbook_storage_path),
    has_contract_document: Boolean(parsed.has_contract_document || parsed.contract_storage_path),
    contract_start_date: dbNull(parsed.contract_start_date),
    contract_end_date: dbNull(parsed.contract_end_date),
    contact_status: dbNull(parsed.contact_status),
    business_license_storage_path: dbNull(parsed.business_license_storage_path),
    bankbook_storage_path: dbNull(parsed.bankbook_storage_path),
    contract_storage_path: dbNull(parsed.contract_storage_path),
    company_phone: dbNull(parsed.company_phone),
    fax_number: dbNull(parsed.fax_number),
    website_url: dbNull(parsed.website_url),
    note: dbNull(parsed.note),
    contact_name: parsed.settlement_manager_name,
    contact_phone: parsed.settlement_manager_phone,
    contact_email: parsed.tax_invoice_email,
    status: 'ACTIVE',
    billing_currency: 'KRW',
    billing_cycle: 'MONTHLY',
  };
}

export async function saveCustomerPartnerFormAction(
  input: Record<string, unknown> & { id?: string },
  request?: Request,
): Promise<ActionResult<CustomerRow>> {
  try {
    const orgGate = await getActorOrgId(request);
    if (!orgGate.ok) return orgGate as any;
    const orgId = orgGate.data;

    const parsed = customerPartnerFormSchema.safeParse(input);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join(' / ') || '입력값을 확인하세요.';
      return { ok: false, error: msg, status: 400 };
    }

    const db = await createClient();
    const id = input.id ? String(input.id) : '';

    await assertUniqueBusinessRegNo(db, orgId, parsed.data.business_reg_no, id || undefined);

    if (id) {
      const { data: existing, error: exErr } = await db.from('customer_master').select('id, org_id, tenant_id').eq('id', id).maybeSingle();
      const allowed =
        existing && (existing.tenant_id === orgId || existing.org_id === orgId);
      if (exErr || !allowed) {
        return { ok: false, error: '수정할 거래처를 찾을 수 없거나 권한이 없습니다.', status: 404 };
      }

      const legacyType = mapPartnerCategoryToLegacyType(parsed.data.partner_category);
      const payload: CustomerUpdateWithDocuments = {
        name: parsed.data.name,
        type: legacyType,
        partner_category: parsed.data.partner_category,
        business_reg_no: parsed.data.business_reg_no,
        corporate_registration_number: dbNull(parsed.data.corporate_registration_number),
        ceo_name: parsed.data.ceo_name,
        address_line1: parsed.data.address_line1,
        address_line2: dbNull(parsed.data.address_line2),
        business_type: parsed.data.business_type,
        business_item: parsed.data.business_item,
        tax_invoice_email: parsed.data.tax_invoice_email,
        settlement_manager_name: parsed.data.settlement_manager_name,
        settlement_manager_phone: parsed.data.settlement_manager_phone,
        settlement_basis_memo: dbNull(parsed.data.settlement_basis_memo),
        invoice_available_status: parsed.data.invoice_available_status,
        domestic_overseas_type: parsed.data.domestic_overseas_type,
        service_type: dbNull(parsed.data.service_type),
        has_business_license_document: Boolean(
          parsed.data.has_business_license_document || parsed.data.business_license_storage_path,
        ),
        has_bankbook_document: Boolean(parsed.data.has_bankbook_document || parsed.data.bankbook_storage_path),
        has_contract_document: Boolean(parsed.data.has_contract_document || parsed.data.contract_storage_path),
        contract_start_date: dbNull(parsed.data.contract_start_date),
        contract_end_date: dbNull(parsed.data.contract_end_date),
        contact_status: dbNull(parsed.data.contact_status),
        business_license_storage_path: dbNull(parsed.data.business_license_storage_path),
        bankbook_storage_path: dbNull(parsed.data.bankbook_storage_path),
        contract_storage_path: dbNull(parsed.data.contract_storage_path),
        company_phone: dbNull(parsed.data.company_phone),
        fax_number: dbNull(parsed.data.fax_number),
        website_url: dbNull(parsed.data.website_url),
        note: dbNull(parsed.data.note),
        contact_name: parsed.data.settlement_manager_name,
        contact_phone: parsed.data.settlement_manager_phone,
        contact_email: parsed.data.tax_invoice_email,
        updated_at: new Date().toISOString(),
      };

      const { data: oldValue } = await db.from('customer_master').select('*').eq('id', id).single();

      let updateResult = await db.from('customer_master').update(payload).eq('id', id).select().single();
      if (isMissingCustomerExtensionColumn(updateResult.error)) {
        updateResult = await db
          .from('customer_master')
          .update(stripCustomerExtensionColumns(payload))
          .eq('id', id)
          .select()
          .single();
      }
      const { data, error } = updateResult;

      if (error || !data) {
        const dup = error?.message?.includes('uq_customer_master_tenant_business_reg_no');
        return {
          ok: false,
          error: dup ? '동일한 사업자등록번호가 이미 등록되어 있습니다.' : error?.message || '거래처 수정에 실패했습니다.',
          status: 500,
        };
      }

      await logActivity(db, {
        action: 'UPDATE',
        entityType: 'CUSTOMER',
        entityId: id,
        oldValue,
        newValue: data,
        route: 'saveCustomerPartnerFormAction',
      });

      revalidatePath('/admin/customers');
      revalidatePath(`/admin/customers/${id}`);
      return { ok: true, data };
    }

    const code = await pickUniqueCustomerCode(db, parsed.data.name, crypto.randomUUID());
    const insert = formToRow(orgId, parsed.data, code);

    let insertResult = await db.from('customer_master').insert([insert]).select().single();
    if (isMissingCustomerExtensionColumn(insertResult.error)) {
      insertResult = await db.from('customer_master').insert([stripCustomerExtensionColumns(insert)]).select().single();
    }
    const { data, error } = insertResult;

    if (error || !data) {
      const dup = error?.message?.includes('uq_customer_master_tenant_business_reg_no');
      return {
        ok: false,
        error: dup ? '동일한 사업자등록번호가 이미 등록되어 있습니다.' : error?.message || '거래처 등록에 실패했습니다.',
        status: 500,
      };
    }

    await logActivity(db, {
      action: 'CREATE',
      entityType: 'CUSTOMER',
      entityId: data.id,
      newValue: data,
      route: 'saveCustomerPartnerFormAction',
    });

    revalidatePath('/admin/customers');
    return { ok: true, data };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '거래처 저장에 실패했습니다.';
    return failFromError(error, msg);
  }
}

export async function createCustomerAction(payload: CustomerInsert, request?: Request): Promise<ActionResult<CustomerRow>> {
  try {
    const orgGate = await getActorOrgId(request);
    if (!orgGate.ok) return orgGate as any;
    const orgId = orgGate.data;

    const db = await createClient();

    const row: CustomerInsert = {
      ...payload,
      org_id: payload.org_id ?? orgId,
      tenant_id: payload.tenant_id ?? (payload.org_id as string) ?? orgId,
    };

    if (!row.tenant_id) {
      return { ok: false, error: 'tenant_id가 필요합니다.', status: 400 };
    }

    const { data, error } = await db.from('customer_master').insert([row]).select().single();

    if (error || !data) {
      return { ok: false, error: error?.message || '거래처 생성에 실패했습니다.', status: 500 };
    }

    await logActivity(db, {
      action: 'CREATE',
      entityType: 'CUSTOMER',
      entityId: data.id,
      newValue: data,
      route: 'createCustomerAction',
    });

    revalidatePath('/admin/customers');
    return { ok: true, data };
  } catch (error: unknown) {
    return failFromError(error, '거래처 생성에 실패했습니다.');
  }
}

export async function updateCustomerAction(
  id: string,
  payload: CustomerUpdate,
  request?: Request,
): Promise<ActionResult<CustomerRow>> {
  try {
    const orgGate = await getActorOrgId(request);
    if (!orgGate.ok) return orgGate as any;
    const orgId = orgGate.data;

    const db = await createClient();

    const { data: existing } = await db
      .from('customer_master')
      .select('id, org_id, tenant_id')
      .eq('id', id)
      .maybeSingle();
    if (!existing || (existing.tenant_id !== orgId && existing.org_id !== orgId)) {
      return { ok: false, error: '대상 거래처를 찾을 수 없거나 권한이 없습니다.', status: 404 };
    }

    const { data: oldValue } = await db.from('customer_master').select('*').eq('id', id).single();

    const { data, error } = await db
      .from('customer_master')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message || '거래처 수정에 실패했습니다.', status: 500 };
    }

    await logActivity(db, {
      action: 'UPDATE',
      entityType: 'CUSTOMER',
      entityId: id,
      oldValue,
      newValue: data,
      route: 'updateCustomerAction',
    });

    revalidatePath('/admin/customers');
    revalidatePath(`/admin/customers/${id}`);
    return { ok: true, data };
  } catch (error: unknown) {
    return failFromError(error, '거래처 수정에 실패했습니다.');
  }
}

export async function deactivateCustomerAction(id: string, request?: Request): Promise<ActionResult<CustomerRow>> {
  try {
    const permission = await ensurePermission(CUSTOMER_PERM, request);
    if (!permission.ok) return permission as any;

    const db = createTrackedAdminClient({
      action: 'customers:suspend',
      route: 'deactivateCustomerAction',
    }) as unknown as Awaited<ReturnType<typeof createClient>>;

    const { data: existing } = await db
      .from('customer_master')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    if (!existing) {
      return { ok: false, error: '대상 거래처를 찾을 수 없거나 권한이 없습니다.', status: 404 };
    }

    const { data, error } = await db
      .from('customer_master')
      .update({ status: 'SUSPENDED', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message || '거래처 거래 중단 처리에 실패했습니다.', status: 500 };
    }

    await logActivity(db, {
      action: 'UPDATE',
      entityType: 'CUSTOMER',
      entityId: id,
      metadata: { reason: 'Suspended' },
      route: 'deactivateCustomerAction',
    });

    revalidatePath('/admin/customers');
    revalidatePath(`/admin/customers/${id}`);
    return { ok: true, data };
  } catch (error: unknown) {
    return failFromError(error, '거래처 거래 중단 처리에 실패했습니다.');
  }
}

export async function deleteCustomerAction(id: string, request?: Request): Promise<ActionResult<CustomerRow>> {
  try {
    const permission = await ensurePermission(CUSTOMER_PERM, request);
    if (!permission.ok) return permission as any;

    const db = createTrackedAdminClient({
      action: 'customers:delete',
      route: 'deleteCustomerAction',
    }) as unknown as Awaited<ReturnType<typeof createClient>>;

    const { data: existing, error: findError } = await db
      .from('customer_master')
      .select(CUSTOMER_LEGACY_DETAIL_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (findError) {
      return { ok: false, error: findError.message, status: 500 };
    }
    if (!existing) {
      return { ok: false, error: '대상 거래처를 찾을 수 없거나 권한이 없습니다.', status: 404 };
    }

    const { error } = await db.from('customer_master').delete().eq('id', id);
    if (error) {
      const message =
        error.code === '23503'
          ? '입고/출고/상품 등 연결 데이터가 있어 삭제할 수 없습니다. 거래 중단으로 처리해 주세요.'
          : error.message || '거래처 삭제에 실패했습니다.';
      return { ok: false, error: message, status: 500 };
    }

    await logActivity(db, {
      action: 'DELETE',
      entityType: 'CUSTOMER',
      entityId: id,
      oldValue: existing,
      route: 'deleteCustomerAction',
    });

    revalidatePath('/admin/customers');
    revalidatePath(`/admin/customers/${id}`);
    return { ok: true, data: existing as unknown as CustomerRow };
  } catch (error: unknown) {
    return failFromError(error, '거래처 삭제에 실패했습니다.');
  }
}
