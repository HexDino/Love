# LoveBox 3D

Tạo web quà tặng kỷ niệm & 20/10 trong 60 giây. Người dùng nhập thông tin → xem thử miễn phí → trả
39.000đ qua VietQR để mở khoá link vĩnh viễn + thiệp QR.

Mô hình kiếm tiền: **Preview-Lock Funnel** (cho xem trước thành quả lung linh, thu tiền để mở khoá link).

**V2** biến món quà thành một trò chơi: 4 vũ trụ trình diễn khác hẳn nhau (Tinh Cầu 3D, Đĩa Than &
Polaroid, Bẫy Tình Yêu, Túi Mù 20/10) cộng 3 module tương tác (khoá mật khẩu, thẻ cào bí mật, vé đặc
quyền). Trang chủ có 4 nút xem thử ngay và form tạo quà dạng **Studio 4 bước**.

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
│   ├── page.tsx                          # Hero 4 nút xem thử + Studio 4 bước + modal VietQR
│   ├── api/
│   │   ├── gifts/route.ts                # POST tạo đơn · GET kiểm tra is_paid (polling)
│   │   └── webhook/payment/route.ts      # Webhook SePay/Casso tự duyệt đơn
│   ├── demo-templates/                   # Trang xem thử 4 kiểu trình diễn (dev)
│   │   ├── page.tsx                      # Danh sách 4 kiểu
│   │   └── [style]/page.tsx              # Xem từng kiểu, ?passcode=1 ?gate=1
│   └── g/[slug]/
│       ├── page.tsx                      # Trang người nhận mở quà + generateMetadata
│       └── opengraph-image.tsx           # Ảnh preview động khi share link
├── components/
│   └── Gift3DViewer.tsx                  # Interactive Gift Engine: 4 kiểu + 3 module
└── lib/
    ├── constants.ts                      # Chủ đề, nhạc, thư viện lời chúc, template, GiftConfig
    ├── supabase.ts                       # Client + nén ảnh + upload + gọi API
    ├── supabase-admin.ts                 # Client service_role (server-only)
    └── gift-server.ts                    # Truy vấn server + tăng view (React cache)
supabase/
├── schema.sql                            # Chạy 1 lần cho cài đặt mới (đã có cột config)
└── migrations/
    ├── 002_part2.sql                     # Chạy thêm nếu đã cài từ Phần 1
    └── 003_v2_config.sql                 # Thêm cột config JSONB cho bản V2
tools/
├── dev-demo.cjs                          # npm run demo - mock + dev server
└── mock-supabase.cjs                     # Mock PostgREST/Storage cho dev
public/
├── music/                                # Nhạc nền MP3
└── fonts/                                # Be Vietnam Pro (OFL) cho ảnh OG
```

---

## Luồng hoạt động

| Bước | Route / Màn hình          | Việc xảy ra                                                                              |
| ---- | ------------------------- | ---------------------------------------------------------------------------------------- |
| 1    | `/` mục **4 vũ trụ**      | Bấm 1 trong 4 nút → xem thử ngay bằng dữ liệu mẫu (không cần điền form)                   |
| 2    | Studio **bước 1 → 4**     | Chọn kiểu → nội dung + ảnh + chú thích → tương tác → xem thử toàn bộ                      |
| 3    | Modal xem thử             | Chạy đúng template + mật khẩu + thẻ cào + vé của bạn. Có watermark + danh sách quyền lợi  |
| 4    | `POST /api/gifts`         | Nén + upload ảnh → lưu nháp `is_paid: false` kèm `config` → trả `slug` + `LOVE#####`      |
| 5    | Modal thanh toán          | Hiện VietQR → `GET /api/gifts?transfer_code=...` polling 3 giây                          |
| 6    | Webhook ngân hàng         | `POST /api/webhook/payment` → tự set `is_paid = true`                                    |
| 7    | Modal thành công          | Pháo hoa, link `/g/[slug]`, thiệp QR để gửi cho người thương                             |
| 8    | `/g/[slug]`               | Người nhận mở quà đúng template đã chọn. Chưa trả tiền → màn hình nhắc nhở               |

