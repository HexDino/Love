// ============================================================================
// LoveBox 3D - API /api/webhook/payment
// Nhan webhook bien dong so du ngan hang, ho tro ca 2 chuan pho bien:
//   - SePay : 1 object phang  { content, transferAmount, transferType, ... }
//   - Casso : { error: 0, data: [ { description, amount, tid, ... } ] }
//
// Luong xu ly:
//   1. Xac thuc header bao mat (Authorization: Apikey / Secure-Token / x-webhook-secret)
//   2. Chuan hoa payload ve cung 1 kieu du lieu
//   3. Regex tim ma LOVE + 5 chu so trong noi dung chuyen khoan
//   4. Kiem tra so tien >= 39000 va dung tai khoan nhan
//   5. Cap nhat is_paid = true (idempotent - goi lai nhieu lan khong sao)
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getAdminClient } from '@/lib/supabase-admin';
import { BANK_ACCOUNT_NO, PRICE_VND } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Ma giao dich LoveBox: chu LOVE + dung 5 chu so. VD: LOVE12345 */
const TRANSFER_CODE_REGEX = /LOVE\d{5}/;

// ---------------------------------------------------------------------------
// XAC THUC
// ---------------------------------------------------------------------------
function extractSecret(request: NextRequest): string {
  const authorization = request.headers.get('authorization') ?? '';
  const lower = authorization.toLowerCase();

  if (lower.startsWith('apikey ')) return authorization.slice(7).trim();
  if (lower.startsWith('bearer ')) return authorization.slice(7).trim();

  const candidates = [
    request.headers.get('x-webhook-secret'),
    request.headers.get('secure-token'),
    request.headers.get('x-casso-signature'),
    request.headers.get('x-sepay-signature'),
    request.headers.get('x-api-key')
  ];

  for (const value of candidates) {
    if (value && value.trim()) return value.trim();
  }
  return '';
}

/** So sanh chuoi theo thoi gian hang so - chan tan cong do do dai/ky tu */
function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

function isAuthorized(request: NextRequest): { ok: true } | { ok: false; reason: string } {
  const expected = (process.env.WEBHOOK_SECRET ?? '').trim();

  if (!expected) {
    // Chua cau hinh bi mat => tu choi het de tranh mo cong cho nguoi la.
    return {
      ok: false,
      reason:
        'Server chưa cấu hình WEBHOOK_SECRET. Thêm biến này vào .env.local trước khi dùng webhook.'
    };
  }

  const received = extractSecret(request);
  if (!received) {
    return { ok: false, reason: 'Thiếu header xác thực (Authorization: Apikey <secret> hoặc Secure-Token).' };
  }
  if (!safeEqual(received, expected)) {
    return { ok: false, reason: 'Sai khóa xác thực webhook.' };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// CHUAN HOA PAYLOAD
// ---------------------------------------------------------------------------
interface NormalizedTransaction {
  content: string;
  amount: number;
  referenceCode: string;
  gateway: string;
  accountNumber: string;
  transactionDate: string;
  isIncoming: boolean;
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.-]/g, '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function pickFirst(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = asString(source[key]);
    if (value) return value;
  }
  return '';
}

