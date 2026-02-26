-- ====================================================================
-- Audit retention cron runtime settings
-- Purpose:
--   1) Register pg_cron schedule for audit retention
--   2) Verify schedule registration
-- ====================================================================

-- IMPORTANT
-- Supabase에서는 ALTER DATABASE ... SET 권한이 없는 경우가 많습니다.
-- 아래 방식은 DB 설정 변경 없이 직접 스케줄을 등록합니다.

-- 1) 기존 스케줄 해제(있으면)
SELECT cron.unschedule('audit_log_retention_daily');

-- 2) 스케줄 등록
-- - replace-with-your-cron-secret 를 실제 CRON_SECRET 값으로 교체하세요.
SELECT cron.schedule(
  'audit_log_retention_daily',
  '30 3 * * *',
  $$SELECT net.http_get(
      url := 'https://www.anhwms.com/api/cron/audit-retention',
      headers := jsonb_build_object(
        'Authorization', 'Bearer replace-with-your-cron-secret'
      )
    );$$
);

-- 3) 스케줄 확인 (pg_cron 확장 설치된 환경)
-- - jobname = audit_log_retention_daily 인지 확인
SELECT
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobname
FROM cron.job
WHERE jobname = 'audit_log_retention_daily';

-- 4) 수동 실행 테스트 (애플리케이션 측 CRON_SECRET 동일해야 성공)
-- curl -X GET "https://www.anhwms.com/api/cron/audit-retention" \
--   -H "Authorization: Bearer replace-with-your-cron-secret"

