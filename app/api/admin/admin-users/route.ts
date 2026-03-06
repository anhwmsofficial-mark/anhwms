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

    return ok(adminUsers, { status: 200 });
  } catch (error) {
    console.error('[GET /api/admin/admin-users] error:', error);
    return fail('INTERNAL_ERROR', 'Failed to fetch admin users', { status: 500 });
  }
}

