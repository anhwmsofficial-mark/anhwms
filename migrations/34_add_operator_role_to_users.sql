-- 34_add_operator_role_to_users.sql
-- users.role 체크 제약에 operator 추가 및 기존 계정 동기화

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT c.conname INTO constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE t.relname = 'users'
    AND n.nspname = 'public'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%role%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT %I', constraint_name);
  END IF;

  ALTER TABLE public.users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('admin', 'manager', 'staff', 'partner', 'operator'));
END $$;

UPDATE public.users
SET role = 'operator', updated_at = now()
WHERE email IN ('checker.lee@anhwms.com', 'duckhye.kwak@anhwms.com');

NOTIFY pgrst, 'reload schema';
