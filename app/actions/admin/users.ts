'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { logAudit } from '@/utils/audit';
import { USER_ROLES, USER_STATUSES, UserRole, UserStatus } from '@/types/user';
import { ensureAdminUserAccess } from '@/lib/actions/auth';
import { failFromError, isUnauthorizedError, type ActionResult } from '@/lib/actions/result';

type RawUserProfile = {
  id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
  org_id: string | null;
  job_title?: string | null;
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
  orgId?: string;
  jobTitle?: string;
  canAccessAdmin?: boolean;
  canAccessDashboard?: boolean;
  department?: string;
};
type UpdateUserInput = {
  displayName?: string;
  role?: UserRole;
  status?: UserStatus;
  orgId?: string | null;
  jobTitle?: string;
  canAccessAdmin?: boolean;
  canAccessDashboard?: boolean;
  department?: string;
  password?: string;
  email?: string;
  lockUntil?: string | null;
  lockReason?: string | null;
};
const db = supabaseAdmin as any;

type AuthMetadata = {
  full_name?: string | null;
  display_name?: string | null;
  name?: string | null;
  username?: string | null;
  role?: string | null;
  job_title?: string | null;
  department?: string | null;
};

type AuthUserSummary = {
  id: string;
  email?: string | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
  user_metadata?: AuthMetadata | null;
};

type OrgRow = {
  id: string;
  name: string | null;
};

const normalizeOptionalText = (value?: string | null) => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || null;
};

const toLegacyUserRole = (role: UserRole | null | undefined) => {
  switch (role) {
    case 'admin':
    case 'manager':
    case 'operator':
      return role;
    default:
      return 'staff';
  }
};

const syncLegacyUserRow = async (params: {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  department?: string | null;
  status?: UserStatus | null;
}) => {
  const username = params.email.split('@')[0] || params.displayName;
  const legacyDepartment = normalizeOptionalText(params.department) || (params.role === 'operator' ? 'warehouse' : 'admin');

  const { error } = await db.from('users').upsert(
    {
      id: params.id,
      email: params.email,
      username,
      role: toLegacyUserRole(params.role),
      department: legacyDepartment,
      status: params.status || 'active',
    },
    { onConflict: 'id' },
  );

  if (error) throw error;
};

const mapProfile = (profile: RawUserProfile, authUser?: AuthUserSummary) => ({
  id: profile.id,
  email: profile.email,
  orgId: profile.org_id ?? null,
  displayName:
    profile.display_name ||
    profile.full_name ||
    authUser?.user_metadata?.display_name ||
    authUser?.user_metadata?.full_name ||
    authUser?.email?.split('@')[0] ||
    profile.email?.split('@')[0] ||
    '이름 미정',
  jobTitle: profile.job_title ?? authUser?.user_metadata?.job_title ?? null,
  role: (profile.role as UserRole) || 'viewer',
  department: profile.department ?? authUser?.user_metadata?.department ?? null,
  status: (profile.status as UserStatus) || 'inactive',
  canAccessAdmin: Boolean(profile.can_access_admin),
  canAccessDashboard: Boolean(profile.can_access_dashboard ?? true),
  canManageUsers: Boolean(profile.can_manage_users),
  canManageInventory: Boolean(profile.can_manage_inventory),
  canManageOrders: Boolean(profile.can_manage_orders),
  createdAt: profile.created_at || authUser?.created_at || null,
  lastLoginAt: profile.last_login_at || authUser?.last_sign_in_at || null,
  deletedAt: profile.deleted_at ?? null,
  lockedUntil: profile.locked_until ?? null,
  lockedReason: profile.locked_reason ?? null,
});

