// ============================================================================
// LoveBox 3D - lop truy cap du lieu
// Khoi tao Supabase client + toan bo ham tien ich: ma hoa anh, upload,
// tao ban nhap, kiem tra trang thai thanh toan, tao link VietQR.
// ============================================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ThemeId } from './constants';

// ---------------------------------------------------------------------------
// BIEN MOI TRUONG
// ---------------------------------------------------------------------------
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const BANK_ID = process.env.NEXT_PUBLIC_BANK_ID ?? '970422';
export const BANK_ACCOUNT_NO = process.env.NEXT_PUBLIC_BANK_ACCOUNT_NO ?? '';
export const BANK_ACCOUNT_NAME = process.env.NEXT_PUBLIC_BANK_ACCOUNT_NAME ?? 'LOVEBOX';

export const PRICE_VND = Number(process.env.NEXT_PUBLIC_PRICE_VND ?? 39000);
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

/** Bucket Supabase Storage chua anh ky niem (tao trong supabase/schema.sql) */
export const PHOTO_BUCKET = 'gift-photos';

/** Da cau hinh Supabase chua? Dung de hien canh bao thay vi crash trang. */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// ---------------------------------------------------------------------------
// CLIENT
// ---------------------------------------------------------------------------
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        // Tat Data Cache cua Next.js (xem giai thich trong supabase-admin.ts)
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, { ...init, cache: 'no-store' })
      }
    })
  : null;

function requireClient(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Chưa cấu hình Supabase. Hãy mở file .env.local và điền NEXT_PUBLIC_SUPABASE_URL cùng NEXT_PUBLIC_SUPABASE_ANON_KEY, sau đó khởi động lại dev server.'
    );
  }
  return supabase;
}

// ---------------------------------------------------------------------------
// KIEU DU LIEU
// ---------------------------------------------------------------------------
export interface GiftRow {
  id: string;
  slug: string;
  transfer_code: string;
  receiver_name: string;
  sender_name: string;
  message: string;
  theme: ThemeId;
  music: string;
  photos: string[];
  amount: number;
  is_paid: boolean;
  paid_at: string | null;
  payment_ref: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface GiftDraftInput {
  receiverName: string;
  senderName: string;
  message: string;
  theme: ThemeId;
  music: string;
  photos: string[];
}

export interface GiftStatus {
  is_paid: boolean;
  slug: string | null;
}

// ---------------------------------------------------------------------------
// SINH MA / SLUG
// ---------------------------------------------------------------------------
const TOKEN_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

export function randomToken(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += TOKEN_ALPHABET.charAt(Math.floor(Math.random() * TOKEN_ALPHABET.length));
  }
  return out;
}

/**
 * Ma giao dich duy nhat hien tren noi dung chuyen khoan.
 * Dinh dang: LOVE + dung 5 chu so (VD: LOVE12345).
 *
 * LUU Y: dinh dang nay PHAI khop voi TRANSFER_CODE_REGEX trong
 * src/app/api/webhook/payment/route.ts. Doi ben nay thi phai doi ben kia.
 */
export function generateTransferCode(): string {
  let digits = '';
  for (let index = 0; index < 5; index += 1) {
    digits += String(Math.floor(Math.random() * 10));
  }
  return `LOVE${digits}`;
}

/**
 * Slug ngau nhien 6 ky tu cho link chia se /g/[slug].
 * Bang chu cai da loai bo l, o, 0, 1 => tranh nham lan khi doc/gox link.
 * 32^6 = ~1,07 ty to hop nen gan nhu khong bao gio trung.
 */
export function generateSlug(): string {
  return randomToken(6);
}

// ---------------------------------------------------------------------------
// VIETQR
// ---------------------------------------------------------------------------
/**
 * Tao URL anh VietQR QuickLink (mien phi, khong can API key).
 * Chuan: https://img.vietqr.io/image/{BANK_ID}-{ACCOUNT_NO}-{TEMPLATE}.png
 */
export function buildVietQrUrl(
  transferCode: string,
  amount: number = PRICE_VND,
  template: string = 'compact2'
): string {
  const params = new URLSearchParams({
    amount: String(amount),
    addInfo: transferCode,
    accountName: BANK_ACCOUNT_NAME
  });
  return `https://img.vietqr.io/image/${BANK_ID}-${BANK_ACCOUNT_NO}-${template}.png?${params.toString()}`;
}

