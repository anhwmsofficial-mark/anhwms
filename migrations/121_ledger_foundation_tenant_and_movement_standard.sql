-- ====================================================================
-- Ledger Foundation: tenant_id + movement standardization
-- - 기존 inventory_ledger/org_id 구조는 유지
-- - movement_type, direction, quantity(절대값) 표준 컬럼 추가
-- - tenant_id 도입 (org_id와 동기화)
-- - snapshot/조회 뷰 추가
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- [1] inventory_ledger 표준 컬럼 추가
-- --------------------------------------------------------------------
ALTER TABLE inventory_ledger
  ADD COLUMN IF NOT EXISTS tenant_id uuid,
  ADD COLUMN IF NOT EXISTS movement_type text,
  ADD COLUMN IF NOT EXISTS direction text,
  ADD COLUMN IF NOT EXISTS quantity integer,
  ADD COLUMN IF NOT EXISTS memo text,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS source_hash text;

-- org_id -> tenant_id 백필
UPDATE inventory_ledger
SET tenant_id = org_id
WHERE tenant_id IS NULL
  AND org_id IS NOT NULL;

-- legacy 컬럼 기반 표준 컬럼 백필
UPDATE inventory_ledger
SET
  movement_type = COALESCE(
    movement_type,
    CASE transaction_type
      WHEN 'INBOUND' THEN 'INBOUND'
      WHEN 'OUTBOUND' THEN 'OUTBOUND'
      WHEN 'RETURN' THEN 'RETURN_B2C'
      WHEN 'TRANSFER' THEN 'TRANSFER'
      WHEN 'ADJUSTMENT' THEN CASE WHEN qty_change >= 0 THEN 'ADJUSTMENT_PLUS' ELSE 'ADJUSTMENT_MINUS' END
      ELSE 'ADJUSTMENT_PLUS'
    END
  ),
  direction = COALESCE(direction, CASE WHEN qty_change >= 0 THEN 'IN' ELSE 'OUT' END),
  quantity = COALESCE(quantity, ABS(qty_change)),
  memo = COALESCE(memo, notes)
WHERE movement_type IS NULL
   OR direction IS NULL
   OR quantity IS NULL
   OR memo IS NULL;

-- 방향/수량 불변성
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_ledger_direction_chk'
  ) THEN
    ALTER TABLE inventory_ledger
      ADD CONSTRAINT inventory_ledger_direction_chk
      CHECK (direction IN ('IN', 'OUT'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_ledger_quantity_positive_chk'
  ) THEN
    ALTER TABLE inventory_ledger
      ADD CONSTRAINT inventory_ledger_quantity_positive_chk
      CHECK (quantity IS NOT NULL AND quantity >= 0);
  END IF;
END $$;

-- movement_type 표준 enum 대체용 CHECK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_ledger_movement_type_chk'
  ) THEN
    ALTER TABLE inventory_ledger
      ADD CONSTRAINT inventory_ledger_movement_type_chk
      CHECK (
        movement_type IN (
          'INVENTORY_INIT',
          'INBOUND',
          'OUTBOUND',
          'OUTBOUND_CANCEL',
          'DISPOSAL',
          'DAMAGE',
          'RETURN_B2C',
          'ADJUSTMENT_PLUS',
          'ADJUSTMENT_MINUS',
          'BUNDLE_BREAK_IN',
          'BUNDLE_BREAK_OUT',
          'EXPORT_PICKUP',
          'TRANSFER'
        )
      );
  END IF;
END $$;

-- movement_type <-> direction 조합 제약
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_ledger_movement_direction_chk'
  ) THEN
    ALTER TABLE inventory_ledger
      ADD CONSTRAINT inventory_ledger_movement_direction_chk
      CHECK (
        (movement_type IN ('INVENTORY_INIT', 'INBOUND', 'RETURN_B2C', 'ADJUSTMENT_PLUS', 'BUNDLE_BREAK_IN', 'OUTBOUND_CANCEL') AND direction = 'IN')
        OR
        (movement_type IN ('OUTBOUND', 'DISPOSAL', 'DAMAGE', 'ADJUSTMENT_MINUS', 'BUNDLE_BREAK_OUT', 'EXPORT_PICKUP') AND direction = 'OUT')
        OR
        (movement_type = 'TRANSFER')
      );
  END IF;
END $$;

-- legacy signed qty_change와 표준 컬럼 동기화 제약
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_ledger_qty_consistency_chk'
  ) THEN
    ALTER TABLE inventory_ledger
      ADD CONSTRAINT inventory_ledger_qty_consistency_chk
      CHECK (
        qty_change IS NULL
        OR (
          (direction = 'IN' AND qty_change = quantity)
          OR
          (direction = 'OUT' AND qty_change = -quantity)
        )
      );
  END IF;
END $$;

-- --------------------------------------------------------------------
-- [2] tenant_id/조회 인덱스
-- --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_inventory_ledger_tenant_product_created
  ON inventory_ledger(tenant_id, product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_ledger_tenant_movement_created
  ON inventory_ledger(tenant_id, movement_type, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_ledger_tenant_idempotency
  ON inventory_ledger(tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- --------------------------------------------------------------------
-- [3] inventory_snapshot (일 마감 캐시)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_snapshot (
  snapshot_date date not null,
  tenant_id uuid not null,
  product_id uuid not null references products(id) on delete cascade,
  closing_stock integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  PRIMARY KEY (snapshot_date, tenant_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_snapshot_tenant_product
  ON inventory_snapshot(tenant_id, product_id, snapshot_date DESC);

ALTER TABLE inventory_snapshot ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal users can read inventory snapshot" ON inventory_snapshot;
DROP POLICY IF EXISTS "Internal users can write inventory snapshot" ON inventory_snapshot;

CREATE POLICY "Internal users can read inventory snapshot" ON inventory_snapshot
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inventory_snapshot.tenant_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  );

CREATE POLICY "Internal users can write inventory snapshot" ON inventory_snapshot
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inventory_snapshot.tenant_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inventory_snapshot.tenant_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  );

-- --------------------------------------------------------------------
-- [4] 현재고 조회 View (Ledger 누적합)
-- --------------------------------------------------------------------
CREATE OR REPLACE VIEW v_inventory_stock_current AS
SELECT
  il.tenant_id,
  il.product_id,
  COALESCE(SUM(CASE WHEN il.direction = 'IN' THEN il.quantity ELSE -il.quantity END), 0)::integer AS current_stock
FROM inventory_ledger il
GROUP BY il.tenant_id, il.product_id;

-- --------------------------------------------------------------------
-- [5] 기존 쓰기 호환: 표준 컬럼 자동 동기화 트리거
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_inventory_ledger_standard_columns()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_inventory_ledger_standard_columns ON inventory_ledger;
CREATE TRIGGER trg_sync_inventory_ledger_standard_columns
  BEFORE INSERT OR UPDATE ON inventory_ledger
  FOR EACH ROW
  EXECUTE FUNCTION sync_inventory_ledger_standard_columns();

COMMIT;

NOTIFY pgrst, 'reload schema';
