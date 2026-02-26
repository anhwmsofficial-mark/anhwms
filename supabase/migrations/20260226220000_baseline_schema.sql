


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "extensions";


CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";


CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "extensions";


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."archive_audit_logs"("p_retention_days" integer DEFAULT 90, "p_batch_size" integer DEFAULT 5000) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_retention_days integer := GREATEST(COALESCE(p_retention_days, 90), 1);
  v_batch_size integer := GREATEST(COALESCE(p_batch_size, 5000), 1);
  v_moved integer := 0;
BEGIN
  WITH candidates AS (
    SELECT a.*
    FROM public.audit_logs a
    WHERE a.created_at < now() - make_interval(days => v_retention_days)
    ORDER BY a.created_at ASC
    LIMIT v_batch_size
  ),
  moved AS (
    INSERT INTO public.audit_logs_archive (
      id,
      actor_id,
      actor_role,
      action_type,
      resource_type,
      resource_id,
      old_value,
      new_value,
      reason,
      ip_address,
      user_agent,
      created_at,
      archived_at
    )
    SELECT
      c.id,
      c.actor_id,
      c.actor_role,
      c.action_type,
      c.resource_type,
      c.resource_id,
      c.old_value,
      c.new_value,
      c.reason,
      c.ip_address,
      c.user_agent,
      c.created_at,
      now()
    FROM candidates c
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  )
  DELETE FROM public.audit_logs a
  USING moved m
  WHERE a.id = m.id;

  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RETURN v_moved;
END;
$$;


ALTER FUNCTION "public"."archive_audit_logs"("p_retention_days" integer, "p_batch_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bump_api_rate_limit"("p_scope" "text", "p_actor_key" "text", "p_actor_key_type" "text", "p_window_seconds" integer) RETURNS TABLE("request_count" integer, "window_start" timestamp with time zone, "window_end" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_count integer;
BEGIN
  IF p_window_seconds IS NULL OR p_window_seconds <= 0 THEN
    RAISE EXCEPTION 'p_window_seconds must be > 0';
  END IF;

  v_window_start := to_timestamp(
    floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds
  );
  v_window_end := v_window_start + make_interval(secs => p_window_seconds);

  INSERT INTO public.api_rate_limits (
    scope,
    actor_key,
    actor_key_type,
    window_start,
    request_count,
    created_at,
    updated_at
  )
  VALUES (
    p_scope,
    p_actor_key,
    COALESCE(NULLIF(p_actor_key_type, ''), 'ip'),
    v_window_start,
    1,
    now(),
    now()
  )
  ON CONFLICT (scope, actor_key, window_start)
  DO UPDATE
    SET request_count = public.api_rate_limits.request_count + 1,
        actor_key_type = EXCLUDED.actor_key_type,
        updated_at = now()
  RETURNING public.api_rate_limits.request_count
  INTO v_count;

  RETURN QUERY
  SELECT v_count, v_window_start, v_window_end;
END;
$$;


ALTER FUNCTION "public"."bump_api_rate_limit"("p_scope" "text", "p_actor_key" "text", "p_actor_key_type" "text", "p_window_seconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirm_inbound_receipt"("p_receipt_id" "uuid", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_receipt RECORD;
    v_line RECORD;
    v_current_qty INTEGER;
    v_next_qty INTEGER;
BEGIN
    -- Receipt Lock
    SELECT * INTO v_receipt FROM inbound_receipts WHERE id = p_receipt_id FOR UPDATE;
    IF v_receipt IS NULL THEN
        RAISE EXCEPTION 'Receipt not found';
    END IF;
    IF v_receipt.status = 'CONFIRMED' OR v_receipt.status = 'PUTAWAY_READY' THEN
        RAISE EXCEPTION 'Already confirmed';
    END IF;

    FOR v_line IN SELECT * FROM inbound_receipt_lines WHERE receipt_id = p_receipt_id LOOP
        IF COALESCE(v_line.accepted_qty, 0) > 0 THEN
            -- Lock current quantity row (if exists)
            SELECT qty_on_hand INTO v_current_qty
            FROM inventory_quantities
            WHERE warehouse_id = v_receipt.warehouse_id
              AND product_id = v_line.product_id
            FOR UPDATE;

            v_current_qty := COALESCE(v_current_qty, 0);
            v_next_qty := v_current_qty + v_line.accepted_qty;

            INSERT INTO inventory_ledger (
                org_id, warehouse_id, product_id, transaction_type,
                qty_change, balance_after, reference_type, reference_id, notes, created_by
            ) VALUES (
                v_receipt.org_id, v_receipt.warehouse_id, v_line.product_id, 'INBOUND',
                v_line.accepted_qty, v_next_qty, 'INBOUND_RECEIPT', p_receipt_id, NULL, p_user_id
            );

            INSERT INTO inventory_quantities (org_id, warehouse_id, product_id, qty_on_hand, qty_available)
            VALUES (v_receipt.org_id, v_receipt.warehouse_id, v_line.product_id, v_line.accepted_qty, v_line.accepted_qty)
            ON CONFLICT (warehouse_id, product_id)
            DO UPDATE SET
                qty_on_hand = inventory_quantities.qty_on_hand + EXCLUDED.qty_on_hand,
                qty_available = inventory_quantities.qty_available + EXCLUDED.qty_available,
                updated_at = NOW();
        END IF;
    END LOOP;

    UPDATE inbound_receipts
    SET status = 'PUTAWAY_READY', confirmed_at = NOW(), confirmed_by = p_user_id
    WHERE id = p_receipt_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


ALTER FUNCTION "public"."confirm_inbound_receipt"("p_receipt_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_products_sync_customer_from_brand"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_customer_id uuid;
begin
  if new.brand_id is not null then
    select customer_master_id
      into v_customer_id
    from brand
    where id = new.brand_id;

    if v_customer_id is null then
      raise exception 'brand_id(%) 에 해당하는 customer_master_id를 찾을 수 없습니다.', new.brand_id;
    end if;

    new.customer_id := v_customer_id;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."fn_products_sync_customer_from_brand"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  INSERT INTO public.users (id, email, username, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'staff')
  );
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_new_user"() IS '새 사용자 생성 시 자동으로 프로필 생성';



CREATE OR REPLACE FUNCTION "public"."has_permission"("user_id" "uuid", "permission" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM user_profiles WHERE id = user_id;
  
  -- Admin은 모든 권한 보유
  IF user_role = 'admin' THEN
    RETURN TRUE;
  END IF;
  
  -- 권한별 체크
  RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."has_permission"("user_id" "uuid", "permission" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"("user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = user_id AND role = 'admin'
  );
END;
$$;


ALTER FUNCTION "public"."is_admin"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin_safe"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- SECURITY DEFINER로 실행되어 RLS를 우회하고 테이블을 직접 조회
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;


ALTER FUNCTION "public"."is_admin_safe"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_order_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, reason)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), 'Status changed via update');
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_order_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_inbound_completion"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- 상태가 completed로 변경되었을 때만 실행
  IF (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed') THEN
    
    -- 재고 수불부(Ledger)에 입고 기록 추가
    INSERT INTO inventory_ledger (
      product_id,
      type,
      quantity_change,
      quantity_after, -- 트리거 실행 시점의 재고 + 입고량 (근사치)
      location,
      reference_id,
      reason,
      actor_id
    )
    SELECT
      NEW.product_id,
      'INBOUND',
      NEW.received_quantity, -- 실제 입고 수량 사용
      (SELECT quantity FROM products WHERE id = NEW.product_id) + NEW.received_quantity,
      (SELECT location FROM products WHERE id = NEW.product_id),
      NEW.id,
      '입고 완료 (Inbound Completed)',
      auth.uid() -- 현재 사용자 (트리거에서는 확인 필요, 없을 시 NULL)
    ;
    
    -- 주의: inventory_ledger의 트리거가 products 테이블을 업데이트하므로 여기서는 중복 업데이트 하지 않음
    -- 다만, inventory_ledger 트리거에 의존하지 않고 명시적으로 하려면 로직 조정 필요.
    -- 현재 구조: Inbound Complete -> Ledger Insert -> Product Update
    
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."process_inbound_completion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purge_audit_logs_archive"("p_keep_days" integer DEFAULT 365, "p_batch_size" integer DEFAULT 10000) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_keep_days integer := GREATEST(COALESCE(p_keep_days, 365), 1);
  v_batch_size integer := GREATEST(COALESCE(p_batch_size, 10000), 1);
  v_deleted integer := 0;
BEGIN
  WITH candidates AS (
    SELECT id
    FROM public.audit_logs_archive
    WHERE created_at < now() - make_interval(days => v_keep_days)
    ORDER BY created_at ASC
    LIMIT v_batch_size
  )
  DELETE FROM public.audit_logs_archive a
  USING candidates c
  WHERE a.id = c.id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;


ALTER FUNCTION "public"."purge_audit_logs_archive"("p_keep_days" integer, "p_batch_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."run_audit_log_retention"("p_hot_retention_days" integer DEFAULT 90, "p_archive_keep_days" integer DEFAULT 365, "p_batch_size" integer DEFAULT 5000) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_started_at timestamptz := now();
  v_archived integer := 0;
  v_purged integer := 0;
  v_result jsonb;
BEGIN
  v_archived := public.archive_audit_logs(p_hot_retention_days, p_batch_size);
  v_purged := public.purge_audit_logs_archive(p_archive_keep_days, p_batch_size * 2);

  v_result := jsonb_build_object(
    'archived', v_archived,
    'purged', v_purged,
    'hotRetentionDays', p_hot_retention_days,
    'archiveKeepDays', p_archive_keep_days
  );

  INSERT INTO public.cron_job_runs (job_name, status, started_at, finished_at, meta)
  VALUES ('audit_log_retention', 'success', v_started_at, now(), v_result);

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    INSERT INTO public.cron_job_runs (job_name, status, started_at, finished_at, error_message, meta)
    VALUES (
      'audit_log_retention',
      'failed',
      v_started_at,
      now(),
      SQLERRM,
      jsonb_build_object(
        'hotRetentionDays', p_hot_retention_days,
        'archiveKeepDays', p_archive_keep_days,
        'batchSize', p_batch_size
      )
    );
    RAISE;
END;
$$;


ALTER FUNCTION "public"."run_audit_log_retention"("p_hot_retention_days" integer, "p_archive_keep_days" integer, "p_batch_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_inventory_ledger_standard_columns"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- tenant_id 기본값
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := NEW.org_id;
  END IF;

  -- legacy -> standard
  IF NEW.direction IS NULL THEN
    NEW.direction := CASE WHEN COALESCE(NEW.qty_change, 0) >= 0 THEN 'IN' ELSE 'OUT' END;
  END IF;

  IF NEW.quantity IS NULL OR NEW.quantity <= 0 THEN
    NEW.quantity := ABS(COALESCE(NEW.qty_change, 0));
  END IF;

  IF NEW.movement_type IS NULL THEN
    NEW.movement_type := CASE COALESCE(NEW.transaction_type, '')
      WHEN 'INBOUND' THEN 'INBOUND'
      WHEN 'OUTBOUND' THEN 'OUTBOUND'
      WHEN 'RETURN' THEN 'RETURN_B2C'
      WHEN 'TRANSFER' THEN 'TRANSFER'
      WHEN 'ADJUSTMENT' THEN CASE WHEN NEW.direction = 'IN' THEN 'ADJUSTMENT_PLUS' ELSE 'ADJUSTMENT_MINUS' END
      ELSE CASE WHEN NEW.direction = 'IN' THEN 'ADJUSTMENT_PLUS' ELSE 'ADJUSTMENT_MINUS' END
    END;
  END IF;

  IF NEW.memo IS NULL THEN
    NEW.memo := NEW.notes;
  END IF;

  -- standard -> legacy qty_change 보정
  IF NEW.qty_change IS NULL OR NEW.qty_change = 0 THEN
    NEW.qty_change := CASE WHEN NEW.direction = 'IN' THEN NEW.quantity ELSE -NEW.quantity END;
  END IF;

  -- legacy transaction_type 보정
  IF NEW.transaction_type IS NULL THEN
    NEW.transaction_type := CASE
      WHEN NEW.movement_type = 'INBOUND' THEN 'INBOUND'
      WHEN NEW.movement_type = 'OUTBOUND' THEN 'OUTBOUND'
      WHEN NEW.movement_type IN ('RETURN_B2C', 'OUTBOUND_CANCEL') THEN 'RETURN'
      WHEN NEW.movement_type = 'TRANSFER' THEN 'TRANSFER'
      ELSE 'ADJUSTMENT'
    END;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_inventory_ledger_standard_columns"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_external_quote_inquiry_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_external_quote_inquiry_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_inquiry_notes_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_inquiry_notes_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_product_stock"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- 동일 상품에 대한 동시 업데이트 방지
  PERFORM 1 FROM products WHERE id = NEW.product_id FOR UPDATE;

  UPDATE products
  SET 
    quantity = quantity + NEW.quantity_change,
    updated_at = NOW()
  WHERE id = NEW.product_id;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_product_stock"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "username" "text",
    "email" "text",
    "role" "text" DEFAULT 'staff'::"text" NOT NULL,
    "department" "text",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "partner_id" "uuid",
    CONSTRAINT "users_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'staff'::"text", 'partner'::"text", 'operator'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."admin_users" WITH ("security_invoker"='true') AS
 SELECT "id"
   FROM "public"."users"
  WHERE ("role" = 'admin'::"text");


ALTER VIEW "public"."admin_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."api_rate_limits" (
    "scope" "text" NOT NULL,
    "actor_key" "text" NOT NULL,
    "actor_key_type" "text" DEFAULT 'ip'::"text" NOT NULL,
    "window_start" timestamp with time zone NOT NULL,
    "request_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_api_rate_limits_request_count_nonnegative" CHECK (("request_count" >= 0))
);


ALTER TABLE "public"."api_rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_id" "uuid",
    "actor_role" character varying(50),
    "action_type" character varying(50) NOT NULL,
    "resource_type" character varying(50) NOT NULL,
    "resource_id" character varying(100),
    "old_value" "jsonb",
    "new_value" "jsonb",
    "reason" "text",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs_archive" (
    "id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "actor_role" character varying(50),
    "action_type" character varying(50) NOT NULL,
    "resource_type" character varying(50) NOT NULL,
    "resource_id" character varying(100),
    "old_value" "jsonb",
    "new_value" "jsonb",
    "reason" "text",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone NOT NULL,
    "archived_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_logs_archive" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."billing_invoice" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_master_id" "uuid" NOT NULL,
    "brand_id" "uuid",
    "invoice_no" "text" NOT NULL,
    "invoice_date" "date" NOT NULL,
    "due_date" "date",
    "period_from" "date" NOT NULL,
    "period_to" "date" NOT NULL,
    "subtotal" numeric DEFAULT 0 NOT NULL,
    "tax_amount" numeric DEFAULT 0 NOT NULL,
    "total_amount" numeric DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'KRW'::"text",
    "status" "text" DEFAULT 'DRAFT'::"text",
    "issued_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."billing_invoice" OWNER TO "postgres";


COMMENT ON TABLE "public"."billing_invoice" IS '청구서 (고객사별 월별/기간별 청구)';



CREATE TABLE IF NOT EXISTS "public"."billing_invoice_line" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "billing_invoice_id" "uuid" NOT NULL,
    "item_type" "text" NOT NULL,
    "description" "text" NOT NULL,
    "quantity" numeric DEFAULT 1 NOT NULL,
    "unit_price" numeric NOT NULL,
    "line_amount" numeric NOT NULL,
    "ref_type" "text",
    "ref_id" "uuid",
    "line_no" integer
);


ALTER TABLE "public"."billing_invoice_line" OWNER TO "postgres";


COMMENT ON TABLE "public"."billing_invoice_line" IS '청구서 라인 (항목별 상세)';



COMMENT ON COLUMN "public"."billing_invoice_line"."item_type" IS 'STORAGE: 보관료, HANDLING: 하역료, SHIPPING: 배송료, PACKING: 포장료, EXTRA: 기타';



CREATE TABLE IF NOT EXISTS "public"."brand" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_master_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "name_ko" "text",
    "name_en" "text",
    "name_zh" "text",
    "country_code" character(2) DEFAULT 'KR'::"bpchar",
    "is_default_brand" boolean DEFAULT false,
    "logo_url" "text",
    "website_url" "text",
    "description" "text",
    "allow_backorder" boolean DEFAULT false,
    "auto_allocate" boolean DEFAULT true,
    "require_lot_tracking" boolean DEFAULT false,
    "status" "text" DEFAULT 'ACTIVE'::"text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."brand" OWNER TO "postgres";


COMMENT ON TABLE "public"."brand" IS '브랜드 테이블 (고객사가 운영하는 브랜드)';



COMMENT ON COLUMN "public"."brand"."is_default_brand" IS '해당 고객사의 기본 브랜드 여부';



CREATE TABLE IF NOT EXISTS "public"."brand_warehouse" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "is_primary" boolean DEFAULT false,
    "fulfill_priority" integer DEFAULT 10,
    "allow_inbound" boolean DEFAULT true,
    "allow_outbound" boolean DEFAULT true,
    "allow_stock_hold" boolean DEFAULT false,
    "storage_rate" numeric,
    "handling_rate" numeric,
    "rate_currency" "text" DEFAULT 'KRW'::"text",
    "status" "text" DEFAULT 'ACTIVE'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."brand_warehouse" OWNER TO "postgres";


COMMENT ON TABLE "public"."brand_warehouse" IS '브랜드-창고 관계 (어느 브랜드가 어느 창고를 사용하는지)';



CREATE TABLE IF NOT EXISTS "public"."cs_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "ref" "text",
    "partner_id" "uuid",
    "severity" "text" DEFAULT 'medium'::"text",
    "status" "text" DEFAULT 'open'::"text",
    "message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid"
);


ALTER TABLE "public"."cs_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cs_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "partner_id" "uuid",
    "channel" "text" NOT NULL,
    "lang_in" "text" DEFAULT 'zh'::"text",
    "subject" "text",
    "status" "text" DEFAULT 'open'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cs_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cs_glossary" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "term_ko" "text" NOT NULL,
    "term_zh" "text" NOT NULL,
    "note" "text",
    "priority" integer DEFAULT 5,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cs_glossary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cs_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "convo_id" "uuid",
    "role" "text" NOT NULL,
    "lang" "text" NOT NULL,
    "content" "text" NOT NULL,
    "intent" "text",
    "slots" "jsonb" DEFAULT '{}'::"jsonb",
    "tool_name" "text",
    "tool_payload" "jsonb",
    "tool_result" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cs_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cs_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "lang" "text" NOT NULL,
    "tone" "text" DEFAULT 'business'::"text",
    "body" "text" NOT NULL,
    "variables" "jsonb" DEFAULT '[]'::"jsonb",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cs_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cs_tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "partner_id" "uuid",
    "conversation_id" "uuid",
    "priority" "text" DEFAULT 'normal'::"text",
    "summary" "text" NOT NULL,
    "description" "text",
    "assignee" "uuid",
    "status" "text" DEFAULT 'open'::"text",
    "tags" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid"
);


ALTER TABLE "public"."cs_tickets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cs_translate_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "source_lang" "text" NOT NULL,
    "target_lang" "text" NOT NULL,
    "source_text" "text" NOT NULL,
    "translated_text" "text" NOT NULL,
    "tone" "text" DEFAULT 'business'::"text",
    "formality" "text" DEFAULT 'neutral'::"text",
    "chars_in" integer,
    "chars_out" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cs_translate_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_activity" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_master_id" "uuid" NOT NULL,
    "activity_type" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "description" "text",
    "related_contact_id" "uuid",
    "performed_by_user_id" "uuid",
    "priority" "text" DEFAULT 'NORMAL'::"text",
    "requires_followup" boolean DEFAULT false,
    "followup_due_date" "date",
    "followup_completed" boolean DEFAULT false,
    "followup_completed_at" timestamp with time zone,
    "attachment_urls" "text"[],
    "tags" "text"[],
    "activity_date" timestamp with time zone DEFAULT "now"(),
    "duration_minutes" integer,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "customer_activity_activity_type_check" CHECK (("activity_type" = ANY (ARRAY['CALL'::"text", 'EMAIL'::"text", 'MEETING'::"text", 'SITE_VISIT'::"text", 'VIDEO_CALL'::"text", 'ISSUE'::"text", 'COMPLAINT'::"text", 'FEEDBACK'::"text", 'QUOTE_SENT'::"text", 'CONTRACT_SIGNED'::"text", 'NOTE'::"text", 'TASK'::"text", 'REMINDER'::"text"]))),
    CONSTRAINT "customer_activity_priority_check" CHECK (("priority" = ANY (ARRAY['LOW'::"text", 'NORMAL'::"text", 'HIGH'::"text", 'URGENT'::"text"])))
);


ALTER TABLE "public"."customer_activity" OWNER TO "postgres";


COMMENT ON TABLE "public"."customer_activity" IS '거래처 활동 이력 (통화, 미팅, 이슈, 클레임 등 모든 소통 기록)';



COMMENT ON COLUMN "public"."customer_activity"."activity_type" IS '활동 유형: CALL, EMAIL, MEETING, ISSUE, COMPLAINT 등';



COMMENT ON COLUMN "public"."customer_activity"."requires_followup" IS '후속 조치 필요 여부';



CREATE TABLE IF NOT EXISTS "public"."customer_contact" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_master_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "title" "text",
    "department" "text",
    "role" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "mobile" "text",
    "fax" "text",
    "preferred_contact" "text" DEFAULT 'EMAIL'::"text",
    "work_hours" "text",
    "timezone" "text" DEFAULT 'Asia/Seoul'::"text",
    "language" "text" DEFAULT 'ko'::"text",
    "is_primary" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "birthday" "date",
    "note" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "customer_contact_preferred_contact_check" CHECK (("preferred_contact" = ANY (ARRAY['EMAIL'::"text", 'PHONE'::"text", 'SMS'::"text", 'KAKAO'::"text", 'WECHAT'::"text", 'LINE'::"text"]))),
    CONSTRAINT "customer_contact_role_check" CHECK (("role" = ANY (ARRAY['PRIMARY'::"text", 'SALES'::"text", 'OPERATION'::"text", 'FINANCE'::"text", 'TECHNICAL'::"text", 'LEGAL'::"text", 'CS'::"text", 'OTHER'::"text"])))
);


ALTER TABLE "public"."customer_contact" OWNER TO "postgres";


COMMENT ON TABLE "public"."customer_contact" IS '거래처 담당자 테이블 (여러 담당자 관리)';



COMMENT ON COLUMN "public"."customer_contact"."role" IS '담당자 역할: PRIMARY (주담당), SALES (영업), OPERATION (운영), FINANCE (재무) 등';



COMMENT ON COLUMN "public"."customer_contact"."is_primary" IS '주 담당자 여부 (거래처당 1명 권장)';



