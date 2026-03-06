import { getAdminUsers } from '@/lib/api/adminUsers';
import { getCurrentUser } from '@/utils/rbac';
import { fail, ok } from '@/lib/api/response';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return fail('UNAUTHORIZED', 'Unauthorized', { status: 401 });
    }

    const adminUsers = await getAdminUsers();

    return ok(
      {
        users: adminUsers,
        currentUserId: user.id,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[GET /api/admin/admin-users] error:', error);
    if (error instanceof Error && /Unauthorized:/i.test(error.message)) {
      return fail('FORBIDDEN', '담당자 목록 조회 권한이 없습니다.', { status: 403 });
    }
    return fail('INTERNAL_ERROR', 'Failed to fetch admin users', { status: 500 });
  }
}

