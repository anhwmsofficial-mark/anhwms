-- 115_sync_products_customer_with_brand.sql
-- 목적:
-- 1) products에서 brand/customer 불일치 데이터 정리
-- 2) 신규/수정 시 brand_id 기준으로 customer_id가 자동 동기화되도록 트리거 추가
--
-- 개념:
-- - 브랜드는 고객사의 하위 개념
-- - products.brand_id가 있으면 customer_id는 반드시 brand.customer_master_id와 일치해야 함
-- - 다브랜드 운영/브랜드 매각(고객사 변경) 시에도 정합성 보장

begin;

-- 1) 기존 불일치 데이터 정리
update products p
set customer_id = b.customer_master_id
from brand b
where p.brand_id = b.id
  and (p.customer_id is distinct from b.customer_master_id);

-- 2) 동기화 함수 생성
create or replace function fn_products_sync_customer_from_brand()
returns trigger
language plpgsql
as $$
declare
  v_customer_id uuid;
begin
  if new.brand_id is not null then
    select customer_master_id
      into v_customer_id
    from brand
    where id = new.brand_id;

    if v_customer_id is null then
      raise exception 'brand_id(%) 에 해당하는 customer_master_id를 찾을 수 없습니다.', new.brand_id;
    end if;

    new.customer_id := v_customer_id;
  end if;

  return new;
end;
$$;

-- 3) 트리거 재생성
drop trigger if exists trg_products_sync_customer_from_brand on products;
create trigger trg_products_sync_customer_from_brand
before insert or update of brand_id
on products
for each row
execute function fn_products_sync_customer_from_brand();

commit;