CREATE TABLE IF NOT EXISTS "public"."customer_contract" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_master_id" "uuid" NOT NULL,
    "contract_no" "text" NOT NULL,
    "contract_name" "text" NOT NULL,
    "contract_type" "text" NOT NULL,
    "contract_start" "date" NOT NULL,
    "contract_end" "date",
    "auto_renewal" boolean DEFAULT false,
    "renewal_notice_days" integer DEFAULT 30,
    "renewal_count" integer DEFAULT 0,
    "contract_amount" numeric(15,2),
    "currency" "text" DEFAULT 'KRW'::"text",
    "payment_terms" integer DEFAULT 30,
    "payment_method" "text",
    "billing_cycle" "text" DEFAULT 'MONTHLY'::"text",
    "sla_inbound_processing" integer,
    "sla_outbound_cutoff" time without time zone,
    "sla_accuracy_rate" numeric(5,2),
    "sla_ontime_ship_rate" numeric(5,2),
    "contract_file_url" "text",
    "contract_file_name" "text",
    "signed_date" "date",
    "signed_by_customer" "text",
    "signed_by_company" "text",
    "status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "parent_contract_id" "uuid",
    "replaced_by_contract_id" "uuid",
    "termination_reason" "text",
    "termination_date" "date",
    "termination_notice_date" "date",
    "reminder_sent" boolean DEFAULT false,
    "reminder_sent_at" timestamp with time zone,
    "note" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "customer_contract_billing_cycle_check" CHECK (("billing_cycle" = ANY (ARRAY['DAILY'::"text", 'WEEKLY'::"text", 'MONTHLY'::"text", 'QUARTERLY'::"text", 'YEARLY'::"text", 'ONE_TIME'::"text"]))),
    CONSTRAINT "customer_contract_contract_type_check" CHECK (("contract_type" = ANY (ARRAY['SERVICE_AGREEMENT'::"text", 'MASTER_AGREEMENT'::"text", 'NDA'::"text", 'SLA'::"text", 'PRICING_AGREEMENT'::"text", 'AMENDMENT'::"text", 'LEASE'::"text", 'PARTNERSHIP'::"text"]))),
    CONSTRAINT "customer_contract_status_check" CHECK (("status" = ANY (ARRAY['DRAFT'::"text", 'PENDING_REVIEW'::"text", 'PENDING_APPROVAL'::"text", 'ACTIVE'::"text", 'EXPIRING_SOON'::"text", 'EXPIRED'::"text", 'TERMINATED'::"text", 'RENEWED'::"text"])))
);


ALTER TABLE "public"."customer_contract" OWNER TO "postgres";


COMMENT ON TABLE "public"."customer_contract" IS '거래처 계약 관리 (서비스 계약, SLA, NDA 등)';



COMMENT ON COLUMN "public"."customer_contract"."contract_type" IS '계약 유형: SERVICE_AGREEMENT, MASTER_AGREEMENT, NDA, SLA 등';



COMMENT ON COLUMN "public"."customer_contract"."auto_renewal" IS '자동 갱신 여부';



COMMENT ON COLUMN "public"."customer_contract"."parent_contract_id" IS '이전 계약 ID (계약 갱신의 경우)';



CREATE TABLE IF NOT EXISTS "public"."customer_master" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid",
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "country_code" character(2) DEFAULT 'KR'::"bpchar",
    "business_reg_no" "text",
    "billing_currency" "text" DEFAULT 'KRW'::"text",
    "billing_cycle" "text" DEFAULT 'MONTHLY'::"text",
    "payment_terms" integer DEFAULT 30,
    "contact_name" "text",
    "contact_email" "text",
    "contact_phone" "text",
    "address_line1" "text",
    "address_line2" "text",
    "city" "text",
    "postal_code" "text",
    "contract_start" "date",
    "contract_end" "date",
    "status" "text" DEFAULT 'ACTIVE'::"text",
    "note" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "customer_master_type_check" CHECK (("type" = ANY (ARRAY['CLIENT_BRAND'::"text", 'CLIENT_AGENCY'::"text", 'CLIENT_MULTI_BRAND'::"text", 'SUPPLIER_MATERIAL'::"text", 'SUPPLIER_PACKAGING'::"text", 'PARTNER_CARRIER'::"text", 'PARTNER_FORWARDER'::"text", 'PARTNER_WAREHOUSE'::"text", 'PARTNER_CUSTOMS'::"text", 'PROSPECT'::"text", 'COMPETITOR'::"text", 'END_CUSTOMER'::"text", 'DIRECT_BRAND'::"text", 'AGENCY'::"text", 'MULTI_BRAND'::"text", 'FORWARDER'::"text", 'LOGISTICS_PARTNER'::"text"])))
);


ALTER TABLE "public"."customer_master" OWNER TO "postgres";


COMMENT ON TABLE "public"."customer_master" IS '고객사 마스터 테이블 (화주사/브랜드사/포워더 등)';



COMMENT ON COLUMN "public"."customer_master"."type" IS '거래처 유형: CLIENT_* (고객사), SUPPLIER_* (공급사), PARTNER_* (파트너), PROSPECT (잠재고객)';



CREATE TABLE IF NOT EXISTS "public"."customer_pricing" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_master_id" "uuid" NOT NULL,
    "org_id" "uuid",
    "pricing_type" "text" NOT NULL,
    "service_name" "text",
    "service_code" "text",
    "unit_price" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'KRW'::"text",
    "unit" "text" NOT NULL,
    "min_quantity" numeric,
    "max_quantity" numeric,
    "effective_from" "date" DEFAULT CURRENT_DATE NOT NULL,
    "effective_to" "date",
    "volume_discount_rate" numeric(5,2),
    "volume_threshold" numeric,
    "requires_approval" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "note" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "customer_pricing_pricing_type_check" CHECK (("pricing_type" = ANY (ARRAY['STORAGE'::"text", 'INBOUND'::"text", 'OUTBOUND'::"text", 'PACKING'::"text", 'LABELING'::"text", 'KITTING'::"text", 'RETURNS'::"text", 'INSPECTION'::"text", 'REPACKAGING'::"text", 'SPECIAL_SERVICE'::"text", 'SHIPPING_DOMESTIC'::"text", 'SHIPPING_INTL'::"text", 'CUSTOMS'::"text", 'WAREHOUSING'::"text"])))
);


ALTER TABLE "public"."customer_pricing" OWNER TO "postgres";


COMMENT ON TABLE "public"."customer_pricing" IS '거래처별 가격/요율 정책 관리';



COMMENT ON COLUMN "public"."customer_pricing"."pricing_type" IS '가격 유형: STORAGE (보관), INBOUND (입고), OUTBOUND (출고), PACKING (포장) 등';



COMMENT ON COLUMN "public"."customer_pricing"."volume_discount_rate" IS '볼륨 할인율 (%)';



CREATE TABLE IF NOT EXISTS "public"."customer_relationship" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parent_customer_id" "uuid" NOT NULL,
    "child_customer_id" "uuid" NOT NULL,
    "relationship_type" "text" NOT NULL,
    "effective_from" "date" DEFAULT CURRENT_DATE NOT NULL,
    "effective_to" "date",
    "is_active" boolean DEFAULT true,
    "relationship_strength" "text",
    "note" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "customer_relationship_check" CHECK (("parent_customer_id" <> "child_customer_id")),
    CONSTRAINT "customer_relationship_relationship_strength_check" CHECK (("relationship_strength" = ANY (ARRAY['STRONG'::"text", 'MEDIUM'::"text", 'WEAK'::"text"]))),
    CONSTRAINT "customer_relationship_relationship_type_check" CHECK (("relationship_type" = ANY (ARRAY['PARENT_SUBSIDIARY'::"text", 'AGENCY_CLIENT'::"text", 'PRIME_SUB'::"text", 'PARTNERSHIP'::"text", 'REFERRAL'::"text", 'AFFILIATED'::"text", 'FRANCHISEE'::"text", 'RESELLER'::"text"])))
);


ALTER TABLE "public"."customer_relationship" OWNER TO "postgres";


COMMENT ON TABLE "public"."customer_relationship" IS '거래처 간 관계 관리 (모자회사, 대행사-고객, 파트너십 등)';



COMMENT ON COLUMN "public"."customer_relationship"."relationship_type" IS '관계 유형: PARENT_SUBSIDIARY, AGENCY_CLIENT, PRIME_SUB, PARTNERSHIP 등';



CREATE TABLE IF NOT EXISTS "public"."email_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "inquiry_id" "uuid" NOT NULL,
    "inquiry_type" "text" NOT NULL,
    "template_id" "uuid",
    "recipient_email" "text" NOT NULL,
    "recipient_name" "text",
    "subject" "text" NOT NULL,
    "body_html" "text",
    "body_text" "text",
    "sent_by" "uuid",
    "sent_at" timestamp with time zone,
    "status" "text" DEFAULT 'pending'::"text",
    "error_message" "text",
    "trigger_event" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "email_logs_inquiry_type_check" CHECK (("inquiry_type" = ANY (ARRAY['external'::"text", 'international'::"text"]))),
    CONSTRAINT "email_logs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."email_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."email_logs" IS '이메일 발송 로그';



CREATE TABLE IF NOT EXISTS "public"."email_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "body_html" "text" NOT NULL,
    "body_text" "text",
    "trigger_event" "text",
    "trigger_status" "text",
    "is_active" boolean DEFAULT true,
    "description" "text",
    "variables" "jsonb" DEFAULT '[]'::"jsonb",
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."email_templates" OWNER TO "postgres";


COMMENT ON TABLE "public"."email_templates" IS '이메일 템플릿 관리 테이블';



COMMENT ON COLUMN "public"."email_templates"."trigger_event" IS '자동 발송 트리거: status_changed, assigned, note_added 등';



COMMENT ON COLUMN "public"."email_templates"."variables" IS '사용 가능한 변수: {company_name}, {contact_name} 등';



CREATE TABLE IF NOT EXISTS "public"."external_quote_inquiry" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_name" "text" NOT NULL,
    "contact_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "monthly_outbound_range" "text" NOT NULL,
    "sku_count" integer,
    "product_categories" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "extra_services" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "memo" "text",
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "owner_user_id" "uuid",
    "source" "text" DEFAULT 'web_form'::"text" NOT NULL,
    "converted_customer_id" "uuid",
    "converted_at" timestamp with time zone,
    "sales_stage" "text" DEFAULT 'LEAD'::"text",
    "assigned_to" "uuid",
    "expected_revenue" numeric(15,2),
    "win_probability" numeric(5,2),
    "lost_reason" "text",
    "quote_file_url" "text",
    "quote_sent_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "external_quote_inquiry_monthly_outbound_range_check" CHECK (("monthly_outbound_range" = ANY (ARRAY['0_1000'::"text", '1000_2000'::"text", '2000_3000'::"text", '3000_5000'::"text", '5000_10000'::"text", '10000_30000'::"text", '30000_plus'::"text"]))),
    CONSTRAINT "external_quote_inquiry_sales_stage_check" CHECK (("sales_stage" = ANY (ARRAY['LEAD'::"text", 'QUALIFIED'::"text", 'PROPOSAL'::"text", 'NEGOTIATION'::"text", 'WON'::"text", 'LOST'::"text"]))),
    CONSTRAINT "external_quote_inquiry_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'checked'::"text", 'processing'::"text", 'quoted'::"text", 'pending'::"text", 'won'::"text", 'lost'::"text", 'on_hold'::"text"])))
);


ALTER TABLE "public"."external_quote_inquiry" OWNER TO "postgres";


COMMENT ON TABLE "public"."external_quote_inquiry" IS '외부(웹) 견적/상담 문의 저장 테이블';



COMMENT ON COLUMN "public"."external_quote_inquiry"."monthly_outbound_range" IS '월 출고량 구간- 프론트 라디오 버튼 값';



COMMENT ON COLUMN "public"."external_quote_inquiry"."product_categories" IS '관심 상품군 (복수 선택)';



COMMENT ON COLUMN "public"."external_quote_inquiry"."extra_services" IS '필요한 추가 작업 목록 (복수 선택)';



COMMENT ON COLUMN "public"."external_quote_inquiry"."status" IS '상태: new(신규)/checked(확인됨)/processing(상담중)/quoted(견적발송)/pending(고객검토중)/won(수주)/lost(미수주)/on_hold(보류)';



COMMENT ON COLUMN "public"."external_quote_inquiry"."source" IS '리드 유입 경로 (기본 web_form)';



COMMENT ON COLUMN "public"."external_quote_inquiry"."converted_customer_id" IS '전환된 거래처 ID (수주 시)';



COMMENT ON COLUMN "public"."external_quote_inquiry"."sales_stage" IS '영업 단계: LEAD → QUALIFIED → PROPOSAL → NEGOTIATION → WON/LOST';



COMMENT ON COLUMN "public"."external_quote_inquiry"."assigned_to" IS '담당 운영자 ID';



COMMENT ON COLUMN "public"."external_quote_inquiry"."win_probability" IS '성사 확률 (0~100%)';



COMMENT ON COLUMN "public"."external_quote_inquiry"."quote_file_url" IS '견적서 PDF 파일 URL';



COMMENT ON COLUMN "public"."external_quote_inquiry"."quote_sent_at" IS '견적서 발송 일시';



COMMENT ON COLUMN "public"."external_quote_inquiry"."updated_at" IS '최종 수정 일시';



CREATE TABLE IF NOT EXISTS "public"."inbound_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "receipt_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "actor_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."inbound_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inbound_inspections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "inbound_id" "uuid",
    "product_id" "uuid",
    "expected_qty" integer NOT NULL,
    "received_qty" integer NOT NULL,
    "rejected_qty" integer DEFAULT 0,
    "condition" "text",
    "inspector_id" "uuid",
    "note" "text",
    "photos" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "org_id" "uuid",
    CONSTRAINT "inbound_inspections_condition_check" CHECK (("condition" = ANY (ARRAY['GOOD'::"text", 'DAMAGED'::"text", 'WRONG_ITEM'::"text", 'EXPIRED'::"text"])))
);


ALTER TABLE "public"."inbound_inspections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inbound_issues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "receipt_id" "uuid" NOT NULL,
    "line_id" "uuid",
    "issue_type" "text" NOT NULL,
    "severity" "text" DEFAULT 'MEDIUM'::"text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'OPEN'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_by" "uuid",
    "resolved_at" timestamp with time zone,
    CONSTRAINT "inbound_issues_issue_type_check" CHECK (("issue_type" = ANY (ARRAY['SHORT'::"text", 'OVER'::"text", 'DAMAGE'::"text", 'LABEL_ERROR'::"text", 'MIXED_SKU'::"text", 'EXPIRED'::"text", 'UNKNOWN'::"text"]))),
    CONSTRAINT "inbound_issues_severity_check" CHECK (("severity" = ANY (ARRAY['LOW'::"text", 'MEDIUM'::"text", 'HIGH'::"text"]))),
    CONSTRAINT "inbound_issues_status_check" CHECK (("status" = ANY (ARRAY['OPEN'::"text", 'IN_REVIEW'::"text", 'RESOLVED'::"text", 'REJECTED'::"text"])))
);


ALTER TABLE "public"."inbound_issues" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inbound_photo_slots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "receipt_id" "uuid" NOT NULL,
    "slot_key" "text" NOT NULL,
    "title" "text" NOT NULL,
    "is_required" boolean DEFAULT true NOT NULL,
    "min_photos" integer DEFAULT 1 NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."inbound_photo_slots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inbound_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "receipt_id" "uuid" NOT NULL,
    "slot_id" "uuid",
    "line_id" "uuid",
    "storage_bucket" "text" DEFAULT 'inbound'::"text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "mime_type" "text",
    "width" integer,
    "height" integer,
    "file_size" bigint,
    "taken_at" timestamp with time zone,
    "uploaded_by" "uuid",
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "step" integer,
    "photo_type" "text",
    "source" "text"
);


ALTER TABLE "public"."inbound_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inbound_plan_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "expected_qty" integer NOT NULL,
    "uom" "text" DEFAULT 'EA'::"text",
    "lot_no" "text",
    "expiry_date" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "box_count" integer,
    "pallet_text" "text",
    "mfg_date" "date",
    "line_notes" "text",
    CONSTRAINT "inbound_plan_lines_expected_qty_check" CHECK (("expected_qty" >= 0))
);


ALTER TABLE "public"."inbound_plan_lines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inbound_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "plan_no" "text" NOT NULL,
    "planned_date" "date" NOT NULL,
    "status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "inbound_manager" "text",
    CONSTRAINT "inbound_plans_status_check" CHECK (("status" = ANY (ARRAY['DRAFT'::"text", 'SUBMITTED'::"text", 'NOTIFIED'::"text", 'CLOSED'::"text", 'CANCELLED'::"text"])))
);


ALTER TABLE "public"."inbound_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inbound_receipt_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "receipt_id" "uuid" NOT NULL,
    "plan_line_id" "uuid",
    "product_id" "uuid" NOT NULL,
    "expected_qty" integer DEFAULT 0 NOT NULL,
    "received_qty" integer DEFAULT 0 NOT NULL,
    "accepted_qty" integer DEFAULT 0 NOT NULL,
    "damaged_qty" integer DEFAULT 0 NOT NULL,
    "missing_qty" integer DEFAULT 0 NOT NULL,
    "over_qty" integer DEFAULT 0 NOT NULL,
    "discrepancy_reason" "text",
    "lot_no" "text",
    "expiry_date" "date",
    "inspected_by" "uuid",
    "inspected_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "other_qty" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "inbound_receipt_lines_accepted_qty_check" CHECK (("accepted_qty" >= 0)),
    CONSTRAINT "inbound_receipt_lines_check" CHECK (((("accepted_qty" + "damaged_qty") + "missing_qty") <= ("received_qty" + "over_qty"))),
    CONSTRAINT "inbound_receipt_lines_damaged_qty_check" CHECK (("damaged_qty" >= 0)),
    CONSTRAINT "inbound_receipt_lines_expected_qty_check" CHECK (("expected_qty" >= 0)),
    CONSTRAINT "inbound_receipt_lines_missing_qty_check" CHECK (("missing_qty" >= 0)),
    CONSTRAINT "inbound_receipt_lines_other_qty_check" CHECK (("other_qty" >= 0)),
    CONSTRAINT "inbound_receipt_lines_over_qty_check" CHECK (("over_qty" >= 0)),
    CONSTRAINT "inbound_receipt_lines_received_qty_check" CHECK (("received_qty" >= 0))
);


ALTER TABLE "public"."inbound_receipt_lines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inbound_receipt_photo_requirements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "receipt_id" "uuid" NOT NULL,
    "template_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."inbound_receipt_photo_requirements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inbound_receipt_shares" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "receipt_id" "uuid" NOT NULL,
    "slug" "text" NOT NULL,
    "expires_at" timestamp with time zone,
    "password_salt" "text",
    "password_hash" "text",
    "language_default" "text" DEFAULT 'ko'::"text" NOT NULL,
    "summary_ko" "text",
    "summary_en" "text",
    "summary_zh" "text",
    "content" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_accessed_at" timestamp with time zone
);


ALTER TABLE "public"."inbound_receipt_shares" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inbound_receipts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "plan_id" "uuid",
    "receipt_no" "text" NOT NULL,
    "arrived_at" timestamp with time zone,
    "status" "text" DEFAULT 'ARRIVED'::"text" NOT NULL,
    "dock_name" "text",
    "carrier_name" "text",
    "tracking_no" "text",
    "total_box_count" integer,
    "notes" "text",
    "created_by" "uuid",
    "confirmed_by" "uuid",
    "confirmed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "inbound_receipts_status_check" CHECK (("status" = ANY (ARRAY['ARRIVED'::"text", 'PHOTO_REQUIRED'::"text", 'COUNTING'::"text", 'INSPECTING'::"text", 'DISCREPANCY'::"text", 'CONFIRMED'::"text", 'PUTAWAY_READY'::"text", 'CANCELLED'::"text"]))),
    CONSTRAINT "inbound_receipts_total_box_count_check" CHECK (("total_box_count" >= 0))
);


ALTER TABLE "public"."inbound_receipts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inbound_shipment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "owner_brand_id" "uuid" NOT NULL,
    "supplier_customer_id" "uuid",
    "ref_no" "text",
    "type" "text" NOT NULL,
    "status" "text" NOT NULL,
    "eta" timestamp with time zone,
    "received_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_by_user_id" "uuid",
    "received_by_user_id" "uuid",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."inbound_shipment" OWNER TO "postgres";


COMMENT ON TABLE "public"."inbound_shipment" IS '입고 오더 (헤더)';



COMMENT ON COLUMN "public"."inbound_shipment"."type" IS 'PURCHASE: 매입, RETURN: 반품입고, TRANSFER: 창고이동, B2B: B2B 입고';



CREATE TABLE IF NOT EXISTS "public"."inbound_shipment_line" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "inbound_shipment_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "uom_code" "text" DEFAULT 'EA'::"text" NOT NULL,
    "qty_expected" numeric NOT NULL,
    "qty_received" numeric DEFAULT 0 NOT NULL,
    "qty_damaged" numeric DEFAULT 0 NOT NULL,
    "lot_no" "text",
    "expiry_date" "date",
    "line_no" integer,
    "note" "text"
);


ALTER TABLE "public"."inbound_shipment_line" OWNER TO "postgres";


COMMENT ON TABLE "public"."inbound_shipment_line" IS '입고 오더 라인 (상품별)';



CREATE TABLE IF NOT EXISTS "public"."inbounds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid",
    "product_name" "text" NOT NULL,
    "supplier_id" "uuid",
    "supplier_name" "text" NOT NULL,
    "quantity" integer NOT NULL,
    "unit" "text" NOT NULL,
    "unit_price" numeric(10,2) NOT NULL,
    "total_price" numeric(10,2) NOT NULL,
    "inbound_date" timestamp with time zone NOT NULL,
    "status" "text" NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tracking_no" "text",
    "carrier" "text",
    "expected_arrival_date" timestamp with time zone,
    "actual_arrival_date" timestamp with time zone,
    "received_quantity" integer DEFAULT 0,
    "inspection_status" "text" DEFAULT 'PENDING'::"text",
    "rejection_reason" "text",
    "photos" "text"[],
    CONSTRAINT "inbounds_inspection_status_check" CHECK (("inspection_status" = ANY (ARRAY['PENDING'::"text", 'PASSED'::"text", 'PARTIAL'::"text", 'REJECTED'::"text"]))),
    CONSTRAINT "inbounds_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."inbounds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inquiry_action_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "inquiry_id" "uuid" NOT NULL,
    "inquiry_type" "text" NOT NULL,
    "action" "text" NOT NULL,
    "actor_id" "uuid",
    "actor_name" "text",
    "old_value" "text",
    "new_value" "text",
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "ip_address" "text",
    "user_agent" "text",
    CONSTRAINT "inquiry_action_logs_inquiry_type_check" CHECK (("inquiry_type" = ANY (ARRAY['external'::"text", 'international'::"text"])))
);


ALTER TABLE "public"."inquiry_action_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."inquiry_action_logs" IS '견적 문의 모든 액션 로그 (감사 추적)';



CREATE TABLE IF NOT EXISTS "public"."inquiry_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "inquiry_id" "uuid" NOT NULL,
    "inquiry_type" "text" NOT NULL,
    "admin_id" "uuid" NOT NULL,
    "note" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "inquiry_notes_inquiry_type_check" CHECK (("inquiry_type" = ANY (ARRAY['external'::"text", 'international'::"text"])))
);


ALTER TABLE "public"."inquiry_notes" OWNER TO "postgres";


COMMENT ON TABLE "public"."inquiry_notes" IS '견적 문의에 대한 운영자 메모';



COMMENT ON COLUMN "public"."inquiry_notes"."inquiry_id" IS '견적 문의 ID (external 또는 international)';



COMMENT ON COLUMN "public"."inquiry_notes"."inquiry_type" IS '문의 유형: external(국내) / international(해외)';



COMMENT ON COLUMN "public"."inquiry_notes"."admin_id" IS '메모 작성자 (운영자) ID';



COMMENT ON COLUMN "public"."inquiry_notes"."note" IS '메모 내용';



