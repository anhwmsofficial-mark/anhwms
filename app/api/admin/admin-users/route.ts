import { getAdminUsers } from '@/lib/api/adminUsers';
import { getCurrentUser } from '@/utils/rbac';
import { toAppApiError } from '@/lib/api/errors';
import { fail, ok } from '@/lib/api/response';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return fail('UNAUTHORIZED', '로그인이 필요합니다.', { status: 401 });
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
    const apiError = toAppApiError(error, {
      error: 'Failed to fetch admin users',
      code: 'INTERNAL_ERROR',
      status: 500,
    });
    return fail(apiError.code || 'INTERNAL_ERROR', apiError.message, {
      status: apiError.status,
      details: apiError.details,
    });
  }
}

