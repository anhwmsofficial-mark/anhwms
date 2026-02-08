-- ====================================================================
-- P0 Security/Integrity Hardening
-- - RLS 최소 권한 정책 적용
-- - 재고/입고 동시성 보강
-- ====================================================================

-- --------------------------------------------------------------------
-- [1] 내부 사용자 판별 조건(반복 사용)
-- --------------------------------------------------------------------
-- NOTE: user_profiles 테이블 기반 + org_id 매칭
--       partner 및 외부 사용자는 제외

-- --------------------------------------------------------------------
-- [2] RLS 정책 강화
-- --------------------------------------------------------------------

-- Inventory Ledger & Quantities
ALTER TABLE inventory_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_quantities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for authenticated users" ON inventory_ledger;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON inventory_ledger;
DROP POLICY IF EXISTS "View inventory ledger" ON inventory_ledger;

CREATE POLICY "Internal users can read inventory ledger" ON inventory_ledger
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inventory_ledger.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  );

CREATE POLICY "Internal users can insert inventory ledger" ON inventory_ledger
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inventory_ledger.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  );

DROP POLICY IF EXISTS "Enable read for authenticated users" ON inventory_quantities;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON inventory_quantities;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON inventory_quantities;

CREATE POLICY "Internal users can read inventory quantities" ON inventory_quantities
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inventory_quantities.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  );

CREATE POLICY "Internal users can update inventory quantities" ON inventory_quantities
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inventory_quantities.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  );

CREATE POLICY "Internal users can insert inventory quantities" ON inventory_quantities
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inventory_quantities.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  );

-- Inbound core tables
ALTER TABLE inbound_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_plan_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_receipt_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_receipt_photo_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_photo_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_guide_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_guide_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for authenticated users" ON inbound_plans;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON inbound_plans;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON inbound_plans;

DROP POLICY IF EXISTS "Enable read for authenticated users" ON inbound_plan_lines;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON inbound_plan_lines;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON inbound_plan_lines;

DROP POLICY IF EXISTS "Enable read for authenticated users" ON inbound_receipts;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON inbound_receipts;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON inbound_receipts;

DROP POLICY IF EXISTS "Enable read for authenticated users" ON inbound_receipt_lines;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON inbound_receipt_lines;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON inbound_receipt_lines;

DROP POLICY IF EXISTS "Enable all for authenticated users" ON photo_guide_templates;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON photo_guide_slots;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON inbound_receipt_photo_requirements;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON inbound_photo_slots;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON inbound_photos;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON inbound_issues;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON inbound_events;
DROP POLICY IF EXISTS "All access inspections" ON inbound_inspections;
DROP POLICY IF EXISTS "View inspections" ON inbound_inspections;
DROP POLICY IF EXISTS "Create inspections" ON inbound_inspections;

CREATE POLICY "Internal users can read inbound plans" ON inbound_plans
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inbound_plans.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  );
CREATE POLICY "Internal users can insert inbound plans" ON inbound_plans
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inbound_plans.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  );
CREATE POLICY "Internal users can update inbound plans" ON inbound_plans
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inbound_plans.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  );
CREATE POLICY "Internal users can delete inbound plans" ON inbound_plans
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inbound_plans.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  );

CREATE POLICY "Internal users can read inbound plan lines" ON inbound_plan_lines
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inbound_plan_lines.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  );
CREATE POLICY "Internal users can insert inbound plan lines" ON inbound_plan_lines
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inbound_plan_lines.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  );
CREATE POLICY "Internal users can update inbound plan lines" ON inbound_plan_lines
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inbound_plan_lines.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  );
CREATE POLICY "Internal users can delete inbound plan lines" ON inbound_plan_lines
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inbound_plan_lines.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  );

CREATE POLICY "Internal users can read inbound receipts" ON inbound_receipts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inbound_receipts.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  );
CREATE POLICY "Internal users can insert inbound receipts" ON inbound_receipts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inbound_receipts.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  );
CREATE POLICY "Internal users can update inbound receipts" ON inbound_receipts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inbound_receipts.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  );
CREATE POLICY "Internal users can delete inbound receipts" ON inbound_receipts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inbound_receipts.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  );

CREATE POLICY "Internal users can read inbound receipt lines" ON inbound_receipt_lines
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inbound_receipt_lines.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  );
CREATE POLICY "Internal users can insert inbound receipt lines" ON inbound_receipt_lines
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inbound_receipt_lines.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  );
CREATE POLICY "Internal users can update inbound receipt lines" ON inbound_receipt_lines
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inbound_receipt_lines.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  );
CREATE POLICY "Internal users can delete inbound receipt lines" ON inbound_receipt_lines
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inbound_receipt_lines.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  );

CREATE POLICY "Internal users can manage photo guides" ON photo_guide_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = photo_guide_templates.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = photo_guide_templates.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  );

CREATE POLICY "Internal users can manage photo guide slots" ON photo_guide_slots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = photo_guide_slots.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = photo_guide_slots.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  );

CREATE POLICY "Internal users can manage receipt photo requirements" ON inbound_receipt_photo_requirements
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inbound_receipt_photo_requirements.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inbound_receipt_photo_requirements.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  );

CREATE POLICY "Internal users can manage inbound photo slots" ON inbound_photo_slots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inbound_photo_slots.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inbound_photo_slots.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  );

CREATE POLICY "Internal users can manage inbound photos" ON inbound_photos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inbound_photos.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inbound_photos.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  );

CREATE POLICY "Internal users can manage inbound issues" ON inbound_issues
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inbound_issues.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inbound_issues.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  );

CREATE POLICY "Internal users can manage inbound events" ON inbound_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inbound_events.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inbound_events.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  );

-- inbound_inspections org_id 보강 (기존 테이블 호환)
ALTER TABLE inbound_inspections
  ADD COLUMN IF NOT EXISTS org_id UUID;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'inbounds' AND column_name = 'org_id'
  ) THEN
    UPDATE inbound_inspections ii
    SET org_id = i.org_id
    FROM inbounds i
    WHERE ii.inbound_id = i.id
      AND ii.org_id IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'org'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'fk_inbound_inspections_org'
    ) THEN
      ALTER TABLE inbound_inspections
        ADD CONSTRAINT fk_inbound_inspections_org
        FOREIGN KEY (org_id) REFERENCES org(id);
    END IF;
  END IF;
END $$;

CREATE POLICY "Internal users can manage inbound inspections" ON inbound_inspections
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inbound_inspections.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.org_id = inbound_inspections.org_id
        AND (up.role IN ('admin','manager','operator') OR up.can_manage_inventory = true OR up.can_access_admin = true)
    )
  );

-- --------------------------------------------------------------------
-- [3] 재고 동시성 보강 (레거시 트리거 대응)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_product_stock()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------------------
-- [4] 입고 확정 RPC 원자성/락 보강
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION confirm_inbound_receipt(p_receipt_id UUID, p_user_id UUID)
RETURNS JSONB AS $$
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
$$ LANGUAGE plpgsql;

NOTIFY pgrst, 'reload schema';
