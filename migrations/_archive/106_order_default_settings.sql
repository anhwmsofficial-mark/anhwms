-- 주문/발송 기본값 설정 테이블
CREATE TABLE IF NOT EXISTS order_default_settings (
  config_key TEXT PRIMARY KEY DEFAULT 'default',
  sender_name TEXT NOT NULL,
  sender_phone TEXT,
  sender_zip TEXT,
  sender_address TEXT,
  sender_address_detail TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 설정 시드 (기존 하드코딩 값)
INSERT INTO order_default_settings (
  config_key,
  sender_name,
  sender_phone,
  sender_zip,
  sender_address,
  sender_address_detail
)
VALUES (
  'default',
  'ANH 물류센터',
  '010-1234-5678',
  '10009',
  '경기도 김포시 통진읍',
  '서암고정로 295'
)
ON CONFLICT (config_key) DO NOTHING;
