import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { verifyPassword } from '@/lib/share';

type ShareRow = {
  id: string;
  slug: string;
  customer_id: string;
  date_from: string | null;
  date_to: string | null;
  expires_at: string | null;
  password_hash: string | null;
  password_salt: string | null;
};

function isExpired(expiresAt?: string | null) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

async function loadRowsByShare(share: ShareRow) {
  const db = createAdminClient();
  let query = db
    .from('inventory_volume_raw')
    .select('sheet_name, record_date, row_no, item_name, opening_stock_raw, closing_stock_raw, header_order, raw_data')
    .eq('customer_id', share.customer_id)
    .order('record_date', { ascending: true, nullsFirst: false })
    .order('sheet_name', { ascending: true })
    .order('row_no', { ascending: true })
    .limit(50000);

  if (share.date_from) query = query.gte('record_date', share.date_from);
  if (share.date_to) query = query.lte('record_date', share.date_to);

  const { data, error } = await query;
  if (error) {
    return { error: error.message, rows: [] as Record<string, unknown>[] };
  }
  return { rows: (data || []) as Record<string, unknown>[] };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = String(searchParams.get('slug') || '').trim();
  if (!slug) {
    return NextResponse.json({ error: 'slug가 필요합니다.' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('inventory_volume_share')
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
  if (requiresPassword) {
    return NextResponse.json({
      requiresPassword: true,
      share: {
        date_from: data.date_from,
        date_to: data.date_to,
        expires_at: data.expires_at,
      },
    });
  }

  const loaded = await loadRowsByShare(data as ShareRow);
  if ('error' in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: 500 });
  }

  return NextResponse.json({
    requiresPassword: false,
    share: {
      date_from: data.date_from,
      date_to: data.date_to,
      expires_at: data.expires_at,
    },
    rows: loaded.rows,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const slug = String(body?.slug || '').trim();
  const password = String(body?.password || '').trim();

  if (!slug) {
    return NextResponse.json({ error: 'slug가 필요합니다.' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('inventory_volume_share')
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

  const loaded = await loadRowsByShare(data as ShareRow);
  if ('error' in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: 500 });
  }

  return NextResponse.json({
    share: {
      date_from: data.date_from,
      date_to: data.date_to,
      expires_at: data.expires_at,
    },
    rows: loaded.rows,
  });
}
