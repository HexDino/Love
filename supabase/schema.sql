-- ============================================================================
-- LoveBox 3D - Supabase schema
-- Chay toan bo file nay trong Supabase Dashboard > SQL Editor > New query > Run
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. BANG GIFTS
-- ----------------------------------------------------------------------------
create table if not exists public.gifts (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  transfer_code  text not null unique,
  receiver_name  text not null,
  sender_name    text not null,
  message        text not null,
  theme          text not null default 'pastel-pink',
  music          text not null default 'romantic-piano',
  photos         jsonb not null default '[]'::jsonb,
  amount         integer not null default 39000,
  is_paid        boolean not null default false,
  paid_at        timestamptz,
  payment_ref    text,
  view_count     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint gifts_receiver_name_check check (char_length(trim(receiver_name)) between 1 and 60),
  constraint gifts_sender_name_check   check (char_length(trim(sender_name)) between 1 and 60),
  constraint gifts_message_check       check (char_length(trim(message)) between 1 and 1500),
  constraint gifts_theme_check         check (theme in ('pastel-pink', 'starry-night', 'warm-sunset')),
  constraint gifts_photos_check        check (jsonb_typeof(photos) = 'array')
);

create index if not exists gifts_slug_idx          on public.gifts (slug);
create index if not exists gifts_transfer_code_idx on public.gifts (transfer_code);
create index if not exists gifts_is_paid_idx       on public.gifts (is_paid);
create index if not exists gifts_created_at_idx    on public.gifts (created_at desc);

-- ----------------------------------------------------------------------------
-- 2. TRIGGER TU DONG CAP NHAT updated_at
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists gifts_set_updated_at on public.gifts;
create trigger gifts_set_updated_at
  before update on public.gifts
  for each row
  execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
--    - anon duoc INSERT ban nhap (is_paid = false) va SELECT de polling.
--    - KHONG cho anon UPDATE / DELETE. Viec duyet don do Webhook (service_role)
--      hoac API route server-side thuc hien.
-- ----------------------------------------------------------------------------
alter table public.gifts enable row level security;

drop policy if exists "gifts_public_read" on public.gifts;
create policy "gifts_public_read"
  on public.gifts
  for select
  to anon, authenticated
  using (true);

drop policy if exists "gifts_anon_insert_draft" on public.gifts;
create policy "gifts_anon_insert_draft"
  on public.gifts
  for insert
  to anon, authenticated
  with check (is_paid = false);

-- ----------------------------------------------------------------------------
-- 4. STORAGE BUCKET CHO ANH KY NIEM
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gift-photos',
  'gift-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "gift_photos_public_read" on storage.objects;
create policy "gift_photos_public_read"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'gift-photos');

drop policy if exists "gift_photos_anon_upload" on storage.objects;
create policy "gift_photos_anon_upload"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'gift-photos');

-- ----------------------------------------------------------------------------
-- 5. (TUY CHON - CHI DUNG KHI DEV) Cho phep anon tu danh dau da thanh toan
--    de test UI ma khong can webhook. KHONG BAO GIO bat trong production.
-- ----------------------------------------------------------------------------
-- drop policy if exists "gifts_anon_dev_self_approve" on public.gifts;
-- create policy "gifts_anon_dev_self_approve"
--   on public.gifts
--   for update
--   to anon
--   using (is_paid = false)
--   with check (is_paid = true);

-- ----------------------------------------------------------------------------
-- 6. RPC TANG LUOT XEM (atomic)
--    Tang view_count bang 1 cau UPDATE duy nhat => khong bi mat du lieu khi
--    nhieu nguoi mo qua cung luc. Chi service_role duoc goi.
-- ----------------------------------------------------------------------------
create or replace function public.increment_gift_view(p_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.gifts
     set view_count = view_count + 1
   where slug = p_slug;
$$;

revoke all on function public.increment_gift_view(text) from public;
revoke all on function public.increment_gift_view(text) from anon;
revoke all on function public.increment_gift_view(text) from authenticated;
grant execute on function public.increment_gift_view(text) to service_role;

-- ----------------------------------------------------------------------------
-- 7. KIEM TRA NHANH
-- ----------------------------------------------------------------------------
-- select id, slug, transfer_code, receiver_name, is_paid, created_at
-- from public.gifts
-- order by created_at desc
-- limit 20;
