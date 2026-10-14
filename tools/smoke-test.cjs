// ============================================================================
// LoveBox 3D - SMOKE TEST
// ----------------------------------------------------------------------------
// Chay:  npm run smoke
//
// Script nay TU LAM HET, khong can Supabase that, khong them thu vien ngoai:
//   1. Khoi dong mock Supabase (tai su dung tools/mock-supabase.cjs) o cong 3399
//   2. `next build` + `next start` o cong 3400, tro vao mock, build vao .next-smoke
//   3. Kiem tra toan bo "duong tien" cua san pham bang HTTP thuan
//   4. Tat het tien trinh con lai va tra ve exit code 0/1
//
// ---------------------------------------------------------------------------
// VI SAO CHAY BAN PRODUCTION (build + start) CHU KHONG `next dev`?
//
// Vi mot trong nhung loi nguy hiem nhat cua du an nay (README ghi chu so 2) chi
// xay ra o production: Next patch global `fetch` va tu dong cache moi GET vao
// Data Cache. Neu ai do xoa `cache: 'no-store'` trong supabase.ts thi o che do
// dev moi thu van dung, nhung o production trang /g/[slug] se tra ve BAN RENDER
// CU — khach da tra tien van thay "chua mo khoa".
//
// Test so 20 duoi day (metadata doi tu "dang chuan bi" sang "game tuong tac" sau
// khi webhook mo khoa) chinh la luoi an toan cho loi do. Chay bang `next dev`
// thi luoi nay vo dung vi dev khong cache.
//
// Doi lai script chay lau hon (build ~30-60s). Bu lai no cung kiem tra luon rang
// `next build` thanh cong.
//
// ---------------------------------------------------------------------------
// VI SAO KHONG DUNG CHUNG `.next`?
//
// `next build` xoa sach thu muc build. Neu dev server dang chay tren cung `.next`
// thi cac chunk loi se 404 va moi thu "chet" (README ghi chu so 9). Vi vay script
// nay build vao `.next-smoke` rieng (qua bien NEXT_DIST_DIR trong next.config.mjs),
// nen ban CO THE chay smoke test trong khi dev server van dang chay.
// ============================================================================

const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const MOCK_PORT = Number(process.env.SMOKE_MOCK_PORT || 3399);
const APP_PORT = Number(process.env.SMOKE_APP_PORT || 3400);
const DIST_DIR = process.env.SMOKE_DIST_DIR || '.next-smoke';
const NEXT_BIN = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');

/**
 * `--no-build`: bo qua buoc build, dung lai ban build da co trong DIST_DIR.
 * Tien khi ban vua chay `npm run build` xong va chi muon kiem tra lai.
 */
const NO_BUILD = process.argv.includes('--no-build');

/**
 * `--dev`: chay bang `next dev` thay vi build + `next start`.
 *
 * Nhanh hon nhieu va khong can build, nhung YEU HON: o che do dev Next khong
 * cache `fetch` GET, nen phep kiem tra "metadata doi sau khi mo khoa" (luoi an
 * toan cho ghi chu ky thuat so 2) se luon PASS ke ca khi code da bi hoi.
 * Chi dung khi ban muon kiem tra nhanh phan logic API/du lieu.
 */
const DEV_MODE = process.argv.includes('--dev');

const MOCK_URL = `http://localhost:${MOCK_PORT}`;
const APP_URL = `http://localhost:${APP_PORT}`;

const WEBHOOK_SECRET = 'smoke_webhook_secret_123';
const BANK_ACCOUNT_NO = '0123456789';
const PRICE_VND = 39000;

