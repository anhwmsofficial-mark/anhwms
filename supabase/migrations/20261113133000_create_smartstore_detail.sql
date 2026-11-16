-- Smart Store detail jobs. Secrets stay in environment variables, not in these tables.
begin;

create table if not exists public.smartstore_connections (
  id uuid primary key default gen_random_uuid(),
  store_key text not null unique default 'ahadeuktem' check (store_key ~ '^[a-z0-9_-]{1,64}$'),
  store_name text not null default '아하득템',
  status text not null default 'unconfigured' check (status in ('unconfigured', 'ready', 'error')),
  publish_limit integer check (publish_limit is null or publish_limit >= 1),
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.smartstore_detail_jobs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.smartstore_connections(id) on delete restrict,
  status text not null default 'preview_ready' check (
    status in ('preview_ready', 'publishing', 'completed', 'partial_failed', 'failed')
  ),
  idempotency_key text not null unique,
  requested_count integer not null default 0 check (requested_count >= 0),
  success_count integer not null default 0 check (success_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  publish_approved boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.smartstore_detail_job_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.smartstore_detail_jobs(id) on delete cascade,
  channel_product_no text not null check (channel_product_no ~ '^[0-9]{5,20}$'),
  product_name text,
  source_image_urls jsonb not null default '[]'::jsonb check (jsonb_typeof(source_image_urls) = 'array'),
  original_image_urls jsonb not null default '[]'::jsonb check (jsonb_typeof(original_image_urls) = 'array'),
  deployed_image_urls jsonb not null default '[]'::jsonb check (jsonb_typeof(deployed_image_urls) = 'array'),
  after_html text not null,
  content_hash text not null,
  status text not null default 'preview_ready' check (
    status in ('preview_ready', 'publishing', 'published', 'failed', 'skipped')
  ),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, channel_product_no)
);

create table if not exists public.smartstore_detail_versions (
  id uuid primary key default gen_random_uuid(),
  job_item_id uuid not null references public.smartstore_detail_job_items(id) on delete restrict,
  channel_product_no text not null,
  before_html text,
  after_html text not null,
  image_urls jsonb not null default '[]'::jsonb check (jsonb_typeof(image_urls) = 'array'),
  content_hash text not null,
  actor_id uuid references auth.users(id) on delete set null,
  applied_at timestamptz not null default now(),
  rolled_back_at timestamptz
);

create index if not exists smartstore_detail_jobs_status_idx
  on public.smartstore_detail_jobs (status, created_at desc);

create index if not exists smartstore_detail_job_items_job_idx
  on public.smartstore_detail_job_items (job_id, created_at);

create index if not exists smartstore_detail_versions_channel_idx
  on public.smartstore_detail_versions (channel_product_no, applied_at desc);

create unique index if not exists smartstore_detail_versions_applied_hash_uidx
  on public.smartstore_detail_versions (channel_product_no, content_hash)
  where rolled_back_at is null;

create or replace trigger update_smartstore_connections_modtime
before update on public.smartstore_connections
for each row
execute function public.update_updated_at_column();

create or replace trigger update_smartstore_detail_jobs_modtime
before update on public.smartstore_detail_jobs
for each row
execute function public.update_updated_at_column();

create or replace trigger update_smartstore_detail_job_items_modtime
before update on public.smartstore_detail_job_items
for each row
execute function public.update_updated_at_column();

alter table public.smartstore_connections enable row level security;
alter table public.smartstore_detail_jobs enable row level security;
alter table public.smartstore_detail_job_items enable row level security;
alter table public.smartstore_detail_versions enable row level security;

revoke all on table public.smartstore_connections from anon, authenticated;
revoke all on table public.smartstore_detail_jobs from anon, authenticated;
revoke all on table public.smartstore_detail_job_items from anon, authenticated;
revoke all on table public.smartstore_detail_versions from anon, authenticated;

grant all on table public.smartstore_connections to service_role;
grant all on table public.smartstore_detail_jobs to service_role;
grant all on table public.smartstore_detail_job_items to service_role;
grant all on table public.smartstore_detail_versions to service_role;

insert into public.smartstore_connections (store_key, store_name, status, publish_limit)
values ('ahadeuktem', '아하득템', 'unconfigured', 1)
on conflict (store_key) do nothing;

commit;
