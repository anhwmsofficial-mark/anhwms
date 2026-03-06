'use server';

import { revalidatePath } from 'next/cache';
import { ensurePermission } from '@/lib/actions/auth';
import { failFromError, failResult, okResult, type ActionResult } from '@/lib/actions/result';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type {
  CreateCustomerActivityInput,
  CreateCustomerContactInput,
  CreateCustomerContractInput,
  CreateCustomerPricingInput,
  CustomerActivity,
  CustomerContact,
  CustomerContract,
  CustomerPricing,
} from '@/types';
import type { Database, Tables } from '@/types/supabase';

type CustomerContactRow = Tables<'customer_contact'>;
type CustomerContractRow = Tables<'customer_contract'>;
type CustomerPricingRow = Tables<'customer_pricing'>;
type CustomerActivityUpdate = Database['public']['Tables']['customer_activity']['Update'];
type CustomerContactUpdate = Database['public']['Tables']['customer_contact']['Update'];
type CustomerContractUpdate = Database['public']['Tables']['customer_contract']['Update'];
type CustomerPricingUpdate = Database['public']['Tables']['customer_pricing']['Update'];

type ActivityListRow = Database['public']['Tables']['customer_activity']['Row'] & {
  customer_contact?: { id: string; name: string; role: string } | null;
  user_profiles?: { id: string; username: string | null; email: string | null } | null;
};

type CustomerDetailsErrorCode = 'BAD_REQUEST' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'INTERNAL_ERROR';

type ContactUpdateBody = {
  name?: string;
  title?: string | null;
  department?: string | null;
  role?: string;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  preferredContact?: string;
  isPrimary?: boolean;
  isActive?: boolean;
  note?: string | null;
};

type ContractUpdateBody = {
  contractName?: string;
  contractType?: string;
  contractStart?: string;
  contractEnd?: string | null;
  autoRenewal?: boolean;
  contractAmount?: number | null;
  status?: string;
  note?: string | null;
};

type PricingUpdateBody = {
  unitPrice?: number;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  volumeDiscountRate?: number | null;
  isActive?: boolean;
  note?: string | null;
};

type ActivityUpdateBody = {
  subject?: string;
  description?: string | null;
  priority?: string;
  requiresFollowup?: boolean;
  followupDueDate?: string | null;
  followupCompleted?: boolean;
};

function mapMutationError(error: unknown, fallback: string): ActionResult<never, CustomerDetailsErrorCode> {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  const message =
    typeof error === 'object' && error && 'message' in error && typeof error.message === 'string'
      ? error.message
      : fallback;

  if (code === 'PGRST116') {
    return failResult(message || '대상이 존재하지 않습니다.', { status: 404, code: 'NOT_FOUND' });
  }
  if (code === '23505') {
    return failResult(message || '중복된 데이터입니다.', { status: 409, code: 'CONFLICT' });
  }
  if (code === '22P02' || code === '23502') {
    return failResult(message || '요청 데이터가 올바르지 않습니다.', { status: 400, code: 'BAD_REQUEST' });
  }
  return failResult(message || fallback, { status: 500, code: 'INTERNAL_ERROR' });
}

