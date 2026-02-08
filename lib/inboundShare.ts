import 'server-only';

import { createAdminClient } from '@/utils/supabase/admin';
import { verifyPassword } from '@/lib/share';

function isExpired(expiresAt?: string | null) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

export async function getInboundShareAccess(params: {
  slug?: string | null;
  password?: string | null;
}) {
  const slug = (params.slug || '').trim();
  if (!slug) return { error: '공유 토큰이 필요합니다.' };

  const db = createAdminClient();
  const { data, error } = await db
    .from('inbound_receipt_shares')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !data) {
    return { error: '공유 링크를 찾을 수 없습니다.' };
  }

  if (isExpired(data.expires_at)) {
    return { error: '공유 링크가 만료되었습니다.' };
  }

  if (data.password_hash && data.password_salt) {
    const password = (params.password || '').trim();
    const ok = verifyPassword(password, data.password_salt, data.password_hash);
    if (!ok) {
      return { error: '공유 비밀번호가 올바르지 않습니다.' };
    }
  }

  return { share: data };
}
