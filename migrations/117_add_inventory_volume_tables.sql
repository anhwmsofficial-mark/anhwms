-- 117_add_inventory_volume_tables.sql
-- YBK 물동량 엑셀 원본 보존 및 외부 공유를 위한 테이블 추가

begin;

create table if not exists inventory_volume_raw (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customer_master(id) on delete cascade,
  sheet_name text not null,
  record_date date,
  row_no integer not null,
  item_name text,
  opening_stock_raw text,
  closing_stock_raw text,
  header_order text[] not null default '{}',
  raw_data jsonb not null default '{}'::jsonb,
  source_file text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_inventory_volume_raw_customer_date
  on inventory_volume_raw(customer_id, record_date desc, created_at desc);

create index if not exists idx_inventory_volume_raw_item_name
  on inventory_volume_raw(item_name);

create table if not exists inventory_volume_share (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  customer_id uuid not null references customer_master(id) on delete cascade,
  date_from date,
  date_to date,
  password_hash text,
  password_salt text,
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_inventory_volume_share_customer_created
  on inventory_volume_share(customer_id, created_at desc);

comment on table inventory_volume_raw is '거래처 물동량 엑셀 원본 행 데이터(JSON 보존)';
comment on table inventory_volume_share is '물동량 데이터 외부 공유 링크';

commit;
