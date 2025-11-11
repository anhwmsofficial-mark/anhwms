import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('cs_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    const items = (data ?? []).map((alert) => ({
      id: alert.id,
      type: alert.type,
      ref: alert.ref,
      partnerId: alert.partner_id,
      severity: alert.severity,
      status: alert.status,
      message: alert.message,
      metadata: alert.metadata,
      createdAt: alert.created_at,
      resolvedAt: alert.resolved_at,
      resolvedBy: alert.resolved_by,
    }));

    return NextResponse.json({ items });
  } catch (error: any) {
    console.error('[api/cs/alerts] 오류', error);
    return NextResponse.json(
      {
        error: '알림 조회 중 오류가 발생했습니다.',
        details: error?.message ?? error,
      },
      { status: 500 },
    );
  }
}
