-- ====================================================================
-- RLS Whitelist Rebuild (Global)
-- - Drop legacy permissive policies
-- - Default DENY + block anon
-- - Role whitelist via auth.jwt()->>'role'
-- - Tenant isolation for all tenant_id tables
-- - user_profiles special rules
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- 1) Precheck (fail fast before any mutation)
--    - org_id tables with NULL must be backfillable to tenant_id
--    - existing tenant_id tables must not contain tenant_id NULL
--    - no direct org_id mass update here (avoid audit trigger side effects)
-- --------------------------------------------------------------------
DO $$
DECLARE
  t RECORD;
  null_rows BIGINT;
  org_count BIGINT;
  default_org_id uuid;
  table_org_count BIGINT;
  table_default_org_id uuid;
  has_customer_master_ref BOOLEAN;
  has_receipt_ref BOOLEAN;
  has_created_by_ref BOOLEAN;
BEGIN
  SELECT count(*) INTO org_count FROM public.org;
  IF org_count = 1 THEN
    SELECT id INTO default_org_id FROM public.org LIMIT 1;
  END IF;

  -- A) org_id -> tenant_id promotion candidates
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_schema = c.table_schema
     AND tb.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND tb.table_type = 'BASE TABLE'
      AND c.column_name = 'org_id'
      AND c.table_name NOT IN ('org', 'user_profiles')
      AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns x
        WHERE x.table_schema = c.table_schema
          AND x.table_name = c.table_name
          AND x.column_name = 'tenant_id'
      )
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM public.%I WHERE org_id IS NULL',
      t.table_name
    ) INTO null_rows;

    IF null_rows > 0 THEN
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns c2
        WHERE c2.table_schema = 'public'
          AND c2.table_name = t.table_name
          AND c2.column_name = 'customer_master_id'
      ) INTO has_customer_master_ref;

      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns c2
        WHERE c2.table_schema = 'public'
          AND c2.table_name = t.table_name
          AND c2.column_name = 'receipt_id'
      ) INTO has_receipt_ref;

      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns c2
        WHERE c2.table_schema = 'public'
          AND c2.table_name = t.table_name
          AND c2.column_name = 'created_by'
      ) INTO has_created_by_ref;

      -- FK 기반 테이블은 실제 backfill 단계에서 참조 테이블 승격 후 tenant_id를 채우므로
      -- precheck에서는 보류
      IF has_customer_master_ref OR has_receipt_ref OR has_created_by_ref THEN
        CONTINUE;
      END IF;

      -- 1) 테이블 내 비NULL org_id가 1종류면 tenant backfill 가능
      EXECUTE format(
        'SELECT count(DISTINCT org_id),
                (SELECT org_id FROM public.%I WHERE org_id IS NOT NULL ORDER BY org_id::text LIMIT 1)
           FROM public.%I
          WHERE org_id IS NOT NULL',
        t.table_name,
        t.table_name
      ) INTO table_org_count, table_default_org_id;

      -- 2) table_org_count=0 인데 org도 다중이면 NULL rows를 해석할 기준이 없음
      IF NOT (
        (table_org_count = 1 AND table_default_org_id IS NOT NULL)
        OR (org_count = 1 AND default_org_id IS NOT NULL)
      ) THEN
        RAISE EXCEPTION
          'precheck failed: public.% has org_id NULL rows=% (cannot backfill tenant_id). org_count=%, table_org_count=%',
          t.table_name, null_rows, org_count, table_org_count;
      END IF;
    END IF;
  END LOOP;

  -- B) already-tenantized tables
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_schema = c.table_schema
     AND tb.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND tb.table_type = 'BASE TABLE'
      AND c.column_name = 'tenant_id'
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM public.%I WHERE tenant_id IS NULL',
      t.table_name
    ) INTO null_rows;

    IF null_rows > 0 THEN
      RAISE EXCEPTION
        'precheck failed: public.% has tenant_id NULL rows=%',
        t.table_name, null_rows;
    END IF;
  END LOOP;
END
$$;

-- --------------------------------------------------------------------
-- 2) Block anon access globally
-- --------------------------------------------------------------------
REVOKE ALL ON SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;

-- --------------------------------------------------------------------
-- 3) Remove all existing policies in public schema
-- --------------------------------------------------------------------
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      p.policyname, p.schemaname, p.tablename
    );
  END LOOP;
END
$$;

-- --------------------------------------------------------------------
-- 4) Enable + force RLS on all base tables (default deny)
-- --------------------------------------------------------------------
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END
$$;

