import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '로그인이 필요합니다.' };
  const db = createAdminClient();
  const { data: profile } = await db
    .from('user_profiles')
    .select('role, can_access_admin')
    .eq('id', user.id)
    .maybeSingle();
  if (!(profile?.role === 'admin' || profile?.can_access_admin)) {
    return { error: '관리자 권한이 필요합니다.' };
  }
  return { user, db };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 });
  const { db } = auth;

  const { searchParams } = new URL(request.url);
  const key = searchParams.get('alert_key');

  let query = db.from('alert_settings').select('*').order('updated_at', { ascending: false });
  if (key) query = query.eq('alert_key', key);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data || [] });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 });
  const { db } = auth;

  const body = await request.json();
  const alertKey = body?.alert_key;
  if (!alertKey) {
    return NextResponse.json({ error: 'alert_key가 필요합니다.' }, { status: 400 });
  }

  const payload = {
    alert_key: alertKey,
    enabled: body?.enabled ?? true,
    channels: body?.channels ?? ['notification', 'slack', 'email', 'kakao'],
    notify_roles: body?.notify_roles ?? ['admin'],
    notify_users: body?.notify_users ?? [],
    cooldown_minutes: body?.cooldown_minutes ?? 1440,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await db
    .from('alert_settings')
    .upsert(payload, { onConflict: 'alert_key' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