/** Chuyen 1 ban ghi bat ky (SePay / Casso / tu dinh nghia) ve kieu chuan */
function normalizeOne(raw: unknown): NormalizedTransaction | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;

  const content = pickFirst(item, ['content', 'description', 'transaction_content', 'remark', 'note']);
  const amount = asNumber(item.transferAmount ?? item.amount ?? item.transactionAmount ?? item.creditAmount);

  const transferType = pickFirst(item, ['transferType', 'transfer_type', 'type']).toLowerCase();
  // SePay: "in" = tien vao, "out" = tien ra. Casso khong gui truong nay => coi la tien vao.
  const isIncoming = transferType === '' ? true : transferType === 'in' || transferType === 'credit';

  const referenceCode =
    pickFirst(item, ['referenceCode', 'reference_code', 'tid', 'transactionId', 'transaction_id', 'id']) ||
    `LBX-${Date.now().toString(36).toUpperCase()}`;

  const gateway = pickFirst(item, ['gateway', 'bankName', 'bank_name', 'bankAbbrevName', 'bank']);
  const accountNumber = pickFirst(item, [
    'accountNumber',
    'account_number',
    'subAccId',
    'sub_account_id',
    'bank_sub_acc_id',
    'bankSubAccId'
  ]);
  const transactionDate = pickFirst(item, [
    'transactionDate',
    'transaction_date',
    'when',
    'transaction_time',
    'transactionTime'
  ]);

  if (!content && amount === 0) return null;

  return { content, amount, referenceCode, gateway, accountNumber, transactionDate, isIncoming };
}

function normalizePayload(payload: unknown): NormalizedTransaction[] {
  if (Array.isArray(payload)) {
    return payload.map(normalizeOne).filter((item): item is NormalizedTransaction => item !== null);
  }

  if (payload && typeof payload === 'object') {
    const body = payload as Record<string, unknown>;

    // Casso: { error: 0, data: [...] }
    if (Array.isArray(body.data)) {
      return body.data.map(normalizeOne).filter((item): item is NormalizedTransaction => item !== null);
    }
    // Mot so provider boc trong { data: {...} }
    if (body.data && typeof body.data === 'object') {
      const single = normalizeOne(body.data);
      if (single) return [single];
    }
    // SePay: { transactions: [...] }
    if (Array.isArray(body.transactions)) {
      return body.transactions.map(normalizeOne).filter((item): item is NormalizedTransaction => item !== null);
    }
    // SePay: object phang
    const flat = normalizeOne(body);
    if (flat) return [flat];
  }

  return [];
}

// ---------------------------------------------------------------------------
// SO KHOP TAI KHOAN NHAN
// Chi so sanh 4 chu so cuoi vi nhieu ngan hang tra ve so tai khoan bi che
// (VD: ****6688 hoac 1017***688).
// ---------------------------------------------------------------------------
function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function matchesReceivingAccount(payloadAccount: string): boolean {
  const expectedDigits = digitsOnly(BANK_ACCOUNT_NO);
  const receivedDigits = digitsOnly(payloadAccount);

  if (!expectedDigits || !receivedDigits) return true; // Thieu du lieu => bo qua buoc kiem tra
  if (expectedDigits.length < 4 || receivedDigits.length < 4) return true;

  return expectedDigits.slice(-4) === receivedDigits.slice(-4);
}

