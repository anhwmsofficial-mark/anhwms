-- Pre-deploy checks
SELECT to_regclass('public.user_profiles') AS user_profiles_table;
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_profiles'
  AND column_name IN ('role', 'status', 'can_access_admin', 'deleted_at', 'locked_until', 'partner_id')
ORDER BY column_name;

-- Confirm no legacy users reference remains in app code (run in repo shell)
-- rg "from\('users'\)|from\(\"users\"\)" app lib utils contexts

-- Post-deploy checks
SELECT COUNT(*) AS active_profiles
FROM public.user_profiles
WHERE status = 'active';

SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'user_profiles'
ORDER BY cmd, policyname;

-- Sanity: partner linkage for portal users
SELECT COUNT(*) AS partner_linked_profiles
FROM public.user_profiles
WHERE partner_id IS NOT NULL;
