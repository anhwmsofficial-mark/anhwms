-- 111_delete_legacy_test_customers.sql
-- 목적: 레거시 테스트 고객사(ABC 전자, 테크 공급업체 / CM0001, CM0002) 제거
-- 주의: 운영 데이터와 연결되어 있지 않은 테스트 계정에만 사용

begin;

do $$
declare
  target_ids uuid[];
  target_brand_ids uuid[];
  fk_rec record;
begin
  -- 삭제 대상 고객사 id 수집
  select array_agg(id)
    into target_ids
  from customer_master
  where code in ('CM0001', 'CM0002')
     or name in ('ABC 전자', '테크 공급업체');

  if target_ids is null or array_length(target_ids, 1) is null then
    raise notice '삭제 대상 고객사 없음(CM0001/CM0002).';
    return;
  end if;

  -- customer_master 참조 nullable 컬럼 정리
  if exists (
    select 1
    from information_schema.columns
    where table_name = 'warehouse' and column_name = 'operator_customer_id'
  ) then
    update warehouse
    set operator_customer_id = null
    where operator_customer_id = any(target_ids);
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_name = 'warehouse' and column_name = 'owner_customer_id'
  ) then
    update warehouse
    set owner_customer_id = null
    where owner_customer_id = any(target_ids);
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_name = 'inbound_shipment' and column_name = 'supplier_customer_id'
  ) then
    update inbound_shipment
    set supplier_customer_id = null
    where supplier_customer_id = any(target_ids);
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_name = 'external_quote_inquiry' and column_name = 'converted_customer_id'
  ) then
    update external_quote_inquiry
    set converted_customer_id = null
    where converted_customer_id = any(target_ids);
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_name = 'international_quote_inquiry' and column_name = 'converted_customer_id'
  ) then
    update international_quote_inquiry
    set converted_customer_id = null
    where converted_customer_id = any(target_ids);
  end if;

  -- 연관 브랜드 id 수집
  if exists (select 1 from information_schema.tables where table_name = 'brand') then
    select array_agg(id)
      into target_brand_ids
    from brand
    where customer_master_id = any(target_ids);
  end if;

  -- 연관 브랜드 참조 FK 정리(브랜드 삭제 전에 실행)
  -- 규칙:
  -- - FK 컬럼이 NOT NULL이면 참조 행 삭제
  -- - FK 컬럼이 NULL 허용이면 FK 컬럼만 NULL 처리
  if target_brand_ids is not null and array_length(target_brand_ids, 1) is not null then
    for fk_rec in
      select
        ns.nspname as schema_name,
        cls.relname as table_name,
        att.attname as column_name,
        att.attnotnull as is_not_null
      from pg_constraint con
      join pg_class cls on cls.oid = con.conrelid
      join pg_namespace ns on ns.oid = cls.relnamespace
      join unnest(con.conkey) with ordinality as k(attnum, ord) on true
      join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k.attnum
      where con.contype = 'f'
        and con.confrelid = 'brand'::regclass
        and array_length(con.conkey, 1) = 1
        and ns.nspname = 'public'
    loop
      if fk_rec.is_not_null then
        execute format(
          'delete from %I.%I where %I = any($1)',
          fk_rec.schema_name,
          fk_rec.table_name,
          fk_rec.column_name
        )
        using target_brand_ids;
      else
        execute format(
          'update %I.%I set %I = null where %I = any($1)',
          fk_rec.schema_name,
          fk_rec.table_name,
          fk_rec.column_name,
          fk_rec.column_name
        )
        using target_brand_ids;
      end if;
    end loop;
  end if;

  -- 연관 브랜드 삭제 전 하위 데이터 정리
  if exists (select 1 from information_schema.tables where table_name = 'brand') then
    -- products.customer_id 가 customer_master를 직접 참조하는 환경 정리
    if exists (
      select 1 from information_schema.columns
      where table_name = 'products' and column_name = 'customer_id'
    ) then
      update products
      set customer_id = null
      where customer_id = any(target_ids);
    end if;

    -- brand 제거
    delete from brand
    where customer_master_id = any(target_ids);
  end if;

  -- customer enhancement 하위 테이블(환경에 따라 존재)
  if exists (select 1 from information_schema.tables where table_name = 'customer_contact') then
    delete from customer_contact where customer_master_id = any(target_ids);
  end if;
  if exists (select 1 from information_schema.tables where table_name = 'customer_pricing') then
    delete from customer_pricing where customer_master_id = any(target_ids);
  end if;
  if exists (select 1 from information_schema.tables where table_name = 'customer_contract') then
    delete from customer_contract where customer_master_id = any(target_ids);
  end if;
  if exists (select 1 from information_schema.tables where table_name = 'customer_activity') then
    delete from customer_activity where customer_master_id = any(target_ids);
  end if;
  if exists (select 1 from information_schema.tables where table_name = 'customer_relationship') then
    delete from customer_relationship
    where parent_customer_id = any(target_ids)
       or child_customer_id = any(target_ids);
  end if;

  -- 최종 customer_master 삭제
  delete from customer_master
  where id = any(target_ids);

  raise notice '레거시 테스트 고객사 삭제 완료: %', array_length(target_ids, 1);
end $$;

commit;

