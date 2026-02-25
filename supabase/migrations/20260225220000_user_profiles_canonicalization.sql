-- ====================================================================
-- Canonicalize auth profile source on user_profiles
-- - add missing auth-control columns required by middleware
-- - add partner linkage for portal profile joins
-- - backfill partner_id from legacy users table when present
-- ====================================================================

BEGIN;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_reason TEXT,
  ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_partner_id ON public.user_profiles(partner_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_locked_until ON public.user_profiles(locked_until);
CREATE INDEX IF NOT EXISTS idx_user_profiles_deleted_at ON public.user_profiles(deleted_at);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'users'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'partner_id'
  ) THEN
    UPDATE public.user_profiles up
    SET partner_id = u.partner_id
    FROM public.users u
    WHERE u.id = up.id
      AND up.partner_id IS NULL
      AND u.partner_id IS NOT NULL;
  END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
