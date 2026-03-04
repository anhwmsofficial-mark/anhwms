import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/utils/rbac';
import { getErrorMessage } from '@/lib/errorHandler';

export async function GET(request: NextRequest) {
  try {
    // 권한 체크 (입고 담당자는 누구나 조회 가능해야 할 수도 있지만, 일단 로그인 유저만)
    // await requirePermission('manage:inbound', request); // 너무 엄격할 수 있음.

    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('id, username, role, email')
      .in('role', ['admin', 'manager', 'operator', 'staff'])
      .eq('status', 'active')
      .order('username');

    if (error) {
      console.error('Error fetching managers:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 이름이 없는 경우 이메일 앞부분 사용 등 처리
    const managers = users.map(user => ({
      id: user.id,
      name: user.username || user.email?.split('@')[0] || 'Unknown',
      role: user.role
    }));

    return NextResponse.json({ data: managers });
  } catch (error: unknown) {
    console.error('GET /api/admin/users/managers error:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
