import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { verifyPassword } from '@/lib/share';

function isExpired(expiresAt?: string | null) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');
  if (!slug) {
    return NextResponse.json({ error: 'slug가 필요합니다.' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('inbound_receipt_shares')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: '공유 링크를 찾을 수 없습니다.' }, { status: 404 });
  }

  if (isExpired(data.expires_at)) {
    return NextResponse.json({ error: '공유 링크가 만료되었습니다.' }, { status: 410 });
  }

  const requiresPassword = Boolean(data.password_hash && data.password_salt);

  await db
    .from('inbound_receipt_shares')
    .update({ last_accessed_at: new Date().toISOString() })
    .eq('id', data.id);

  if (requiresPassword) {
    return NextResponse.json({
      requiresPassword: true,
      language_default: data.language_default,
      expires_at: data.expires_at,
    });
  }

  return NextResponse.json({
    requiresPassword: false,
    share: {
      content: data.content,
      summary_ko: data.summary_ko,
      summary_en: data.summary_en,
      summary_zh: data.summary_zh,
      language_default: data.language_default,
      expires_at: data.expires_at,
    },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const slug = body?.slug;
  const password = body?.password || '';
  if (!slug) {
    return NextResponse.json({ error: 'slug가 필요합니다.' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('inbound_receipt_shares')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: '공유 링크를 찾을 수 없습니다.' }, { status: 404 });
  }

  if (isExpired(data.expires_at)) {
    return NextResponse.json({ error: '공유 링크가 만료되었습니다.' }, { status: 410 });
  }

  if (!data.password_hash || !data.password_salt) {
    return NextResponse.json({ error: '비밀번호가 설정되지 않았습니다.' }, { status: 400 });
  }

  const ok = verifyPassword(password, data.password_salt, data.password_hash);
  if (!ok) {
    return NextResponse.json({ error: '비밀번호가 올바르지 않습니다.' }, { status: 401 });
  }

  await db
    .from('inbound_receipt_shares')
    .update({ last_accessed_at: new Date().toISOString() })
    .eq('id', data.id);

  return NextResponse.json({
    share: {
      content: data.content,
      summary_ko: data.summary_ko,
      summary_en: data.summary_en,
      summary_zh: data.summary_zh,
      language_default: data.language_default,
      expires_at: data.expires_at,
    },
  });
}
