// ============================================================================
// LoveBox 3D - Anh preview dong cho link chia se (Open Graph)
// Khi gui link /g/[slug] qua Messenger / Zalo / Facebook, he thong se crawl
// anh nay de hien thi the preview dep mat kem ten nguoi nhan.
//
// LUU Y QUAN TRONG VE RUNTIME:
// Phai dung runtime = 'edge'. Voi runtime = 'nodejs', thu vien next/og (chua
// @vercel/og) bi loi tren Windows: no co gang doc font mac dinh cua no qua
// fileURLToPath voi duong dan dang ".\\file:\\D:\\..." => ERR_INVALID_URL.
// Loi nay xay ra ngay khi module khoi tao nen KHONG the bypass bang cach
// truyen font rieng. Ban edge bundle san font mac dinh duoi dang base64 nen
// khong dung fs => chay on dinh.
// ============================================================================

import { ImageResponse } from 'next/og';
import { getGiftBySlugServer } from '@/lib/gift-server';

export const runtime = 'edge';
export const alt = 'Một món quà bất ngờ từ LoveBox 3D';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

// ---------------------------------------------------------------------------
// NAP FONT (Be Vietnam Pro - giay phep OFL)
// Edge runtime khong co fs, nen tai font qua HTTP va cache lai.
// Thu lan luot: ban copy trong /public cua chinh site -> CDN du phong.
// Bat buoc phai co font ho tro tieng Viet, neu khong chu co dau se bi mat.
// ---------------------------------------------------------------------------
const FONT_SOURCES = {
  bold: [
    `${SITE_URL}/fonts/BeVietnamPro-Bold.ttf`,
    'https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/BeVietnamPro-Bold.ttf'
  ],
  regular: [
    `${SITE_URL}/fonts/BeVietnamPro-Regular.ttf`,
    'https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/BeVietnamPro-Regular.ttf'
  ]
};

async function fetchFirstAvailable(urls: string[]): Promise<ArrayBuffer | null> {
  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: 'force-cache' });
      if (!response.ok) continue;
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > 1000) return buffer;
    } catch {
      // Thu URL tiep theo
    }
  }
  return null;
}

type FontEntry = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700;
  style: 'normal';
};

async function loadFonts(): Promise<FontEntry[]> {
  const [bold, regular] = await Promise.all([
    fetchFirstAvailable(FONT_SOURCES.bold),
    fetchFirstAvailable(FONT_SOURCES.regular)
  ]);

  const fonts: FontEntry[] = [];
  if (bold) fonts.push({ name: 'BeVietnamPro', data: bold, weight: 700, style: 'normal' });
  if (regular) fonts.push({ name: 'BeVietnamPro', data: regular, weight: 400, style: 'normal' });
  return fonts;
}

// ---------------------------------------------------------------------------
// NAP ANH DAU TIEN -> data URI
// Chuyen sang data URI de satori khong phai fetch lai trong luc render.
// Neu loi thi bo qua, khong lam hong ca tam anh.
// ---------------------------------------------------------------------------
async function loadPhotoDataUri(url: string | undefined): Promise<string | null> {
  if (!url) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;

    const contentTypeHeader = response.headers.get('content-type') ?? 'image/jpeg';
    if (!contentTypeHeader.startsWith('image/')) return null;

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > 3_000_000) return null;

    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 8192;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }

    return `data:${contentTypeHeader};base64,${btoa(binary)}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// RENDER
// ---------------------------------------------------------------------------
export default async function OpenGraphImage({ params }: { params: { slug: string } }) {
  const [gift, fonts] = await Promise.all([getGiftBySlugServer(params.slug), loadFonts()]);

  const receiverName = gift?.receiver_name?.trim() || 'Người thương';
  const senderName = gift?.sender_name?.trim() || 'Một người bí mật';
  const photoDataUri = await loadPhotoDataUri(gift?.photos?.[0]);
  const fontFamily = fonts.length > 0 ? 'BeVietnamPro' : 'sans-serif';

  // Ten qua dai se tran ra ngoai khung -> cat bot cho an toan
  const displayName = receiverName.length > 18 ? `${receiverName.slice(0, 18)}…` : receiverName;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          padding: 56,
          fontFamily,
          background: 'linear-gradient(135deg, #ed1e64 0%, #ff6b9d 46%, #ff9a52 100%)'
        }}
      >
        {/* Ho tiet trang tri */}
        <div
          style={{
            position: 'absolute',
            top: -150,
            left: -130,
            width: 430,
            height: 430,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.16)',
            display: 'flex'
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -140,
            right: -90,
            width: 340,
            height: 340,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.12)',
            display: 'flex'
          }}
        />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 18,
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
              fontWeight: 700,
              color: '#ed1e64'
            }}
          >
            LB
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 30, fontWeight: 700, color: '#ffffff' }}>LoveBox 3D</div>
            <div style={{ fontSize: 19, color: 'rgba(255, 255, 255, 0.82)' }}>Món quà 3D trong 60 giây</div>
          </div>
        </div>

        {/* Noi dung chinh */}
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'flex-end', gap: 40 }}>
          {photoDataUri ? (
            <img
              src={photoDataUri}
              width={250}
              height={250}
              alt=""
              style={{
                width: 250,
                height: 250,
                borderRadius: 28,
                objectFit: 'cover',
                border: '8px solid rgba(255, 255, 255, 0.92)'
              }}
            />
          ) : null}

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ fontSize: 26, color: 'rgba(255, 255, 255, 0.86)' }}>
              Một món quà bất ngờ gửi tới
            </div>
            <div style={{ marginTop: 8, fontSize: 78, fontWeight: 700, color: '#ffffff', lineHeight: 1.06 }}>
              {displayName}
            </div>
            <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  padding: '8px 20px',
                  borderRadius: 999,
                  background: 'rgba(255, 255, 255, 0.22)',
                  display: 'flex',
                  fontSize: 24,
                  color: '#ffffff'
                }}
              >
                {`Từ ${senderName}`}
              </div>
              <div style={{ display: 'flex', fontSize: 24, color: 'rgba(255, 255, 255, 0.94)' }}>
                Chạm để mở phong thư
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fonts.length > 0 ? fonts : undefined
    }
  );
}
