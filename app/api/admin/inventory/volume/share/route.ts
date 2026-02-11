import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { generateSlug, hashPassword } from '@/lib/share';

type SharePayload = {
  customer_id: string;
  date_from: string | null;
  date_to: string | null;
  expires_at: string | null;
  password_hash: string | null;
  password_salt: string | null;
  created_by: string;
};

const toIsoDate = (value?: string | null) => {
  if (!value) return null;
  const normalized = String(value).trim().replace(/\./g, '-').replace(/\//g, '-');
  if (!normalized) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  return null;
};

async function ensureUniqueSlug(db: ReturnType<typeof createAdminClient>, length = 7) {
  for (let i = 0; i < 6; i += 1) {
    const slug = generateSlug(length);
    const { data } = await db
      .from('inventory_volume_share')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!data) return slug;
  }
  return generateSlug(length + 1);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const customerId = String(searchParams.get('customer_id') || '').trim();
  if (!customerId) {
    return NextResponse.json({ error: 'customer_id가 필요합니다.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('inventory_volume_share')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: (data || []).map((row) => ({
      ...row,
      has_password: Boolean(row.password_hash && row.password_salt),
      password_hash: undefined,
      password_salt: undefined,
    })),
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const customerId = String(body?.customer_id || '').trim();
  const dateFrom = toIsoDate(body?.date_from);
  const dateTo = toIsoDate(body?.date_to);
  const expiresAtRaw = String(body?.expires_at || '').trim();
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw).toISOString() : null;
  const password = String(body?.password || '').trim();

  if (!customerId) {
    return NextResponse.json({ error: 'customer_id가 필요합니다.' }, { status: 400 });
  }

  const db = createAdminClient();
  const slug = await ensureUniqueSlug(db, 7);
  const passwordData = password ? hashPassword(password) : null;

  const payload: SharePayload = {
    customer_id: customerId,
    date_from: dateFrom,
    date_to: dateTo,
    expires_at: expiresAt,
    password_hash: passwordData?.hash ?? null,
    password_salt: passwordData?.salt ?? null,
    created_by: user.id,
  };

  const { data, error } = await db
    .from('inventory_volume_share')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.anhwms.com';
  return NextResponse.json({
    data: {
      ...data,
      has_password: Boolean(data.password_hash && data.password_salt),
      password_hash: undefined,
      password_salt: undefined,
    },
    shareUrl: `${base}/share/inventory/${slug}`,
  });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const db = createAdminClient();
  const { error } = await db.from('inventory_volume_share').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
