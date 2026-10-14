'use client';

// ============================================================================
// LoveBox 3D - Trang chu kiem trinh tao qua
// Landing page + Form tao qua + Live Preview + Modal thanh toan VietQR 39.000d
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Gift,
  Heart,
  ImagePlus,
  Info,
  Link2,
  Loader2,
  Lock,
  Music2,
  Palette,
  QrCode,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
  Zap
} from 'lucide-react';
import confetti from 'canvas-confetti';
import Gift3DViewer from '@/components/Gift3DViewer';
import {
  MAX_PHOTOS,
  MIN_PHOTOS,
  MUSIC_TRACKS,
  SAMPLE_GIFT,
  SAMPLE_PHOTOS,
  THEME_LIST,
  WISH_SUGGESTIONS,
  WISH_TABS,
  type ThemeId
} from '@/lib/constants';
import {
  BANK_ACCOUNT_NAME,
  BANK_ACCOUNT_NO,
  BANK_ID,
  PRICE_VND,
  buildGiftUrl,
  buildQrImageUrl,
  buildVietQrUrl,
  createGift,
  formatCountdown,
  formatVnd,
  getGiftStatus,
  isSupabaseConfigured,
  uploadGiftPhoto,
  type GiftRow
} from '@/lib/supabase';

// ---------------------------------------------------------------------------
// KIEU DU LIEU NOI BO
// ---------------------------------------------------------------------------
interface PhotoItem {
  id: string;
  url: string;
  file?: File;
}

type PayStage = 'idle' | 'preparing' | 'waiting' | 'expired' | 'paid' | 'error';

