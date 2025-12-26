import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUserNotifications, getUnreadNotificationCount } from '@/lib/api/notifications';

export async function GET() {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [notifications, unreadCount] = await Promise.all([
      getUserNotifications(user.id, { limit: 20 }),
      getUnreadNotificationCount(user.id),
    ]);

    return NextResponse.json({
      data: notifications,
      unreadCount,
    });
  } catch (error) {
    console.error('[GET /api/notifications] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 },
    );
  }
}



