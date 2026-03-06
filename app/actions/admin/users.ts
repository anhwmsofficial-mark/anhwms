'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { logAudit } from '@/utils/audit';
import { USER_ROLES, USER_STATUSES, UserRole, UserStatus } from '@/types/user';
import { ensureAdminUserAccess, ensurePermission } from '@/lib/actions/auth';
import { failFromError, isUnauthorizedError, type ActionResult } from '@/lib/actions/result';

type RawUserProfile = {
  id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
  role: string | null;
  department: string | null;
  status: string | null;
  can_access_admin: boolean | null;
  can_access_dashboard: boolean | null;
  can_manage_users: boolean | null;
  can_manage_inventory: boolean | null;
  can_manage_orders: boolean | null;
  last_login_at: string | null;
  created_at: string | null;
  deleted_at?: string | null;
  locked_until?: string | null;
  locked_reason?: string | null;
};

type UserProfileUpdate = Record<string, unknown>;
type CreateUserInput = {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
  canAccessAdmin?: boolean;
  canAccessDashboard?: boolean;
  department?: string;
};
type UpdateUserInput = {
  displayName?: string;
  role?: UserRole;
  status?: UserStatus;
  canAccessAdmin?: boolean;
  canAccessDashboard?: boolean;
  department?: string;
  password?: string;
  email?: string;
  lockUntil?: string | null;
  lockReason?: string | null;
};
const db = supabaseAdmin as any;

const mapProfile = (profile: RawUserProfile) => ({
  id: profile.id,
  email: profile.email,
  displayName: profile.display_name || profile.full_name || profile.email?.split('@')[0] || '이름 미정',
  role: (profile.role as UserRole) || 'viewer',
  department: profile.department,
  status: (profile.status as UserStatus) || 'inactive',
  canAccessAdmin: Boolean(profile.can_access_admin),
  canAccessDashboard: Boolean(profile.can_access_dashboard ?? true),
  canManageUsers: Boolean(profile.can_manage_users),
  canManageInventory: Boolean(profile.can_manage_inventory),
  canManageOrders: Boolean(profile.can_manage_orders),
  createdAt: profile.created_at,
  lastLoginAt: profile.last_login_at,
  deletedAt: profile.deleted_at ?? null,
  lockedUntil: profile.locked_until ?? null,
  lockedReason: profile.locked_reason ?? null,
});

