// ============================================================================
// LoveBox 3D - API /api/gifts
//   POST  Tao mon qua moi  -> tra ve slug + transfer_code de hien ma VietQR
//   GET   Kiem tra trang thai is_paid  -> phuc vu polling o Frontend
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import {
  MAX_COUPON_LENGTH,
  MAX_COUPONS,
  MAX_PASSCODE_HINT_LENGTH,
  MAX_PHOTOS,
  MAX_SCRATCH_LENGTH,
  MIN_PHOTOS,
  THEMES,
  DEFAULT_MUSIC_ID,
  MUSIC_TRACKS,
  isTemplateStyle,
  normalizeGiftConfig,
  type GiftConfig,
  type ThemeId
} from '@/lib/constants';
import {
  PRICE_VND,
  buildGiftUrl,
  buildVietQrUrl,
  generateSlug,
  generateTransferCode
} from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UNIQUE_VIOLATION = '23505';
const UNDEFINED_COLUMN = '42703';
const MAX_MESSAGE_LENGTH = 1500;
const MAX_NAME_LENGTH = 60;

// ---------------------------------------------------------------------------
// RATE LIMIT DON GIAN (in-memory)
// Du cho 1 instance / 1 container. Neu scale nhieu instance thi thay bang Redis
// hoac Upstash. Muc dich: chan spam tao don rac lam phinh database.
// ---------------------------------------------------------------------------
const rateBuckets = new Map<string, number[]>();

function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (rateBuckets.get(key) ?? []).filter((time) => now - time < windowMs);
  hits.push(now);
  rateBuckets.set(key, hits);

  if (rateBuckets.size > 5000) {
    for (const [bucketKey, bucketValue] of rateBuckets) {
      if (bucketValue.every((time) => now - time > windowMs)) {
        rateBuckets.delete(bucketKey);
      }
    }
  }

  return hits.length > limit;
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

// ---------------------------------------------------------------------------
// CHUAN HOA + KIEM TRA DU LIEU
// ---------------------------------------------------------------------------
interface GiftPayload {
  receiverName: string;
  senderName: string;
  message: string;
  theme: ThemeId;
  music: string;
  photos: string[];
  config: GiftConfig;
}

function fail(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ success: false, message, ...extra }, { status });
}

/**
 * Kiem tra `config` gui len co vuot gioi han khong.
 *
 * `normalizeGiftConfig` da cat gon moi truong, nhung neu nguoi dung gui len
 * 500 ve dac quyen thi do la dau hieu spam chu khong phai nham lan — bao loi
 * ro rang thay vi im lang cat bot.
 */
function validateConfigSize(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return 'Trường "config" phải là một object.';
  }

  const config = raw as Record<string, unknown>;

  if (config.template !== undefined && !isTemplateStyle(config.template)) {
    return 'Kiểu trình diễn không hợp lệ.';
  }

  if (config.passcode !== undefined && config.passcode !== '') {
    if (typeof config.passcode !== 'string' || !/^\d{4}$/.test(config.passcode.trim())) {
      return 'Mật khẩu mở quà phải gồm đúng 4 chữ số.';
    }
  }

  if (Array.isArray(config.coupons) && config.coupons.length > MAX_COUPONS) {
    return `Tối đa ${MAX_COUPONS} vé đặc quyền.`;
  }
  if (Array.isArray(config.coupons)) {
    const tooLong = config.coupons.some(
      (item) => typeof item === 'string' && item.trim().length > MAX_COUPON_LENGTH
    );
    if (tooLong) return `Mỗi vé đặc quyền tối đa ${MAX_COUPON_LENGTH} ký tự.`;
  }

  if (Array.isArray(config.captions) && config.captions.length > MAX_PHOTOS) {
    return `Tối đa ${MAX_PHOTOS} chú thích ảnh.`;
  }

  if (typeof config.scratchMessage === 'string' && config.scratchMessage.length > MAX_SCRATCH_LENGTH * 2) {
    return `Lời nhắn bí mật tối đa ${MAX_SCRATCH_LENGTH} ký tự.`;
  }

  if (
    typeof config.passcodeHint === 'string' &&
    config.passcodeHint.length > MAX_PASSCODE_HINT_LENGTH * 2
  ) {
    return `Câu gợi ý mật khẩu tối đa ${MAX_PASSCODE_HINT_LENGTH} ký tự.`;
  }

  return null;
}