export async function listUserOrgsAction(): Promise<ActionResult<{ orgs: Array<{ id: string; name: string }> }>> {
  try {
    const auth = await ensureAdminUserAccess();
    if (!auth.ok) {
      return { ok: false, error: auth.error, status: auth.status, code: auth.code };
    }

    const { data, error } = await db
      .from('org')
      .select('id, name')
      .order('created_at', { ascending: true });

    if (error) throw error;

    return {
      ok: true,
      data: {
        orgs: ((data || []) as OrgRow[]).map((org) => ({
          id: org.id,
          name: org.name || '이름 없는 조직',
        })),
      },
    };
  } catch (error: unknown) {
    return failFromError(error, '조직 목록을 불러오지 못했습니다.', { status: 500 });
  }
}

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

    const authUsers = (authData?.users || []) as AuthUserSummary[];
    const authIds = authUsers.map((u) => u.id);
    const authMap = new Map(authUsers.map((user) => [user.id, user]));

    const { data: profileData, error: profileError } = await db
      .from('user_profiles')
      .select('*')
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
        department: normalizeOptionalText(u.user_metadata?.department) || 'admin',
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
      .select('*')
      .in('id', authIds)
      .order('created_at', { ascending: false });
    if (mergedError) throw mergedError;

    return {
      ok: true,
      data: { users: (mergedData || []).map((profile: RawUserProfile) => mapProfile(profile, authMap.get(profile.id))) },
    };
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

    const { email, password, displayName, role, orgId, jobTitle, canAccessAdmin, canAccessDashboard, department } = body;
    if (!email || !password || !displayName || !role) {
      return { ok: false, error: '이메일, 비밀번호, 이름, 권한은 필수입니다.', status: 400, code: 'VALIDATION_ERROR' };
    }
    if (!USER_ROLES.includes(role)) {
      return { ok: false, error: '유효하지 않은 권한입니다.', status: 400, code: 'VALIDATION_ERROR' };
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedDisplayName = String(displayName).trim();
    const normalizedDepartment = normalizeOptionalText(department);
    const normalizedJobTitle = normalizeOptionalText(jobTitle);
    const normalizedOrgId = normalizeOptionalText(orgId) || auth.data.profile?.org_id || null;
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
      user_metadata: {
        username: normalizedEmail.split('@')[0],
        full_name: normalizedDisplayName,
        display_name: normalizedDisplayName,
        name: normalizedDisplayName,
        role: toLegacyUserRole(role),
        job_title: normalizedJobTitle,
        department: normalizedDepartment,
      },
    });
    if (createError) throw createError;

    const userId = authData.user?.id;
    if (!userId) throw new Error('생성된 사용자 ID를 확인할 수 없습니다.');

    const shouldAccessAdmin = typeof canAccessAdmin === 'boolean' ? canAccessAdmin : ['admin', 'manager'].includes(role);
    const shouldAccessDashboard = typeof canAccessDashboard === 'boolean' ? canAccessDashboard : true;
    let profileData: RawUserProfile | null = null;
    try {
      const { data, error: profileError } = await db
        .from('user_profiles')
        .upsert(
          {
            id: userId,
            email: normalizedEmail,
            full_name: normalizedDisplayName,
            display_name: normalizedDisplayName,
            org_id: normalizedOrgId,
            role,
            department: normalizedDepartment || (role === 'operator' ? 'warehouse' : 'admin'),
            can_access_admin: shouldAccessAdmin,
            can_access_dashboard: shouldAccessDashboard,
            can_manage_users: role === 'admin',
            can_manage_inventory: ['admin', 'manager', 'operator'].includes(role),
            can_manage_orders: role !== 'viewer',
            status: USER_STATUSES[0],
          },
          { onConflict: 'id' },
        )
        .select('*')
        .single();

      if (profileError || !data) throw profileError || new Error('프로필 저장에 실패했습니다.');
      profileData = data as RawUserProfile;

      await syncLegacyUserRow({
        id: userId,
        email: normalizedEmail,
        displayName: normalizedDisplayName,
        role,
        department: normalizedDepartment,
        status: USER_STATUSES[0],
      });
    } catch (profileSyncError) {
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => undefined);
      throw profileSyncError;
    }

    await logAudit({
      actionType: 'CREATE',
      resourceType: 'users',
      resourceId: userId,
      newValue: { email: normalizedEmail, displayName: normalizedDisplayName, role, jobTitle: normalizedJobTitle, department: normalizedDepartment },
    });

    return {
      ok: true,
      data: {
        user: mapProfile(profileData, {
          id: userId,
          email: normalizedEmail,
          user_metadata: {
            full_name: normalizedDisplayName,
            display_name: normalizedDisplayName,
            name: normalizedDisplayName,
            job_title: normalizedJobTitle,
            department: normalizedDepartment,
            role: toLegacyUserRole(role),
          },
        }),
      },
    };
  } catch (error: unknown) {
    return failFromError(error, '사용자 생성에 실패했습니다.', { status: 500 });
  }
}

