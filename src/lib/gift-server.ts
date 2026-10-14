// ============================================================================
// LoveBox 3D - truy van du lieu phia SERVER
// Dung cho: API route, generateMetadata, trang nguoi nhan mo qua /g/[slug]
// ============================================================================

import 'server-only';
import { cache } from 'react';
import { getAdminClient } from './supabase-admin';
import type { ThemeId } from './constants';

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
  amount: number;
  is_paid: boolean;
  paid_at: string | null;
  view_count: number;
  created_at: string;
}

const PUBLIC_COLUMNS =
  'id, slug, transfer_code, receiver_name, sender_name, message, theme, music, photos, amount, is_paid, paid_at, view_count, created_at';

/**
 * Doc mon qua theo slug.
 *
 * Boc trong `cache()` cua React nen `generateMetadata()` va than component
 * dung chung 1 ket qua => chi ton dung 1 truy van Supabase cho moi request.
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

    if (error) {
      console.error('[gift-server] getGiftBySlugServer loi:', error.message);
      return null;
    }
    if (!data) return null;

    return {
      ...(data as unknown as PublicGift),
      photos: Array.isArray((data as { photos?: unknown }).photos)
        ? ((data as { photos: string[] }).photos ?? [])
        : []
    };
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
