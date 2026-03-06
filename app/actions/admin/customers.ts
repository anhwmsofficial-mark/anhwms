'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ensurePermission } from '@/lib/actions/auth';
import { failFromError, type ActionResult } from '@/lib/actions/result';
import type { Database } from '@/types/supabase';

type CustomerRow = Database['public']['Tables']['customer_master']['Row'];
type CustomerInsert = Database['public']['Tables']['customer_master']['Insert'];
type CustomerUpdate = Database['public']['Tables']['customer_master']['Update'];

export interface CustomerListParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  status?: string;
}

export async function listCustomersAction(
  params: CustomerListParams = {},
  request?: Request,
): Promise<ActionResult<{ data: CustomerRow[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission;

    const page = Math.max(1, Number(params.page || 1));
    const limit = Math.min(2000, Math.max(1, Number(params.limit || 20)));
    const search = String(params.search || '').trim();
    const type = String(params.type || '').trim();
    const status = String(params.status || '').trim();
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('customer_master')
      .select('*, brands:brand(count)', { count: 'exact' });

    if (search) {
      query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%,contact_email.ilike.%${search}%`);
    }
    if (type) {
      query = query.eq('type', type);
    }
    if (status) {
      query = query.eq('status', status);
    }

    query = query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    const { data, error, count } = await query;
    if (error) {
      return { ok: false, error: error.message, status: 500 };
    }

    return {
      ok: true,
      data: {
        data: (data || []) as CustomerRow[],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      },
    };
  } catch (error: unknown) {
    return failFromError(error, '고객사 목록 조회에 실패했습니다.');
  }
}

export async function getCustomerByIdAction(
  id: string,
  request?: Request,
): Promise<ActionResult<CustomerRow & { brands?: unknown[] }>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission;

    const { data, error } = await supabaseAdmin
      .from('customer_master')
      .select('*, brands:brand(*)')
      .eq('id', id)
      .single();

    if (error) {
      return { ok: false, error: error.message, status: 500 };
    }
    if (!data) {
      return { ok: false, error: 'Customer not found', status: 404 };
    }

    return { ok: true, data: data as CustomerRow & { brands?: unknown[] } };
  } catch (error: unknown) {
    return failFromError(error, '고객사 상세 조회에 실패했습니다.');
  }
}

export async function createCustomerAction(payload: CustomerInsert, request?: Request): Promise<ActionResult<CustomerRow>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission;

    const { data, error } = await supabaseAdmin
      .from('customer_master')
      .insert([payload])
      .select()
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message || '고객사 생성에 실패했습니다.', status: 500 };
    }

    revalidatePath('/admin/customers');
    return { ok: true, data };
  } catch (error: unknown) {
    return failFromError(error, '고객사 생성에 실패했습니다.');
  }
}

export async function updateCustomerAction(
  id: string,
  payload: CustomerUpdate,
  request?: Request,
): Promise<ActionResult<CustomerRow>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission;

    const { data, error } = await supabaseAdmin
      .from('customer_master')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message || '고객사 수정에 실패했습니다.', status: 500 };
    }

    revalidatePath('/admin/customers');
    revalidatePath(`/admin/customers/${id}`);
    return { ok: true, data };
  } catch (error: unknown) {
    return failFromError(error, '고객사 수정에 실패했습니다.');
  }
}

export async function deactivateCustomerAction(id: string, request?: Request): Promise<ActionResult<CustomerRow>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission;

    const { data, error } = await supabaseAdmin
      .from('customer_master')
      .update({ status: 'INACTIVE', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message || '고객사 비활성화에 실패했습니다.', status: 500 };
    }

    revalidatePath('/admin/customers');
    revalidatePath(`/admin/customers/${id}`);
    return { ok: true, data };
  } catch (error: unknown) {
    return failFromError(error, '고객사 비활성화에 실패했습니다.');
  }
}
