import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { checkInboundDelay } from '@/lib/alerts/inboundDelay';

export async function GET() {
  try {
    const db = createAdminClient();
    const hours = Number(process.env.INBOUND_INVENTORY_DELAY_HOURS || 24);
    const result = await checkInboundDelay(db, hours);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '지연 경보 실패' }, { status: 500 });
  }
}
