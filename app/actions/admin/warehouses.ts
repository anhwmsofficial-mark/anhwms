'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { ensurePermission } from '@/lib/actions/auth';
import { failFromError, type ActionResult } from '@/lib/actions/result';
import type { Database } from '@/types/supabase';

type WarehouseRow = Database['public']['Tables']['warehouse']['Row'];
type WarehouseInsert = Database['public']['Tables']['warehouse']['Insert'];
type WarehouseUpdate = Database['public']['Tables']['warehouse']['Update'];
type WarehouseListItem = WarehouseRow & {
  org?: unknown;
  locations?: unknown;
  brands?: unknown;
};

export async function listWarehousesAction(
  params: { page?: number; limit?: number; search?: string; type?: string; status?: string } = {},
  request?: Request,
): Promise<ActionResult<{ data: WarehouseListItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission;
    const page = Number(params.page || 1);
    const limit = Number(params.limit || 20);
    const search = params.search || '';
    const type = params.type || '';
    const status = params.status || 'ACTIVE';
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('warehouse')
      .select(
        `
        *,
        org:org(id, name, code),
        locations:location(count),
        brands:brand_warehouse(brand:brand(id, code, name_ko))
      `,
        { count: 'exact' },
      );

    if (search) query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%,city.ilike.%${search}%`);
    if (type) query = query.eq('type', type);
    if (status) query = query.eq('status', status);

    query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });
    const { data, error, count } = await query;
    if (error) return { ok: false, error: error.message, status: 500 };

    return {
      ok: true,
      data: {
        data: (data || []) as WarehouseListItem[],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      },
    };
  } catch (error: unknown) {
    return failFromError(error, '창고 목록 조회에 실패했습니다.', { status: 500 });
  }
}

export async function createWarehouseAction(body: WarehouseInsert, request?: Request): Promise<ActionResult<WarehouseRow>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission;
    const { data, error } = await supabaseAdmin.from('warehouse').insert([body]).select().single();
    if (error) return { ok: false, error: error.message, status: 500 };
    return { ok: true, data };
  } catch (error: unknown) {
    return failFromError(error, '창고 생성에 실패했습니다.', { status: 500 });
  }
}

export async function getWarehouseByIdAction(id: string, request?: Request): Promise<ActionResult<WarehouseRow>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission;
    const { data, error } = await supabaseAdmin.from('warehouse').select('*').eq('id', id).single();
    if (error) return { ok: false, error: error.message, status: 404 };
    return { ok: true, data };
  } catch (error: unknown) {
    return failFromError(error, '창고 상세 조회에 실패했습니다.', { status: 500 });
  }
}

export async function updateWarehouseAction(id: string, body: WarehouseUpdate, request?: Request): Promise<ActionResult<WarehouseRow>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission;
    const safeBody: WarehouseUpdate = { ...body };
    delete safeBody.id;
    delete safeBody.created_at;
    safeBody.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('warehouse')
      .update(safeBody)
      .eq('id', id)
      .select()
      .single();
    if (error) return { ok: false, error: error.message, status: 500 };
    return { ok: true, data };
  } catch (error: unknown) {
    return failFromError(error, '창고 수정에 실패했습니다.', { status: 500 });
  }
}

export async function deleteWarehouseAction(id: string, request?: Request): Promise<ActionResult<{ success: true }>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission;
    const { error } = await supabaseAdmin.from('warehouse').delete().eq('id', id);
    if (error) return { ok: false, error: error.message, status: 500 };
    return { ok: true, data: { success: true } };
  } catch (error: unknown) {
    return failFromError(error, '창고 삭제에 실패했습니다.', { status: 500 });
  }
}
