begin;

-- --------------------------------------------------------------------
-- 1) inventory_snapshot 확장
-- --------------------------------------------------------------------
alter table public.inventory_snapshot
  add column if not exists opening_stock integer,
  add column if not exists total_in integer,
  add column if not exists total_out integer;

update public.inventory_snapshot
set
  opening_stock = coalesce(opening_stock, closing_stock, 0),
  total_in = coalesce(total_in, 0),
  total_out = coalesce(total_out, 0)
where opening_stock is null
   or total_in is null
   or total_out is null;

alter table public.inventory_snapshot
  alter column opening_stock set default 0,
  alter column total_in set default 0,
  alter column total_out set default 0;

alter table public.inventory_snapshot
  alter column opening_stock set not null,
  alter column total_in set not null,
  alter column total_out set not null;

comment on column public.inventory_snapshot.opening_stock is '해당 일자의 기초 재고';
comment on column public.inventory_snapshot.total_in is '해당 일자 총 입고/증가 수량';
comment on column public.inventory_snapshot.total_out is '해당 일자 총 출고/감소 수량';

-- --------------------------------------------------------------------
-- 2) inventory_ledger movement_type 제약 확장
--    - 기존 레거시 타입과 신규 엑셀 기반 타입을 모두 허용
-- --------------------------------------------------------------------
alter table public.inventory_ledger
  drop constraint if exists inventory_ledger_movement_type_chk;

alter table public.inventory_ledger
  drop constraint if exists inventory_ledger_movement_direction_chk;

alter table public.inventory_ledger
  add constraint inventory_ledger_movement_type_chk
  check (
    movement_type in (
      'INVENTORY_INIT',
      'INBOUND',
      'OUTBOUND',
      'OUTBOUND_CANCEL',
      'OUTBOUND_CANCEL_IN',
      'DISPOSAL',
      'DAMAGE',
      'RETURN_B2C',
      'ADJUSTMENT_PLUS',
      'ADJUSTMENT_MINUS',
      'STOCK_ADJUSTMENT_IN',
      'STOCK_ADJUSTMENT_OUT',
      'BUNDLE_BREAK_IN',
      'BUNDLE_BREAK_OUT',
      'BUNDLE_SPLIT_IN',
      'BUNDLE_SPLIT_OUT',
      'BUNDLE_IN',
      'BUNDLE_OUT',
      'EXPORT_PICKUP',
      'EXPORT_PICKUP_OUT',
      'TRANSFER',
      'JET_RETURN',
      'RETURN_MILKRUN',
      'FREIGHT_QUICK_OUT',
      'OFFICE_USE_OUT',
      'FIRE_IN',
      'FIRE_OUT',
      'RECLASSIFY_GOOD_IN',
      'JET_TRANSFER_OUT',
      'JET_TRANSFER_CANCEL_IN',
      'ADVANCE_EXCHANGE_IN',
      'ADVANCE_EXCHANGE_OUT',
      'COUPANG_MILKRUN_OUT',
      'SAMPLE_OUT',
      'REPACK_INBOUND_IN',
      'REPACK_IN',
      'REPACK_OUT',
      'RELABEL_IN',
      'RELABEL_OUT',
      'ROCKET_GROWTH_PARCEL_OUT',
      'CAFE_DISPLAY_IN',
      'CAFE_DISPLAY_OUT',
      'PARCEL_OUT'
    )
  );

alter table public.inventory_ledger
  add constraint inventory_ledger_movement_direction_chk
  check (
    (
      movement_type in (
        'INVENTORY_INIT',
        'INBOUND',
        'OUTBOUND_CANCEL',
        'OUTBOUND_CANCEL_IN',
        'RETURN_B2C',
        'ADJUSTMENT_PLUS',
        'STOCK_ADJUSTMENT_IN',
        'BUNDLE_BREAK_IN',
        'BUNDLE_SPLIT_IN',
        'BUNDLE_IN',
        'JET_RETURN',
        'RETURN_MILKRUN',
        'FIRE_IN',
        'RECLASSIFY_GOOD_IN',
        'JET_TRANSFER_CANCEL_IN',
        'ADVANCE_EXCHANGE_IN',
        'REPACK_INBOUND_IN',
        'REPACK_IN',
        'RELABEL_IN',
        'CAFE_DISPLAY_IN'
      )
      and direction = 'IN'
    )
    or (
      movement_type in (
        'OUTBOUND',
        'DISPOSAL',
        'DAMAGE',
        'ADJUSTMENT_MINUS',
        'STOCK_ADJUSTMENT_OUT',
        'BUNDLE_BREAK_OUT',
        'BUNDLE_SPLIT_OUT',
        'BUNDLE_OUT',
        'EXPORT_PICKUP',
        'EXPORT_PICKUP_OUT',
        'FREIGHT_QUICK_OUT',
        'OFFICE_USE_OUT',
        'FIRE_OUT',
        'JET_TRANSFER_OUT',
        'ADVANCE_EXCHANGE_OUT',
        'COUPANG_MILKRUN_OUT',
        'SAMPLE_OUT',
        'REPACK_OUT',
        'RELABEL_OUT',
        'ROCKET_GROWTH_PARCEL_OUT',
        'CAFE_DISPLAY_OUT',
        'PARCEL_OUT'
      )
      and direction = 'OUT'
    )
    or movement_type = 'TRANSFER'
  );

