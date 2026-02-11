-- 112_delete_unmapped_legacy_products.sql
-- 목적:
-- 두번째 검증 SQL에서 UNMAPPED로 확인된 레거시 샘플 상품(무선 이어폰~키보드) 삭제
-- 주의:
-- 1) 아래 제품명 목록과 UNMAPPED 조건을 동시에 만족하는 데이터만 삭제
-- 2) 다른 UNMAPPED 데이터는 유지

begin;

-- 삭제 대상 사전 확인(참고용)
-- with target as (
--   select p.id, p.name, p.category
--   from products p
--   left join lateral (
--     select code
--     from product_categories c
--     where lower(c.code) = lower(coalesce(p.category, ''))
--        or lower(c.name_ko) = lower(coalesce(p.category, ''))
--        or lower(c.name_en) = lower(coalesce(p.category, ''))
--     limit 1
--   ) pc on true
--   where pc.code is null
--     and p.name in (
--       '무선 이어폰 (Black)',
--       '테스트 상품 A (박스)',
--       'USB 케이블',
--       '노트북 A',
--       '모니터 27인치',
--       '무선 마우스',
--       '키보드'
--     )
-- )
-- select * from target;

with target as (
  select p.id
  from products p
  left join lateral (
    select code
    from product_categories c
    where lower(c.code) = lower(coalesce(p.category, ''))
       or lower(c.name_ko) = lower(coalesce(p.category, ''))
       or lower(c.name_en) = lower(coalesce(p.category, ''))
    limit 1
  ) pc on true
  where pc.code is null
    and p.name in (
      '무선 이어폰 (Black)',
      '테스트 상품 A (박스)',
      'USB 케이블',
      '노트북 A',
      '모니터 27인치',
      '무선 마우스',
      '키보드'
    )
)
delete from products p
using target t
where p.id = t.id;

commit;

