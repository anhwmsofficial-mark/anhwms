import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { markAllNotificationsAsRead } from '@/lib/api/notifications';

export async function PATCH() {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await markAllNotificationsAsRead(user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PATCH /api/notifications/read-all] error:', error);
    return NextResponse.json(
      { error: 'Failed to mark all notifications as read' },
      { status: 500 },
    );
  }
}

