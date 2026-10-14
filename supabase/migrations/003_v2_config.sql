-- ============================================================================
-- LoveBox 3D - Migration PHAN 2 / V2: cot `config` (JSONB)
-- ----------------------------------------------------------------------------
-- Chay file nay neu ban DA chay supabase/schema.sql truoc do.
-- (File schema.sql cung da duoc cap nhat kem san cot nay cho nguoi cai moi.)
--
-- File nay chi lam DUY NHAT 1 viec: them cot `config` kieu jsonb vao bang
-- public.gifts, de luu toan bo cau hinh mo rong cua V2:
--
--   {
--     "template":      "galaxy-3d" | "polaroid-vinyl" | "sweet-trap" | "blindbox-2010",
--     "passcode":      "2010",              -- 4 chu so, "" = khong khoa
--     "passcodeHint":  "Goi y: nam chung minh gap nhau",
--     "scratchMessage":"Loi nhan bi mat an duoi the cao",
--     "coupons":       ["1 Chau Tra Sua Full Topping", "..."],
--     "captions":      ["Chu thich anh 1", "Chu thich anh 2", "..."]
--   }
--
-- TAI SAO DUNG 1 COT JSONB THAY VI NHIEU COT?
--   Sau nay them tuy chon moi (am thanh, hieu ung, font chu, sticker...) chi can
--   sua code TypeScript trong src/lib/constants.ts -> KHONG phai chay ALTER TABLE
--   them mot lan nua. Doi lai: khong the dat CHECK constraint chi tiet cho tung
--   truong ben trong JSONB, nen viec kiem tra du lieu duoc thuc hien o tang API
--   bang ham normalizeGiftConfig() truoc khi ghi xuong database.
--
-- AN TOAN: dung IF NOT EXISTS nen chay lai file nay bao nhieu lan cung duoc,
-- khong lam mat du lieu dang co. Cac mon qua cu se tu dong nhan gia tri '{}'.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. THEM COT CONFIG
-- ----------------------------------------------------------------------------
alter table public.gifts
  add column if not exists config jsonb not null default '{}'::jsonb;

-- ----------------------------------------------------------------------------
-- 2. RANG BUOC: config phai la mot OBJECT JSON (khong duoc la array/string/so)
--    Dung DO block de tranh loi "constraint already exists" khi chay lai.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'gifts_config_check'
       and conrelid = 'public.gifts'::regclass
  ) then
    alter table public.gifts
      add constraint gifts_config_check check (jsonb_typeof(config) = 'object');
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. INDEX GIN (tuy chon, chi co loi neu sau nay can TRUY VAN theo truong
--    ben trong config, vi du: dem xem bao nhieu mon qua dung kieu 'blindbox-2010')
--    Neu ban chi doc/ghi nguyen khoi config thi co the bo qua index nay.
-- ----------------------------------------------------------------------------
create index if not exists gifts_config_gin_idx
  on public.gifts using gin (config jsonb_path_ops);

-- ----------------------------------------------------------------------------
-- 4. DON DEP DU LIEU CU (an toan, chay 1 lan)
--    Cac ban ghi cu se co config = '{}'. Ham normalizeGiftConfig() o tang code
--    da tu dong hieu '{}' la "dung mac dinh" (galaxy-3d, khong mat khau), nen
--    KHONG bat buoc phai chay cau UPDATE duoi day.
--    Bo comment neu ban muon ghi ro rang ra database.
-- ----------------------------------------------------------------------------
-- update public.gifts
--    set config = jsonb_build_object(
--          'template', 'galaxy-3d',
--          'passcode', '',
--          'passcodeHint', '',
--          'scratchMessage', '',
--          'coupons', '[]'::jsonb,
--          'captions', '[]'::jsonb
--        )
--  where config = '{}'::jsonb;

-- ----------------------------------------------------------------------------
-- 5. KIEM TRA NHANH SAU KHI CHAY
-- ----------------------------------------------------------------------------
-- select column_name, data_type, column_default, is_nullable
--   from information_schema.columns
--  where table_schema = 'public'
--    and table_name = 'gifts'
--    and column_name = 'config';
--
-- select slug, config -> 'template' as template, config -> 'passcode' as passcode
--   from public.gifts
--  order by created_at desc
--  limit 10;