function toCustomerContact(row: CustomerContactRow): CustomerContact {
  return {
    id: row.id,
    customerMasterId: row.customer_master_id,
    name: row.name,
    title: row.title,
    department: row.department,
    role: row.role,
    email: row.email,
    phone: row.phone,
    mobile: row.mobile,
    fax: row.fax,
    preferredContact: row.preferred_contact || 'EMAIL',
    workHours: row.work_hours,
    timezone: row.timezone || 'Asia/Seoul',
    language: row.language || 'ko',
    isPrimary: row.is_primary,
    isActive: row.is_active,
    birthday: row.birthday ? new Date(row.birthday) : null,
    note: row.note,
    metadata: row.metadata,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function toCustomerPricing(row: CustomerPricingRow): CustomerPricing {
  return {
    id: row.id,
    customerMasterId: row.customer_master_id,
    orgId: row.org_id,
    pricingType: row.pricing_type,
    serviceName: row.service_name,
    serviceCode: row.service_code,
    unitPrice: row.unit_price,
    currency: row.currency,
    unit: row.unit,
    minQuantity: row.min_quantity,
    maxQuantity: row.max_quantity,
    effectiveFrom: new Date(row.effective_from),
    effectiveTo: row.effective_to ? new Date(row.effective_to) : null,
    volumeDiscountRate: row.volume_discount_rate,
    volumeThreshold: row.volume_threshold,
    requiresApproval: row.requires_approval,
    isActive: row.is_active,
    note: row.note,
    metadata: row.metadata,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function toCustomerContract(row: CustomerContractRow): CustomerContract {
  const contractStart = new Date(row.contract_start);
  const contractEnd = row.contract_end ? new Date(row.contract_end) : null;

  let daysUntilExpiry: number | null = null;
  let isExpiringSoon = false;
  if (contractEnd) {
    const diffTime = contractEnd.getTime() - new Date().getTime();
    daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    isExpiringSoon = daysUntilExpiry > 0 && daysUntilExpiry <= 90;
  }

  return {
    id: row.id,
    customerMasterId: row.customer_master_id,
    contractNo: row.contract_no,
    contractName: row.contract_name,
    contractType: row.contract_type,
    contractStart,
    contractEnd,
    autoRenewal: row.auto_renewal,
    renewalNoticeDays: row.renewal_notice_days,
    renewalCount: row.renewal_count,
    contractAmount: row.contract_amount,
    currency: row.currency,
    paymentTerms: row.payment_terms,
    paymentMethod: row.payment_method,
    billingCycle: row.billing_cycle,
    slaInboundProcessing: row.sla_inbound_processing,
    slaOutboundCutoff: row.sla_outbound_cutoff,
    slaAccuracyRate: row.sla_accuracy_rate,
    slaOntimeShipRate: row.sla_ontime_ship_rate,
    contractFileUrl: row.contract_file_url,
    contractFileName: row.contract_file_name,
    signedDate: row.signed_date ? new Date(row.signed_date) : null,
    signedByCustomer: row.signed_by_customer,
    signedByCompany: row.signed_by_company,
    status: row.status,
    parentContractId: row.parent_contract_id,
    replacedByContractId: row.replaced_by_contract_id,
    terminationReason: row.termination_reason,
    terminationDate: row.termination_date ? new Date(row.termination_date) : null,
    terminationNoticeDate: row.termination_notice_date ? new Date(row.termination_notice_date) : null,
    reminderSent: row.reminder_sent,
    reminderSentAt: row.reminder_sent_at ? new Date(row.reminder_sent_at) : null,
    note: row.note,
    metadata: row.metadata,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    daysUntilExpiry,
    isExpiringSoon,
  };
}

function toCustomerActivity(row: ActivityListRow): CustomerActivity {
  return {
    id: row.id,
    customerMasterId: row.customer_master_id,
    activityType: row.activity_type,
    subject: row.subject,
    description: row.description,
    relatedContactId: row.related_contact_id,
    performedByUserId: row.performed_by_user_id,
    priority: row.priority,
    requiresFollowup: row.requires_followup,
    followupDueDate: row.followup_due_date ? new Date(row.followup_due_date) : null,
    followupCompleted: row.followup_completed,
    followupCompletedAt: row.followup_completed_at ? new Date(row.followup_completed_at) : null,
    attachmentUrls: row.attachment_urls,
    tags: row.tags,
    activityDate: new Date(row.activity_date),
    durationMinutes: row.duration_minutes,
    metadata: row.metadata,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    relatedContact: row.customer_contact
      ? {
          id: row.customer_contact.id,
          name: row.customer_contact.name,
          role: row.customer_contact.role,
        }
      : undefined,
    performedByUser: row.user_profiles
      ? {
          id: row.user_profiles.id,
          username: row.user_profiles.username || '',
          email: row.user_profiles.email || '',
        }
      : undefined,
  };
}

export async function listCustomerContactsAction(
  customerId: string,
  request?: Request,
): Promise<ActionResult<CustomerContact[], CustomerDetailsErrorCode>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission;

    const { data, error } = await supabaseAdmin
      .from('customer_contact')
      .select('*')
      .eq('customer_master_id', customerId)
      .eq('is_active', true)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) return mapMutationError(error, '담당자 목록 조회에 실패했습니다.');
    return okResult((data || []).map(toCustomerContact));
  } catch (error: unknown) {
    return failFromError(error, '담당자 목록 조회에 실패했습니다.', { status: 500, code: 'INTERNAL_ERROR' });
  }
}

export async function createCustomerContactAction(
  customerId: string,
  payload: CreateCustomerContactInput,
  request?: Request,
): Promise<ActionResult<CustomerContactRow, CustomerDetailsErrorCode>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission;

    if (payload.isPrimary) {
      await supabaseAdmin
        .from('customer_contact')
        .update({ is_primary: false })
        .eq('customer_master_id', customerId)
        .eq('is_primary', true);
    }

    const { data, error } = await supabaseAdmin
      .from('customer_contact')
      .insert({
        customer_master_id: customerId,
        name: payload.name,
        title: payload.title,
        department: payload.department,
        role: payload.role,
        email: payload.email,
        phone: payload.phone,
        mobile: payload.mobile,
        preferred_contact: payload.preferredContact || 'EMAIL',
        is_primary: payload.isPrimary || false,
        note: payload.note,
      })
      .select()
      .single();

    if (error || !data) return mapMutationError(error, '담당자 생성에 실패했습니다.');
    revalidatePath(`/admin/customers/${customerId}`);
    return okResult(data);
  } catch (error: unknown) {
    return failFromError(error, '담당자 생성에 실패했습니다.', { status: 500, code: 'INTERNAL_ERROR' });
  }
}

