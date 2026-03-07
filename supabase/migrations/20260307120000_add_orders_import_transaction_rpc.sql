BEGIN;

CREATE OR REPLACE FUNCTION public.import_order_with_receiver(
  p_order_no text,
  p_country_code text,
  p_product_name text,
  p_remark text,
  p_logistics_company text,
  p_status text,
  p_receiver_name text,
  p_receiver_phone text,
  p_receiver_zip text,
  p_receiver_address1 text,
  p_receiver_address2 text,
  p_receiver_locality text,
  p_receiver_country_code text,
  p_receiver_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_order_id uuid;
BEGIN
  INSERT INTO public.orders (
    order_no,
    country_code,
    product_name,
    remark,
    logistics_company,
    status
  ) VALUES (
    p_order_no,
    p_country_code,
    p_product_name,
    p_remark,
    p_logistics_company,
    COALESCE(NULLIF(p_status, ''), 'CREATED')
  )
  RETURNING id INTO v_order_id;

  INSERT INTO public.order_receivers (
    order_id,
    name,
    phone,
    zip,
    address1,
    address2,
    locality,
    country_code,
    meta
  ) VALUES (
    v_order_id,
    p_receiver_name,
    p_receiver_phone,
    p_receiver_zip,
    p_receiver_address1,
    p_receiver_address2,
    p_receiver_locality,
    p_receiver_country_code,
    COALESCE(p_receiver_meta, '{}'::jsonb)
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'logistics_company', p_logistics_company
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'failed_stage', 'order_insert',
      'error_code', 'DUPLICATE_ORDER_NO',
      'error_message', '중복 주문번호'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'failed_stage', CASE WHEN v_order_id IS NULL THEN 'order_insert' ELSE 'recipient_insert' END,
      'error_code', 'IMPORT_ROW_ERROR',
      'error_message', SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_order_with_receiver(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
) TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