/** Link cong khai cua mon qua */
export function buildGiftUrl(slug: string): string {
  return `${SITE_URL}/g/${slug}`;
}

/** Anh QR chua link mon qua (dung cho Thiep QR Ky Thuat So) */
export function buildQrImageUrl(data: string, size = 360): string {
  const params = new URLSearchParams({
    size: `${size}x${size}`,
    margin: '10',
    color: '0-0-0-0',
    bgcolor: '255-255-255-255',
    data
  });
  return `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// TIEN ICH HIEN THI
// ---------------------------------------------------------------------------
export function formatVnd(value: number): string {
  return `${value.toLocaleString('vi-VN')}đ`;
}

export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// NEN ANH PHIA CLIENT TRUOC KHI UPLOAD
// Anh tu dien thoai thuong 3-8MB. Nen ve toi da 1280px truoc khi upload giup
// tang toc do tai trang qua tang 3-5 lan - rat quan trong voi luong TikTok.
// ---------------------------------------------------------------------------
export async function compressImageFile(file: File, maxSize = 1280, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (file.type === 'image/gif') return file;

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Không đọc được tệp ảnh.'));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Không tải được ảnh để nén.'));
    img.src = dataUrl;
  });

  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', quality);
  });
  if (!blob) return file;

  const newName = `${file.name.replace(/\.[^.]+$/, '') || 'anh'}.jpg`;
  return new File([blob], newName, { type: 'image/jpeg' });
}

// ---------------------------------------------------------------------------
// UPLOAD ANH LEN SUPABASE STORAGE
// ---------------------------------------------------------------------------
export async function uploadGiftPhoto(file: File, folder: string): Promise<string> {
  const client = requireClient();
  const compressed = await compressImageFile(file);

  const ext =
    compressed.type === 'image/png' ? 'png' : compressed.type === 'image/webp' ? 'webp' : compressed.type === 'image/gif' ? 'gif' : 'jpg';

  const path = `${folder}/${Date.now()}-${randomToken(10)}.${ext}`;

  const { error } = await client.storage.from(PHOTO_BUCKET).upload(path, compressed, {
    cacheControl: '31536000',
    upsert: false,
    contentType: compressed.type
  });

  if (error) {
    throw new Error(`Tải ảnh lên thất bại: ${error.message}`);
  }

  const { data } = client.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error('Không lấy được đường dẫn ảnh sau khi tải lên.');
  }
  return data.publicUrl;
}

export async function uploadGiftPhotos(files: File[], folder: string): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    urls.push(await uploadGiftPhoto(file, folder));
  }
  return urls;
}

// ---------------------------------------------------------------------------
// TAO BAN NHAP MON QUA (is_paid = false)
// Ghi du lieu di qua API route /api/gifts de:
//   - khoa service_role khong bao gio lo ra trinh duyet
//   - kiem tra du lieu 1 lan duy nhat o server
//   - co the gan rate limit chong spam
// ---------------------------------------------------------------------------
export interface CreateGiftResult extends GiftRow {
  gift_url: string;
  vietqr_url: string;
}

export async function createGift(input: GiftDraftInput): Promise<CreateGiftResult> {
  let response: Response;
  try {
    response = await fetch('/api/gifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
  } catch {
    throw new Error('Không kết nối được tới máy chủ. Kiểm tra lại mạng rồi thử lại.');
  }

  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; message?: string; data?: CreateGiftResult }
    | null;

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message ?? `Không lưu được món quà (mã lỗi ${response.status}).`);
  }

  return payload.data;
}

// ---------------------------------------------------------------------------
// DOC TRANG THAI THANH TOAN (phuc vu polling o Frontend)
// ---------------------------------------------------------------------------
export async function getGiftStatus(transferCode: string): Promise<GiftStatus> {
  const response = await fetch(`/api/gifts?transfer_code=${encodeURIComponent(transferCode)}`, {
    cache: 'no-store'
  });

  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; message?: string; data?: { is_paid?: boolean; slug?: string } }
    | null;

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message ?? `Không kiểm tra được trạng thái (mã lỗi ${response.status}).`);
  }

  return {
    is_paid: Boolean(payload.data.is_paid),
    slug: payload.data.slug ?? null
  };
}
