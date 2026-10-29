-- Runtime-managed product detail images for /product.
create table if not exists public.product_showcase_items (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{1,64}$'),
  product_key text,
  display_name text not null check (char_length(display_name) between 1 and 200),
  management_name text,
  category text,
  images jsonb not null default '[]'::jsonb check (jsonb_typeof(images) = 'array'),
  thumbnail_url text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.product_showcase_items enable row level security;

-- Reads and writes are intentionally performed through server routes.
-- The public route only exposes fields needed by /product.
revoke all on table public.product_showcase_items from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-showcase',
  'product-showcase',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
