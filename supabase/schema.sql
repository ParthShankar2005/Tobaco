-- TOBACO free-tier schema for multi-device sync
-- Run this in Supabase SQL Editor once.

create table if not exists public.products (
  id text primary key,
  item_number text not null unique check (item_number ~ '^[0-9]{4}$'),
  name text not null unique,
  description text not null default '',
  mrp numeric(12, 2) not null check (mrp > 0),
  srp numeric(12, 2) not null check (srp > 0 and srp <= mrp),
  moq integer not null check (moq > 0),
  pack_size text not null,
  image text not null default '/placeholder.svg',
  category text not null check (category in ('cigarette', 'loose', 'smokeless')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shops (
  id text primary key,
  shop_name text not null,
  owner_name text not null,
  mobile text not null,
  whatsapp_number text not null default '',
  area text not null,
  address text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.price_rules (
  id text primary key,
  shop_id text not null references public.shops(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  custom_price numeric(12, 2) not null check (custom_price > 0),
  offer_text text,
  updated_at timestamptz not null default now(),
  unique (shop_id, product_id)
);

create table if not exists public.orders (
  id text primary key,
  shop_id text not null references public.shops(id) on delete cascade,
  shop_name text not null,
  shop_address text not null default '',
  owner_name text not null,
  mobile text not null,
  payment_method text not null check (payment_method in ('cash', 'online')),
  created_at timestamptz not null default now(),
  status text not null check (status in ('pending', 'accepted', 'rejected')),
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  note text
);

create table if not exists public.order_items (
  id text primary key,
  order_id text not null references public.orders(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  item_number text,
  product_name text not null,
  image text,
  pack_size text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  line_total numeric(12, 2) not null check (line_total >= 0)
);

create table if not exists public.admin_auth (
  id text primary key default 'admin',
  username text not null unique,
  password text not null,
  display_name text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.shopkeeper_accounts (
  id text primary key,
  shop_id text not null references public.shops(id) on delete cascade,
  username text not null unique,
  password text not null,
  display_name text not null,
  active boolean not null default true,
  use_gst_bill boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  role text not null check (role in ('admin', 'shopkeeper')),
  username text not null,
  business_name text not null default '',
  owner_name text not null default '',
  gst_number text not null default '',
  mobile_number text not null default '',
  whatsapp_number text not null default '',
  address text not null default '',
  email text not null default '',
  logo_data_url text not null default '',
  settings_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (role, username)
);

create index if not exists idx_orders_created_at on public.orders(created_at desc);
create index if not exists idx_orders_shop_id on public.orders(shop_id);
create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_order_items_product_id on public.order_items(product_id);
create index if not exists idx_shopkeeper_accounts_shop_id on public.shopkeeper_accounts(shop_id);

insert into public.admin_auth (id, username, password, display_name)
values ('admin', 'distributor', 'dist@123', 'Distributor Admin')
on conflict (id) do nothing;

insert into public.user_profiles (
  role,
  username,
  business_name,
  owner_name,
  gst_number,
  mobile_number,
  whatsapp_number,
  address,
  email
)
values (
  'admin',
  'distributor',
  'Tobaco Distribution Network',
  'Distributor Admin',
  '',
  '',
  '',
  '',
  ''
)
on conflict (role, username) do nothing;

alter table public.products enable row level security;
alter table public.shops enable row level security;
alter table public.price_rules enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.admin_auth enable row level security;
alter table public.shopkeeper_accounts enable row level security;
alter table public.user_profiles enable row level security;

drop policy if exists "open_products" on public.products;
create policy "open_products" on public.products for all using (true) with check (true);

drop policy if exists "open_shops" on public.shops;
create policy "open_shops" on public.shops for all using (true) with check (true);

drop policy if exists "open_price_rules" on public.price_rules;
create policy "open_price_rules" on public.price_rules for all using (true) with check (true);

drop policy if exists "open_orders" on public.orders;
create policy "open_orders" on public.orders for all using (true) with check (true);

drop policy if exists "open_order_items" on public.order_items;
create policy "open_order_items" on public.order_items for all using (true) with check (true);

drop policy if exists "open_admin_auth" on public.admin_auth;
create policy "open_admin_auth" on public.admin_auth for all using (true) with check (true);

drop policy if exists "open_shopkeeper_accounts" on public.shopkeeper_accounts;
create policy "open_shopkeeper_accounts" on public.shopkeeper_accounts for all using (true) with check (true);

drop policy if exists "open_user_profiles" on public.user_profiles;
create policy "open_user_profiles" on public.user_profiles for all using (true) with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;

alter default privileges in schema public
grant select, insert, update, delete on tables to anon, authenticated;
