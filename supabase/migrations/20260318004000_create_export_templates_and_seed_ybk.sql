BEGIN;

CREATE TABLE IF NOT EXISTS public.export_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.org(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES public.customer_master(id) ON DELETE SET NULL,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  sheet_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS export_templates_tenant_code_uidx
  ON public.export_templates (tenant_id, code);

CREATE INDEX IF NOT EXISTS export_templates_tenant_active_idx
  ON public.export_templates (tenant_id, is_active, created_at);

CREATE TABLE IF NOT EXISTS public.export_template_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.export_templates(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  source text NOT NULL CHECK (source IN ('MANAGE_NAME', 'OPENING_STOCK', 'TOTAL_SUM', 'CLOSING_STOCK', 'NOTE', 'TRANSACTION_TYPE')),
  transaction_type text,
  header_name text,
  width integer,
  number_format text,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS export_template_columns_template_sort_idx
  ON public.export_template_columns (template_id, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS export_template_columns_fixed_uidx
  ON public.export_template_columns (template_id, source)
  WHERE transaction_type IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS export_template_columns_movement_uidx
  ON public.export_template_columns (template_id, source, transaction_type)
  WHERE transaction_type IS NOT NULL;

ALTER TABLE public.export_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_template_columns ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.export_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.export_template_columns TO authenticated;
GRANT ALL ON TABLE public.export_templates TO service_role;
GRANT ALL ON TABLE public.export_template_columns TO service_role;

DROP POLICY IF EXISTS "Internal users can read export templates" ON public.export_templates;
DROP POLICY IF EXISTS "Internal users can write export templates" ON public.export_templates;
DROP POLICY IF EXISTS "Internal users can read export template columns" ON public.export_template_columns;
DROP POLICY IF EXISTS "Internal users can write export template columns" ON public.export_template_columns;

CREATE POLICY "Internal users can read export templates" ON public.export_templates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = export_templates.tenant_id
        AND (
          up.role IN ('admin', 'manager', 'operator')
          OR up.can_manage_inventory = true
          OR up.can_access_admin = true
        )
    )
  );

CREATE POLICY "Internal users can write export templates" ON public.export_templates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = export_templates.tenant_id
        AND (
          up.role IN ('admin', 'manager', 'operator')
          OR up.can_manage_inventory = true
          OR up.can_access_admin = true
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = export_templates.tenant_id
        AND (
          up.role IN ('admin', 'manager', 'operator')
          OR up.can_manage_inventory = true
          OR up.can_access_admin = true
        )
    )
  );

CREATE POLICY "Internal users can read export template columns" ON public.export_template_columns
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.export_templates et
      JOIN public.user_profiles up
        ON up.org_id = et.tenant_id
      WHERE et.id = export_template_columns.template_id
        AND up.id = auth.uid()
        AND (
          up.role IN ('admin', 'manager', 'operator')
          OR up.can_manage_inventory = true
          OR up.can_access_admin = true
        )
    )
  );

CREATE POLICY "Internal users can write export template columns" ON public.export_template_columns
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.export_templates et
      JOIN public.user_profiles up
        ON up.org_id = et.tenant_id
      WHERE et.id = export_template_columns.template_id
        AND up.id = auth.uid()
        AND (
          up.role IN ('admin', 'manager', 'operator')
          OR up.can_manage_inventory = true
          OR up.can_access_admin = true
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.export_templates et
      JOIN public.user_profiles up
        ON up.org_id = et.tenant_id
      WHERE et.id = export_template_columns.template_id
        AND up.id = auth.uid()
        AND (
          up.role IN ('admin', 'manager', 'operator')
          OR up.can_manage_inventory = true
          OR up.can_access_admin = true
        )
    )
  );

INSERT INTO public.export_templates (
  tenant_id,
  vendor_id,
  code,
  name,
  description,
  sheet_name,
  is_active,
  created_by
)
SELECT
  o.id,
  NULL,
  'YBK_DEFAULT',
  'YBK 기본 템플릿',
  '기본 재고 export 템플릿',
  '재고현황',
  true,
  NULL
FROM public.org o
WHERE NOT EXISTS (
  SELECT 1
  FROM public.export_templates et
  WHERE et.tenant_id = o.id
    AND et.code = 'YBK_DEFAULT'
);

WITH ybk_templates AS (
  SELECT id
  FROM public.export_templates
  WHERE code = 'YBK_DEFAULT'
)
INSERT INTO public.export_template_columns (
  template_id,
  sort_order,
  source,
  transaction_type,
  header_name,
  width,
  number_format,
  is_visible
)
SELECT
  t.id,
  c.sort_order,
  c.source,
  c.transaction_type,
  c.header_name,
  c.width,
  c.number_format,
  true
