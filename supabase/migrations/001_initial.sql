-- MishiMenu initial schema — single-tenant
-- Apply via: ./mishimenu install (seeds via psql in Docker)
-- Or manually: psql -h localhost -U postgres -d postgres -f supabase/migrations/001_initial.sql

create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────

-- Single row — describes this installation's restaurant
create table restaurant (
  id                       uuid primary key default uuid_generate_v4(),
  name                     text not null,
  address                  text,
  phone                    text,
  ruc                      text,
  -- DeUna digital wallet
  deuna_qr_url             text,
  deuna_account_name       text,
  -- Sipi digital wallet
  sipi_qr_url              text,
  sipi_account_name        text,
  -- Bank transfer
  transfer_bank            text,
  transfer_account_number  text,
  transfer_account_name    text,
  -- Payment configuration
  payment_policy           text not null default 'upfront'
                             check (payment_policy in ('upfront', 'at_end')),
  accepted_payment_methods text[] not null default array['deuna', 'cash'],
  logo_url                 text,
  created_at               timestamptz default now()
);

create table categories (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  sort_order  integer default 0
);

create table menu_items (
  id           uuid primary key default uuid_generate_v4(),
  category_id  uuid references categories(id) on delete set null,
  name         text not null,
  description  text,
  price        numeric(10,2) not null,
  emoji        text,
  image_url    text,
  available    boolean default true,
  sort_order   integer default 0
);

create table orders (
  id             uuid primary key default uuid_generate_v4(),
  order_number   serial,
  session_id     text not null,
  order_type     text not null check (order_type in ('mesa', 'llevar')),
  table_number   text,
  payment_method text check (payment_method in ('deuna', 'sipi', 'transfer', 'cash', 'card')),
  status         text not null default 'pending_payment' check (status in (
                   'pending_payment',
                   'receipt_received',
                   'ocr_processing',
                   'verified',
                   'rejected',
                   'expired'
                 )),
  subtotal       numeric(10,2) not null,
  total          numeric(10,2) not null,
  notes          text,
  -- cash orders get 4-hour expiry; digital orders get 15 minutes (set at insert time)
  expires_at     timestamptz default (now() + interval '15 minutes'),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create table order_items (
  id           uuid primary key default uuid_generate_v4(),
  order_id     uuid references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id) on delete set null,
  name         text not null,
  price        numeric(10,2) not null,
  quantity     integer not null check (quantity > 0),
  subtotal     numeric(10,2) not null
);

create table receipts (
  id                    uuid primary key default uuid_generate_v4(),
  order_id              uuid references orders(id) on delete cascade unique,
  storage_path          text not null,
  image_hash            text,
  ocr_raw_text          text,
  extracted_tx_id       text,
  extracted_amount      numeric(10,2),
  extracted_sender      text,
  ocr_status            text default 'pending' check (ocr_status in ('pending','processing','done','failed')),
  is_duplicate          boolean default false,
  duplicate_of_order_id uuid references orders(id),
  submitted_via         text check (submitted_via in ('upload', 'share_target')),
  created_at            timestamptz default now()
);

-- ─────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────

create index idx_orders_session_id    on orders(session_id);
create index idx_orders_status        on orders(status);
create index idx_orders_payment       on orders(payment_method);
create index idx_receipts_image_hash  on receipts(image_hash);
create index idx_receipts_tx_id       on receipts(extracted_tx_id);

-- ─────────────────────────────────────────────
-- Auto-update updated_at
-- ─────────────────────────────────────────────

create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger orders_updated_at before update on orders
for each row execute function update_updated_at();

-- ─────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────

alter table restaurant  enable row level security;
alter table categories  enable row level security;
alter table menu_items  enable row level security;
alter table orders      enable row level security;
alter table order_items enable row level security;
alter table receipts    enable row level security;

-- Public read for restaurant info and menu
create policy "public read restaurant"  on restaurant  for select using (true);
create policy "public read categories"  on categories  for select using (true);
create policy "public read menu_items"  on menu_items  for select using (available = true);

-- Customers can insert orders without authentication
create policy "public insert orders" on orders for insert with check (true);

-- Customers can read their own orders by session_id
create policy "customer read own orders" on orders for select
  using (session_id = current_setting('app.session_id', true));

-- Customers can insert receipts (for their own orders)
create policy "public insert receipts" on receipts for insert with check (true);

-- Owner access is handled via the service_role key (bypasses RLS).
-- auth.uid() policies are intentionally omitted here because the auth schema
-- does not exist at init time — GoTrue creates it on first start.

-- ─────────────────────────────────────────────
-- PostgREST role grants
-- ─────────────────────────────────────────────

grant usage on schema public to anon, authenticated, service_role;

-- Public (anon) access: read menu, submit orders
grant select          on restaurant  to anon, authenticated;
grant select          on categories  to anon, authenticated;
grant select          on menu_items  to anon, authenticated;
grant select, insert  on orders      to anon, authenticated;
grant select, insert  on order_items to anon, authenticated;
grant select, insert  on receipts    to anon, authenticated;

-- Sequences (needed for order_number serial)
grant usage, select on all sequences in schema public to anon, authenticated;

-- service_role: full access (used by Next.js server, bypasses RLS)
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- ─────────────────────────────────────────────
-- Order expiry cron job (requires pg_cron extension)
-- Enable via: Supabase dashboard → Database → Extensions → pg_cron
-- ─────────────────────────────────────────────

-- Uncomment after enabling pg_cron:
-- select cron.schedule(
--   'expire-pending-orders',
--   '*/5 * * * *',
--   $$
--     update orders
--     set status = 'expired'
--     where status = 'pending_payment'
--       and payment_method not in ('cash', 'card')
--       and expires_at < now();
--   $$
-- );
