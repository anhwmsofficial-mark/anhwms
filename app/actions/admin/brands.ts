'use server';

import { createClient } from '@/utils/supabase/server';
import { ensurePermission } from '@/lib/actions/auth';
import { failFromError, type ActionResult } from '@/lib/actions/result';
import type { Database } from '@/types/supabase';

type BrandRow = Database['public']['Tables']['brand']['Row'];
type BrandInsert = Database['public']['Tables']['brand']['Insert'];
type BrandUpdate = Database['public']['Tables']['brand']['Update'];
type BrandListItem = BrandRow & {
  customer?: unknown;
  stores?: unknown;
  warehouses?: unknown;
};

export async function listBrandsAction(
  params: { page?: number; limit?: number; search?: string; customer_id?: string; status?: string } = {},
  request?: Request,
): Promise<ActionResult<{ data: BrandListItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission as any;
    
    // Switch to User Client (RLS Protected)
    const db = await createClient();

    const page = Number(params.page || 1);
    const limit = Number(params.limit || 20);
    const search = params.search || '';
    const customer_id = params.customer_id || '';
    const status = params.status || 'ACTIVE';
    const offset = (page - 1) * limit;

    let query = db
      .from('brand')
      .select(
        `
        *,
        customer:customer_master(id, code, name),
        stores:store(count),
        warehouses:brand_warehouse(warehouse:warehouse(id, code, name))
      `,
        { count: 'exact' },
      );

    if (search) query = query.or(`name_ko.ilike.%${search}%,name_en.ilike.%${search}%,code.ilike.%${search}%`);
    if (customer_id) query = query.eq('customer_master_id', customer_id);
    if (status) query = query.eq('status', status);

    query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

    const { data, error, count } = await query;
    if (error) return { ok: false, error: error.message, status: 500 };

    return {
      ok: true,
      data: {
        data: ((data || []) as unknown) as BrandListItem[],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      },
    };
  } catch (error: unknown) {
    return failFromError(error, '브랜드 목록 조회에 실패했습니다.', { status: 500 });
  }
}

export async function createBrandAction(body: BrandInsert, request?: Request): Promise<ActionResult<BrandRow>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission as any;
    
    // Switch to User Client (RLS Protected)
    const db = await createClient();

    const { data, error } = await db.from('brand').insert([body]).select().single();
    if (error) return { ok: false, error: error.message, status: 500 };
    return { ok: true, data };
  } catch (error: unknown) {
    return failFromError(error, '브랜드 생성에 실패했습니다.', { status: 500 });
  }
}

export async function getBrandByIdAction(id: string, request?: Request): Promise<ActionResult<BrandListItem>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission as any;
    
    // Switch to User Client (RLS Protected)
    const db = await createClient();

    const { data, error } = await db
      .from('brand')
      .select(
        `
        *,
        customer:customer_master(*),
        stores:store(*),
        warehouses:brand_warehouse(*, warehouse:warehouse(*))
      `,
      )
      .eq('id', id)
      .single();

    if (error) return { ok: false, error: error.message, status: 500 };
    if (!data) return { ok: false, error: 'Brand not found', status: 404 };
    return { ok: true, data: (data as unknown as BrandListItem) };
  } catch (error: unknown) {
    return failFromError(error, '브랜드 상세 조회에 실패했습니다.', { status: 500 });
  }
}

export async function updateBrandAction(id: string, body: BrandUpdate, request?: Request): Promise<ActionResult<BrandRow>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission as any;
    
    // Switch to User Client (RLS Protected)
    const db = await createClient();

    const { data, error } = await db
      .from('brand')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) return { ok: false, error: error.message, status: 500 };
    return { ok: true, data };
  } catch (error: unknown) {
    return failFromError(error, '브랜드 수정에 실패했습니다.', { status: 500 });
  }
}

export async function deactivateBrandAction(id: string, request?: Request): Promise<ActionResult<BrandRow>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission as any;
    
    // Switch to User Client (RLS Protected)
    const db = await createClient();

    const { data, error } = await db
      .from('brand')
      .update({ status: 'INACTIVE', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) return { ok: false, error: error.message, status: 500 };
    return { ok: true, data };
  } catch (error: unknown) {
    return failFromError(error, '브랜드 비활성화에 실패했습니다.', { status: 500 });
  }
}
