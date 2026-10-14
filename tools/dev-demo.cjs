// ============================================================================
// LoveBox 3D - Chay DEMO khong can Supabase that
// ----------------------------------------------------------------------------
// Khoi dong dong thoi:
//   1. Mock Supabase (PostgREST + Storage gia) o cong 3199
//   2. Next.js dev server o cong 3000, tro vao mock do
//
// Cach dung:  npm run demo
// ============================================================================

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const MOCK_PORT = '3199';
const APP_PORT = process.env.PORT || '3000';

// ---------------------------------------------------------------------------
// Canh bao neu .env.local dang tro vao Supabase that: bien moi truong dat o
// day se duoc uu tien hon file .env.local, nen demo se chay tren du lieu gia.
// ---------------------------------------------------------------------------
const envLocalPath = path.join(root, '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf8');
  if (content.includes('xxxx')) {
    console.log('[demo] .env.local van dang la gia tri mau - khong sao, demo dung mock rieng.');
  } else {
    console.log('[demo] .env.local co ve da cau hinh that.');
    console.log('[demo] Luu y: lenh nay se CHAY TREN DU LIEU GIA, khong dung Supabase that cua ban.');
  }
}

const childEnv = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: `http://localhost:${MOCK_PORT}`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'demo-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'demo-service-role-key',
  NEXT_PUBLIC_SITE_URL: `http://localhost:${APP_PORT}`,
  NEXT_PUBLIC_BANK_ID: '970422',
  NEXT_PUBLIC_BANK_ACCOUNT_NO: '0123456789',
  NEXT_PUBLIC_BANK_ACCOUNT_NAME: 'NGUYEN VAN A',
  NEXT_PUBLIC_PRICE_VND: '39000',
  WEBHOOK_SECRET: 'demo_webhook_secret_123'
};

const children = [];

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) {
      try {
        child.kill();
      } catch {
        // bo qua
      }
    }
  }
  process.exit(code);
}

// ---------------------------------------------------------------------------
// 1. Mock Supabase
// ---------------------------------------------------------------------------
const mock = spawn(process.execPath, [path.join(__dirname, 'mock-supabase.cjs')], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, MOCK_PORT }
});
children.push(mock);
mock.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`[demo] Mock Supabase thoat voi ma ${code}`);
    shutdown(code);
  }
});

// ---------------------------------------------------------------------------
// 2. Next.js dev server (doi 1.2s cho mock len truoc)
// ---------------------------------------------------------------------------
setTimeout(() => {
  const nextBin = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
  const dev = spawn(process.execPath, [nextBin, 'dev', '-p', APP_PORT], {
    cwd: root,
    stdio: 'inherit',
    env: childEnv
  });
  children.push(dev);
  dev.on('exit', (code) => shutdown(code === null ? 0 : code));
}, 1200);

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