export async function updateUserAction(id: string, body: UpdateUserInput, _request?: Request): Promise<ActionResult<{ user: ReturnType<typeof mapProfile> }>> {
  try {
    void _request;
    const auth = await ensureAdminUserAccess();
    if (!auth.ok) return auth as any;

    const {
      displayName,
      role,
      status,
      orgId,
      jobTitle,
      canAccessAdmin,
      canAccessDashboard,
      department,
      password,
      email,
      lockUntil,
      lockReason,
    } = body;

    const updates: UserProfileUpdate = {};
    const normalizedDisplayName = normalizeOptionalText(displayName);
    const normalizedDepartment = department === undefined ? undefined : normalizeOptionalText(department);
    const normalizedJobTitle = jobTitle === undefined ? undefined : normalizeOptionalText(jobTitle);
    const normalizedEmail = email ? String(email).trim().toLowerCase() : undefined;
    const normalizedOrgId = orgId === undefined ? undefined : normalizeOptionalText(orgId);

    if (displayName !== undefined) {
      updates.full_name = normalizedDisplayName;
      updates.display_name = normalizedDisplayName;
    }
    if (role) {
      updates.role = role;
      if (typeof canAccessAdmin !== 'boolean') {
        updates.can_access_admin = ['admin', 'manager'].includes(role);
      }
      updates.can_manage_users = role === 'admin';
      updates.can_manage_inventory = ['admin', 'manager', 'operator'].includes(role);
      updates.can_manage_orders = role !== 'viewer';
    }
    if (status) updates.status = status;
    if (orgId !== undefined) updates.org_id = normalizedOrgId;
    if (typeof canAccessAdmin === 'boolean') updates.can_access_admin = canAccessAdmin;
    if (typeof canAccessDashboard === 'boolean') updates.can_access_dashboard = canAccessDashboard;
    if (department !== undefined) updates.department = normalizedDepartment;
    if (lockUntil !== undefined) updates.locked_until = lockUntil;
    if (lockReason !== undefined) updates.locked_reason = lockReason || null;
    if (normalizedEmail) updates.email = normalizedEmail;

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
        .select('*')
        .single();
      if (error) throw error;

      profileData = data as RawUserProfile;
      await logAudit({
        actionType: 'UPDATE',
        resourceType: 'users',
        resourceId: id,
        oldValue: previousProfile,
        newValue: profileData,
        reason: 'Admin user update',
      });
    }

    const authAdmin = supabaseAdmin.auth.admin as any;
    const authUpdates: { email?: string; password?: string; user_metadata?: AuthMetadata } = {};
    if (password) authUpdates.password = password;
    if (normalizedEmail) authUpdates.email = normalizedEmail;
    if (
      normalizedDisplayName !== undefined ||
      normalizedDepartment !== undefined ||
      normalizedJobTitle !== undefined ||
      role !== undefined ||
      normalizedEmail !== undefined
    ) {
      const { data: authUserData, error: authUserError } = await authAdmin.getUserById(id);
      if (authUserError) throw authUserError;

      const currentMetadata = (authUserData?.user?.user_metadata || {}) as AuthMetadata;
      authUpdates.user_metadata = {
        ...currentMetadata,
        ...(normalizedDisplayName !== undefined
          ? {
              full_name: normalizedDisplayName,
              display_name: normalizedDisplayName,
              name: normalizedDisplayName,
            }
          : {}),
        ...(normalizedEmail !== undefined ? { username: normalizedEmail.split('@')[0] } : {}),
        ...(role !== undefined ? { role: toLegacyUserRole(role) } : {}),
        ...(normalizedDepartment !== undefined ? { department: normalizedDepartment } : {}),
        ...(normalizedJobTitle !== undefined ? { job_title: normalizedJobTitle } : {}),
      };
    }
    if (Object.keys(authUpdates).length > 0) {
      const { error: authError } = await authAdmin.updateUserById(id, authUpdates);
      if (authError) throw authError;
    }

    if (!profileData) {
      const { data, error } = await db
        .from('user_profiles')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      profileData = data as RawUserProfile;
    }

    if (!profileData) {
      return { ok: false, status: 404, error: '사용자 프로필을 찾을 수 없습니다.' };
    }

    await syncLegacyUserRow({
      id,
      email: normalizedEmail || profileData.email,
      displayName: normalizedDisplayName || profileData.display_name || profileData.full_name || profileData.email,
      role: (role || profileData.role || 'viewer') as UserRole,
      department: normalizedDepartment === undefined ? profileData.department : normalizedDepartment,
      status: (status || profileData.status || 'active') as UserStatus,
    });

    return { ok: true, data: { user: mapProfile(profileData) } };
  } catch (error: unknown) {
    return failFromError(error, '사용자 수정에 실패했습니다.', {
      status: isUnauthorizedError(error) ? 403 : 500,
    });
  }
}

export async function deleteUserAction(id: string, _request?: Request): Promise<ActionResult<{ success: true }>> {
  try {
    void _request;
    const auth = await ensureAdminUserAccess();
    if (!auth.ok) return auth as any;
    const now = new Date().toISOString();
    const { data: oldProfile } = await db.from('user_profiles').select('*').eq('id', id).maybeSingle();

    const [{ error: profileError }, { error: legacyError }] = await Promise.all([
      db
        .from('user_profiles')
        .update({ deleted_at: now, status: 'inactive', locked_until: null, locked_reason: null })
        .eq('id', id),
      db
        .from('users')
        .update({ status: 'inactive' })
        .eq('id', id),
    ]);
    if (profileError) throw profileError;
    if (legacyError) throw legacyError;

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
  _request?: Request,
): Promise<ActionResult<{ user: ReturnType<typeof mapProfile> }>> {
  try {
    void _request;
    const auth = await ensureAdminUserAccess();
    if (!auth.ok) return auth as any;
    const { data: oldProfile } = await db.from('user_profiles').select('*').eq('id', id).maybeSingle();

    let updates: UserProfileUpdate = {};
    if (action === 'restore') updates = { deleted_at: null, status: 'active' };
    if (action === 'unlock') updates = { locked_until: null, locked_reason: null };

    const { data: updatedProfile, error } = await db
      .from('user_profiles')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;

    if (action === 'restore') {
      const { error: legacyRestoreError } = await db.from('users').update({ status: 'active' }).eq('id', id);
      if (legacyRestoreError) throw legacyRestoreError;
    }

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