---

## 4 kiểu trình diễn + 3 module tương tác (V2)

`Gift3DViewer` giờ là một Interactive Gift Engine: chọn `templateStyle` để đổi hẳn trải nghiệm
người nhận, không chỉ đổi màu.

| `templateStyle`   | Trải nghiệm                                                                             |
| ----------------- | --------------------------------------------------------------------------------------- |
| `galaxy-3d`       | Bầu trời sao + hạt sáng đi theo ngón tay, vòng xoay ảnh 3D khung kính, chạm ảnh mở lightbox |
| `polaroid-vinyl`  | Đĩa than xoay + cần gạt máy hát + sóng nhạc, album thẻ Polaroid lật từng tấm              |
| `sweet-trap`      | Mini-game: nút "Không thèm" chạy trốn mỗi lần chạm, nút "Đồng ý" phóng to dần             |
| `blindbox-2010`   | Lưới túi mù lắc lư, tự tay xé từng túi để mở ảnh, mở hết thì mở khoá bức thư              |

Ba module gamification dùng chung cho **cả 4 kiểu**, bật lên bằng props:

| Module                    | Prop              | Hoạt động                                                                 |
| ------------------------- | ----------------- | ------------------------------------------------------------------------- |
| Màn hình khoá mật mã      | `passcode`        | Bàn phím số kiểu iOS, 4 chấm trái tim, sai thì rung, `passcodeHint` gợi ý |
| Thẻ cào bí mật            | `scratchMessage`  | `<canvas>` phủ nhũ bạc, cào bằng `destination-out`, lộ lời nhắn           |
| Kho vé đặc quyền          | `coupons[]`       | Thẻ vé cắt răng cưa, bấm "Nhận vé" → "Đã lưu vào ví" + tim bay            |

Ngoài ra `photoCaptions[]` gắn chú thích cho từng ảnh.

### Xem thử 4 kiểu ngay

```bash
npm run demo
# rồi mở:
#   http://localhost:3000/demo-templates
#   http://localhost:3000/demo-templates/sweet-trap
#   http://localhost:3000/demo-templates/blindbox-2010?passcode=1
```

`?passcode=1` bật màn hình khoá (mã mẫu `2010`), `?gate=1` bỏ qua cổng để xem thẳng nội dung.

> Trang `/demo-templates` chỉ để xem thử, không phải phần của sản phẩm.

### Trang chủ: Hero 4 nút + Studio 4 bước (V2 Phần 2)

Trang chủ không còn là form một trang dài. Nó gồm hai phần chính:

**1. Hero — "Trải nghiệm thử 4 vũ trụ quà tặng"**

Ngay dưới tiêu đề có **4 nút bấm**, mỗi nút kèm icon, nhãn marketing và tên kiểu trình diễn:

| Nút                      | `templateStyle`   | Nhãn          |
| ------------------------ | ----------------- | ------------- |
| 🌌 Tinh Cầu Kỷ Niệm 3D   | `galaxy-3d`       | Lãng mạn      |
| 🎞️ Đĩa Than & Polaroid   | `polaroid-vinyl`  | Hoài cổ       |
| 💘 Bẫy Tình Yêu          | `sweet-trap`      | Cưa Crush     |
| 🎁 Túi Mù Bí Ẩn          | `blindbox-2010`   | HOT 20/10     |

Bấm một nút là mở ngay **lớp phủ xem thử toàn màn hình** với dữ liệu mẫu — không phải điền form.
Trong lớp phủ có: dải chip đổi nhanh giữa 4 vũ trụ, nút `Thử mật mã` (bật/tắt màn hình khoá), và nút
`Tạo quà kiểu này` để áp dụng kiểu đó vào Studio rồi cuộn về form.

**2. Studio 4 bước**