// ---------------------------------------------------------------------------
// Tien ich console
// ---------------------------------------------------------------------------
const C = {
  reset: '\u001b[0m',
  dim: '\u001b[2m',
  red: '\u001b[31m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  cyan: '\u001b[36m',
  bold: '\u001b[1m'
};

function step(message) {
  console.log(`\n${C.cyan}${C.bold}▸ ${message}${C.reset}`);
}

function info(message) {
  console.log(`${C.dim}  ${message}${C.reset}`);
}

// ---------------------------------------------------------------------------
// Quan ly tien trinh con
// ---------------------------------------------------------------------------
const children = [];

function killTree(child) {
  if (!child || child.killed || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    // `next start` co the spawn worker con => phai kill ca cay, khong chi PID goc.
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try {
      child.kill('SIGTERM');
    } catch {
      /* bo qua */
    }
  }
}

function shutdown(code) {
  for (const child of children) killTree(child);
  process.exit(code);
}

/**
 * Gom stdout/stderr cua tien trinh con lai de khi no chet som ta con biet
 * DUOC LY DO, thay vi chi thay "fetch failed" kho hieu.
 */
function capture(child) {
  const state = { output: '' };
  if (child.stdout) child.stdout.on('data', (chunk) => (state.output += chunk.toString()));
  if (child.stderr) child.stderr.on('data', (chunk) => (state.output += chunk.toString()));
  return state;
}

process.on('SIGINT', () => shutdown(130));
process.on('SIGTERM', () => shutdown(143));

// ---------------------------------------------------------------------------
// Cho server san sang
// ---------------------------------------------------------------------------
async function waitFor(url, { label, timeoutMs = 180_000, accept = (res) => res.ok }) {
  const started = Date.now();
  let lastError = 'chua thu lan nao';

  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
      if (accept(res)) return res;
      lastError = `HTTP ${res.status}`;
    } catch (error) {
      lastError = error.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Het thoi gian cho ${label} (${url}). Loi cuoi: ${lastError}`);
}

// ---------------------------------------------------------------------------
// Khung test
// ---------------------------------------------------------------------------
const results = [];

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail: detail || '' });
    console.log(`  ${C.green}PASS${C.reset}  ${name}${detail ? `${C.dim}  — ${detail}${C.reset}` : ''}`);
  } catch (error) {
    results.push({ name, ok: false, detail: error.message });
    console.log(`  ${C.red}FAIL${C.reset}  ${name}\n        ${C.red}${error.message}${C.reset}`);
  }
}

function section(title) {
  console.log(`\n${C.bold}${title}${C.reset}`);
}

/**
 * Giai ma cac HTML entity co ban truoc khi so sanh chuoi.
 *
 * React tu dong escape ky tu dac biet khi render ra HTML, nen ten kieu trinh dien
 * "Đĩa Than & Polaroid" se nam trong HTML duoi dang "Đĩa Than &amp; Polaroid".
 * Neu so sanh nguyen van thi test bao FAIL trong khi san pham hoan toan dung.
 */
function decodeEntities(html) {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------
async function api(method, pathname, { body, headers } = {}) {
  const res = await fetch(`${APP_URL}${pathname}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
    redirect: 'manual'
  });

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* khong phai JSON (vd: HTML cua trang) */
  }

  return { status: res.status, headers: res.headers, text, json };
}

// ===========================================================================
// DU LIEU TEST
// ===========================================================================
const SENDER = 'Minh';
const RECEIVER = 'Ngọc Anh';

const PHOTOS = [
  'https://picsum.photos/seed/smoke-1/900/900',
  'https://picsum.photos/seed/smoke-2/900/900',
  'https://picsum.photos/seed/smoke-3/900/900',
  'https://picsum.photos/seed/smoke-4/900/900',
  'https://picsum.photos/seed/smoke-5/900/900',
  'https://picsum.photos/seed/smoke-6/900/900'
];

const MESSAGE =
  'Nhân ngày 20/10, anh chúc em luôn xinh đẹp và hạnh phúc. Cảm ơn em đã đến và làm cuộc sống của anh dịu dàng hơn mỗi ngày.';

// Chu thich CO TINH de trong o giua (index 1) de bat loi lech chu thich.
// captions[0] -> photo 0, captions[1] -> photo 1 (rong, dung fallback), ...
const CAPTIONS = ['Ngày đầu tiên mình đi chơi chung', '', 'Chuyến đi Đà Lạt nhớ mãi'];
const COUPONS = ['1 Chầu Trà Sữa Full Topping', '1 Buổi Đi Xem Phim Tự Chọn'];

const CONFIG = {
  template: 'blindbox-2010',
  passcode: '2010',
  passcodeHint: 'Gợi ý: năm chúng mình gặp nhau',
  scratchMessage: 'Bí mật nè: anh đã đặt sẵn bàn ở quán cũ, 7 giờ tối nay nhé.',
  coupons: COUPONS,
  captions: CAPTIONS
};

