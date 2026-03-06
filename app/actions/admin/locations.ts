'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { ensurePermission } from '@/lib/actions/auth';
import { failFromError, type ActionResult } from '@/lib/actions/result';
import type { Database } from '@/types/supabase';

type LocationRow = Database['public']['Tables']['location']['Row'];
type LocationInsert = Database['public']['Tables']['location']['Insert'];
type LocationUpdate = Database['public']['Tables']['location']['Update'];
type LocationListItem = LocationRow & { warehouse?: { id: string; name: string } | null };

export async function listLocationsAction(
  params: { warehouseId?: string; status?: string; search?: string } = {},
  request?: Request,
): Promise<ActionResult<{ data: LocationListItem[] }>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission;
    const warehouseId = params.warehouseId || '';
    const status = params.status || 'ACTIVE';
    const search = params.search || '';

    let query = supabaseAdmin
      .from('location')
      .select('*, warehouse:warehouse(id, name)')
      .order('code', { ascending: true });

    if (warehouseId) query = query.eq('warehouse_id', warehouseId);
    if (status) query = query.eq('status', status);
    if (search) query = query.or(`code.ilike.%${search}%,zone.ilike.%${search}%,type.ilike.%${search}%`);

    const { data, error } = await query;
    if (error) return { ok: false, error: error.message, status: 500 };
    return { ok: true, data: { data: (data || []) as LocationListItem[] } };
  } catch (error: unknown) {
    return failFromError(error, '로케이션 목록 조회에 실패했습니다.', { status: 500 });
  }
}

export async function createLocationAction(body: LocationInsert, request?: Request): Promise<ActionResult<LocationRow>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission;
    const { data, error } = await supabaseAdmin.from('location').insert([body]).select().single();
    if (error) return { ok: false, error: error.message, status: 500 };
    return { ok: true, data };
  } catch (error: unknown) {
    return failFromError(error, '로케이션 생성에 실패했습니다.', { status: 500 });
  }
}

export async function updateLocationAction(id: string, body: LocationUpdate, request?: Request): Promise<ActionResult<LocationRow>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission;
    const { data, error } = await supabaseAdmin
      .from('location')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) return { ok: false, error: error.message, status: 500 };
    return { ok: true, data };
  } catch (error: unknown) {
    return failFromError(error, '로케이션 수정에 실패했습니다.', { status: 500 });
  }
}

export async function deactivateLocationAction(id: string, request?: Request): Promise<ActionResult<LocationRow>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission;
    const { data, error } = await supabaseAdmin
      .from('location')
      .update({ status: 'INACTIVE', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) return { ok: false, error: error.message, status: 500 };
    return { ok: true, data };
  } catch (error: unknown) {
    return failFromError(error, '로케이션 비활성화에 실패했습니다.', { status: 500 });
  }
}
