BEGIN;

CREATE TABLE IF NOT EXISTS public.daily_work_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES public.warehouse(id) ON DELETE RESTRICT,
  work_date date NOT NULL,
  full_time_count integer NOT NULL DEFAULT 0 CHECK (full_time_count >= 0),
  long_term_part_time_count integer NOT NULL DEFAULT 0 CHECK (long_term_part_time_count >= 0),
  daily_worker_count integer NOT NULL DEFAULT 0 CHECK (daily_worker_count >= 0),
  helper_count integer NOT NULL DEFAULT 0 CHECK (helper_count >= 0),
  total_worker_count integer NOT NULL DEFAULT 0 CHECK (total_worker_count >= 0),
  note text,
  created_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_work_logs_worker_total_chk CHECK (
    total_worker_count = full_time_count + long_term_part_time_count + daily_worker_count + helper_count
  )
);

CREATE TABLE IF NOT EXISTS public.daily_work_log_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
  daily_work_log_id uuid NOT NULL REFERENCES public.daily_work_logs(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.customer_master(id) ON DELETE RESTRICT,
  work_type text NOT NULL,
  prev_qty integer NOT NULL DEFAULT 0 CHECK (prev_qty >= 0),
  processed_qty integer NOT NULL DEFAULT 0 CHECK (processed_qty >= 0),
  remain_qty integer NOT NULL DEFAULT 0 CHECK (remain_qty >= 0),
  operator_name text,
  memo text,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS daily_work_logs_tenant_org_warehouse_date_uidx
  ON public.daily_work_logs (tenant_id, org_id, warehouse_id, work_date);

CREATE INDEX IF NOT EXISTS daily_work_logs_tenant_work_date_idx
  ON public.daily_work_logs (tenant_id, work_date DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS daily_work_logs_warehouse_work_date_idx
  ON public.daily_work_logs (warehouse_id, work_date DESC);

CREATE INDEX IF NOT EXISTS daily_work_logs_created_by_idx
  ON public.daily_work_logs (created_by, updated_at DESC);

CREATE INDEX IF NOT EXISTS daily_work_log_lines_log_sort_idx
  ON public.daily_work_log_lines (daily_work_log_id, sort_order, created_at);

CREATE INDEX IF NOT EXISTS daily_work_log_lines_client_idx
  ON public.daily_work_log_lines (client_id, work_type);

CREATE OR REPLACE TRIGGER update_daily_work_logs_modtime
BEFORE UPDATE ON public.daily_work_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_daily_work_log_lines_modtime
BEFORE UPDATE ON public.daily_work_log_lines
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.daily_work_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_work_log_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_work_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.daily_work_log_lines FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.daily_work_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.daily_work_log_lines TO authenticated;
GRANT ALL ON TABLE public.daily_work_logs TO service_role;
GRANT ALL ON TABLE public.daily_work_log_lines TO service_role;

DROP POLICY IF EXISTS wl_tenant_roles ON public.daily_work_logs;
DROP POLICY IF EXISTS wl_tenant_roles ON public.daily_work_log_lines;

CREATE POLICY wl_tenant_roles ON public.daily_work_logs
  FOR ALL
  TO authenticated
  USING (
    (
      public.rls_whitelist_role() = ANY (ARRAY['super_admin', 'admin', 'operator', 'seller'])
      OR public.rls_can_access_admin()
    )
    AND tenant_id::text = public.rls_current_tenant_id()
  )
  WITH CHECK (
    (
      public.rls_whitelist_role() = ANY (ARRAY['super_admin', 'admin', 'operator', 'seller'])
      OR public.rls_can_access_admin()
    )
    AND tenant_id::text = public.rls_current_tenant_id()
  );

CREATE POLICY wl_tenant_roles ON public.daily_work_log_lines
  FOR ALL
  TO authenticated
  USING (
    (
      public.rls_whitelist_role() = ANY (ARRAY['super_admin', 'admin', 'operator', 'seller'])
      OR public.rls_can_access_admin()
    )
    AND tenant_id::text = public.rls_current_tenant_id()
  )
  WITH CHECK (
    (
      public.rls_whitelist_role() = ANY (ARRAY['super_admin', 'admin', 'operator', 'seller'])
      OR public.rls_can_access_admin()
    )
    AND tenant_id::text = public.rls_current_tenant_id()
  );

CREATE OR REPLACE FUNCTION public.save_daily_work_log(
  p_tenant_id uuid,
  p_org_id uuid,
  p_daily_work_log_id uuid,
  p_warehouse_id uuid,
  p_work_date date,
  p_full_time_count integer,
  p_long_term_part_time_count integer,
  p_daily_worker_count integer,
  p_helper_count integer,
  p_note text,
  p_actor_id uuid,
  p_lines jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_target_id uuid;
  v_existing_by_key record;
  v_existing_by_id record;
  v_total_worker_count integer;
  v_line_count integer := 0;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;

  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'org_id is required';
  END IF;

  IF p_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'warehouse_id is required';
  END IF;

  IF p_work_date IS NULL THEN
    RAISE EXCEPTION 'work_date is required';
  END IF;

  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'actor_id is required';
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'lines payload is required';
  END IF;

  IF COALESCE(p_full_time_count, 0) < 0
     OR COALESCE(p_long_term_part_time_count, 0) < 0
     OR COALESCE(p_daily_worker_count, 0) < 0
     OR COALESCE(p_helper_count, 0) < 0 THEN
    RAISE EXCEPTION 'worker counts cannot be negative';
  END IF;

  v_total_worker_count :=
    COALESCE(p_full_time_count, 0)
    + COALESCE(p_long_term_part_time_count, 0)
    + COALESCE(p_daily_worker_count, 0)
    + COALESCE(p_helper_count, 0);

  CREATE TEMP TABLE tmp_daily_work_log_lines (
    line_id uuid,
    client_id uuid,
    work_type text,
    prev_qty integer,
    processed_qty integer,
    remain_qty integer,
    operator_name text,
    memo text,
    sort_order integer
  ) ON COMMIT DROP;

  INSERT INTO tmp_daily_work_log_lines (
    line_id,
    client_id,
    work_type,
    prev_qty,
    processed_qty,
    remain_qty,
    operator_name,
    memo,
    sort_order
  )
  SELECT
    x.line_id,
    x.client_id,
    NULLIF(BTRIM(x.work_type), ''),
    COALESCE(x.prev_qty, 0),
    COALESCE(x.processed_qty, 0),
    COALESCE(x.remain_qty, 0),
    NULLIF(BTRIM(x.operator_name), ''),
    NULLIF(BTRIM(x.memo), ''),
    COALESCE(x.sort_order, 0)
  FROM jsonb_to_recordset(p_lines) AS x(
    line_id uuid,
    client_id uuid,
    work_type text,
    prev_qty integer,
    processed_qty integer,
    remain_qty integer,
    operator_name text,
    memo text,
    sort_order integer
  );

  SELECT COUNT(*) INTO v_line_count FROM tmp_daily_work_log_lines;

  IF v_line_count = 0 THEN
    RAISE EXCEPTION 'lines payload is required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tmp_daily_work_log_lines
    WHERE client_id IS NULL
       OR work_type IS NULL
       OR prev_qty < 0
       OR processed_qty < 0
       OR remain_qty < 0
       OR sort_order < 0
  ) THEN
    RAISE EXCEPTION 'lines payload contains invalid values';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tmp_daily_work_log_lines
    GROUP BY sort_order
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate sort_order detected';
  END IF;

  SELECT id, tenant_id, org_id, warehouse_id, work_date
    INTO v_existing_by_key
  FROM public.daily_work_logs
  WHERE tenant_id = p_tenant_id
    AND warehouse_id = p_warehouse_id
    AND work_date = p_work_date
  FOR UPDATE;

  IF p_daily_work_log_id IS NULL THEN
    IF FOUND THEN
      RAISE EXCEPTION 'DUPLICATE_WORK_LOG: already exists for work_date and warehouse';
    END IF;

    INSERT INTO public.daily_work_logs (
      tenant_id,
      org_id,
      warehouse_id,
      work_date,
      full_time_count,
      long_term_part_time_count,
      daily_worker_count,
      helper_count,
      total_worker_count,
      note,
      created_by
    ) VALUES (
      p_tenant_id,
      p_org_id,
      p_warehouse_id,
      p_work_date,
      COALESCE(p_full_time_count, 0),
      COALESCE(p_long_term_part_time_count, 0),
      COALESCE(p_daily_worker_count, 0),
      COALESCE(p_helper_count, 0),
      v_total_worker_count,
      NULLIF(BTRIM(p_note), ''),
      p_actor_id
    )
    RETURNING id INTO v_target_id;
  ELSE
    SELECT id, tenant_id, org_id, warehouse_id, work_date
      INTO v_existing_by_id
    FROM public.daily_work_logs
    WHERE id = p_daily_work_log_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'NOT_FOUND: daily work log not found';
    END IF;

    IF v_existing_by_id.tenant_id <> p_tenant_id OR v_existing_by_id.org_id <> p_org_id THEN
      RAISE EXCEPTION 'TENANT_MISMATCH: daily work log does not belong to tenant';
    END IF;

    IF v_existing_by_key.id IS NOT NULL AND v_existing_by_key.id <> p_daily_work_log_id THEN
      RAISE EXCEPTION 'DUPLICATE_WORK_LOG: already exists for work_date and warehouse';
    END IF;

    UPDATE public.daily_work_logs
    SET
      warehouse_id = p_warehouse_id,
      work_date = p_work_date,
      full_time_count = COALESCE(p_full_time_count, 0),
      long_term_part_time_count = COALESCE(p_long_term_part_time_count, 0),
      daily_worker_count = COALESCE(p_daily_worker_count, 0),
      helper_count = COALESCE(p_helper_count, 0),
      total_worker_count = v_total_worker_count,
      note = NULLIF(BTRIM(p_note), ''),
      updated_at = now()
    WHERE id = p_daily_work_log_id;

    v_target_id := p_daily_work_log_id;
  END IF;

  DELETE FROM public.daily_work_log_lines
  WHERE daily_work_log_id = v_target_id;

  INSERT INTO public.daily_work_log_lines (
    tenant_id,
    org_id,
    daily_work_log_id,
    client_id,
    work_type,
    prev_qty,
    processed_qty,
    remain_qty,
    operator_name,
    memo,
    sort_order
  )
  SELECT
    p_tenant_id,
    p_org_id,
    v_target_id,
    client_id,
    work_type,
    prev_qty,
    processed_qty,
    remain_qty,
    operator_name,
    memo,
    sort_order
  FROM tmp_daily_work_log_lines
  ORDER BY sort_order ASC, client_id ASC;

  RETURN jsonb_build_object(
    'success', true,
    'daily_work_log_id', v_target_id,
    'total_worker_count', v_total_worker_count,
    'line_count', v_line_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_daily_work_log(
  uuid,
  uuid,
  uuid,
  uuid,
  date,
  integer,
  integer,
  integer,
  integer,
  text,
  uuid,
  jsonb
) TO authenticated;

COMMENT ON TABLE public.daily_work_logs IS '현장 일일 작업일지 헤더';
COMMENT ON TABLE public.daily_work_log_lines IS '현장 일일 작업일지 상세 라인';
COMMENT ON FUNCTION public.save_daily_work_log(uuid, uuid, uuid, uuid, date, integer, integer, integer, integer, text, uuid, jsonb)
  IS '일일 작업일지 헤더/라인 저장을 하나의 트랜잭션으로 처리한다.';

COMMIT;

NOTIFY pgrst, 'reload schema';
