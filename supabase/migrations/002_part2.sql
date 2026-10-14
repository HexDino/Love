-- ============================================================================
-- LoveBox 3D - Migration PHAN 2
-- Chay file nay neu ban DA chay supabase/schema.sql o Phan 1 truoc do.
-- Neu ban cai moi hoan toan thi chi can chay schema.sql (da bao gom san).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- RPC tang luot xem (atomic, tranh mat du lieu khi truy cap dong thoi)
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
-- TUY CHON: chan anon tu tao don truc tiep
-- Tu Phan 2, viec tao don da di qua API route /api/gifts (dung service_role),
-- nen co the go policy cho phep anon INSERT de chat hon.
-- Bo comment 2 dong duoi neu ban muon khoa hoan toan duong ghi truc tiep.
-- ----------------------------------------------------------------------------
-- drop policy if exists "gifts_anon_insert_draft" on public.gifts;

-- ----------------------------------------------------------------------------
-- DON DEP: neu da bat policy dev tu duyet don o Phan 1 thi nen tat di
-- ----------------------------------------------------------------------------
-- drop policy if exists "gifts_anon_dev_self_approve" on public.gifts;
