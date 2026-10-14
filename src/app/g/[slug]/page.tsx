// ============================================================================
// LoveBox 3D - Trang nguoi nhan mo qua  /g/[slug]
//   - Fetch du lieu theo slug (server-side, dung service_role)
//   - generateMetadata dong => link gui qua Messenger/Zalo hien preview dep
//   - is_paid = true  -> mo tron ven, khong watermark
//   - is_paid = false -> nhac nguoi tao hoan tat mo khoa
// ============================================================================

import type { Metadata } from 'next';
import Link from 'next/link';
import { Gift, Heart, Home, Lock, Sparkles } from 'lucide-react';
import Gift3DViewer from '@/components/Gift3DViewer';
import { getGiftBySlugServer, incrementGiftView } from '@/lib/gift-server';
import { getTemplateMeta, hasInteractiveConfig } from '@/lib/constants';

export const dynamic = 'force-dynamic';

interface GiftPageProps {
  params: { slug: string };
}

// ---------------------------------------------------------------------------
// METADATA DONG
// ---------------------------------------------------------------------------
export async function generateMetadata({ params }: GiftPageProps): Promise<Metadata> {
  const gift = await getGiftBySlugServer(params.slug);

  if (!gift) {
    return {
      title: 'Không tìm thấy món quà — LoveBox 3D',
      description: 'Đường link này không tồn tại hoặc đã bị xoá.',
      robots: { index: false, follow: false }
    };
  }

  const template = getTemplateMeta(gift.config.template);
  const title = `Một món quà bất ngờ gửi tới ${gift.receiver_name} 🎁`;

  let description: string;
  if (!gift.is_paid) {
    description = `${gift.sender_name} đang chuẩn bị một món quà cho ${gift.receiver_name}. Món quà sẽ sẵn sàng ngay khi được mở khoá.`;
  } else if (hasInteractiveConfig(gift.config)) {
    description = `${gift.sender_name} gửi ${gift.receiver_name} một ${template.name} có game tương tác, thẻ cào bí mật và vé đặc quyền. Chạm để mở ngay!`;
  } else {
    description = `${gift.sender_name} đã chuẩn bị một ${template.name} dành riêng cho ${gift.receiver_name}. Chạm để mở phong thư và xem điều bất ngờ bên trong.`;
  }

  return {
    title,
    description,
    // Link qua tang la rieng tu => khong cho Google index
    robots: { index: false, follow: false, nocache: true },
    openGraph: {
      title,
      description,
      type: 'website',
      locale: 'vi_VN',
      siteName: 'LoveBox 3D'
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description
    }
  };
}

// ---------------------------------------------------------------------------
// MAN HINH PHU
// ---------------------------------------------------------------------------
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-[100dvh] w-full items-center justify-center bg-gradient-to-br from-[#fff5f9] via-[#ffd9e8] to-[#ffeaf3] px-5 py-12">
      <div className="w-full max-w-sm rounded-3xl border border-love-100 bg-white/85 p-7 text-center shadow-[0_24px_60px_-28px_rgba(237,30,100,.45)] backdrop-blur">
        {children}
      </div>
    </main>
  );
}

function NotFoundView() {
  return (
    <Shell>
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-love-100">
        <Gift className="h-8 w-8 text-love-500" />
      </span>
      <h1 className="mt-4 text-[19px] font-extrabold tracking-tight text-love-900">
        Không tìm thấy món quà
      </h1>
      <p className="mt-2 text-[13px] leading-relaxed text-love-900/65">
        Đường link này không tồn tại, đã bị xoá, hoặc bị sao chép thiếu ký tự. Hãy nhờ người gửi kiểm tra lại
        giúp bạn nhé.
      </p>
      <Link
        href="/"
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-love-500 px-5 py-3.5 text-[14px] font-extrabold text-white shadow-lg transition active:scale-[.98]"
      >
        <Sparkles className="h-4 w-4" />
        Tự tạo món quà của bạn
      </Link>
    </Shell>
  );
}

function LockedView({ receiverName, senderName }: { receiverName: string; senderName: string }) {
  return (
    <Shell>
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
        <Lock className="h-7 w-7 text-amber-600" />
      </span>
      <h1 className="mt-4 text-[19px] font-extrabold tracking-tight text-love-900">
        Món quà chưa được mở khoá
      </h1>
      <p className="mt-2 text-[13px] leading-relaxed text-love-900/65">
        <strong className="text-love-700">{senderName}</strong> đã chuẩn bị một món quà dành cho{' '}
        <strong className="text-love-700">{receiverName}</strong>, nhưng chưa hoàn tất bước mở khoá. Món quà sẽ
        hiện ra ngay khi người gửi thanh toán xong.
      </p>
      <div className="mt-5 flex items-center justify-center gap-1.5 text-[11.5px] text-love-900/45">
        <Heart className="h-3.5 w-3.5 text-love-400" fill="currentColor" />
        Hãy nhắn cho người gửi để hoàn tất nhé
      </div>
      <Link
        href="/"
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-love-200 bg-white px-5 py-3.5 text-[13.5px] font-bold text-love-600 transition active:scale-[.98]"
      >
        <Sparkles className="h-4 w-4" />
        Tự tạo món quà của bạn
      </Link>
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// TRANG CHINH
// ---------------------------------------------------------------------------
export default async function GiftPage({ params }: GiftPageProps) {
  const gift = await getGiftBySlugServer(params.slug);

  if (!gift) {
    return <NotFoundView />;
  }

  if (!gift.is_paid) {
    return <LockedView receiverName={gift.receiver_name} senderName={gift.sender_name} />;
  }

  // Dem luot xem (chi khi qua da duoc mo khoa). await de serverless khong cat ngang.
  await incrementGiftView(gift.slug);

  const config = gift.config;
  const captions = gift.photos.map((_, index) => config.captions[index] ?? '');

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-black">
      <Gift3DViewer
        receiverName={gift.receiver_name}
        senderName={gift.sender_name}
        message={gift.message}
        photos={gift.photos}
        themeId={gift.theme}
        musicId={gift.music}
        isPreview={false}
        templateStyle={config.template}
        passcode={config.passcode || undefined}
        passcodeHint={config.passcodeHint || undefined}
        scratchMessage={config.scratchMessage || undefined}
        coupons={config.coupons}
        photoCaptions={captions}
      />

      {/* Badge thuong hieu - vong lap viral: nguoi nhan tro thanh nguoi tao tiep theo */}
      <Link
        href="/"
        className="absolute left-3 top-3 z-50 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-[11px] font-bold text-white/85 backdrop-blur transition active:scale-95"
      >
        <Home className="h-3.5 w-3.5" />
        LoveBox 3D
      </Link>
    </main>
  );
}
