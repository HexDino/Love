/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Cho phep doi thu muc build bang bien moi truong.
  // Mac dinh van la `.next` -> khong doi hanh vi gi khi chay dev/build binh thuong.
  // `npm run smoke` dung `.next-smoke` de khong dung do vao `.next` cua dev server
  // dang chay (xem ghi chu ky thuat so 9 trong README).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'img.vietqr.io' },
      { protocol: 'https', hostname: 'api.qrserver.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'images.unsplash.com' }
    ]
  }
};

export default nextConfig;