-- --------------------------------------------------------------------
-- 5) Auto-promote org_id tables to tenant_id
--    - target: tables having org_id but missing tenant_id
--    - exclude: public.org, public.user_profiles
-- --------------------------------------------------------------------
DO $$
DECLARE
  t RECORD;
  null_rows BIGINT;
  org_count BIGINT;
  default_org_id uuid;
  table_org_count BIGINT;
  table_default_org_id uuid;
  table_tenant_count BIGINT;
  table_default_tenant_text TEXT;
  fill_org_id uuid;
  has_customer_master_ref BOOLEAN;
  has_receipt_ref BOOLEAN;
  has_created_by_ref BOOLEAN;
  fk RECORD;
  fk_source_expr TEXT;
BEGIN
  SELECT count(*) INTO org_count FROM public.org;
  IF org_count = 1 THEN
    SELECT id INTO default_org_id FROM public.org LIMIT 1;
  END IF;

  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_schema = c.table_schema
     AND tb.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND tb.table_type = 'BASE TABLE'
      AND c.column_name = 'org_id'
      AND c.table_name NOT IN ('org', 'user_profiles')
      AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns x
        WHERE x.table_schema = c.table_schema
          AND x.table_name = c.table_name
          AND x.column_name = 'tenant_id'
      )
    ORDER BY CASE WHEN c.table_name = 'customer_master' THEN 0 ELSE 1 END, c.table_name
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id uuid',
      t.table_name
    );

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns c2
      WHERE c2.table_schema = 'public'
        AND c2.table_name = t.table_name
        AND c2.column_name = 'customer_master_id'
    ) INTO has_customer_master_ref;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns c2
      WHERE c2.table_schema = 'public'
        AND c2.table_name = t.table_name
        AND c2.column_name = 'receipt_id'
    ) INTO has_receipt_ref;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns c2
      WHERE c2.table_schema = 'public'
        AND c2.table_name = t.table_name
        AND c2.column_name = 'created_by'
    ) INTO has_created_by_ref;

    -- 우선 FK(customer_master_id) 기반으로 tenant_id 채움
    IF has_customer_master_ref THEN
      EXECUTE format(
        'UPDATE public.%I tt
            SET tenant_id = COALESCE(cm.tenant_id, cm.org_id)
           FROM public.customer_master cm
          WHERE tt.tenant_id IS NULL
            AND tt.customer_master_id = cm.id
            AND COALESCE(cm.tenant_id, cm.org_id) IS NOT NULL',
        t.table_name
      );
    END IF;

    -- 우선 FK(receipt_id) 기반으로 tenant_id 채움
    IF has_receipt_ref THEN
      EXECUTE format(
        'UPDATE public.%I tt
            SET tenant_id = ir.org_id
           FROM public.inbound_receipts ir
          WHERE tt.tenant_id IS NULL
            AND tt.receipt_id = ir.id
            AND ir.org_id IS NOT NULL',
        t.table_name
      );
    END IF;

    -- created_by(user_profiles) 기반으로 tenant_id 채움
    IF has_created_by_ref THEN
      EXECUTE format(
        'UPDATE public.%I tt
            SET tenant_id = COALESCE(up.org_id, tt.tenant_id)
           FROM public.user_profiles up
          WHERE tt.tenant_id IS NULL
            AND tt.created_by = up.id
            AND up.org_id IS NOT NULL',
        t.table_name
      );
    END IF;

    -- 일반 FK 기반 자동 보정
    -- - 현재 테이블의 단일 컬럼 FK를 순회
    -- - 부모 테이블의 tenant_id 또는 org_id를 source로 사용
    FOR fk IN
      SELECT
        a_child.attname AS child_col,
        c_parent.relname AS parent_table,
        a_parent.attname AS parent_col,
        EXISTS (
          SELECT 1
          FROM information_schema.columns ic
          WHERE ic.table_schema = 'public'
            AND ic.table_name = c_parent.relname
            AND ic.column_name = 'tenant_id'
        ) AS parent_has_tenant,
        EXISTS (
          SELECT 1
          FROM information_schema.columns ic
          WHERE ic.table_schema = 'public'
            AND ic.table_name = c_parent.relname
            AND ic.column_name = 'org_id'
        ) AS parent_has_org
      FROM pg_constraint con
      JOIN pg_class c_child
        ON c_child.oid = con.conrelid
      JOIN pg_namespace n_child
        ON n_child.oid = c_child.relnamespace
      JOIN pg_class c_parent
        ON c_parent.oid = con.confrelid
      JOIN pg_attribute a_child
        ON a_child.attrelid = con.conrelid
       AND a_child.attnum = con.conkey[1]
      JOIN pg_attribute a_parent
        ON a_parent.attrelid = con.confrelid
       AND a_parent.attnum = con.confkey[1]
      WHERE con.contype = 'f'
        AND n_child.nspname = 'public'
        AND c_child.relname = t.table_name
        AND array_length(con.conkey, 1) = 1
        AND array_length(con.confkey, 1) = 1
    LOOP
      fk_source_expr := NULL;
      IF fk.parent_has_tenant AND fk.parent_has_org THEN
        fk_source_expr := 'COALESCE(p.tenant_id, p.org_id)';
      ELSIF fk.parent_has_tenant THEN
        fk_source_expr := 'p.tenant_id';
      ELSIF fk.parent_has_org THEN
        fk_source_expr := 'p.org_id';
      END IF;

      IF fk_source_expr IS NOT NULL THEN
        EXECUTE format(
          'UPDATE public.%I tt
              SET tenant_id = %s
             FROM public.%I p
            WHERE tt.tenant_id IS NULL
              AND tt.%I = p.%I
              AND %s IS NOT NULL',
          t.table_name,
          fk_source_expr,
          fk.parent_table,
          fk.child_col,
          fk.parent_col,
          fk_source_expr
        );
      END IF;
    END LOOP;

    -- receipt_documents 특수 보정: receipt_no로 단일 tenant 추론 가능할 때만 채움
    IF t.table_name = 'receipt_documents' THEN
      EXECUTE $sql$
        WITH candidate AS (
          SELECT
            rd.id,
            min((COALESCE(ir.tenant_id, ir.org_id))::text)::uuid AS inferred_tenant
          FROM public.receipt_documents rd
          JOIN public.inbound_receipts ir
            ON ir.receipt_no = rd.receipt_no
          WHERE rd.tenant_id IS NULL
            AND rd.receipt_no IS NOT NULL
            AND COALESCE(ir.tenant_id, ir.org_id) IS NOT NULL
          GROUP BY rd.id
          HAVING count(DISTINCT (COALESCE(ir.tenant_id, ir.org_id))::text) = 1
        )
        UPDATE public.receipt_documents rd
           SET tenant_id = c.inferred_tenant
          FROM candidate c
         WHERE rd.id = c.id
           AND rd.tenant_id IS NULL
      $sql$;
    END IF;

    EXECUTE format(
      'SELECT count(DISTINCT org_id),
              (SELECT org_id FROM public.%I WHERE org_id IS NOT NULL ORDER BY org_id::text LIMIT 1)
         FROM public.%I
        WHERE org_id IS NOT NULL',
      t.table_name,
      t.table_name
    ) INTO table_org_count, table_default_org_id;

    fill_org_id := NULL;
    IF table_org_count = 1 AND table_default_org_id IS NOT NULL THEN
      fill_org_id := table_default_org_id;
    ELSIF org_count = 1 AND default_org_id IS NOT NULL THEN
      fill_org_id := default_org_id;
    END IF;

    IF fill_org_id IS NOT NULL THEN
      EXECUTE format(
        'UPDATE public.%I
            SET tenant_id = COALESCE(tenant_id, org_id, %L::uuid)
          WHERE tenant_id IS NULL',
        t.table_name,
        fill_org_id::text
      );
    ELSE
      EXECUTE format(
        'UPDATE public.%I
            SET tenant_id = COALESCE(tenant_id, org_id)
          WHERE tenant_id IS NULL
            AND org_id IS NOT NULL',
        t.table_name
      );
    END IF;

    -- 마지막 fallback: 테이블 내부 tenant_id가 단일값이면 NULL 행에 동일값 적용
    EXECUTE format(
      'SELECT count(DISTINCT tenant_id::text),
              (SELECT tenant_id::text FROM public.%I WHERE tenant_id IS NOT NULL ORDER BY tenant_id::text LIMIT 1)
         FROM public.%I
        WHERE tenant_id IS NOT NULL',
      t.table_name,
      t.table_name
    ) INTO table_tenant_count, table_default_tenant_text;

    IF table_tenant_count = 1 AND table_default_tenant_text IS NOT NULL THEN
      EXECUTE format(
        'UPDATE public.%I
            SET tenant_id = %L::uuid
          WHERE tenant_id IS NULL',
        t.table_name,
        table_default_tenant_text
      );
    END IF;

    EXECUTE format(
      'SELECT count(*) FROM public.%I WHERE tenant_id IS NULL',
      t.table_name
    ) INTO null_rows;

    IF null_rows > 0 THEN
      RAISE EXCEPTION
        'tenant_id backfill failed on public.%, null rows=% (unresolved by org_id/customer_master_id/receipt_id/created_by)',
        t.table_name, null_rows;
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL',
      t.table_name
    );
  END LOOP;

  -- customer_master 기반 2차 보정 (customer_master 승격 이후 재시도)
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_schema = c.table_schema
     AND tb.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND tb.table_type = 'BASE TABLE'
      AND c.column_name = 'customer_master_id'
      AND EXISTS (
        SELECT 1
        FROM information_schema.columns x
        WHERE x.table_schema = c.table_schema
          AND x.table_name = c.table_name
          AND x.column_name = 'tenant_id'
      )
  LOOP
    EXECUTE format(
      'UPDATE public.%I tt
          SET tenant_id = COALESCE(cm.tenant_id, cm.org_id)
         FROM public.customer_master cm
        WHERE tt.tenant_id IS NULL
          AND tt.customer_master_id = cm.id
          AND COALESCE(cm.tenant_id, cm.org_id) IS NOT NULL',
      t.table_name
    );
  END LOOP;

  -- inbound_receipts 기반 2차 보정 (inbound_receipts 승격 이후 재시도)
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_schema = c.table_schema
     AND tb.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND tb.table_type = 'BASE TABLE'
      AND c.column_name = 'receipt_id'
      AND EXISTS (
        SELECT 1
        FROM information_schema.columns x
        WHERE x.table_schema = c.table_schema
          AND x.table_name = c.table_name
          AND x.column_name = 'tenant_id'
      )
  LOOP
    EXECUTE format(
      'UPDATE public.%I tt
          SET tenant_id = COALESCE(ir.tenant_id, ir.org_id)
         FROM public.inbound_receipts ir
        WHERE tt.tenant_id IS NULL
          AND tt.receipt_id = ir.id
          AND COALESCE(ir.tenant_id, ir.org_id) IS NOT NULL',
      t.table_name
    );
  END LOOP;
