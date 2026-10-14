// ============================================================================
// Danh sach 4 kieu trinh dien cua Gift3DViewer (V2) - trang xem thu cho dev
// ============================================================================

import Link from 'next/link';
import { TEMPLATE_LIST } from '@/lib/constants';

export const metadata = {
  title: 'Xem thử 4 kiểu trình diễn — LoveBox 3D'
};

export default function DemoTemplatesIndex() {
  return (
    <main className="min-h-[100dvh] bg-[#0b0d18] px-5 py-10 text-white">
      <div className="mx-auto max-w-[520px]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/50">LoveBox 3D</p>
        <h1 className="mt-2 text-2xl font-bold">4 kiểu trình diễn quà tặng</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-white/65">
          Trang này chỉ để xem thử. Bấm vào từng kiểu để trải nghiệm đầy đủ hiệu ứng: khoá mật mã, thẻ cào bí
          mật và kho vé đặc quyền.
        </p>

        <div className="mt-7 space-y-3">
          {TEMPLATE_LIST.map((template) => (
            <div
              key={template.id}
              className="rounded-2xl border border-white/12 bg-white/[0.05] p-4"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none">{template.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold">{template.name}</p>
                  <p className="mt-0.5 text-[12px] text-white/60">{template.tagline}</p>
                  <p className="mt-1 font-mono text-[10.5px] text-white/35">/demo-templates/{template.id}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/demo-templates/${template.id}`}
                  className="rounded-full bg-white px-3.5 py-2 text-[11.5px] font-bold text-black transition active:scale-95"
                >
                  Mở thử
                </Link>
                <Link
                  href={`/demo-templates/${template.id}?passcode=1`}
                  className="rounded-full border border-white/20 px-3.5 py-2 text-[11.5px] font-semibold text-white transition active:scale-95"
                >
                  Kèm mật mã 2010
                </Link>
                <Link
                  href={`/demo-templates/${template.id}?gate=1`}
                  className="rounded-full border border-white/20 px-3.5 py-2 text-[11.5px] font-semibold text-white transition active:scale-95"
                >
                  Bỏ qua cổng
                </Link>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-[11px] leading-relaxed text-white/40">
          Nhạc nền dùng file trong /public/music; nếu chưa có file, trình phát tự chuyển sang nguồn dự phòng
          trên CDN nên vẫn nghe được.
        </p>
      </div>
    </main>
  );
}
