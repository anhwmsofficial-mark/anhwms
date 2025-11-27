import { NextResponse } from 'next/server';
import { getAdminUsers } from '@/lib/api/adminUsers';
import { createClient } from '@/lib/supabase-server';

export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminUsers = await getAdminUsers();

    return NextResponse.json({ data: adminUsers }, { status: 200 });
  } catch (error) {
    console.error('[GET /api/admin/users] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch admin users' },
      { status: 500 },
    );
  }
}
