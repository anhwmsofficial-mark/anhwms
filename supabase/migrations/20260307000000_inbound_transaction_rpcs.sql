-- Inbound Transaction RPCs
-- 입고 예정/수정 시 트랜잭션 보장을 위한 함수 정의

-- 1. Create Inbound Plan Full Transaction
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
AS $$
DECLARE
    v_plan_id uuid;
    v_receipt_id uuid;
    v_line jsonb;
    v_slot jsonb;
    v_tenant_id uuid;
BEGIN
    -- Tenant ID 강제 (org_id 사용)
    v_tenant_id := p_org_id;
    
    -- 1. Inbound Plan 생성
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
        (p_plan_data->>'inbound_manager'),
        'SUBMITTED',
        (p_plan_data->>'notes'),
        p_user_id,
        now(),
        now()
    ) RETURNING id INTO v_plan_id;

    -- 2. Inbound Plan Lines 생성
    IF jsonb_array_length(p_lines) > 0 THEN
        FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
        LOOP
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
                created_at,
                updated_at
            ) VALUES (
                p_org_id,
                v_tenant_id,
                v_plan_id,
                (v_line->>'product_id')::uuid,
                (v_line->>'expected_qty')::integer,
                (v_line->>'box_count')::integer,
                (v_line->>'pallet_text'),
                (v_line->>'mfg_date')::date,
                (v_line->>'expiry_date')::date,
                (v_line->>'notes'),
                (v_line->>'line_notes'),
                now(),
                now()
            );
        END LOOP;
    END IF;

    -- 3. Inbound Receipt 생성
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

    -- 4. Inbound Photo Slots 생성
    IF jsonb_array_length(p_slots) > 0 THEN
        FOR v_slot IN SELECT * FROM jsonb_array_elements(p_slots)
        LOOP
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
            ) VALUES (
                p_org_id,
                v_tenant_id,
                v_receipt_id,
                (v_slot->>'slot_key'),
                (v_slot->>'title'),
                (v_slot->>'is_required')::boolean,
                (v_slot->>'min_photos')::integer,
                (v_slot->>'sort_order')::integer,
                now()
            );
        END LOOP;
    END IF;

    -- 5. Inbound Event 로그 (CREATED)
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

EXCEPTION WHEN OTHERS THEN
    -- 에러 발생 시 자동 롤백되지만, 명시적으로 에러를 다시 던짐
    RAISE;
END;
$$;

-- 2. Update Inbound Plan Full Transaction
CREATE OR REPLACE FUNCTION public.update_inbound_plan_full(
    p_plan_id uuid,
    p_org_id uuid,
    p_user_id uuid,
    p_plan_data jsonb,
    p_lines jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_receipt_id uuid;
    v_receipt_status text;
    v_line jsonb;
    v_tenant_id uuid;
BEGIN
    v_tenant_id := p_org_id;

    -- 1. Receipt 상태 확인 (이미 확정된 건은 수정 불가)
    SELECT id, status INTO v_receipt_id, v_receipt_status
    FROM public.inbound_receipts
    WHERE plan_id = p_plan_id AND org_id = p_org_id;

    IF v_receipt_id IS NOT NULL THEN
        -- 관리자 권한 여부는 애플리케이션 레벨에서 체크했다고 가정하나,
        -- 데이터 무결성을 위해 CONFIRMED 이상은 여기서도 막는 것이 안전함 (선택사항)
        -- 여기서는 앱 로직을 존중하여 DB 레벨에서는 강제하지 않거나,
        -- 필요시 주석 해제:
        -- IF v_receipt_status IN ('CONFIRMED', 'PUTAWAY_READY', 'COMPLETED') THEN
        --     RAISE EXCEPTION '이미 확정된 입고 건은 수정할 수 없습니다.';
        -- END IF;
        
        -- Receipt 정보 업데이트
        UPDATE public.inbound_receipts
        SET
            client_id = (p_plan_data->>'client_id')::uuid,
            warehouse_id = (p_plan_data->>'warehouse_id')::uuid,
            updated_at = now()
        WHERE id = v_receipt_id;
    END IF;

    -- 2. Inbound Plan 업데이트
    UPDATE public.inbound_plans
    SET
        client_id = (p_plan_data->>'client_id')::uuid,
        warehouse_id = (p_plan_data->>'warehouse_id')::uuid,
        planned_date = (p_plan_data->>'planned_date')::date,
        inbound_manager = (p_plan_data->>'inbound_manager'),
        notes = (p_plan_data->>'notes'),
        updated_at = now()
    WHERE id = p_plan_id AND org_id = p_org_id;

    -- 3. Inbound Plan Lines 교체 (Delete & Insert)
    DELETE FROM public.inbound_plan_lines
    WHERE plan_id = p_plan_id AND org_id = p_org_id;

    IF jsonb_array_length(p_lines) > 0 THEN
        FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
        LOOP
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
                created_at,
                updated_at
            ) VALUES (
                p_org_id,
                v_tenant_id,
                p_plan_id,
                (v_line->>'product_id')::uuid,
                (v_line->>'expected_qty')::integer,
                (v_line->>'box_count')::integer,
                (v_line->>'pallet_text'),
                (v_line->>'mfg_date')::date,
                (v_line->>'expiry_date')::date,
                (v_line->>'notes'),
                (v_line->>'line_notes'),
                now(),
                now()
            );
        END LOOP;
    END IF;

    -- 4. Inbound Event 로그 (UPDATED)
    IF v_receipt_id IS NOT NULL THEN
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
            'UPDATED',
            jsonb_build_object('updated_by', p_user_id),
            p_user_id,
            now()
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'plan_id', p_plan_id,
        'receipt_id', v_receipt_id
    );

EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$;