| Bước | Nội dung                                                                                                  |
| ---- | --------------------------------------------------------------------------------------------------------- |
| 1    | Chọn kiểu trình diễn (4 thẻ, mỗi thẻ có nút `Xem thử` riêng)                                                |
| 2    | Tên người nhận/gửi · **thư viện lời chúc 1-click** · chủ đề màu · nhạc nền · ảnh + **chú thích từng ảnh**   |
| 3    | **Khoá mật khẩu 4 số** (mặc định `2010`) · **thẻ cào bí mật** · **vé đặc quyền**                            |
| 4    | Tóm tắt món quà + danh sách quyền lợi + nút `Xem Thử Toàn Bộ`                                              |

Thanh tiến độ 4 bước bấm được để nhảy qua lại, nhưng **có kiểm tra dữ liệu**: nhảy tới bước 3 phải qua
được bước 2, nhảy tới bước 4 phải qua được cả bước 2 và 3.

**Thư viện lời chúc 1-click** có 3 nút theo đối tượng (`Người yêu` / `Crush` / `Mẹ – Chị`). Bấm một nút là
điền ngay một lời chúc vào ô nội dung; **bấm lại cùng nút đó** sẽ đổi sang câu khác trong cùng kho. Bên dưới
là danh sách đầy đủ để chọn từng câu.

Bước 4 mở **bản xem thử đầy đủ**: người tạo tự nhập mật khẩu, tự cào thẻ, tự xé túi mù bằng chính ảnh của
mình. Bản xem thử dùng `isPreview` nên có watermark; modal thanh toán liệt kê 4 quyền lợi khi mở khoá.

---

## Cột `config` (JSONB) — V2 Phần 2

Toàn bộ cấu hình mở rộng được gom vào **một cột `config` kiểu `jsonb`** thay vì thêm nhiều cột:

```jsonc
{
  "template": "sweet-trap",              // 4 kiểu trình diễn
  "passcode": "2010",                    // "" = không khoá
  "passcodeHint": "Gợi ý: năm chúng mình gặp nhau",
  "scratchMessage": "Tối nay 7h30 anh qua đón em nhé!",
  "coupons": ["1 Chầu Trà Sữa Full Topping", "..."],
  "captions": ["Ngày đầu tiên", "", "Chuyến đi Đà Lạt"]
}
```

**Vì sao JSONB?** Sau này thêm tuỳ chọn mới (âm thanh, hiệu ứng, font, sticker…) chỉ cần sửa
`src/lib/constants.ts`, **không phải chạy `ALTER TABLE` thêm lần nào nữa**. Đổi lại, không thể đặt
`CHECK` chi tiết cho từng trường bên trong JSONB — nên việc kiểm tra dữ liệu được làm ở tầng API bằng
`normalizeGiftConfig()` **trước khi** ghi xuống database (chạy ở cả client và server).

### Nâng cấp database đã có dữ liệu

```bash
# Mở Supabase Dashboard → SQL Editor → dán và chạy:
supabase/migrations/003_v2_config.sql
```

File này chỉ làm một việc: thêm cột `config` (dùng `if not exists` nên chạy lại bao nhiêu lần cũng được,
không mất dữ liệu). Đơn cũ sẽ nhận `'{}'` và tự động hiểu là "dùng mặc định".

> **Cài mới hoàn toàn** thì chỉ cần chạy `supabase/schema.sql` — cột `config` đã có sẵn trong đó.

Hệ thống có **hai lớp phòng vệ** nếu bạn quên chạy migration:

- **Đường đọc** (`src/lib/gift-server.ts`): tự đọc lại **không kèm** cột `config` và dùng
  `DEFAULT_GIFT_CONFIG`, trang người nhận vẫn mở bình thường (chỉ mất tính năng tương tác).
- **Đường ghi** (`POST /api/gifts`): trả lỗi tiếng Việt chỉ đích danh file cần chạy, thay vì lỗi 500 khó hiểu.

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
  "photos": ["https://...", "..."], // 4–8 link ảnh http(s)

  // Tuy chon (V2). Bo qua thi dung mac dinh: galaxy-3d, khong mat khau, khong the cao.
  "config": {
    "template": "sweet-trap",
    "passcode": "2010",           // phai dung 4 chu so, hoac "" de tat
    "passcodeHint": "Gợi ý: năm chúng mình gặp nhau",
    "scratchMessage": "Tối nay 7h30 anh qua đón em nhé!",
    "coupons": ["1 Chầu Trà Sữa Full Topping"],   // toi da 8 ve, moi ve <= 80 ky tu
    "captions": ["Ngày đầu tiên", "", "Chuyến đi Đà Lạt"]  // khop thu tu mang photos
  }
}

