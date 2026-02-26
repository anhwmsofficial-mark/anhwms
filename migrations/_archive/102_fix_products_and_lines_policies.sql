-- ====================================================================
-- RLS 정책 단순화: products / inbound_* / user_profiles
-- 500 에러 및 406 에러 방지용 (개발/검증 환경)
-- ====================================================================

-- 1) products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON products;
DROP POLICY IF EXISTS "Enable write access for authenticated users" ON products;
DROP POLICY IF EXISTS "Partners can view own products" ON products;
CREATE POLICY "Enable read access for authenticated users" ON products
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable write access for authenticated users" ON products
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2) inbound_plan_lines
ALTER TABLE inbound_plan_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON inbound_plan_lines;
DROP POLICY IF EXISTS "Enable write access for authenticated users" ON inbound_plan_lines;
CREATE POLICY "Enable read access for authenticated users" ON inbound_plan_lines
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable write access for authenticated users" ON inbound_plan_lines
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3) inbound_receipt_lines
ALTER TABLE inbound_receipt_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON inbound_receipt_lines;
DROP POLICY IF EXISTS "Enable write access for authenticated users" ON inbound_receipt_lines;
CREATE POLICY "Enable read access for authenticated users" ON inbound_receipt_lines
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable write access for authenticated users" ON inbound_receipt_lines
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4) user_profiles (406 에러 방지용 기본 읽기 정책)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON user_profiles;
CREATE POLICY "Enable read for authenticated users" ON user_profiles
  FOR SELECT TO authenticated USING (true);

-- 스키마 캐시 새로고침
NOTIFY pgrst, 'reload schema';
