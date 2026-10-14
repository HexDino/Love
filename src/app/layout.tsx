import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  // Bat buoc de Next.js tao URL tuyet doi cho anh Open Graph / Twitter card.
  // Doi bien nay khi ban deploy len domain that.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: 'LoveBox 3D — Tạo Web Quà Tặng Kỷ Niệm & 20/10 Trong 60 Giây',
  description:
    'Biến ảnh kỷ niệm của bạn thành món quà 3D lung linh: phong thư mở ra, nhạc nền lãng mạn, vòng xoay ảnh 3D và lời chúc chạy chữ. Tạo trong 60 giây, gửi link cho người thương.',
  keywords: [
    'quà tặng 20/10',
    'thiệp 20/10 online',
    'web quà tặng kỷ niệm',
    'lovebox',
    'thiệp tình yêu 3D',
    'quà tặng người yêu'
  ],
  authors: [{ name: 'LoveBox 3D' }],
  openGraph: {
    title: 'LoveBox 3D — Món quà 3D lung linh cho người thương',
    description:
      'Tạo web quà tặng kỷ niệm & 20/10 trong 60 giây. Phong thư mở ra, nhạc nền lãng mạn, vòng xoay ảnh 3D.',
    type: 'website',
    locale: 'vi_VN'
  },
  robots: { index: true, follow: true }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#ff3d7f'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/*
          Rule `no-page-custom-font` la rule cua Pages Router (no chi kiem tra
          pages/_document.js). Du an dung App Router nen khai bao <link> trong
          app/layout.tsx la dung chuan => tat rule nay cho rieng dong duoi.

          Khong chuyen sang next/font: public/fonts chi co 2 file tinh
          (Regular 400 + Bold 700, dung rieng cho anh OG), trong khi giao dien
          dung 6 muc 300-800. Dung next/font/local voi 2 file se lam chu bi gia
          dam => lech toan bo giao dien.
        */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@300;400;500;600;700;800&family=Dancing+Script:wght@600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
