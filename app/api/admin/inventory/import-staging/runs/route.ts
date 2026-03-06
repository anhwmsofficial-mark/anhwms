import { NextRequest } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { requirePermission } from '@/utils/rbac';
import { getErrorMessage } from '@/lib/errorHandler';
import { fail, ok } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  try {
    await requirePermission('inventory:adjust', request);
    const db = createAdminClient();
    const { searchParams } = new URL(request.url);
    const tenantId = String(searchParams.get('tenantId') || '').trim();
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 20), 1), 100);

    if (!tenantId) {
      return fail('BAD_REQUEST', 'tenantId는 필수입니다.', { status: 400 });
    }

    const { data, error } = await db
      .from('inventory_import_runs')
      .select('id, source_file_name, dry_run, requested_limit, selected_count, imported_count, skipped_count, status, error_message, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return fail('INTERNAL_ERROR', error.message, { status: 500 });
    }

    return ok(data || []);
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message.includes('Unauthorized') ? 403 : 500;
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR', message || '실행 이력 조회 실패', { status });
  }
}
