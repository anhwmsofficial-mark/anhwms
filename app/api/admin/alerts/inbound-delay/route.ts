import { NextRequest } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { checkInboundDelay } from '@/lib/alerts/inboundDelay';
import { requirePermission } from '@/utils/rbac';
import { getErrorMessage } from '@/lib/errorHandler';
import { fail, ok } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  try {
    await requirePermission('manage:orders', request);
    const db = createAdminClient();
    const hours = Number(process.env.INBOUND_INVENTORY_DELAY_HOURS || 24);
    const result = await checkInboundDelay(db, hours);
    return ok(result);
  } catch (error: unknown) {
    return fail('INTERNAL_ERROR', getErrorMessage(error) || '지연 경보 실패', { status: 500 });
  }
}