END
$$;

-- --------------------------------------------------------------------
-- 6) Role/tenant resolver helpers (legacy role compatibility)
--    - manager -> admin
--    - staff   -> operator
--    - partner -> seller
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rls_current_role()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := nullif(auth.jwt()->>'role', '');

  IF v_role IS NULL THEN
    v_role := nullif((auth.jwt()->'app_metadata'->>'role'), '');
  END IF;

  IF v_role IS NULL AND auth.uid() IS NOT NULL THEN
    SELECT up.role
      INTO v_role
      FROM public.user_profiles up
     WHERE up.id = auth.uid();
  END IF;

  RETURN lower(coalesce(v_role, ''));
END;
$$;

CREATE OR REPLACE FUNCTION public.rls_whitelist_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE public.rls_current_role()
    WHEN 'manager' THEN 'admin'
    WHEN 'staff' THEN 'operator'
    WHEN 'partner' THEN 'seller'
    ELSE public.rls_current_role()
  END;
$$;

CREATE OR REPLACE FUNCTION public.rls_current_tenant_id()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant text;
BEGIN
  v_tenant := nullif(auth.jwt()->>'tenant_id', '');

  IF v_tenant IS NULL THEN
    v_tenant := nullif((auth.jwt()->'app_metadata'->>'tenant_id'), '');
  END IF;

  IF v_tenant IS NULL AND auth.uid() IS NOT NULL THEN
    SELECT up.org_id::text
      INTO v_tenant
      FROM public.user_profiles up
     WHERE up.id = auth.uid();
  END IF;

  RETURN coalesce(v_tenant, '');
