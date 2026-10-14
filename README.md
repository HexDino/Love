# LoveBox 3D

Tạo web quà tặng kỷ niệm & 20/10 trong 60 giây. Người dùng nhập thông tin → xem thử miễn phí → trả
39.000đ qua VietQR để mở khoá link vĩnh viễn + thiệp QR.

Mô hình kiếm tiền: **Preview-Lock Funnel** (cho xem trước thành quả lung linh, thu tiền để mở khoá link).

---

## Tech stack

| Thành phần  | Công nghệ                                                          |
| ----------- | ------------------------------------------------------------------ |
| Framework   | Next.js 14 (App Router) + TypeScript                               |
| Giao diện   | Tailwind CSS, Lucide React, pháo hoa `canvas-confetti`             |
| Hiệu ứng 3D | CSS 3D Perspective (`transform-style: preserve-3d`) — không WebGL  |
| Mưa tim/hoa | HTML5 Canvas thuần                                                 |
| Database    | Supabase (Postgres + Storage), gói Free                            |
| Thanh toán  | VietQR QuickLink (ảnh QR động) + polling 3 giây + webhook tự duyệt |
| Ảnh preview | `next/og` (ImageResponse) chạy trên edge runtime                   |

Không dùng WebGL/Three.js vì trình duyệt trong app Messenger, Zalo, TikTok rất dễ giật lag với WebGL.

---

## Cài đặt từng bước

### Bước 1 — Cài thư viện

```bash
# 1. Di chuyển vào thư mục dự án
cd Love

# 2. Cài toàn bộ thư viện (chỉ cần chạy 1 lần)
npm install
```

Nếu muốn cài thủ công từng gói, đây là danh sách đầy đủ:

```bash
# Thư viện chạy thật (production)
npm install next@14.2.15 react@^18.3.1 react-dom@^18.3.1 \
  @supabase/supabase-js@^2.45.4 canvas-confetti@^1.9.3 \
  lucide-react@^0.447.0 server-only@^0.0.1

# Thư viện chỉ dùng khi phát triển (dev)
npm install -D typescript@^5.6.3 @types/node@^20.16.11 @types/react@^18.3.11 \
  @types/react-dom@^18.3.0 @types/canvas-confetti@^1.6.4 \
  tailwindcss@^3.4.13 postcss@^8.4.47 autoprefixer@^10.4.20 \
  eslint@^8.57.1 eslint-config-next@14.2.15
```

### Bước 2 — Tạo file môi trường

```bash
cp .env.example .env.local
```

Rồi mở `.env.local` và điền giá trị thật (xem các bước dưới).

### Bước 3 — Khởi tạo Supabase

1. Tạo project mới tại [supabase.com](https://supabase.com).
2. Mở **SQL Editor → New query**, dán toàn bộ nội dung `supabase/schema.sql` rồi **Run**.
   File này tạo bảng `gifts`, index, trigger `updated_at`, RLS policies, bucket Storage
   `gift-photos` (public read) và function `increment_gift_view`.
   > Nếu bạn đã chạy `schema.sql` ở Phần 1 rồi thì chỉ cần chạy thêm
   > `supabase/migrations/002_part2.sql`.
3. Vào **Project Settings → API**, copy 3 giá trị:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **không** đưa lên client

### Bước 4 — Cấu hình ngân hàng nhận tiền

Tra mã BIN tại <https://api.vietqr.io/v2/banks> (MB Bank = `970422`, Vietcombank = `970436`,
Techcombank = `970407`…), rồi điền:

```env
NEXT_PUBLIC_BANK_ID=970422
NEXT_PUBLIC_BANK_ACCOUNT_NO=0123456789
NEXT_PUBLIC_BANK_ACCOUNT_NAME=NGUYEN VAN A
```

### Bước 5 — Nhạc nền

Thả 3 file MP3 vào `public/music/` (xem `public/music/README.md`). Chưa có cũng không sao —
trình phát tự fallback sang link CDN công khai nên vẫn nghe được nhạc.

### Bước 6 — Chạy

```bash
npm run dev     # http://localhost:3000
```

---

## Chạy thử ngay không cần Supabase

Muốn xem toàn bộ sản phẩm hoạt động trước khi tạo tài khoản Supabase? Dùng lệnh demo — nó tự
khởi động một **mock Supabase** (PostgREST + Storage giả, lưu trong RAM) và trỏ app vào đó:

```bash
npm run demo
```

Mở <http://localhost:3000> và bấm thử từ đầu đến cuối:

1. Form đã điền sẵn dữ liệu mẫu → bấm **Xem Thử Món Quà** để xem hiệu ứng 3D (phong bì mở, nhạc,
   vòng xoay ảnh, gõ chữ, mưa tim).
2. Bấm **Mở khoá ngay — 39.000đ** → hiện mã VietQR + bộ đếm ngược 10 phút.
3. Bấm nút **[DEV] Giả lập thanh toán thành công** (chỉ hiện ở môi trường dev) → pháo hoa, link
   chia sẻ, thiệp QR.

