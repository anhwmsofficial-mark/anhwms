import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { checkInboundDelay } from '@/lib/alerts/inboundDelay';
import { requirePermission } from '@/utils/rbac';
import { getErrorMessage } from '@/lib/errorHandler';

export async function GET(request: NextRequest) {
  try {
    await requirePermission('manage:orders', request);
    const db = createAdminClient();
    const hours = Number(process.env.INBOUND_INVENTORY_DELAY_HOURS || 24);
    const result = await checkInboundDelay(db, hours);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) || '지연 경보 실패' }, { status: 500 });
  }
}
