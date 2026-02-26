-- ====================================================================
-- Alert settings for channel/recipient control
-- ====================================================================

CREATE TABLE IF NOT EXISTS alert_settings (
  id                uuid primary key default gen_random_uuid(),
  alert_key         text not null unique,
  enabled           boolean not null default true,
  channels          text[] not null default ARRAY['notification','slack','email','kakao'],
  notify_roles      text[] not null default ARRAY['admin'],
  notify_users      uuid[],
  cooldown_minutes  integer not null default 1440,
  updated_at        timestamptz not null default now()
);

ALTER TABLE alert_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'alert_settings' AND policyname = 'Enable read for authenticated users'
  ) THEN
    CREATE POLICY "Enable read for authenticated users"
      ON alert_settings
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'alert_settings' AND policyname = 'Enable write for authenticated users'
  ) THEN
    CREATE POLICY "Enable write for authenticated users"
      ON alert_settings
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