END;
$$;

GRANT EXECUTE ON FUNCTION public.rls_current_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_whitelist_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_current_tenant_id() TO authenticated;

-- --------------------------------------------------------------------
-- 7) Base whitelist policy for non-tenant tables (excluding user_profiles)
-- --------------------------------------------------------------------
DO $$
DECLARE
  t RECORD;
  role_expr TEXT := 'public.rls_whitelist_role() = ANY (ARRAY[''super_admin'',''admin'',''operator'',''seller''])';
BEGIN
  FOR t IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name <> 'user_profiles'
      AND table_name NOT IN (
        SELECT c.table_name
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.column_name = 'tenant_id'
      )
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',
      'wl_all_roles',
      t.table_name,
      role_expr,
      role_expr
    );
  END LOOP;
END
$$;

-- --------------------------------------------------------------------
-- 8) Tenant tables: tenant_id required + role+tenant whitelist
-- --------------------------------------------------------------------
DO $$
DECLARE
  t RECORD;
  null_rows BIGINT;
  role_expr TEXT := 'public.rls_whitelist_role() = ANY (ARRAY[''super_admin'',''admin'',''operator'',''seller''])';
  tenant_expr TEXT := 'tenant_id::text = public.rls_current_tenant_id()';
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_schema = c.table_schema
     AND tb.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND tb.table_type = 'BASE TABLE'
      AND c.column_name = 'tenant_id'
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM public.%I WHERE tenant_id IS NULL',
      t.table_name
    ) INTO null_rows;

    IF null_rows > 0 THEN
      RAISE EXCEPTION
        'tenant_id NOT NULL precheck failed on public.%, null rows=%',
        t.table_name, null_rows;
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL',
      t.table_name
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING ((%s) AND (%s)) WITH CHECK ((%s) AND (%s))',
      'wl_tenant_roles',
      t.table_name,
      role_expr,
      tenant_expr,
      role_expr,
      tenant_expr
    );
  END LOOP;
