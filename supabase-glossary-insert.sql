-- 용어집에 "최현석 -> 崔玄昔" 등록
INSERT INTO cs_glossary (term_ko, term_zh, note, priority, active)
VALUES 
  ('최현석', '崔玄昔', '인명 - 최현석 대표', 10, true)
ON CONFLICT DO NOTHING;

-- 추가 용어 예시 (필요시 활성화)
-- INSERT INTO cs_glossary (term_ko, term_zh, note, priority, active)
-- VALUES 
--   ('ANH WMS', 'ANH WMS', '회사/제품명 - 번역하지 않음', 10, true),
--   ('입고', '入库', 'WMS 용어', 9, true),
--   ('출고', '出库', 'WMS 용어', 9, true),
--   ('재고', '库存', 'WMS 용어', 9, true),
--   ('배송', '配送', '물류 용어', 8, true),
--   ('운송장', '运单', '물류 용어', 8, true)
-- ON CONFLICT DO NOTHING;

