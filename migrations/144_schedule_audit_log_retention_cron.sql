-- ====================================================================
-- Schedule audit log retention cron job (pg_cron)
-- - Runs daily at 03:30 UTC
-- - Calls /api/cron/audit-retention with CRON_SECRET
-- ====================================================================

DO $$
BEGIN
  -- pg_cron extension may be unavailable in some environments.
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('audit_log_retention_daily');
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;

    PERFORM cron.schedule(
      'audit_log_retention_daily',
      '30 3 * * *',
      format(
        $cmd$SELECT net.http_get(
            url := %L,
            headers := jsonb_build_object(
              'Authorization', %L
            )
          );$cmd$,
        COALESCE(current_setting('app.settings.audit_retention_url', true), '') || '/api/cron/audit-retention',
        'Bearer ' || COALESCE(current_setting('app.settings.cron_secret', true), '')
      )
    );
  END IF;
END;
$$;