const PAYMENT_WINDOW_SECONDS = 10 * 60;
const POLL_INTERVAL_MS = 3000;
const CONFETTI_COLORS = ['#ff3d7f', '#ffd166', '#8ab4ff', '#ffffff', '#ff9a52'];

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================================
// TRANG CHINH
// ============================================================================
export default function HomePage() {
  // --------------------------------------------------------------------------
  // STATE FORM
  // --------------------------------------------------------------------------
  const [receiverName, setReceiverName] = useState(SAMPLE_GIFT.receiverName);
  const [senderName, setSenderName] = useState(SAMPLE_GIFT.senderName);
  const [message, setMessage] = useState(SAMPLE_GIFT.message);
  const [themeId, setThemeId] = useState<ThemeId>(SAMPLE_GIFT.themeId);
  const [musicId, setMusicId] = useState(SAMPLE_GIFT.musicId);
  const [photoItems, setPhotoItems] = useState<PhotoItem[]>(
    SAMPLE_GIFT.photos.map((url, index) => ({ id: `sample-${index}`, url }))
  );
  const [urlInput, setUrlInput] = useState('');
  const [wishTab, setWishTab] = useState(WISH_TABS[0].id);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadingPreview, setUploadingPreview] = useState(false);

  // --------------------------------------------------------------------------
  // STATE MODAL
  // --------------------------------------------------------------------------
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [payOpen, setPayOpen] = useState(false);
  const [payStage, setPayStage] = useState<PayStage>('idle');
  const [payError, setPayError] = useState('');
  const [draft, setDraft] = useState<GiftRow | null>(null);
  const [unlockedSlug, setUnlockedSlug] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(PAYMENT_WINDOW_SECONDS);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [manualChecking, setManualChecking] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const photoItemsRef = useRef<PhotoItem[]>([]);
  photoItemsRef.current = photoItems;

  // --------------------------------------------------------------------------
  // TIEN ICH
  // --------------------------------------------------------------------------
  const photoUrls = useMemo(() => photoItems.map((item) => item.url), [photoItems]);

  const validate = useCallback((): string | null => {
    if (!receiverName.trim()) return 'Vui lòng nhập tên người nhận.';
    if (!senderName.trim()) return 'Vui lòng nhập tên người gửi.';
    if (!message.trim()) return 'Vui lòng nhập lời chúc.';
    if (message.trim().length < 20) return 'Lời chúc nên dài ít nhất 20 ký tự để thật cảm động.';
    if (photoItems.length < MIN_PHOTOS) return `Cần ít nhất ${MIN_PHOTOS} ảnh kỷ niệm (bạn đang có ${photoItems.length}).`;
    if (photoItems.length > MAX_PHOTOS) return `Tối đa ${MAX_PHOTOS} ảnh.`;
    return null;
  }, [receiverName, senderName, message, photoItems.length]);

  const copyText = useCallback(async (text: string, key: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const helper = document.createElement('textarea');
        helper.value = text;
        helper.style.position = 'fixed';
        helper.style.opacity = '0';
        document.body.appendChild(helper);
        helper.select();
        document.execCommand('copy');
        document.body.removeChild(helper);
      }
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1800);
    } catch {
      setCopiedKey(null);
    }
  }, []);

  // --------------------------------------------------------------------------
  // QUAN LY ANH
  // --------------------------------------------------------------------------
  const addFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const remaining = MAX_PHOTOS - photoItems.length;
      if (remaining <= 0) {
        setFormError(`Đã đủ ${MAX_PHOTOS} ảnh. Xoá bớt nếu muốn thêm ảnh khác.`);
        return;
      }

      const accepted: PhotoItem[] = [];
      Array.from(files)
        .slice(0, remaining)
        .forEach((file) => {
          if (!file.type.startsWith('image/')) return;
          accepted.push({ id: makeId('file'), url: URL.createObjectURL(file), file });
        });

      if (accepted.length === 0) {
        setFormError('Chỉ nhận tệp ảnh (JPG, PNG, WEBP, GIF).');
        return;
      }

      setPhotoItems((prev) => [...prev, ...accepted]);
      setFormError(null);
    },
    [photoItems.length]
  );

  const addUrls = useCallback(() => {
    const lines = urlInput
      .split(/[\n,\s]+/)
      .map((line) => line.trim())
      .filter((line) => /^https?:\/\//i.test(line));

    if (lines.length === 0) {
      setFormError('Link ảnh không hợp lệ. Link phải bắt đầu bằng http:// hoặc https://');
      return;
    }

    const remaining = MAX_PHOTOS - photoItems.length;
    if (remaining <= 0) {
      setFormError(`Đã đủ ${MAX_PHOTOS} ảnh.`);
      return;
    }

    const accepted = lines.slice(0, remaining).map((url) => ({ id: makeId('url'), url }));
    setPhotoItems((prev) => [...prev, ...accepted]);
    setUrlInput('');
    setFormError(null);
  }, [urlInput, photoItems.length]);

  const removePhoto = useCallback((id: string) => {
    setPhotoItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target && target.url.startsWith('blob:')) {
        URL.revokeObjectURL(target.url);
      }
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  const clearPhotos = useCallback(() => {
    photoItemsRef.current.forEach((item) => {
      if (item.url.startsWith('blob:')) URL.revokeObjectURL(item.url);
    });
    setPhotoItems([]);
  }, []);

  const loadSample = useCallback(() => {
    clearPhotos();
    setReceiverName(SAMPLE_GIFT.receiverName);
    setSenderName(SAMPLE_GIFT.senderName);
    setMessage(SAMPLE_GIFT.message);
    setThemeId(SAMPLE_GIFT.themeId);
    setMusicId(SAMPLE_GIFT.musicId);
    setPhotoItems(SAMPLE_PHOTOS.map((url, index) => ({ id: `sample-${index}-${Date.now()}`, url })));
    setFormError(null);
  }, [clearPhotos]);

  // Thu hoi bo nho khi roi trang
  useEffect(() => {
    return () => {
      photoItemsRef.current.forEach((item) => {
        if (item.url.startsWith('blob:')) URL.revokeObjectURL(item.url);
      });
    };
  }, []);

  // Khoa cuon trang khi mo modal
  useEffect(() => {
    const locked = previewOpen || payOpen;
    document.body.style.overflow = locked ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [previewOpen, payOpen]);

  // --------------------------------------------------------------------------
  // XEM THU
  // --------------------------------------------------------------------------
  const openPreview = useCallback(() => {
    const error = validate();
    if (error) {
      setFormError(error);
      const anchor = document.getElementById('tao-qua');
      if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setFormError(null);
    setUploadingPreview(true);
    setPreviewKey((key) => key + 1);
    window.setTimeout(() => {
      setUploadingPreview(false);
      setPreviewOpen(true);
    }, 260);
  }, [validate]);

  const closePreview = useCallback(() => setPreviewOpen(false), []);

  // --------------------------------------------------------------------------
  // THANH TOAN
  // --------------------------------------------------------------------------
  const startPayment = useCallback(async () => {
    const error = validate();
    if (error) {
      setFormError(error);
      setPreviewOpen(false);
      return;
    }

    setPayOpen(true);
    setPayStage('preparing');
    setPayError('');
    setDraft(null);
    setUnlockedSlug(null);
    setSecondsLeft(PAYMENT_WINDOW_SECONDS);

    try {
      const filesToUpload = photoItems.filter((item) => Boolean(item.file));
      setUploadProgress({ done: 0, total: filesToUpload.length });

      const folder = `drafts/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const finalUrls: string[] = [];
      let done = 0;

      for (const item of photoItems) {
        if (item.file) {
          const publicUrl = await uploadGiftPhoto(item.file, folder);
          finalUrls.push(publicUrl);
          done += 1;
          setUploadProgress({ done, total: filesToUpload.length });
        } else {
          finalUrls.push(item.url);
        }
      }

      const row = await createGift({
        receiverName,
        senderName,
        message,
        theme: themeId,
        music: musicId,
        photos: finalUrls
      });

      setDraft(row);
      setPayStage('waiting');
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Có lỗi không xác định khi tạo đơn.');
      setPayStage('error');
    }
  }, [validate, photoItems, receiverName, senderName, message, themeId, musicId]);

  const checkStatus = useCallback(async (): Promise<boolean> => {
    if (!draft) return false;
    try {
      const status = await getGiftStatus(draft.transfer_code);
      if (status.is_paid) {
        setUnlockedSlug(status.slug ?? draft.slug);
        setPayStage('paid');
        setPreviewOpen(false);
        return true;
      }
    } catch {
      /* Loi mang tam thoi - bo qua va thu lai o lan polling ke tiep */
    }
    return false;
  }, [draft]);

  // Polling moi 3 giay
  useEffect(() => {
    if (payStage !== 'waiting' || !draft) return;
    const pollId = window.setInterval(() => {
      void checkStatus();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(pollId);
  }, [payStage, draft, checkStatus]);

  // Dem nguoc 10 phut
  useEffect(() => {
    if (payStage !== 'waiting') return;
    const timerId = window.setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [payStage]);

  useEffect(() => {
    if (payStage === 'waiting' && secondsLeft === 0) {
      setPayStage('expired');
    }
  }, [payStage, secondsLeft]);

  // Phao hoa khi thanh toan thanh cong
  useEffect(() => {
    if (payStage !== 'paid') return;

    confetti({
      particleCount: 140,
      spread: 96,
      origin: { y: 0.62 },
      colors: CONFETTI_COLORS
    });

    const endAt = Date.now() + 2400;
    let frame = 0;
    const burst = () => {
      confetti({ particleCount: 5, angle: 60, spread: 68, origin: { x: 0, y: 0.7 }, colors: CONFETTI_COLORS });
      confetti({ particleCount: 5, angle: 120, spread: 68, origin: { x: 1, y: 0.7 }, colors: CONFETTI_COLORS });
      if (Date.now() < endAt) {
        frame = requestAnimationFrame(burst);
      }
    };
    frame = requestAnimationFrame(burst);

    return () => cancelAnimationFrame(frame);
  }, [payStage]);

  const handleManualCheck = useCallback(async () => {
    setManualChecking(true);
    const paid = await checkStatus();
    if (!paid) {
      window.setTimeout(() => setManualChecking(false), 900);
    } else {
      setManualChecking(false);
    }
  }, [checkStatus]);

  const resetPayment = useCallback(() => {
    setSecondsLeft(PAYMENT_WINDOW_SECONDS);
    setPayStage('waiting');
  }, []);

  const closePayment = useCallback(() => {
    setPayOpen(false);
    setPayStage('idle');
  }, []);

  // --------------------------------------------------------------------------
  // DU LIEU DAN XUAT
  // --------------------------------------------------------------------------
  const vietQrUrl = draft ? buildVietQrUrl(draft.transfer_code, draft.amount) : '';
  const giftUrl = unlockedSlug ? buildGiftUrl(unlockedSlug) : '';
  const giftQrUrl = giftUrl ? buildQrImageUrl(giftUrl, 420) : '';
  const countdownLabel = formatCountdown(secondsLeft);
  const isUrgent = secondsLeft <= 120;

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <main className="min-h-screen bg-[#fff7fb]">
      {/* ------------------------------------------------------------------ */}
      {/* HEADER                                                              */}
      {/* ------------------------------------------------------------------ */}
      <header className="sticky top-0 z-40 border-b border-love-100/70 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-love-400 to-love-600 text-white shadow-md">
              <Gift className="h-4 w-4" />
            </span>
            <div className="leading-none">
              <p className="text-[15px] font-extrabold tracking-tight text-love-700">LoveBox 3D</p>
              <p className="text-[10px] text-love-500">Quà tặng 3D trong 60 giây</p>
            </div>
          </div>
          <a
            href="#tao-qua"
            className="rounded-full bg-love-500 px-4 py-2 text-[13px] font-bold text-white shadow-md transition active:scale-95"
          >
            Tạo quà ngay
          </a>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* HERO                                                                */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden px-4 pb-10 pt-12">
        <div className="pointer-events-none absolute -left-20 -top-16 h-56 w-56 rounded-full bg-love-200/60 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 top-24 h-64 w-64 rounded-full bg-amber-200/50 blur-3xl" />

        <div className="relative mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-love-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-love-600 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            Món quà khiến người ấy phải bật khóc
          </span>

          <h1 className="mt-5 text-[32px] font-extrabold leading-[1.15] tracking-tight text-love-900 sm:text-5xl">
            Biến ảnh kỷ niệm thành
            <span className="mx-1.5 inline-block bg-gradient-to-r from-love-500 via-love-400 to-amber-400 bg-clip-text text-transparent">
              món quà 3D
            </span>
            lung linh
          </h1>

          <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-love-900/70">
            Phong thư mở ra, nhạc nền lãng mạn, vòng xoay ảnh 3D và lời chúc chạy chữ. Tạo trong 60 giây — gửi
            link cho người thương qua Zalo, Messenger hay TikTok.
          </p>

          <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a
              href="#tao-qua"
              className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-love-500 to-love-600 px-7 py-4 text-[15px] font-bold text-white shadow-[0_16px_34px_-12px_rgba(237,30,100,.7)] transition active:scale-95 sm:w-auto"
            >
              Tạo quà miễn phí <ArrowRight className="h-4 w-4" />
            </a>
            <div className="flex items-center gap-2 text-[12px] font-medium text-love-900/60">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Xem thử trước, chỉ trả tiền khi ưng ý
            </div>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              { icon: Camera, label: '4–8 ảnh kỷ niệm' },
              { icon: Music2, label: 'Nhạc nền lãng mạn' },
              { icon: QrCode, label: 'Thiệp QR để gửi' }
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-love-100 bg-white/80 px-2 py-3 text-center shadow-sm"
              >
                <item.icon className="mx-auto h-4 w-4 text-love-500" />
                <p className="mt-1.5 text-[11px] font-semibold leading-tight text-love-900/75">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 3 BUOC                                                              */}
      {/* ------------------------------------------------------------------ */}
      <section className="px-4 pb-10">
        <div className="mx-auto grid max-w-2xl gap-3 sm:grid-cols-3">
          {[
            { step: '1', title: 'Điền thông tin', desc: 'Tên, lời chúc, chọn chủ đề & nhạc, thêm 4–8 ảnh.' },
            { step: '2', title: 'Xem thử ngay', desc: 'Mở phong thư, xoay ảnh 3D, xem đúng như thật.' },
            { step: '3', title: 'Trả 39k & nhận link', desc: 'Nhận link vĩnh viễn + thiệp QR gửi cho người ấy.' }
          ].map((item) => (
            <div key={item.step} className="rounded-2xl border border-love-100 bg-white p-4 shadow-sm">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-love-100 text-[12px] font-extrabold text-love-600">
                {item.step}
              </span>
              <p className="mt-2.5 text-[14px] font-bold text-love-900">{item.title}</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-love-900/60">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* FORM TAO QUA                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section id="tao-qua" className="scroll-mt-16 px-4 pb-14">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-3xl border border-love-100 bg-white p-4 shadow-[0_20px_60px_-30px_rgba(237,30,100,.35)] sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold tracking-tight text-love-900">Tạo món quà của bạn</h2>
                <p className="mt-1 text-[12.5px] text-love-900/60">
                  Đã điền sẵn dữ liệu mẫu — bạn chỉ cần bấm “Xem thử món quà”.
                </p>
              </div>
              <button
                type="button"
                onClick={loadSample}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-love-200 bg-love-50 px-3 py-2 text-[11.5px] font-semibold text-love-600 transition active:scale-95"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Dữ liệu mẫu
              </button>
            </div>

            {!isSupabaseConfigured && (
              <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-[12px] leading-relaxed text-amber-800">
                  <strong>Chưa cấu hình Supabase.</strong> Bạn vẫn xem thử được toàn bộ hiệu ứng 3D, nhưng chưa
                  thể tạo đơn &amp; thanh toán. Mở file <code className="rounded bg-amber-100 px-1">.env.local</code>{' '}
                  và điền <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code> +{' '}
                  <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
                </p>
              </div>
            )}

            {/* Ten nguoi nhan / nguoi gui */}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-bold text-love-900">
                  <Heart className="h-3.5 w-3.5 text-love-500" fill="currentColor" />
                  Tên người nhận
                </span>
                <input
                  type="text"
                  value={receiverName}
                  onChange={(event) => setReceiverName(event.target.value)}
                  maxLength={60}
                  placeholder="VD: Người Thương"
                  className="w-full rounded-xl border border-love-200 bg-love-50/40 px-3.5 py-3 text-[14px] text-love-900 outline-none transition placeholder:text-love-900/35 focus:border-love-400 focus:bg-white focus:ring-2 focus:ring-love-200"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-bold text-love-900">
                  <Send className="h-3.5 w-3.5 text-love-500" />
                  Tên người gửi
                </span>
                <input
                  type="text"
                  value={senderName}
                  onChange={(event) => setSenderName(event.target.value)}
                  maxLength={60}
                  placeholder="VD: Anh"
                  className="w-full rounded-xl border border-love-200 bg-love-50/40 px-3.5 py-3 text-[14px] text-love-900 outline-none transition placeholder:text-love-900/35 focus:border-love-400 focus:bg-white focus:ring-2 focus:ring-love-200"
                />
              </label>
            </div>

            {/* Loi chuc */}
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-love-900">
                  <Sparkles className="h-3.5 w-3.5 text-love-500" />
                  Lời chúc
                </span>
                <span className="text-[11px] text-love-900/45">{message.length}/1500</span>
              </div>

              <div className="mb-2 flex gap-1.5 overflow-x-auto lb-no-scrollbar">
                {WISH_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setWishTab(tab.id)}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-[11.5px] font-semibold transition ${
                      wishTab === tab.id
                        ? 'bg-love-500 text-white shadow-sm'
                        : 'border border-love-200 bg-white text-love-600'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value.slice(0, 1500))}
                rows={4}
                placeholder="Viết điều bạn muốn nói với người ấy..."
                className="w-full resize-none rounded-xl border border-love-200 bg-love-50/40 px-3.5 py-3 text-[14px] leading-relaxed text-love-900 outline-none transition placeholder:text-love-900/35 focus:border-love-400 focus:bg-white focus:ring-2 focus:ring-love-200"
              />

              <div className="mt-2 space-y-1.5">
                <p className="text-[11px] font-semibold text-love-900/50">Gợi ý câu chúc — bấm để dùng:</p>
                <div className="space-y-1.5">
                  {(WISH_SUGGESTIONS[wishTab] ?? []).map((text, index) => (
                    <button
                      key={`wish-${index}`}
                      type="button"
                      onClick={() => setMessage(text)}
                      className="block w-full rounded-xl border border-love-100 bg-love-50/60 px-3 py-2.5 text-left text-[12px] leading-relaxed text-love-900/75 transition hover:border-love-300 hover:bg-love-50 active:scale-[.99]"
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Chu de mau */}
            <div className="mt-5">
              <span className="mb-2 flex items-center gap-1.5 text-[12.5px] font-bold text-love-900">
                <Palette className="h-3.5 w-3.5 text-love-500" />
                Chủ đề màu sắc
              </span>
              <div className="grid grid-cols-3 gap-2.5">
                {THEME_LIST.map((theme) => {
                  const selected = themeId === theme.id;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => setThemeId(theme.id)}
                      className={`relative overflow-hidden rounded-2xl border-2 p-2.5 text-left transition active:scale-95 ${
                        selected ? 'border-love-500 bg-love-50' : 'border-love-100 bg-white'
                      }`}
                    >
                      <span className="flex gap-1">
                        {theme.swatch.map((color, index) => (
                          <span
                            key={`${theme.id}-${index}`}
                            className="h-5 w-5 rounded-full ring-1 ring-black/5"
                            style={{ background: color }}
                          />
                        ))}
                      </span>
                      <span className="mt-2 block text-[11.5px] font-bold leading-tight text-love-900">
                        {theme.emoji} {theme.name}
                      </span>
                      <span className="mt-0.5 block text-[10px] leading-tight text-love-900/50">
                        {theme.tagline}
                      </span>
                      {selected && (
                        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-love-500 text-white">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Nhac nen */}
            <div className="mt-5">
              <span className="mb-2 flex items-center gap-1.5 text-[12.5px] font-bold text-love-900">
                <Music2 className="h-3.5 w-3.5 text-love-500" />
                Nhạc nền
              </span>
              <div className="space-y-2">
                {MUSIC_TRACKS.map((track) => {
                  const selected = musicId === track.id;
                  return (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => setMusicId(track.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl border-2 px-3 py-2.5 text-left transition active:scale-[.99] ${
                        selected ? 'border-love-500 bg-love-50' : 'border-love-100 bg-white'
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                          selected ? 'bg-love-500 text-white' : 'bg-love-100 text-love-500'
                        }`}
                      >
                        <Music2 className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-bold text-love-900">{track.name}</span>
                        <span className="block text-[11px] text-love-900/50">{track.mood}</span>
                      </span>
                      {selected && <CheckCircle2 className="h-5 w-5 shrink-0 text-love-500" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Anh ky niem */}
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-love-900">
                  <ImagePlus className="h-3.5 w-3.5 text-love-500" />
                  Ảnh kỷ niệm
                </span>
                <span
                  className={`text-[11px] font-semibold ${
                    photoItems.length >= MIN_PHOTOS && photoItems.length <= MAX_PHOTOS
                      ? 'text-emerald-600'
                      : 'text-love-500'
                  }`}
                >
                  {photoItems.length}/{MAX_PHOTOS} ảnh (cần {MIN_PHOTOS}–{MAX_PHOTOS})
                </span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  addFiles(event.target.files);
                  event.target.value = '';
                }}
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-love-300 bg-love-50/50 px-3 py-3 text-[12.5px] font-bold text-love-600 transition active:scale-[.98]"
                >
                  <Upload className="h-4 w-4" />
                  Tải ảnh lên
                </button>
                {photoItems.length > 0 && (
                  <button
                    type="button"
                    onClick={clearPhotos}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-love-200 bg-white px-3.5 py-3 text-[12.5px] font-semibold text-love-500 transition active:scale-95"
                  >
                    <Trash2 className="h-4 w-4" />
                    Xoá hết
                  </button>
                )}
              </div>

              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={urlInput}
                  onChange={(event) => setUrlInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addUrls();
                    }
                  }}
                  placeholder="Hoặc dán link ảnh (cách nhau dấu phẩy)"
                  className="min-w-0 flex-1 rounded-xl border border-love-200 bg-white px-3.5 py-2.5 text-[12.5px] text-love-900 outline-none transition placeholder:text-love-900/35 focus:border-love-400 focus:ring-2 focus:ring-love-200"
                />
                <button
                  type="button"
                  onClick={addUrls}
                  className="shrink-0 rounded-xl border border-love-200 bg-white px-3.5 py-2.5 text-[12.5px] font-bold text-love-600 transition active:scale-95"
                >
                  Thêm
                </button>
              </div>

              {photoItems.length > 0 && (
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {photoItems.map((item, index) => (
                    <div
                      key={item.id}
                      className="group relative aspect-square overflow-hidden rounded-xl border border-love-100 bg-love-50"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.url} alt={`Ảnh ${index + 1}`} className="h-full w-full object-cover" />
                      <span className="absolute left-1 top-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[9px] font-bold text-white">
                        {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removePhoto(item.id)}
                        aria-label={`Xoá ảnh ${index + 1}`}
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white transition active:scale-90"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Loi */}
            {formError && (
              <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                <p className="text-[12.5px] font-medium leading-relaxed text-rose-700">{formError}</p>
              </div>
            )}

            {/* CTA */}
            <button
              type="button"
              onClick={openPreview}
              disabled={uploadingPreview}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-love-500 to-love-600 px-6 py-4 text-[15px] font-extrabold text-white shadow-[0_16px_34px_-14px_rgba(237,30,100,.8)] transition active:scale-[.98] disabled:opacity-70"
            >
              {uploadingPreview ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Đang chuẩn bị...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  Xem Thử Món Quà
                </>
              )}
            </button>

            <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11.5px] text-love-900/50">
              <Info className="h-3.5 w-3.5" />
              Miễn phí xem thử. Chỉ trả {formatVnd(PRICE_VND)} khi bạn muốn mở khoá link vĩnh viễn.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* BANG GIA                                                            */}
      {/* ------------------------------------------------------------------ */}
      <section className="px-4 pb-16">
        <div className="mx-auto max-w-md">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-love-600 via-love-500 to-love-400 p-[1.5px] shadow-[0_24px_60px_-24px_rgba(237,30,100,.6)]">
            <div className="rounded-[22px] bg-white p-6 text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-love-100 px-3 py-1.5 text-[11px] font-bold text-love-600">
                <Zap className="h-3.5 w-3.5" />
                Một lần duy nhất
              </span>

              <p className="mt-4 flex items-end justify-center gap-1">
                <span className="text-[44px] font-extrabold leading-none tracking-tight text-love-900">
                  39.000
                </span>
                <span className="pb-1.5 text-xl font-bold text-love-500">đ</span>
              </p>

              <ul className="mt-5 space-y-2.5 text-left">
                {[
                  'Link chia sẻ vĩnh viễn /g/[slug] — không bao giờ hết hạn',
                  'Không watermark, mở khoá toàn bộ hiệu ứng 3D',
                  'Thiệp QR kỹ thuật số thiết kế đẹp để gửi qua Zalo/Messenger',
                  'Thanh toán VietQR, hệ thống tự động mở khoá trong vài giây',
                  'Không cần đăng ký tài khoản'
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                      <Check className="h-3 w-3 text-emerald-600" />
                    </span>
                    <span className="text-[13px] leading-relaxed text-love-900/75">{item}</span>
                  </li>
                ))}
              </ul>

              <a
                href="#tao-qua"
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-love-500 px-6 py-3.5 text-[14.5px] font-extrabold text-white shadow-lg transition active:scale-[.98]"
              >
                Tạo quà &amp; mở khoá <ArrowRight className="h-4 w-4" />
              </a>

              <div className="mt-4 flex items-center justify-center gap-4 text-[11px] text-love-900/50">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                  Bảo mật
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-emerald-500" />
                  Mở khoá tự động
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* FOOTER                                                              */}
      {/* ------------------------------------------------------------------ */}
      <footer className="border-t border-love-100 bg-white px-4 py-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-love-400 to-love-600 text-white">
              <Gift className="h-3.5 w-3.5" />
            </span>
            <p className="text-[14px] font-extrabold text-love-700">LoveBox 3D</p>
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-love-900/55">
            Món quà nhỏ, kỷ niệm lớn. Tạo web quà tặng kỷ niệm &amp; 20/10 trong 60 giây.
          </p>
          <p className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-love-900/40">
            <span className="flex items-center gap-1">
              <Lock className="h-3 w-3" /> Thanh toán an toàn qua VietQR
            </span>
            <span className="hidden sm:inline">•</span>
            <span>© {new Date().getFullYear()} LoveBox 3D</span>
          </p>
        </div>
      </footer>

      {/* ==================================================================== */}
      {/* MODAL XEM THU TRUC TIEP                                              */}
      {/* ==================================================================== */}
      {previewOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black">
          <div className="relative flex-1 overflow-hidden">
            <Gift3DViewer
              key={`preview-${previewKey}`}
              receiverName={receiverName}
              senderName={senderName}
              message={message}
              photos={photoUrls}
              themeId={themeId}
              musicId={musicId}
              isPreview
            />

            <button
              type="button"
              onClick={closePreview}
              aria-label="Đóng xem thử"
              className="absolute left-3 top-3 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition active:scale-90"
            >
              <X className="h-5 w-5" />
            </button>

            <span className="absolute left-1/2 top-4 z-40 -translate-x-1/2 rounded-full bg-black/45 px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-white backdrop-blur">
              Chế độ xem thử
            </span>
          </div>

          {/* Floating banner */}
          <div className="shrink-0 border-t border-white/10 bg-[#150f18] px-4 pb-5 pt-4">
            <div className="mx-auto max-w-lg">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-love-500/15">
                  <Lock className="h-4 w-4 text-love-400" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13.5px] font-bold text-white">Bản xem thử (Chưa lưu)</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-white/65">
                    Mở khóa Link vĩnh viễn + Thiệp QR chỉ{' '}
                    <strong className="text-love-300">{formatVnd(PRICE_VND)}</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={startPayment}
                className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-love-500 to-love-600 px-6 py-4 text-[15px] font-extrabold text-white shadow-[0_16px_34px_-14px_rgba(237,30,100,.9)] transition active:scale-[.98]"
              >
                <Lock style={{ width: 18, height: 18 }} />
                Mở khoá ngay — {formatVnd(PRICE_VND)}
              </button>

              <button
                type="button"
                onClick={closePreview}
                className="mt-2 w-full py-2 text-center text-[12px] font-medium text-white/50"
              >
                Quay lại chỉnh sửa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL THANH TOAN VIETQR                                              */}
      {/* ==================================================================== */}
      {payOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center">
          <div className="lb-no-scrollbar max-h-[94vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white pb-6 shadow-2xl sm:rounded-3xl">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-love-100 bg-white/95 px-5 py-3.5 backdrop-blur">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-love-100 text-love-600">
                  {payStage === 'paid' ? <CheckCircle2 className="h-4 w-4" /> : <Banknote className="h-4 w-4" />}
                </span>
                <p className="text-[14px] font-extrabold text-love-900">
                  {payStage === 'paid' ? 'Mở khoá thành công!' : 'Thanh toán mở khoá'}
                </p>
              </div>
              <button
                type="button"
                onClick={closePayment}
                aria-label="Đóng"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-love-50 text-love-500 transition active:scale-90"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 pt-5">
              {/* ---------------------------------------------------------- */}
              {/* DANG CHUAN BI                                               */}
              {/* ---------------------------------------------------------- */}
              {payStage === 'preparing' && (
                <div className="flex flex-col items-center py-10 text-center">
                  <Loader2 className="h-10 w-10 animate-spin text-love-500" />
                  <p className="mt-4 text-[15px] font-bold text-love-900">Đang chuẩn bị món quà...</p>
                  <p className="mt-1.5 text-[12.5px] text-love-900/60">
                    {uploadProgress.total > 0
                      ? `Đang tải ảnh ${uploadProgress.done}/${uploadProgress.total}`
                      : 'Đang tạo mã đơn hàng'}
                  </p>
                  <div className="mt-5 h-2 w-full max-w-[240px] overflow-hidden rounded-full bg-love-100">
                    <div
                      className="h-full rounded-full bg-love-500 transition-all duration-300"
                      style={{
                        width:
                          uploadProgress.total > 0
                            ? `${Math.round((uploadProgress.done / uploadProgress.total) * 100)}%`
                            : '45%'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* ---------------------------------------------------------- */}
              {/* CHO CHUYEN KHOAN                                            */}
              {/* ---------------------------------------------------------- */}
              {payStage === 'waiting' && draft && (
                <div>
                  <div className="flex items-center justify-between rounded-2xl bg-love-50 px-4 py-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-love-900/50">
                        Số tiền
                      </p>
                      <p className="text-[20px] font-extrabold leading-tight text-love-700">
                        {formatVnd(draft.amount)}
                      </p>
                    </div>
                    <div
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 ${
                        isUrgent ? 'bg-rose-100 text-rose-600' : 'bg-white text-love-600'
                      }`}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      <span className="text-[13px] font-extrabold tabular-nums">{countdownLabel}</span>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-center">
                    <div className="rounded-2xl border-2 border-love-100 bg-white p-3 shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={vietQrUrl}
                        alt="Mã QR thanh toán VietQR"
                        width={248}
                        height={248}
                        className="h-[248px] w-[248px] rounded-xl object-contain"
                      />
                      <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-love-900/55">
                        <QrCode className="h-3.5 w-3.5" />
                        Mở app ngân hàng và quét mã
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between rounded-xl border border-love-100 bg-love-50/50 px-3.5 py-2.5">
                      <span className="text-[12px] text-love-900/60">Ngân hàng</span>
                      <span className="text-[12.5px] font-bold text-love-900">BIN {BANK_ID}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-love-100 bg-love-50/50 px-3.5 py-2.5">
                      <span className="text-[12px] text-love-900/60">Số tài khoản</span>
                      <span className="text-[12.5px] font-bold text-love-900">{BANK_ACCOUNT_NO || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-love-100 bg-love-50/50 px-3.5 py-2.5">
                      <span className="text-[12px] text-love-900/60">Chủ tài khoản</span>
                      <span className="text-[12.5px] font-bold uppercase text-love-900">{BANK_ACCOUNT_NAME}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-dashed border-love-300 bg-love-50 px-3.5 py-2.5">
                      <div className="min-w-0">
                        <span className="block text-[11px] text-love-900/60">Nội dung chuyển khoản</span>
                        <span className="block truncate text-[14px] font-extrabold tracking-wide text-love-700">
                          {draft.transfer_code}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyText(draft.transfer_code, 'transfer')}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-love-500 px-3 py-2 text-[11.5px] font-bold text-white transition active:scale-95"
                      >
                        {copiedKey === 'transfer' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedKey === 'transfer' ? 'Đã chép' : 'Chép'}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <p className="text-[12px] leading-relaxed text-amber-800">
                      Nhập <strong>đúng nội dung chuyển khoản</strong> ở trên. Hệ thống tự động kiểm tra mỗi 3 giây
                      và mở khoá ngay khi nhận được tiền.
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-love-50 py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-love-500" />
                    <span className="text-[12.5px] font-semibold text-love-900/70">
                      Đang chờ chuyển khoản...
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleManualCheck}
                    disabled={manualChecking}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-love-200 bg-white px-5 py-3.5 text-[13.5px] font-bold text-love-600 transition active:scale-[.98] disabled:opacity-60"
                  >
                    {manualChecking ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Đang kiểm tra...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" /> Tôi đã chuyển khoản
                      </>
                    )}
                  </button>

                  {process.env.NODE_ENV !== 'production' && (
                    <button
                      type="button"
                      onClick={() => {
                        setUnlockedSlug(draft.slug);
                        setPayStage('paid');
                        setPreviewOpen(false);
                      }}
                      className="mt-2 w-full rounded-2xl border border-dashed border-slate-300 py-2.5 text-[11.5px] font-semibold text-slate-500"
                    >
                      [DEV] Giả lập thanh toán thành công (chỉ để test giao diện)
                    </button>
                  )}
                </div>
              )}

              {/* ---------------------------------------------------------- */}
              {/* HET HAN                                                     */}
              {/* ---------------------------------------------------------- */}
              {payStage === 'expired' && draft && (
                <div className="py-6 text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
                    <Clock className="h-7 w-7 text-amber-600" />
                  </span>
                  <p className="mt-4 text-[15px] font-extrabold text-love-900">Phiên hiển thị mã đã hết</p>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-love-900/60">
                    Đừng lo — mã chuyển khoản <strong>{draft.transfer_code}</strong> vẫn còn hiệu lực. Bấm bên dưới
                    để hiển thị lại mã QR và tiếp tục kiểm tra tự động.
                  </p>
                  <button
                    type="button"
                    onClick={resetPayment}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-love-500 px-5 py-3.5 text-[14px] font-extrabold text-white transition active:scale-[.98]"
                  >
                    <RefreshCw className="h-4 w-4" /> Hiển thị lại mã QR
                  </button>
                </div>
              )}

              {/* ---------------------------------------------------------- */}
              {/* LOI                                                         */}
              {/* ---------------------------------------------------------- */}
              {payStage === 'error' && (
                <div className="py-6">
                  <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
                    <div>
                      <p className="text-[13.5px] font-bold text-rose-700">Không tạo được đơn hàng</p>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-rose-600">{payError}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={startPayment}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-love-500 px-5 py-3.5 text-[14px] font-extrabold text-white transition active:scale-[.98]"
                  >
                    <RefreshCw className="h-4 w-4" /> Thử lại
                  </button>
                </div>
              )}

              {/* ---------------------------------------------------------- */}
              {/* THANH CONG                                                  */}
              {/* ---------------------------------------------------------- */}
              {payStage === 'paid' && unlockedSlug && (
                <div className="pb-2">
                  <div className="text-center">
                    <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                      <CheckCircle2 className="h-9 w-9 text-emerald-600" />
                    </span>
                    <p className="mt-3 text-[17px] font-extrabold text-love-900">Món quà đã được mở khoá!</p>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-love-900/60">
                      Link của bạn đã sẵn sàng và không bao giờ hết hạn.
                    </p>
                  </div>

                  {/* Link */}
                  <div className="mt-5 rounded-2xl border border-love-100 bg-love-50/60 p-3.5">
                    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-love-900/55">
                      <Link2 className="h-3.5 w-3.5" /> Link chia sẻ của bạn
                    </p>
                    <p className="break-all rounded-xl bg-white px-3 py-2.5 text-[12.5px] font-semibold text-love-700">
                      {giftUrl}
                    </p>
                    <div className="mt-2.5 flex gap-2">
                      <button
                        type="button"
                        onClick={() => copyText(giftUrl, 'link')}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-love-500 px-3 py-2.5 text-[12.5px] font-bold text-white transition active:scale-95"
                      >
                        {copiedKey === 'link' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copiedKey === 'link' ? 'Đã chép link' : 'Chép link'}
                      </button>
                      <a
                        href={giftUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-love-200 bg-white px-3 py-2.5 text-[12.5px] font-bold text-love-600 transition active:scale-95"
                      >
                        <ExternalLink className="h-4 w-4" /> Mở trang quà
                      </a>
                    </div>
                  </div>

                  {/* Thiep QR */}
                  <div className="mt-4 overflow-hidden rounded-2xl border border-love-100 bg-gradient-to-br from-love-50 to-white p-4 text-center">
                    <p className="flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-love-900/55">
                      <QrCode className="h-3.5 w-3.5" /> Thiệp QR kỹ thuật số
                    </p>

                    <div className="mx-auto mt-3 max-w-[300px] rounded-2xl bg-white p-4 shadow-sm ring-1 ring-love-100">
                      <p className="font-script text-2xl leading-tight text-love-600">{receiverName}</p>
                      <p className="mt-1 text-[10.5px] uppercase tracking-[0.2em] text-love-900/45">
                        Một món quà đang chờ em
                      </p>
                      {giftQrUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={giftQrUrl}
                          alt="QR mở món quà"
                          width={180}
                          height={180}
                          className="mx-auto mt-3 h-[180px] w-[180px]"
                        />
                      )}
                      <p className="mt-2 text-[10.5px] leading-relaxed text-love-900/55">
                        Quét mã để mở món quà
                        <br />
                        từ <strong>{senderName}</strong>
                      </p>
                    </div>

                    <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-love-900/45">
                      <Star className="h-3.5 w-3.5 text-amber-400" fill="currentColor" />
                      Chụp màn hình thiệp này và gửi cho người ấy
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={closePayment}
                    className="mt-4 w-full rounded-2xl border-2 border-love-200 bg-white px-5 py-3.5 text-[13.5px] font-bold text-love-600 transition active:scale-[.98]"
                  >
                    Xong
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