// ---------------------------------------------------------------------------
// POST /api/webhook/payment
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const auth = isAuthorized(request);
  if (!auth.ok) {
    console.warn('[webhook/payment] Tu choi:', auth.reason);
    return NextResponse.json({ success: false, error: 1, message: auth.reason }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 1, message: 'Body phải là JSON hợp lệ.' },
      { status: 400 }
    );
  }

  const transactions = normalizePayload(payload);
  if (transactions.length === 0) {
    // Van tra 200 de ngan hang khong retry vo han.
    return NextResponse.json({
      success: true,
      error: 0,
      message: 'Không tìm thấy giao dịch nào trong payload.',
      data: { received: 0, unlocked: 0, skipped: 0 }
    });
  }

  let supabase;
  try {
    supabase = getAdminClient();
  } catch (error) {
    console.error('[webhook/payment] Khong lay duoc admin client:', error);
    return NextResponse.json(
      { success: false, error: 1, message: error instanceof Error ? error.message : 'Lỗi cấu hình máy chủ.' },
      { status: 500 }
    );
  }

  const unlocked: Array<{ transfer_code: string; slug: string; amount: number }> = [];
  const skipped: Array<{ reason: string; reference_code: string }> = [];

  for (const transaction of transactions) {
    if (!transaction.isIncoming) {
      skipped.push({ reason: 'Giao dịch tiền ra, bỏ qua', reference_code: transaction.referenceCode });
      continue;
    }

    if (!matchesReceivingAccount(transaction.accountNumber)) {
      skipped.push({ reason: 'Không phải tài khoản nhận của LoveBox', reference_code: transaction.referenceCode });
      continue;
    }

    if (transaction.amount < PRICE_VND) {
      skipped.push({
        reason: `Số tiền ${transaction.amount} < ${PRICE_VND}`,
        reference_code: transaction.referenceCode
      });
      continue;
    }

    const upperContent = transaction.content.toUpperCase();
    const match = upperContent.match(TRANSFER_CODE_REGEX);

    if (!match) {
      skipped.push({ reason: 'Nội dung không chứa mã LOVE + 5 chữ số', reference_code: transaction.referenceCode });
      continue;
    }

    const transferCode = match[0];

    // Cap nhat co dieu kien: chi thanh cong khi don CHUA thanh toan.
    // Neu webhook bi goi lai (retry), dieu kien is_paid = false khong con dung
    // => khong co dong nao khop => khong ghi de paid_at ban dau. Idempotent.
    //
    // LUU Y: KHONG dung .maybeSingle() o day. Voi PATCH, khi 0 dong khop,
    // PostgREST tra ve loi PGRST116 (HTTP 406) chu khong phai data = null,
    // nen nhanh kiem tra "da mo khoa truoc do" se khong bao gio chay.
    // Dung .select() thuong => nhan ve mang rong [] => xu ly sach se hon.
    const { data, error } = await supabase
      .from('gifts')
      .update({
        is_paid: true,
        paid_at: new Date().toISOString(),
        payment_ref: transaction.referenceCode
      })
      .eq('transfer_code', transferCode)
      .eq('is_paid', false)
      .select('slug, transfer_code');

    // PGRST116 = khong co dong nao khop => coi nhu "khong cap nhat duoc"
    if (error && error.code !== 'PGRST116') {
      console.error('[webhook/payment] Update loi:', error.message);
      skipped.push({ reason: `Lỗi cập nhật: ${error.message}`, reference_code: transaction.referenceCode });
      continue;
    }

    const updatedRow = Array.isArray(data) ? data[0] : data;

    if (!updatedRow) {
      // Hoac khong tim thay ma, hoac don da duoc mo khoa truoc do.
      const { data: existing } = await supabase
        .from('gifts')
        .select('slug, is_paid')
        .eq('transfer_code', transferCode)
        .maybeSingle();

      skipped.push({
        reason: existing
          ? `Đơn ${transferCode} đã được mở khoá trước đó`
          : `Không tìm thấy đơn với mã ${transferCode}`,
        reference_code: transaction.referenceCode
      });
      continue;
    }

    unlocked.push({
      transfer_code: updatedRow.transfer_code as string,
      slug: updatedRow.slug as string,
      amount: transaction.amount
    });
    console.log(`[webhook/payment] Da mo khoa don ${transferCode} -> /g/${updatedRow.slug}`);
  }

  return NextResponse.json({
    success: true,
    error: 0,
    message: `Đã mở khoá ${unlocked.length}/${transactions.length} giao dịch.`,
    data: { received: transactions.length, unlocked, skipped }
  });
}

// ---------------------------------------------------------------------------
// GET - dung de kiem tra endpoint con song (khong tiet lo bi mat)
// ---------------------------------------------------------------------------
export async function GET() {
  return NextResponse.json({
    success: true,
    error: 0,
    message: 'LoveBox 3D payment webhook đang hoạt động. Hãy gửi POST từ SePay/Casso tới endpoint này.',
    data: {
      method: 'POST',
      accepts: ['SePay', 'Casso'],
      expected_code_pattern: 'LOVE + 5 chữ số',
      minimum_amount: PRICE_VND
    }
  });
}