END
$$;

-- --------------------------------------------------------------------
-- 9) user_profiles special rules
-- --------------------------------------------------------------------
-- SELECT: self-read 허용 + role whitelist
CREATE POLICY wl_user_profiles_select
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
  OR public.rls_whitelist_role() = ANY (ARRAY['super_admin','admin','operator','seller'])
);

-- UPDATE: self or super_admin (column-level restrictions enforced by trigger below)
CREATE POLICY wl_user_profiles_update
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() = id
  OR public.rls_whitelist_role() = 'super_admin'
)
WITH CHECK (
  auth.uid() = id
  OR public.rls_whitelist_role() = 'super_admin'
);

-- DELETE: super_admin only
CREATE POLICY wl_user_profiles_delete
ON public.user_profiles
FOR DELETE
TO authenticated
USING (
  public.rls_whitelist_role() = 'super_admin'
);

-- INSERT: client/authenticated 차단, 서버 전용(service_role/SECURITY DEFINER) 경로만 허용
REVOKE INSERT ON public.user_profiles FROM authenticated;
CREATE POLICY wl_user_profiles_insert_service_only
ON public.user_profiles
FOR INSERT
TO service_role
WITH CHECK (true);

-- --------------------------------------------------------------------
-- 10) user_profiles update column guard
--    - non-super_admin: self row only + protected columns immutable
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_user_profiles_update_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_role TEXT := public.rls_whitelist_role();
BEGIN
  -- Backend trusted path (service_role) bypass
  IF current_user = 'service_role' OR v_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- super_admin can update any column
  IF v_role = 'super_admin' THEN
    RETURN NEW;
  END IF;

  -- Others must update only their own row
  IF auth.uid() IS NULL OR auth.uid() <> OLD.id THEN
    RAISE EXCEPTION 'user_profiles update denied: only owner can update own row';
  END IF;

  -- Protected columns: only super_admin can modify
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.role IS DISTINCT FROM OLD.role
     OR NEW.org_id IS DISTINCT FROM OLD.org_id
     OR NEW.partner_id IS DISTINCT FROM OLD.partner_id
     OR NEW.can_access_admin IS DISTINCT FROM OLD.can_access_admin
     OR NEW.can_access_dashboard IS DISTINCT FROM OLD.can_access_dashboard
     OR NEW.can_manage_users IS DISTINCT FROM OLD.can_manage_users
     OR NEW.can_manage_inventory IS DISTINCT FROM OLD.can_manage_inventory
     OR NEW.can_manage_orders IS DISTINCT FROM OLD.can_manage_orders
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
     OR NEW.locked_until IS DISTINCT FROM OLD.locked_until
     OR NEW.locked_reason IS DISTINCT FROM OLD.locked_reason
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.last_login_at IS DISTINCT FROM OLD.last_login_at
  THEN
    RAISE EXCEPTION 'user_profiles update denied: protected columns require super_admin';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_profiles_update_guard ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_update_guard
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_user_profiles_update_guard();

COMMIT;

NOTIFY pgrst, 'reload schema';
