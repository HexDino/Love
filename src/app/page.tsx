'use client';

// ============================================================================
// LoveBox 3D - Trang chu
// ----------------------------------------------------------------------------
// Cau truc trang:
//   1. Header
//   2. Hero  + khu "Trai nghiem thu 4 vu tru qua tang" (4 nut bam 1-cham)
//   3. Quy trinh 4 buoc
//   4. Studio tao qua 4 buoc (thay cho form don gian cua V1)
//   5. Bang gia
//   6. Footer
//   7. Lop phu xem thu 4 template (demo overlay)
//   8. Modal xem thu toan bo mon qua (co the tu cao the / tu xe tui mu)
//   9. Modal thanh toan VietQR 39.000d
//
// Toan bo cau hinh V2 (kieu trinh dien, mat khau, the cao, ve dac quyen, chu
// thich anh) duoc gom vao MOT doi tuong `GiftConfig` roi gui kem khi tao don.
// Server se chuan hoa lai lan cuoi truoc khi ghi xuong cot `config` (JSONB).
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Dice5,
  Eye,
  ExternalLink,
  Gift,
  Heart,
  ImagePlus,
  Info,
  KeyRound,
  LayoutTemplate,
  Link2,
  Loader2,
  Lock,
  LockOpen,
  Music2,
  Palette,
  PenLine,
  Play,
  QrCode,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Ticket,
  Trash2,
  Upload,
  Wand2,
  X,
  Zap,
  type LucideIcon
} from 'lucide-react';
import confetti from 'canvas-confetti';
import Gift3DViewer from '@/components/Gift3DViewer';
import {
  COUPON_SUGGESTIONS,
  MAX_CAPTION_LENGTH,
  MAX_COUPONS,
  MAX_COUPON_LENGTH,
  MAX_PASSCODE_HINT_LENGTH,
  MAX_PHOTOS,
  MAX_SCRATCH_LENGTH,
  MIN_PHOTOS,
  MUSIC_TRACKS,
  SAMPLE_CAPTIONS,
  SAMPLE_COUPONS,
  SAMPLE_GIFT,
  SAMPLE_PASSCODE,
  SAMPLE_PASSCODE_HINT,
  SAMPLE_PHOTOS,
  SAMPLE_SCRATCH_MESSAGE,
  SCRATCH_SUGGESTIONS,
  TEMPLATE_BADGES,
  TEMPLATE_LIST,
  TEMPLATE_META,
  THEME_LIST,
  UNLOCK_BENEFITS,
  WISH_AUDIENCES,
  DEFAULT_TEMPLATE_STYLE,
  type GiftConfig,
  type TemplateStyle,
  type ThemeId,
  type WishAudience
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
  /** Chu thich rieng cho tung anh - khop theo chi so mang photos */
  caption: string;
}

type PayStage = 'idle' | 'preparing' | 'waiting' | 'expired' | 'paid' | 'error';

type StepId = 1 | 2 | 3 | 4;

const PAYMENT_WINDOW_SECONDS = 10 * 60;
const POLL_INTERVAL_MS = 3000;
const CONFETTI_COLORS = ['#ff3d7f', '#ffd166', '#8ab4ff', '#ffffff', '#ff9a52'];

interface StudioStep {
  id: StepId;
  /** Nhan ngan hien tren thanh buoc */
  short: string;
  /** Tieu de day du cua buoc */
  title: string;
  icon: LucideIcon;
}

const STUDIO_STEPS: StudioStep[] = [
  { id: 1, short: 'Kiểu', title: 'Chọn kiểu trình diễn', icon: LayoutTemplate },
  { id: 2, short: 'Nội dung', title: 'Lời chúc & ảnh kỷ niệm', icon: Sparkles },
  { id: 3, short: 'Tương tác', title: 'Trò chơi & tương tác', icon: Wand2 },
  { id: 4, short: 'Xem thử', title: 'Xem thử & mở khoá', icon: Eye }
];

/** Mau nen rieng cho tung the chon kieu trinh dien (giup 4 the khac biet ro) */
const TEMPLATE_TINTS: Record<TemplateStyle, string> = {
  'galaxy-3d': 'from-indigo-500/12 via-violet-500/8 to-white',
  'polaroid-vinyl': 'from-amber-500/14 via-orange-500/8 to-white',
  'sweet-trap': 'from-rose-500/14 via-pink-500/8 to-white',
  'blindbox-2010': 'from-emerald-500/14 via-teal-500/8 to-white'
};

const TEMPLATE_BORDERS: Record<TemplateStyle, string> = {
  'galaxy-3d': 'border-indigo-200',
  'polaroid-vinyl': 'border-amber-200',
  'sweet-trap': 'border-rose-200',
  'blindbox-2010': 'border-emerald-200'
};

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================================
// COMPONENT NHO DUNG CHUNG
// ============================================================================

/** Cong tac bat/tat kieu iOS */
function Switch({
  checked,
  onChange,
  label
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
        checked ? 'bg-love-500' : 'bg-love-200'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-200 ${
          checked ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}

/**
 * O nhap mat khau 4 chu so.
 *
 * Ky thuat: ve 4 o lon cho dep mat, nhung dat MOT input that phu len tren
 * (trong suot). Nho vay ban phim so tren dien thoai van hoat dong dung chuan,
 * khong phai vat lon voi viec tu chuyen focus giua 4 o nhu cach lam co dien.
 */
function PasscodeField({
  value,
  onChange,
  disabled = false
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const padded = value.padEnd(4, ' ').slice(0, 4);
  const cells = [padded.charAt(0), padded.charAt(1), padded.charAt(2), padded.charAt(3)];

  return (
    <div className={`relative ${disabled ? 'pointer-events-none opacity-45' : ''}`}>
      <div className="flex justify-center gap-2.5" aria-hidden="true">
        {cells.map((char, index) => {
          const filled = char.trim().length > 0;
          return (
            <span
              key={`cell-${index}`}
              className={`flex h-[52px] w-[44px] items-center justify-center rounded-2xl border-2 text-[22px] font-extrabold tabular-nums transition ${
                filled
                  ? 'border-love-400 bg-white text-love-700 shadow-sm'
                  : 'border-love-200 bg-love-50/70 text-love-900/25'
              }`}
            >
              {filled ? char : '·'}
            </span>
          );
        })}
      </div>

      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        maxLength={4}
        disabled={disabled}
        value={value}
        aria-label="Mật khẩu mở quà gồm 4 chữ số"
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 4))}
        className="absolute inset-0 h-full w-full cursor-pointer bg-transparent text-transparent caret-transparent outline-none"
      />
    </div>
  );
}