comment on constraint inventory_ledger_movement_type_chk on public.inventory_ledger is
  '기존 재고 API와 신규 엑셀 기반 movement type을 모두 허용';

-- --------------------------------------------------------------------
-- 3) export_templates / export_template_columns
-- --------------------------------------------------------------------
create table if not exists public.export_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  vendor_id uuid references public.customer_master(id) on delete set null,
  code text not null,
  name text not null,
  description text,
  sheet_name text not null default '재고현황',
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.export_template_columns (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.export_templates(id) on delete cascade,
  sort_order integer not null default 0,
  source text not null check (source in ('MANAGE_NAME', 'OPENING_STOCK', 'TOTAL_SUM', 'CLOSING_STOCK', 'NOTE', 'TRANSACTION_TYPE')),
  transaction_type text,
  header_name text not null,
  width integer,
  number_format text,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_export_templates_tenant_code
  on public.export_templates(tenant_id, code);

create unique index if not exists uq_export_template_columns_template_sort
  on public.export_template_columns(template_id, sort_order);

create unique index if not exists uq_export_template_columns_template_source_transaction
  on public.export_template_columns(template_id, source, coalesce(transaction_type, ''));

create index if not exists idx_export_templates_tenant_active
  on public.export_templates(tenant_id, is_active, created_at desc);

create index if not exists idx_export_templates_vendor
  on public.export_templates(vendor_id, created_at desc);

create index if not exists idx_export_template_columns_template
  on public.export_template_columns(template_id, sort_order);

comment on table public.export_templates is '업체별 재고 엑셀 출력 템플릿';
comment on table public.export_template_columns is '엑셀 출력 템플릿 컬럼 상세';

-- updated_at 트리거 재사용
drop trigger if exists update_export_templates_modtime on public.export_templates;
create trigger update_export_templates_modtime
before update on public.export_templates
for each row execute procedure public.update_updated_at_column();

drop trigger if exists update_export_template_columns_modtime on public.export_template_columns;
create trigger update_export_template_columns_modtime
before update on public.export_template_columns
for each row execute procedure public.update_updated_at_column();

-- --------------------------------------------------------------------
-- 4) RLS
-- --------------------------------------------------------------------
alter table public.export_templates enable row level security;
alter table public.export_template_columns enable row level security;

drop policy if exists "Internal users can read export templates" on public.export_templates;
create policy "Internal users can read export templates"
on public.export_templates
for select
using (
  exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and up.org_id = export_templates.tenant_id
      and (
        up.role in ('admin', 'manager', 'operator')
        or up.can_manage_inventory = true
        or up.can_access_admin = true
      )
  )
);

drop policy if exists "Internal users can write export templates" on public.export_templates;
create policy "Internal users can write export templates"
on public.export_templates
for all
using (
  exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and up.org_id = export_templates.tenant_id
      and (
        up.role in ('admin', 'manager')
        or up.can_manage_inventory = true
        or up.can_access_admin = true
      )
  )
)
with check (
  exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and up.org_id = export_templates.tenant_id
      and (
        up.role in ('admin', 'manager')
        or up.can_manage_inventory = true
        or up.can_access_admin = true
      )
  )
);

drop policy if exists "Internal users can read export template columns" on public.export_template_columns;
create policy "Internal users can read export template columns"
on public.export_template_columns
for select
using (
  exists (
    select 1
    from public.export_templates et
    join public.user_profiles up
      on up.org_id = et.tenant_id
    where et.id = export_template_columns.template_id
      and up.id = auth.uid()
      and (
        up.role in ('admin', 'manager', 'operator')
        or up.can_manage_inventory = true
        or up.can_access_admin = true
      )
  )
);

