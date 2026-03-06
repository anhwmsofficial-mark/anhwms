import supabaseAdmin from '@/lib/supabase-admin';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role?: string;
  jobTitle?: string | null;
  department?: string | null;
  canManageOrders?: boolean;
  canAccessAdmin?: boolean;
}

/**
 * 관리자 사용자 목록 조회
 */
export async function getAdminUsers(): Promise<AdminUser[]> {
  const db = supabaseAdmin as unknown as {
    from: (table: string) => any;
  };
  const { data, error } = await db
    .from('user_profiles')
    .select('id, display_name, full_name, email, role, department, status, deleted_at, can_manage_orders, can_access_admin')
    .order('display_name', { ascending: true });

  if (error) {
    console.error('[getAdminUsers] select failed', error);
    throw new Error('관리자 목록 조회에 실패했습니다.');
  }

  const rows = (data || []) as Array<{
    id: string;
    display_name?: string | null;
    full_name?: string | null;
    email?: string | null;
    role?: string | null;
    department?: string | null;
    status?: string | null;
    deleted_at?: string | null;
    can_manage_orders?: boolean | null;
    can_access_admin?: boolean | null;
  }>;
  return rows
    .filter((row) => !row.deleted_at)
    .filter((row) => String(row.status || 'active').toLowerCase() === 'active')
    .filter(
      (row) =>
        row.role === 'admin' ||
        row.role === 'manager' ||
        row.can_manage_orders === true ||
        row.can_access_admin === true,
    )
    .map((row) => ({
      id: row.id,
      name: row.display_name || row.full_name || row.email || '관리자',
      email: row.email || '',
      role: row.role || undefined,
      jobTitle: null,
      department: row.department || null,
      canManageOrders: row.can_manage_orders ?? undefined,
      canAccessAdmin: row.can_access_admin ?? undefined,
    }));
}

