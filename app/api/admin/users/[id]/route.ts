/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { mapProfile } from '../route';
import { logAudit } from '@/utils/audit';
import { fail, getRouteContext, ok } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { requirePermission } from '@/utils/rbac';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = getRouteContext(request, 'PUT /api/admin/users/[id]');
  try {
    await requirePermission('manage:orders', request);
    const body = await request.json();
    const { id } = await params;

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

    const updates: Record<string, any> = {};

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
    if (status) {
      updates.status = status;
    }
    if (typeof canAccessAdmin === 'boolean') {
      updates.can_access_admin = canAccessAdmin;
    }
    if (typeof canAccessDashboard === 'boolean') {
      updates.can_access_dashboard = canAccessDashboard;
    }
    if (department) {
      updates.department = department;
    }
    if (lockUntil !== undefined) {
      updates.locked_until = lockUntil;
    }
    if (lockReason !== undefined) {
      updates.locked_reason = lockReason || null;
    }

    let profileData = null;

    if (email) {
      updates.email = email;
    }

    let previousProfile: any = null;
    if (Object.keys(updates).length > 0) {
      const { data: existingProfile } = await supabaseAdmin
        .from('user_profiles')
        .select(
          'id,email,full_name,display_name,role,department,status,can_access_admin,can_access_dashboard,can_manage_users,can_manage_inventory,can_manage_orders,last_login_at,created_at,deleted_at,locked_until,locked_reason',
        )
        .eq('id', id)
        .maybeSingle();
      previousProfile = existingProfile || null;

      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

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
    if (password) {
      authUpdates.password = password;
    }
    if (email) {
      authUpdates.email = email;
    }

    if (Object.keys(authUpdates).length > 0) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        id,
        authUpdates,
      );

      if (authError) {
        throw authError;
      }
    }

    if (!profileData) {
      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .select(
          'id,email,full_name,display_name,role,department,status,can_access_admin,can_access_dashboard,can_manage_users,can_manage_inventory,can_manage_orders,last_login_at,created_at,deleted_at,locked_until,locked_reason',
        )
        .eq('id', id)
        .single();

      if (error) {
        throw error;
      }

      profileData = data;
    }

    return ok({
      user: mapProfile(profileData),
    }, { requestId: ctx.requestId });
  } catch (error: any) {
    logger.error(error as Error, { ...ctx, scope: 'api' });
    return fail('INTERNAL_ERROR', error.message || '사용자 수정에 실패했습니다.', {
      status: 500,
      requestId: ctx.requestId,
    });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = getRouteContext(request, 'DELETE /api/admin/users/[id]');
  try {
    await requirePermission('manage:orders', request);
    const { id } = await params;

    const now = new Date().toISOString();
    const { data: oldProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    const { error } = await supabaseAdmin
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

    return ok({ success: true }, { requestId: ctx.requestId });
  } catch (error: any) {
    logger.error(error as Error, { ...ctx, scope: 'api' });
    return fail('INTERNAL_ERROR', error.message || '사용자 삭제에 실패했습니다.', {
      status: 500,
      requestId: ctx.requestId,
    });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = getRouteContext(request, 'POST /api/admin/users/[id]');
  try {
    await requirePermission('manage:orders', request);
    const { id } = await params;
    const body = await request.json();
    const action = body?.action;

    if (!action || !['restore', 'unlock'].includes(action)) {
      return fail('BAD_REQUEST', 'Invalid action', { status: 400, requestId: ctx.requestId });
    }

    const { data: oldProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    let updates: Record<string, any> = {};
    if (action === 'restore') {
      updates = { deleted_at: null, status: 'active' };
    } else if (action === 'unlock') {
      updates = { locked_until: null, locked_reason: null };
    }

    const { data: updatedProfile, error } = await supabaseAdmin
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

    return ok({ user: mapProfile(updatedProfile) }, { requestId: ctx.requestId });
  } catch (error: any) {
    logger.error(error as Error, { ...ctx, scope: 'api' });
    return fail('INTERNAL_ERROR', error.message || '사용자 복구에 실패했습니다.', {
      status: 500,
      requestId: ctx.requestId,
    });
  }
}

