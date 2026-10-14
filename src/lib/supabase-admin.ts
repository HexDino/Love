// ============================================================================
// LoveBox 3D - Supabase ADMIN client (service_role)
// ============================================================================
// CANH BAO: file nay CHI duoc import trong API route / server component.
// `server-only` se lam build THAT BAI ngay lap tuc neu file nay bi keo vao
// bundle cua trinh duyet => khoa service_role khong bao gio lo ra client.
// ============================================================================

import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export const isAdminConfigured = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

let cachedClient: SupabaseClient | null = null;

/**
 * Tra ve Supabase client voi quyen service_role (bo qua RLS).
 * Dung de: duyet don thanh toan, tang luot xem, ghi du lieu tu server.
 */
export function getAdminClient(): SupabaseClient {
  if (!SUPABASE_URL) {
    throw new Error(
      'Thiếu NEXT_PUBLIC_SUPABASE_URL. Mở .env.local và điền Project URL từ Supabase Dashboard > Project Settings > API.'
    );
  }
  if (!SERVICE_ROLE_KEY) {
    throw new Error(
      'Thiếu SUPABASE_SERVICE_ROLE_KEY. Mở .env.local và điền key "service_role" (KHÔNG phải anon key) từ Supabase Dashboard > Project Settings > API.'
    );
  }

  if (!cachedClient) {
    cachedClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: { 'X-Client-Info': 'lovebox-3d-server' },
        // QUAN TRONG: Next.js patch global `fetch` va TU DONG CACHE moi request
        // GET vao Data Cache. Supabase dung GET cho .select() => neu khong tat
        // cache, trang /g/[slug] se tra ve ban render CU (vi du van hien
        // "chua mo khoa" du don da thanh toan xong). Ep no-store de moi request
        // luon doc du lieu moi nhat tu database.
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, { ...init, cache: 'no-store' })
      }
    });
  }

  return cachedClient;
}
