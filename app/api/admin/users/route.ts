import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

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
};

const mapProfile = (profile: RawUserProfile) => ({
  id: profile.id,
  email: profile.email,
  displayName:
    profile.display_name ||
    profile.full_name ||
    profile.email?.split('@')[0] ||
    '이름 미정',
  role: (profile.role as 'admin' | 'manager' | 'operator' | 'viewer') || 'viewer',
  department: profile.department,
  status: profile.status || 'inactive',
  canAccessAdmin: Boolean(profile.can_access_admin),
  canAccessDashboard: Boolean(profile.can_access_dashboard ?? true),
  canManageUsers: Boolean(profile.can_manage_users),
  canManageInventory: Boolean(profile.can_manage_inventory),
  canManageOrders: Boolean(profile.can_manage_orders),
  createdAt: profile.created_at,
  lastLoginAt: profile.last_login_at,
});

export async function GET() {
  try {
    // 1) Auth 사용자 목록 조회
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (authError) throw authError;

    const authUsers = authData?.users || [];
    const authIds = authUsers.map((u) => u.id);

    // 2) 기존 프로필 조회
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select(
        'id,email,full_name,display_name,role,department,status,can_access_admin,can_access_dashboard,can_manage_users,can_manage_inventory,can_manage_orders,last_login_at,created_at',
      )
      .in('id', authIds);
    if (profileError) throw profileError;

    const profileMap = new Map((profileData || []).map((p) => [p.id, p]));

    // 3) 프로필 누락 사용자 보정 (최소 정보로 생성)
    const missingProfiles = authUsers
      .filter((u) => !profileMap.has(u.id))
      .map((u) => ({
        id: u.id,
        email: u.email,
        full_name: u.user_metadata?.full_name || u.user_metadata?.name || null,
        display_name: u.user_metadata?.display_name || u.user_metadata?.name || null,
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
      await supabaseAdmin.from('user_profiles').upsert(missingProfiles, { onConflict: 'id' });
    }

    // 4) 최신 프로필 재조회 (정합성 보장)
    const { data: mergedData, error: mergedError } = await supabaseAdmin
      .from('user_profiles')
      .select(
        'id,email,full_name,display_name,role,department,status,can_access_admin,can_access_dashboard,can_manage_users,can_manage_inventory,can_manage_orders,last_login_at,created_at',
      )
      .in('id', authIds)
      .order('created_at', { ascending: false });
    if (mergedError) throw mergedError;

    return NextResponse.json({
      users: (mergedData || []).map(mapProfile),
    });
  } catch (error: any) {
    console.error('GET /api/admin/users error:', error);
    return NextResponse.json(
      { error: error.message || '사용자 정보를 불러오지 못했습니다.' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      email,
      password,
      displayName,
      role,
      canAccessAdmin,
      canAccessDashboard,
      department,
    } = body;

    if (!email || !password || !displayName || !role) {
      return NextResponse.json(
        { error: '이메일, 비밀번호, 이름, 권한은 필수입니다.' },
        { status: 400 },
      );
    }

    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      throw createError;
    }

    const userId = authData.user?.id;
    if (!userId) {
      throw new Error('생성된 사용자 ID를 확인할 수 없습니다.');
    }

    const shouldAccessAdmin =
      typeof canAccessAdmin === 'boolean' ? canAccessAdmin : ['admin', 'manager'].includes(role);
    const shouldAccessDashboard =
      typeof canAccessDashboard === 'boolean' ? canAccessDashboard : true;

    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .upsert(
        {
          id: userId,
          email,
          full_name: displayName,
          display_name: displayName,
          role,
          department: department || (role === 'operator' ? 'warehouse' : 'admin'),
          can_access_admin: shouldAccessAdmin,
          can_access_dashboard: shouldAccessDashboard,
          can_manage_users: role === 'admin',
          can_manage_inventory: ['admin', 'manager', 'operator'].includes(role),
          can_manage_orders: role !== 'viewer',
          status: 'active',
        },
        { onConflict: 'id' },
      )
      .select()
      .single();

    if (profileError || !profileData) {
      throw profileError || new Error('프로필 저장에 실패했습니다.');
    }

    return NextResponse.json(
      {
        user: mapProfile(profileData as RawUserProfile),
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error('POST /api/admin/users error:', error);
    return NextResponse.json(
      { error: error.message || '사용자 생성에 실패했습니다.' },
      { status: 500 },
    );
  }
}

export { mapProfile };