FROM ybk_templates t
JOIN (
  VALUES
    (10,  'MANAGE_NAME',      NULL,                        '관리명',               28, NULL),
    (20,  'OPENING_STOCK',    NULL,                        '전일재고',             14, '#,##0'),
    (30,  'TRANSACTION_TYPE', 'DAMAGE',                    '파손',                 14, '#,##0'),
    (40,  'TRANSACTION_TYPE', 'RETURN_B2C',                '반품(B2C)',            14, '#,##0'),
    (50,  'TRANSACTION_TYPE', 'DISPOSAL',                  '폐기(-)',              14, '#,##0'),
    (60,  'TRANSACTION_TYPE', 'JET_RETURN',                '제트회송(+)',          14, '#,##0'),
    (70,  'TRANSACTION_TYPE', 'RETURN_MILKRUN',            '반품(밀크런)',         14, '#,##0'),
    (80,  'TRANSACTION_TYPE', 'FREIGHT_QUICK_OUT',         '화물(퀵)',             14, '#,##0'),
    (90,  'TRANSACTION_TYPE', 'OFFICE_USE_OUT',            '비품(-)',              14, '#,##0'),
    (100, 'TRANSACTION_TYPE', 'FIRE_IN',                   '화재(+)',              14, '#,##0'),
    (110, 'TRANSACTION_TYPE', 'FIRE_OUT',                  '화재(-)',              14, '#,##0'),
    (120, 'TRANSACTION_TYPE', 'INBOUND',                   '입고',                 14, '#,##0'),
    (130, 'TRANSACTION_TYPE', 'RECLASSIFY_GOOD_IN',        '양품화(+)',            14, '#,##0'),
    (140, 'TRANSACTION_TYPE', 'JET_TRANSFER_OUT',          '제트이관(-)',          14, '#,##0'),
    (150, 'TRANSACTION_TYPE', 'JET_TRANSFER_CANCEL_IN',    '제트이관작업취소(+)',  14, '#,##0'),
    (160, 'TRANSACTION_TYPE', 'ADVANCE_EXCHANGE_IN',       '선교환(+)',            14, '#,##0'),
    (170, 'TRANSACTION_TYPE', 'ADVANCE_EXCHANGE_OUT',      '선교환(-)',            14, '#,##0'),
    (180, 'TRANSACTION_TYPE', 'COUPANG_MILKRUN_OUT',       '쿠팡(밀크런)',         14, '#,##0'),
    (190, 'TRANSACTION_TYPE', 'STOCK_ADJUSTMENT_IN',       '재고조정(+)',          14, '#,##0'),
    (200, 'TRANSACTION_TYPE', 'STOCK_ADJUSTMENT_OUT',      '재고조정(-)',          14, '#,##0'),
    (210, 'TRANSACTION_TYPE', 'SAMPLE_OUT',                '샘플(-)',              14, '#,##0'),
    (220, 'TRANSACTION_TYPE', 'REPACK_INBOUND_IN',         '재포장입고(+)',        14, '#,##0'),
    (230, 'TRANSACTION_TYPE', 'EXPORT_PICKUP_OUT',         '수출픽업(-)',          14, '#,##0'),
    (240, 'TRANSACTION_TYPE', 'BUNDLE_SPLIT_IN',           '번들해체(+)',          14, '#,##0'),
    (250, 'TRANSACTION_TYPE', 'BUNDLE_SPLIT_OUT',          '번들해체(-)',          14, '#,##0'),
    (260, 'TRANSACTION_TYPE', 'BUNDLE_IN',                 '번들(+)',              14, '#,##0'),
    (270, 'TRANSACTION_TYPE', 'BUNDLE_OUT',                '번들(-)',              14, '#,##0'),
    (280, 'TRANSACTION_TYPE', 'REPACK_IN',                 '재포장(+)',            14, '#,##0'),
    (290, 'TRANSACTION_TYPE', 'REPACK_OUT',                '재포장(-)',            14, '#,##0'),
    (300, 'TRANSACTION_TYPE', 'RELABEL_IN',                '라벨작업(+)',          14, '#,##0'),
    (310, 'TRANSACTION_TYPE', 'RELABEL_OUT',               '라벨작업(-)',          14, '#,##0'),
    (320, 'TRANSACTION_TYPE', 'ROCKET_GROWTH_PARCEL_OUT',  '로켓그로스(택배)',     14, '#,##0'),
    (330, 'TRANSACTION_TYPE', 'CAFE_DISPLAY_IN',           '카페진열(+)',          14, '#,##0'),
    (340, 'TRANSACTION_TYPE', 'CAFE_DISPLAY_OUT',          '카페진열(-)',          14, '#,##0'),
    (350, 'TRANSACTION_TYPE', 'OUTBOUND_CANCEL_IN',        '출고취소',             14, '#,##0'),
    (360, 'TRANSACTION_TYPE', 'PARCEL_OUT',                '택배',                 14, '#,##0'),
    (370, 'TRANSACTION_TYPE', 'INVENTORY_INIT',            '초기재고',             14, '#,##0'),
    (380, 'TRANSACTION_TYPE', 'OUTBOUND',                  '출고',                 14, '#,##0'),
    (390, 'TRANSACTION_TYPE', 'TRANSFER',                  '이관',                 14, '#,##0'),
    (970, 'TOTAL_SUM',         NULL,                       '총합계',               14, '#,##0'),
    (980, 'CLOSING_STOCK',     NULL,                       '마감재고',             14, '#,##0'),
    (990, 'NOTE',              NULL,                       '비고',                 30, NULL)
) AS c(sort_order, source, transaction_type, header_name, width, number_format)
  ON true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.export_template_columns etc
  WHERE etc.template_id = t.id
    AND etc.source = c.source
    AND (
      (etc.transaction_type IS NULL AND c.transaction_type IS NULL)
      OR etc.transaction_type = c.transaction_type
    )
);

COMMIT;

NOTIFY pgrst, 'reload schema';
