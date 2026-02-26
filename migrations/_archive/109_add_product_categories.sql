CREATE TABLE IF NOT EXISTS product_categories (
  code TEXT PRIMARY KEY,
  name_ko TEXT NOT NULL,
  name_en TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO product_categories (code, name_ko, name_en) VALUES
('HYG', '생활위생용품', 'Hygiene Goods'),
('PLS', '플라스틱제품', 'Plastic Products'),
('KIT', '주방용품', 'Kitchenware'),
('HOU', '생활용품', 'Household Goods'),
('AUT', '자동차용품', 'Automotive Supplies'),
('SPT', '스포츠용품', 'Sports Goods'),
('DET', '비누 및 합성세제', 'Detergents & Soap'),
('STA', '문구', 'Stationery'),
('ACC', '악세사리', 'Accessories'),
('APP', '의복류', 'Apparel'),
('COS', '화장품', 'Cosmetics'),
('QDR', '의약외품', 'Quasi-drugs'),
('LES', '레저용품', 'Leisure Goods'),
('ETC', '기타', 'Others'),
('SHO', '신발', 'Shoes'),
('OFF', '사무용기기', 'Office Equipment'),
('WIG', '가발', 'Wigs'),
('PRF', '가공식품', 'Processed Food')
ON CONFLICT (code) DO UPDATE SET
  name_ko = EXCLUDED.name_ko,
  name_en = EXCLUDED.name_en;

-- 권한 설정
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON product_categories
  FOR SELECT USING (true);

CREATE POLICY "Enable write access for authenticated users" ON product_categories
  FOR ALL USING (auth.role() = 'authenticated');
