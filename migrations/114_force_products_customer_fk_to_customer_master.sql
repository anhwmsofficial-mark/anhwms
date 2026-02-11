-- 114_force_products_customer_fk_to_customer_master.sql
-- 목적:
-- products.customer_id 를 customer_master(id) 단일 FK로 강제
-- (기존 partners(id) 또는 기타 FK 충돌 원인 제거)

begin;

do $$
declare
  fk_rec record;
begin
  -- 1) products.customer_id 에 걸린 기존 FK 전부 제거 (대상 테이블 무관)
  for fk_rec in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    where rel.relname = 'products'
      and con.contype = 'f'
      and array_length(con.conkey, 1) = 1
      and (
        select att.attname
        from pg_attribute att
        where att.attrelid = con.conrelid
          and att.attnum = con.conkey[1]
      ) = 'customer_id'
  loop
    execute format('alter table products drop constraint %I', fk_rec.conname);
  end loop;

  -- 2) customer_id가 partners id를 담고 있는 경우 customer_master로 매핑 (이름 기준)
  if exists (select 1 from information_schema.tables where table_name = 'partners')
     and exists (select 1 from information_schema.tables where table_name = 'customer_master') then
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

  -- 3) 그래도 customer_master에 없는 customer_id는 NULL 처리
  update products p
  set customer_id = null
  where p.customer_id is not null
    and not exists (
      select 1 from customer_master cm where cm.id = p.customer_id
    );

  -- 4) customer_master 단일 FK 재생성
  alter table products
    add constraint products_customer_id_fkey
    foreign key (customer_id)
    references customer_master(id)
    on delete set null;
end $$;

-- 5) 조회 성능 인덱스 보장
create index if not exists idx_products_customer_id on products(customer_id);

commit;

