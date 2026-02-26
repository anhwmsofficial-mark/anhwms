-- ====================================================================
-- ANH WMS v2 - 현장형 입고(Inbound) 시스템 ERD
-- ====================================================================
-- 설명: 입고예정 -> 실제입고 -> 검수완료 프로세스 및 사진 증빙 강제화
-- 포함: 입고예정, 실입고, 라인아이템, 사진가이드, 이슈, 이벤트로그
-- ====================================================================

-- 1. 유틸리티 함수 (updated_at 자동 갱신용)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ====================================================================
-- A. 입고예정 (Plan)
-- ====================================================================
CREATE TABLE IF NOT EXISTS inbound_plans (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null,
  warehouse_id        uuid not null, -- references warehouse(id)
  client_id           uuid not null, -- references customer_master(id)
  plan_no             text not null, -- 예: INP-20260122-0001
  planned_date        date not null,
  status              text not null default 'DRAFT' check (status in ('DRAFT','SUBMITTED','NOTIFIED','CLOSED','CANCELLED')),
  notes               text,
  created_by          uuid references auth.users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (org_id, plan_no)
);

CREATE INDEX IF NOT EXISTS inbound_plans_org_wh_date_idx on inbound_plans(org_id, warehouse_id, planned_date);
CREATE TRIGGER update_inbound_plans_modtime BEFORE UPDATE ON inbound_plans FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE IF NOT EXISTS inbound_plan_lines (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null,
  plan_id             uuid not null references inbound_plans(id) on delete cascade,
  product_id          uuid not null, -- references product(id)
  expected_qty        integer not null check (expected_qty >= 0),
  uom                 text default 'EA',
  lot_no              text,
  expiry_date         date,
  notes               text,
  created_at          timestamptz not null default now(),
  unique(plan_id, product_id, lot_no, expiry_date) -- null safe unique index logic needed for strictness, simple unique for now
);

CREATE INDEX IF NOT EXISTS inbound_plan_lines_plan_idx on inbound_plan_lines(plan_id);

-- ====================================================================
-- B. 실제입고 (Receipt)
-- ====================================================================
CREATE TABLE IF NOT EXISTS inbound_receipts (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null,
  warehouse_id        uuid not null,
  client_id           uuid not null,
  plan_id             uuid references inbound_plans(id) on delete set null,
  receipt_no          text not null, -- 예: INR-20260122-0007
  arrived_at          timestamptz,
  status              text not null default 'ARRIVED' check (status in ('ARRIVED','PHOTO_REQUIRED','COUNTING','INSPECTING','DISCREPANCY','CONFIRMED','PUTAWAY_READY','CANCELLED')),
  dock_name           text,
  carrier_name        text,
  tracking_no         text,
  total_box_count     integer check (total_box_count >= 0),
  notes               text,
  created_by          uuid references auth.users(id),
  confirmed_by        uuid references auth.users(id),
  confirmed_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (org_id, receipt_no)
);

CREATE INDEX IF NOT EXISTS inbound_receipts_org_wh_status_idx on inbound_receipts(org_id, warehouse_id, status);
CREATE INDEX IF NOT EXISTS inbound_receipts_plan_idx on inbound_receipts(plan_id);
CREATE TRIGGER update_inbound_receipts_modtime BEFORE UPDATE ON inbound_receipts FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE IF NOT EXISTS inbound_receipt_lines (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null,
  receipt_id          uuid not null references inbound_receipts(id) on delete cascade,
  plan_line_id        uuid references inbound_plan_lines(id) on delete set null,
  product_id          uuid not null,
  expected_qty        integer not null default 0 check (expected_qty >= 0),
  received_qty        integer not null default 0 check (received_qty >= 0),
  accepted_qty        integer not null default 0 check (accepted_qty >= 0),
  damaged_qty         integer not null default 0 check (damaged_qty >= 0),
  missing_qty         integer not null default 0 check (missing_qty >= 0),
  over_qty            integer not null default 0 check (over_qty >= 0),
  discrepancy_reason  text,
  lot_no              text,
  expiry_date         date,
  inspected_by        uuid references auth.users(id),
  inspected_at        timestamptz,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (accepted_qty + damaged_qty + missing_qty <= received_qty + over_qty) -- Simple integrity check
);

