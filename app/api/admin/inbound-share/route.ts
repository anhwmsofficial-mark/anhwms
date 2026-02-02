import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { generateSlug, hashPassword } from '@/lib/share';

async function ensureUniqueSlug(db: ReturnType<typeof createAdminClient>, length = 7) {
  for (let i = 0; i < 6; i += 1) {
    const slug = generateSlug(length);
    const { data } = await db
      .from('inbound_receipt_shares')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!data) return slug;
  }
  return generateSlug(length + 1);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const receiptId = searchParams.get('receipt_id');
  if (!receiptId) {
    return NextResponse.json({ error: 'receipt_id가 필요합니다.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('inbound_receipt_shares')
    .select('*')
    .eq('receipt_id', receiptId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const body = await request.json();
  const receiptId = body?.receipt_id;
  if (!receiptId) {
    return NextResponse.json({ error: 'receipt_id가 필요합니다.' }, { status: 400 });
  }

  const db = createAdminClient();
  const slug = await ensureUniqueSlug(db, 7);

  const password = (body?.password || '').trim();
  const passwordData = password ? hashPassword(password) : null;

  const payload = {
    receipt_id: receiptId,
    slug,
    expires_at: body?.expires_at ?? null,
    password_salt: passwordData?.salt ?? null,
    password_hash: passwordData?.hash ?? null,
    language_default: body?.language_default ?? 'ko',
    summary_ko: body?.summary_ko ?? null,
    summary_en: body?.summary_en ?? null,
    summary_zh: body?.summary_zh ?? null,
    content: body?.content ?? {},
    created_by: user.id,
  };

  const { data, error } = await db
    .from('inbound_receipt_shares')
    .insert(payload)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data,
    shareUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.anhwms.com'}/share/inbound/${slug}`,
  });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const body = await request.json();
  const id = body?.id;
  if (!id) {
    return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });
  }

  const updates = body?.updates || {};
  const payload: Record<string, any> = {};
  if ('expires_at' in updates) payload.expires_at = updates.expires_at;
  if ('language_default' in updates) payload.language_default = updates.language_default;
  if ('summary_ko' in updates) payload.summary_ko = updates.summary_ko;
  if ('summary_en' in updates) payload.summary_en = updates.summary_en;
  if ('summary_zh' in updates) payload.summary_zh = updates.summary_zh;
  if ('content' in updates) payload.content = updates.content;

  const db = createAdminClient();
  const { data, error } = await db
    .from('inbound_receipt_shares')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const db = createAdminClient();
  const { error } = await db
    .from('inbound_receipt_shares')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