CREATE TABLE IF NOT EXISTS "public"."inventory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "location_id" "uuid",
    "product_id" "uuid" NOT NULL,
    "owner_brand_id" "uuid" NOT NULL,
    "uom_code" "text" DEFAULT 'EA'::"text" NOT NULL,
    "qty_on_hand" numeric DEFAULT 0 NOT NULL,
    "qty_allocated" numeric DEFAULT 0 NOT NULL,
    "qty_available" numeric GENERATED ALWAYS AS (("qty_on_hand" - "qty_allocated")) STORED,
    "lot_no" "text",
    "expiry_date" "date",
    "manufactured_date" "date",
    "status" "text" DEFAULT 'AVAILABLE'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."inventory" OWNER TO "postgres";


COMMENT ON TABLE "public"."inventory" IS '재고 관리 테이블';



CREATE TABLE IF NOT EXISTS "public"."inventory_import_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "source_file_name" "text",
    "dry_run" boolean DEFAULT true NOT NULL,
    "requested_limit" integer DEFAULT 1000 NOT NULL,
    "selected_count" integer DEFAULT 0 NOT NULL,
    "imported_count" integer DEFAULT 0 NOT NULL,
    "skipped_count" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'SUCCESS'::"text" NOT NULL,
    "error_message" "text",
    "requested_by" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "inventory_import_runs_status_check" CHECK (("status" = ANY (ARRAY['SUCCESS'::"text", 'FAILED'::"text"])))
);


ALTER TABLE "public"."inventory_import_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "transaction_type" "text" NOT NULL,
    "qty_change" integer NOT NULL,
    "balance_after" integer,
    "reference_type" "text",
    "reference_id" "uuid",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid",
    "movement_type" "text",
    "direction" "text",
    "quantity" integer,
    "memo" "text",
    "idempotency_key" "text",
    "source_hash" "text",
    CONSTRAINT "inventory_ledger_direction_chk" CHECK (("direction" = ANY (ARRAY['IN'::"text", 'OUT'::"text"]))),
    CONSTRAINT "inventory_ledger_movement_direction_chk" CHECK (((("movement_type" = ANY (ARRAY['INVENTORY_INIT'::"text", 'INBOUND'::"text", 'RETURN_B2C'::"text", 'ADJUSTMENT_PLUS'::"text", 'BUNDLE_BREAK_IN'::"text", 'OUTBOUND_CANCEL'::"text"])) AND ("direction" = 'IN'::"text")) OR (("movement_type" = ANY (ARRAY['OUTBOUND'::"text", 'DISPOSAL'::"text", 'DAMAGE'::"text", 'ADJUSTMENT_MINUS'::"text", 'BUNDLE_BREAK_OUT'::"text", 'EXPORT_PICKUP'::"text"])) AND ("direction" = 'OUT'::"text")) OR ("movement_type" = 'TRANSFER'::"text"))),
    CONSTRAINT "inventory_ledger_movement_type_chk" CHECK (("movement_type" = ANY (ARRAY['INVENTORY_INIT'::"text", 'INBOUND'::"text", 'OUTBOUND'::"text", 'OUTBOUND_CANCEL'::"text", 'DISPOSAL'::"text", 'DAMAGE'::"text", 'RETURN_B2C'::"text", 'ADJUSTMENT_PLUS'::"text", 'ADJUSTMENT_MINUS'::"text", 'BUNDLE_BREAK_IN'::"text", 'BUNDLE_BREAK_OUT'::"text", 'EXPORT_PICKUP'::"text", 'TRANSFER'::"text"]))),
    CONSTRAINT "inventory_ledger_qty_consistency_chk" CHECK ((("qty_change" IS NULL) OR ((("direction" = 'IN'::"text") AND ("qty_change" = "quantity")) OR (("direction" = 'OUT'::"text") AND ("qty_change" = (- "quantity")))))),
    CONSTRAINT "inventory_ledger_quantity_positive_chk" CHECK ((("quantity" IS NOT NULL) AND ("quantity" >= 0))),
    CONSTRAINT "inventory_ledger_transaction_type_check" CHECK (("transaction_type" = ANY (ARRAY['INBOUND'::"text", 'OUTBOUND'::"text", 'ADJUSTMENT'::"text", 'TRANSFER'::"text", 'RETURN'::"text"])))
);


ALTER TABLE "public"."inventory_ledger" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_quantities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "qty_on_hand" integer DEFAULT 0 NOT NULL,
    "qty_available" integer DEFAULT 0 NOT NULL,
    "qty_allocated" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_inventory_quantities_qty_allocated_nonnegative" CHECK (("qty_allocated" >= 0)),
    CONSTRAINT "chk_inventory_quantities_qty_available_lte_on_hand" CHECK (("qty_available" <= "qty_on_hand")),
    CONSTRAINT "chk_inventory_quantities_qty_available_nonnegative" CHECK (("qty_available" >= 0)),
    CONSTRAINT "chk_inventory_quantities_qty_on_hand_nonnegative" CHECK (("qty_on_hand" >= 0))
);


ALTER TABLE "public"."inventory_quantities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_snapshot" (
    "snapshot_date" "date" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "closing_stock" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."inventory_snapshot" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_transaction" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "location_id" "uuid",
    "product_id" "uuid" NOT NULL,
    "owner_brand_id" "uuid",
    "uom_code" "text" DEFAULT 'EA'::"text" NOT NULL,
    "transaction_type" "text" NOT NULL,
    "qty" numeric NOT NULL,
    "ref_type" "text",
    "ref_id" "uuid",
    "lot_no" "text",
    "from_location_id" "uuid",
    "to_location_id" "uuid",
    "performed_by_user_id" "uuid",
    "performed_at" timestamp with time zone DEFAULT "now"(),
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."inventory_transaction" OWNER TO "postgres";


COMMENT ON TABLE "public"."inventory_transaction" IS '재고 트랜잭션 로그 (모든 재고 변동 기록)';



COMMENT ON COLUMN "public"."inventory_transaction"."transaction_type" IS 'IN: 입고, OUT: 출고, MOVE: 이동, ADJUST: 조정, HOLD: 보류, RELEASE: 해제';



CREATE TABLE IF NOT EXISTS "public"."inventory_volume_raw" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "sheet_name" "text" NOT NULL,
    "record_date" "date",
    "row_no" integer NOT NULL,
    "item_name" "text",
    "opening_stock_raw" "text",
    "closing_stock_raw" "text",
    "header_order" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "raw_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "source_file" "text",
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."inventory_volume_raw" OWNER TO "postgres";


COMMENT ON TABLE "public"."inventory_volume_raw" IS '거래처 물동량 엑셀 원본 행 데이터(JSON 보존)';



CREATE TABLE IF NOT EXISTS "public"."inventory_volume_share" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "date_from" "date",
    "date_to" "date",
    "password_hash" "text",
    "password_salt" "text",
    "expires_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."inventory_volume_share" OWNER TO "postgres";


COMMENT ON TABLE "public"."inventory_volume_share" IS '물동량 데이터 외부 공유 링크';



CREATE TABLE IF NOT EXISTS "public"."location" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "type" "text" NOT NULL,
    "zone" "text",
    "aisle" "text",
    "rack" "text",
    "shelf" "text",
    "bin" "text",
    "max_capacity" numeric,
    "capacity_unit" "text",
    "is_pickable" boolean DEFAULT true,
    "is_bulk" boolean DEFAULT false,
    "temperature_zone" "text",
    "status" "text" DEFAULT 'ACTIVE'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."location" OWNER TO "postgres";


COMMENT ON TABLE "public"."location" IS '창고 내 로케이션 (적재 위치)';



COMMENT ON COLUMN "public"."location"."type" IS 'STORAGE: 보관, PICK_FACE: 피킹 위치, RECEIVING: 입고장, SHIPPING: 출고장, STAGING: 스테이징, INSPECTION: 검수, RETURNS: 반품, QUARANTINE: 격리';



CREATE TABLE IF NOT EXISTS "public"."logistics_api_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "adapter" "text",
    "direction" "text",
    "status" "text",
    "http_code" integer,
    "headers" "jsonb",
    "body" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."logistics_api_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."partners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "contact" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "email" "text" NOT NULL,
    "address" "text" NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "code" "text",
    "locale" "text" DEFAULT 'zh-CN'::"text",
    "timezone" "text" DEFAULT 'Asia/Shanghai'::"text",
    CONSTRAINT "partners_type_check" CHECK (("type" = ANY (ARRAY['supplier'::"text", 'customer'::"text", 'both'::"text"])))
);


ALTER TABLE "public"."partners" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."my_partner_info" WITH ("security_invoker"='true') AS
 SELECT "p"."id",
    "p"."name",
    "p"."type",
    "p"."contact",
    "p"."phone",
    "p"."email",
    "p"."address",
    "p"."note",
    "p"."created_at",
    "p"."updated_at",
    "p"."code",
    "p"."locale",
    "p"."timezone"
   FROM ("public"."partners" "p"
     JOIN "public"."users" "u" ON (("u"."partner_id" = "p"."id")))
  WHERE ("u"."id" = "auth"."uid"());


ALTER VIEW "public"."my_partner_info" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."my_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_order_id" "uuid",
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "product_name" "text" NOT NULL,
    "quantity" integer NOT NULL,
    "unit" "text" NOT NULL,
    "location" "text",
    "status" "text" NOT NULL,
    "due_date" timestamp with time zone NOT NULL,
    "priority" "text" NOT NULL,
    "barcode" "text",
    "qr_code" "text",
    "note" "text",
    "attachments" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "my_tasks_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "my_tasks_status_check" CHECK (("status" = ANY (ARRAY['planned'::"text", 'in-progress'::"text", 'completed'::"text", 'overdue'::"text", 'on-hold'::"text"]))),
    CONSTRAINT "my_tasks_type_check" CHECK (("type" = ANY (ARRAY['inbound'::"text", 'outbound'::"text", 'packing'::"text"])))
);


ALTER TABLE "public"."my_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "trigger_event" "text" NOT NULL,
    "trigger_condition" "jsonb" DEFAULT '{}'::"jsonb",
    "notify_type" "text" NOT NULL,
    "notify_users" "uuid"[],
    "notify_roles" "text"[],
    "send_email" boolean DEFAULT false,
    "send_notification" boolean DEFAULT true,
    "send_slack" boolean DEFAULT false,
    "email_template_id" "uuid",
    "cooldown_minutes" integer DEFAULT 0,
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "notification_rules_notify_type_check" CHECK (("notify_type" = ANY (ARRAY['assigned_user'::"text", 'all_admins'::"text", 'specific_users'::"text", 'role'::"text"])))
);


ALTER TABLE "public"."notification_rules" OWNER TO "postgres";


COMMENT ON TABLE "public"."notification_rules" IS '자동 알림 규칙 설정';



COMMENT ON COLUMN "public"."notification_rules"."trigger_event" IS 'new_inquiry, status_changed, assigned, no_activity_3days 등';



COMMENT ON COLUMN "public"."notification_rules"."cooldown_minutes" IS '동일 이벤트 재알림 방지 시간 (분)';



CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "type" "text" NOT NULL,
    "inquiry_id" "uuid",
    "inquiry_type" "text",
    "link_url" "text",
    "is_read" boolean DEFAULT false,
    "read_at" timestamp with time zone,
    "action" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "notifications_inquiry_type_check" CHECK (("inquiry_type" = ANY (ARRAY['external'::"text", 'international'::"text"]))),
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['info'::"text", 'warning'::"text", 'success'::"text", 'error'::"text", 'urgent'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


COMMENT ON TABLE "public"."notifications" IS '사용자 알림 테이블';



COMMENT ON COLUMN "public"."notifications"."action" IS '알림 액션: assigned, status_changed, reminder, new_inquiry 등';



CREATE TABLE IF NOT EXISTS "public"."order_receivers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "name" "text" NOT NULL,
    "phone" "text",
    "zip" "text",
    "address1" "text",
    "address2" "text",
    "locality" "text",
    "country_code" "text",
    "meta" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."order_receivers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_senders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text",
    "zip" "text",
    "address" "text",
    "address_detail" "text",
    "is_default" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."order_senders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_status_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "from_status" "text",
    "to_status" "text" NOT NULL,
    "changed_by" "uuid",
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."order_status_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_no" "text" NOT NULL,
    "user_id" "uuid",
    "country_code" "text",
    "product_name" "text",
    "remark" "text",
    "logistics_company" "text",
    "tracking_no" "text",
    "status" "text" DEFAULT 'CREATED'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "on_hold" boolean DEFAULT false,
    "hold_reason" "text",
    "cancelled_at" timestamp with time zone,
    "cancelled_by" "uuid",
    "cancelled_reason" "text",
    "partner_id" "uuid"
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."org" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "code" "text",
    "status" "text" DEFAULT 'ACTIVE'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."org" OWNER TO "postgres";


COMMENT ON TABLE "public"."org" IS '조직/회사 정보';



COMMENT ON COLUMN "public"."org"."code" IS '조직 코드 (예: ANH, AH)';



CREATE TABLE IF NOT EXISTS "public"."outbound_order_line" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "outbound_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "uom_code" "text" DEFAULT 'EA'::"text" NOT NULL,
    "qty_ordered" numeric NOT NULL,
    "qty_allocated" numeric DEFAULT 0 NOT NULL,
    "qty_picked" numeric DEFAULT 0 NOT NULL,
    "qty_packed" numeric DEFAULT 0 NOT NULL,
    "qty_shipped" numeric DEFAULT 0 NOT NULL,
    "lot_no" "text",
    "line_no" integer,
    "note" "text"
);


ALTER TABLE "public"."outbound_order_line" OWNER TO "postgres";


COMMENT ON TABLE "public"."outbound_order_line" IS '출고 오더 라인 (상품별)';



CREATE TABLE IF NOT EXISTS "public"."outbounds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid",
    "product_name" "text" NOT NULL,
    "customer_id" "uuid",
    "customer_name" "text" NOT NULL,
    "quantity" integer NOT NULL,
    "unit" "text" NOT NULL,
    "unit_price" numeric(10,2) NOT NULL,
    "total_price" numeric(10,2) NOT NULL,
    "outbound_date" timestamp with time zone NOT NULL,
    "status" "text" NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "warehouse_id" "uuid",
    "brand_id" "uuid",
    "store_id" "uuid",
    "order_type" "text" DEFAULT 'B2C'::"text",
    "client_order_no" "text",
    "channel_order_no" "text",
    "requested_ship_at" timestamp with time zone,
    "shipped_at" timestamp with time zone,
    "tracking_no" "text",
    "carrier_code" "text",
    CONSTRAINT "outbounds_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."outbounds" OWNER TO "postgres";


COMMENT ON COLUMN "public"."outbounds"."order_type" IS 'B2C: 소비자 직배송, B2B: 기업간 거래, TRANSFER: 창고이동, RETURN: 반품출고';



CREATE TABLE IF NOT EXISTS "public"."pack_job" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "kit_product_id" "uuid" NOT NULL,
    "owner_brand_id" "uuid" NOT NULL,
    "from_location_id" "uuid",
    "to_location_id" "uuid",
    "qty_kit_planned" numeric NOT NULL,
    "qty_kit_completed" numeric DEFAULT 0 NOT NULL,
    "status" "text" NOT NULL,
    "created_by_user_id" "uuid",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pack_job" OWNER TO "postgres";


COMMENT ON TABLE "public"."pack_job" IS '번들/키팅 작업 오더';



CREATE TABLE IF NOT EXISTS "public"."pack_job_component" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pack_job_id" "uuid" NOT NULL,
    "component_product_id" "uuid" NOT NULL,
    "uom_code" "text" DEFAULT 'EA'::"text" NOT NULL,
    "qty_required" numeric NOT NULL,
    "qty_consumed" numeric DEFAULT 0 NOT NULL,
    "line_no" integer
);


ALTER TABLE "public"."pack_job_component" OWNER TO "postgres";


COMMENT ON TABLE "public"."pack_job_component" IS '번들/키팅 구성품 소비 내역';



CREATE TABLE IF NOT EXISTS "public"."parcel_shipment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shipping_account_id" "uuid" NOT NULL,
    "brand_id" "uuid",
    "store_id" "uuid",
    "outbound_id" "uuid",
    "warehouse_id" "uuid",
    "source_type" "text" NOT NULL,
    "tracking_no" "text" NOT NULL,
    "waybill_no" "text",
    "invoice_no" "text",
    "ship_date" "date" NOT NULL,
    "dest_country_code" character(2),
    "dest_city" "text",
    "dest_postal_code" "text",
    "box_count" integer DEFAULT 1,
    "weight_kg" numeric,
    "volume_m3" numeric,
    "fee_total" numeric,
    "fee_base" numeric,
    "fee_fuel" numeric,
    "fee_remote" numeric,
    "fee_extra" numeric,
    "fee_currency" "text" DEFAULT 'KRW'::"text",
    "anh_commission" numeric,
    "anh_commission_rate" numeric,
    "billing_status" "text" DEFAULT 'UNBILLED'::"text",
    "billed_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "status" "text" DEFAULT 'CREATED'::"text",
    "delivered_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."parcel_shipment" OWNER TO "postgres";


COMMENT ON TABLE "public"."parcel_shipment" IS '택배 송장 (실제 배송 건별 물량 및 비용 관리)';



COMMENT ON COLUMN "public"."parcel_shipment"."source_type" IS 'WMS: WMS에서 생성, EXTERNAL: 외부 시스템에서 생성';



CREATE TABLE IF NOT EXISTS "public"."photo_guide_slots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "template_id" "uuid" NOT NULL,
    "slot_key" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "is_required" boolean DEFAULT true NOT NULL,
    "min_photos" integer DEFAULT 1 NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "photo_guide_slots_min_photos_check" CHECK (("min_photos" >= 0))
);


ALTER TABLE "public"."photo_guide_slots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."photo_guide_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."photo_guide_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_barcodes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "barcode" "text" NOT NULL,
    "barcode_type" "text" NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_barcodes_barcode_type_check" CHECK (("barcode_type" = ANY (ARRAY['RETAIL'::"text", 'SET'::"text", 'INNER'::"text", 'OUTER'::"text"])))
);


ALTER TABLE "public"."product_barcodes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_bom" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kit_product_id" "uuid" NOT NULL,
    "component_product_id" "uuid" NOT NULL,
    "component_qty_in_base_uom" numeric NOT NULL,
    "seq_no" integer,
    "is_optional" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."product_bom" OWNER TO "postgres";


COMMENT ON TABLE "public"."product_bom" IS '상품 BOM (번들/키팅 구성 정보)';



COMMENT ON COLUMN "public"."product_bom"."kit_product_id" IS '번들/키트 상품 ID';



COMMENT ON COLUMN "public"."product_bom"."component_product_id" IS '구성품 상품 ID';



CREATE TABLE IF NOT EXISTS "public"."product_categories" (
    "code" "text" NOT NULL,
    "name_ko" "text" NOT NULL,
    "name_en" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."product_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_uom" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "uom_code" "text" NOT NULL,
    "uom_name" "text",
    "qty_in_base_uom" numeric NOT NULL,
    "barcode" "text",
    "weight_kg" numeric,
    "length_cm" numeric,
    "width_cm" numeric,
    "height_cm" numeric,
    "is_base_uom" boolean DEFAULT false,
    "is_orderable" boolean DEFAULT true,
    "is_sellable" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."product_uom" OWNER TO "postgres";


COMMENT ON TABLE "public"."product_uom" IS '상품 단위 관리 (EA, BOX, CASE 등)';



COMMENT ON COLUMN "public"."product_uom"."qty_in_base_uom" IS '기본 단위(EA)로 환산 시 수량. 예: 1 BOX = 10 EA';



CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "sku" "text" NOT NULL,
    "category" "text" NOT NULL,
    "quantity" integer DEFAULT 0 NOT NULL,
    "unit" "text" DEFAULT '개'::"text" NOT NULL,
    "min_stock" integer DEFAULT 0 NOT NULL,
    "price" numeric(10,2) DEFAULT 0 NOT NULL,
    "location" "text",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "brand_id" "uuid",
    "barcode" "text",
    "hs_code" "text",
    "weight_kg" numeric,
    "length_cm" numeric,
    "width_cm" numeric,
    "height_cm" numeric,
    "product_type" "text" DEFAULT 'NORMAL'::"text",
    "partner_id" "uuid",
    "customer_id" "uuid",
    "manage_name" "text",
    "user_code" "text",
    "product_db_no" "text",
    "manufacture_date" "date",
    "expiry_date" "date",
    "option_size" "text",
    "option_color" "text",
    "option_lot" "text",
    "option_etc" "text",
    "cost_price" numeric(12,2) DEFAULT 0,
    "status" "text" DEFAULT 'ACTIVE'::"text"
);


ALTER TABLE "public"."products" OWNER TO "postgres";


COMMENT ON COLUMN "public"."products"."product_type" IS 'NORMAL: 일반 상품, KIT: 번들/키팅 상품, COMPONENT: 구성품, VIRTUAL: 가상 상품';



COMMENT ON COLUMN "public"."products"."status" IS 'ACTIVE: 판매중, INACTIVE: 판매중지 및 기타';



CREATE TABLE IF NOT EXISTS "public"."quote_calculations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "inquiry_id" "uuid" NOT NULL,
    "inquiry_type" "text" NOT NULL,
    "pricing_rule_id" "uuid",
    "calculation_data" "jsonb" NOT NULL,
    "subtotal" numeric(10,2) NOT NULL,
    "discount" numeric(10,2) DEFAULT 0,
    "total" numeric(10,2) NOT NULL,
    "calculated_by" "uuid",
    "is_sent" boolean DEFAULT false,
    "sent_at" timestamp with time zone,
    "notes" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "quote_calculations_inquiry_type_check" CHECK (("inquiry_type" = ANY (ARRAY['external'::"text", 'international'::"text"])))
);


ALTER TABLE "public"."quote_calculations" OWNER TO "postgres";


COMMENT ON TABLE "public"."quote_calculations" IS '견적 계산 및 발송 히스토리';



CREATE TABLE IF NOT EXISTS "public"."quote_pricing_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "priority" integer DEFAULT 0,
    "min_monthly_volume" integer,
    "max_monthly_volume" integer,
    "min_sku_count" integer,
    "max_sku_count" integer,
    "product_categories" "text"[],
    "base_fee" numeric(10,2),
    "picking_fee" numeric(10,2),
    "packing_fee" numeric(10,2),
    "storage_fee" numeric(10,2),
    "extra_service_fees" "jsonb" DEFAULT '{}'::"jsonb",
    "volume_discount" "jsonb" DEFAULT '{}'::"jsonb",
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."quote_pricing_rules" OWNER TO "postgres";


COMMENT ON TABLE "public"."quote_pricing_rules" IS '자동 견적 산정 규칙';



COMMENT ON COLUMN "public"."quote_pricing_rules"."priority" IS '여러 규칙 적용 시 우선순위 (높을수록 먼저)';



CREATE TABLE IF NOT EXISTS "public"."receipt_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid",
    "receipt_id" "uuid",
    "receipt_no" "text",
    "file_name" "text" NOT NULL,
    "storage_bucket" "text" DEFAULT 'inbound'::"text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text",
    "mime_type" "text",
    "file_size" bigint,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."receipt_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."return_order" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "brand_id" "uuid",
    "store_id" "uuid",
    "source_type" "text" NOT NULL,
    "outbound_id" "uuid",
    "external_order_ref" "text",
    "carrier_code" "text",
    "tracking_no" "text",
    "status" "text" NOT NULL,
    "reason_code" "text",
    "disposition" "text",
    "received_at" timestamp with time zone,
    "inspected_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "received_by_user_id" "uuid",
    "inspected_by_user_id" "uuid",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."return_order" OWNER TO "postgres";


COMMENT ON TABLE "public"."return_order" IS '반품 오더 (헤더)';



COMMENT ON COLUMN "public"."return_order"."source_type" IS 'OUR_OUTBOUND: 우리 출고건 반품, EXTERNAL: 외부 주문 반품, CUSTOMER_RETURN: 직접 고객 반품';



