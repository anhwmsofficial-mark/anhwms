-- ====================================================================
-- Audit retention cron runtime settings
-- Purpose:
--   1) Register pg_cron schedule for audit retention
--   2) Verify schedule registration
-- ====================================================================

-- IMPORTANT
-- Supabase에서는 ALTER DATABASE ... SET 권한이 없는 경우가 많습니다.
-- 아래 방식은 DB 설정 변경 없이 직접 스케줄을 등록합니다.
-- 또한 pg_cron이 설치되지 않은 프로젝트에서는 cron 스키마가 없어 실행되지 않습니다.
-- 먼저 아래 확장 체크를 실행하세요.

SELECT extname
FROM pg_extension
WHERE extname IN ('pg_cron', 'pg_net');

-- 결과에 pg_cron 이 없으면:
-- 1) Supabase 대시보드에서 Database extensions > pg_cron 활성화
-- 2) 활성화가 불가한 플랜/환경이면 외부 스케줄러(GitHub Actions/Cloud Scheduler)로 대체
--    -> GET https://www.anhwms.com/api/cron/audit-retention
--       Authorization: Bearer <CRON_SECRET>

-- 1) 기존 스케줄 해제(있으면)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('audit_log_retention_daily');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
$$;

-- 2) 스케줄 등록
-- - replace-with-your-cron-secret 를 실제 CRON_SECRET 값으로 교체하세요.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'audit_log_retention_daily',
      '30 3 * * *',
      $cmd$SELECT net.http_get(
          url := 'https://www.anhwms.com/api/cron/audit-retention',
          headers := jsonb_build_object(
            'Authorization', 'Bearer replace-with-your-cron-secret'
          )
        );$cmd$
    );
  ELSE
    RAISE NOTICE 'pg_cron extension is not installed. Use external scheduler instead.';
  END IF;
END;
$$;

-- 3) 스케줄 확인 (pg_cron 확장 설치된 환경)
-- - jobname = audit_log_retention_daily 인지 확인
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'Run: SELECT jobid, schedule, command, active, jobname FROM cron.job WHERE jobname = ''audit_log_retention_daily'';';
  ELSE
    RAISE NOTICE 'pg_cron extension is not installed. No cron.job table available.';
  END IF;
END;
$$;

-- 4) 수동 실행 테스트 (애플리케이션 측 CRON_SECRET 동일해야 성공)
-- curl -X GET "https://www.anhwms.com/api/cron/audit-retention" \
--   -H "Authorization: Bearer replace-with-your-cron-secret"

