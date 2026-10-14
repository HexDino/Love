// ============================================================================
// Trang xem thu 4 kieu trinh dien cua Gift3DViewer (V2)
// ----------------------------------------------------------------------------
// Day KHONG phai trang san pham. Day la trang dev de xem ngay 4 template ma
// khong can dien form o trang chu (form se duoc noi o Phan 2).
//
//   /demo-templates/galaxy-3d
//   /demo-templates/polaroid-vinyl
//   /demo-templates/sweet-trap
//   /demo-templates/blindbox-2010
//
// Them ?passcode=1 de xem man hinh khoa mat ma 4 so.
// Them ?gate=1 de bo qua cong dau va vao thang noi dung (xem thu nhanh).
// ============================================================================

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import Gift3DViewer from '@/components/Gift3DViewer';
import {
  isTemplateStyle,
  SAMPLE_CAPTIONS,
  SAMPLE_COUPONS,
  SAMPLE_PASSCODE,
  SAMPLE_PASSCODE_HINT,
  SAMPLE_PHOTOS,
  SAMPLE_SCRATCH_MESSAGE,
  TEMPLATE_LIST,
  type TemplateStyle
} from '@/lib/constants';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { style: string };
  searchParams: { passcode?: string; gate?: string };
}

export function generateStaticParams() {
  return TEMPLATE_LIST.map((template) => ({ style: template.id }));
}

export default function DemoTemplatePage({ params, searchParams }: PageProps) {
  const style: TemplateStyle = isTemplateStyle(params.style) ? params.style : 'galaxy-3d';
  const withPasscode = searchParams.passcode === '1';
  const skipGate = searchParams.gate === '1';

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-black">
      <Gift3DViewer
        receiverName="Mai Anh"
        senderName="Minh Quân"
        message="Nhân ngày 20/10, anh chúc em luôn xinh đẹp, rạng rỡ và hạnh phúc. Cảm ơn em đã đến và làm cho cuộc sống của anh trở nên dịu dàng hơn mỗi ngày. Yêu em rất nhiều!"
        photos={SAMPLE_PHOTOS}
        themeId="pastel-pink"
        musicId="romantic-piano"
        templateStyle={style}
        passcode={withPasscode ? SAMPLE_PASSCODE : undefined}
        passcodeHint={withPasscode ? SAMPLE_PASSCODE_HINT : undefined}
        scratchMessage={SAMPLE_SCRATCH_MESSAGE}
        coupons={SAMPLE_COUPONS}
        photoCaptions={SAMPLE_CAPTIONS}
        autoOpen={skipGate}
        isPreview
      />

      {/* Thanh dieu huong nhanh giua cac template - chi de xem thu */}
      <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-[90] flex flex-wrap items-center justify-center gap-1.5 bg-black/62 px-3 py-2 backdrop-blur-md">
        <Link
          href="/demo-templates"
          className="flex items-center gap-1 rounded-full bg-white/12 px-2.5 py-1.5 text-[10.5px] font-semibold text-white transition active:scale-95"
        >
          <ArrowLeft className="h-3 w-3" />
          Tất cả
        </Link>
        {TEMPLATE_LIST.map((template) => (
          <Link
            key={template.id}
            href={`/demo-templates/${template.id}${withPasscode ? '?passcode=1' : ''}`}
            className="rounded-full px-2.5 py-1.5 text-[10.5px] font-semibold transition active:scale-95"
            style={{
              background: template.id === style ? '#ffffff' : 'rgba(255,255,255,0.12)',
              color: template.id === style ? '#111111' : '#ffffff'
            }}
          >
            {template.emoji} {template.name}
          </Link>
        ))}
        <Link
          href={`/demo-templates/${style}${withPasscode ? '' : '?passcode=1'}`}
          className="rounded-full bg-white/12 px-2.5 py-1.5 text-[10.5px] font-semibold text-white transition active:scale-95"
        >
          {withPasscode ? 'Bỏ mật mã' : 'Thêm mật mã'}
        </Link>
      </div>
    </main>
  );
}