COMMENT ON COLUMN "public"."return_order"."disposition" IS 'RESTOCK: 재입고, RESHIP: 재출고, SCRAP: 폐기, RETURN_TO_SENDER: 발송인 반송, EXCHANGE: 교환';



CREATE TABLE IF NOT EXISTS "public"."return_order_line" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "return_order_id" "uuid" NOT NULL,
    "product_id" "uuid",
    "uom_code" "text" DEFAULT 'EA'::"text",
    "qty_returned" numeric NOT NULL,
    "qty_accepted" numeric DEFAULT 0 NOT NULL,
    "qty_restocked" numeric DEFAULT 0 NOT NULL,
    "qty_scrapped" numeric DEFAULT 0 NOT NULL,
    "qty_reshipped" numeric DEFAULT 0 NOT NULL,
    "condition_code" "text",
    "lot_no" "text",
    "line_no" integer,
    "note" "text"
);


ALTER TABLE "public"."return_order_line" OWNER TO "postgres";


COMMENT ON TABLE "public"."return_order_line" IS '반품 오더 라인 (상품별)';



CREATE TABLE IF NOT EXISTS "public"."shipping_account" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_master_id" "uuid" NOT NULL,
    "carrier_id" "uuid" NOT NULL,
    "account_code" "text" NOT NULL,
    "account_name" "text",
    "is_anh_owned" boolean DEFAULT true,
    "api_username" "text",
    "api_password" "text",
    "api_token" "text",
    "contract_rate" numeric,
    "rate_currency" "text" DEFAULT 'KRW'::"text",
    "status" "text" DEFAULT 'ACTIVE'::"text",
    "valid_from" "date",
    "valid_to" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shipping_account" OWNER TO "postgres";


COMMENT ON TABLE "public"."shipping_account" IS '배송사 계정 (고객사별 배송사 연동 계정)';



COMMENT ON COLUMN "public"."shipping_account"."is_anh_owned" IS 'TRUE: ANH 소유 계정, FALSE: 고객사 자체 계정';



CREATE TABLE IF NOT EXISTS "public"."shipping_carrier" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name_ko" "text" NOT NULL,
    "name_en" "text",
    "country_code" character(2) DEFAULT 'KR'::"bpchar",
    "api_type" "text",
    "api_endpoint" "text",
    "api_key" "text",
    "is_domestic" boolean DEFAULT true,
    "is_international" boolean DEFAULT false,
    "status" "text" DEFAULT 'ACTIVE'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shipping_carrier" OWNER TO "postgres";


COMMENT ON TABLE "public"."shipping_carrier" IS '배송사/택배사 마스터';



CREATE TABLE IF NOT EXISTS "public"."stock_transfer" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "from_warehouse_id" "uuid" NOT NULL,
    "to_warehouse_id" "uuid" NOT NULL,
    "ref_no" "text",
    "status" "text" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"(),
    "approved_at" timestamp with time zone,
    "shipped_at" timestamp with time zone,
    "received_at" timestamp with time zone,
    "created_by_user_id" "uuid",
    "approved_by_user_id" "uuid",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stock_transfer" OWNER TO "postgres";


COMMENT ON TABLE "public"."stock_transfer" IS '창고 간 재고 이동 오더';



CREATE TABLE IF NOT EXISTS "public"."stock_transfer_line" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stock_transfer_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "uom_code" "text" NOT NULL,
    "qty_planned" numeric NOT NULL,
    "qty_shipped" numeric DEFAULT 0 NOT NULL,
    "qty_received" numeric DEFAULT 0 NOT NULL,
    "line_no" integer
);


ALTER TABLE "public"."stock_transfer_line" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."store" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "platform" "text" NOT NULL,
    "external_store_id" "text",
    "store_url" "text",
    "country_code" character(2) DEFAULT 'KR'::"bpchar",
    "timezone" "text" DEFAULT 'Asia/Seoul'::"text",
    "language" "text" DEFAULT 'ko'::"text",
    "api_enabled" boolean DEFAULT false,
    "api_key" "text",
    "api_endpoint" "text",
    "sync_interval_min" integer DEFAULT 10,
    "last_synced_at" timestamp with time zone,
    "status" "text" DEFAULT 'ACTIVE'::"text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."store" OWNER TO "postgres";


COMMENT ON TABLE "public"."store" IS '판매 채널/스토어 테이블 (네이버, 쿠팡, 타오바오 등)';



COMMENT ON COLUMN "public"."store"."platform" IS '판매 플랫폼: NAVER, COUPANG, TAOBAO, DOUYIN, TMALL, SHOPIFY, OFFLINE 등';



CREATE TABLE IF NOT EXISTS "public"."system_alert" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "alert_type" "text" NOT NULL,
    "severity" "text" NOT NULL,
    "brand_id" "uuid",
    "warehouse_id" "uuid",
    "title" "text" NOT NULL,
    "message" "text",
    "ref_type" "text",
    "ref_id" "uuid",
    "status" "text" DEFAULT 'OPEN'::"text",
    "acknowledged_at" timestamp with time zone,
    "acknowledged_by" "uuid",
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."system_alert" OWNER TO "postgres";


COMMENT ON TABLE "public"."system_alert" IS '시스템 알림 (재고 부족, 주문 지연, 배송 예외 등)';



CREATE TABLE IF NOT EXISTS "public"."system_announcements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "link_url" "text",
    "starts_at" timestamp with time zone DEFAULT "now"(),
    "ends_at" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."system_announcements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "display_name" "text",
    "role" "text" DEFAULT 'viewer'::"text" NOT NULL,
    "department" "text",
    "org_id" "uuid",
    "can_access_admin" boolean DEFAULT false,
    "can_access_dashboard" boolean DEFAULT true,
    "can_manage_users" boolean DEFAULT false,
    "can_manage_inventory" boolean DEFAULT false,
    "can_manage_orders" boolean DEFAULT false,
    "avatar_url" "text",
    "phone" "text",
    "timezone" "text" DEFAULT 'Asia/Seoul'::"text",
    "language" "text" DEFAULT 'ko'::"text",
    "status" "text" DEFAULT 'active'::"text",
    "last_login_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "locked_until" timestamp with time zone,
    "locked_reason" "text",
    "partner_id" "uuid"
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_profiles" IS '사용자 프로필 및 권한 정보';



COMMENT ON COLUMN "public"."user_profiles"."role" IS 'admin: 전체 권한, manager: 관리 권한, operator: 운영 권한, viewer: 조회만';



COMMENT ON COLUMN "public"."user_profiles"."department" IS '소속 부서 (admin: 관리자, warehouse: 창고, cs: 고객지원, fulfillment: 풀필먼트)';



CREATE OR REPLACE VIEW "public"."v_active_contracts" WITH ("security_invoker"='true') AS
 SELECT "cc"."id",
    "cc"."customer_master_id",
    "cc"."contract_no",
    "cc"."contract_name",
    "cc"."contract_type",
    "cc"."contract_start",
    "cc"."contract_end",
    "cc"."auto_renewal",
    "cc"."renewal_notice_days",
    "cc"."renewal_count",
    "cc"."contract_amount",
    "cc"."currency",
    "cc"."payment_terms",
    "cc"."payment_method",
    "cc"."billing_cycle",
    "cc"."sla_inbound_processing",
    "cc"."sla_outbound_cutoff",
    "cc"."sla_accuracy_rate",
    "cc"."sla_ontime_ship_rate",
    "cc"."contract_file_url",
    "cc"."contract_file_name",
    "cc"."signed_date",
    "cc"."signed_by_customer",
    "cc"."signed_by_company",
    "cc"."status",
    "cc"."parent_contract_id",
    "cc"."replaced_by_contract_id",
    "cc"."termination_reason",
    "cc"."termination_date",
    "cc"."termination_notice_date",
    "cc"."reminder_sent",
    "cc"."reminder_sent_at",
    "cc"."note",
    "cc"."metadata",
    "cc"."created_at",
    "cc"."updated_at",
    "cm"."name" AS "customer_name",
    "cm"."code" AS "customer_code",
    "cm"."type" AS "customer_type",
        CASE
            WHEN ("cc"."contract_end" < CURRENT_DATE) THEN 'EXPIRED'::"text"
            WHEN ("cc"."contract_end" <= (CURRENT_DATE + '30 days'::interval)) THEN 'EXPIRING_SOON'::"text"
            ELSE "cc"."status"
        END AS "contract_status_computed",
    ("cc"."contract_end" - CURRENT_DATE) AS "days_until_expiry"
   FROM ("public"."customer_contract" "cc"
     JOIN "public"."customer_master" "cm" ON (("cc"."customer_master_id" = "cm"."id")))
  WHERE ("cc"."status" = 'ACTIVE'::"text")
  ORDER BY "cc"."contract_end";


ALTER VIEW "public"."v_active_contracts" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_active_contracts" IS '활성 계약 현황 (만료 임박 계약 자동 표시)';



CREATE OR REPLACE VIEW "public"."v_customer_with_contacts" AS
SELECT
    NULL::"uuid" AS "id",
    NULL::"uuid" AS "org_id",
    NULL::"text" AS "code",
    NULL::"text" AS "name",
    NULL::"text" AS "type",
    NULL::character(2) AS "country_code",
    NULL::"text" AS "business_reg_no",
    NULL::"text" AS "billing_currency",
    NULL::"text" AS "billing_cycle",
    NULL::integer AS "payment_terms",
    NULL::"text" AS "contact_name",
    NULL::"text" AS "contact_email",
    NULL::"text" AS "contact_phone",
    NULL::"text" AS "address_line1",
    NULL::"text" AS "address_line2",
    NULL::"text" AS "city",
    NULL::"text" AS "postal_code",
    NULL::"date" AS "contract_start",
    NULL::"date" AS "contract_end",
    NULL::"text" AS "status",
    NULL::"text" AS "note",
    NULL::"jsonb" AS "metadata",
    NULL::timestamp with time zone AS "created_at",
    NULL::timestamp with time zone AS "updated_at",
    NULL::json AS "contacts";


ALTER VIEW "public"."v_customer_with_contacts" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_customer_with_contacts" IS '거래처 정보 + 담당자 목록 (JSON)';



CREATE OR REPLACE VIEW "public"."v_inbound_receipt_photo_progress" WITH ("security_invoker"='true') AS
 SELECT "s"."receipt_id",
    "s"."id" AS "slot_id",
    "s"."slot_key",
    "s"."is_required",
    "s"."min_photos",
    "count"("p"."id") FILTER (WHERE ("p"."is_deleted" = false)) AS "uploaded_count",
    ("count"("p"."id") FILTER (WHERE ("p"."is_deleted" = false)) >= "s"."min_photos") AS "slot_ok"
   FROM ("public"."inbound_photo_slots" "s"
     LEFT JOIN "public"."inbound_photos" "p" ON (("p"."slot_id" = "s"."id")))
  GROUP BY "s"."receipt_id", "s"."id", "s"."slot_key", "s"."is_required", "s"."min_photos";


ALTER VIEW "public"."v_inbound_receipt_photo_progress" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_inventory_stock_current" WITH ("security_invoker"='true') AS
 SELECT "tenant_id",
    "product_id",
    (COALESCE("sum"(
        CASE
            WHEN ("direction" = 'IN'::"text") THEN "quantity"
            ELSE (- "quantity")
        END), (0)::bigint))::integer AS "current_stock"
   FROM "public"."inventory_ledger" "il"
  GROUP BY "tenant_id", "product_id";


ALTER VIEW "public"."v_inventory_stock_current" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_quote_to_customer_conversion" WITH ("security_invoker"='true') AS
 SELECT 'DOMESTIC'::"text" AS "quote_type",
    "eq"."id" AS "quote_id",
    "eq"."company_name",
    "eq"."contact_name",
    "eq"."email",
    "eq"."sales_stage",
    "eq"."status",
    "eq"."created_at" AS "inquiry_date",
    "eq"."converted_at",
    "eq"."converted_customer_id",
    "cm"."code" AS "customer_code",
    "cm"."name" AS "customer_name",
    "eq"."expected_revenue",
    "eq"."win_probability"
   FROM ("public"."external_quote_inquiry" "eq"
     LEFT JOIN "public"."customer_master" "cm" ON (("eq"."converted_customer_id" = "cm"."id")))
  ORDER BY "eq"."created_at" DESC;


ALTER VIEW "public"."v_quote_to_customer_conversion" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_quote_to_customer_conversion" IS '견적 문의에서 거래처 전환 추적 (국내만)';



CREATE TABLE IF NOT EXISTS "public"."warehouse" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid",
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "country_code" character(2) DEFAULT 'KR'::"bpchar",
    "timezone" "text" DEFAULT 'Asia/Seoul'::"text",
    "operator_customer_id" "uuid",
    "owner_customer_id" "uuid",
    "address_line1" "text",
    "address_line2" "text",
    "city" "text",
    "state" "text",
    "postal_code" "text",
    "latitude" numeric(10,7),
    "longitude" numeric(10,7),
    "is_returns_center" boolean DEFAULT false,
    "allow_inbound" boolean DEFAULT true,
    "allow_outbound" boolean DEFAULT true,
    "allow_cross_dock" boolean DEFAULT false,
    "operating_hours" "jsonb",
    "cutoff_time" time without time zone,
    "status" "text" DEFAULT 'ACTIVE'::"text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."warehouse" OWNER TO "postgres";


COMMENT ON TABLE "public"."warehouse" IS '창고/물류센터 테이블';



COMMENT ON COLUMN "public"."warehouse"."type" IS 'ANH_OWNED: ANH 자체 창고, CLIENT_OWNED: 고객사 창고, PARTNER_OVERSEAS: 해외 파트너 창고, RETURNS_CENTER: 반품센터';



CREATE TABLE IF NOT EXISTS "public"."work_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "product_name" "text" NOT NULL,
    "quantity" integer NOT NULL,
    "unit" "text" NOT NULL,
    "location" "text",
    "assignee" "text",
    "status" "text" NOT NULL,
    "due_date" timestamp with time zone NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "note" "text",
    "attachments" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "warehouse_id" "uuid",
    "task_type" "text",
    "process_stage" "text",
    "outbound_id" "uuid",
    "inbound_shipment_id" "uuid",
    "sla_due_at" timestamp with time zone,
    "priority" integer DEFAULT 3,
    CONSTRAINT "work_orders_status_check" CHECK (("status" = ANY (ARRAY['planned'::"text", 'in-progress'::"text", 'completed'::"text", 'overdue'::"text", 'on-hold'::"text"]))),
    CONSTRAINT "work_orders_type_check" CHECK (("type" = ANY (ARRAY['inbound'::"text", 'outbound'::"text", 'packing'::"text"])))
);


ALTER TABLE "public"."work_orders" OWNER TO "postgres";


COMMENT ON COLUMN "public"."work_orders"."task_type" IS 'PICK / PACK / PUTAWAY / COUNT / RETURN / PACK_JOB / INSPECTION';



COMMENT ON COLUMN "public"."work_orders"."process_stage" IS 'OUTBOUND_PICK / OUTBOUND_PACK / OUTBOUND_SHIP / INBOUND_RECEIVING / INBOUND_PUTAWAY';



CREATE TABLE IF NOT EXISTS "public"."work_task_action" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_order_id" "uuid" NOT NULL,
    "action_code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "seq_no" integer NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "completed_at" timestamp with time zone,
    "completed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."work_task_action" OWNER TO "postgres";


COMMENT ON TABLE "public"."work_task_action" IS '작업 액션 (단계별 체크리스트)';



ALTER TABLE ONLY "public"."audit_logs_archive"
    ADD CONSTRAINT "audit_logs_archive_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_invoice"
    ADD CONSTRAINT "billing_invoice_invoice_no_key" UNIQUE ("invoice_no");



ALTER TABLE ONLY "public"."billing_invoice_line"
    ADD CONSTRAINT "billing_invoice_line_billing_invoice_id_line_no_key" UNIQUE ("billing_invoice_id", "line_no");



ALTER TABLE ONLY "public"."billing_invoice_line"
    ADD CONSTRAINT "billing_invoice_line_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_invoice"
    ADD CONSTRAINT "billing_invoice_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand"
    ADD CONSTRAINT "brand_customer_master_id_code_key" UNIQUE ("customer_master_id", "code");



ALTER TABLE ONLY "public"."brand"
    ADD CONSTRAINT "brand_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_warehouse"
    ADD CONSTRAINT "brand_warehouse_brand_id_warehouse_id_key" UNIQUE ("brand_id", "warehouse_id");



ALTER TABLE ONLY "public"."brand_warehouse"
    ADD CONSTRAINT "brand_warehouse_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cs_alerts"
    ADD CONSTRAINT "cs_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cs_conversations"
    ADD CONSTRAINT "cs_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cs_glossary"
    ADD CONSTRAINT "cs_glossary_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cs_messages"
    ADD CONSTRAINT "cs_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cs_templates"
    ADD CONSTRAINT "cs_templates_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."cs_templates"
    ADD CONSTRAINT "cs_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cs_tickets"
    ADD CONSTRAINT "cs_tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cs_translate_logs"
    ADD CONSTRAINT "cs_translate_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_activity"
    ADD CONSTRAINT "customer_activity_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_contact"
    ADD CONSTRAINT "customer_contact_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_contract"
    ADD CONSTRAINT "customer_contract_contract_no_key" UNIQUE ("contract_no");



ALTER TABLE ONLY "public"."customer_contract"
    ADD CONSTRAINT "customer_contract_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_master"
    ADD CONSTRAINT "customer_master_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."customer_master"
    ADD CONSTRAINT "customer_master_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_pricing"
    ADD CONSTRAINT "customer_pricing_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_relationship"
    ADD CONSTRAINT "customer_relationship_parent_customer_id_child_customer_id__key" UNIQUE ("parent_customer_id", "child_customer_id", "relationship_type");



ALTER TABLE ONLY "public"."customer_relationship"
    ADD CONSTRAINT "customer_relationship_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_logs"
    ADD CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_templates"
    ADD CONSTRAINT "email_templates_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."email_templates"
    ADD CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."external_quote_inquiry"
    ADD CONSTRAINT "external_quote_inquiry_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inbound_events"
    ADD CONSTRAINT "inbound_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inbound_inspections"
    ADD CONSTRAINT "inbound_inspections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inbound_issues"
    ADD CONSTRAINT "inbound_issues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inbound_photo_slots"
    ADD CONSTRAINT "inbound_photo_slots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inbound_photo_slots"
    ADD CONSTRAINT "inbound_photo_slots_receipt_id_slot_key_key" UNIQUE ("receipt_id", "slot_key");



ALTER TABLE ONLY "public"."inbound_photos"
    ADD CONSTRAINT "inbound_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inbound_plan_lines"
    ADD CONSTRAINT "inbound_plan_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inbound_plan_lines"
    ADD CONSTRAINT "inbound_plan_lines_plan_id_product_id_lot_no_expiry_date_key" UNIQUE ("plan_id", "product_id", "lot_no", "expiry_date");



ALTER TABLE ONLY "public"."inbound_plans"
    ADD CONSTRAINT "inbound_plans_org_id_plan_no_key" UNIQUE ("org_id", "plan_no");



ALTER TABLE ONLY "public"."inbound_plans"
    ADD CONSTRAINT "inbound_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inbound_receipt_lines"
    ADD CONSTRAINT "inbound_receipt_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inbound_receipt_photo_requirements"
    ADD CONSTRAINT "inbound_receipt_photo_requirements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inbound_receipt_photo_requirements"
    ADD CONSTRAINT "inbound_receipt_photo_requirements_receipt_id_key" UNIQUE ("receipt_id");



ALTER TABLE ONLY "public"."inbound_receipt_shares"
    ADD CONSTRAINT "inbound_receipt_shares_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inbound_receipt_shares"
    ADD CONSTRAINT "inbound_receipt_shares_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."inbound_receipts"
    ADD CONSTRAINT "inbound_receipts_org_id_receipt_no_key" UNIQUE ("org_id", "receipt_no");



ALTER TABLE ONLY "public"."inbound_receipts"
    ADD CONSTRAINT "inbound_receipts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inbound_shipment_line"
    ADD CONSTRAINT "inbound_shipment_line_inbound_shipment_id_line_no_key" UNIQUE ("inbound_shipment_id", "line_no");



ALTER TABLE ONLY "public"."inbound_shipment_line"
    ADD CONSTRAINT "inbound_shipment_line_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inbound_shipment"
    ADD CONSTRAINT "inbound_shipment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inbound_shipment"
    ADD CONSTRAINT "inbound_shipment_ref_no_key" UNIQUE ("ref_no");



ALTER TABLE ONLY "public"."inbounds"
    ADD CONSTRAINT "inbounds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inquiry_action_logs"
    ADD CONSTRAINT "inquiry_action_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inquiry_notes"
    ADD CONSTRAINT "inquiry_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_import_runs"
    ADD CONSTRAINT "inventory_import_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_ledger"
    ADD CONSTRAINT "inventory_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_quantities"
    ADD CONSTRAINT "inventory_quantities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_quantities"
    ADD CONSTRAINT "inventory_quantities_warehouse_id_product_id_key" UNIQUE ("warehouse_id", "product_id");



ALTER TABLE ONLY "public"."inventory_snapshot"
    ADD CONSTRAINT "inventory_snapshot_pkey" PRIMARY KEY ("snapshot_date", "tenant_id", "product_id");



ALTER TABLE ONLY "public"."inventory_transaction"
    ADD CONSTRAINT "inventory_transaction_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_volume_raw"
    ADD CONSTRAINT "inventory_volume_raw_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_volume_share"
    ADD CONSTRAINT "inventory_volume_share_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_volume_share"
    ADD CONSTRAINT "inventory_volume_share_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_warehouse_id_location_id_product_id_owner_brand_i_key" UNIQUE ("warehouse_id", "location_id", "product_id", "owner_brand_id", "uom_code", "lot_no");



ALTER TABLE ONLY "public"."location"
    ADD CONSTRAINT "location_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."location"
    ADD CONSTRAINT "location_warehouse_id_code_key" UNIQUE ("warehouse_id", "code");



ALTER TABLE ONLY "public"."logistics_api_logs"
    ADD CONSTRAINT "logistics_api_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."my_tasks"
    ADD CONSTRAINT "my_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_rules"
    ADD CONSTRAINT "notification_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_receivers"
    ADD CONSTRAINT "order_receivers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_senders"
    ADD CONSTRAINT "order_senders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_status_history"
    ADD CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_order_no_key" UNIQUE ("order_no");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org"
    ADD CONSTRAINT "org_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."org"
    ADD CONSTRAINT "org_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."outbound_order_line"
    ADD CONSTRAINT "outbound_order_line_outbound_id_line_no_key" UNIQUE ("outbound_id", "line_no");



ALTER TABLE ONLY "public"."outbound_order_line"
    ADD CONSTRAINT "outbound_order_line_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."outbounds"
    ADD CONSTRAINT "outbounds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pack_job_component"
    ADD CONSTRAINT "pack_job_component_pack_job_id_component_product_id_key" UNIQUE ("pack_job_id", "component_product_id");



ALTER TABLE ONLY "public"."pack_job_component"
    ADD CONSTRAINT "pack_job_component_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pack_job"
    ADD CONSTRAINT "pack_job_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parcel_shipment"
    ADD CONSTRAINT "parcel_shipment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parcel_shipment"
    ADD CONSTRAINT "parcel_shipment_tracking_no_key" UNIQUE ("tracking_no");



