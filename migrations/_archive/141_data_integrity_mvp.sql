-- ====================================================================
-- MVP data integrity guard rails
-- - Prevent duplicated order numbers
-- - Prevent negative inventory quantities
-- ====================================================================

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS ux_orders_order_no
ON public.orders (order_no);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_inventory_quantities_qty_on_hand_nonnegative'
  ) THEN
    ALTER TABLE public.inventory_quantities
      ADD CONSTRAINT chk_inventory_quantities_qty_on_hand_nonnegative
      CHECK (qty_on_hand >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_inventory_quantities_qty_available_nonnegative'
  ) THEN
    ALTER TABLE public.inventory_quantities
      ADD CONSTRAINT chk_inventory_quantities_qty_available_nonnegative
      CHECK (qty_available >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_inventory_quantities_qty_allocated_nonnegative'
  ) THEN
    ALTER TABLE public.inventory_quantities
      ADD CONSTRAINT chk_inventory_quantities_qty_allocated_nonnegative
      CHECK (qty_allocated >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_inventory_quantities_qty_available_lte_on_hand'
  ) THEN
    ALTER TABLE public.inventory_quantities
      ADD CONSTRAINT chk_inventory_quantities_qty_available_lte_on_hand
      CHECK (qty_available <= qty_on_hand);
  END IF;
END $$;

COMMIT;
