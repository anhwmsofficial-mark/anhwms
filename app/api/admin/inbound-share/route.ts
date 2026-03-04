import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { generateSlug, hashPassword } from '@/lib/share';
import type { SupabaseClient } from '@supabase/supabase-js';

function getPrivilegedDbOrFallback(fallback: SupabaseClient) {
  try {
    return createAdminClient();
  } catch {
    return fallback;
  }
}

function normalizeShareCreateError(error: { message?: string } | null | undefined) {
  const message = (error?.message || '').toLowerCase();
  if (!message) return '공유 링크 생성 중 알 수 없는 오류가 발생했습니다.';
  if (message.includes('violates foreign key constraint')) {
    return '대상 인수증을 찾을 수 없습니다. 화면을 새로고침 후 다시 시도해 주세요.';
  }
  if (message.includes('duplicate key') && message.includes('slug')) {
    return '공유 토큰 충돌이 발생했습니다. 다시 시도해 주세요.';
  }
  if (message.includes('permission denied') || message.includes('row-level security')) {
    return '공유 권한이 없어 링크를 생성할 수 없습니다. 관리자에게 문의해 주세요.';
  }
  return error?.message || '공유 링크 생성에 실패했습니다.';
}

async function ensureUniqueSlug(db: SupabaseClient, length = 7) {
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

async function getReceiptOrgId(db: SupabaseClient, receiptId: string) {
  const { data, error } = await db
    .from('inbound_receipts')
    .select('org_id')
    .eq('id', receiptId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data?.org_id) {
    throw new Error('인수증 조직 정보를 찾을 수 없습니다.');
  }
  return data.org_id as string;
}

async function insertShareWithCompat(
  db: SupabaseClient,
  payload: Record<string, any>,
  receiptId: string
) {
  const attempts: Array<Record<string, any>> = [{ ...payload }];
  let orgId: string | null = null;
  let lastError: { message?: string } | null = null;

  for (let i = 0; i < attempts.length; i += 1) {
    const current = attempts[i];
    const { error } = await db
      .from('inbound_receipt_shares')
      .insert(current);
    if (!error) return { data: current, error: null };

    const message = error.message || '';
    lastError = error as any;
    const schemaCacheMissing = /schema cache/i.test(message) && /tenant_id|org_id/i.test(message);
    const tenantNotNull = /tenant_id/i.test(message) && /not-null constraint/i.test(message);
    const orgNotNull = /org_id/i.test(message) && /not-null constraint/i.test(message);
    const isRecoverable = schemaCacheMissing || tenantNotNull || orgNotNull;

    if (!isRecoverable) {
      return { data: null, error };
    }

    if (!orgId) {
      orgId = await getReceiptOrgId(db, receiptId);
    }

    const withOrgOnly = { ...payload, org_id: orgId };
    const withTenantOnly = { ...payload, tenant_id: orgId };
    const withTenantAndOrg = { ...payload, tenant_id: orgId, org_id: orgId };
    if (attempts.length === 1) {
      // Try org-only first because some environments require org_id
      // but do not have tenant_id column.
      attempts.push(withOrgOnly, withTenantOnly, withTenantAndOrg);
    }
  }

  return {
    data: null,
    error: {
      message: lastError?.message || '공유 링크 생성 재시도에 실패했습니다.',
    } as any,
  };
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

  const db = getPrivilegedDbOrFallback(supabase);
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

  const db = getPrivilegedDbOrFallback(supabase);

  const { data: receiptExists, error: receiptLookupError } = await db
    .from('inbound_receipts')
    .select('id')
    .eq('id', receiptId)
    .maybeSingle();
  if (receiptLookupError) {
    return NextResponse.json({ error: receiptLookupError.message }, { status: 500 });
  }
  if (!receiptExists) {
    return NextResponse.json({ error: '대상 인수증을 찾을 수 없습니다.' }, { status: 404 });
  }

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

  const { data, error } = await insertShareWithCompat(db, payload, receiptId);

  if (error) {
    const safeMessage = normalizeShareCreateError(error);
    console.error('Failed to create inbound share', {
      receiptId,
      userId: user.id,
      error,
      safeMessage,
    });
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }

  let shareBaseUrl = 'https://www.anhwms.com';
  const configuredSiteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  if (configuredSiteUrl) {
    try {
      // Normalize to origin to prevent accidental path prefixes (e.g. "/inbound").
      shareBaseUrl = new URL(configuredSiteUrl).origin;
    } catch {
      shareBaseUrl = 'https://www.anhwms.com';
    }
  } else {
    shareBaseUrl = new URL(request.url).origin;
  }

  return NextResponse.json({
    data,
    shareUrl: `${shareBaseUrl}/share/inbound/${slug}`,
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

  const db = getPrivilegedDbOrFallback(supabase);
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

  const db = getPrivilegedDbOrFallback(supabase);
  const { error } = await db
    .from('inbound_receipt_shares')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
