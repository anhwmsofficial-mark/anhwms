import { createClient } from '@/utils/supabase/server';
import { markAllNotificationsAsRead } from '@/lib/api/notifications';
import { fail, ok } from '@/lib/api/response';
import { logger } from '@/lib/logger';

export async function PATCH() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return fail('UNAUTHORIZED', 'Unauthorized', { status: 401 });
    }

    await markAllNotificationsAsRead(user.id);

    return ok({ success: true });
  } catch (error) {
    logger.error(error as Error, { route: 'PATCH /api/notifications/read-all', scope: 'api' });
    return fail('INTERNAL_ERROR', 'Failed to mark all notifications as read', { status: 500 });
  }
}