export async function updateCustomerContactAction(
  customerId: string,
  contactId: string,
  payload: ContactUpdateBody,
  request?: Request,
): Promise<ActionResult<CustomerContactRow, CustomerDetailsErrorCode>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission;

    if (payload.isPrimary) {
      await supabaseAdmin
        .from('customer_contact')
        .update({ is_primary: false })
        .eq('customer_master_id', customerId)
        .eq('is_primary', true)
        .neq('id', contactId);
    }

    const updateData: CustomerContactUpdate = {};
    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.title !== undefined) updateData.title = payload.title;
    if (payload.department !== undefined) updateData.department = payload.department;
    if (payload.role !== undefined) updateData.role = payload.role;
    if (payload.email !== undefined) updateData.email = payload.email;
    if (payload.phone !== undefined) updateData.phone = payload.phone;
    if (payload.mobile !== undefined) updateData.mobile = payload.mobile;
    if (payload.preferredContact !== undefined) updateData.preferred_contact = payload.preferredContact;
    if (payload.isPrimary !== undefined) updateData.is_primary = payload.isPrimary;
    if (payload.isActive !== undefined) updateData.is_active = payload.isActive;
    if (payload.note !== undefined) updateData.note = payload.note;

    const { data, error } = await supabaseAdmin
      .from('customer_contact')
      .update(updateData)
      .eq('id', contactId)
      .select()
      .single();

    if (error || !data) return mapMutationError(error, '담당자 수정에 실패했습니다.');
    revalidatePath(`/admin/customers/${customerId}`);
    return okResult(data);
  } catch (error: unknown) {
    return failFromError(error, '담당자 수정에 실패했습니다.', { status: 500, code: 'INTERNAL_ERROR' });
  }
}

export async function deactivateCustomerContactAction(
  customerId: string,
  contactId: string,
  request?: Request,
): Promise<ActionResult<CustomerContactRow, CustomerDetailsErrorCode>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission;

    const { data, error } = await supabaseAdmin
      .from('customer_contact')
      .update({ is_active: false })
      .eq('id', contactId)
      .select()
      .single();

    if (error || !data) return mapMutationError(error, '담당자 삭제에 실패했습니다.');
    revalidatePath(`/admin/customers/${customerId}`);
    return okResult(data);
  } catch (error: unknown) {
    return failFromError(error, '담당자 삭제에 실패했습니다.', { status: 500, code: 'INTERNAL_ERROR' });
  }
}