drop policy if exists "Internal users can write export template columns" on public.export_template_columns;
create policy "Internal users can write export template columns"
on public.export_template_columns
for all
using (
  exists (
    select 1
    from public.export_templates et
    join public.user_profiles up
      on up.org_id = et.tenant_id
    where et.id = export_template_columns.template_id
      and up.id = auth.uid()
      and (
        up.role in ('admin', 'manager')
        or up.can_manage_inventory = true
        or up.can_access_admin = true
      )
  )
)
with check (
  exists (
    select 1
    from public.export_templates et
    join public.user_profiles up
      on up.org_id = et.tenant_id
    where et.id = export_template_columns.template_id
      and up.id = auth.uid()
      and (
        up.role in ('admin', 'manager')
        or up.can_manage_inventory = true
        or up.can_access_admin = true
      )
  )
);

grant all on table public.export_templates to authenticated;
grant all on table public.export_templates to service_role;
grant all on table public.export_template_columns to authenticated;
grant all on table public.export_template_columns to service_role;

-- --------------------------------------------------------------------
-- 5) 기본 템플릿 시드
--    - 각 조직별 inventory-default 1개 생성
--    - 원본 재고관리.xlsx와 유사하게 모든 트랜잭션 컬럼 기본 포함
-- --------------------------------------------------------------------
with orgs as (
  select distinct org_id
  from public.customer_master
  where org_id is not null
  union
  select distinct org_id
  from public.user_profiles
  where org_id is not null
),
seed_templates as (
  insert into public.export_templates (
    tenant_id,
    code,
    name,
    description,
    sheet_name,
    is_active
  )
  select
    orgs.org_id,
    'inventory-default',
    '기본 재고관리 템플릿',
    '재고관리.xlsx 기본 양식을 반영한 기본 템플릿',
    '재고현황',
    true
  from orgs
  where not exists (
    select 1
    from public.export_templates et
    where et.tenant_id = orgs.org_id
      and et.code = 'inventory-default'
  )
  returning id, tenant_id
),
all_templates as (
  select id, tenant_id
  from seed_templates
  union all
  select id, tenant_id
  from public.export_templates
  where code = 'inventory-default'
),
seed_columns(template_id, sort_order, source, transaction_type, header_name, width, number_format, is_visible) as (
  values
    (null::uuid, 10,  'MANAGE_NAME',      null,                     '관리명',                28, null,     true),
    (null::uuid, 20,  'OPENING_STOCK',    null,                     '전일재고',              14, '#,##0',  true),
    (null::uuid, 30,  'TRANSACTION_TYPE', 'DAMAGE',                 '파손',                  14, '#,##0',  true),
    (null::uuid, 40,  'TRANSACTION_TYPE', 'RETURN_B2C',             '반품(B2C)',             14, '#,##0',  true),
    (null::uuid, 50,  'TRANSACTION_TYPE', 'DISPOSAL',               '폐기(-)',               14, '#,##0',  true),
    (null::uuid, 60,  'TRANSACTION_TYPE', 'JET_RETURN',             '제트회송(+)',           14, '#,##0',  true),
    (null::uuid, 70,  'TRANSACTION_TYPE', 'RETURN_MILKRUN',         '반품(밀크런)',          14, '#,##0',  true),
    (null::uuid, 80,  'TRANSACTION_TYPE', 'FREIGHT_QUICK_OUT',      '화물(퀵)',              14, '#,##0',  true),
    (null::uuid, 90,  'TRANSACTION_TYPE', 'OFFICE_USE_OUT',         '비품(-)',               14, '#,##0',  true),
    (null::uuid, 100, 'TRANSACTION_TYPE', 'FIRE_IN',                '화재(+)',               14, '#,##0',  true),
    (null::uuid, 110, 'TRANSACTION_TYPE', 'FIRE_OUT',               '화재(-)',               14, '#,##0',  true),
    (null::uuid, 120, 'TRANSACTION_TYPE', 'INBOUND',                '입고',                  14, '#,##0',  true),
    (null::uuid, 130, 'TRANSACTION_TYPE', 'RECLASSIFY_GOOD_IN',     '양품화(+)',             14, '#,##0',  true),
    (null::uuid, 140, 'TRANSACTION_TYPE', 'JET_TRANSFER_OUT',       '제트이관(-)',           14, '#,##0',  true),
    (null::uuid, 150, 'TRANSACTION_TYPE', 'JET_TRANSFER_CANCEL_IN', '제트이관작업취소(+)',   16, '#,##0',  true),
    (null::uuid, 160, 'TRANSACTION_TYPE', 'ADVANCE_EXCHANGE_IN',    '선교환(+)',             14, '#,##0',  true),
    (null::uuid, 170, 'TRANSACTION_TYPE', 'ADVANCE_EXCHANGE_OUT',   '선교환(-)',             14, '#,##0',  true),
    (null::uuid, 180, 'TRANSACTION_TYPE', 'COUPANG_MILKRUN_OUT',    '쿠팡(밀크런)',          14, '#,##0',  true),
    (null::uuid, 190, 'TRANSACTION_TYPE', 'STOCK_ADJUSTMENT_IN',    '재고조정(+)',           14, '#,##0',  true),
    (null::uuid, 200, 'TRANSACTION_TYPE', 'STOCK_ADJUSTMENT_OUT',   '재고조정(-)',           14, '#,##0',  true),
    (null::uuid, 210, 'TRANSACTION_TYPE', 'SAMPLE_OUT',             '샘플(-)',               14, '#,##0',  true),
    (null::uuid, 220, 'TRANSACTION_TYPE', 'REPACK_INBOUND_IN',      '재포장입고(+)',         14, '#,##0',  true),
    (null::uuid, 230, 'TRANSACTION_TYPE', 'EXPORT_PICKUP_OUT',      '수출픽업(-)',           14, '#,##0',  true),
    (null::uuid, 240, 'TRANSACTION_TYPE', 'BUNDLE_SPLIT_IN',        '번들해체(+)',           14, '#,##0',  true),
    (null::uuid, 250, 'TRANSACTION_TYPE', 'BUNDLE_SPLIT_OUT',       '번들해체(-)',           14, '#,##0',  true),
    (null::uuid, 260, 'TRANSACTION_TYPE', 'BUNDLE_IN',              '번들(+)',               14, '#,##0',  true),
    (null::uuid, 270, 'TRANSACTION_TYPE', 'BUNDLE_OUT',             '번들(-)',               14, '#,##0',  true),
    (null::uuid, 280, 'TRANSACTION_TYPE', 'REPACK_IN',              '재포장(+)',             14, '#,##0',  true),
    (null::uuid, 290, 'TRANSACTION_TYPE', 'REPACK_OUT',             '재포장(-)',             14, '#,##0',  true),
    (null::uuid, 300, 'TRANSACTION_TYPE', 'RELABEL_IN',             '라벨작업(+)',           14, '#,##0',  true),
    (null::uuid, 310, 'TRANSACTION_TYPE', 'RELABEL_OUT',            '라벨작업(-)',           14, '#,##0',  true),
    (null::uuid, 320, 'TRANSACTION_TYPE', 'ROCKET_GROWTH_PARCEL_OUT','로켓그로스(택배)',     16, '#,##0',  true),
    (null::uuid, 330, 'TRANSACTION_TYPE', 'CAFE_DISPLAY_IN',        '카페진열(+)',           14, '#,##0',  true),
    (null::uuid, 340, 'TRANSACTION_TYPE', 'CAFE_DISPLAY_OUT',       '카페진열(-)',           14, '#,##0',  true),
    (null::uuid, 350, 'TRANSACTION_TYPE', 'OUTBOUND_CANCEL_IN',     '출고취소',              14, '#,##0',  true),
    (null::uuid, 360, 'TRANSACTION_TYPE', 'PARCEL_OUT',             '택배',                  14, '#,##0',  true),
    (null::uuid, 970, 'TOTAL_SUM',        null,                     '총합계',                14, '#,##0',  true),
    (null::uuid, 980, 'CLOSING_STOCK',    null,                     '마감재고',              14, '#,##0',  true),
    (null::uuid, 990, 'NOTE',             null,                     '비고',                  30, null,     true)
)
insert into public.export_template_columns (
  template_id,
  sort_order,
  source,
  transaction_type,
  header_name,
  width,
  number_format,
  is_visible
)
select
  t.id,
  c.sort_order,
  c.source,
  c.transaction_type,
  c.header_name,
  c.width,
  c.number_format,
  c.is_visible
from all_templates t
cross join seed_columns c
where not exists (
  select 1
  from public.export_template_columns etc
  where etc.template_id = t.id
    and etc.source = c.source
    and coalesce(etc.transaction_type, '') = coalesce(c.transaction_type, '')
);

commit;
