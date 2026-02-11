-- 110_rebuild_product_db_no_by_customer_code.sql
-- 목적:
-- 1) customer_master.code 를 영문/숫자 코드 형태로 정규화
-- 2) products.product_db_no 를 [고객사코드 + 바코드 + 카테고리코드] 규칙으로 일괄 보정
-- 3) 카테고리코드는 product_categories.code 기준(name_ko/name_en/code 매칭)

begin;

-- 1) 고객사 코드 정규화 (영문/숫자 외 제거, 비어있으면 CUST+ID 조합)
with base_codes as (
  select
    cm.id,
    coalesce(
      nullif(regexp_replace(upper(coalesce(cm.code, '')), '[^A-Z0-9]', '', 'g'), ''),
      'CUST' || substr(replace(cm.id::text, '-', ''), 1, 6)
    ) as base_code
  from customer_master cm
),
dedup_codes as (
  select
    id,
    case
      when row_number() over (partition by base_code order by id) = 1
        then base_code
      else left(base_code, 10) || lpad(row_number() over (partition by base_code order by id)::text, 2, '0')
    end as new_code
  from base_codes
)
update customer_master cm
set code = d.new_code
from dedup_codes d
where cm.id = d.id
  and cm.code is distinct from d.new_code;

-- 2) 바코드 공백 보정 (없으면 id 기반 13자리 생성)
update products p
set barcode = right(replace(p.id::text, '-', ''), 13)
where coalesce(trim(p.barcode), '') = '';

-- 3) 카테고리 코드 매핑 + product_db_no 일괄 재생성
with mapped as (
  select
    p.id,
    coalesce(
      nullif(regexp_replace(upper(coalesce(cm.code, '')), '[^A-Z0-9]', '', 'g'), ''),
      'CUST' || substr(replace(coalesce(p.customer_id::text, p.id::text), '-', ''), 1, 6)
    ) as customer_code,
    trim(coalesce(p.barcode, '')) as barcode_value,
    coalesce(pc.code, 'ETC') as category_code
  from products p
  left join customer_master cm on cm.id = p.customer_id
  left join lateral (
    select code
    from product_categories c
    where lower(c.code) = lower(coalesce(p.category, ''))
       or lower(c.name_ko) = lower(coalesce(p.category, ''))
       or lower(c.name_en) = lower(coalesce(p.category, ''))
    limit 1
  ) pc on true
),
rebuilt as (
  select
    m.id,
    (m.customer_code || m.barcode_value || m.category_code) as base_product_db_no
  from mapped m
),
dedup_db_no as (
  select
    r.id,
    case
      when row_number() over (partition by r.base_product_db_no order by r.id) = 1
        then r.base_product_db_no
      else r.base_product_db_no || lpad(row_number() over (partition by r.base_product_db_no order by r.id)::text, 2, '0')
    end as new_product_db_no
  from rebuilt r
)
update products p
set product_db_no = d.new_product_db_no,
    updated_at = now()
from dedup_db_no d
where p.id = d.id
  and p.product_db_no is distinct from d.new_product_db_no;

commit;

