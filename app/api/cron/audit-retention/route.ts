/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/utils/supabase/admin';
import { fail, ok } from '@/lib/api/response';
import { requireCronSecret } from '@/lib/auth/cronGuard';

const JOB_NAME = 'audit_log_retention';
const MAX_ATTEMPTS = 3;
const RETRY_MINUTES = 30;

export async function GET(request: Request) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const startedAt = new Date();
  const db = createAdminClient();
  let attempts = 1;
  let lastRun: { status?: string | null; attempts?: number | null; next_retry_at?: string | null } | null = null;

  try {
    const { data } = await db
      .from('cron_job_runs')
      .select('status, attempts, next_retry_at, started_at')
      .eq('job_name', JOB_NAME)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    lastRun = data || null;

    if (lastRun?.status === 'failed' && lastRun?.next_retry_at) {
      const nextRetryAt = new Date(lastRun.next_retry_at);
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
        return fail('BAD_REQUEST', 'Backoff active', { status: 429 });
      }
    }

    attempts =
      lastRun?.status === 'failed'
        ? Math.min((lastRun.attempts || 1) + 1, MAX_ATTEMPTS)
        : 1;

    const hotRetentionDays = Math.max(1, Number.parseInt(process.env.AUDIT_LOG_HOT_RETENTION_DAYS || '90', 10));
    const archiveKeepDays = Math.max(1, Number.parseInt(process.env.AUDIT_LOG_ARCHIVE_KEEP_DAYS || '365', 10));
    const batchSize = Math.max(1, Number.parseInt(process.env.AUDIT_LOG_RETENTION_BATCH_SIZE || '5000', 10));

    const { data: runResult, error: runError } = await db.rpc('run_audit_log_retention', {
      p_hot_retention_days: hotRetentionDays,
      p_archive_keep_days: archiveKeepDays,
      p_batch_size: batchSize,
    });
    if (runError) throw runError;

    return ok({
      job: JOB_NAME,
      attempts,
      hotRetentionDays,
      archiveKeepDays,
      batchSize,
      result: runResult,
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
      error_message: error.message || '감사 로그 보관 크론 실패',
      meta: {
        hotRetentionDays: process.env.AUDIT_LOG_HOT_RETENTION_DAYS || '90',
        archiveKeepDays: process.env.AUDIT_LOG_ARCHIVE_KEEP_DAYS || '365',
        batchSize: process.env.AUDIT_LOG_RETENTION_BATCH_SIZE || '5000',
      },
    });
    return fail('INTERNAL_ERROR', error.message || '감사 로그 보관 크론 실패', { status: 500 });
  }
}
