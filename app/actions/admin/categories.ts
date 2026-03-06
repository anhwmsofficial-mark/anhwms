'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { ensurePermission } from '@/lib/actions/auth';
import { failFromError, type ActionResult } from '@/lib/actions/result';

export async function listProductCategoriesAction(request?: Request): Promise<ActionResult<{ data: Array<{ code: string; nameKo: string; nameEn: string }> }>> {
  try {
    const permission = await ensurePermission('manage:orders', request);
    if (!permission.ok) return permission;
    const { data, error } = await supabaseAdmin
      .from('product_categories')
      .select('code, name_ko, name_en')
      .order('code');
    if (error) return { ok: false, error: error.message, status: 500 };

    return {
      ok: true,
      data: {
        data: (data || []).map((item) => ({
          code: item.code,
          nameKo: item.name_ko,
          nameEn: item.name_en,
        })),
      },
    };
  } catch (error: unknown) {
    return failFromError(error, '카테고리 조회에 실패했습니다.', { status: 500 });
  }
}