ALTER TABLE ONLY "public"."partners"
    ADD CONSTRAINT "partners_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."partners"
    ADD CONSTRAINT "partners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."photo_guide_slots"
    ADD CONSTRAINT "photo_guide_slots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."photo_guide_slots"
    ADD CONSTRAINT "photo_guide_slots_template_id_slot_key_key" UNIQUE ("template_id", "slot_key");



ALTER TABLE ONLY "public"."photo_guide_templates"
    ADD CONSTRAINT "photo_guide_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."api_rate_limits"
    ADD CONSTRAINT "pk_api_rate_limits" PRIMARY KEY ("scope", "actor_key", "window_start");



ALTER TABLE ONLY "public"."product_barcodes"
    ADD CONSTRAINT "product_barcodes_org_id_barcode_key" UNIQUE ("org_id", "barcode");



ALTER TABLE ONLY "public"."product_barcodes"
    ADD CONSTRAINT "product_barcodes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_barcodes"
    ADD CONSTRAINT "product_barcodes_product_id_barcode_barcode_type_key" UNIQUE ("product_id", "barcode", "barcode_type");



ALTER TABLE ONLY "public"."product_bom"
    ADD CONSTRAINT "product_bom_kit_product_id_component_product_id_key" UNIQUE ("kit_product_id", "component_product_id");



ALTER TABLE ONLY "public"."product_bom"
    ADD CONSTRAINT "product_bom_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_categories"
    ADD CONSTRAINT "product_categories_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."product_uom"
    ADD CONSTRAINT "product_uom_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_uom"
    ADD CONSTRAINT "product_uom_product_id_uom_code_key" UNIQUE ("product_id", "uom_code");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_sku_key" UNIQUE ("sku");



ALTER TABLE ONLY "public"."quote_calculations"
    ADD CONSTRAINT "quote_calculations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quote_pricing_rules"
    ADD CONSTRAINT "quote_pricing_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."receipt_documents"
    ADD CONSTRAINT "receipt_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."return_order_line"
    ADD CONSTRAINT "return_order_line_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."return_order_line"
    ADD CONSTRAINT "return_order_line_return_order_id_line_no_key" UNIQUE ("return_order_id", "line_no");



ALTER TABLE ONLY "public"."return_order"
    ADD CONSTRAINT "return_order_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shipping_account"
    ADD CONSTRAINT "shipping_account_carrier_id_account_code_key" UNIQUE ("carrier_id", "account_code");



ALTER TABLE ONLY "public"."shipping_account"
    ADD CONSTRAINT "shipping_account_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shipping_carrier"
    ADD CONSTRAINT "shipping_carrier_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."shipping_carrier"
    ADD CONSTRAINT "shipping_carrier_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_transfer_line"
    ADD CONSTRAINT "stock_transfer_line_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_transfer_line"
    ADD CONSTRAINT "stock_transfer_line_stock_transfer_id_line_no_key" UNIQUE ("stock_transfer_id", "line_no");



ALTER TABLE ONLY "public"."stock_transfer"
    ADD CONSTRAINT "stock_transfer_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_transfer"
    ADD CONSTRAINT "stock_transfer_ref_no_key" UNIQUE ("ref_no");



ALTER TABLE ONLY "public"."store"
    ADD CONSTRAINT "store_brand_id_platform_external_store_id_key" UNIQUE ("brand_id", "platform", "external_store_id");



ALTER TABLE ONLY "public"."store"
    ADD CONSTRAINT "store_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_alert"
    ADD CONSTRAINT "system_alert_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_announcements"
    ADD CONSTRAINT "system_announcements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."warehouse"
    ADD CONSTRAINT "warehouse_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."warehouse"
    ADD CONSTRAINT "warehouse_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_task_action"
    ADD CONSTRAINT "work_task_action_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_action_logs_action" ON "public"."inquiry_action_logs" USING "btree" ("action");



CREATE INDEX "idx_action_logs_actor" ON "public"."inquiry_action_logs" USING "btree" ("actor_id");



CREATE INDEX "idx_action_logs_inquiry" ON "public"."inquiry_action_logs" USING "btree" ("inquiry_id", "inquiry_type", "created_at" DESC);



CREATE INDEX "idx_api_rate_limits_updated_at" ON "public"."api_rate_limits" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_audit_logs_archive_archived_at_desc" ON "public"."audit_logs_archive" USING "btree" ("archived_at" DESC);



CREATE INDEX "idx_audit_logs_archive_created_at_desc" ON "public"."audit_logs_archive" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_audit_logs_created_at_desc" ON "public"."audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_billing_invoice_brand_id" ON "public"."billing_invoice" USING "btree" ("brand_id");



CREATE INDEX "idx_billing_invoice_customer_master_id" ON "public"."billing_invoice" USING "btree" ("customer_master_id");



CREATE INDEX "idx_billing_invoice_invoice_no" ON "public"."billing_invoice" USING "btree" ("invoice_no");



CREATE INDEX "idx_billing_invoice_period" ON "public"."billing_invoice" USING "btree" ("period_from", "period_to");



CREATE INDEX "idx_billing_invoice_status" ON "public"."billing_invoice" USING "btree" ("status");



CREATE INDEX "idx_brand_code" ON "public"."brand" USING "btree" ("code");



CREATE INDEX "idx_brand_customer_master_id" ON "public"."brand" USING "btree" ("customer_master_id");



CREATE INDEX "idx_brand_status" ON "public"."brand" USING "btree" ("status");



CREATE INDEX "idx_brand_warehouse_brand_id" ON "public"."brand_warehouse" USING "btree" ("brand_id");



CREATE INDEX "idx_brand_warehouse_warehouse_id" ON "public"."brand_warehouse" USING "btree" ("warehouse_id");



CREATE INDEX "idx_cs_alerts_created_at" ON "public"."cs_alerts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_cs_alerts_partner_id" ON "public"."cs_alerts" USING "btree" ("partner_id");



CREATE INDEX "idx_cs_alerts_status" ON "public"."cs_alerts" USING "btree" ("status");



CREATE INDEX "idx_cs_alerts_type" ON "public"."cs_alerts" USING "btree" ("type");



CREATE INDEX "idx_cs_conversations_created_at" ON "public"."cs_conversations" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_cs_conversations_partner_id" ON "public"."cs_conversations" USING "btree" ("partner_id");



CREATE INDEX "idx_cs_conversations_status" ON "public"."cs_conversations" USING "btree" ("status");



CREATE INDEX "idx_cs_glossary_active" ON "public"."cs_glossary" USING "btree" ("active");



CREATE INDEX "idx_cs_glossary_priority" ON "public"."cs_glossary" USING "btree" ("priority" DESC);



CREATE INDEX "idx_cs_messages_convo_id" ON "public"."cs_messages" USING "btree" ("convo_id");



CREATE INDEX "idx_cs_messages_created_at" ON "public"."cs_messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_cs_messages_intent" ON "public"."cs_messages" USING "btree" ("intent");



CREATE INDEX "idx_cs_messages_role" ON "public"."cs_messages" USING "btree" ("role");



CREATE INDEX "idx_cs_templates_key" ON "public"."cs_templates" USING "btree" ("key");



CREATE INDEX "idx_cs_templates_lang" ON "public"."cs_templates" USING "btree" ("lang");



CREATE INDEX "idx_cs_tickets_assignee" ON "public"."cs_tickets" USING "btree" ("assignee");



CREATE INDEX "idx_cs_tickets_conversation_id_fk" ON "public"."cs_tickets" USING "btree" ("conversation_id");



CREATE INDEX "idx_cs_tickets_created_at" ON "public"."cs_tickets" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_cs_tickets_partner_id" ON "public"."cs_tickets" USING "btree" ("partner_id");



CREATE INDEX "idx_cs_tickets_priority" ON "public"."cs_tickets" USING "btree" ("priority");



CREATE INDEX "idx_cs_tickets_status" ON "public"."cs_tickets" USING "btree" ("status");



CREATE INDEX "idx_cs_translate_logs_created_at" ON "public"."cs_translate_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_cs_translate_logs_user_id" ON "public"."cs_translate_logs" USING "btree" ("user_id");



CREATE INDEX "idx_customer_activity_contact" ON "public"."customer_activity" USING "btree" ("related_contact_id");



CREATE INDEX "idx_customer_activity_customer_id" ON "public"."customer_activity" USING "btree" ("customer_master_id");



CREATE INDEX "idx_customer_activity_date" ON "public"."customer_activity" USING "btree" ("activity_date" DESC);



CREATE INDEX "idx_customer_activity_followup" ON "public"."customer_activity" USING "btree" ("requires_followup", "followup_completed") WHERE ("requires_followup" = true);



CREATE INDEX "idx_customer_activity_priority" ON "public"."customer_activity" USING "btree" ("priority");



CREATE INDEX "idx_customer_activity_tags" ON "public"."customer_activity" USING "gin" ("tags");



CREATE INDEX "idx_customer_activity_type" ON "public"."customer_activity" USING "btree" ("activity_type");



CREATE INDEX "idx_customer_contact_customer_id" ON "public"."customer_contact" USING "btree" ("customer_master_id");



CREATE INDEX "idx_customer_contact_email" ON "public"."customer_contact" USING "btree" ("email");



CREATE INDEX "idx_customer_contact_is_active" ON "public"."customer_contact" USING "btree" ("is_active");



CREATE INDEX "idx_customer_contact_is_primary" ON "public"."customer_contact" USING "btree" ("is_primary");



CREATE INDEX "idx_customer_contact_role" ON "public"."customer_contact" USING "btree" ("role");



CREATE INDEX "idx_customer_contract_customer_id" ON "public"."customer_contract" USING "btree" ("customer_master_id");



CREATE INDEX "idx_customer_contract_dates" ON "public"."customer_contract" USING "btree" ("contract_start", "contract_end");



CREATE INDEX "idx_customer_contract_expiring" ON "public"."customer_contract" USING "btree" ("contract_end") WHERE (("status" = 'ACTIVE'::"text") AND ("contract_end" IS NOT NULL));



CREATE INDEX "idx_customer_contract_no" ON "public"."customer_contract" USING "btree" ("contract_no");



CREATE INDEX "idx_customer_contract_parent_contract_id_fk" ON "public"."customer_contract" USING "btree" ("parent_contract_id");



CREATE INDEX "idx_customer_contract_replaced_by_contract_id_fk" ON "public"."customer_contract" USING "btree" ("replaced_by_contract_id");



CREATE INDEX "idx_customer_contract_status" ON "public"."customer_contract" USING "btree" ("status");



CREATE INDEX "idx_customer_contract_type" ON "public"."customer_contract" USING "btree" ("contract_type");



CREATE INDEX "idx_customer_master_code" ON "public"."customer_master" USING "btree" ("code");



CREATE INDEX "idx_customer_master_org_id" ON "public"."customer_master" USING "btree" ("org_id");



CREATE INDEX "idx_customer_master_status" ON "public"."customer_master" USING "btree" ("status");



CREATE INDEX "idx_customer_master_type" ON "public"."customer_master" USING "btree" ("type");



CREATE INDEX "idx_customer_pricing_active" ON "public"."customer_pricing" USING "btree" ("is_active");



CREATE INDEX "idx_customer_pricing_customer_id" ON "public"."customer_pricing" USING "btree" ("customer_master_id");



CREATE INDEX "idx_customer_pricing_effective" ON "public"."customer_pricing" USING "btree" ("effective_from", "effective_to");



CREATE INDEX "idx_customer_pricing_org_id" ON "public"."customer_pricing" USING "btree" ("org_id");



CREATE INDEX "idx_customer_pricing_type" ON "public"."customer_pricing" USING "btree" ("pricing_type");



CREATE INDEX "idx_customer_relationship_active" ON "public"."customer_relationship" USING "btree" ("is_active");



CREATE INDEX "idx_customer_relationship_child" ON "public"."customer_relationship" USING "btree" ("child_customer_id");



CREATE INDEX "idx_customer_relationship_parent" ON "public"."customer_relationship" USING "btree" ("parent_customer_id");



CREATE INDEX "idx_customer_relationship_type" ON "public"."customer_relationship" USING "btree" ("relationship_type");



CREATE INDEX "idx_email_logs_inquiry" ON "public"."email_logs" USING "btree" ("inquiry_id", "inquiry_type");



CREATE INDEX "idx_email_logs_sent_by" ON "public"."email_logs" USING "btree" ("sent_by");



CREATE INDEX "idx_email_logs_status" ON "public"."email_logs" USING "btree" ("status", "created_at");



CREATE INDEX "idx_email_logs_template_id_fk" ON "public"."email_logs" USING "btree" ("template_id");



CREATE INDEX "idx_email_templates_active" ON "public"."email_templates" USING "btree" ("is_active");



CREATE INDEX "idx_email_templates_created_by_fk" ON "public"."email_templates" USING "btree" ("created_by");



CREATE INDEX "idx_email_templates_trigger" ON "public"."email_templates" USING "btree" ("trigger_event", "trigger_status");



CREATE INDEX "idx_email_templates_updated_by_fk" ON "public"."email_templates" USING "btree" ("updated_by");



CREATE INDEX "idx_external_quote_converted_customer" ON "public"."external_quote_inquiry" USING "btree" ("converted_customer_id");



CREATE INDEX "idx_external_quote_inquiry_assigned_to" ON "public"."external_quote_inquiry" USING "btree" ("assigned_to");



CREATE INDEX "idx_external_quote_inquiry_created_at" ON "public"."external_quote_inquiry" USING "btree" ("created_at");



CREATE INDEX "idx_external_quote_inquiry_source" ON "public"."external_quote_inquiry" USING "btree" ("source");



CREATE INDEX "idx_external_quote_inquiry_status" ON "public"."external_quote_inquiry" USING "btree" ("status");



CREATE INDEX "idx_external_quote_sales_stage" ON "public"."external_quote_inquiry" USING "btree" ("sales_stage");



CREATE INDEX "idx_inbound_events_actor_id_fk" ON "public"."inbound_events" USING "btree" ("actor_id");



CREATE INDEX "idx_inbound_inspections_inbound_id_fk" ON "public"."inbound_inspections" USING "btree" ("inbound_id");



CREATE INDEX "idx_inbound_inspections_org_id_fk" ON "public"."inbound_inspections" USING "btree" ("org_id");



CREATE INDEX "idx_inbound_inspections_product_id_fk" ON "public"."inbound_inspections" USING "btree" ("product_id");



CREATE INDEX "idx_inbound_issues_created_by_fk" ON "public"."inbound_issues" USING "btree" ("created_by");



CREATE INDEX "idx_inbound_issues_line_id_fk" ON "public"."inbound_issues" USING "btree" ("line_id");



CREATE INDEX "idx_inbound_issues_resolved_by_fk" ON "public"."inbound_issues" USING "btree" ("resolved_by");



CREATE INDEX "idx_inbound_photos_line_id_fk" ON "public"."inbound_photos" USING "btree" ("line_id");



CREATE INDEX "idx_inbound_photos_uploaded_by_fk" ON "public"."inbound_photos" USING "btree" ("uploaded_by");



CREATE INDEX "idx_inbound_plan_lines_plan_product" ON "public"."inbound_plan_lines" USING "btree" ("plan_id", "product_id");



CREATE INDEX "idx_inbound_plan_lines_product_id_fk" ON "public"."inbound_plan_lines" USING "btree" ("product_id");



CREATE INDEX "idx_inbound_plans_client_id_fk" ON "public"."inbound_plans" USING "btree" ("client_id");



CREATE INDEX "idx_inbound_plans_created_by_fk" ON "public"."inbound_plans" USING "btree" ("created_by");



CREATE INDEX "idx_inbound_receipt_lines_inspected_by_fk" ON "public"."inbound_receipt_lines" USING "btree" ("inspected_by");



CREATE INDEX "idx_inbound_receipt_lines_plan_line_id_fk" ON "public"."inbound_receipt_lines" USING "btree" ("plan_line_id");



CREATE INDEX "idx_inbound_receipt_photo_requirements_template_id_fk" ON "public"."inbound_receipt_photo_requirements" USING "btree" ("template_id");



CREATE INDEX "idx_inbound_receipt_shares_created_by_fk" ON "public"."inbound_receipt_shares" USING "btree" ("created_by");



CREATE INDEX "idx_inbound_receipts_client_id_fk" ON "public"."inbound_receipts" USING "btree" ("client_id");



CREATE INDEX "idx_inbound_receipts_confirmed_by_fk" ON "public"."inbound_receipts" USING "btree" ("confirmed_by");



CREATE INDEX "idx_inbound_receipts_created_by_fk" ON "public"."inbound_receipts" USING "btree" ("created_by");



CREATE INDEX "idx_inbound_receipts_status_plan" ON "public"."inbound_receipts" USING "btree" ("status", "plan_id");



CREATE INDEX "idx_inbound_receipts_warehouse_id_fk" ON "public"."inbound_receipts" USING "btree" ("warehouse_id");



CREATE INDEX "idx_inbound_shipment_eta" ON "public"."inbound_shipment" USING "btree" ("eta");



CREATE INDEX "idx_inbound_shipment_line_product_id" ON "public"."inbound_shipment_line" USING "btree" ("product_id");



CREATE INDEX "idx_inbound_shipment_owner_brand_id" ON "public"."inbound_shipment" USING "btree" ("owner_brand_id");



CREATE INDEX "idx_inbound_shipment_status" ON "public"."inbound_shipment" USING "btree" ("status");



CREATE INDEX "idx_inbound_shipment_supplier_customer_id_fk" ON "public"."inbound_shipment" USING "btree" ("supplier_customer_id");



CREATE INDEX "idx_inbound_shipment_warehouse_id" ON "public"."inbound_shipment" USING "btree" ("warehouse_id");



CREATE INDEX "idx_inbounds_date" ON "public"."inbounds" USING "btree" ("inbound_date");



CREATE INDEX "idx_inbounds_product_id_fk" ON "public"."inbounds" USING "btree" ("product_id");



CREATE INDEX "idx_inbounds_supplier_id_fk" ON "public"."inbounds" USING "btree" ("supplier_id");



CREATE INDEX "idx_inquiry_notes_admin" ON "public"."inquiry_notes" USING "btree" ("admin_id");



CREATE INDEX "idx_inquiry_notes_created_at" ON "public"."inquiry_notes" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_inquiry_notes_inquiry" ON "public"."inquiry_notes" USING "btree" ("inquiry_id", "inquiry_type");



CREATE INDEX "idx_inventory_import_runs_requested_by_fk" ON "public"."inventory_import_runs" USING "btree" ("requested_by");



CREATE INDEX "idx_inventory_import_runs_tenant_created" ON "public"."inventory_import_runs" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_inventory_ledger_created_at" ON "public"."inventory_ledger" USING "btree" ("created_at");



CREATE INDEX "idx_inventory_ledger_created_by_fk" ON "public"."inventory_ledger" USING "btree" ("created_by");



CREATE INDEX "idx_inventory_ledger_product" ON "public"."inventory_ledger" USING "btree" ("product_id");



CREATE INDEX "idx_inventory_ledger_tenant_movement_created" ON "public"."inventory_ledger" USING "btree" ("tenant_id", "movement_type", "created_at" DESC);



CREATE INDEX "idx_inventory_ledger_tenant_product_created" ON "public"."inventory_ledger" USING "btree" ("tenant_id", "product_id", "created_at" DESC);



CREATE INDEX "idx_inventory_ledger_warehouse" ON "public"."inventory_ledger" USING "btree" ("warehouse_id");



CREATE INDEX "idx_inventory_location_id" ON "public"."inventory" USING "btree" ("location_id");



CREATE INDEX "idx_inventory_owner_brand_id" ON "public"."inventory" USING "btree" ("owner_brand_id");



CREATE INDEX "idx_inventory_product_id" ON "public"."inventory" USING "btree" ("product_id");



CREATE INDEX "idx_inventory_quantities_product_id" ON "public"."inventory_quantities" USING "btree" ("product_id");



CREATE INDEX "idx_inventory_snapshot_product_id_fk" ON "public"."inventory_snapshot" USING "btree" ("product_id");



CREATE INDEX "idx_inventory_snapshot_tenant_product" ON "public"."inventory_snapshot" USING "btree" ("tenant_id", "product_id", "snapshot_date" DESC);



CREATE INDEX "idx_inventory_status" ON "public"."inventory" USING "btree" ("status");



CREATE INDEX "idx_inventory_transaction_from_location_id_fk" ON "public"."inventory_transaction" USING "btree" ("from_location_id");



CREATE INDEX "idx_inventory_transaction_location_id_fk" ON "public"."inventory_transaction" USING "btree" ("location_id");



CREATE INDEX "idx_inventory_transaction_owner_brand_id_fk" ON "public"."inventory_transaction" USING "btree" ("owner_brand_id");



CREATE INDEX "idx_inventory_transaction_performed_at" ON "public"."inventory_transaction" USING "btree" ("performed_at" DESC);



CREATE INDEX "idx_inventory_transaction_product_id" ON "public"."inventory_transaction" USING "btree" ("product_id");



CREATE INDEX "idx_inventory_transaction_ref" ON "public"."inventory_transaction" USING "btree" ("ref_type", "ref_id");



CREATE INDEX "idx_inventory_transaction_to_location_id_fk" ON "public"."inventory_transaction" USING "btree" ("to_location_id");



CREATE INDEX "idx_inventory_transaction_type" ON "public"."inventory_transaction" USING "btree" ("transaction_type");



CREATE INDEX "idx_inventory_transaction_warehouse_id" ON "public"."inventory_transaction" USING "btree" ("warehouse_id");



CREATE INDEX "idx_inventory_volume_raw_customer_date" ON "public"."inventory_volume_raw" USING "btree" ("customer_id", "record_date" DESC, "created_at" DESC);



CREATE INDEX "idx_inventory_volume_raw_item_name" ON "public"."inventory_volume_raw" USING "btree" ("item_name");



CREATE INDEX "idx_inventory_volume_raw_uploaded_by_fk" ON "public"."inventory_volume_raw" USING "btree" ("uploaded_by");



CREATE INDEX "idx_inventory_volume_share_created_by_fk" ON "public"."inventory_volume_share" USING "btree" ("created_by");



CREATE INDEX "idx_inventory_volume_share_customer_created" ON "public"."inventory_volume_share" USING "btree" ("customer_id", "created_at" DESC);



CREATE INDEX "idx_inventory_warehouse_id" ON "public"."inventory" USING "btree" ("warehouse_id");



CREATE INDEX "idx_location_status" ON "public"."location" USING "btree" ("status");



CREATE INDEX "idx_location_type" ON "public"."location" USING "btree" ("type");



CREATE INDEX "idx_location_warehouse_id" ON "public"."location" USING "btree" ("warehouse_id");



CREATE INDEX "idx_location_zone" ON "public"."location" USING "btree" ("zone");



CREATE INDEX "idx_logistics_api_logs_order_id" ON "public"."logistics_api_logs" USING "btree" ("order_id");



CREATE INDEX "idx_my_tasks_status" ON "public"."my_tasks" USING "btree" ("status");



CREATE INDEX "idx_my_tasks_work_order_id_fk" ON "public"."my_tasks" USING "btree" ("work_order_id");



CREATE INDEX "idx_notification_rules_active" ON "public"."notification_rules" USING "btree" ("is_active", "trigger_event");



CREATE INDEX "idx_notification_rules_created_by_fk" ON "public"."notification_rules" USING "btree" ("created_by");



CREATE INDEX "idx_notification_rules_email_template_id_fk" ON "public"."notification_rules" USING "btree" ("email_template_id");



CREATE INDEX "idx_notification_rules_updated_by_fk" ON "public"."notification_rules" USING "btree" ("updated_by");



CREATE INDEX "idx_notifications_action" ON "public"."notifications" USING "btree" ("action");



CREATE INDEX "idx_notifications_action_created_at_desc" ON "public"."notifications" USING "btree" ("action", "created_at" DESC);