export async function listCustomerContractsAction(
  customerId: string,
  request?: Request,
): Promise<ActionResult<CustomerContract[], CustomerDetailsErrorCode>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission;

    const { data, error } = await supabaseAdmin
      .from('customer_contract')
      .select('*')
      .eq('customer_master_id', customerId)
      .order('contract_start', { ascending: false });

    if (error) return mapMutationError(error, '계약 목록 조회에 실패했습니다.');
    return okResult((data || []).map(toCustomerContract));
  } catch (error: unknown) {
    return failFromError(error, '계약 목록 조회에 실패했습니다.', { status: 500, code: 'INTERNAL_ERROR' });
  }
}

export async function createCustomerContractAction(
  customerId: string,
  payload: CreateCustomerContractInput,
  request?: Request,
): Promise<ActionResult<CustomerContractRow, CustomerDetailsErrorCode>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission;

    const { data, error } = await supabaseAdmin
      .from('customer_contract')
      .insert({
        customer_master_id: customerId,
        contract_no: payload.contractNo,
        contract_name: payload.contractName,
        contract_type: payload.contractType,
        contract_start: payload.contractStart,
        contract_end: payload.contractEnd,
        auto_renewal: payload.autoRenewal || false,
        contract_amount: payload.contractAmount,
        currency: payload.currency || 'KRW',
        payment_terms: payload.paymentTerms || 30,
        billing_cycle: payload.billingCycle || 'MONTHLY',
        status: 'ACTIVE',
        note: payload.note,
      })
      .select()
      .single();

    if (error || !data) return mapMutationError(error, '계약 생성에 실패했습니다.');
    revalidatePath(`/admin/customers/${customerId}`);
    return okResult(data);
  } catch (error: unknown) {
    return failFromError(error, '계약 생성에 실패했습니다.', { status: 500, code: 'INTERNAL_ERROR' });
  }
}

export async function updateCustomerContractAction(
  customerId: string,
  contractId: string,
  payload: ContractUpdateBody,
  request?: Request,
): Promise<ActionResult<CustomerContractRow, CustomerDetailsErrorCode>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission;

    const updateData: CustomerContractUpdate = {};
    if (payload.contractName !== undefined) updateData.contract_name = payload.contractName;
    if (payload.contractType !== undefined) updateData.contract_type = payload.contractType;
    if (payload.contractStart !== undefined) updateData.contract_start = payload.contractStart;
    if (payload.contractEnd !== undefined) updateData.contract_end = payload.contractEnd;
    if (payload.autoRenewal !== undefined) updateData.auto_renewal = payload.autoRenewal;
    if (payload.contractAmount !== undefined) updateData.contract_amount = payload.contractAmount;
    if (payload.status !== undefined) updateData.status = payload.status;
    if (payload.note !== undefined) updateData.note = payload.note;

    const { data, error } = await supabaseAdmin
      .from('customer_contract')
      .update(updateData)
      .eq('id', contractId)
      .select()
      .single();

    if (error || !data) return mapMutationError(error, '계약 수정에 실패했습니다.');
    revalidatePath(`/admin/customers/${customerId}`);
    return okResult(data);
  } catch (error: unknown) {
    return failFromError(error, '계약 수정에 실패했습니다.', { status: 500, code: 'INTERNAL_ERROR' });
  }
}

export async function deleteCustomerContractAction(
  customerId: string,
  contractId: string,
  request?: Request,
): Promise<ActionResult<CustomerContractRow, CustomerDetailsErrorCode>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission;

    const { data, error } = await supabaseAdmin
      .from('customer_contract')
      .delete()
      .eq('id', contractId)
      .select()
      .single();

    if (error || !data) return mapMutationError(error, '계약 삭제에 실패했습니다.');
    revalidatePath(`/admin/customers/${customerId}`);
    return okResult(data);
  } catch (error: unknown) {
    return failFromError(error, '계약 삭제에 실패했습니다.', { status: 500, code: 'INTERNAL_ERROR' });
  }
}

