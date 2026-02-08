import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { checkInboundDelay } from '@/lib/alerts/inboundDelay';
import { checkLowStock } from '@/lib/alerts/lowStock';
import { checkOrderDelay } from '@/lib/alerts/orderDelay';

const JOB_NAME = 'alerts';
const MAX_ATTEMPTS = 3;
const RETRY_MINUTES = 10;

export async function GET() {
  const startedAt = new Date();
  const db = createAdminClient();
  let attempts = 1;
  let lastRun: { status?: string | null; attempts?: number | null } | null = null;

  try {
    const { data } = await db
      .from('cron_job_runs')
      .select('status, attempts, next_retry_at, started_at')
      .eq('job_name', JOB_NAME)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    lastRun = data || null;

    if (lastRun?.status === 'failed' && (lastRun as any)?.next_retry_at) {
      const nextRetryAt = new Date((lastRun as any).next_retry_at);
      if (Number.isFinite(nextRetryAt.getTime()) && nextRetryAt > new Date()) {
        await db.from('cron_job_runs').insert({
          job_name: JOB_NAME,
          status: 'skipped',
          attempts: lastRun.attempts || 1,
          started_at: startedAt.toISOString(),
          finished_at: new Date().toISOString(),
          error_message: 'Backoff window active',
          meta: { reason: 'backoff' },
        });
        return NextResponse.json({ error: 'Backoff active' }, { status: 429 });
      }
    }

    attempts =
      lastRun?.status === 'failed'
        ? Math.min((lastRun.attempts || 1) + 1, MAX_ATTEMPTS)
        : 1;

    const hours = Number(process.env.INBOUND_INVENTORY_DELAY_HOURS || 24);
    const orderDelayHours = Number(process.env.ORDER_DELAY_HOURS || 48);
    const [delayResult, lowStockResult, orderDelayResult] = await Promise.all([
      checkInboundDelay(db, hours),
      checkLowStock(db),
      checkOrderDelay(db, orderDelayHours),
    ]);

    await db.from('cron_job_runs').insert({
      job_name: JOB_NAME,
      status: 'success',
      attempts,
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      meta: {
        inboundDelay: delayResult,
        lowStock: lowStockResult,
        orderDelay: orderDelayResult,
      },
    });

    return NextResponse.json({
      inboundDelay: delayResult,
      lowStock: lowStockResult,
      orderDelay: orderDelayResult,
    });
  } catch (error: any) {
    const nextRetryAt = new Date(Date.now() + RETRY_MINUTES * 60 * 1000);
    await db.from('cron_job_runs').insert({
      job_name: JOB_NAME,
      status: 'failed',
      attempts,
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      next_retry_at: nextRetryAt.toISOString(),
      error_message: error.message || '알림 크론 실패',
    });

    const shouldNotify = !lastRun || lastRun.status !== 'failed' || (lastRun.attempts || 0) < 1;
    if (shouldNotify) {
      const { data: admins } = await db
        .from('user_profiles')
        .select('id')
        .in('role', ['admin', 'manager'])
        .eq('status', 'active');

      const adminIds = (admins || []).map((a: any) => a.id).filter(Boolean);
      if (adminIds.length > 0) {
        const notifications = adminIds.map((id: string) => ({
          user_id: id,
          title: '크론 작업 실패: alerts',
          message: error.message || '알림 크론 실행 실패',
          type: 'urgent',
          action: 'cron_failed',
          metadata: {
            job: JOB_NAME,
            attempts,
          },
        }));
        await db.from('notifications').insert(notifications);
      }
    }
    return NextResponse.json({ error: error.message || '알림 크론 실패' }, { status: 500 });
  }
}