CREATE INDEX "idx_notifications_inquiry" ON "public"."notifications" USING "btree" ("inquiry_id", "inquiry_type");



CREATE INDEX "idx_notifications_inquiry_created_at_desc" ON "public"."notifications" USING "btree" ("inquiry_id", "inquiry_type", "created_at" DESC);



CREATE INDEX "idx_notifications_user" ON "public"."notifications" USING "btree" ("user_id", "is_read", "created_at" DESC);



CREATE INDEX "idx_notifications_user_created_at_desc" ON "public"."notifications" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_notifications_user_is_read_created_at_desc" ON "public"."notifications" USING "btree" ("user_id", "is_read", "created_at" DESC);



CREATE INDEX "idx_notifications_user_unread_created_at_desc" ON "public"."notifications" USING "btree" ("user_id", "created_at" DESC) WHERE ("is_read" = false);



CREATE INDEX "idx_order_receivers_order_id" ON "public"."order_receivers" USING "btree" ("order_id");



CREATE INDEX "idx_order_status_history_order_id_fk" ON "public"."order_status_history" USING "btree" ("order_id");



CREATE INDEX "idx_orders_created_at" ON "public"."orders" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_orders_logistics_company" ON "public"."orders" USING "btree" ("logistics_company");



CREATE INDEX "idx_orders_order_no" ON "public"."orders" USING "btree" ("order_no");



CREATE INDEX "idx_orders_partner_id" ON "public"."orders" USING "btree" ("partner_id");



CREATE INDEX "idx_orders_status" ON "public"."orders" USING "btree" ("status");



CREATE INDEX "idx_outbound_order_line_product_id" ON "public"."outbound_order_line" USING "btree" ("product_id");



CREATE INDEX "idx_outbounds_brand_id" ON "public"."outbounds" USING "btree" ("brand_id");



CREATE INDEX "idx_outbounds_channel_order_no" ON "public"."outbounds" USING "btree" ("channel_order_no");



CREATE INDEX "idx_outbounds_client_order_no" ON "public"."outbounds" USING "btree" ("client_order_no");



CREATE INDEX "idx_outbounds_customer_id_fk" ON "public"."outbounds" USING "btree" ("customer_id");



CREATE INDEX "idx_outbounds_date" ON "public"."outbounds" USING "btree" ("outbound_date");



CREATE INDEX "idx_outbounds_order_type" ON "public"."outbounds" USING "btree" ("order_type");



CREATE INDEX "idx_outbounds_product_id_fk" ON "public"."outbounds" USING "btree" ("product_id");



CREATE INDEX "idx_outbounds_store_id" ON "public"."outbounds" USING "btree" ("store_id");



CREATE INDEX "idx_outbounds_tracking_no" ON "public"."outbounds" USING "btree" ("tracking_no");



CREATE INDEX "idx_outbounds_warehouse_id" ON "public"."outbounds" USING "btree" ("warehouse_id");



CREATE INDEX "idx_pack_job_component_component_product_id_fk" ON "public"."pack_job_component" USING "btree" ("component_product_id");



CREATE INDEX "idx_pack_job_from_location_id_fk" ON "public"."pack_job" USING "btree" ("from_location_id");



CREATE INDEX "idx_pack_job_kit_product_id" ON "public"."pack_job" USING "btree" ("kit_product_id");



CREATE INDEX "idx_pack_job_owner_brand_id" ON "public"."pack_job" USING "btree" ("owner_brand_id");



CREATE INDEX "idx_pack_job_status" ON "public"."pack_job" USING "btree" ("status");



CREATE INDEX "idx_pack_job_to_location_id_fk" ON "public"."pack_job" USING "btree" ("to_location_id");



CREATE INDEX "idx_pack_job_warehouse_id" ON "public"."pack_job" USING "btree" ("warehouse_id");



CREATE INDEX "idx_parcel_shipment_billing_status" ON "public"."parcel_shipment" USING "btree" ("billing_status");



CREATE INDEX "idx_parcel_shipment_brand_id" ON "public"."parcel_shipment" USING "btree" ("brand_id");



CREATE INDEX "idx_parcel_shipment_outbound_id" ON "public"."parcel_shipment" USING "btree" ("outbound_id");



CREATE INDEX "idx_parcel_shipment_ship_date" ON "public"."parcel_shipment" USING "btree" ("ship_date" DESC);



CREATE INDEX "idx_parcel_shipment_shipping_account_id" ON "public"."parcel_shipment" USING "btree" ("shipping_account_id");



CREATE INDEX "idx_parcel_shipment_status" ON "public"."parcel_shipment" USING "btree" ("status");



CREATE INDEX "idx_parcel_shipment_store_id" ON "public"."parcel_shipment" USING "btree" ("store_id");



CREATE INDEX "idx_parcel_shipment_tracking_no" ON "public"."parcel_shipment" USING "btree" ("tracking_no");



CREATE INDEX "idx_parcel_shipment_warehouse_id" ON "public"."parcel_shipment" USING "btree" ("warehouse_id");



CREATE INDEX "idx_pricing_rules_active" ON "public"."quote_pricing_rules" USING "btree" ("is_active", "priority" DESC);



CREATE INDEX "idx_product_bom_component_product_id" ON "public"."product_bom" USING "btree" ("component_product_id");



CREATE INDEX "idx_product_bom_kit_product_id" ON "public"."product_bom" USING "btree" ("kit_product_id");



CREATE INDEX "idx_product_uom_product_id" ON "public"."product_uom" USING "btree" ("product_id");



CREATE INDEX "idx_products_barcode" ON "public"."products" USING "btree" ("barcode");



CREATE INDEX "idx_products_barcode_trgm" ON "public"."products" USING "gin" ("barcode" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_products_brand_id" ON "public"."products" USING "btree" ("brand_id");



CREATE INDEX "idx_products_category" ON "public"."products" USING "btree" ("category");



CREATE INDEX "idx_products_created_at_desc" ON "public"."products" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_products_customer_id" ON "public"."products" USING "btree" ("customer_id");



CREATE INDEX "idx_products_min_stock_positive" ON "public"."products" USING "btree" ("min_stock") WHERE ("min_stock" > 0);



CREATE INDEX "idx_products_name_trgm" ON "public"."products" USING "gin" ("name" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_products_partner_id" ON "public"."products" USING "btree" ("partner_id");



CREATE UNIQUE INDEX "idx_products_product_db_no" ON "public"."products" USING "btree" ("product_db_no");



CREATE INDEX "idx_products_product_type" ON "public"."products" USING "btree" ("product_type");



CREATE INDEX "idx_products_sku" ON "public"."products" USING "btree" ("sku");



CREATE INDEX "idx_products_sku_trgm" ON "public"."products" USING "gin" ("sku" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_products_status" ON "public"."products" USING "btree" ("status");



CREATE INDEX "idx_products_status_created_at_desc" ON "public"."products" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_quote_calculations_calculated_by_fk" ON "public"."quote_calculations" USING "btree" ("calculated_by");



CREATE INDEX "idx_quote_calculations_inquiry" ON "public"."quote_calculations" USING "btree" ("inquiry_id", "inquiry_type");



CREATE INDEX "idx_quote_calculations_pricing_rule_id_fk" ON "public"."quote_calculations" USING "btree" ("pricing_rule_id");



CREATE INDEX "idx_quote_calculations_sent" ON "public"."quote_calculations" USING "btree" ("is_sent", "sent_at");



CREATE INDEX "idx_quote_pricing_rules_created_by_fk" ON "public"."quote_pricing_rules" USING "btree" ("created_by");



CREATE INDEX "idx_quote_pricing_rules_updated_by_fk" ON "public"."quote_pricing_rules" USING "btree" ("updated_by");



CREATE INDEX "idx_receipt_documents_created_by_fk" ON "public"."receipt_documents" USING "btree" ("created_by");



CREATE INDEX "idx_return_order_brand_id" ON "public"."return_order" USING "btree" ("brand_id");



CREATE INDEX "idx_return_order_line_product_id" ON "public"."return_order_line" USING "btree" ("product_id");



CREATE INDEX "idx_return_order_outbound_id" ON "public"."return_order" USING "btree" ("outbound_id");



CREATE INDEX "idx_return_order_status" ON "public"."return_order" USING "btree" ("status");



CREATE INDEX "idx_return_order_store_id" ON "public"."return_order" USING "btree" ("store_id");



CREATE INDEX "idx_return_order_tracking_no" ON "public"."return_order" USING "btree" ("tracking_no");



CREATE INDEX "idx_return_order_warehouse_id" ON "public"."return_order" USING "btree" ("warehouse_id");



CREATE INDEX "idx_shipping_account_carrier_id" ON "public"."shipping_account" USING "btree" ("carrier_id");



CREATE INDEX "idx_shipping_account_customer_master_id" ON "public"."shipping_account" USING "btree" ("customer_master_id");



CREATE INDEX "idx_shipping_account_status" ON "public"."shipping_account" USING "btree" ("status");



CREATE INDEX "idx_shipping_carrier_code" ON "public"."shipping_carrier" USING "btree" ("code");



CREATE INDEX "idx_shipping_carrier_status" ON "public"."shipping_carrier" USING "btree" ("status");



CREATE INDEX "idx_stock_transfer_from_warehouse" ON "public"."stock_transfer" USING "btree" ("from_warehouse_id");



CREATE INDEX "idx_stock_transfer_status" ON "public"."stock_transfer" USING "btree" ("status");



CREATE INDEX "idx_stock_transfer_to_warehouse" ON "public"."stock_transfer" USING "btree" ("to_warehouse_id");



CREATE INDEX "idx_store_brand_id" ON "public"."store" USING "btree" ("brand_id");



CREATE INDEX "idx_store_platform" ON "public"."store" USING "btree" ("platform");



CREATE INDEX "idx_store_status" ON "public"."store" USING "btree" ("status");



CREATE INDEX "idx_system_alert_alert_type" ON "public"."system_alert" USING "btree" ("alert_type");



CREATE INDEX "idx_system_alert_brand_id" ON "public"."system_alert" USING "btree" ("brand_id");



CREATE INDEX "idx_system_alert_created_at" ON "public"."system_alert" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_system_alert_severity" ON "public"."system_alert" USING "btree" ("severity");



CREATE INDEX "idx_system_alert_status" ON "public"."system_alert" USING "btree" ("status");



CREATE INDEX "idx_system_alert_warehouse_id" ON "public"."system_alert" USING "btree" ("warehouse_id");



CREATE INDEX "idx_system_announcements_active" ON "public"."system_announcements" USING "btree" ("is_active");



CREATE INDEX "idx_system_announcements_window" ON "public"."system_announcements" USING "btree" ("starts_at", "ends_at");



CREATE INDEX "idx_user_profiles_deleted_at" ON "public"."user_profiles" USING "btree" ("deleted_at");



CREATE INDEX "idx_user_profiles_email" ON "public"."user_profiles" USING "btree" ("email");



CREATE INDEX "idx_user_profiles_locked_until" ON "public"."user_profiles" USING "btree" ("locked_until");



CREATE INDEX "idx_user_profiles_org_id" ON "public"."user_profiles" USING "btree" ("org_id");



CREATE INDEX "idx_user_profiles_partner_id" ON "public"."user_profiles" USING "btree" ("partner_id");



CREATE INDEX "idx_user_profiles_role" ON "public"."user_profiles" USING "btree" ("role");



CREATE INDEX "idx_user_profiles_status" ON "public"."user_profiles" USING "btree" ("status");



CREATE INDEX "idx_users_partner_id" ON "public"."users" USING "btree" ("partner_id");



CREATE INDEX "idx_warehouse_code" ON "public"."warehouse" USING "btree" ("code");



CREATE INDEX "idx_warehouse_operator_customer_id_fk" ON "public"."warehouse" USING "btree" ("operator_customer_id");



CREATE INDEX "idx_warehouse_org_id" ON "public"."warehouse" USING "btree" ("org_id");



CREATE INDEX "idx_warehouse_owner_customer_id_fk" ON "public"."warehouse" USING "btree" ("owner_customer_id");



CREATE INDEX "idx_warehouse_status" ON "public"."warehouse" USING "btree" ("status");



CREATE INDEX "idx_warehouse_type" ON "public"."warehouse" USING "btree" ("type");



CREATE INDEX "idx_work_orders_inbound_shipment_id" ON "public"."work_orders" USING "btree" ("inbound_shipment_id");



CREATE INDEX "idx_work_orders_outbound_id" ON "public"."work_orders" USING "btree" ("outbound_id");



CREATE INDEX "idx_work_orders_priority" ON "public"."work_orders" USING "btree" ("priority");



CREATE INDEX "idx_work_orders_process_stage" ON "public"."work_orders" USING "btree" ("process_stage");



CREATE INDEX "idx_work_orders_status" ON "public"."work_orders" USING "btree" ("status");



CREATE INDEX "idx_work_orders_task_type" ON "public"."work_orders" USING "btree" ("task_type");



CREATE INDEX "idx_work_orders_warehouse_id" ON "public"."work_orders" USING "btree" ("warehouse_id");



CREATE INDEX "idx_work_task_action_work_order_id" ON "public"."work_task_action" USING "btree" ("work_order_id");



CREATE INDEX "inbound_events_receipt_idx" ON "public"."inbound_events" USING "btree" ("receipt_id");



CREATE INDEX "inbound_events_type_idx" ON "public"."inbound_events" USING "btree" ("event_type");



CREATE INDEX "inbound_issues_receipt_idx" ON "public"."inbound_issues" USING "btree" ("receipt_id");



CREATE INDEX "inbound_issues_status_idx" ON "public"."inbound_issues" USING "btree" ("status");



CREATE INDEX "inbound_photo_slots_receipt_idx" ON "public"."inbound_photo_slots" USING "btree" ("receipt_id");



CREATE INDEX "inbound_photos_receipt_idx" ON "public"."inbound_photos" USING "btree" ("receipt_id");



CREATE INDEX "inbound_photos_slot_idx" ON "public"."inbound_photos" USING "btree" ("slot_id");



CREATE INDEX "inbound_plan_lines_plan_idx" ON "public"."inbound_plan_lines" USING "btree" ("plan_id");



CREATE INDEX "inbound_plans_org_wh_date_idx" ON "public"."inbound_plans" USING "btree" ("org_id", "warehouse_id", "planned_date");



CREATE INDEX "inbound_receipt_lines_product_idx" ON "public"."inbound_receipt_lines" USING "btree" ("product_id");



CREATE INDEX "inbound_receipt_lines_receipt_idx" ON "public"."inbound_receipt_lines" USING "btree" ("receipt_id");



CREATE INDEX "inbound_receipt_shares_receipt_id_idx" ON "public"."inbound_receipt_shares" USING "btree" ("receipt_id");



CREATE INDEX "inbound_receipt_shares_slug_idx" ON "public"."inbound_receipt_shares" USING "btree" ("slug");



CREATE INDEX "inbound_receipts_org_wh_status_idx" ON "public"."inbound_receipts" USING "btree" ("org_id", "warehouse_id", "status");



CREATE INDEX "inbound_receipts_plan_idx" ON "public"."inbound_receipts" USING "btree" ("plan_id");



CREATE INDEX "product_barcodes_barcode_idx" ON "public"."product_barcodes" USING "btree" ("barcode");



CREATE INDEX "product_barcodes_product_idx" ON "public"."product_barcodes" USING "btree" ("product_id");



CREATE INDEX "receipt_documents_created_at_idx" ON "public"."receipt_documents" USING "btree" ("created_at");



CREATE INDEX "receipt_documents_receipt_idx" ON "public"."receipt_documents" USING "btree" ("receipt_id");



CREATE UNIQUE INDEX "uq_inventory_ledger_tenant_idempotency" ON "public"."inventory_ledger" USING "btree" ("tenant_id", "idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE UNIQUE INDEX "ux_orders_order_no" ON "public"."orders" USING "btree" ("order_no");



CREATE OR REPLACE VIEW "public"."v_customer_with_contacts" WITH ("security_invoker"='true') AS
 SELECT "cm"."id",
    "cm"."org_id",
    "cm"."code",
    "cm"."name",
    "cm"."type",
    "cm"."country_code",
    "cm"."business_reg_no",
    "cm"."billing_currency",
    "cm"."billing_cycle",
    "cm"."payment_terms",
    "cm"."contact_name",
    "cm"."contact_email",
    "cm"."contact_phone",
    "cm"."address_line1",
    "cm"."address_line2",
    "cm"."city",
    "cm"."postal_code",
    "cm"."contract_start",
    "cm"."contract_end",
    "cm"."status",
    "cm"."note",
    "cm"."metadata",
    "cm"."created_at",
    "cm"."updated_at",
    "json_agg"("json_build_object"('contact_id', "cc"."id", 'name', "cc"."name", 'role', "cc"."role", 'email', "cc"."email", 'phone', "cc"."phone", 'is_primary', "cc"."is_primary") ORDER BY "cc"."is_primary" DESC, "cc"."created_at") FILTER (WHERE ("cc"."id" IS NOT NULL)) AS "contacts"
   FROM ("public"."customer_master" "cm"
     LEFT JOIN "public"."customer_contact" "cc" ON ((("cm"."id" = "cc"."customer_master_id") AND ("cc"."is_active" = true))))
  GROUP BY "cm"."id";



CREATE OR REPLACE TRIGGER "on_inbound_complete" AFTER UPDATE ON "public"."inbounds" FOR EACH ROW EXECUTE FUNCTION "public"."process_inbound_completion"();



CREATE OR REPLACE TRIGGER "on_order_status_change" AFTER UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."log_order_status_change"();



CREATE OR REPLACE TRIGGER "trg_products_sync_customer_from_brand" BEFORE INSERT OR UPDATE OF "brand_id" ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."fn_products_sync_customer_from_brand"();



CREATE OR REPLACE TRIGGER "trg_sync_inventory_ledger_standard_columns" BEFORE INSERT OR UPDATE ON "public"."inventory_ledger" FOR EACH ROW EXECUTE FUNCTION "public"."sync_inventory_ledger_standard_columns"();



CREATE OR REPLACE TRIGGER "trigger_external_quote_inquiry_updated_at" BEFORE UPDATE ON "public"."external_quote_inquiry" FOR EACH ROW EXECUTE FUNCTION "public"."update_external_quote_inquiry_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_inquiry_notes_updated_at" BEFORE UPDATE ON "public"."inquiry_notes" FOR EACH ROW EXECUTE FUNCTION "public"."update_inquiry_notes_updated_at"();



CREATE OR REPLACE TRIGGER "update_email_templates_updated_at" BEFORE UPDATE ON "public"."email_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_inbound_plans_modtime" BEFORE UPDATE ON "public"."inbound_plans" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_inbound_receipt_lines_modtime" BEFORE UPDATE ON "public"."inbound_receipt_lines" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_inbound_receipt_shares_modtime" BEFORE UPDATE ON "public"."inbound_receipt_shares" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_inbound_receipts_modtime" BEFORE UPDATE ON "public"."inbound_receipts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_notification_rules_updated_at" BEFORE UPDATE ON "public"."notification_rules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_quote_pricing_rules_updated_at" BEFORE UPDATE ON "public"."quote_pricing_rules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."billing_invoice"
    ADD CONSTRAINT "billing_invoice_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id");



ALTER TABLE ONLY "public"."billing_invoice"
    ADD CONSTRAINT "billing_invoice_customer_master_id_fkey" FOREIGN KEY ("customer_master_id") REFERENCES "public"."customer_master"("id");



ALTER TABLE ONLY "public"."billing_invoice_line"
    ADD CONSTRAINT "billing_invoice_line_billing_invoice_id_fkey" FOREIGN KEY ("billing_invoice_id") REFERENCES "public"."billing_invoice"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand"
    ADD CONSTRAINT "brand_customer_master_id_fkey" FOREIGN KEY ("customer_master_id") REFERENCES "public"."customer_master"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_warehouse"
    ADD CONSTRAINT "brand_warehouse_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_warehouse"
    ADD CONSTRAINT "brand_warehouse_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cs_alerts"
    ADD CONSTRAINT "cs_alerts_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cs_conversations"
    ADD CONSTRAINT "cs_conversations_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cs_messages"
    ADD CONSTRAINT "cs_messages_convo_id_fkey" FOREIGN KEY ("convo_id") REFERENCES "public"."cs_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cs_tickets"
    ADD CONSTRAINT "cs_tickets_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."cs_conversations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cs_tickets"
    ADD CONSTRAINT "cs_tickets_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_activity"
    ADD CONSTRAINT "customer_activity_customer_master_id_fkey" FOREIGN KEY ("customer_master_id") REFERENCES "public"."customer_master"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_activity"
    ADD CONSTRAINT "customer_activity_related_contact_id_fkey" FOREIGN KEY ("related_contact_id") REFERENCES "public"."customer_contact"("id");



ALTER TABLE ONLY "public"."customer_contact"
    ADD CONSTRAINT "customer_contact_customer_master_id_fkey" FOREIGN KEY ("customer_master_id") REFERENCES "public"."customer_master"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_contract"
    ADD CONSTRAINT "customer_contract_customer_master_id_fkey" FOREIGN KEY ("customer_master_id") REFERENCES "public"."customer_master"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_contract"
    ADD CONSTRAINT "customer_contract_parent_contract_id_fkey" FOREIGN KEY ("parent_contract_id") REFERENCES "public"."customer_contract"("id");



ALTER TABLE ONLY "public"."customer_contract"
    ADD CONSTRAINT "customer_contract_replaced_by_contract_id_fkey" FOREIGN KEY ("replaced_by_contract_id") REFERENCES "public"."customer_contract"("id");



ALTER TABLE ONLY "public"."customer_master"
    ADD CONSTRAINT "customer_master_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id");



ALTER TABLE ONLY "public"."customer_pricing"
    ADD CONSTRAINT "customer_pricing_customer_master_id_fkey" FOREIGN KEY ("customer_master_id") REFERENCES "public"."customer_master"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_pricing"
    ADD CONSTRAINT "customer_pricing_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id");



ALTER TABLE ONLY "public"."customer_relationship"
    ADD CONSTRAINT "customer_relationship_child_customer_id_fkey" FOREIGN KEY ("child_customer_id") REFERENCES "public"."customer_master"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_relationship"
    ADD CONSTRAINT "customer_relationship_parent_customer_id_fkey" FOREIGN KEY ("parent_customer_id") REFERENCES "public"."customer_master"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_logs"
    ADD CONSTRAINT "email_logs_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."email_logs"
    ADD CONSTRAINT "email_logs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id");



ALTER TABLE ONLY "public"."email_templates"
    ADD CONSTRAINT "email_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."email_templates"
    ADD CONSTRAINT "email_templates_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."external_quote_inquiry"
    ADD CONSTRAINT "external_quote_inquiry_converted_customer_id_fkey" FOREIGN KEY ("converted_customer_id") REFERENCES "public"."customer_master"("id");



ALTER TABLE ONLY "public"."inbound_inspections"
    ADD CONSTRAINT "fk_inbound_inspections_org" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id");



ALTER TABLE ONLY "public"."inbound_plan_lines"
    ADD CONSTRAINT "fk_inbound_plan_lines_product" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."inbound_plans"
    ADD CONSTRAINT "fk_inbound_plans_client" FOREIGN KEY ("client_id") REFERENCES "public"."customer_master"("id");



ALTER TABLE ONLY "public"."inbound_receipt_lines"
    ADD CONSTRAINT "fk_inbound_receipt_lines_product" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."inbound_receipts"
    ADD CONSTRAINT "fk_inbound_receipts_client" FOREIGN KEY ("client_id") REFERENCES "public"."customer_master"("id");



