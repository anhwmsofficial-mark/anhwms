BEGIN;

-- --------------------------------------------------------------------
-- 1) Ensure inbound inventory snapshot table exists for receipt detail UI
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inbound_inventory_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  warehouse_id uuid NOT NULL,
  receipt_id uuid NOT NULL REFERENCES public.inbound_receipts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  qty_before integer NOT NULL DEFAULT 0,
  qty_after integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inbound_inventory_snapshots_receipt_idx
  ON public.inbound_inventory_snapshots(receipt_id);

CREATE INDEX IF NOT EXISTS inbound_inventory_snapshots_product_idx
  ON public.inbound_inventory_snapshots(product_id);

ALTER TABLE public.inbound_inventory_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.inbound_inventory_snapshots;
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.inbound_inventory_snapshots;

CREATE POLICY "Allow read for authenticated users"
ON public.inbound_inventory_snapshots
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

GRANT SELECT ON TABLE public.inbound_inventory_snapshots TO authenticated;
GRANT ALL ON TABLE public.inbound_inventory_snapshots TO service_role;

-- --------------------------------------------------------------------
-- 2) Reconcile inbound share policies for environments behind migrations
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.inbound_receipt_shares;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.inbound_receipt_shares;

CREATE POLICY "Enable all access for authenticated users"
ON public.inbound_receipt_shares
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

COMMIT;

NOTIFY pgrst, 'reload schema';