export async function listCustomerPricingAction(
  customerId: string,
  options: { activeOnly?: boolean } = {},
  request?: Request,
): Promise<ActionResult<CustomerPricing[], CustomerDetailsErrorCode>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission;

    let query = supabaseAdmin
      .from('customer_pricing')
      .select('*')
      .eq('customer_master_id', customerId);

    if (options.activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query.order('effective_from', { ascending: false });
    if (error) return mapMutationError(error, '가격 정책 목록 조회에 실패했습니다.');
    return okResult((data || []).map(toCustomerPricing));
  } catch (error: unknown) {
    return failFromError(error, '가격 정책 목록 조회에 실패했습니다.', { status: 500, code: 'INTERNAL_ERROR' });
  }
}

export async function createCustomerPricingAction(
  customerId: string,
  payload: CreateCustomerPricingInput,
  request?: Request,
): Promise<ActionResult<CustomerPricingRow, CustomerDetailsErrorCode>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission;

    const { data, error } = await supabaseAdmin
      .from('customer_pricing')
      .insert({
        customer_master_id: customerId,
        org_id: payload.orgId,
        pricing_type: payload.pricingType,
        service_name: payload.serviceName,
        service_code: payload.serviceCode,
        unit_price: payload.unitPrice,
        currency: payload.currency || 'KRW',
        unit: payload.unit,
        min_quantity: payload.minQuantity,
        max_quantity: payload.maxQuantity,
        effective_from: (payload.effectiveFrom || new Date()).toISOString(),
        effective_to: payload.effectiveTo ? payload.effectiveTo.toISOString() : null,
        volume_discount_rate: payload.volumeDiscountRate,
        volume_threshold: payload.volumeThreshold,
        is_active: true,
        note: payload.note,
      })
      .select()
      .single();

    if (error || !data) return mapMutationError(error, '가격 정책 생성에 실패했습니다.');
    revalidatePath(`/admin/customers/${customerId}`);
    return okResult(data);
  } catch (error: unknown) {
    return failFromError(error, '가격 정책 생성에 실패했습니다.', { status: 500, code: 'INTERNAL_ERROR' });
  }
}

export async function updateCustomerPricingAction(
  customerId: string,
  pricingId: string,
  payload: PricingUpdateBody,
  request?: Request,
): Promise<ActionResult<CustomerPricingRow, CustomerDetailsErrorCode>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission;

    const updateData: CustomerPricingUpdate = {};
    if (payload.unitPrice !== undefined) updateData.unit_price = payload.unitPrice;
    if (payload.effectiveFrom !== undefined) updateData.effective_from = payload.effectiveFrom;
    if (payload.effectiveTo !== undefined) updateData.effective_to = payload.effectiveTo;
    if (payload.volumeDiscountRate !== undefined) updateData.volume_discount_rate = payload.volumeDiscountRate;
    if (payload.isActive !== undefined) updateData.is_active = payload.isActive;
    if (payload.note !== undefined) updateData.note = payload.note;

    const { data, error } = await supabaseAdmin
      .from('customer_pricing')
      .update(updateData)
      .eq('id', pricingId)
      .select()
      .single();

    if (error || !data) return mapMutationError(error, '가격 정책 수정에 실패했습니다.');
    revalidatePath(`/admin/customers/${customerId}`);
    return okResult(data);
  } catch (error: unknown) {
    return failFromError(error, '가격 정책 수정에 실패했습니다.', { status: 500, code: 'INTERNAL_ERROR' });
  }
}

export async function deleteCustomerPricingAction(
  customerId: string,
  pricingId: string,
  request?: Request,
): Promise<ActionResult<CustomerPricingRow, CustomerDetailsErrorCode>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission;

    const { data, error } = await supabaseAdmin
      .from('customer_pricing')
      .delete()
      .eq('id', pricingId)
      .select()
      .single();

    if (error || !data) return mapMutationError(error, '가격 정책 삭제에 실패했습니다.');
    revalidatePath(`/admin/customers/${customerId}`);
    return okResult(data);
  } catch (error: unknown) {
    return failFromError(error, '가격 정책 삭제에 실패했습니다.', { status: 500, code: 'INTERNAL_ERROR' });
  }
}

