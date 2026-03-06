BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
SET row_security = off
AS $$
DECLARE
  v_email text := lower(new.email);
  v_username text := COALESCE(NULLIF(trim(new.raw_user_meta_data->>'username'), ''), split_part(lower(new.email), '@', 1));
  v_full_name text := COALESCE(
    NULLIF(trim(new.raw_user_meta_data->>'full_name'), ''),
    NULLIF(trim(new.raw_user_meta_data->>'name'), ''),
    lower(new.email)
  );
  v_display_name text := COALESCE(
    NULLIF(trim(new.raw_user_meta_data->>'display_name'), ''),
    NULLIF(trim(new.raw_user_meta_data->>'name'), ''),
    split_part(lower(new.email), '@', 1)
  );
  v_legacy_role text := COALESCE(NULLIF(trim(new.raw_user_meta_data->>'role'), ''), 'staff');
  v_profile_role text := CASE
    WHEN v_legacy_role IN ('admin', 'manager', 'operator', 'viewer') THEN v_legacy_role
    WHEN v_legacy_role = 'staff' THEN 'viewer'
    ELSE 'viewer'
  END;
  v_department text := COALESCE(
    NULLIF(trim(new.raw_user_meta_data->>'department'), ''),
    CASE
      WHEN v_profile_role = 'operator' THEN 'warehouse'
      ELSE 'admin'
    END
  );
  v_can_access_admin boolean := v_profile_role IN ('admin', 'manager');
BEGIN
  INSERT INTO public.users (id, email, username, role, department, status)
  VALUES (
    new.id,
    v_email,
    v_username,
    CASE
      WHEN v_legacy_role IN ('admin', 'manager', 'operator', 'partner', 'staff') THEN v_legacy_role
      ELSE 'staff'
    END,
    v_department,
    'active'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    username = EXCLUDED.username,
    role = EXCLUDED.role,
    department = EXCLUDED.department,
    status = COALESCE(public.users.status, 'active'),
    updated_at = now();

  INSERT INTO public.user_profiles (
    id,
    email,
    full_name,
    display_name,
    role,
    department,
    can_access_admin,
    can_access_dashboard,
    can_manage_users,
    can_manage_inventory,
    can_manage_orders,
    status
  )
  VALUES (
    new.id,
    v_email,
    v_full_name,
    v_display_name,
    v_profile_role,
    v_department,
    v_can_access_admin,
    true,
    v_profile_role = 'admin',
    v_profile_role IN ('admin', 'manager', 'operator'),
    v_profile_role <> 'viewer',
    'active'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.user_profiles.full_name, EXCLUDED.full_name),
    display_name = COALESCE(public.user_profiles.display_name, EXCLUDED.display_name),
    role = COALESCE(public.user_profiles.role, EXCLUDED.role),
    department = COALESCE(public.user_profiles.department, EXCLUDED.department),
    updated_at = now();

  RETURN new;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user()
IS '새 사용자 생성 시 RLS를 우회하여 users/user_profiles를 동기화한다.';

COMMIT;

NOTIFY pgrst, 'reload schema';