Muốn thử luồng webhook thật sự thay vì nút giả lập:

```bash
curl -X POST http://localhost:3000/api/webhook/payment \
  -H "Content-Type: application/json" \
  -H "Authorization: Apikey demo_webhook_secret_123" \
  -d '{"accountNumber":"0123456789","content":"LOVE12345 chuyen tran",
       "transferType":"in","transferAmount":39000,"referenceCode":"TEST-1"}'
```

| Lệnh              | Việc làm                                                       |
| ----------------- | -------------------------------------------------------------- |
| `npm run demo`    | Chạy mock Supabase + dev server (khuyên dùng để xem thử)        |
| `npm run mock`    | Chỉ chạy mock Supabase ở cổng 3199                              |
| `npm run dev`     | Dev server thường, dùng `.env.local` thật của bạn               |

> Dữ liệu demo nằm trong RAM. Tắt server là mất sạch — đúng như mong đợi.

---

## Cấu trúc thư mục

```
src/
├── app/
│   ├── globals.css                       # CSS 3D, phong bì, watermark, animation
│   ├── layout.tsx                        # Metadata + font tiếng Việt + metadataBase
│   ├── page.tsx                          # Landing + form + preview + modal VietQR
│   ├── api/
│   │   ├── gifts/route.ts                # POST tạo đơn · GET kiểm tra is_paid (polling)
│   │   └── webhook/payment/route.ts      # Webhook SePay/Casso tự duyệt đơn
│   └── g/[slug]/
│       ├── page.tsx                      # Trang người nhận mở quà + generateMetadata
│       └── opengraph-image.tsx           # Ảnh preview động khi share link
├── components/
│   └── Gift3DViewer.tsx                  # Phong bì → nhạc → xoay 3D → gõ chữ → mưa tim
└── lib/
    ├── constants.ts                      # Chủ đề màu, nhạc, gợi ý lời chúc, dữ liệu mẫu
    ├── supabase.ts                       # Client + nén ảnh + upload + gọi API
    ├── supabase-admin.ts                 # Client service_role (server-only)
    └── gift-server.ts                    # Truy vấn server + tăng view (React cache)
supabase/
├── schema.sql                            # Chạy 1 lần cho cài đặt mới
└── migrations/002_part2.sql              # Chạy thêm nếu đã cài từ Phần 1
tools/
├── dev-demo.cjs                          # npm run demo - mock + dev server
└── mock-supabase.cjs                     # Mock PostgREST/Storage cho dev
public/
├── music/                                # Nhạc nền MP3
└── fonts/                                # Be Vietnam Pro (OFL) cho ảnh OG
```

---

## Luồng hoạt động

| Bước | Route / Màn hình    | Việc xảy ra                                                                      |
| ---- | ------------------- | -------------------------------------------------------------------------------- |
| 1    | `/` mục **Tạo quà** | Nhập tên, lời chúc, chủ đề, nhạc, 4–8 ảnh (upload hoặc dán link)                 |
| 2    | Modal xem thử       | Phong bì mở → nhạc → xoay 3D → gõ chữ → mưa tim. Có watermark + banner           |
| 3    | `POST /api/gifts`   | Nén + upload ảnh → lưu nháp `is_paid: false` → trả `slug` (6 ký tự) + `LOVE#####` |
| 4    | Modal thanh toán    | Hiện VietQR → `GET /api/gifts?transfer_code=...` polling 3 giây                  |
| 5    | Webhook ngân hàng   | `POST /api/webhook/payment` → tự set `is_paid = true`                            |
| 6    | Modal thành công    | Pháo hoa, link `/g/[slug]`, thiệp QR để gửi cho người thương                     |
| 7    | `/g/[slug]`         | Người nhận mở quà. Chưa trả tiền → màn hình nhắc nhở                             |

---

## API

### `POST /api/gifts`

Tạo món quà mới. Tự sinh `slug` ngẫu nhiên 6 ký tự và `transfer_code` dạng `LOVE` + 5 chữ số.
Có rate limit 12 đơn/phút/IP và tự thử lại 5 lần nếu slug bị trùng.

```jsonc
// Request
{
  "receiverName": "Mai Anh",
  "senderName": "Quân",
  "message": "Chúc em 20/10 thật nhiều niềm vui...",
  "theme": "pastel-pink",          // pastel-pink | starry-night | warm-sunset
  "music": "romantic-piano",
  "photos": ["https://...", "..."] // 4–8 link ảnh http(s)
}

// Response 201
{ "success": true, "data": { "slug": "pd2v8h", "transfer_code": "LOVE27308",
  "gift_url": ".../g/pd2v8h", "vietqr_url": "https://img.vietqr.io/image/..." } }
```

### `GET /api/gifts`

| Query                      | Trả về                                                           |
| -------------------------- | ---------------------------------------------------------------- |
| `?transfer_code=LOVE27308` | `{ slug, is_paid, amount, paid_at, gift_url }` — dùng cho polling |
| `?slug=pd2v8h`             | Dữ liệu công khai của món quà                                    |

