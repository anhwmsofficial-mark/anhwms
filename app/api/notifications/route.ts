import { createClient } from '@/utils/supabase/server';
import { getUserNotifications, getUnreadNotificationCount } from '@/lib/api/notifications';
import { fail, ok } from '@/lib/api/response';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return fail('UNAUTHORIZED', 'Unauthorized', { status: 401 });
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
    return fail('INTERNAL_ERROR', 'Failed to fetch notifications', { status: 500 });
  }
}