ALTER TABLE ONLY "public"."inbound_receipts"
    ADD CONSTRAINT "fk_inbound_receipts_org" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id");



ALTER TABLE ONLY "public"."inbound_receipts"
    ADD CONSTRAINT "fk_inbound_receipts_warehouse" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse"("id");



ALTER TABLE ONLY "public"."inbound_events"
    ADD CONSTRAINT "inbound_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."inbound_events"
    ADD CONSTRAINT "inbound_events_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "public"."inbound_receipts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inbound_inspections"
    ADD CONSTRAINT "inbound_inspections_inbound_id_fkey" FOREIGN KEY ("inbound_id") REFERENCES "public"."inbounds"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inbound_inspections"
    ADD CONSTRAINT "inbound_inspections_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."inbound_issues"
    ADD CONSTRAINT "inbound_issues_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."inbound_issues"
    ADD CONSTRAINT "inbound_issues_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "public"."inbound_receipt_lines"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inbound_issues"
    ADD CONSTRAINT "inbound_issues_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "public"."inbound_receipts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inbound_issues"
    ADD CONSTRAINT "inbound_issues_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."inbound_photo_slots"
    ADD CONSTRAINT "inbound_photo_slots_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "public"."inbound_receipts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inbound_photos"
    ADD CONSTRAINT "inbound_photos_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "public"."inbound_receipt_lines"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inbound_photos"
    ADD CONSTRAINT "inbound_photos_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "public"."inbound_receipts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inbound_photos"
    ADD CONSTRAINT "inbound_photos_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "public"."inbound_photo_slots"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inbound_photos"
    ADD CONSTRAINT "inbound_photos_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."inbound_plan_lines"
    ADD CONSTRAINT "inbound_plan_lines_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."inbound_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inbound_plans"
    ADD CONSTRAINT "inbound_plans_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."inbound_receipt_lines"
    ADD CONSTRAINT "inbound_receipt_lines_inspected_by_fkey" FOREIGN KEY ("inspected_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."inbound_receipt_lines"
    ADD CONSTRAINT "inbound_receipt_lines_plan_line_id_fkey" FOREIGN KEY ("plan_line_id") REFERENCES "public"."inbound_plan_lines"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inbound_receipt_lines"
    ADD CONSTRAINT "inbound_receipt_lines_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "public"."inbound_receipts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inbound_receipt_photo_requirements"
    ADD CONSTRAINT "inbound_receipt_photo_requirements_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "public"."inbound_receipts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inbound_receipt_photo_requirements"
    ADD CONSTRAINT "inbound_receipt_photo_requirements_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."photo_guide_templates"("id");



ALTER TABLE ONLY "public"."inbound_receipt_shares"
    ADD CONSTRAINT "inbound_receipt_shares_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."inbound_receipt_shares"
    ADD CONSTRAINT "inbound_receipt_shares_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "public"."inbound_receipts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inbound_receipts"
    ADD CONSTRAINT "inbound_receipts_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."inbound_receipts"
    ADD CONSTRAINT "inbound_receipts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."inbound_receipts"
    ADD CONSTRAINT "inbound_receipts_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."inbound_plans"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inbound_shipment_line"
    ADD CONSTRAINT "inbound_shipment_line_inbound_shipment_id_fkey" FOREIGN KEY ("inbound_shipment_id") REFERENCES "public"."inbound_shipment"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inbound_shipment_line"
    ADD CONSTRAINT "inbound_shipment_line_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."inbound_shipment"
    ADD CONSTRAINT "inbound_shipment_owner_brand_id_fkey" FOREIGN KEY ("owner_brand_id") REFERENCES "public"."brand"("id");



ALTER TABLE ONLY "public"."inbound_shipment"
    ADD CONSTRAINT "inbound_shipment_supplier_customer_id_fkey" FOREIGN KEY ("supplier_customer_id") REFERENCES "public"."customer_master"("id");



ALTER TABLE ONLY "public"."inbound_shipment"
    ADD CONSTRAINT "inbound_shipment_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse"("id");



ALTER TABLE ONLY "public"."inbounds"
    ADD CONSTRAINT "inbounds_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inbounds"
    ADD CONSTRAINT "inbounds_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."partners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inquiry_action_logs"
    ADD CONSTRAINT "inquiry_action_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."inquiry_notes"
    ADD CONSTRAINT "inquiry_notes_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_import_runs"
    ADD CONSTRAINT "inventory_import_runs_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."inventory_ledger"
    ADD CONSTRAINT "inventory_ledger_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id");



ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_owner_brand_id_fkey" FOREIGN KEY ("owner_brand_id") REFERENCES "public"."brand"("id");



ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_snapshot"
    ADD CONSTRAINT "inventory_snapshot_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_transaction"
    ADD CONSTRAINT "inventory_transaction_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "public"."location"("id");



ALTER TABLE ONLY "public"."inventory_transaction"
    ADD CONSTRAINT "inventory_transaction_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id");



ALTER TABLE ONLY "public"."inventory_transaction"
    ADD CONSTRAINT "inventory_transaction_owner_brand_id_fkey" FOREIGN KEY ("owner_brand_id") REFERENCES "public"."brand"("id");



ALTER TABLE ONLY "public"."inventory_transaction"
    ADD CONSTRAINT "inventory_transaction_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."inventory_transaction"
    ADD CONSTRAINT "inventory_transaction_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "public"."location"("id");



ALTER TABLE ONLY "public"."inventory_transaction"
    ADD CONSTRAINT "inventory_transaction_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse"("id");



ALTER TABLE ONLY "public"."inventory_volume_raw"
    ADD CONSTRAINT "inventory_volume_raw_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customer_master"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_volume_raw"
    ADD CONSTRAINT "inventory_volume_raw_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory_volume_share"
    ADD CONSTRAINT "inventory_volume_share_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory_volume_share"
    ADD CONSTRAINT "inventory_volume_share_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customer_master"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse"("id");



ALTER TABLE ONLY "public"."location"
    ADD CONSTRAINT "location_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."logistics_api_logs"
    ADD CONSTRAINT "logistics_api_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."my_tasks"
    ADD CONSTRAINT "my_tasks_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_rules"
    ADD CONSTRAINT "notification_rules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."notification_rules"
    ADD CONSTRAINT "notification_rules_email_template_id_fkey" FOREIGN KEY ("email_template_id") REFERENCES "public"."email_templates"("id");



ALTER TABLE ONLY "public"."notification_rules"
    ADD CONSTRAINT "notification_rules_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_receivers"
    ADD CONSTRAINT "order_receivers_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_status_history"
    ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."outbound_order_line"
    ADD CONSTRAINT "outbound_order_line_outbound_id_fkey" FOREIGN KEY ("outbound_id") REFERENCES "public"."outbounds"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."outbound_order_line"
    ADD CONSTRAINT "outbound_order_line_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."outbounds"
    ADD CONSTRAINT "outbounds_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id");



ALTER TABLE ONLY "public"."outbounds"
    ADD CONSTRAINT "outbounds_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."partners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."outbounds"
    ADD CONSTRAINT "outbounds_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."outbounds"
    ADD CONSTRAINT "outbounds_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id");



ALTER TABLE ONLY "public"."outbounds"
    ADD CONSTRAINT "outbounds_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse"("id");



ALTER TABLE ONLY "public"."pack_job_component"
    ADD CONSTRAINT "pack_job_component_component_product_id_fkey" FOREIGN KEY ("component_product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."pack_job_component"
    ADD CONSTRAINT "pack_job_component_pack_job_id_fkey" FOREIGN KEY ("pack_job_id") REFERENCES "public"."pack_job"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pack_job"
    ADD CONSTRAINT "pack_job_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "public"."location"("id");



ALTER TABLE ONLY "public"."pack_job"
    ADD CONSTRAINT "pack_job_kit_product_id_fkey" FOREIGN KEY ("kit_product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."pack_job"
    ADD CONSTRAINT "pack_job_owner_brand_id_fkey" FOREIGN KEY ("owner_brand_id") REFERENCES "public"."brand"("id");



ALTER TABLE ONLY "public"."pack_job"
    ADD CONSTRAINT "pack_job_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "public"."location"("id");



ALTER TABLE ONLY "public"."pack_job"
    ADD CONSTRAINT "pack_job_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse"("id");



ALTER TABLE ONLY "public"."parcel_shipment"
    ADD CONSTRAINT "parcel_shipment_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id");



ALTER TABLE ONLY "public"."parcel_shipment"
    ADD CONSTRAINT "parcel_shipment_outbound_id_fkey" FOREIGN KEY ("outbound_id") REFERENCES "public"."outbounds"("id");



ALTER TABLE ONLY "public"."parcel_shipment"
    ADD CONSTRAINT "parcel_shipment_shipping_account_id_fkey" FOREIGN KEY ("shipping_account_id") REFERENCES "public"."shipping_account"("id");



ALTER TABLE ONLY "public"."parcel_shipment"
    ADD CONSTRAINT "parcel_shipment_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id");



ALTER TABLE ONLY "public"."parcel_shipment"
    ADD CONSTRAINT "parcel_shipment_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse"("id");



ALTER TABLE ONLY "public"."photo_guide_slots"
    ADD CONSTRAINT "photo_guide_slots_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."photo_guide_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_barcodes"
    ADD CONSTRAINT "product_barcodes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_bom"
    ADD CONSTRAINT "product_bom_component_product_id_fkey" FOREIGN KEY ("component_product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_bom"
    ADD CONSTRAINT "product_bom_kit_product_id_fkey" FOREIGN KEY ("kit_product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_uom"
    ADD CONSTRAINT "product_uom_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customer_master"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quote_calculations"
    ADD CONSTRAINT "quote_calculations_calculated_by_fkey" FOREIGN KEY ("calculated_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."quote_calculations"
    ADD CONSTRAINT "quote_calculations_pricing_rule_id_fkey" FOREIGN KEY ("pricing_rule_id") REFERENCES "public"."quote_pricing_rules"("id");



ALTER TABLE ONLY "public"."quote_pricing_rules"
    ADD CONSTRAINT "quote_pricing_rules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."quote_pricing_rules"
    ADD CONSTRAINT "quote_pricing_rules_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."receipt_documents"
    ADD CONSTRAINT "receipt_documents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."receipt_documents"
    ADD CONSTRAINT "receipt_documents_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "public"."inbound_receipts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."return_order"
    ADD CONSTRAINT "return_order_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id");



ALTER TABLE ONLY "public"."return_order_line"
    ADD CONSTRAINT "return_order_line_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."return_order_line"
    ADD CONSTRAINT "return_order_line_return_order_id_fkey" FOREIGN KEY ("return_order_id") REFERENCES "public"."return_order"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."return_order"
    ADD CONSTRAINT "return_order_outbound_id_fkey" FOREIGN KEY ("outbound_id") REFERENCES "public"."outbounds"("id");



ALTER TABLE ONLY "public"."return_order"
    ADD CONSTRAINT "return_order_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id");



ALTER TABLE ONLY "public"."return_order"
    ADD CONSTRAINT "return_order_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse"("id");



ALTER TABLE ONLY "public"."shipping_account"
    ADD CONSTRAINT "shipping_account_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "public"."shipping_carrier"("id");



ALTER TABLE ONLY "public"."shipping_account"
    ADD CONSTRAINT "shipping_account_customer_master_id_fkey" FOREIGN KEY ("customer_master_id") REFERENCES "public"."customer_master"("id");



ALTER TABLE ONLY "public"."stock_transfer"
    ADD CONSTRAINT "stock_transfer_from_warehouse_id_fkey" FOREIGN KEY ("from_warehouse_id") REFERENCES "public"."warehouse"("id");



ALTER TABLE ONLY "public"."stock_transfer_line"
    ADD CONSTRAINT "stock_transfer_line_stock_transfer_id_fkey" FOREIGN KEY ("stock_transfer_id") REFERENCES "public"."stock_transfer"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_transfer"
    ADD CONSTRAINT "stock_transfer_to_warehouse_id_fkey" FOREIGN KEY ("to_warehouse_id") REFERENCES "public"."warehouse"("id");



ALTER TABLE ONLY "public"."store"
    ADD CONSTRAINT "store_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."system_alert"
    ADD CONSTRAINT "system_alert_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id");



ALTER TABLE ONLY "public"."system_alert"
    ADD CONSTRAINT "system_alert_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse"("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."warehouse"
    ADD CONSTRAINT "warehouse_operator_customer_id_fkey" FOREIGN KEY ("operator_customer_id") REFERENCES "public"."customer_master"("id");



ALTER TABLE ONLY "public"."warehouse"
    ADD CONSTRAINT "warehouse_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id");



ALTER TABLE ONLY "public"."warehouse"
    ADD CONSTRAINT "warehouse_owner_customer_id_fkey" FOREIGN KEY ("owner_customer_id") REFERENCES "public"."customer_master"("id");



ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_inbound_shipment_id_fkey" FOREIGN KEY ("inbound_shipment_id") REFERENCES "public"."inbound_shipment"("id");



ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_outbound_id_fkey" FOREIGN KEY ("outbound_id") REFERENCES "public"."outbounds"("id");



ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse"("id");



ALTER TABLE ONLY "public"."work_task_action"
    ADD CONSTRAINT "work_task_action_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can view audit logs archive" ON "public"."audit_logs_archive" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid")) AND ("u"."role" = 'admin'::"text")))));



CREATE POLICY "Enable all access for authenticated users" ON "public"."inbound_events" TO "authenticated" USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable all access for authenticated users" ON "public"."inbound_inspections" TO "authenticated" USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable all access for authenticated users" ON "public"."inbound_issues" TO "authenticated" USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable all access for authenticated users" ON "public"."inbound_photo_slots" TO "authenticated" USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable all access for authenticated users" ON "public"."inbound_photos" TO "authenticated" USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable all access for authenticated users" ON "public"."inbound_plan_lines" TO "authenticated" USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable all access for authenticated users" ON "public"."inbound_plans" TO "authenticated" USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable all access for authenticated users" ON "public"."inbound_receipt_lines" TO "authenticated" USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable all access for authenticated users" ON "public"."inbound_receipt_photo_requirements" TO "authenticated" USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable all access for authenticated users" ON "public"."inbound_receipts" TO "authenticated" USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable all access for authenticated users" ON "public"."inventory_ledger" TO "authenticated" USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable all access for authenticated users" ON "public"."inventory_quantities" TO "authenticated" USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete access for authenticated users" ON "public"."product_categories" FOR DELETE TO "authenticated" USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."role"() AS "role") AS "role") AS "role") AS "role") AS "role") AS "role") AS "role") AS "role") AS "role") AS "role") AS "role") AS "role") AS "role") = 'authenticated'::"text"));



CREATE POLICY "Enable delete for all users" ON "public"."billing_invoice" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."billing_invoice_line" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."brand" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."brand_warehouse" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."cs_alerts" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."cs_conversations" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."cs_glossary" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."cs_messages" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."cs_templates" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."cs_tickets" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."cs_translate_logs" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."customer_activity" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."customer_contact" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."customer_contract" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."customer_master" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."customer_pricing" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."customer_relationship" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."inbound_shipment" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."inbound_shipment_line" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."inbounds" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."inventory" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."inventory_transaction" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."location" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."logistics_api_logs" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."my_tasks" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."order_receivers" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."order_senders" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."orders" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."org" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."outbound_order_line" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."outbounds" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."pack_job" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."pack_job_component" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."parcel_shipment" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."partners" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."product_bom" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."product_uom" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."products" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."return_order" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."return_order_line" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."shipping_account" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."shipping_carrier" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."stock_transfer" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."stock_transfer_line" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."store" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."system_alert" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."warehouse" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."work_orders" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable delete for all users" ON "public"."work_task_action" FOR DELETE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert access for authenticated users" ON "public"."product_categories" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."role"() AS "role") AS "role") AS "role") AS "role") AS "role") AS "role") AS "role") AS "role") AS "role") AS "role") AS "role") AS "role") AS "role") = 'authenticated'::"text"));



CREATE POLICY "Enable insert for all users" ON "public"."billing_invoice" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."billing_invoice_line" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."brand" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."brand_warehouse" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."cs_alerts" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."cs_conversations" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."cs_glossary" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."cs_messages" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."cs_templates" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."cs_tickets" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."cs_translate_logs" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."customer_activity" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."customer_contact" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."customer_contract" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."customer_master" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."customer_pricing" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."customer_relationship" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."inbound_shipment" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."inbound_shipment_line" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."inbounds" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."inventory" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."inventory_transaction" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."location" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."logistics_api_logs" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."my_tasks" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."order_receivers" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."order_senders" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."orders" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."org" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."outbound_order_line" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."outbounds" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."pack_job" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."pack_job_component" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."parcel_shipment" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."partners" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."product_bom" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."product_uom" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."products" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."return_order" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."return_order_line" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."shipping_account" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."shipping_carrier" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."stock_transfer" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."stock_transfer_line" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."store" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."system_alert" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."warehouse" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."work_orders" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable insert for all users" ON "public"."work_task_action" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable read access for all users" ON "public"."billing_invoice" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."billing_invoice_line" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."brand" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."brand_warehouse" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."cs_alerts" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."cs_conversations" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."cs_glossary" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."cs_messages" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."cs_templates" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."cs_tickets" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."cs_translate_logs" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."customer_activity" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."customer_contact" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."customer_contract" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."customer_master" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."customer_pricing" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."customer_relationship" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."inbound_shipment" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."inbound_shipment_line" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."inbounds" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."inventory" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."inventory_transaction" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."location" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."logistics_api_logs" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."my_tasks" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."order_receivers" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."order_senders" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."orders" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."org" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."outbound_order_line" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."outbounds" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."pack_job" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."pack_job_component" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."parcel_shipment" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."partners" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."product_bom" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."product_categories" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."product_uom" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."products" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."return_order" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."return_order_line" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."shipping_account" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."shipping_carrier" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."stock_transfer" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."stock_transfer_line" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."store" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."system_alert" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."warehouse" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."work_orders" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."work_task_action" FOR SELECT USING (true);



CREATE POLICY "Enable read access for authenticated users" ON "public"."receipt_documents" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read for authenticated users" ON "public"."inbound_receipt_shares" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable update access for authenticated users" ON "public"."product_categories" FOR UPDATE TO "authenticated" USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."role"() AS "role") AS "role") AS "role") AS "role") AS "role") AS "role") AS "role") AS "role") AS "role") AS "role") AS "role") AS "role") AS "role") = 'authenticated'::"text")) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."role"() AS "role") AS "role") AS "role") AS "role") AS "role") AS "role") AS "role") AS "role") AS "role") AS "role") AS "role") AS "role") AS "role") = 'authenticated'::"text"));



CREATE POLICY "Enable update for all users" ON "public"."billing_invoice" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."billing_invoice_line" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."brand" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."brand_warehouse" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."cs_alerts" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."cs_conversations" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."cs_glossary" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."cs_messages" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."cs_templates" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."cs_tickets" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."cs_translate_logs" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."customer_activity" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."customer_contact" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."customer_contract" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."customer_master" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."customer_pricing" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."customer_relationship" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."inbound_shipment" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."inbound_shipment_line" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."inbounds" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."inventory" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."inventory_transaction" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."location" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."logistics_api_logs" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."my_tasks" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."order_receivers" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."order_senders" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."orders" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."org" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."outbound_order_line" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."outbounds" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."pack_job" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."pack_job_component" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."parcel_shipment" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."partners" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."product_bom" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."product_uom" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."products" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."return_order" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."return_order_line" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."shipping_account" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."shipping_carrier" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."stock_transfer" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."stock_transfer_line" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."store" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."system_alert" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."warehouse" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."work_orders" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable update for all users" ON "public"."work_task_action" FOR UPDATE USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable write access for authenticated users" ON "public"."receipt_documents" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable write for authenticated users" ON "public"."product_barcodes" TO "authenticated" USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Enable write for authenticated users" ON "public"."system_announcements" TO "authenticated" USING ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Insert audit logs" ON "public"."audit_logs" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Insert audit logs archive" ON "public"."audit_logs_archive" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Insert order history" ON "public"."order_status_history" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



CREATE POLICY "Internal users can insert inventory import runs" ON "public"."inventory_import_runs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."id" = ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid")) AND ("up"."org_id" = "inventory_import_runs"."tenant_id") AND (("up"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'operator'::"text"])) OR ("up"."can_manage_inventory" = true) OR ("up"."can_access_admin" = true))))));



CREATE POLICY "Internal users can manage photo guide slots" ON "public"."photo_guide_slots" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."id" = ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid")) AND ("up"."org_id" = "photo_guide_slots"."org_id") AND (("up"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'operator'::"text"])) OR ("up"."can_manage_inventory" = true) OR ("up"."can_access_admin" = true)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."id" = ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid")) AND ("up"."org_id" = "photo_guide_slots"."org_id") AND (("up"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'operator'::"text"])) OR ("up"."can_manage_inventory" = true) OR ("up"."can_access_admin" = true))))));



CREATE POLICY "Internal users can manage photo guides" ON "public"."photo_guide_templates" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."id" = ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid")) AND ("up"."org_id" = "photo_guide_templates"."org_id") AND (("up"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'operator'::"text"])) OR ("up"."can_manage_inventory" = true) OR ("up"."can_access_admin" = true)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."id" = ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid")) AND ("up"."org_id" = "photo_guide_templates"."org_id") AND (("up"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'operator'::"text"])) OR ("up"."can_manage_inventory" = true) OR ("up"."can_access_admin" = true))))));



CREATE POLICY "Internal users can read inventory import runs" ON "public"."inventory_import_runs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."id" = ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid")) AND ("up"."org_id" = "inventory_import_runs"."tenant_id") AND (("up"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'operator'::"text"])) OR ("up"."can_manage_inventory" = true) OR ("up"."can_access_admin" = true))))));



CREATE POLICY "Internal users can write inventory snapshot" ON "public"."inventory_snapshot" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."id" = ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid")) AND ("up"."org_id" = "inventory_snapshot"."tenant_id") AND (("up"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'operator'::"text"])) OR ("up"."can_manage_inventory" = true) OR ("up"."can_access_admin" = true)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."id" = ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid")) AND ("up"."org_id" = "inventory_snapshot"."tenant_id") AND (("up"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'operator'::"text"])) OR ("up"."can_manage_inventory" = true) OR ("up"."can_access_admin" = true))))));



CREATE POLICY "View order history" ON "public"."order_status_history" FOR SELECT USING (true);



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs_archive" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."billing_invoice" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."billing_invoice_line" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."brand" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."brand_warehouse" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cs_alerts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cs_conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cs_glossary" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cs_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cs_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cs_tickets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cs_translate_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_activity" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_contact" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_contract" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_master" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_pricing" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_relationship" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."external_quote_inquiry" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inbound_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inbound_inspections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inbound_issues" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inbound_photo_slots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inbound_photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inbound_plan_lines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inbound_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inbound_receipt_lines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inbound_receipt_photo_requirements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inbound_receipt_shares" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inbound_receipts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inbound_shipment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inbound_shipment_line" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inbounds" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inquiry_action_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inquiry_notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "internal_all_email_logs" ON "public"."email_logs" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."id" = ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid")) AND (("up"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'operator'::"text"])) OR ("up"."can_access_admin" = true)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."id" = ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid")) AND (("up"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'operator'::"text"])) OR ("up"."can_access_admin" = true))))));



CREATE POLICY "internal_all_external_quote_inquiry" ON "public"."external_quote_inquiry" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."id" = ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid")) AND (("up"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'operator'::"text"])) OR ("up"."can_access_admin" = true)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."id" = ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid")) AND (("up"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'operator'::"text"])) OR ("up"."can_access_admin" = true))))));



