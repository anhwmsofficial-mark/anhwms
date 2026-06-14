BEGIN;

CREATE OR REPLACE FUNCTION public.create_inbound_plan_full(
    p_org_id uuid,
    p_user_id uuid,
    p_plan_no text,
    p_receipt_no text,
    p_plan_data jsonb,
    p_lines jsonb,
    p_slots jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
    v_plan_id uuid;
    v_receipt_id uuid;
    v_tenant_id uuid;
BEGIN
    IF p_org_id IS NULL THEN
        RAISE EXCEPTION 'org_id is required';
    END IF;

    IF p_plan_data IS NULL OR jsonb_typeof(p_plan_data) <> 'object' THEN
        RAISE EXCEPTION 'plan_data payload is required';
    END IF;

    IF p_lines IS NULL THEN
        p_lines := '[]'::jsonb;
    END IF;

    IF p_slots IS NULL THEN
        p_slots := '[]'::jsonb;
    END IF;

    IF jsonb_typeof(p_lines) <> 'array' THEN
        RAISE EXCEPTION 'lines payload must be an array';
    END IF;

    IF jsonb_typeof(p_slots) <> 'array' THEN
        RAISE EXCEPTION 'slots payload must be an array';
    END IF;

    v_tenant_id := p_org_id;

    INSERT INTO public.inbound_plans (
        org_id,
        tenant_id,
        warehouse_id,
        client_id,
        plan_no,
        planned_date,
        inbound_manager,
        status,
        notes,
        created_by,
        created_at,
        updated_at
    ) VALUES (
        p_org_id,
        v_tenant_id,
        (p_plan_data->>'warehouse_id')::uuid,
        (p_plan_data->>'client_id')::uuid,
        p_plan_no,
        (p_plan_data->>'planned_date')::date,
        NULLIF(BTRIM(p_plan_data->>'inbound_manager'), ''),
        'SUBMITTED',
        NULLIF(BTRIM(p_plan_data->>'notes'), ''),
        p_user_id,
        now(),
        now()
    ) RETURNING id INTO v_plan_id;

    IF jsonb_array_length(p_lines) > 0 THEN
        INSERT INTO public.inbound_plan_lines (
            org_id,
            tenant_id,
            plan_id,
            product_id,
            expected_qty,
            box_count,
            pallet_text,
            mfg_date,
            expiry_date,
            notes,
            line_notes,
            created_at
        )
        SELECT
            p_org_id,
            v_tenant_id,
            v_plan_id,
            x.product_id,
            x.expected_qty,
            x.box_count,
            NULLIF(BTRIM(x.pallet_text), ''),
            x.mfg_date,
            x.expiry_date,
            NULLIF(BTRIM(x.notes), ''),
            NULLIF(BTRIM(x.line_notes), ''),
            now()
        FROM jsonb_to_recordset(p_lines) AS x(
            product_id uuid,
            expected_qty integer,
            box_count integer,
            pallet_text text,
            mfg_date date,
            expiry_date date,
            notes text,
            line_notes text
        );
    END IF;

    INSERT INTO public.inbound_receipts (
        org_id,
        tenant_id,
        warehouse_id,
        client_id,
        plan_id,
        receipt_no,
        status,
        created_by,
        created_at,
        updated_at
    ) VALUES (
        p_org_id,
        v_tenant_id,
        (p_plan_data->>'warehouse_id')::uuid,
        (p_plan_data->>'client_id')::uuid,
        v_plan_id,
        p_receipt_no,
        'ARRIVED',
        p_user_id,
        now(),
        now()
    ) RETURNING id INTO v_receipt_id;

    IF jsonb_array_length(p_slots) > 0 THEN
        INSERT INTO public.inbound_photo_slots (
            org_id,
            tenant_id,
            receipt_id,
            slot_key,
            title,
            is_required,
            min_photos,
            sort_order,
            created_at
        )
        SELECT
            p_org_id,
            v_tenant_id,
            v_receipt_id,
            x.slot_key,
            x.title,
            COALESCE(x.is_required, true),
            COALESCE(x.min_photos, 1),
            COALESCE(x.sort_order, 0),
            now()
        FROM jsonb_to_recordset(p_slots) AS x(
            slot_key text,
            title text,
            is_required boolean,
            min_photos integer,
            sort_order integer
        );
    END IF;

    INSERT INTO public.inbound_events (
        org_id,
        tenant_id,
        receipt_id,
        event_type,
        payload,
        actor_id,
        created_at
    ) VALUES (
        p_org_id,
        v_tenant_id,
        v_receipt_id,
        'CREATED',
        jsonb_build_object('plan_no', p_plan_no, 'receipt_no', p_receipt_no),
        p_user_id,
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'plan_id', v_plan_id,
        'receipt_id', v_receipt_id
    );
END;
$$;

COMMIT;