export async function listUsersAction(): Promise<ActionResult<{ users: ReturnType<typeof mapProfile>[] }>> {
  try {
    const auth = await ensureAdminUserAccess();
    if (!auth.ok) {
      return { ok: false, error: auth.error, status: auth.status, code: auth.code };
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (authError) throw authError;

    const authUsers = authData?.users || [];
    const authIds = authUsers.map((u) => u.id);

    const { data: profileData, error: profileError } = await db
      .from('user_profiles')
      .select(
        'id,email,full_name,display_name,role,department,status,can_access_admin,can_access_dashboard,can_manage_users,can_manage_inventory,can_manage_orders,last_login_at,created_at,deleted_at,locked_until,locked_reason',
      )
      .in('id', authIds);
    if (profileError) throw profileError;

    const profileMap = new Map((profileData || []).map((p: RawUserProfile) => [p.id, p]));
    const missingProfiles = authUsers
      .filter((u) => !profileMap.has(u.id))
      .map((u) => ({
        id: u.id,
        email: u.email,
        full_name: u.user_metadata?.full_name || u.user_metadata?.name || null,
        display_name: u.user_metadata?.display_name || u.user_metadata?.name || null,
        org_id: auth.data.profile?.org_id || null,
        role: 'viewer',
        department: 'admin',
        can_access_admin: false,
        can_access_dashboard: true,
        can_manage_users: false,
        can_manage_inventory: false,
        can_manage_orders: false,
        status: 'active',
      }));

    if (missingProfiles.length > 0) {
      await db.from('user_profiles').upsert(missingProfiles, { onConflict: 'id' });
    }

    const { data: mergedData, error: mergedError } = await db
      .from('user_profiles')
      .select(
        'id,email,full_name,display_name,role,department,status,can_access_admin,can_access_dashboard,can_manage_users,can_manage_inventory,can_manage_orders,last_login_at,created_at,deleted_at,locked_until,locked_reason',
      )
      .in('id', authIds)
      .order('created_at', { ascending: false });
    if (mergedError) throw mergedError;

    return { ok: true, data: { users: (mergedData || []).map(mapProfile) } };
  } catch (error: unknown) {
    return failFromError(error, '사용자 정보를 불러오지 못했습니다.', { status: 500 });
  }
}

export async function createUserAction(body: CreateUserInput): Promise<ActionResult<{ user: ReturnType<typeof mapProfile> }>> {
  try {
    const auth = await ensureAdminUserAccess();
    if (!auth.ok) {
      return { ok: false, error: auth.error, status: auth.status, code: auth.code };
    }

    const { email, password, displayName, role, canAccessAdmin, canAccessDashboard, department } = body;
    if (!email || !password || !displayName || !role) {
      return { ok: false, error: '이메일, 비밀번호, 이름, 권한은 필수입니다.', status: 400, code: 'VALIDATION_ERROR' };
    }
    if (!USER_ROLES.includes(role)) {
      return { ok: false, error: '유효하지 않은 권한입니다.', status: 400, code: 'VALIDATION_ERROR' };
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
    if (!validEmail) {
      return { ok: false, error: '유효한 이메일 형식이 아닙니다.', status: 400, code: 'VALIDATION_ERROR' };
    }
    if (String(password).length < 8) {
      return { ok: false, error: '비밀번호는 8자 이상이어야 합니다.', status: 400, code: 'VALIDATION_ERROR' };
    }

    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
    });
    if (createError) throw createError;

    const userId = authData.user?.id;
    if (!userId) throw new Error('생성된 사용자 ID를 확인할 수 없습니다.');

    const shouldAccessAdmin =
      typeof canAccessAdmin === 'boolean' ? canAccessAdmin : ['admin', 'manager'].includes(role);
    const shouldAccessDashboard = typeof canAccessDashboard === 'boolean' ? canAccessDashboard : true;
    const { data: profileData, error: profileError } = await db
      .from('user_profiles')
      .upsert(
        {
          id: userId,
          email: normalizedEmail,
          full_name: displayName,
          display_name: displayName,
          org_id: auth.data.profile?.org_id || null,
          role,
          department: department || (role === 'operator' ? 'warehouse' : 'admin'),
          can_access_admin: shouldAccessAdmin,
          can_access_dashboard: shouldAccessDashboard,
          can_manage_users: role === 'admin',
          can_manage_inventory: ['admin', 'manager', 'operator'].includes(role),
          can_manage_orders: role !== 'viewer',
          status: USER_STATUSES[0],
        },
        { onConflict: 'id' },
      )
      .select()
      .single();

    if (profileError || !profileData) throw profileError || new Error('프로필 저장에 실패했습니다.');

    await logAudit({
      actionType: 'CREATE',
      resourceType: 'users',
      resourceId: userId,
      newValue: { email, displayName, role, department },
    });

    return { ok: true, data: { user: mapProfile(profileData as RawUserProfile) } };
  } catch (error: unknown) {
    return failFromError(error, '사용자 생성에 실패했습니다.', { status: 500 });
  }
}

