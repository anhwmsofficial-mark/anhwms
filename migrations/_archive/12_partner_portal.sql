-- 파트너 포털을 위한 스키마 확장
-- 1. 사용자-파트너 연결
ALTER TABLE users
ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES partners(id) ON DELETE SET NULL;

-- 2. 상품 소유권 (화주사 구분)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES partners(id) ON DELETE SET NULL;

-- 3. 주문 소유권 (화주사 구분 - 명시적 컬럼 추가)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES partners(id) ON DELETE SET NULL;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_users_partner_id ON users(partner_id);
CREATE INDEX IF NOT EXISTS idx_products_partner_id ON products(partner_id);
CREATE INDEX IF NOT EXISTS idx_orders_partner_id ON orders(partner_id);

-- RLS 정책 업데이트 (파트너 권한)

-- 파트너는 본인 프로필 조회 가능
CREATE POLICY "Partners can view own profile" ON users
  FOR SELECT USING (
    auth.uid() = id
  );

-- 파트너는 본인 상품만 조회 가능
CREATE POLICY "Partners can view own products" ON products
  FOR SELECT USING (
    partner_id IN (
      SELECT partner_id FROM users WHERE id = auth.uid()
    )
  );

-- 파트너는 본인 주문만 조회 가능
CREATE POLICY "Partners can view own orders" ON orders
  FOR SELECT USING (
    partner_id IN (
      SELECT partner_id FROM users WHERE id = auth.uid()
    )
  );

-- 파트너는 본인 주문 생성 가능
CREATE POLICY "Partners can insert own orders" ON orders
  FOR INSERT WITH CHECK (
    partner_id IN (
      SELECT partner_id FROM users WHERE id = auth.uid()
    )
  );

-- 파트너용 뷰 (Helper View) - 현재 로그인한 사용자의 파트너 ID를 쉽게 가져오기 위함
CREATE OR REPLACE VIEW my_partner_info AS
SELECT p.*
FROM partners p
JOIN users u ON u.partner_id = p.id
WHERE u.id = auth.uid();

