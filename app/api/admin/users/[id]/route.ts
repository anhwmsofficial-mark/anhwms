import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { mapProfile } from '../route';

const mapRoleToLegacyUser = (role: string) => {
  if (['admin', 'manager', 'operator', 'partner', 'staff'].includes(role)) {
    return role;
  }
  return 'staff';
};

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
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

    let profileData = null;

    if (email) {
      updates.email = email;
    }

    if (Object.keys(updates).length > 0) {
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

    if (role || email || department || status) {
      const legacyUpdates: Record<string, any> = {};
      if (role) legacyUpdates.role = mapRoleToLegacyUser(role);
      if (email) legacyUpdates.email = email;
      if (department) legacyUpdates.department = department;
      if (status) legacyUpdates.status = status;
      if (Object.keys(legacyUpdates).length > 0) {
        await supabaseAdmin.from('users').update(legacyUpdates).eq('id', id);
      }
    }

    if (!profileData) {
      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .select(
          'id,email,full_name,display_name,role,department,status,can_access_admin,can_access_dashboard,can_manage_users,can_manage_inventory,can_manage_orders,last_login_at,created_at',
        )
        .eq('id', id)
        .single();

      if (error) {
        throw error;
      }

      profileData = data;
    }

    return NextResponse.json({
      user: mapProfile(profileData),
    });
  } catch (error: any) {
    console.error('PUT /api/admin/users/[id] error:', error);
    return NextResponse.json(
      { error: error.message || '사용자 수정에 실패했습니다.' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) {
      throw error;
    }

    await supabaseAdmin.from('user_profiles').delete().eq('id', id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/admin/users/[id] error:', error);
    return NextResponse.json(
      { error: error.message || '사용자 삭제에 실패했습니다.' },
      { status: 500 },
    );
  }
}