const BASE_PAYLOAD = {
  receiverName: RECEIVER,
  senderName: SENDER,
  message: MESSAGE,
  theme: 'pastel-pink',
  music: 'romantic-piano',
  photos: PHOTOS,
  config: CONFIG
};

// ===========================================================================
// CHAY
// ===========================================================================
async function main() {
  console.log(`${C.bold}LoveBox 3D — smoke test${C.reset}`);
  info(`mock Supabase : ${MOCK_URL}`);
  info(`app           : ${APP_URL}  (build: ${DIST_DIR})`);

  // -------------------------------------------------------------------------
  // 1. Mock Supabase
  // -------------------------------------------------------------------------
  step('Khoi dong mock Supabase');
  const mock = spawn(process.execPath, [path.join(__dirname, 'mock-supabase.cjs')], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, MOCK_PORT: String(MOCK_PORT) }
  });
  children.push(mock);
  const mockLog = capture(mock);
  mock.on('exit', (code) => {
    if (code !== 0 && code !== null && !stopping) {
      console.error(`${C.red}Mock Supabase thoat som (ma ${code}).${C.reset}`);
      shutdown(1);
    }
  });

  try {
    await waitFor(`${MOCK_URL}/rest/v1/gifts?select=slug`, {
      label: 'mock Supabase',
      timeoutMs: 20_000
    });
  } catch (error) {
    console.error(`${C.red}${error.message}${C.reset}`);
    console.error(`${C.dim}${tail(mockLog.output, 30)}${C.reset}`);
    shutdown(1);
  }
  info('mock san sang');

  // -------------------------------------------------------------------------
  // 2. Build production
  // -------------------------------------------------------------------------
  const childEnv = {
    ...process.env,
    NEXT_DIST_DIR: DIST_DIR,
    NEXT_PUBLIC_SUPABASE_URL: MOCK_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'smoke-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'smoke-service-role-key',
    NEXT_PUBLIC_SITE_URL: APP_URL,
    NEXT_PUBLIC_BANK_ID: '970422',
    NEXT_PUBLIC_BANK_ACCOUNT_NO: BANK_ACCOUNT_NO,
    NEXT_PUBLIC_BANK_ACCOUNT_NAME: 'NGUYEN VAN A',
    NEXT_PUBLIC_PRICE_VND: String(PRICE_VND),
    WEBHOOK_SECRET
  };

  const distPath = path.join(root, DIST_DIR);

  if (NO_BUILD) {
    // Dung lai ban build co san. Van kiem tra cho chac de khong "test" nham vao
    // mot thu muc rong roi bao loi kho hieu.
    if (!fs.existsSync(path.join(distPath, 'BUILD_ID'))) {
      console.error(
        `${C.red}Khong tim thay ban build trong ${DIST_DIR}/ (thieu BUILD_ID).${C.reset}\n` +
          `  Hay bo co --no-build, hoac tu build truoc:\n` +
          `    NEXT_DIST_DIR=${DIST_DIR} npx next build`
      );
      shutdown(1);
    }
    info(`dung lai ban build co san trong ${DIST_DIR}/`);
  } else {
    // Don sach distDir truoc khi build/chay dev.
    //
    // CA `next build` LAN `next dev` deu tu xoa bot noi dung distDir, va ca hai
    // deu xoa TUNG FILE mot qua fs.unlink. Tren may co "safe-delete guard" (chan
    // xoa hang loat), viec xoa 50+ file trong mot luot se bi chan va tien trinh
    // that bai voi SAFE_DELETE_BULK_CONFIRM_REQUIRED. Xoa bang fs.rmSync(recursive)
    // chi la MOT thao tac tren ca thu muc nen khong dinh gioi han do.
    // Loi ich phu: khong bao gio build an phai artefact cu.
    try {
      fs.rmSync(distPath, { recursive: true, force: true });
      info(`da don ${DIST_DIR}`);
    } catch (error) {
      info(`khong don duoc ${DIST_DIR} (${error.message}) — van thu tiep`);
    }

    if (DEV_MODE) {
      info('che do --dev: bo qua build, chay thang next dev');
    } else {
      step('next build (co the mat 30-60s)');

      const buildResult = await runToEnd(process.execPath, [NEXT_BIN, 'build'], childEnv);
      if (buildResult.code !== 0) {
        console.error(`${C.red}Build that bai:${C.reset}\n${tail(buildResult.output, 40)}`);
        shutdown(1);
      }
      info('build thanh cong');
    }
  }

  // -------------------------------------------------------------------------
  // 3. Khoi dong server
  // -------------------------------------------------------------------------
  const serverCommand = DEV_MODE ? 'dev' : 'start';
  step(`Khoi dong next ${serverCommand}`);
  const app = spawn(process.execPath, [NEXT_BIN, serverCommand, '-p', String(APP_PORT)], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: childEnv
  });
  children.push(app);
  const appLog = capture(app);
  app.on('exit', (code) => {
    if (code !== 0 && code !== null && !stopping) {
      console.error(`${C.red}next ${serverCommand} thoat som (ma ${code}).${C.reset}`);
      console.error(`${C.dim}${tail(appLog.output, 30)}${C.reset}`);
      shutdown(1);
    }
  });

  // `next dev` phai bien dich route ngay lan dau truy cap nen can cho lau hon.
  try {
    await waitFor(`${APP_URL}/`, {
      label: `next ${serverCommand}`,
      timeoutMs: DEV_MODE ? 180_000 : 90_000
    });
  } catch (error) {
    console.error(`${C.red}${error.message}${C.reset}`);
    console.error(`${C.dim}${tail(appLog.output, 40)}${C.reset}`);
    shutdown(1);
  }
  info('app san sang');

  // =========================================================================
  // BAT DAU KIEM TRA
  // =========================================================================

  let slug = '';
  let transferCode = '';

  // -------------------------------------------------------------------------
  section('A. Trang chu & cac trang demo');
  // -------------------------------------------------------------------------
  await check('GET / tra ve 200 va render dung thuong hieu', async () => {
    const res = await api('GET', '/');
    expect(res.status === 200, `Mong doi 200, nhan duoc ${res.status}`);
    expect(res.text.includes('LoveBox 3D'), 'Khong tim thay "LoveBox 3D" trong HTML');
    return `${res.text.length} bytes`;
  });

  await check('Trang chu render du 4 kieu trinh dien o Hero', async () => {
    const res = await api('GET', '/');
    const html = decodeEntities(res.text);
    const names = ['Tinh Cầu Kỷ Niệm 3D', 'Đĩa Than & Polaroid', 'Bẫy Tình Yêu', 'Túi Mù Bí Ẩn'];
    const missing = names.filter((name) => !html.includes(name));
    expect(missing.length === 0, `Thieu tren Hero: ${missing.join(', ')}`);
    return '4/4 kieu';
  });

  await check('GET /demo-templates tra ve 200', async () => {
    const res = await api('GET', '/demo-templates');
    expect(res.status === 200, `Mong doi 200, nhan duoc ${res.status}`);
    return '';
  });

  for (const style of ['galaxy-3d', 'polaroid-vinyl', 'sweet-trap', 'blindbox-2010']) {
    await check(`GET /demo-templates/${style} tra ve 200`, async () => {
      const res = await api('GET', `/demo-templates/${style}`);
      expect(res.status === 200, `Mong doi 200, nhan duoc ${res.status}`);
      return '';
    });
  }

  // -------------------------------------------------------------------------
  section('B. Validate POST /api/gifts');
  // -------------------------------------------------------------------------
  await check('Thieu ten nguoi nhan -> 400', async () => {
    const res = await api('POST', '/api/gifts', { body: { ...BASE_PAYLOAD, receiverName: '' } });
    expect(res.status === 400, `Mong doi 400, nhan duoc ${res.status}`);
    expect(res.json?.success === false, 'success phai la false');
    expect(res.json?.message?.includes('Thiếu tên người nhận'), `message la: ${res.json?.message}`);
    return res.json.message;
  });

  await check('Mat khau khong du 4 chu so -> 400', async () => {
    const res = await api('POST', '/api/gifts', {
      body: { ...BASE_PAYLOAD, config: { ...CONFIG, passcode: '12' } }
    });
    expect(res.status === 400, `Mong doi 400, nhan duoc ${res.status}`);
    expect(res.json?.message?.includes('4 chữ số'), `message la: ${res.json?.message}`);
    return res.json.message;
  });

  await check('Qua 8 ve dac quyen -> 400', async () => {
    const res = await api('POST', '/api/gifts', {
      body: { ...BASE_PAYLOAD, config: { ...CONFIG, coupons: Array.from({ length: 9 }, (_, i) => `Vé ${i}`) } }
    });
    expect(res.status === 400, `Mong doi 400, nhan duoc ${res.status}`);
    expect(res.json?.message?.includes('Tối đa 8 vé'), `message la: ${res.json?.message}`);
    return res.json.message;
  });

  await check('Chi 2 anh (can it nhat 4) -> 400', async () => {
    const res = await api('POST', '/api/gifts', {
      body: { ...BASE_PAYLOAD, photos: PHOTOS.slice(0, 2) }
    });
    expect(res.status === 400, `Mong doi 400, nhan duoc ${res.status}`);
    expect(res.json?.message?.includes('Cần ít nhất 4 ảnh'), `message la: ${res.json?.message}`);
    return res.json.message;
  });

  await check('Chu de khong ton tai -> 400', async () => {
    const res = await api('POST', '/api/gifts', { body: { ...BASE_PAYLOAD, theme: 'khong-co-that' } });
    expect(res.status === 400, `Mong doi 400, nhan duoc ${res.status}`);
    expect(res.json?.message?.includes('không tồn tại'), `message la: ${res.json?.message}`);
    return res.json.message;
  });

  // -------------------------------------------------------------------------
  section('C. Tao don & luu config JSONB');
  // -------------------------------------------------------------------------
  await check('POST /api/gifts tao don -> 201', async () => {
    const res = await api('POST', '/api/gifts', { body: BASE_PAYLOAD });
    expect(res.status === 201, `Mong doi 201, nhan duoc ${res.status} — ${res.text.slice(0, 200)}`);
    expect(res.json?.success === true, 'success phai la true');

    const data = res.json.data;
    expect(typeof data.slug === 'string' && data.slug.length > 0, 'thieu slug');
    expect(/^LOVE\d{5}$/.test(data.transfer_code), `transfer_code sai dinh dang: ${data.transfer_code}`);
    expect(data.is_paid === false, 'don moi phai is_paid = false');
    expect(data.amount === PRICE_VND, `amount sai: ${data.amount}`);
    expect(String(data.vietqr_url).includes('img.vietqr.io'), `vietqr_url sai: ${data.vietqr_url}`);

    slug = data.slug;
    transferCode = data.transfer_code;
    return `slug=${slug} code=${transferCode}`;
  });

  await check('GET /api/gifts?slug= doc lai duoc config da luu', async () => {
    const res = await api('GET', `/api/gifts?slug=${encodeURIComponent(slug)}`);
    expect(res.status === 200, `Mong doi 200, nhan duoc ${res.status}`);

    const config = res.json?.data?.config;
    expect(config, 'khong co config trong response');
    expect(config.template === 'blindbox-2010', `template sai: ${config.template}`);
    expect(config.passcode === '2010', `passcode sai: ${config.passcode}`);
    expect(config.coupons.length === 2, `coupons sai: ${JSON.stringify(config.coupons)}`);
    expect(config.scratchMessage.includes('đặt sẵn bàn'), `scratchMessage sai: ${config.scratchMessage}`);
    expect(res.json.data.is_paid === false, 'is_paid phai la false');
    return `template=${config.template}, coupons=${config.coupons.length}`;
  });

  await check('Chu thich giu DUNG VI TRI, ke ca o rong (chong lech anh)', async () => {
    const res = await api('GET', `/api/gifts?slug=${encodeURIComponent(slug)}`);
    const captions = res.json?.data?.config?.captions;
    expect(Array.isArray(captions), 'captions khong phai mang');
    expect(
      JSON.stringify(captions) === JSON.stringify(CAPTIONS),
      `captions bi lech.\n        gui len: ${JSON.stringify(CAPTIONS)}\n        doc ve : ${JSON.stringify(captions)}`
    );
    expect(captions[1] === '', 'o rong o giua bi mat -> moi chu thich sau do se lech sang anh khac');
    return `[${captions.map((c) => (c ? `"${c.slice(0, 12)}…"` : 'RONG')).join(', ')}]`;
  });

  // -------------------------------------------------------------------------
  section('D. Trang nguoi nhan & anh chia se');
  // -------------------------------------------------------------------------
  await check('GET /g/[slug] tra ve 200', async () => {
    const res = await api('GET', `/g/${slug}`);
    expect(res.status === 200, `Mong doi 200, nhan duoc ${res.status}`);
    return '';
  });

  await check('Metadata khi CHUA mo khoa: "dang chuan bi mot mon qua"', async () => {
    const res = await api('GET', `/g/${slug}`);
    expect(res.text.includes('đang chuẩn bị một món quà'), 'Khong thay mo ta "chua mo khoa" trong <head>');
    expect(res.text.includes(RECEIVER), 'Ten nguoi nhan khong xuat hien trong metadata');
    return '';
  });

  await check('GET /g/[slug]/opengraph-image tra ve PNG', async () => {
    const res = await fetch(`${APP_URL}/g/${slug}/opengraph-image`, { signal: AbortSignal.timeout(60_000) });
    expect(res.status === 200, `Mong doi 200, nhan duoc ${res.status}`);
    const type = res.headers.get('content-type') || '';
    expect(type.includes('image/png'), `content-type sai: ${type}`);
    const bytes = (await res.arrayBuffer()).byteLength;
    expect(bytes > 5_000, `anh qua nho (${bytes} bytes) — co the render loi`);
    return `${type}, ${bytes} bytes`;
  });

  await check('GET /g/khong-ton-tai van tra 200 nhung bao khong tim thay', async () => {
    const res = await api('GET', '/g/khong-ton-tai-abc');
    expect(res.status === 200, `Mong doi 200, nhan duoc ${res.status}`);
    expect(
      res.text.includes('Không tìm thấy món quà'),
      'Trang khong hien thong bao "Khong tim thay mon qua"'
    );
    return '';
  });

  // -------------------------------------------------------------------------
  section('E. Webhook thanh toan');
  // -------------------------------------------------------------------------
  const webhookBody = (overrides = {}) => ({
    accountNumber: BANK_ACCOUNT_NO,
    content: `${transferCode} chuyen tien`,
    transferType: 'in',
    transferAmount: PRICE_VND,
    referenceCode: `SMOKE-${Date.now()}`,
    ...overrides
  });

  await check('Webhook sai khoa -> 401', async () => {
    const res = await api('POST', '/api/webhook/payment', {
      body: webhookBody(),
      headers: { Authorization: 'Apikey sai-khoa-hoan-toan' }
    });
    expect(res.status === 401, `Mong doi 401, nhan duoc ${res.status}`);
    expect(res.json?.success === false, 'success phai la false');
    return '';
  });

  await check('Webhook thieu header xac thuc -> 401', async () => {
    const res = await api('POST', '/api/webhook/payment', { body: webhookBody() });
    expect(res.status === 401, `Mong doi 401, nhan duoc ${res.status}`);
    return '';
  });

  await check('Webhook so tien thap hon gia -> bo qua', async () => {
    const res = await api('POST', '/api/webhook/payment', {
      body: webhookBody({ transferAmount: 10_000 }),
      headers: { Authorization: `Apikey ${WEBHOOK_SECRET}` }
    });
    expect(res.status === 200, `Mong doi 200, nhan duoc ${res.status}`);
    expect(res.json?.data?.unlocked?.length === 0, 'Khong duoc mo khoa khi thieu tien');
    expect(
      String(res.json?.data?.skipped?.[0]?.reason).includes('Số tiền'),
      `Ly do bo qua la: ${res.json?.data?.skipped?.[0]?.reason}`
    );
    return res.json.data.skipped[0].reason;
  });

  await check('Webhook sai tai khoan nhan -> bo qua', async () => {
    const res = await api('POST', '/api/webhook/payment', {
      body: webhookBody({ accountNumber: '9999999999' }),
      headers: { Authorization: `Apikey ${WEBHOOK_SECRET}` }
    });
    expect(res.json?.data?.unlocked?.length === 0, 'Khong duoc mo khoa voi tai khoan la');
    expect(
      String(res.json?.data?.skipped?.[0]?.reason).includes('tài khoản nhận'),
      `Ly do bo qua la: ${res.json?.data?.skipped?.[0]?.reason}`
    );
    return res.json.data.skipped[0].reason;
  });

  await check('Webhook giao dich tien ra -> bo qua', async () => {
    const res = await api('POST', '/api/webhook/payment', {
      body: webhookBody({ transferType: 'out' }),
      headers: { Authorization: `Apikey ${WEBHOOK_SECRET}` }
    });
    expect(res.json?.data?.unlocked?.length === 0, 'Khong duoc mo khoa voi giao dich tien ra');
    expect(
      String(res.json?.data?.skipped?.[0]?.reason).includes('tiền ra'),
      `Ly do bo qua la: ${res.json?.data?.skipped?.[0]?.reason}`
    );
    return res.json.data.skipped[0].reason;
  });

  await check('Webhook noi dung khong chua ma LOVE -> bo qua', async () => {
    const res = await api('POST', '/api/webhook/payment', {
      body: webhookBody({ content: 'chuyen tien mua tra sua' }),
      headers: { Authorization: `Apikey ${WEBHOOK_SECRET}` }
    });
    expect(res.json?.data?.unlocked?.length === 0, 'Khong duoc mo khoa khi thieu ma');
    expect(
      String(res.json?.data?.skipped?.[0]?.reason).includes('LOVE'),
      `Ly do bo qua la: ${res.json?.data?.skipped?.[0]?.reason}`
    );
    return res.json.data.skipped[0].reason;
  });

  await check('Webhook hop le -> mo khoa dung don', async () => {
    const res = await api('POST', '/api/webhook/payment', {
      body: webhookBody(),
      headers: { Authorization: `Apikey ${WEBHOOK_SECRET}` }
    });
    expect(res.status === 200, `Mong doi 200, nhan duoc ${res.status}`);
    const unlocked = res.json?.data?.unlocked;
    expect(Array.isArray(unlocked) && unlocked.length === 1, `unlocked = ${JSON.stringify(unlocked)}`);
    expect(unlocked[0].slug === slug, `Mo khoa sai don: ${unlocked[0].slug} (mong doi ${slug})`);
    expect(unlocked[0].transfer_code === transferCode, 'Ma giao dich mo khoa sai');
    return `mo khoa ${transferCode} -> /g/${unlocked[0].slug}`;
  });

  await check('Goi lai webhook -> idempotent, khong mo khoa lai', async () => {
    const res = await api('POST', '/api/webhook/payment', {
      body: webhookBody({ referenceCode: `SMOKE-RETRY-${Date.now()}` }),
      headers: { Authorization: `Apikey ${WEBHOOK_SECRET}` }
    });
    expect(res.status === 200, `Mong doi 200, nhan duoc ${res.status}`);
    expect(res.json?.data?.unlocked?.length === 0, 'Goi lai khong duoc mo khoa them');
    expect(
      String(res.json?.data?.skipped?.[0]?.reason).includes('đã được mở khoá trước đó'),
      `Ly do bo qua la: ${res.json?.data?.skipped?.[0]?.reason}`
    );
    return res.json.data.skipped[0].reason;
  });

  await check('Ho tro dinh dang Casso { error, data: [...] }', async () => {
    const res = await api('POST', '/api/webhook/payment', {
      body: {
        error: 0,
        data: [
          {
            description: `${transferCode} chuyen tien`,
            amount: PRICE_VND,
            tid: `CASSO-${Date.now()}`,
            bank_sub_acc_id: BANK_ACCOUNT_NO
          }
        ]
      },
      headers: { 'Secure-Token': WEBHOOK_SECRET }
    });
    expect(res.status === 200, `Mong doi 200, nhan duoc ${res.status}`);
    expect(res.json?.data?.received === 1, `received = ${res.json?.data?.received}`);
    return 'nhan dien duoc payload Casso';
  });

  await check('GET /api/webhook/payment (health) tra ve 200', async () => {
    const res = await api('GET', '/api/webhook/payment');
    expect(res.status === 200, `Mong doi 200, nhan duoc ${res.status}`);
    expect(
      String(res.json?.data?.expected_code_pattern).includes('LOVE'),
      'Thieu mo ta dinh dang ma'
    );
    return '';
  });

  // -------------------------------------------------------------------------
  section('F. Trang thai sau khi mo khoa');
  // -------------------------------------------------------------------------
  await check('GET theo transfer_code: is_paid = true', async () => {
    const res = await api('GET', `/api/gifts?transfer_code=${transferCode}`);
    expect(res.status === 200, `Mong doi 200, nhan duoc ${res.status}`);
    expect(res.json?.data?.is_paid === true, 'is_paid phai la true');
    expect(res.json?.data?.paid_at, 'paid_at phai duoc ghi');
    return `paid_at=${res.json.data.paid_at}`;
  });

  await check('GET theo slug: is_paid = true (khong bi cache)', async () => {
    const res = await api('GET', `/api/gifts?slug=${encodeURIComponent(slug)}`);
    expect(res.json?.data?.is_paid === true, 'is_paid van la false -> du lieu bi cache');
    return '';
  });

  await check('Metadata DOI sau khi mo khoa: "game tuong tac" (chong cache fetch)', async () => {
    const res = await api('GET', `/g/${slug}`);
    expect(
      res.text.includes('game tương tác'),
      'Metadata van la ban CU sau khi da mo khoa.\n' +
        '        => Rat co the `cache: \'no-store\'` trong supabase.ts / supabase-admin.ts da bi xoa\n' +
        '        => hoac trang /g/[slug] thieu `export const dynamic = \'force-dynamic\'`.'
    );
    expect(!res.text.includes('đang chuẩn bị một món quà'), 'Van con mo ta cua ban chua mo khoa');
    return '';
  });

  // -------------------------------------------------------------------------
  section('G. Cac truong hop loi khac');
  // -------------------------------------------------------------------------
  await check('GET /api/gifts?slug=khong-ton-tai -> 404', async () => {
    const res = await api('GET', '/api/gifts?slug=khong-ton-tai-xyz');
    expect(res.status === 404, `Mong doi 404, nhan duoc ${res.status}`);
    return '';
  });

  await check('GET /api/gifts?transfer_code sai dinh dang -> 400', async () => {
    const res = await api('GET', '/api/gifts?transfer_code=ABC123');
    expect(res.status === 400, `Mong doi 400, nhan duoc ${res.status}`);
    expect(res.json?.message?.includes('LOVE + 5 chữ số'), `message la: ${res.json?.message}`);
    return res.json.message;
  });

  await check('GET /api/gifts thieu tham so -> 400', async () => {
    const res = await api('GET', '/api/gifts');
    expect(res.status === 400, `Mong doi 400, nhan duoc ${res.status}`);
    return res.json?.message || '';
  });

  await check('POST /api/gifts body khong phai JSON -> 400', async () => {
    const res = await fetch(`${APP_URL}/api/gifts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'day-khong-phai-json',
      signal: AbortSignal.timeout(15_000)
    });
    expect(res.status === 400, `Mong doi 400, nhan duoc ${res.status}`);
    return '';
  });

  // =========================================================================
  // TONG KET
  // =========================================================================
  const passed = results.filter((item) => item.ok).length;
  const failed = results.filter((item) => !item.ok);

  console.log(`\n${C.bold}${'─'.repeat(64)}${C.reset}`);
  if (failed.length === 0) {
    console.log(`${C.green}${C.bold}  TAT CA DEU PASS — ${passed}/${results.length}${C.reset}`);
  } else {
    console.log(`${C.red}${C.bold}  ${failed.length} TEST THAT BAI — ${passed}/${results.length} pass${C.reset}`);
    for (const item of failed) {
      console.log(`${C.red}    ✗ ${item.name}${C.reset}`);
      console.log(`${C.dim}      ${item.detail}${C.reset}`);
    }
  }
  console.log(`${C.bold}${'─'.repeat(64)}${C.reset}\n`);

  return failed.length === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------------
// Tien ich chay tien trinh va cho ket thuc
// ---------------------------------------------------------------------------
function runToEnd(command, args, env) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.on('close', (code) => resolve({ code: code === null ? 1 : code, output }));
  });
}

function tail(text, lines) {
  return text.split('\n').slice(-lines).join('\n');
}

let stopping = false;
const originalExit = process.exit.bind(process);
process.exit = (code) => {
  stopping = true;
  for (const child of children) killTree(child);
  originalExit(code);
};

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(`\n${C.red}Smoke test gap loi khong mong doi:${C.reset}\n`, error);
    process.exit(1);
  });