// Response 201
{ "success": true, "data": { "slug": "pd2v8h", "transfer_code": "LOVE27308",
  "gift_url": ".../g/pd2v8h", "vietqr_url": "https://img.vietqr.io/image/..." } }
```

`config` được **chuẩn hoá lại lần cuối ở server** bằng `normalizeGiftConfig()`: cắt khoảng trắng, bỏ ký tự
điều khiển, ép đúng độ dài, loại vé rỗng. Vì vậy dữ liệu rác không bao giờ vào được database dù client gửi gì.

Nếu `config` gửi lên **vượt giới hạn** (ví dụ 500 vé đặc quyền), API trả lỗi rõ ràng thay vì âm thầm cắt bớt —
vì đó là dấu hiệu spam chứ không phải người dùng gõ nhầm.

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

**5. Bầu trời sao dùng PRNG có seed, không dùng `Math.random()`.** `Starfield` render cả trên
server lẫn client. Nếu mỗi bên random một kiểu thì React báo lỗi hydration mismatch và có thể
phải render lại toàn bộ cây. Hàm `createSeededRandom()` (mulberry32) cho ra đúng một bầu trời sao
ở cả hai phía.

**6. Nút "Không thèm" chỉ chạy trong nửa dưới sàn chơi.** Nút "Đồng ý" phóng to dần theo mỗi lần
né (tối đa 2.2 lần) nên sẽ chiếm hết nửa trên. Nếu thả nút "Không thèm" ngẫu nhiên khắp màn hình,
nó có thể đáp trúng lên nút "Đồng ý" và chặn người dùng bấm. Danh sách `DODGE_SPOTS` giữ nó ở
nửa dưới.

**7. Animation `transform` không được đặt lên phần tử có `transform` inline.** Thẻ Polaroid cần
vừa xoay nhẹ vừa chạy hiệu ứng lật, nên hiệu ứng lật nằm ở một `<div>` con bọc ngoài — nếu không,
sau khi animation kết thúc phần tử sẽ giật về vị trí cũ.

**8. `captions` phải giữ nguyên vị trí, không được lọc bỏ phần tử rỗng.** Chú thích ảnh gắn theo
**chỉ số**: `captions[0]` là chú thích của `photos[0]`. Nếu dùng hàm lọc rỗng chung với `coupons`
thì một ảnh không có chú thích sẽ làm **mọi chú thích phía sau lệch sang ảnh khác**. Vì vậy
`constants.ts` có hai hàm riêng: `cleanStringArray()` (lọc rỗng — dùng cho `coupons`) và
`cleanAlignedArray()` (giữ chỗ trống — dùng cho `captions`).

**9. Đừng chạy `next build` khi `next dev` đang chạy trên cùng thư mục `.next`.** `next build`
xoá `.next` để build sạch, mà `next dev` đang phục vụ chính các file đó → các chunk lõi
(`main-app.js`, `app-pages-internals.js`) trả 404, **React không hydrate được**, mọi nút bấm
"chết" dù HTML vẫn hiện đầy đủ. Triệu chứng rất dễ nhầm là lỗi logic. Cách chữa: dừng dev server,
xoá `.next`, chạy lại.

**10. Ô nhập mật khẩu 4 số: input thật nằm đè lên 4 ô trang trí.** Vẽ 4 ô lớn cho đẹp, rồi đặt
**một** `<input>` trong suốt phủ kín lên trên (`text-transparent caret-transparent`). Cách này giữ
được bàn phím số chuẩn của điện thoại (`inputMode="numeric"`) mà không phải tự quản lý việc chuyển
focus giữa 4 ô — vốn rất dễ vỡ trên iOS Safari.

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
