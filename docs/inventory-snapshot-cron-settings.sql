-- ====================================================================
-- Inventory snapshot cron runtime settings
-- Purpose:
--   1) Register pg_cron schedule for inventory snapshot closing
--   2) Verify schedule registration
--   3) Provide a safe manual test path before production activation
-- ====================================================================

-- IMPORTANT
-- 먼저 preview 환경에서 /api/cron/inventory-snapshot 수동 호출 검증을 권장합니다.
-- 본 문서는 "스케줄 등록" 전 마지막 단계용입니다.
--
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
--    -> GET https://www.anhwms.com/api/cron/inventory-snapshot?date=2026-03-16
--       Authorization: Bearer <CRON_SECRET>

-- --------------------------------------------------------------------
-- 1) preview / production 수동 실행 테스트
-- --------------------------------------------------------------------
-- 단일 날짜 검증:
-- curl -X GET "https://www.anhwms.com/api/cron/inventory-snapshot?date=2026-03-16" \
--   -H "Authorization: Bearer replace-with-your-cron-secret"
--
-- 특정 tenant만 검증:
-- curl -X GET "https://www.anhwms.com/api/cron/inventory-snapshot?date=2026-03-16&tenant_id=<tenant-uuid>" \
--   -H "Authorization: Bearer replace-with-your-cron-secret"
--
-- 성공 시 응답에는 다음 값들이 포함됩니다.
-- - processedTenants
-- - processedProducts
-- - upsertedRows
-- - snapshotMode (full / closing_only)

-- --------------------------------------------------------------------
-- 2) 기존 스케줄 해제(있으면)
-- --------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('inventory_snapshot_daily');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
$$;

-- --------------------------------------------------------------------
-- 3) 스케줄 등록
-- --------------------------------------------------------------------
-- 권장: KST 기준 매일 00:10 이후 실행
-- UTC cron 기준으로는 전일 15:10
-- - replace-with-your-cron-secret 를 실제 CRON_SECRET 값으로 교체하세요.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'inventory_snapshot_daily',
      '10 15 * * *',
      $cmd$SELECT net.http_get(
          url := 'https://www.anhwms.com/api/cron/inventory-snapshot',
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

-- --------------------------------------------------------------------
-- 4) 스케줄 확인 (pg_cron 확장 설치된 환경)
-- --------------------------------------------------------------------
-- - jobname = inventory_snapshot_daily 인지 확인
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'Run: SELECT jobid, schedule, command, active, jobname FROM cron.job WHERE jobname = ''inventory_snapshot_daily'';';
  ELSE
    RAISE NOTICE 'pg_cron extension is not installed. No cron.job table available.';
  END IF;
END;
$$;

-- --------------------------------------------------------------------
-- 5) 실행 결과 확인
-- --------------------------------------------------------------------
-- 애플리케이션 실행 로그는 cron_job_runs 테이블에서 확인할 수 있습니다.
-- 예시:
-- SELECT job_name, status, attempts, started_at, finished_at, error_message, meta
-- FROM public.cron_job_runs
-- WHERE job_name = 'inventory_snapshot'
-- ORDER BY started_at DESC
-- LIMIT 20;
