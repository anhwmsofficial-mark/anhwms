-- 113_backfill_products_customer_id_and_rebuild_db_no.sql
-- 목적:
-- 1) products.customer_id FK를 partners -> customer_master 로 전환
-- 2) 기존 customer_id 값을 최대한 customer_master로 매핑/백필
-- 3) product_db_no 를 [고객사코드 + 바코드 + 카테고리코드] 규칙으로 재생성

begin;

do $$
declare
  fk_name text;
begin
  -- A) 기존 FK가 partners를 바라보는 경우를 대비해 우선 FK 제거
  select conname
    into fk_name
  from pg_constraint
  where conrelid = 'products'::regclass
    and contype = 'f'
    and array_length(conkey, 1) = 1
    and (select attname from pg_attribute where attrelid = conrelid and attnum = conkey[1]) = 'customer_id'
  limit 1;

  if fk_name is not null then
    execute format('alter table products drop constraint %I', fk_name);
  end if;

  -- B) partners.id 로 저장된 customer_id를 customer_master.id로 매핑 (이름 기준)
  --    같은 이름이 여럿이면 가장 오래된 customer_master 1건을 사용
  if exists (select 1 from information_schema.tables where table_name = 'partners') then
    with partner_map as (
      select
        p.id as partner_id,
        (
          select cm.id
          from customer_master cm
          where cm.name = p.name
          order by cm.created_at asc nulls last, cm.id
          limit 1
        ) as customer_master_id
      from partners p
    )
    update products pr
    set customer_id = pm.customer_master_id
    from partner_map pm
    where pr.customer_id = pm.partner_id
      and pm.customer_master_id is not null;
  end if;

  -- C) customer_id가 여전히 비어있으면 brand.customer_master_id로 백필
  update products p
  set customer_id = b.customer_master_id
  from brand b
  where p.customer_id is null
    and p.brand_id = b.id
    and b.customer_master_id is not null;

  -- D) customer_master에 존재하지 않는 customer_id는 null 처리 (FK 재생성 준비)
  update products p
  set customer_id = null
  where p.customer_id is not null
    and not exists (
      select 1
      from customer_master cm
      where cm.id = p.customer_id
    );

  -- E) FK를 customer_master 기준으로 재생성
  alter table products
    add constraint products_customer_id_fkey
    foreign key (customer_id)
    references customer_master(id)
    on delete set null;
end $$;

-- F) 바코드 비어있는 경우 보정 (규칙 계산 안정화)
update products p
set barcode = right(replace(p.id::text, '-', ''), 13)
where p.customer_id is not null
  and coalesce(trim(p.barcode), '') = '';

-- G) 규칙 기반 product_db_no 재생성 (customer_id 있는 행만)
with mapped as (
  select
    p.id,
    regexp_replace(upper(coalesce(cm.code, '')), '[^A-Z0-9]', '', 'g') as customer_code,
    trim(coalesce(p.barcode, '')) as barcode_value,
    coalesce(pc.code, 'ETC') as category_code
  from products p
  join customer_master cm on cm.id = p.customer_id
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

