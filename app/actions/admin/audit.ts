'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { ensurePermission } from '@/lib/actions/auth';
import { failFromError, type ActionResult } from '@/lib/actions/result';

export type AuditLogEntry = {
  id: string;
  created_at: string;
  action: string;
  table_name: string;
  record_id: string;
  old_value: any;
  new_value: any;
  request_id?: string;
  route?: string;
  action_name?: string;
  entity_type?: string;
  metadata?: any;
  user?: {
    email: string;
    display_name: string;
  };
};

export type AuditLogParams = {
  page?: number;
  limit?: number;
  action?: string;
  entityType?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export async function getAuditLogsAction(
  params: AuditLogParams = {},
  request?: Request
): Promise<ActionResult<{ data: AuditLogEntry[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>> {
  try {
    // Existing permission matrix uses manage:orders for admin audit access.
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission as any;

    const db = supabaseAdmin as any;

    const page = Math.max(1, Number(params.page || 1));
    const limit = Math.min(100, Math.max(1, Number(params.limit || 20)));
    const offset = (page - 1) * limit;

    let query = db
      .from('audit_logs')
      .select(`
        *,
        user:user_profiles!actor_id(email, display_name)
      `, { count: 'exact' });

    if (params.action) {
      query = query.eq('action_type', params.action);
    }
    if (params.entityType) {
      query = query.eq('resource_type', params.entityType);
    }
    if (params.userId) {
      query = query.eq('actor_id', params.userId);
    }
    if (params.dateFrom) {
      query = query.gte('created_at', params.dateFrom);
    }
    if (params.dateTo) {
      query = query.lte('created_at', params.dateTo);
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
        data: ((data || []) as any[]).map((row) => ({
          id: row.id,
          created_at: row.created_at,
          action: row.action_name || row.action_type,
          table_name: row.resource_type || '',
          record_id: row.resource_id || '',
          old_value: row.old_value,
          new_value: row.new_value,
          request_id: row.request_id,
          route: row.route,
          action_name: row.action_name || row.action_type,
          entity_type: row.entity_type || row.resource_type,
          metadata: row.metadata,
          user: row.user
            ? {
                email: row.user.email || '',
                display_name: row.user.display_name || '',
              }
            : undefined,
        })) as AuditLogEntry[],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      },
    };
  } catch (error: unknown) {
    return failFromError(error, '감사 로그 조회에 실패했습니다.');
  }
}
