-- Audit Log Enhancement Migration
-- 1. Unify table name to 'audit_logs' (plural)
-- 2. Add columns for application-level context (request_id, route, etc.)
-- 3. Update trigger to capture context from headers/claims if available

BEGIN;

-- Check if 'audit_log' (singular) exists and migrate it into the canonical
-- public.audit_logs table using the real production column names.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_log') THEN
        INSERT INTO public.audit_logs (
            actor_id,
            actor_role,
            action_type,
            resource_type,
            resource_id,
            old_value,
            new_value,
            reason,
            created_at
        )
        SELECT
            NULLIF(to_jsonb(src)->>'user_id', '')::uuid,
            NULL,
            COALESCE(NULLIF(to_jsonb(src)->>'action', ''), 'LEGACY_MIGRATION'),
            COALESCE(
                NULLIF(to_jsonb(src)->>'entity_type', ''),
                NULLIF(to_jsonb(src)->>'table_name', ''),
                'legacy_audit_log'
            ),
            COALESCE(
                NULLIF(to_jsonb(src)->>'record_id', ''),
                NULLIF(to_jsonb(src)->>'entity_id', ''),
                NULLIF(to_jsonb(src)->>'id', '')
            ),
            CASE
                WHEN jsonb_typeof(to_jsonb(src)->'old_value') IS NOT NULL THEN to_jsonb(src)->'old_value'
                ELSE NULL
            END,
            CASE
                WHEN jsonb_typeof(to_jsonb(src)->'new_value') IS NOT NULL THEN to_jsonb(src)->'new_value'
                ELSE NULL
            END,
            NULLIF(
                trim(
                    both ' ' from concat_ws(
                        ' | ',
                        NULLIF(to_jsonb(src)->>'route', ''),
                        NULLIF(to_jsonb(src)->>'action_name', '')
                    )
                ),
                ''
            ),
            COALESCE(NULLIF(to_jsonb(src)->>'created_at', '')::timestamptz, now())
        FROM public.audit_log src;

        DROP TABLE public.audit_log;
    END IF;
END $$;

-- Add new columns to audit_logs
ALTER TABLE public.audit_logs
ADD COLUMN IF NOT EXISTS request_id uuid,
ADD COLUMN IF NOT EXISTS route text,
ADD COLUMN IF NOT EXISTS action_name text,
ADD COLUMN IF NOT EXISTS entity_type text,
ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id ON public.audit_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON public.audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_name ON public.audit_logs(action_name);

-- Update the trigger function to write into the real audit_logs schema and
-- enrich rows with request-scoped metadata where available.
CREATE OR REPLACE FUNCTION public.fn_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor_id uuid;
  v_record_id text;
  v_request_id uuid;
  v_route text;
  v_action_name text;
  v_metadata jsonb;
BEGIN
  -- Prevent infinite recursion
  IF TG_TABLE_SCHEMA = 'public' AND (TG_TABLE_NAME = 'audit_logs' OR TG_TABLE_NAME = 'audit_log') THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  -- Get actor id
  v_actor_id := COALESCE(
    auth.uid(),
    NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
  );

  -- Try to get request_id from headers (passed by Middleware -> Supabase Client)
  -- Note: Supabase PostgREST might expose headers via request.headers
  BEGIN
    v_request_id := (current_setting('request.headers', true)::json->>'x-request-id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_request_id := NULL;
  END;

  BEGIN
    v_route := NULLIF(current_setting('request.headers', true)::json->>'x-pathname', '');
  EXCEPTION WHEN OTHERS THEN
    v_route := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    v_record_id := COALESCE(to_jsonb(NEW)->>'id', to_jsonb(OLD)->>'id');
    v_action_name := format('%s_%s', lower(TG_OP), TG_TABLE_NAME);
    v_metadata := jsonb_build_object('table_name', TG_TABLE_NAME, 'trigger_op', TG_OP);

    INSERT INTO public.audit_logs
      (actor_id, action_type, resource_type, resource_id, old_value, new_value, reason, request_id, route, action_name, entity_type, metadata)
    VALUES
      (v_actor_id, TG_OP, TG_TABLE_NAME, v_record_id, NULL, to_jsonb(NEW), NULL, v_request_id, v_route, v_action_name, TG_TABLE_NAME, v_metadata);

    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_record_id := COALESCE(to_jsonb(NEW)->>'id', to_jsonb(OLD)->>'id');
    v_action_name := format('%s_%s', lower(TG_OP), TG_TABLE_NAME);
    v_metadata := jsonb_build_object('table_name', TG_TABLE_NAME, 'trigger_op', TG_OP);

    INSERT INTO public.audit_logs
      (actor_id, action_type, resource_type, resource_id, old_value, new_value, reason, request_id, route, action_name, entity_type, metadata)
    VALUES
      (v_actor_id, TG_OP, TG_TABLE_NAME, v_record_id, to_jsonb(OLD), to_jsonb(NEW), NULL, v_request_id, v_route, v_action_name, TG_TABLE_NAME, v_metadata);

    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_record_id := to_jsonb(OLD)->>'id';
    v_action_name := format('%s_%s', lower(TG_OP), TG_TABLE_NAME);
    v_metadata := jsonb_build_object('table_name', TG_TABLE_NAME, 'trigger_op', TG_OP);

    INSERT INTO public.audit_logs
      (actor_id, action_type, resource_type, resource_id, old_value, new_value, reason, request_id, route, action_name, entity_type, metadata)
    VALUES
      (v_actor_id, TG_OP, TG_TABLE_NAME, v_record_id, to_jsonb(OLD), NULL, NULL, v_request_id, v_route, v_action_name, TG_TABLE_NAME, v_metadata);

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- Fix table permissions for the new columns
GRANT ALL ON TABLE public.audit_logs TO authenticated;
GRANT ALL ON TABLE public.audit_logs TO service_role;

COMMIT;
