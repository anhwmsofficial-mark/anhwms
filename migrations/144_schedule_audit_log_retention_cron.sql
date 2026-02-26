-- ====================================================================
-- Schedule audit log retention cron job (pg_cron)
-- - Runs daily at 03:30 UTC
-- - Calls /api/cron/audit-retention with CRON_SECRET
-- ====================================================================

DO $$
DECLARE
  v_base_url text;
  v_cron_secret text;
BEGIN
  -- pg_cron extension may be unavailable in some environments.
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    v_base_url := COALESCE(current_setting('app.settings.audit_retention_url', true), '');
    v_cron_secret := COALESCE(current_setting('app.settings.cron_secret', true), '');

    BEGIN
      EXECUTE 'SELECT cron.unschedule(''audit_log_retention_daily'')';
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;

    -- Skip scheduling when runtime settings are not configured.
    IF v_base_url <> '' AND v_cron_secret <> '' THEN
      EXECUTE format(
        $stmt$SELECT cron.schedule(
          'audit_log_retention_daily',
          '30 3 * * *',
          %L
        )$stmt$,
        format(
          $cmd$SELECT net.http_get(
              url := %L,
              headers := jsonb_build_object(
                'Authorization', %L
              )
            );$cmd$,
          v_base_url || '/api/cron/audit-retention',
          'Bearer ' || v_cron_secret
        )
      );
    END IF;
  END IF;
END;
$$;
