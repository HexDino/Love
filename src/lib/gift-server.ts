// ============================================================================
// LoveBox 3D - truy van du lieu phia SERVER
// Dung cho: API route, generateMetadata, trang nguoi nhan mo qua /g/[slug]
// ============================================================================

import 'server-only';
import { cache } from 'react';
import { getAdminClient } from './supabase-admin';
import { DEFAULT_GIFT_CONFIG, normalizeGiftConfig, type GiftConfig, type ThemeId } from './constants';

export interface PublicGift {
  id: string;
  slug: string;
  transfer_code: string;
  receiver_name: string;
  sender_name: string;
  message: string;
  theme: ThemeId;
  music: string;
  photos: string[];
  /** Cau hinh mo rong V2 - da duoc chuan hoa, khong bao gio null */
  config: GiftConfig;
  amount: number;
  is_paid: boolean;
  paid_at: string | null;
  view_count: number;
  created_at: string;
}

const BASE_COLUMNS =
  'id, slug, transfer_code, receiver_name, sender_name, message, theme, music, photos, amount, is_paid, paid_at, view_count, created_at';

const PUBLIC_COLUMNS = `${BASE_COLUMNS}, config`;

/** PostgREST tra ma nay khi cot khong ton tai (chua chay migration 003) */
const UNDEFINED_COLUMN = '42703';

function isMissingConfigColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === UNDEFINED_COLUMN) return true;
  return typeof error.message === 'string' && error.message.includes('config');
}

interface GiftRowShape extends Omit<PublicGift, 'config' | 'photos'> {
  photos?: unknown;
  config?: unknown;
}

function shapeGift(data: unknown): PublicGift {
  const row = data as GiftRowShape;
  return {
    ...(row as unknown as PublicGift),
    photos: Array.isArray(row.photos) ? (row.photos as string[]) : [],
    config: row.config === undefined ? DEFAULT_GIFT_CONFIG : normalizeGiftConfig(row.config)
  };
}

/**
 * Doc mon qua theo slug.
 *
 * Boc trong `cache()` cua React nen `generateMetadata()` va than component
 * dung chung 1 ket qua => chi ton dung 1 truy van Supabase cho moi request.
 *
 * Co du phong: neu database chua chay migration 003 (thieu cot `config`),
 * ham tu dong doc lai KHONG kem cot do thay vi lam sap trang qua tang.
 */
export const getGiftBySlugServer = cache(async (slug: string): Promise<PublicGift | null> => {
  if (!slug || typeof slug !== 'string') return null;

  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('gifts')
      .select(PUBLIC_COLUMNS)
      .eq('slug', slug)
      .maybeSingle();

    if (!error && data) return shapeGift(data);

    if (error && isMissingConfigColumn(error)) {
      console.warn(
        '[gift-server] Chua co cot `config`. Hay chay supabase/migrations/003_v2_config.sql de bat cac tinh nang V2.'
      );
      const fallback = await supabase
        .from('gifts')
        .select(BASE_COLUMNS)
        .eq('slug', slug)
        .maybeSingle();

      if (fallback.error) {
        console.error('[gift-server] getGiftBySlugServer loi (fallback):', fallback.error.message);
        return null;
      }
      return fallback.data ? shapeGift(fallback.data) : null;
    }

    if (error) {
      console.error('[gift-server] getGiftBySlugServer loi:', error.message);
      return null;
    }
    return null;
  } catch (error) {
    console.error('[gift-server] getGiftBySlugServer that bai:', error);
    return null;
  }
});

/**
 * Tang luot xem bang RPC nguyen tu (atomic) - tranh mat du lieu khi nhieu
 * nguoi mo qua cung luc.
 */
export async function incrementGiftView(slug: string): Promise<void> {
  try {
    const supabase = getAdminClient();
    const { error } = await supabase.rpc('increment_gift_view', { p_slug: slug });
    if (error) {
      console.error('[gift-server] incrementGiftView loi:', error.message);
    }
  } catch (error) {
    console.error('[gift-server] incrementGiftView that bai:', error);
  }
}