---

## Cấu hình Webhook thanh toán

Endpoint: `POST https://your-domain.com/api/webhook/payment`

Xác thực bằng **một trong các header** sau (so khớp với `WEBHOOK_SECRET` trong `.env.local`):

- `Authorization: Apikey <WEBHOOK_SECRET>` ← SePay
- `Secure-Token: <WEBHOOK_SECRET>` ← Casso
- `x-webhook-secret: <WEBHOOK_SECRET>`

### SePay

Vào **SePay Dashboard → Webhooks → Thêm webhook**, chọn "Tiền vào", điền URL ở trên và
chọn xác thực `API Key` với giá trị bằng `WEBHOOK_SECRET`. Payload SePay gửi dạng object phẳng:

```json
{
  "gateway": "MB Bank",
  "accountNumber": "0123456789",
  "content": "LOVE27308 chuyen tien",
  "transferType": "in",
  "transferAmount": 39000,
  "referenceCode": "FT26123456789"
}
```

### Casso

Vào **Casso → Webhook**, thêm URL và đặt `Secure-Token` bằng `WEBHOOK_SECRET`. Payload Casso
gửi dạng mảng — code tự nhận cả 2 định dạng:

```json
{ "error": 0, "data": [{ "description": "LOVE27308", "amount": 39000, "tid": "..." }] }
```

### Webhook tự động bỏ qua khi

- Là giao dịch **tiền ra** (`transferType: "out"`)
- Số tiền **< 39.000đ**
- Nội dung **không chứa** mã khớp `LOVE\d{5}`
- **Không phải** tài khoản nhận của bạn (so 4 số cuối, chấp nhận cả số bị che `****6688`)

Webhook là **idempotent** — gọi lại nhiều lần (ngân hàng retry) không ghi đè `paid_at` gốc.

### Test nhanh bằng curl

```bash
curl -X POST http://localhost:3000/api/webhook/payment \
  -H "Content-Type: application/json" \
  -H "Authorization: Apikey <WEBHOOK_SECRET>" \
  -d '{"accountNumber":"0123456789","content":"LOVE12345 chuyen tien",
       "transferType":"in","transferAmount":39000,"referenceCode":"TEST-1"}'
```

---

## Script

```bash
npm run dev        # dev server
npm run build      # build production
npm run start      # chạy bản build
npm run typecheck  # kiểm tra TypeScript
```

---

## Ghi chú kỹ thuật quan trọng

**1. Không dùng WebGL.** Hiệu ứng 3D làm hoàn toàn bằng CSS `preserve-3d`. Góc xoay ghi thẳng
vào DOM qua `requestAnimationFrame`, không `setState` mỗi frame → giữ 60fps trên máy tầm trung.

**2. Next.js cache `fetch` GET theo mặc định.** Đây là cái bẫy lớn: Next patch global `fetch` và
tự động cache mọi GET vào Data Cache, mà Supabase dùng GET cho `.select()`. Nếu không tắt, trang
`/g/[slug]` sẽ trả về **bản render cũ** — khách đã trả tiền nhưng vẫn thấy "chưa mở khoá".
Cả 2 client trong `supabase.ts` và `supabase-admin.ts` đều đã ép `cache: 'no-store'`.
**Đừng xoá dòng đó.**

**3. `opengraph-image` phải chạy edge runtime.** Với `runtime = 'nodejs'`, thư viện `next/og`
lỗi trên Windows (`ERR_INVALID_URL` khi nó cố đọc font mặc định qua `fileURLToPath`). Lỗi xảy ra
ngay lúc module khởi tạo nên không thể bypass bằng cách truyền font riêng.

**4. Không dùng `.maybeSingle()` sau lệnh `update()`.** Với PATCH, khi 0 dòng khớp PostgREST trả
lỗi `PGRST116` (HTTP 406) chứ không phải `data: null`, nên nhánh kiểm tra "đơn đã mở khoá trước
đó" sẽ không bao giờ chạy. Dùng `.select()` thường rồi đọc phần tử đầu của mảng.

---

## Bảo mật

- `SUPABASE_SERVICE_ROLE_KEY` **tuyệt đối không** đặt trong biến `NEXT_PUBLIC_*`. File
  `src/lib/supabase-admin.ts` có `import 'server-only'` — nếu vô tình import nó vào component
  client, **build sẽ fail ngay** thay vì âm thầm làm lộ khoá.
- Việc tạo đơn đi qua `/api/gifts` (server-side, có validate + rate limit). Sau khi đã chuyển
  sang Phần 2, bạn có thể xoá policy cho phép `anon` INSERT trực tiếp — xem hướng dẫn ở cuối
  `supabase/migrations/002_part2.sql`.
- Webhook so khớp khoá bằng `timingSafeEqual` để chống tấn công dò ký tự.
- Link quà tặng là riêng tư: trang `/g/[slug]` đặt `robots: noindex, nofollow, nocache`.