function parseGiftPayload(raw: unknown): { data: GiftPayload } | { error: string } {
  if (!raw || typeof raw !== 'object') {
    return { error: 'Dữ liệu gửi lên không hợp lệ.' };
  }

  const body = raw as Record<string, unknown>;

  const receiverName = typeof body.receiverName === 'string' ? body.receiverName.trim() : '';
  const senderName = typeof body.senderName === 'string' ? body.senderName.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const themeRaw = typeof body.theme === 'string' ? body.theme : '';
  const musicRaw = typeof body.music === 'string' ? body.music : '';
  const photosRaw = Array.isArray(body.photos) ? body.photos : [];

  if (!receiverName) return { error: 'Thiếu tên người nhận.' };
  if (receiverName.length > MAX_NAME_LENGTH) {
    return { error: `Tên người nhận tối đa ${MAX_NAME_LENGTH} ký tự.` };
  }
  if (!senderName) return { error: 'Thiếu tên người gửi.' };
  if (senderName.length > MAX_NAME_LENGTH) {
    return { error: `Tên người gửi tối đa ${MAX_NAME_LENGTH} ký tự.` };
  }
  if (!message) return { error: 'Thiếu lời chúc.' };
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { error: `Lời chúc tối đa ${MAX_MESSAGE_LENGTH} ký tự.` };
  }

  if (!(themeRaw in THEMES)) {
    return { error: `Chủ đề "${themeRaw}" không tồn tại.` };
  }

  const configError = validateConfigSize(body.config);
  if (configError) return { error: configError };

  const theme = themeRaw as ThemeId;
  const music = MUSIC_TRACKS.some((track) => track.id === musicRaw) ? musicRaw : DEFAULT_MUSIC_ID;

  const photos = photosRaw
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => /^https?:\/\//i.test(item))
    .slice(0, MAX_PHOTOS);

  if (photos.length < MIN_PHOTOS) {
    return {
      error: `Cần ít nhất ${MIN_PHOTOS} ảnh hợp lệ (link phải bắt đầu bằng http:// hoặc https://). Hiện có ${photos.length}.`
    };
  }

  // Chuan hoa lan cuoi o server: du client co gui gi thi du lieu vao DB
  // van dung dinh dang va dung do dai.
  const config = normalizeGiftConfig(body.config);
  // Cat bot chu thich neu so anh thuc te it hon
  config.captions = config.captions.slice(0, photos.length);

  return { data: { receiverName, senderName, message, theme, music, photos, config } };
}

// ---------------------------------------------------------------------------
// POST /api/gifts
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  if (isRateLimited(`create:${ip}`, 12, 60_000)) {
    return fail('Bạn đã tạo quá nhiều món quà trong một phút. Vui lòng thử lại sau.', 429);
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return fail('Body phải là JSON hợp lệ.');
  }

  const parsed = parseGiftPayload(rawBody);
  if ('error' in parsed) {
    return fail(parsed.error);
  }

  const payload = parsed.data;

  let supabase;
  try {
    supabase = getAdminClient();
  } catch (error) {
    console.error('[api/gifts] Khong lay duoc admin client:', error);
    return fail(error instanceof Error ? error.message : 'Lỗi cấu hình máy chủ.', 500);
  }

  const row = {
    receiver_name: payload.receiverName,
    sender_name: payload.senderName,
    message: payload.message,
    theme: payload.theme,
    music: payload.music,
    photos: payload.photos,
    config: payload.config,
    amount: PRICE_VND,
    is_paid: false
  };

  // Thu lai toi da 5 lan neu slug hoac transfer_code bi trung
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = generateSlug();
    const transferCode = generateTransferCode();

    const { data, error } = await supabase
      .from('gifts')
      .insert({ ...row, slug, transfer_code: transferCode })
      .select('*')
      .single();

    if (!error && data) {
      return NextResponse.json(
        {
          success: true,
          message: 'Đã tạo món quà. Quét mã VietQR để mở khoá.',
          data: {
            ...data,
            config: payload.config,
            gift_url: buildGiftUrl(data.slug),
            vietqr_url: buildVietQrUrl(data.transfer_code, data.amount)
          }
        },
        { status: 201 }
      );
    }

    if (error && (error.code === UNDEFINED_COLUMN || error.message.includes('config'))) {
      console.error('[api/gifts] Thieu cot config:', error.message);
      return fail(
        'Cơ sở dữ liệu chưa được nâng cấp. Hãy chạy file supabase/migrations/003_v2_config.sql trong Supabase SQL Editor rồi thử lại.',
        500
      );
    }

    if (error && error.code !== UNIQUE_VIOLATION) {
      console.error('[api/gifts] Insert loi:', error.code, error.message);
      return fail(`Không lưu được món quà: ${error.message}`, 500);
    }
  }

  return fail('Không sinh được mã đơn duy nhất sau nhiều lần thử. Vui lòng thử lại.', 500);
}