CREATE POLICY "internal_all_inventory_volume_raw" ON "public"."inventory_volume_raw" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."id" = ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid")) AND (("up"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'operator'::"text"])) OR ("up"."can_manage_inventory" = true) OR ("up"."can_access_admin" = true)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."id" = ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid")) AND (("up"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'operator'::"text"])) OR ("up"."can_manage_inventory" = true) OR ("up"."can_access_admin" = true))))));



CREATE POLICY "internal_all_inventory_volume_share" ON "public"."inventory_volume_share" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."id" = ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid")) AND (("up"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'operator'::"text"])) OR ("up"."can_manage_inventory" = true) OR ("up"."can_access_admin" = true)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."id" = ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid")) AND (("up"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'operator'::"text"])) OR ("up"."can_manage_inventory" = true) OR ("up"."can_access_admin" = true))))));



CREATE POLICY "internal_all_notification_rules" ON "public"."notification_rules" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."id" = ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid")) AND (("up"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text"])) OR ("up"."can_access_admin" = true)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."id" = ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid")) AND (("up"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text"])) OR ("up"."can_access_admin" = true))))));



CREATE POLICY "internal_all_quote_calculations" ON "public"."quote_calculations" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."id" = ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid")) AND (("up"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'operator'::"text"])) OR ("up"."can_access_admin" = true)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."id" = ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid")) AND (("up"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'operator'::"text"])) OR ("up"."can_access_admin" = true))))));



CREATE POLICY "internal_all_quote_pricing_rules" ON "public"."quote_pricing_rules" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."id" = ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid")) AND (("up"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text"])) OR ("up"."can_access_admin" = true)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."id" = ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid")) AND (("up"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text"])) OR ("up"."can_access_admin" = true))))));



ALTER TABLE "public"."inventory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_import_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_quantities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_snapshot" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_transaction" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_volume_raw" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_volume_share" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."location" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."logistics_api_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "merged_user_profiles_select_4c9184f3" ON "public"."user_profiles" FOR SELECT USING (("public"."is_admin"(( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid")) OR (( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") = "id")));



CREATE POLICY "merged_user_profiles_update_4c9184f3" ON "public"."user_profiles" FOR UPDATE USING (("public"."is_admin"(( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid")) OR (( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") = "id"))) WITH CHECK ((true OR true));



CREATE POLICY "merged_users_select_4c9184f3" ON "public"."users" FOR SELECT USING ((((( SELECT ( SELECT ( SELECT ( SELECT "auth"."jwt"() AS "jwt") AS "jwt") AS "jwt") AS "jwt") ->> 'email'::"text") IN ( SELECT "users_1"."email"
   FROM "public"."users" "users_1"
  WHERE ("users_1"."role" = 'admin'::"text"))) OR ("id" IN ( SELECT "users_1"."id"
   FROM "public"."users" "users_1")) OR (EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."id" = ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid")))) OR (( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") = "id")));



CREATE POLICY "merged_users_update_authenticated_final" ON "public"."users" FOR UPDATE TO "authenticated" USING (("public"."is_admin_safe"() OR (( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") = "id"))) WITH CHECK (("public"."is_admin_safe"() OR (( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") = "id")));



ALTER TABLE "public"."my_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_receivers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_senders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_status_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."outbound_order_line" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."outbounds" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pack_job" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pack_job_component" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parcel_shipment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."partners" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."photo_guide_slots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."photo_guide_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_barcodes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_bom" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_uom" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quote_calculations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quote_pricing_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."receipt_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."return_order" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."return_order_line" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shipping_account" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shipping_carrier" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_transfer" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_transfer_line" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."store" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_alert" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_announcements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."warehouse" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."work_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."work_task_action" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "관리자는 메모를 추가할 수 있습니다" ON "public"."inquiry_notes" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid")) AND ("user_profiles"."role" = 'admin'::"text")))));



CREATE POLICY "관리자는 모든 메모를 조회할 수 있습니다" ON "public"."inquiry_notes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid")) AND ("user_profiles"."role" = 'admin'::"text")))));



CREATE POLICY "관리자는 모든 액션 로그를 조회할 수 있습니다" ON "public"."inquiry_action_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid")) AND ("user_profiles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "관리자는 모든 템플릿을 조회할 수 있습니다" ON "public"."email_templates" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid")) AND ("user_profiles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "관리자는 자신의 메모를 삭제할 수 있습니다" ON "public"."inquiry_notes" FOR DELETE USING ((("admin_id" = ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid")) AND ("user_profiles"."role" = 'admin'::"text"))))));



CREATE POLICY "관리자는 자신의 메모를 수정할 수 있습니다" ON "public"."inquiry_notes" FOR UPDATE USING ((("admin_id" = ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid")) AND ("user_profiles"."role" = 'admin'::"text"))))));



CREATE POLICY "관리자는 템플릿을 생성할 수 있습니다" ON "public"."email_templates" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid")) AND ("user_profiles"."role" = 'admin'::"text")))));



CREATE POLICY "사용자는 자신의 알림을 업데이트할 수 있습니" ON "public"."notifications" FOR UPDATE USING (("user_id" = ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid")));



CREATE POLICY "사용자는 자신의 알림을 조회할 수 있습니다" ON "public"."notifications" FOR SELECT USING (("user_id" = ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid")));



CREATE POLICY "시스템은 알림을 생성할 수 있습니다" ON "public"."notifications" FOR INSERT WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") AS "uid") IS NOT NULL));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."archive_audit_logs"("p_retention_days" integer, "p_batch_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."archive_audit_logs"("p_retention_days" integer, "p_batch_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_audit_logs"("p_retention_days" integer, "p_batch_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."bump_api_rate_limit"("p_scope" "text", "p_actor_key" "text", "p_actor_key_type" "text", "p_window_seconds" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."bump_api_rate_limit"("p_scope" "text", "p_actor_key" "text", "p_actor_key_type" "text", "p_window_seconds" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."bump_api_rate_limit"("p_scope" "text", "p_actor_key" "text", "p_actor_key_type" "text", "p_window_seconds" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."confirm_inbound_receipt"("p_receipt_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."confirm_inbound_receipt"("p_receipt_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_inbound_receipt"("p_receipt_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_products_sync_customer_from_brand"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_products_sync_customer_from_brand"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_products_sync_customer_from_brand"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_permission"("user_id" "uuid", "permission" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_permission"("user_id" "uuid", "permission" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_permission"("user_id" "uuid", "permission" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin_safe"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin_safe"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_safe"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_order_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_order_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_order_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_inbound_completion"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_inbound_completion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_inbound_completion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."purge_audit_logs_archive"("p_keep_days" integer, "p_batch_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."purge_audit_logs_archive"("p_keep_days" integer, "p_batch_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."purge_audit_logs_archive"("p_keep_days" integer, "p_batch_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."run_audit_log_retention"("p_hot_retention_days" integer, "p_archive_keep_days" integer, "p_batch_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."run_audit_log_retention"("p_hot_retention_days" integer, "p_archive_keep_days" integer, "p_batch_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."run_audit_log_retention"("p_hot_retention_days" integer, "p_archive_keep_days" integer, "p_batch_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_inventory_ledger_standard_columns"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_inventory_ledger_standard_columns"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_inventory_ledger_standard_columns"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_external_quote_inquiry_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_external_quote_inquiry_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_external_quote_inquiry_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_inquiry_notes_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_inquiry_notes_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_inquiry_notes_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_product_stock"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_product_stock"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_product_stock"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."admin_users" TO "anon";
GRANT ALL ON TABLE "public"."admin_users" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_users" TO "service_role";



GRANT ALL ON TABLE "public"."api_rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."api_rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."api_rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs_archive" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs_archive" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs_archive" TO "service_role";



GRANT ALL ON TABLE "public"."billing_invoice" TO "anon";
GRANT ALL ON TABLE "public"."billing_invoice" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_invoice" TO "service_role";



GRANT ALL ON TABLE "public"."billing_invoice_line" TO "anon";
GRANT ALL ON TABLE "public"."billing_invoice_line" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_invoice_line" TO "service_role";



GRANT ALL ON TABLE "public"."brand" TO "anon";
GRANT ALL ON TABLE "public"."brand" TO "authenticated";
GRANT ALL ON TABLE "public"."brand" TO "service_role";



GRANT ALL ON TABLE "public"."brand_warehouse" TO "anon";
GRANT ALL ON TABLE "public"."brand_warehouse" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_warehouse" TO "service_role";



GRANT ALL ON TABLE "public"."cs_alerts" TO "anon";
GRANT ALL ON TABLE "public"."cs_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."cs_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."cs_conversations" TO "anon";
GRANT ALL ON TABLE "public"."cs_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."cs_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."cs_glossary" TO "anon";
GRANT ALL ON TABLE "public"."cs_glossary" TO "authenticated";
GRANT ALL ON TABLE "public"."cs_glossary" TO "service_role";



GRANT ALL ON TABLE "public"."cs_messages" TO "anon";
GRANT ALL ON TABLE "public"."cs_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."cs_messages" TO "service_role";



GRANT ALL ON TABLE "public"."cs_templates" TO "anon";
GRANT ALL ON TABLE "public"."cs_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."cs_templates" TO "service_role";



GRANT ALL ON TABLE "public"."cs_tickets" TO "anon";
GRANT ALL ON TABLE "public"."cs_tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."cs_tickets" TO "service_role";



GRANT ALL ON TABLE "public"."cs_translate_logs" TO "anon";
GRANT ALL ON TABLE "public"."cs_translate_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."cs_translate_logs" TO "service_role";



GRANT ALL ON TABLE "public"."customer_activity" TO "anon";
GRANT ALL ON TABLE "public"."customer_activity" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_activity" TO "service_role";



GRANT ALL ON TABLE "public"."customer_contact" TO "anon";
GRANT ALL ON TABLE "public"."customer_contact" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_contact" TO "service_role";



GRANT ALL ON TABLE "public"."customer_contract" TO "anon";
GRANT ALL ON TABLE "public"."customer_contract" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_contract" TO "service_role";



GRANT ALL ON TABLE "public"."customer_master" TO "anon";
GRANT ALL ON TABLE "public"."customer_master" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_master" TO "service_role";



GRANT ALL ON TABLE "public"."customer_pricing" TO "anon";
GRANT ALL ON TABLE "public"."customer_pricing" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_pricing" TO "service_role";



GRANT ALL ON TABLE "public"."customer_relationship" TO "anon";
GRANT ALL ON TABLE "public"."customer_relationship" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_relationship" TO "service_role";



GRANT ALL ON TABLE "public"."email_logs" TO "anon";
GRANT ALL ON TABLE "public"."email_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."email_logs" TO "service_role";



GRANT ALL ON TABLE "public"."email_templates" TO "anon";
GRANT ALL ON TABLE "public"."email_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."email_templates" TO "service_role";



GRANT ALL ON TABLE "public"."external_quote_inquiry" TO "anon";
GRANT ALL ON TABLE "public"."external_quote_inquiry" TO "authenticated";
GRANT ALL ON TABLE "public"."external_quote_inquiry" TO "service_role";



GRANT ALL ON TABLE "public"."inbound_events" TO "anon";
GRANT ALL ON TABLE "public"."inbound_events" TO "authenticated";
GRANT ALL ON TABLE "public"."inbound_events" TO "service_role";



GRANT ALL ON TABLE "public"."inbound_inspections" TO "anon";
GRANT ALL ON TABLE "public"."inbound_inspections" TO "authenticated";
GRANT ALL ON TABLE "public"."inbound_inspections" TO "service_role";



GRANT ALL ON TABLE "public"."inbound_issues" TO "anon";
GRANT ALL ON TABLE "public"."inbound_issues" TO "authenticated";
GRANT ALL ON TABLE "public"."inbound_issues" TO "service_role";



GRANT ALL ON TABLE "public"."inbound_photo_slots" TO "anon";
GRANT ALL ON TABLE "public"."inbound_photo_slots" TO "authenticated";
GRANT ALL ON TABLE "public"."inbound_photo_slots" TO "service_role";



GRANT ALL ON TABLE "public"."inbound_photos" TO "anon";
GRANT ALL ON TABLE "public"."inbound_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."inbound_photos" TO "service_role";



GRANT ALL ON TABLE "public"."inbound_plan_lines" TO "anon";
GRANT ALL ON TABLE "public"."inbound_plan_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."inbound_plan_lines" TO "service_role";



GRANT ALL ON TABLE "public"."inbound_plans" TO "anon";
GRANT ALL ON TABLE "public"."inbound_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."inbound_plans" TO "service_role";



GRANT ALL ON TABLE "public"."inbound_receipt_lines" TO "anon";
GRANT ALL ON TABLE "public"."inbound_receipt_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."inbound_receipt_lines" TO "service_role";



GRANT ALL ON TABLE "public"."inbound_receipt_photo_requirements" TO "anon";
GRANT ALL ON TABLE "public"."inbound_receipt_photo_requirements" TO "authenticated";
GRANT ALL ON TABLE "public"."inbound_receipt_photo_requirements" TO "service_role";



GRANT ALL ON TABLE "public"."inbound_receipt_shares" TO "anon";
GRANT ALL ON TABLE "public"."inbound_receipt_shares" TO "authenticated";
GRANT ALL ON TABLE "public"."inbound_receipt_shares" TO "service_role";



GRANT ALL ON TABLE "public"."inbound_receipts" TO "anon";
GRANT ALL ON TABLE "public"."inbound_receipts" TO "authenticated";
GRANT ALL ON TABLE "public"."inbound_receipts" TO "service_role";



GRANT ALL ON TABLE "public"."inbound_shipment" TO "anon";
GRANT ALL ON TABLE "public"."inbound_shipment" TO "authenticated";
GRANT ALL ON TABLE "public"."inbound_shipment" TO "service_role";



GRANT ALL ON TABLE "public"."inbound_shipment_line" TO "anon";
GRANT ALL ON TABLE "public"."inbound_shipment_line" TO "authenticated";
GRANT ALL ON TABLE "public"."inbound_shipment_line" TO "service_role";



GRANT ALL ON TABLE "public"."inbounds" TO "anon";
GRANT ALL ON TABLE "public"."inbounds" TO "authenticated";
GRANT ALL ON TABLE "public"."inbounds" TO "service_role";



GRANT ALL ON TABLE "public"."inquiry_action_logs" TO "anon";
GRANT ALL ON TABLE "public"."inquiry_action_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."inquiry_action_logs" TO "service_role";



GRANT ALL ON TABLE "public"."inquiry_notes" TO "anon";
GRANT ALL ON TABLE "public"."inquiry_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."inquiry_notes" TO "service_role";



GRANT ALL ON TABLE "public"."inventory" TO "anon";
GRANT ALL ON TABLE "public"."inventory" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_import_runs" TO "anon";
GRANT ALL ON TABLE "public"."inventory_import_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_import_runs" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_ledger" TO "anon";
GRANT ALL ON TABLE "public"."inventory_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_ledger" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_quantities" TO "anon";
GRANT ALL ON TABLE "public"."inventory_quantities" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_quantities" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_snapshot" TO "anon";
GRANT ALL ON TABLE "public"."inventory_snapshot" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_snapshot" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_transaction" TO "anon";
GRANT ALL ON TABLE "public"."inventory_transaction" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_transaction" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_volume_raw" TO "anon";
GRANT ALL ON TABLE "public"."inventory_volume_raw" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_volume_raw" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_volume_share" TO "anon";
GRANT ALL ON TABLE "public"."inventory_volume_share" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_volume_share" TO "service_role";



GRANT ALL ON TABLE "public"."location" TO "anon";
GRANT ALL ON TABLE "public"."location" TO "authenticated";
GRANT ALL ON TABLE "public"."location" TO "service_role";



GRANT ALL ON TABLE "public"."logistics_api_logs" TO "anon";
GRANT ALL ON TABLE "public"."logistics_api_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."logistics_api_logs" TO "service_role";



GRANT ALL ON TABLE "public"."partners" TO "anon";
GRANT ALL ON TABLE "public"."partners" TO "authenticated";
GRANT ALL ON TABLE "public"."partners" TO "service_role";



GRANT ALL ON TABLE "public"."my_partner_info" TO "anon";
GRANT ALL ON TABLE "public"."my_partner_info" TO "authenticated";
GRANT ALL ON TABLE "public"."my_partner_info" TO "service_role";



GRANT ALL ON TABLE "public"."my_tasks" TO "anon";
GRANT ALL ON TABLE "public"."my_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."my_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."notification_rules" TO "anon";
GRANT ALL ON TABLE "public"."notification_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_rules" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."order_receivers" TO "anon";
GRANT ALL ON TABLE "public"."order_receivers" TO "authenticated";
GRANT ALL ON TABLE "public"."order_receivers" TO "service_role";



GRANT ALL ON TABLE "public"."order_senders" TO "anon";
GRANT ALL ON TABLE "public"."order_senders" TO "authenticated";
GRANT ALL ON TABLE "public"."order_senders" TO "service_role";



GRANT ALL ON TABLE "public"."order_status_history" TO "anon";
GRANT ALL ON TABLE "public"."order_status_history" TO "authenticated";
GRANT ALL ON TABLE "public"."order_status_history" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."org" TO "anon";
GRANT ALL ON TABLE "public"."org" TO "authenticated";
GRANT ALL ON TABLE "public"."org" TO "service_role";



GRANT ALL ON TABLE "public"."outbound_order_line" TO "anon";
GRANT ALL ON TABLE "public"."outbound_order_line" TO "authenticated";
GRANT ALL ON TABLE "public"."outbound_order_line" TO "service_role";



GRANT ALL ON TABLE "public"."outbounds" TO "anon";
GRANT ALL ON TABLE "public"."outbounds" TO "authenticated";
GRANT ALL ON TABLE "public"."outbounds" TO "service_role";



GRANT ALL ON TABLE "public"."pack_job" TO "anon";
GRANT ALL ON TABLE "public"."pack_job" TO "authenticated";
GRANT ALL ON TABLE "public"."pack_job" TO "service_role";



GRANT ALL ON TABLE "public"."pack_job_component" TO "anon";
GRANT ALL ON TABLE "public"."pack_job_component" TO "authenticated";
GRANT ALL ON TABLE "public"."pack_job_component" TO "service_role";



GRANT ALL ON TABLE "public"."parcel_shipment" TO "anon";
GRANT ALL ON TABLE "public"."parcel_shipment" TO "authenticated";
GRANT ALL ON TABLE "public"."parcel_shipment" TO "service_role";



GRANT ALL ON TABLE "public"."photo_guide_slots" TO "anon";
GRANT ALL ON TABLE "public"."photo_guide_slots" TO "authenticated";
GRANT ALL ON TABLE "public"."photo_guide_slots" TO "service_role";



GRANT ALL ON TABLE "public"."photo_guide_templates" TO "anon";
GRANT ALL ON TABLE "public"."photo_guide_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."photo_guide_templates" TO "service_role";



GRANT ALL ON TABLE "public"."product_barcodes" TO "anon";
GRANT ALL ON TABLE "public"."product_barcodes" TO "authenticated";
GRANT ALL ON TABLE "public"."product_barcodes" TO "service_role";



GRANT ALL ON TABLE "public"."product_bom" TO "anon";
GRANT ALL ON TABLE "public"."product_bom" TO "authenticated";
GRANT ALL ON TABLE "public"."product_bom" TO "service_role";



GRANT ALL ON TABLE "public"."product_categories" TO "anon";
GRANT ALL ON TABLE "public"."product_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."product_categories" TO "service_role";



GRANT ALL ON TABLE "public"."product_uom" TO "anon";
GRANT ALL ON TABLE "public"."product_uom" TO "authenticated";
GRANT ALL ON TABLE "public"."product_uom" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."quote_calculations" TO "anon";
GRANT ALL ON TABLE "public"."quote_calculations" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_calculations" TO "service_role";



GRANT ALL ON TABLE "public"."quote_pricing_rules" TO "anon";
GRANT ALL ON TABLE "public"."quote_pricing_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_pricing_rules" TO "service_role";



GRANT ALL ON TABLE "public"."receipt_documents" TO "anon";
GRANT ALL ON TABLE "public"."receipt_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."receipt_documents" TO "service_role";



GRANT ALL ON TABLE "public"."return_order" TO "anon";
GRANT ALL ON TABLE "public"."return_order" TO "authenticated";
GRANT ALL ON TABLE "public"."return_order" TO "service_role";



GRANT ALL ON TABLE "public"."return_order_line" TO "anon";
GRANT ALL ON TABLE "public"."return_order_line" TO "authenticated";
GRANT ALL ON TABLE "public"."return_order_line" TO "service_role";



GRANT ALL ON TABLE "public"."shipping_account" TO "anon";
GRANT ALL ON TABLE "public"."shipping_account" TO "authenticated";
GRANT ALL ON TABLE "public"."shipping_account" TO "service_role";



GRANT ALL ON TABLE "public"."shipping_carrier" TO "anon";
GRANT ALL ON TABLE "public"."shipping_carrier" TO "authenticated";
GRANT ALL ON TABLE "public"."shipping_carrier" TO "service_role";



GRANT ALL ON TABLE "public"."stock_transfer" TO "anon";
GRANT ALL ON TABLE "public"."stock_transfer" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_transfer" TO "service_role";



GRANT ALL ON TABLE "public"."stock_transfer_line" TO "anon";
GRANT ALL ON TABLE "public"."stock_transfer_line" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_transfer_line" TO "service_role";



GRANT ALL ON TABLE "public"."store" TO "anon";
GRANT ALL ON TABLE "public"."store" TO "authenticated";
GRANT ALL ON TABLE "public"."store" TO "service_role";



GRANT ALL ON TABLE "public"."system_alert" TO "anon";
GRANT ALL ON TABLE "public"."system_alert" TO "authenticated";
GRANT ALL ON TABLE "public"."system_alert" TO "service_role";



GRANT ALL ON TABLE "public"."system_announcements" TO "anon";
GRANT ALL ON TABLE "public"."system_announcements" TO "authenticated";
GRANT ALL ON TABLE "public"."system_announcements" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."v_active_contracts" TO "anon";
GRANT ALL ON TABLE "public"."v_active_contracts" TO "authenticated";
GRANT ALL ON TABLE "public"."v_active_contracts" TO "service_role";



GRANT ALL ON TABLE "public"."v_customer_with_contacts" TO "anon";
GRANT ALL ON TABLE "public"."v_customer_with_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."v_customer_with_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."v_inbound_receipt_photo_progress" TO "anon";
GRANT ALL ON TABLE "public"."v_inbound_receipt_photo_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."v_inbound_receipt_photo_progress" TO "service_role";



GRANT ALL ON TABLE "public"."v_inventory_stock_current" TO "anon";
GRANT ALL ON TABLE "public"."v_inventory_stock_current" TO "authenticated";
GRANT ALL ON TABLE "public"."v_inventory_stock_current" TO "service_role";



GRANT ALL ON TABLE "public"."v_quote_to_customer_conversion" TO "anon";
GRANT ALL ON TABLE "public"."v_quote_to_customer_conversion" TO "authenticated";
GRANT ALL ON TABLE "public"."v_quote_to_customer_conversion" TO "service_role";



GRANT ALL ON TABLE "public"."warehouse" TO "anon";
GRANT ALL ON TABLE "public"."warehouse" TO "authenticated";
GRANT ALL ON TABLE "public"."warehouse" TO "service_role";



GRANT ALL ON TABLE "public"."work_orders" TO "anon";
GRANT ALL ON TABLE "public"."work_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."work_orders" TO "service_role";



GRANT ALL ON TABLE "public"."work_task_action" TO "anon";
GRANT ALL ON TABLE "public"."work_task_action" TO "authenticated";
GRANT ALL ON TABLE "public"."work_task_action" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







