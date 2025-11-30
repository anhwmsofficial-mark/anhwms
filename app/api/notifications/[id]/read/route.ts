import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { markNotificationAsRead } from '@/lib/api/notifications';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await markNotificationAsRead(id, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PATCH /api/notifications/[id]/read] error:', error);
    return NextResponse.json(
      { error: 'Failed to mark notification as read' },
      { status: 500 },
    );
  }
}