export async function listCustomerActivitiesAction(
  customerId: string,
  options: { limit?: number } = {},
  request?: Request,
): Promise<ActionResult<CustomerActivity[], CustomerDetailsErrorCode>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission;

    const limit = Number.isFinite(options.limit) ? Math.max(1, Number(options.limit)) : 50;
    const { data, error } = await supabaseAdmin
      .from('customer_activity')
      .select(
        `
        *,
        customer_contact:related_contact_id (
          id,
          name,
          role
        ),
        user_profiles:performed_by_user_id (
          id,
          username,
          email
        )
      `,
      )
      .eq('customer_master_id', customerId)
      .order('activity_date', { ascending: false })
      .limit(limit);

    if (error) return mapMutationError(error, '활동 이력 목록 조회에 실패했습니다.');
    return okResult((data || []).map((row) => toCustomerActivity(row as ActivityListRow)));
  } catch (error: unknown) {
    return failFromError(error, '활동 이력 목록 조회에 실패했습니다.', { status: 500, code: 'INTERNAL_ERROR' });
  }
}

export async function createCustomerActivityAction(
  customerId: string,
  payload: CreateCustomerActivityInput,
  request?: Request,
): Promise<ActionResult<Database['public']['Tables']['customer_activity']['Row'], CustomerDetailsErrorCode>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission;

    const { data, error } = await supabaseAdmin
      .from('customer_activity')
      .insert({
        customer_master_id: customerId,
        activity_type: payload.activityType,
        subject: payload.subject,
        description: payload.description,
        related_contact_id: payload.relatedContactId,
        performed_by_user_id: payload.performedByUserId,
        priority: payload.priority || 'NORMAL',
        requires_followup: payload.requiresFollowup || false,
        followup_due_date: payload.followupDueDate,
        tags: payload.tags,
        activity_date: payload.activityDate || new Date(),
        duration_minutes: payload.durationMinutes,
      })
      .select()
      .single();

    if (error || !data) return mapMutationError(error, '활동 이력 생성에 실패했습니다.');
    revalidatePath(`/admin/customers/${customerId}`);
    return okResult(data);
  } catch (error: unknown) {
    return failFromError(error, '활동 이력 생성에 실패했습니다.', { status: 500, code: 'INTERNAL_ERROR' });
  }
}

export async function updateCustomerActivityAction(
  customerId: string,
  activityId: string,
  payload: ActivityUpdateBody,
  request?: Request,
): Promise<ActionResult<Database['public']['Tables']['customer_activity']['Row'], CustomerDetailsErrorCode>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission;

    const updateData: CustomerActivityUpdate = {};
    if (payload.subject !== undefined) updateData.subject = payload.subject;
    if (payload.description !== undefined) updateData.description = payload.description;
    if (payload.priority !== undefined) updateData.priority = payload.priority;
    if (payload.requiresFollowup !== undefined) updateData.requires_followup = payload.requiresFollowup;
    if (payload.followupDueDate !== undefined) updateData.followup_due_date = payload.followupDueDate;
    if (payload.followupCompleted !== undefined) {
      updateData.followup_completed = payload.followupCompleted;
      if (payload.followupCompleted) {
        updateData.followup_completed_at = new Date().toISOString();
      }
    }

    const { data, error } = await supabaseAdmin
      .from('customer_activity')
      .update(updateData)
      .eq('id', activityId)
      .select()
      .single();

    if (error || !data) return mapMutationError(error, '활동 이력 수정에 실패했습니다.');
    revalidatePath(`/admin/customers/${customerId}`);
    return okResult(data);
  } catch (error: unknown) {
    return failFromError(error, '활동 이력 수정에 실패했습니다.', { status: 500, code: 'INTERNAL_ERROR' });
  }
}

export async function deleteCustomerActivityAction(
  customerId: string,
  activityId: string,
  request?: Request,
): Promise<ActionResult<Database['public']['Tables']['customer_activity']['Row'], CustomerDetailsErrorCode>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission;

    const { data, error } = await supabaseAdmin
      .from('customer_activity')
      .delete()
      .eq('id', activityId)
      .select()
      .single();

    if (error || !data) return mapMutationError(error, '활동 이력 삭제에 실패했습니다.');
    revalidatePath(`/admin/customers/${customerId}`);
    return okResult(data);
  } catch (error: unknown) {
    return failFromError(error, '활동 이력 삭제에 실패했습니다.', { status: 500, code: 'INTERNAL_ERROR' });
  }
}
