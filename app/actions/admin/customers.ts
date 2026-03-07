'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { ensurePermission } from '@/lib/actions/auth';
import { failFromError, type ActionResult } from '@/lib/actions/result';
import { escapeLike } from '@/lib/utils';
import { logActivity } from '@/lib/audit-logger';

type CustomerRow = {
  id: string;
  name: string;
  code?: string | null;
  status?: string | null;
  created_at?: string | null;
  [key: string]: any;
};
type CustomerInsert = Record<string, any>;
type CustomerUpdate = Record<string, any>;

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
    if (!permission.ok) return permission as any;
    
    // Switch to User Client (RLS Protected)
    const db = await createClient();

    const page = Math.max(1, Number(params.page || 1));
    const limit = Math.min(2000, Math.max(1, Number(params.limit || 20)));
    const search = String(params.search || '').trim();
    const type = String(params.type || '').trim();
    const status = String(params.status || '').trim();
    const offset = (page - 1) * limit;

    let query = db
      .from('customer_master')
      .select('*, brands:brand(count)', { count: 'exact' });

    if (search) {
      const term = escapeLike(search);
      query = query.or(`name.ilike.%${term}%,code.ilike.%${term}%,contact_email.ilike.%${term}%`);
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
    if (!permission.ok) return permission as any;
    
    // Switch to User Client (RLS Protected)
    const db = await createClient();

    const { data, error } = await db
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
    if (!permission.ok) return permission as any;
    
    // Switch to User Client (RLS Protected)
    const db = await createClient();

    const { data, error } = await db
      .from('customer_master')
      .insert([payload])
      .select()
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message || '고객사 생성에 실패했습니다.', status: 500 };
    }

    // Audit Log
    await logActivity(db, {
      action: 'CREATE',
      entityType: 'CUSTOMER',
      entityId: data.id,
      newValue: data,
      route: 'createCustomerAction'
    });

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
    if (!permission.ok) return permission as any;
    
    // Switch to User Client (RLS Protected)
    const db = await createClient();

    // Get old value for audit
    const { data: oldValue } = await db.from('customer_master').select('*').eq('id', id).single();

    const { data, error } = await db
      .from('customer_master')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message || '고객사 수정에 실패했습니다.', status: 500 };
    }

    // Audit Log
    await logActivity(db, {
      action: 'UPDATE',
      entityType: 'CUSTOMER',
      entityId: id,
      oldValue,
      newValue: data,
      route: 'updateCustomerAction'
    });

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
    if (!permission.ok) return permission as any;
    
    // Switch to User Client (RLS Protected)
    const db = await createClient();

    const { data, error } = await db
      .from('customer_master')
      .update({ status: 'INACTIVE', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message || '고객사 비활성화에 실패했습니다.', status: 500 };
    }

    // Audit Log
    await logActivity(db, {
      action: 'UPDATE',
      entityType: 'CUSTOMER',
      entityId: id,
      metadata: { reason: 'Deactivated' },
      route: 'deactivateCustomerAction'
    });

    revalidatePath('/admin/customers');
    revalidatePath(`/admin/customers/${id}`);
    return { ok: true, data };
  } catch (error: unknown) {
    return failFromError(error, '고객사 비활성화에 실패했습니다.');
  }
}