CREATE INDEX IF NOT EXISTS inbound_receipt_lines_receipt_idx on inbound_receipt_lines(receipt_id);
CREATE INDEX IF NOT EXISTS inbound_receipt_lines_product_idx on inbound_receipt_lines(product_id);
CREATE TRIGGER update_inbound_receipt_lines_modtime BEFORE UPDATE ON inbound_receipt_lines FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ====================================================================
-- C. 사진 가이드 템플릿 & 슬롯
-- ====================================================================
CREATE TABLE IF NOT EXISTS photo_guide_templates (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null,
  name                text not null,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS photo_guide_slots (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null,
  template_id         uuid not null references photo_guide_templates(id) on delete cascade,
  slot_key            text not null, -- 'BOX_OUTER','LABEL_CLOSEUP','UNBOXED','ITEM_WHOLE'
  title               text not null,
  description         text,
  is_required         boolean not null default true,
  min_photos          integer not null default 1 check (min_photos >= 0),
  sort_order          integer not null default 0,
  unique(template_id, slot_key)
);

-- Receipt별 적용된 템플릿
CREATE TABLE IF NOT EXISTS inbound_receipt_photo_requirements (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null,
  receipt_id          uuid not null references inbound_receipts(id) on delete cascade,
  template_id         uuid not null references photo_guide_templates(id),
  created_at          timestamptz not null default now(),
  unique(receipt_id)
);

-- 실제 현장 "슬롯 인스턴스" (Receipt 생성 시 복제)
CREATE TABLE IF NOT EXISTS inbound_photo_slots (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null,
  receipt_id          uuid not null references inbound_receipts(id) on delete cascade,
  slot_key            text not null,
  title               text not null,
  is_required         boolean not null default true,
  min_photos          integer not null default 1,
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now(),
  unique(receipt_id, slot_key)
);

CREATE INDEX IF NOT EXISTS inbound_photo_slots_receipt_idx on inbound_photo_slots(receipt_id);

-- 실제 업로드 사진
CREATE TABLE IF NOT EXISTS inbound_photos (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null,
  receipt_id          uuid not null references inbound_receipts(id) on delete cascade,
  slot_id             uuid references inbound_photo_slots(id) on delete set null,
  line_id             uuid references inbound_receipt_lines(id) on delete set null,
  storage_bucket      text not null default 'inbound',
  storage_path        text not null,
  mime_type           text,
  width               integer,
  height              integer,
  file_size           bigint,
  taken_at            timestamptz,
  uploaded_by         uuid references auth.users(id),
  uploaded_at         timestamptz not null default now(),
  is_deleted          boolean not null default false
);

CREATE INDEX IF NOT EXISTS inbound_photos_receipt_idx on inbound_photos(receipt_id);
CREATE INDEX IF NOT EXISTS inbound_photos_slot_idx on inbound_photos(slot_id);

-- ====================================================================
-- D. 이슈/차이 관리
-- ====================================================================
CREATE TABLE IF NOT EXISTS inbound_issues (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null,
  receipt_id          uuid not null references inbound_receipts(id) on delete cascade,
  line_id             uuid references inbound_receipt_lines(id) on delete set null,
  issue_type          text not null check (issue_type in ('SHORT','OVER','DAMAGE','LABEL_ERROR','MIXED_SKU','EXPIRED','UNKNOWN')),
  severity            text not null default 'MEDIUM' check (severity in ('LOW','MEDIUM','HIGH')),
  description         text,
  status              text not null default 'OPEN' check (status in ('OPEN','IN_REVIEW','RESOLVED','REJECTED')),
  created_by          uuid references auth.users(id),
  created_at          timestamptz not null default now(),
  resolved_by         uuid references auth.users(id),
  resolved_at         timestamptz
);

CREATE INDEX IF NOT EXISTS inbound_issues_receipt_idx on inbound_issues(receipt_id);
CREATE INDEX IF NOT EXISTS inbound_issues_status_idx on inbound_issues(status);

-- ====================================================================
-- E. 작업 이벤트/감사 로그
-- ====================================================================
CREATE TABLE IF NOT EXISTS inbound_events (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null,
  receipt_id          uuid not null references inbound_receipts(id) on delete cascade,
  event_type          text not null,
  payload             jsonb not null default '{}'::jsonb,
  actor_id            uuid references auth.users(id),
  created_at          timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS inbound_events_receipt_idx on inbound_events(receipt_id);
CREATE INDEX IF NOT EXISTS inbound_events_type_idx on inbound_events(event_type);

-- ====================================================================
-- F. 검수 완료 조건 View
-- ====================================================================
CREATE OR REPLACE VIEW v_inbound_receipt_photo_progress AS
SELECT
  s.receipt_id,
  s.id as slot_id,
  s.slot_key,
  s.is_required,
  s.min_photos,
  count(p.id) filter (where p.is_deleted = false) as uploaded_count,
  (count(p.id) filter (where p.is_deleted = false) >= s.min_photos) as slot_ok
FROM inbound_photo_slots s
LEFT JOIN inbound_photos p ON p.slot_id = s.id
GROUP BY s.receipt_id, s.id, s.slot_key, s.is_required, s.min_photos;

-- ====================================================================
-- G. RLS 설정 (기본적으로 Authenticated 사용자에게 허용)
-- ====================================================================

-- 1. inbound_plans
ALTER TABLE inbound_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read for authenticated users" ON inbound_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users" ON inbound_plans FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON inbound_plans FOR UPDATE TO authenticated USING (true);

-- 2. inbound_plan_lines
ALTER TABLE inbound_plan_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read for authenticated users" ON inbound_plan_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users" ON inbound_plan_lines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON inbound_plan_lines FOR UPDATE TO authenticated USING (true);

-- 3. inbound_receipts
ALTER TABLE inbound_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read for authenticated users" ON inbound_receipts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users" ON inbound_receipts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON inbound_receipts FOR UPDATE TO authenticated USING (true);

-- 4. inbound_receipt_lines
ALTER TABLE inbound_receipt_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read for authenticated users" ON inbound_receipt_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users" ON inbound_receipt_lines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON inbound_receipt_lines FOR UPDATE TO authenticated USING (true);

-- 5. Photo & Guides (모두 적용)
ALTER TABLE photo_guide_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_guide_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_receipt_photo_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_photo_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for authenticated users" ON photo_guide_templates FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON photo_guide_slots FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON inbound_receipt_photo_requirements FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON inbound_photo_slots FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON inbound_photos FOR ALL TO authenticated USING (true);

-- 6. Issues & Events
ALTER TABLE inbound_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for authenticated users" ON inbound_issues FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON inbound_events FOR ALL TO authenticated USING (true);

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '✅ 현장형 입고(Inbound) 시스템 스키마 생성이 완료되었습니다.';
END $$;