// ---------------------------------------------------------------------------
// GET /api/gifts?transfer_code=LOVE12345   -> trang thai thanh toan (polling)
// GET /api/gifts?slug=abc123               -> du lieu cong khai cua mon qua
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const transferCode = request.nextUrl.searchParams.get('transfer_code')?.trim() ?? '';
  const slug = request.nextUrl.searchParams.get('slug')?.trim() ?? '';

  if (!transferCode && !slug) {
    return fail('Thiếu tham số "transfer_code" hoặc "slug".');
  }

  let supabase;
  try {
    supabase = getAdminClient();
  } catch (error) {
    console.error('[api/gifts] Khong lay duoc admin client:', error);
    return fail(error instanceof Error ? error.message : 'Lỗi cấu hình máy chủ.', 500);
  }

  const noStore = { headers: { 'Cache-Control': 'no-store, max-age=0' } };

  if (transferCode) {
    if (!/^LOVE\d{5}$/i.test(transferCode)) {
      return fail('Mã giao dịch không đúng định dạng LOVE + 5 chữ số.');
    }

    const { data, error } = await supabase
      .from('gifts')
      .select('slug, transfer_code, is_paid, amount, paid_at')
      .eq('transfer_code', transferCode.toUpperCase())
      .maybeSingle();

    if (error) {
      console.error('[api/gifts] GET theo transfer_code loi:', error.message);
      return fail('Không kiểm tra được trạng thái đơn hàng.', 500);
    }
    if (!data) {
      return fail('Không tìm thấy đơn hàng với mã giao dịch này.', 404);
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          slug: data.slug,
          transfer_code: data.transfer_code,
          is_paid: Boolean(data.is_paid),
          amount: data.amount,
          paid_at: data.paid_at,
          gift_url: buildGiftUrl(data.slug as string)
        }
      },
      noStore
    );
  }

  const { data, error } = await supabase
    .from('gifts')
    .select('slug, receiver_name, sender_name, theme, music, photos, config, is_paid, view_count, created_at')
    .eq('slug', slug)
    .maybeSingle();

  if (error && (error.code === UNDEFINED_COLUMN || error.message.includes('config'))) {
    // Database chua chay migration 003 - van tra du lieu co ban
    const fallback = await supabase
      .from('gifts')
      .select('slug, receiver_name, sender_name, theme, music, photos, is_paid, view_count, created_at')
      .eq('slug', slug)
      .maybeSingle();

    if (fallback.error) {
      console.error('[api/gifts] GET theo slug loi (fallback):', fallback.error.message);
      return fail('Không đọc được dữ liệu món quà.', 500);
    }
    if (!fallback.data) {
      return fail('Không tìm thấy món quà.', 404);
    }
    return NextResponse.json(
      { success: true, data: { ...fallback.data, config: normalizeGiftConfig(null) } },
      noStore
    );
  }

  if (error) {
    console.error('[api/gifts] GET theo slug loi:', error.message);
    return fail('Không đọc được dữ liệu món quà.', 500);
  }
  if (!data) {
    return fail('Không tìm thấy món quà.', 404);
  }

  return NextResponse.json(
    { success: true, data: { ...data, config: normalizeGiftConfig(data.config) } },
    noStore
  );
}
