import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { markNotificationAsRead } from '@/lib/api/notifications';
import { fail, ok } from '@/lib/api/response';
import { logger } from '@/lib/logger';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return fail('UNAUTHORIZED', '로그인이 필요합니다.', { status: 401 });
    }

    await markNotificationAsRead(id, user.id);

    return ok({ success: true });
  } catch (error) {
    logger.error(error as Error, { route: 'PATCH /api/notifications/[id]/read', scope: 'api' });
    return fail('INTERNAL_ERROR', '알림 읽음 처리에 실패했습니다.', { status: 500 });
  }
}




