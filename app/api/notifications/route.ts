import { getUserNotifications, getUnreadNotificationCount } from '@/lib/api/notifications';
import { fail, ok } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { getCurrentUser } from '@/utils/rbac';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      return fail('UNAUTHORIZED', '로그인이 필요합니다.', { status: 401 });
    }

    const [notifications, unreadCount] = await Promise.all([
      getUserNotifications(user.id, { limit: 20 }),
      getUnreadNotificationCount(user.id),
    ]);

    return ok({
      data: notifications,
      unreadCount,
    });
  } catch (error) {
    logger.error(error as Error, { route: 'GET /api/notifications', scope: 'api' });
    return fail('INTERNAL_ERROR', '알림을 불러오지 못했습니다.', { status: 500 });
  }
}




