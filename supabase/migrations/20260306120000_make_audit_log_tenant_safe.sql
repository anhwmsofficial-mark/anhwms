BEGIN;

CREATE OR REPLACE FUNCTION public.fn_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant_id uuid;
  v_user_id uuid;
  v_record_id text;
  v_default_org_id uuid;
BEGIN
  IF TG_TABLE_SCHEMA = 'public' AND TG_TABLE_NAME = 'audit_log' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  SELECT CASE WHEN count(*) = 1 THEN min(id) ELSE NULL END
    INTO v_default_org_id
  FROM public.org;

  v_user_id := COALESCE(
    auth.uid(),
    NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
  );

  IF TG_OP = 'INSERT' THEN
    v_record_id := COALESCE(to_jsonb(NEW)->>'id', to_jsonb(OLD)->>'id');
    v_tenant_id := COALESCE(
      NULLIF(to_jsonb(NEW)->>'tenant_id', '')::uuid,
      NULLIF(to_jsonb(NEW)->>'org_id', '')::uuid,
      NULLIF(current_setting('request.jwt.claim.tenant_id', true), '')::uuid,
      v_default_org_id
    );

    IF v_tenant_id IS NULL THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.audit_log
      (tenant_id, user_id, action, table_name, record_id, old_value, new_value)
    VALUES
      (v_tenant_id, v_user_id, 'INSERT', TG_TABLE_NAME, v_record_id, NULL, to_jsonb(NEW));

    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_record_id := COALESCE(to_jsonb(NEW)->>'id', to_jsonb(OLD)->>'id');
    v_tenant_id := COALESCE(
      NULLIF(to_jsonb(NEW)->>'tenant_id', '')::uuid,
      NULLIF(to_jsonb(OLD)->>'tenant_id', '')::uuid,
      NULLIF(to_jsonb(NEW)->>'org_id', '')::uuid,
      NULLIF(to_jsonb(OLD)->>'org_id', '')::uuid,
      NULLIF(current_setting('request.jwt.claim.tenant_id', true), '')::uuid,
      v_default_org_id
    );

    IF v_tenant_id IS NULL THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.audit_log
      (tenant_id, user_id, action, table_name, record_id, old_value, new_value)
    VALUES
      (v_tenant_id, v_user_id, 'UPDATE', TG_TABLE_NAME, v_record_id, to_jsonb(OLD), to_jsonb(NEW));

    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_record_id := to_jsonb(OLD)->>'id';
    v_tenant_id := COALESCE(
      NULLIF(to_jsonb(OLD)->>'tenant_id', '')::uuid,
      NULLIF(to_jsonb(OLD)->>'org_id', '')::uuid,
      NULLIF(current_setting('request.jwt.claim.tenant_id', true), '')::uuid,
      v_default_org_id
    );

    IF v_tenant_id IS NULL THEN
      RETURN OLD;
    END IF;

    INSERT INTO public.audit_log
      (tenant_id, user_id, action, table_name, record_id, old_value, new_value)
    VALUES
      (v_tenant_id, v_user_id, 'DELETE', TG_TABLE_NAME, v_record_id, to_jsonb(OLD), NULL);

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.fn_audit_log()
IS 'tenant_id가 없더라도 본 데이터 변경을 막지 않도록 안전하게 감사 로그를 기록한다.';

COMMIT;
