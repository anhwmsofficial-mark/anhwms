-- ====================================================================
-- Supabase security lint fixes
-- - SECURITY DEFINER view -> SECURITY INVOKER
-- - Enable RLS on public tables flagged by linter
-- - Add internal user policies to avoid accidental full lockout
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- 1) Views: force security_invoker
-- --------------------------------------------------------------------
ALTER VIEW IF EXISTS public.v_inventory_stock_current
  SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_customer_with_contacts
  SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_inbound_receipt_photo_progress
  SET (security_invoker = true);
ALTER VIEW IF EXISTS public.admin_users
  SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_quote_to_customer_conversion
  SET (security_invoker = true);
ALTER VIEW IF EXISTS public.my_partner_info
  SET (security_invoker = true);

-- --------------------------------------------------------------------
-- 2) Tables: enable RLS
-- --------------------------------------------------------------------
ALTER TABLE IF EXISTS public.external_quote_inquiry ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.quote_pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.quote_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inventory_volume_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inventory_volume_share ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- 3) external_quote_inquiry
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "internal_read_external_quote_inquiry" ON public.external_quote_inquiry;
DROP POLICY IF EXISTS "internal_all_external_quote_inquiry" ON public.external_quote_inquiry;

CREATE POLICY "internal_read_external_quote_inquiry"
ON public.external_quote_inquiry
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND (up.role IN ('admin', 'manager', 'operator') OR up.can_access_admin = true)
  )
);

CREATE POLICY "internal_all_external_quote_inquiry"
ON public.external_quote_inquiry
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND (up.role IN ('admin', 'manager', 'operator') OR up.can_access_admin = true)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND (up.role IN ('admin', 'manager', 'operator') OR up.can_access_admin = true)
  )
);

-- --------------------------------------------------------------------
-- 4) email_logs
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "internal_read_email_logs" ON public.email_logs;
DROP POLICY IF EXISTS "internal_all_email_logs" ON public.email_logs;

CREATE POLICY "internal_read_email_logs"
ON public.email_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND (up.role IN ('admin', 'manager', 'operator') OR up.can_access_admin = true)
  )
);

CREATE POLICY "internal_all_email_logs"
ON public.email_logs
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND (up.role IN ('admin', 'manager', 'operator') OR up.can_access_admin = true)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND (up.role IN ('admin', 'manager', 'operator') OR up.can_access_admin = true)
  )
);

-- --------------------------------------------------------------------
-- 5) notification_rules
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "internal_read_notification_rules" ON public.notification_rules;
DROP POLICY IF EXISTS "internal_all_notification_rules" ON public.notification_rules;

CREATE POLICY "internal_read_notification_rules"
ON public.notification_rules
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND (up.role IN ('admin', 'manager') OR up.can_access_admin = true)
  )
);

CREATE POLICY "internal_all_notification_rules"
ON public.notification_rules
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND (up.role IN ('admin', 'manager') OR up.can_access_admin = true)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND (up.role IN ('admin', 'manager') OR up.can_access_admin = true)
  )
);

-- --------------------------------------------------------------------
-- 6) quote_pricing_rules
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "internal_read_quote_pricing_rules" ON public.quote_pricing_rules;
DROP POLICY IF EXISTS "internal_all_quote_pricing_rules" ON public.quote_pricing_rules;

CREATE POLICY "internal_read_quote_pricing_rules"
ON public.quote_pricing_rules
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND (up.role IN ('admin', 'manager') OR up.can_access_admin = true)
  )
);

CREATE POLICY "internal_all_quote_pricing_rules"
ON public.quote_pricing_rules
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND (up.role IN ('admin', 'manager') OR up.can_access_admin = true)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND (up.role IN ('admin', 'manager') OR up.can_access_admin = true)
  )
);

-- --------------------------------------------------------------------
-- 7) quote_calculations
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "internal_read_quote_calculations" ON public.quote_calculations;
DROP POLICY IF EXISTS "internal_all_quote_calculations" ON public.quote_calculations;

CREATE POLICY "internal_read_quote_calculations"
ON public.quote_calculations
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND (up.role IN ('admin', 'manager', 'operator') OR up.can_access_admin = true)
  )
);

CREATE POLICY "internal_all_quote_calculations"
ON public.quote_calculations
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND (up.role IN ('admin', 'manager', 'operator') OR up.can_access_admin = true)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND (up.role IN ('admin', 'manager', 'operator') OR up.can_access_admin = true)
  )
);

-- --------------------------------------------------------------------
-- 8) inventory_volume_raw
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "internal_read_inventory_volume_raw" ON public.inventory_volume_raw;
DROP POLICY IF EXISTS "internal_all_inventory_volume_raw" ON public.inventory_volume_raw;

CREATE POLICY "internal_read_inventory_volume_raw"
ON public.inventory_volume_raw
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND (
        up.role IN ('admin', 'manager', 'operator')
        OR up.can_manage_inventory = true
        OR up.can_access_admin = true
      )
  )
);

CREATE POLICY "internal_all_inventory_volume_raw"
ON public.inventory_volume_raw
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
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
      AND (
        up.role IN ('admin', 'manager', 'operator')
        OR up.can_manage_inventory = true
        OR up.can_access_admin = true
      )
  )
);

-- --------------------------------------------------------------------
-- 9) inventory_volume_share
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "internal_read_inventory_volume_share" ON public.inventory_volume_share;
DROP POLICY IF EXISTS "internal_all_inventory_volume_share" ON public.inventory_volume_share;

CREATE POLICY "internal_read_inventory_volume_share"
ON public.inventory_volume_share
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND (
        up.role IN ('admin', 'manager', 'operator')
        OR up.can_manage_inventory = true
        OR up.can_access_admin = true
      )
  )
);

CREATE POLICY "internal_all_inventory_volume_share"
ON public.inventory_volume_share
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
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
      AND (
        up.role IN ('admin', 'manager', 'operator')
        OR up.can_manage_inventory = true
        OR up.can_access_admin = true
      )
  )
);

COMMIT;

NOTIFY pgrst, 'reload schema';