export async function updateUserAction(id: string, body: UpdateUserInput, request?: Request): Promise<ActionResult<{ user: ReturnType<typeof mapProfile> }>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission as any;

    const {
      displayName,
      role,
      status,
      canAccessAdmin,
      canAccessDashboard,
      department,
      password,
      email,
      lockUntil,
      lockReason,
    } = body;

    const updates: UserProfileUpdate = {};
    if (displayName) {
      updates.full_name = displayName;
      updates.display_name = displayName;
    }
    if (role) {
      updates.role = role;
      updates.can_manage_users = role === 'admin';
      updates.can_manage_inventory = ['admin', 'manager', 'operator'].includes(role);
      updates.can_manage_orders = role !== 'viewer';
    }
    if (status) updates.status = status;
    if (typeof canAccessAdmin === 'boolean') updates.can_access_admin = canAccessAdmin;
    if (typeof canAccessDashboard === 'boolean') updates.can_access_dashboard = canAccessDashboard;
    if (department) updates.department = department;
    if (lockUntil !== undefined) updates.locked_until = lockUntil;
    if (lockReason !== undefined) updates.locked_reason = lockReason || null;
    if (email) updates.email = email;

    let profileData: RawUserProfile | null = null;
    let previousProfile: Record<string, unknown> | null = null;
    if (Object.keys(updates).length > 0) {
      const { data: existingProfile } = await db
        .from('user_profiles')
        .select(
          'id,email,full_name,display_name,role,department,status,can_access_admin,can_access_dashboard,can_manage_users,can_manage_inventory,can_manage_orders,last_login_at,created_at,deleted_at,locked_until,locked_reason',
        )
        .eq('id', id)
        .maybeSingle();
      previousProfile = existingProfile || null;

      const { data, error } = await db
        .from('user_profiles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      profileData = data;
      await logAudit({
        actionType: 'UPDATE',
        resourceType: 'users',
        resourceId: id,
        oldValue: previousProfile,
        newValue: profileData,
        reason: 'Admin user update',
      });
    }

    const authUpdates: { email?: string; password?: string } = {};
    if (password) authUpdates.password = password;
    if (email) authUpdates.email = email;
    if (Object.keys(authUpdates).length > 0) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdates);
      if (authError) throw authError;
    }

    if (!profileData) {
      const { data, error } = await db
        .from('user_profiles')
        .select(
          'id,email,full_name,display_name,role,department,status,can_access_admin,can_access_dashboard,can_manage_users,can_manage_inventory,can_manage_orders,last_login_at,created_at,deleted_at,locked_until,locked_reason',
        )
        .eq('id', id)
        .single();
      if (error) throw error;
      profileData = data;
    }

    if (!profileData) {
      return { ok: false, status: 404, error: '사용자 프로필을 찾을 수 없습니다.' };
    }

    return { ok: true, data: { user: mapProfile(profileData) } };
  } catch (error: unknown) {
    return failFromError(error, '사용자 수정에 실패했습니다.', {
      status: isUnauthorizedError(error) ? 403 : 500,
    });
  }
}

export async function deleteUserAction(id: string, request?: Request): Promise<ActionResult<{ success: true }>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission as any;
    const now = new Date().toISOString();
    const { data: oldProfile } = await db.from('user_profiles').select('*').eq('id', id).maybeSingle();

    const { error } = await db
      .from('user_profiles')
      .update({ deleted_at: now, status: 'inactive', locked_until: null, locked_reason: null })
      .eq('id', id);
    if (error) throw error;

    await logAudit({
      actionType: 'DELETE',
      resourceType: 'users',
      resourceId: id,
      oldValue: oldProfile,
      newValue: { deleted_at: now, status: 'inactive' },
      reason: 'Soft delete user',
    });

    return { ok: true, data: { success: true } };
  } catch (error: unknown) {
    return failFromError(error, '사용자 삭제에 실패했습니다.', {
      status: isUnauthorizedError(error) ? 403 : 500,
    });
  }
}

export async function userMutationAction(
  id: string,
  action: 'restore' | 'unlock',
  request?: Request,
): Promise<ActionResult<{ user: ReturnType<typeof mapProfile> }>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission as any;
    const { data: oldProfile } = await db.from('user_profiles').select('*').eq('id', id).maybeSingle();

    let updates: UserProfileUpdate = {};
    if (action === 'restore') updates = { deleted_at: null, status: 'active' };
    if (action === 'unlock') updates = { locked_until: null, locked_reason: null };

    const { data: updatedProfile, error } = await db
      .from('user_profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    await logAudit({
      actionType: 'UPDATE',
      resourceType: 'users',
      resourceId: id,
      oldValue: oldProfile,
      newValue: updatedProfile,
      reason: action === 'restore' ? 'Restore user' : 'Unlock user',
    });

    return { ok: true, data: { user: mapProfile(updatedProfile as RawUserProfile) } };
  } catch (error: unknown) {
    return failFromError(error, '사용자 변경에 실패했습니다.', {
      status: isUnauthorizedError(error) ? 403 : 500,
    });
  }
}

export async function listManagerUsersAction(): Promise<ActionResult<{ data: Array<{ id: string; name: string; role: string }> }>> {
  try {
    const { data: users, error } = await db
      .from('users')
      .select('id, username, role, email')
      .in('role', ['admin', 'manager', 'operator', 'staff'])
      .eq('status', 'active')
      .order('username');
    if (error) throw error;

    const managers = (users || []).map((user: any) => ({
      id: user.id,
      name: user.username || user.email?.split('@')[0] || 'Unknown',
      role: user.role,
    }));
    return { ok: true, data: { data: managers } };
  } catch (error: unknown) {
    return failFromError(error, '담당자 목록 조회에 실패했습니다.', { status: 500 });
  }
}