/** The bao boc mot nhom tuy chon trong Studio */
function SettingCard({
  icon: Icon,
  title,
  desc,
  right,
  children
}: {
  icon: LucideIcon;
  title: string;
  desc?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-love-100 bg-love-50/35 p-3.5">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-love-500 shadow-sm">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-extrabold leading-tight text-love-900">{title}</p>
          {desc && <p className="mt-0.5 text-[11.5px] leading-snug text-love-900/55">{desc}</p>}
        </div>
        {right}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

// ============================================================================
// TRANG CHINH
// ============================================================================
export default function HomePage() {
  // --------------------------------------------------------------------------
  // STATE - BUOC 2: NOI DUNG
  // --------------------------------------------------------------------------
  const [receiverName, setReceiverName] = useState(SAMPLE_GIFT.receiverName);
  const [senderName, setSenderName] = useState(SAMPLE_GIFT.senderName);
  const [message, setMessage] = useState(SAMPLE_GIFT.message);
  const [themeId, setThemeId] = useState<ThemeId>(SAMPLE_GIFT.themeId);
  const [musicId, setMusicId] = useState(SAMPLE_GIFT.musicId);
  const [photoItems, setPhotoItems] = useState<PhotoItem[]>(
    SAMPLE_GIFT.photos.map((url, index) => ({
      id: `sample-${index}`,
      url,
      caption: SAMPLE_CAPTIONS[index] ?? ''
    }))
  );
  const [urlInput, setUrlInput] = useState('');
  const [wishAudience, setWishAudience] = useState<WishAudience['id']>(WISH_AUDIENCES[0].id);

  // --------------------------------------------------------------------------
  // STATE - BUOC 1 & 3: KIEU TRINH DIEN + TUONG TAC
  // --------------------------------------------------------------------------
  const [templateStyle, setTemplateStyle] = useState<TemplateStyle>(DEFAULT_TEMPLATE_STYLE);
  const [passcodeEnabled, setPasscodeEnabled] = useState(true);
  const [passcode, setPasscode] = useState(SAMPLE_PASSCODE);
  const [passcodeHint, setPasscodeHint] = useState(SAMPLE_PASSCODE_HINT);
  const [scratchEnabled, setScratchEnabled] = useState(true);
  const [scratchMessage, setScratchMessage] = useState(SAMPLE_SCRATCH_MESSAGE);
  const [coupons, setCoupons] = useState<string[]>(SAMPLE_COUPONS);
  const [couponDraft, setCouponDraft] = useState('');

  // --------------------------------------------------------------------------
  // STATE - DIEU HUONG STUDIO
  // --------------------------------------------------------------------------
  const [step, setStep] = useState<StepId>(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadingPreview, setUploadingPreview] = useState(false);

  // --------------------------------------------------------------------------
  // STATE - LOP PHU XEM THU 4 TEMPLATE
  // --------------------------------------------------------------------------
  const [demoStyle, setDemoStyle] = useState<TemplateStyle | null>(null);
  const [demoPasscode, setDemoPasscode] = useState(false);
  const [demoKey, setDemoKey] = useState(0);

  // --------------------------------------------------------------------------
  // STATE - MODAL XEM THU + THANH TOAN
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

  /** Con tro "bam lai de doi cau khac" cho tung thu vien loi chuc */
  const wishCursorRef = useRef<Record<string, number>>({ lover: 0, crush: 0, family: 0 });

  // --------------------------------------------------------------------------
  // DU LIEU DAN XUAT
  // --------------------------------------------------------------------------
  const photoUrls = useMemo(() => photoItems.map((item) => item.url), [photoItems]);
  const activeAudience = useMemo(
    () => WISH_AUDIENCES.find((item) => item.id === wishAudience) ?? WISH_AUDIENCES[0],
    [wishAudience]
  );
  const couponsFull = coupons.length >= MAX_COUPONS;
  const hasPasscodeConfigured = passcodeEnabled && /^\d{4}$/.test(passcode);

  /**
   * Dong goi toan bo cau hinh V2 de gui len server.
   * Chu y: `captions` PHAI giu dung thu tu anh, ke ca khi mot anh khong co
   * chu thich (de trong chuoi rong) - neu khong chu thich se bi lech anh.
   */
  const buildConfig = useCallback(
    (): GiftConfig => ({
      template: templateStyle,
      passcode: passcodeEnabled ? passcode : '',
      passcodeHint: passcodeEnabled ? passcodeHint.trim() : '',
      scratchMessage: scratchEnabled ? scratchMessage.trim() : '',
      coupons,
      captions: photoItems.map((item) => item.caption.trim())
    }),
    [templateStyle, passcodeEnabled, passcode, passcodeHint, scratchEnabled, scratchMessage, coupons, photoItems]
  );

  // --------------------------------------------------------------------------
  // TIEN ICH
  // --------------------------------------------------------------------------
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
  // KIEM TRA DU LIEU THEO TUNG BUOC
  // --------------------------------------------------------------------------
  const validateBasics = useCallback((): string | null => {
    if (!receiverName.trim()) return 'Vui lòng nhập tên người nhận.';
    if (!senderName.trim()) return 'Vui lòng nhập tên người gửi.';
    if (!message.trim()) return 'Vui lòng nhập lời chúc.';
    if (message.trim().length < 20) return 'Lời chúc nên dài ít nhất 20 ký tự để thật cảm động.';
    if (photoItems.length < MIN_PHOTOS) {
      return `Cần ít nhất ${MIN_PHOTOS} ảnh kỷ niệm (bạn đang có ${photoItems.length}).`;
    }
    if (photoItems.length > MAX_PHOTOS) return `Tối đa ${MAX_PHOTOS} ảnh.`;
    return null;
  }, [receiverName, senderName, message, photoItems.length]);

  const validateInteractions = useCallback((): string | null => {
    if (passcodeEnabled && !/^\d{4}$/.test(passcode)) {
      return 'Mật khẩu mở quà phải gồm đúng 4 chữ số (ví dụ: 2010).';
    }
    if (coupons.length > MAX_COUPONS) return `Tối đa ${MAX_COUPONS} vé đặc quyền.`;
    return null;
  }, [passcodeEnabled, passcode, coupons.length]);

  const validate = useCallback(
    (): string | null => validateBasics() ?? validateInteractions(),
    [validateBasics, validateInteractions]
  );

  const scrollToForm = useCallback(() => {
    const anchor = document.getElementById('tao-qua');
    if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // --------------------------------------------------------------------------
  // DIEU HUONG STUDIO
  // --------------------------------------------------------------------------
  const goNext = useCallback(() => {
    if (step === 2) {
      const error = validateBasics();
      if (error) {
        setFormError(error);
        return;
      }
    }
    if (step === 3) {
      const error = validateInteractions();
      if (error) {
        setFormError(error);
        return;
      }
    }
    setFormError(null);
    setStep((current) => (current < 4 ? ((current + 1) as StepId) : current));
  }, [step, validateBasics, validateInteractions]);

  const goBack = useCallback(() => {
    setFormError(null);
    setStep((current) => (current > 1 ? ((current - 1) as StepId) : current));
  }, []);

  /** Bam vao so buoc tren thanh tien do de nhay toi - nhung phai vuot qua kiem tra */
  const jumpTo = useCallback(
    (target: StepId) => {
      if (target === step) return;
      if (target < step) {
        setFormError(null);
        setStep(target);
        return;
      }
      if (target >= 3) {
        const basics = validateBasics();
        if (basics) {
          setFormError(basics);
          setStep(2);
          return;
        }
      }
      if (target >= 4) {
        const interactions = validateInteractions();
        if (interactions) {
          setFormError(interactions);
          setStep(3);
          return;
        }
      }
      setFormError(null);
      setStep(target);
    },
    [step, validateBasics, validateInteractions]
  );

  // --------------------------------------------------------------------------
  // THU VIEN LOI CHUC 1-CLICK
  // --------------------------------------------------------------------------
  const applyWishLibrary = useCallback((audience: WishAudience) => {
    const list = audience.wishes;
    if (list.length === 0) return;
    const cursor = wishCursorRef.current[audience.id] ?? 0;
    setMessage(list[cursor % list.length]);
    wishCursorRef.current[audience.id] = cursor + 1;
    setWishAudience(audience.id);
    setFormError(null);
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
          accepted.push({ id: makeId('file'), url: URL.createObjectURL(file), file, caption: '' });
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

    const accepted = lines
      .slice(0, remaining)
      .map((url) => ({ id: makeId('url'), url, caption: '' }));
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

  const updateCaption = useCallback((id: string, caption: string) => {
    setPhotoItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, caption: caption.slice(0, MAX_CAPTION_LENGTH) } : item
      )
    );
  }, []);

  const clearPhotos = useCallback(() => {
    photoItemsRef.current.forEach((item) => {
      if (item.url.startsWith('blob:')) URL.revokeObjectURL(item.url);
    });
    setPhotoItems([]);
  }, []);

  // --------------------------------------------------------------------------
  // VE DAC QUYEN
  // --------------------------------------------------------------------------
  const toggleCoupon = useCallback(
    (value: string) => {
      setCoupons((prev) => {
        if (prev.includes(value)) return prev.filter((item) => item !== value);
        if (prev.length >= MAX_COUPONS) {
          setFormError(`Tối đa ${MAX_COUPONS} vé đặc quyền.`);
          return prev;
        }
        setFormError(null);
        return [...prev, value];
      });
    },
    []
  );

  const addCustomCoupon = useCallback(() => {
    const value = couponDraft.trim().slice(0, MAX_COUPON_LENGTH);
    if (!value) return;
    if (coupons.includes(value)) {
      setCouponDraft('');
      return;
    }
    if (coupons.length >= MAX_COUPONS) {
      setFormError(`Tối đa ${MAX_COUPONS} vé đặc quyền.`);
      return;
    }
    setCoupons((prev) => [...prev, value]);
    setCouponDraft('');
    setFormError(null);
  }, [couponDraft, coupons]);

  const randomizePasscode = useCallback(() => {
    let next = '';
    for (let index = 0; index < 4; index += 1) {
      next += String(Math.floor(Math.random() * 10));
    }
    setPasscode(next);
  }, []);

  // --------------------------------------------------------------------------
  // NAP DU LIEU MAU (dien san toan bo de bam xem thu ngay)
  // --------------------------------------------------------------------------
  const loadSample = useCallback(() => {
    photoItemsRef.current.forEach((item) => {
      if (item.url.startsWith('blob:')) URL.revokeObjectURL(item.url);
    });
    setReceiverName(SAMPLE_GIFT.receiverName);
    setSenderName(SAMPLE_GIFT.senderName);
    setMessage(SAMPLE_GIFT.message);
    setThemeId(SAMPLE_GIFT.themeId);
    setMusicId(SAMPLE_GIFT.musicId);
    setPhotoItems(
      SAMPLE_PHOTOS.map((url, index) => ({
        id: `sample-${index}-${Date.now()}`,
        url,
        caption: SAMPLE_CAPTIONS[index] ?? ''
      }))
    );
    setTemplateStyle(DEFAULT_TEMPLATE_STYLE);
    setPasscodeEnabled(true);
    setPasscode(SAMPLE_PASSCODE);
    setPasscodeHint(SAMPLE_PASSCODE_HINT);
    setScratchEnabled(true);
    setScratchMessage(SAMPLE_SCRATCH_MESSAGE);
    setCoupons(SAMPLE_COUPONS);
    setCouponDraft('');
    setFormError(null);
    setStep(1);
  }, []);

  // Thu hoi bo nho khi roi trang
  useEffect(() => {
    return () => {
      photoItemsRef.current.forEach((item) => {
        if (item.url.startsWith('blob:')) URL.revokeObjectURL(item.url);
      });
    };
  }, []);

  // Khoa cuon trang khi mo lop phu / modal
  useEffect(() => {
    const locked = previewOpen || payOpen || demoStyle !== null;
    document.body.style.overflow = locked ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [previewOpen, payOpen, demoStyle]);

  // Bam Escape de dong lop phu xem thu / modal xem thu
  useEffect(() => {
    if (!demoStyle && !previewOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (demoStyle) setDemoStyle(null);
      else if (previewOpen) setPreviewOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [demoStyle, previewOpen]);

  // --------------------------------------------------------------------------
  // LOP PHU XEM THU 4 TEMPLATE
  // --------------------------------------------------------------------------
  const openDemo = useCallback((style: TemplateStyle) => {
    setDemoStyle(style);
    setDemoPasscode(false);
    setDemoKey((key) => key + 1);
  }, []);

  const closeDemo = useCallback(() => setDemoStyle(null), []);

  const switchDemoStyle = useCallback((style: TemplateStyle) => {
    setDemoStyle(style);
    setDemoKey((key) => key + 1);
  }, []);

  /** Tu lop phu xem thu -> ap dung kieu nay vao Studio va keo nguoi dung ve form */
  const applyDemoStyle = useCallback(
    (style: TemplateStyle) => {
      setTemplateStyle(style);
      setDemoStyle(null);
      setStep(1);
      window.setTimeout(scrollToForm, 120);
    },
    [scrollToForm]
  );

  // --------------------------------------------------------------------------
  // XEM THU TOAN BO MON QUA
  // --------------------------------------------------------------------------
  const openPreview = useCallback(() => {
    const error = validate();
    if (error) {
      setFormError(error);
      scrollToForm();
      return;
    }
    setFormError(null);
    setUploadingPreview(true);
    setPreviewKey((key) => key + 1);
    window.setTimeout(() => {
      setUploadingPreview(false);
      setPreviewOpen(true);
    }, 260);
  }, [validate, scrollToForm]);

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
        photos: finalUrls,
        config: buildConfig()
      });

      setDraft(row);
      setPayStage('waiting');
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Có lỗi không xác định khi tạo đơn.');
      setPayStage('error');
    }
  }, [validate, photoItems, receiverName, senderName, message, themeId, musicId, buildConfig]);

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
  // DU LIEU DAN XUAT CHO MODAL THANH TOAN
  // --------------------------------------------------------------------------
  const vietQrUrl = draft ? buildVietQrUrl(draft.transfer_code, draft.amount) : '';
  const giftUrl = unlockedSlug ? buildGiftUrl(unlockedSlug) : '';
  const giftQrUrl = giftUrl ? buildQrImageUrl(giftUrl, 420) : '';
  const countdownLabel = formatCountdown(secondsLeft);
  const isUrgent = secondsLeft <= 120;

  const currentStepMeta = STUDIO_STEPS.find((item) => item.id === step) ?? STUDIO_STEPS[0];
  const templateMeta = TEMPLATE_META[templateStyle];

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
          <div className="flex items-center gap-2">
            <a
              href="#vu-tru"
              className="hidden rounded-full border border-love-200 bg-white px-3.5 py-2 text-[12.5px] font-bold text-love-600 transition active:scale-95 sm:block"
            >
              4 vũ trụ
            </a>
            <a
              href="#tao-qua"
              className="rounded-full bg-love-500 px-4 py-2 text-[13px] font-bold text-white shadow-md transition active:scale-95"
            >
              Tạo quà ngay
            </a>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* HERO + 4 VU TRU                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden px-4 pb-10 pt-12">
        <div className="pointer-events-none absolute -left-20 -top-16 h-56 w-56 rounded-full bg-love-200/60 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 top-24 h-64 w-64 rounded-full bg-amber-200/50 blur-3xl" />

        <div className="relative mx-auto max-w-3xl text-center">
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

          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-love-900/70">
            Phong thư mở ra, nhạc nền lãng mạn, vòng xoay ảnh 3D, khoá mật khẩu, thẻ cào bí mật và vé đặc quyền.
            Tạo trong 60 giây — gửi link cho người thương qua Zalo, Messenger hay TikTok.
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
              { icon: Wand2, label: '4 kiểu tương tác' },
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

        {/* ---------------- 4 NUT BAM XEM THU NGAY 4 VU TRU ---------------- */}
        <div id="vu-tru" className="relative mx-auto mt-11 max-w-3xl scroll-mt-16">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-love-500/10 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-love-600">
              <Play className="h-3 w-3" fill="currentColor" />
              Bấm là xem được ngay
            </span>
            <h2 className="mt-3 text-[22px] font-extrabold tracking-tight text-love-900 sm:text-[26px]">
              Trải nghiệm thử 4 vũ trụ quà tặng
            </h2>
            <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-love-900/60">
              Không cần điền form. Bấm một nút để xem đúng những gì người ấy sẽ nhận được.
            </p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {TEMPLATE_LIST.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => openDemo(template.id)}
                className={`group flex flex-col items-center gap-1.5 rounded-3xl border-2 bg-gradient-to-br p-3.5 text-center transition active:scale-[.97] ${TEMPLATE_BORDERS[template.id]} ${TEMPLATE_TINTS[template.id]}`}
              >
                <span className="text-[30px] leading-none drop-shadow-sm">{template.emoji}</span>
                <span className="rounded-full bg-white/80 px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-love-600 shadow-sm">
                  {TEMPLATE_BADGES[template.id]}
                </span>
                <span className="text-[12.5px] font-extrabold leading-tight text-love-900">{template.name}</span>
                <span className="text-[10.5px] leading-tight text-love-900/55">{template.tagline}</span>
                <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-extrabold text-love-600">
                  Xem thử
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* QUY TRINH 4 BUOC                                                    */}
      {/* ------------------------------------------------------------------ */}
      <section className="px-4 pb-10">
        <div className="mx-auto grid max-w-3xl gap-2.5 sm:grid-cols-4">
          {[
            { step: '1', title: 'Chọn vũ trụ', desc: '4 kiểu trình diễn khác hẳn nhau.' },
            { step: '2', title: 'Lời chúc & ảnh', desc: 'Thư viện lời chúc 1-click + chú thích từng ảnh.' },
            { step: '3', title: 'Bật tương tác', desc: 'Mật khẩu, thẻ cào bí mật, vé đặc quyền.' },
            { step: '4', title: 'Xem thử & mở khoá', desc: 'Nhận link vĩnh viễn + thiệp QR để gửi.' }
          ].map((item) => (
            <div key={item.step} className="rounded-2xl border border-love-100 bg-white p-3.5 shadow-sm">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-love-100 text-[12px] font-extrabold text-love-600">
                {item.step}
              </span>
              <p className="mt-2.5 text-[13.5px] font-bold leading-tight text-love-900">{item.title}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-love-900/60">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* STUDIO 4 BUOC                                                       */}
      {/* ------------------------------------------------------------------ */}
      <section id="tao-qua" className="scroll-mt-16 px-4 pb-14">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-3xl border border-love-100 bg-white p-4 shadow-[0_20px_60px_-30px_rgba(237,30,100,.35)] sm:p-6">
            {/* Tieu de + nut nap du lieu mau */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold tracking-tight text-love-900">Studio tạo quà</h2>
                <p className="mt-1 text-[12.5px] text-love-900/60">
                  Bốn bước ngắn — đã điền sẵn dữ liệu mẫu để bạn bấm xem thử ngay.
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

            {/* ------------------------- THANH TIEN DO ------------------------ */}
            <ol className="mt-4 grid grid-cols-4 gap-1.5">
              {STUDIO_STEPS.map((item) => {
                const active = step === item.id;
                const done = step > item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => jumpTo(item.id)}
                      aria-current={active ? 'step' : undefined}
                      className={`flex w-full flex-col items-center gap-1 rounded-2xl border-2 px-1 py-2 transition active:scale-[.97] ${
                        active
                          ? 'border-love-400 bg-love-50'
                          : done
                            ? 'border-emerald-200 bg-emerald-50/60'
                            : 'border-love-100 bg-white'
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold ${
                          active
                            ? 'bg-love-500 text-white'
                            : done
                              ? 'bg-emerald-500 text-white'
                              : 'bg-love-100 text-love-500'
                        }`}
                      >
                        {done ? <Check className="h-3.5 w-3.5" /> : item.id}
                      </span>
                      <span
                        className={`w-full truncate text-center text-[10px] font-bold leading-tight ${
                          active ? 'text-love-700' : 'text-love-900/55'
                        }`}
                      >
                        {item.short}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            {/* --------------------- TIEU DE BUOC DANG MO -------------------- */}
            <div className="mt-5 flex items-center gap-2 border-b border-love-100 pb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-love-100 text-love-600">
                <currentStepMeta.icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-love-500">
                  Bước {step}/4
                </p>
                <p className="text-[15px] font-extrabold leading-tight text-love-900">{currentStepMeta.title}</p>
              </div>
            </div>

            {/* ============================================================== */}
            {/* BUOC 1 - CHON KIEU TRINH DIEN                                  */}
            {/* ============================================================== */}
            {step === 1 && (
              <div className="mt-4">
                <p className="text-[12.5px] leading-relaxed text-love-900/65">
                  Mỗi vũ trụ là một cách kể chuyện khác nhau. Bạn có thể bấm <strong>Xem thử</strong> để trải
                  nghiệm trước khi chọn.
                </p>

                <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  {TEMPLATE_LIST.map((template) => {
                    const selected = templateStyle === template.id;
                    return (
                      <div
                        key={template.id}
                        className={`overflow-hidden rounded-2xl border-2 bg-gradient-to-br p-3 transition ${
                          selected
                            ? 'border-love-500 ' + TEMPLATE_TINTS[template.id]
                            : 'border-love-100 from-white to-white'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setTemplateStyle(template.id)}
                          className="flex w-full items-start gap-3 text-left"
                        >
                          <span className="text-[28px] leading-none">{template.emoji}</span>
                          <span className="min-w-0 flex-1">
                            <span className="inline-flex rounded-full bg-love-500/10 px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-love-600">
                              {TEMPLATE_BADGES[template.id]}
                            </span>
                            <span className="mt-1 block text-[13.5px] font-extrabold leading-tight text-love-900">
                              {template.name}
                            </span>
                            <span className="mt-0.5 block text-[11.5px] leading-snug text-love-900/60">
                              {template.tagline}
                            </span>
                          </span>
                          {selected && (
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-love-500 text-white">
                              <Check className="h-3 w-3" />
                            </span>
                          )}
                        </button>

                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => setTemplateStyle(template.id)}
                            className={`flex-1 rounded-xl px-3 py-2 text-[11.5px] font-bold transition active:scale-[.97] ${
                              selected
                                ? 'bg-love-500 text-white'
                                : 'border border-love-200 bg-white text-love-600'
                            }`}
                          >
                            {selected ? 'Đang chọn' : 'Chọn kiểu này'}
                          </button>
                          <button
                            type="button"
                            onClick={() => openDemo(template.id)}
                            className="flex items-center gap-1 rounded-xl border border-love-200 bg-white px-3 py-2 text-[11.5px] font-bold text-love-600 transition active:scale-[.97]"
                          >
                            <Play className="h-3 w-3" fill="currentColor" />
                            Xem thử
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-love-100 bg-love-50/60 p-3">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-love-500" />
                  <p className="text-[11.5px] leading-relaxed text-love-900/65">
                    <strong>{templateMeta.name}</strong> — {templateMeta.tagline}. Bạn luôn có thể đổi kiểu
                    trình diễn sau khi đã nhập nội dung.
                  </p>
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* BUOC 2 - NOI DUNG & ANH                                        */}
            {/* ============================================================== */}
            {step === 2 && (
              <div className="mt-4">
                {/* Ten nguoi nhan / nguoi gui */}
                <div className="grid gap-4 sm:grid-cols-2">
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

                {/* Thu vien loi chuc 1-click */}
                <div className="mt-5">
                  <span className="mb-2 flex items-center gap-1.5 text-[12.5px] font-bold text-love-900">
                    <Sparkles className="h-3.5 w-3.5 text-love-500" />
                    Thư viện lời chúc — bấm 1 lần là có ngay
                  </span>

                  <div className="grid grid-cols-3 gap-2">
                    {WISH_AUDIENCES.map((audience) => {
                      const active = wishAudience === audience.id;
                      return (
                        <button
                          key={audience.id}
                          type="button"
                          onClick={() => applyWishLibrary(audience)}
                          className={`flex flex-col items-center gap-1 rounded-2xl border-2 px-1.5 py-3 text-center transition active:scale-[.96] ${
                            active ? 'border-love-500 bg-love-50' : 'border-love-100 bg-white'
                          }`}
                        >
                          <span className="text-[20px] leading-none">{audience.emoji}</span>
                          <span className="text-[11.5px] font-extrabold leading-tight text-love-900">
                            {audience.label}
                          </span>
                          <span className="rounded-full bg-love-500/10 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-love-600">
                            {audience.badge}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-love-900/55">
                    <Info className="mt-0.5 h-3 w-3 shrink-0 text-love-400" />
                    {activeAudience.hint}. Bấm để dùng ngay — bấm lại vào cùng một nút để đổi sang câu khác.
                  </p>

                  {/* Loi chuc */}
                  <div className="mt-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[12px] font-bold text-love-900">Lời chúc của bạn</span>
                      <span className="text-[11px] text-love-900/45">{message.length}/1500</span>
                    </div>
                    <textarea
                      value={message}
                      onChange={(event) => setMessage(event.target.value.slice(0, 1500))}
                      rows={4}
                      placeholder="Viết điều bạn muốn nói với người ấy..."
                      className="w-full resize-none rounded-xl border border-love-200 bg-love-50/40 px-3.5 py-3 text-[14px] leading-relaxed text-love-900 outline-none transition placeholder:text-love-900/35 focus:border-love-400 focus:bg-white focus:ring-2 focus:ring-love-200"
                    />
                  </div>

                  <div className="mt-2 space-y-1.5">
                    <p className="text-[11px] font-semibold text-love-900/50">
                      Kho lời chúc cho “{activeAudience.label}” — bấm để dùng:
                    </p>
                    {activeAudience.wishes.map((wish, index) => (
                      <button
                        key={`wish-${activeAudience.id}-${index}`}
                        type="button"
                        onClick={() => setMessage(wish)}
                        className="block w-full rounded-xl border border-love-100 bg-love-50/60 px-3 py-2.5 text-left text-[12px] leading-relaxed text-love-900/75 transition hover:border-love-300 hover:bg-love-50 active:scale-[.99]"
                      >
                        {wish}
                      </button>
                    ))}
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
                            <span className="block truncate text-[13px] font-bold text-love-900">
                              {track.name}
                            </span>
                            <span className="block text-[11px] text-love-900/50">{track.mood}</span>
                          </span>
                          {selected && <CheckCircle2 className="h-5 w-5 shrink-0 text-love-500" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Anh ky niem + chu thich tung anh */}
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
                    <>
                      <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-love-900/50">
                        <PenLine className="h-3 w-3 shrink-0 text-love-400" />
                        Chú thích cho từng ảnh (không bắt buộc, nhưng sẽ làm món quà “thật” hơn rất nhiều)
                      </p>
                      <div className="mt-2 space-y-2">
                        {photoItems.map((item, index) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-2.5 rounded-2xl border border-love-100 bg-white p-2"
                          >
                            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-love-50">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={item.url}
                                alt={`Ảnh ${index + 1}`}
                                className="h-full w-full object-cover"
                              />
                              <span className="absolute left-0 top-0 rounded-br-lg bg-black/55 px-1.5 py-0.5 text-[9px] font-bold text-white">
                                {index + 1}
                              </span>
                            </div>
                            <input
                              type="text"
                              value={item.caption}
                              maxLength={MAX_CAPTION_LENGTH}
                              onChange={(event) => updateCaption(item.id, event.target.value)}
                              placeholder="VD: Ngày đầu tiên mình đi chơi chung 🌸"
                              className="min-w-0 flex-1 rounded-xl border border-love-200 bg-love-50/40 px-3 py-2.5 text-[12.5px] text-love-900 outline-none transition placeholder:text-love-900/35 focus:border-love-400 focus:bg-white focus:ring-2 focus:ring-love-200"
                            />
                            <button
                              type="button"
                              onClick={() => removePhoto(item.id)}
                              aria-label={`Xoá ảnh ${index + 1}`}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-love-50 text-love-500 transition active:scale-90"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* BUOC 3 - TUONG TAC                                             */}
            {/* ============================================================== */}
            {step === 3 && (
              <div className="mt-4 space-y-3">
                <p className="text-[12.5px] leading-relaxed text-love-900/65">
                  Đây là phần khiến người ấy phải “ừ à” rồi bấm thử. Bạn có thể tắt bất kỳ mục nào — không bắt
                  buộc dùng hết.
                </p>

                {/* -------- MAT KHAU -------- */}
                <SettingCard
                  icon={KeyRound}
                  title="Khoá mật khẩu 4 chữ số"
                  desc="Người ấy phải nhập đúng mật khẩu mới mở được món quà."
                  right={
                    <Switch checked={passcodeEnabled} onChange={setPasscodeEnabled} label="Bật khoá mật khẩu" />
                  }
                >
                  <PasscodeField value={passcode} onChange={setPasscode} disabled={!passcodeEnabled} />

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={!passcodeEnabled}
                      onClick={() => setPasscode(SAMPLE_PASSCODE)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-love-200 bg-white px-3 py-2.5 text-[11.5px] font-bold text-love-600 transition active:scale-95 disabled:opacity-40"
                    >
                      <Star className="h-3.5 w-3.5" fill="currentColor" />
                      Dùng 2010
                    </button>
                    <button
                      type="button"
                      disabled={!passcodeEnabled}
                      onClick={randomizePasscode}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-love-200 bg-white px-3 py-2.5 text-[11.5px] font-bold text-love-600 transition active:scale-95 disabled:opacity-40"
                    >
                      <Dice5 className="h-3.5 w-3.5" />
                      Số ngẫu nhiên
                    </button>
                  </div>

                  <div className="mt-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[11.5px] font-bold text-love-900">Câu gợi ý</span>
                      <span className="text-[10.5px] text-love-900/45">
                        {passcodeHint.length}/{MAX_PASSCODE_HINT_LENGTH}
                      </span>
                    </div>
                    <input
                      type="text"
                      value={passcodeHint}
                      maxLength={MAX_PASSCODE_HINT_LENGTH}
                      disabled={!passcodeEnabled}
                      onChange={(event) => setPasscodeHint(event.target.value)}
                      placeholder="VD: Gợi ý: năm chúng mình gặp nhau 🥰"
                      className="w-full rounded-xl border border-love-200 bg-white px-3.5 py-2.5 text-[12.5px] text-love-900 outline-none transition placeholder:text-love-900/35 focus:border-love-400 focus:ring-2 focus:ring-love-200 disabled:opacity-50"
                    />
                    {passcodeEnabled && !passcodeHint.trim() && (
                      <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-700">
                        <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                        Nên thêm một câu gợi ý, nếu không người ấy sẽ phải thử mò 4 chữ số.
                      </p>
                    )}
                  </div>
                </SettingCard>

                {/* -------- THE CAO BI MAT -------- */}
                <SettingCard
                  icon={Sparkles}
                  title="Thẻ cào lộ bí mật"
                  desc="Một lời nhắn ẩn dưới lớp bạc — người ấy phải tự tay cào mới đọc được."
                  right={
                    <Switch checked={scratchEnabled} onChange={setScratchEnabled} label="Bật thẻ cào bí mật" />
                  }
                >
                  <textarea
                    value={scratchMessage}
                    rows={3}
                    maxLength={MAX_SCRATCH_LENGTH}
                    disabled={!scratchEnabled}
                    onChange={(event) => setScratchMessage(event.target.value.slice(0, MAX_SCRATCH_LENGTH))}
                    placeholder="VD: Bí mật nè: anh đã đặt sẵn bàn ở quán cũ, 7 giờ tối nay nhé!"
                    className="w-full resize-none rounded-xl border border-love-200 bg-white px-3.5 py-2.5 text-[12.5px] leading-relaxed text-love-900 outline-none transition placeholder:text-love-900/35 focus:border-love-400 focus:ring-2 focus:ring-love-200 disabled:opacity-50"
                  />
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[10.5px] text-love-900/45">
                      {scratchMessage.length}/{MAX_SCRATCH_LENGTH}
                    </span>
                  </div>

                  <p className="mt-2 text-[11px] font-semibold text-love-900/50">Gợi ý nhanh:</p>
                  <div className="mt-1.5 space-y-1.5">
                    {SCRATCH_SUGGESTIONS.map((suggestion, index) => (
                      <button
                        key={`scratch-${index}`}
                        type="button"
                        disabled={!scratchEnabled}
                        onClick={() => setScratchMessage(suggestion)}
                        className="block w-full rounded-xl border border-love-100 bg-white px-3 py-2 text-left text-[11.5px] leading-relaxed text-love-900/75 transition hover:border-love-300 hover:bg-love-50 active:scale-[.99] disabled:opacity-50"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </SettingCard>

                {/* -------- VE DAC QUYEN -------- */}
                <SettingCard
                  icon={Ticket}
                  title="Vé đặc quyền"
                  desc="Những “lời hứa” người ấy có thể đòi bạn thực hiện. Bấm để chọn nhanh."
                  right={
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10.5px] font-extrabold ${
                        couponsFull ? 'bg-amber-100 text-amber-700' : 'bg-love-100 text-love-600'
                      }`}
                    >
                      {coupons.length}/{MAX_COUPONS}
                    </span>
                  }
                >
                  <div className="flex flex-wrap gap-1.5">
                    {COUPON_SUGGESTIONS.map((suggestion) => {
                      const picked = coupons.includes(suggestion);
                      return (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => toggleCoupon(suggestion)}
                          className={`rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition active:scale-95 ${
                            picked
                              ? 'border-love-500 bg-love-500 text-white'
                              : 'border-love-200 bg-white text-love-600'
                          }`}
                        >
                          {picked ? '✓ ' : '+ '}
                          {suggestion}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={couponDraft}
                      maxLength={MAX_COUPON_LENGTH}
                      onChange={(event) => setCouponDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          addCustomCoupon();
                        }
                      }}
                      placeholder="Tự viết một vé đặc quyền của riêng bạn..."
                      className="min-w-0 flex-1 rounded-xl border border-love-200 bg-white px-3.5 py-2.5 text-[12.5px] text-love-900 outline-none transition placeholder:text-love-900/35 focus:border-love-400 focus:ring-2 focus:ring-love-200"
                    />
                    <button
                      type="button"
                      onClick={addCustomCoupon}
                      className="shrink-0 rounded-xl border border-love-200 bg-white px-3.5 py-2.5 text-[12.5px] font-bold text-love-600 transition active:scale-95"
                    >
                      Thêm
                    </button>
                  </div>

                  {coupons.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      <p className="text-[11px] font-semibold text-love-900/50">Đã chọn:</p>
                      {coupons.map((coupon) => (
                        <div
                          key={coupon}
                          className="flex items-center gap-2 rounded-xl border border-dashed border-love-300 bg-white px-3 py-2"
                        >
                          <Ticket className="h-3.5 w-3.5 shrink-0 text-love-400" />
                          <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-love-900/80">
                            {coupon}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleCoupon(coupon)}
                            aria-label={`Bỏ vé ${coupon}`}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-love-50 text-love-500 transition active:scale-90"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </SettingCard>
              </div>
            )}

            {/* ============================================================== */}
            {/* BUOC 4 - XEM THU & MO KHOA                                     */}
            {/* ============================================================== */}
            {step === 4 && (
              <div className="mt-4">
                <div className="rounded-2xl border border-love-100 bg-love-50/40 p-4">
                  <p className="text-[12px] font-bold uppercase tracking-wider text-love-900/50">
                    Tóm tắt món quà
                  </p>

                  <div className="mt-3 flex items-center gap-3 rounded-2xl border border-love-100 bg-white p-3">
                    <span className="text-[28px] leading-none">{templateMeta.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-extrabold leading-tight text-love-900">
                        {templateMeta.name}
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-love-900/55">
                        {TEMPLATE_BADGES[templateStyle]} • {templateMeta.tagline}
                      </p>
                    </div>
                  </div>

                  <dl className="mt-3 space-y-1.5">
                    <SummaryRow label="Người nhận" value={receiverName.trim() || '—'} />
                    <SummaryRow label="Người gửi" value={senderName.trim() || '—'} />
                    <SummaryRow label="Ảnh kỷ niệm" value={`${photoItems.length} ảnh`} />
                    <SummaryRow
                      label="Chú thích ảnh"
                      value={`${photoItems.filter((item) => item.caption.trim()).length}/${photoItems.length} ảnh có chú thích`}
                    />
                    <SummaryRow
                      label="Khoá mật khẩu"
                      value={hasPasscodeConfigured ? `Bật • ${passcode}` : 'Tắt'}
                    />
                    <SummaryRow
                      label="Thẻ cào bí mật"
                      value={scratchEnabled && scratchMessage.trim() ? 'Bật' : 'Tắt'}
                    />
                    <SummaryRow label="Vé đặc quyền" value={`${coupons.length} vé`} />
                    <SummaryRow label="Chủ đề màu" value={THEME_LIST.find((t) => t.id === themeId)?.name ?? '—'} />
                  </dl>
                </div>

                <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-love-100 bg-white p-3.5">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-love-100 text-love-600">
                    <Eye className="h-4 w-4" />
                  </span>
                  <p className="text-[11.5px] leading-relaxed text-love-900/65">
                    Bản xem thử dùng <strong>đúng ảnh, đúng lời chúc và đúng các module tương tác</strong> của
                    bạn. Bạn có thể tự nhập mật khẩu, tự cào thẻ và tự xé túi mù y như người ấy.
                  </p>
                </div>

                {/* Quyen loi khi mo khoa */}
                <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3.5">
                  <p className="flex items-center gap-1.5 text-[12px] font-extrabold text-emerald-800">
                    <LockOpen className="h-3.5 w-3.5" />
                    Mở khoá sẽ nhận được
                  </p>
                  <ul className="mt-2.5 space-y-2">
                    {UNLOCK_BENEFITS.map((benefit) => (
                      <li key={benefit} className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                          <Check className="h-2.5 w-2.5 text-emerald-700" />
                        </span>
                        <span className="text-[12px] leading-relaxed text-emerald-900/80">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={startPayment}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-love-200 bg-white px-5 py-3.5 text-[13.5px] font-extrabold text-love-600 transition active:scale-[.98]"
                >
                  <Lock className="h-4 w-4" />
                  Mở khoá vĩnh viễn — {formatVnd(PRICE_VND)}
                </button>
              </div>
            )}

            {/* ------------------------- LOI ------------------------- */}
            {formError && (
              <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                <p className="text-[12.5px] font-medium leading-relaxed text-rose-700">{formError}</p>
              </div>
            )}

            {/* ------------------------- DIEU HUONG ------------------------- */}
            <div className="mt-5 flex gap-2">
              {step > 1 && (
                <button
                  type="button"
                  onClick={goBack}
                  className="flex items-center justify-center gap-1.5 rounded-2xl border-2 border-love-200 bg-white px-4 py-4 text-[13.5px] font-bold text-love-600 transition active:scale-[.98]"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Quay lại
                </button>
              )}

              {step < 4 ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-love-500 to-love-600 px-6 py-4 text-[15px] font-extrabold text-white shadow-[0_16px_34px_-14px_rgba(237,30,100,.8)] transition active:scale-[.98]"
                >
                  Tiếp tục
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={openPreview}
                  disabled={uploadingPreview}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-love-500 to-love-600 px-6 py-4 text-[15px] font-extrabold text-white shadow-[0_16px_34px_-14px_rgba(237,30,100,.8)] transition active:scale-[.98] disabled:opacity-70"
                >
                  {uploadingPreview ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Đang chuẩn bị...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5" />
                      Xem Thử Toàn Bộ
                    </>
                  )}
                </button>
              )}
            </div>

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
                  'Trọn bộ 4 vũ trụ: khoá mật khẩu, thẻ cào, bẫy tình yêu, túi mù',
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
      {/* LOP PHU XEM THU 4 VU TRU                                             */}
      {/* ==================================================================== */}
      {demoStyle && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-black">
          <div className="relative flex-1 overflow-hidden">
            <Gift3DViewer
              key={`demo-${demoStyle}-${demoPasscode ? 'locked' : 'open'}-${demoKey}`}
              receiverName="Mai Anh"
              senderName="Minh Quân"
              message={SAMPLE_GIFT.message}
              photos={SAMPLE_PHOTOS}
              themeId="pastel-pink"
              musicId="romantic-piano"
              templateStyle={demoStyle}
              passcode={demoPasscode ? SAMPLE_PASSCODE : undefined}
              passcodeHint={demoPasscode ? SAMPLE_PASSCODE_HINT : undefined}
              scratchMessage={SAMPLE_SCRATCH_MESSAGE}
              coupons={SAMPLE_COUPONS}
              photoCaptions={SAMPLE_CAPTIONS}
              isPreview
            />

            <button
              type="button"
              onClick={closeDemo}
              aria-label="Đóng xem thử"
              className="absolute left-3 top-3 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition active:scale-90"
            >
              <X className="h-5 w-5" />
            </button>

            <span className="absolute left-1/2 top-4 z-40 max-w-[52%] -translate-x-1/2 truncate rounded-full bg-black/45 px-3 py-1.5 text-[10.5px] font-bold text-white backdrop-blur">
              {TEMPLATE_META[demoStyle].emoji} {TEMPLATE_META[demoStyle].name}
            </span>
          </div>

          <div className="shrink-0 border-t border-white/10 bg-[#150f18] px-3 pb-4 pt-3">
            <div className="mx-auto max-w-lg">
              {/* Chuyen nhanh giua 4 vu tru */}
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {TEMPLATE_LIST.map((template) => {
                  const active = template.id === demoStyle;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => switchDemoStyle(template.id)}
                      className={`rounded-full px-2.5 py-1.5 text-[10.5px] font-bold transition active:scale-95 ${
                        active ? 'bg-white text-slate-900' : 'bg-white/12 text-white'
                      }`}
                    >
                      {template.emoji} {TEMPLATE_BADGES[template.id]}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setDemoPasscode((value) => !value);
                    setDemoKey((key) => key + 1);
                  }}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[10.5px] font-bold transition active:scale-95 ${
                    demoPasscode ? 'bg-love-500 text-white' : 'bg-white/12 text-white'
                  }`}
                >
                  <KeyRound className="h-3 w-3" />
                  {demoPasscode ? 'Đang bật mật mã' : 'Thử mật mã'}
                </button>
              </div>

              <p className="mt-2.5 text-center text-[11px] leading-relaxed text-white/55">
                {demoPasscode
                  ? `Nhập mật khẩu ${SAMPLE_PASSCODE} để mở. Đây là bản demo, bạn cứ bấm thoải mái.`
                  : 'Đây là bản demo với dữ liệu mẫu. Bấm “Tạo quà kiểu này” để dùng chính ảnh của bạn.'}
              </p>

              <button
                type="button"
                onClick={() => applyDemoStyle(demoStyle)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-love-500 to-love-600 px-6 py-3.5 text-[14px] font-extrabold text-white shadow-[0_16px_34px_-14px_rgba(237,30,100,.9)] transition active:scale-[.98]"
              >
                <Sparkles className="h-4 w-4" />
                Tạo quà kiểu này
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL XEM THU TOAN BO                                                */}
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
              templateStyle={templateStyle}
              passcode={passcodeEnabled ? passcode : undefined}
              passcodeHint={passcodeEnabled ? passcodeHint : undefined}
              scratchMessage={scratchEnabled ? scratchMessage : undefined}
              coupons={coupons}
              photoCaptions={photoItems.map((item) => item.caption)}
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

            <span className="absolute left-1/2 top-4 z-40 max-w-[52%] -translate-x-1/2 truncate rounded-full bg-black/45 px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-white backdrop-blur">
              Chế độ xem thử
            </span>
          </div>

          {/* Bang noi */}
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

              {hasPasscodeConfigured && (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
                  <KeyRound className="h-3.5 w-3.5 shrink-0 text-love-300" />
                  <p className="text-[11.5px] text-white/70">
                    Mật khẩu xem thử của bạn: <strong className="tracking-widest text-white">{passcode}</strong>
                  </p>
                </div>
              )}

              <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {UNLOCK_BENEFITS.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    <span className="text-[11.5px] leading-snug text-white/70">{benefit}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={startPayment}
                className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-love-500 to-love-600 px-6 py-4 text-[15px] font-extrabold text-white shadow-[0_16px_34px_-14px_rgba(237,30,100,.9)] transition active:scale-[.98]"
              >
                <Lock className="h-4 w-4" />
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
                      <span className="text-[12.5px] font-bold uppercase text-love-900">
                        {BANK_ACCOUNT_NAME}
                      </span>
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
                        {copiedKey === 'transfer' ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        {copiedKey === 'transfer' ? 'Đã chép' : 'Chép'}
                      </button>
                    </div>
                  </div>

                  {/* Quyen loi khi mo khoa */}
                  <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3.5">
                    <p className="flex items-center gap-1.5 text-[12px] font-extrabold text-emerald-800">
                      <LockOpen className="h-3.5 w-3.5" />
                      Sau khi chuyển khoản, bạn nhận được
                    </p>
                    <ul className="mt-2.5 space-y-2">
                      {UNLOCK_BENEFITS.map((benefit) => (
                        <li key={benefit} className="flex items-start gap-2.5">
                          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                            <Check className="h-2.5 w-2.5 text-emerald-700" />
                          </span>
                          <span className="text-[12px] leading-relaxed text-emerald-900/80">{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <p className="text-[12px] leading-relaxed text-amber-800">
                      Nhập <strong>đúng nội dung chuyển khoản</strong> ở trên. Hệ thống tự động kiểm tra mỗi 3
                      giây và mở khoá ngay khi nhận được tiền.
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
                    Đừng lo — mã chuyển khoản <strong>{draft.transfer_code}</strong> vẫn còn hiệu lực. Bấm bên
                    dưới để hiển thị lại mã QR và tiếp tục kiểm tra tự động.
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

// ============================================================================
// COMPONENT PHU
// ============================================================================

/** Mot dong tom tat trong buoc 4 */
function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl bg-white px-3 py-2">
      <dt className="shrink-0 text-[11.5px] text-love-900/55">{label}</dt>
      <dd className="min-w-0 text-right text-[12px] font-bold text-love-900">{value}</dd>
    </div>
  );
}

