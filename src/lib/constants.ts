// ============================================================================
// LoveBox 3D - hang so dung chung: chu de mau, nhac nen, goi y loi chuc
// ============================================================================

export type ThemeId = 'pastel-pink' | 'starry-night' | 'warm-sunset';

export interface GiftTheme {
  id: ThemeId;
  name: string;
  emoji: string;
  tagline: string;
  /** Mau xem truoc tren nut chon chu de */
  swatch: [string, string, string];
  /** CSS custom properties ap vao root cua khung qua tang */
  vars: Record<string, string>;
}

export const THEMES: Record<ThemeId, GiftTheme> = {
  'pastel-pink': {
    id: 'pastel-pink',
    name: 'Hồng Pastel',
    emoji: '🌸',
    tagline: 'Dịu dàng, ngọt ngào, nữ tính',
    swatch: ['#ffd9e6', '#ff9dbf', '#fff4f8'],
    vars: {
      '--lb-bg-1': '#fff5f9',
      '--lb-bg-2': '#ffd9e8',
      '--lb-bg-3': '#ffeaf3',
      '--lb-accent': '#ff3d7f',
      '--lb-accent-soft': '#ff8fb6',
      '--lb-accent-glow': 'rgba(255, 61, 127, 0.35)',
      '--lb-text': '#5c1733',
      '--lb-text-soft': 'rgba(92, 23, 51, 0.68)',
      '--lb-card': 'rgba(255, 255, 255, 0.78)',
      '--lb-card-border': 'rgba(255, 61, 127, 0.22)',
      '--lb-envelope': '#fff1f6',
      '--lb-envelope-dark': '#ffd0e2',
      '--lb-seal': '#ff3d7f',
      '--lb-particle-1': '#ff5c8a',
      '--lb-particle-2': '#ffb3cd',
      '--lb-particle-3': '#ffd9a0'
    }
  },
  'starry-night': {
    id: 'starry-night',
    name: 'Đêm Sao Lấp Lánh',
    emoji: '🌌',
    tagline: 'Huyền bí, sâu lắng, sang trọng',
    swatch: ['#141a3d', '#8ab4ff', '#f0f4ff'],
    vars: {
      '--lb-bg-1': '#05061a',
      '--lb-bg-2': '#141c46',
      '--lb-bg-3': '#2a1a5e',
      '--lb-accent': '#8ab4ff',
      '--lb-accent-soft': '#c3d5ff',
      '--lb-accent-glow': 'rgba(138, 180, 255, 0.4)',
      '--lb-text': '#eef3ff',
      '--lb-text-soft': 'rgba(238, 243, 255, 0.72)',
      '--lb-card': 'rgba(18, 24, 58, 0.72)',
      '--lb-card-border': 'rgba(138, 180, 255, 0.32)',
      '--lb-envelope': '#1b2352',
      '--lb-envelope-dark': '#111741',
      '--lb-seal': '#ffd166',
      '--lb-particle-1': '#ffe9a8',
      '--lb-particle-2': '#9dc0ff',
      '--lb-particle-3': '#ffffff'
    }
  },
  'warm-sunset': {
    id: 'warm-sunset',
    name: 'Hoàng Hôn Ấm Áp',
    emoji: '🌇',
    tagline: 'Ấm nồng, cháy bỏng, lãng mạn',
    swatch: ['#7a2f14', '#ff9a52', '#ffe2c4'],
    vars: {
      '--lb-bg-1': '#3a1206',
      '--lb-bg-2': '#8a3616',
      '--lb-bg-3': '#ff9a52',
      '--lb-accent': '#ffb066',
      '--lb-accent-soft': '#ffd0a0',
      '--lb-accent-glow': 'rgba(255, 176, 102, 0.4)',
      '--lb-text': '#fff6ec',
      '--lb-text-soft': 'rgba(255, 246, 236, 0.76)',
      '--lb-card': 'rgba(58, 18, 6, 0.6)',
      '--lb-card-border': 'rgba(255, 176, 102, 0.34)',
      '--lb-envelope': '#fff0e0',
      '--lb-envelope-dark': '#ffd9b8',
      '--lb-seal': '#ff7a45',
      '--lb-particle-1': '#ffb066',
      '--lb-particle-2': '#ffe0b8',
      '--lb-particle-3': '#ff8a5c'
    }
  }
};

export const THEME_LIST: GiftTheme[] = [THEMES['pastel-pink'], THEMES['starry-night'], THEMES['warm-sunset']];

export const DEFAULT_THEME_ID: ThemeId = 'pastel-pink';

export function getTheme(id: string | undefined | null): GiftTheme {
  if (id && id in THEMES) return THEMES[id as ThemeId];
  return THEMES[DEFAULT_THEME_ID];
}

// ----------------------------------------------------------------------------
// NHAC NEN
// `src` tro toi file trong /public/music. Neu file chua ton tai, trinh duyet
// se bao loi va player tu dong chuyen sang `fallback` (link CDN cong khai).
// ----------------------------------------------------------------------------
export interface MusicTrack {
  id: string;
  name: string;
  mood: string;
  src: string;
  fallback: string;
}

export const MUSIC_TRACKS: MusicTrack[] = [
  {
    id: 'romantic-piano',
    name: 'Piano Lãng Mạn',
    mood: 'Dịu dàng • Sâu lắng',
    src: '/music/romantic-piano.mp3',
    fallback: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
  },
  {
    id: 'music-box',
    name: 'Nhạc Hộp Yêu Thương',
    mood: 'Trong trẻo • Ngọt ngào',
    src: '/music/music-box.mp3',
    fallback: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3'
  },
  {
    id: 'sunset-guitar',
    name: 'Giai Điệu Hoàng Hôn',
    mood: 'Ấm áp • Thư giãn',
    src: '/music/sunset-guitar.mp3',
    fallback: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'
  }
];

export const DEFAULT_MUSIC_ID = 'romantic-piano';

export function getMusicTrack(id: string | undefined | null): MusicTrack {
  const found = MUSIC_TRACKS.find((track) => track.id === id);
  return found ?? MUSIC_TRACKS[0];
}

// ----------------------------------------------------------------------------
// GOI Y LOI CHUC
// ----------------------------------------------------------------------------
export interface WishTab {
  id: string;
  label: string;
}

export const WISH_TABS: WishTab[] = [
  { id: 'women-day', label: 'Chúc 20/10' },
  { id: 'anniversary', label: 'Kỷ niệm yêu' },
  { id: 'birthday', label: 'Sinh nhật' }
];

export const WISH_SUGGESTIONS: Record<string, string[]> = {
  'women-day': [
    'Nhân ngày 20/10, anh chúc em luôn xinh đẹp, rạng rỡ và hạnh phúc. Cảm ơn em đã đến và làm cho cuộc sống của anh trở nên dịu dàng hơn mỗi ngày. Yêu em rất nhiều!',
    'Chúc mừng ngày Phụ nữ Việt Nam 20/10! Mong em luôn là cô gái được yêu thương, được chiều chuộng và luôn nở nụ cười thật tươi. Em là điều tuyệt vời nhất anh từng có.',
    '20/10 này, anh không có món quà gì to tát, chỉ có một trái tim luôn hướng về em. Chúc em thật nhiều sức khỏe, thật nhiều niềm vui và mãi là người phụ nữ tuyệt vời nhất.',
    'Gửi em yêu dấu, chúc em một ngày 20/10 ngập tràn hoa và nắng. Cảm ơn em vì đã kiên nhẫn, vì đã yêu thương và vì đã ở đây cùng anh.'
  ],
  anniversary: [
    'Chúc mừng kỷ niệm của chúng ta! Cảm ơn em vì đã cùng anh đi qua những ngày nắng đẹp và cả những ngày mưa dài. Mong chúng ta sẽ còn nắm tay nhau thật lâu nữa.',
    'Một năm nữa lại qua, và anh vẫn thấy mình là người may mắn nhất vì được yêu em. Chúc mừng kỷ niệm tình yêu của chúng ta!',
    'Có những ngày thật bình thường, nhưng vì có em mà trở thành ngày đáng nhớ. Cảm ơn em đã là nhà của anh. Yêu em!',
    'Gửi em, người anh chọn cho cả tương lai. Chúc mừng kỷ niệm của chúng ta, và mong mọi chặng đường phía trước đều có em.'
  ],
  birthday: [
    'Chúc mừng sinh nhật em! Chúc em tuổi mới thật nhiều sức khỏe, nhiều niềm vui và mọi điều em mong ước đều thành hiện thực. Anh yêu em!',
    'Happy Birthday em yêu! Cảm ơn em đã đến và làm cho thế giới của anh trở nên ấm áp hơn. Tuổi mới rực rỡ nhé em!',
    'Sinh nhật này anh không cần gì nhiều, chỉ cần em luôn vui vẻ và khỏe mạnh. Chúc em một tuổi mới thật hạnh phúc, em nhé!'
  ]
};

// ----------------------------------------------------------------------------
// KIEU TRINH DIEN MON QUA (V2 - Interactive Gift Engine)
// Dat o day (module thuan, khong 'use client') de ca Server Component
// nhu /g/[slug]/page.tsx dung duoc ma khong vuong ranh gioi client.
// ----------------------------------------------------------------------------
export type TemplateStyle = 'galaxy-3d' | 'polaroid-vinyl' | 'sweet-trap' | 'blindbox-2010';

export interface TemplateMeta {
  id: TemplateStyle;
  name: string;
  emoji: string;
  tagline: string;
}

export const TEMPLATE_META: Record<TemplateStyle, TemplateMeta> = {
  'galaxy-3d': {
    id: 'galaxy-3d',
    name: 'Tinh Cầu Kỷ Niệm 3D',
    emoji: '🌌',
    tagline: 'Vòng xoay ảnh 3D giữa bầu trời sao'
  },
  'polaroid-vinyl': {
    id: 'polaroid-vinyl',
    name: 'Đĩa Than & Polaroid',
    emoji: '🎞️',
    tagline: 'Nhạc xoay, ảnh phim hoài cổ'
  },
  'sweet-trap': {
    id: 'sweet-trap',
    name: 'Bẫy Tình Yêu',
    emoji: '💘',
    tagline: 'Mini-game nút từ chối chạy trốn'
  },
  'blindbox-2010': {
    id: 'blindbox-2010',
    name: 'Túi Mù Bí Ẩn',
    emoji: '🎁',
    tagline: 'Tự tay xé túi mù để mở ảnh'
  }
};

export const TEMPLATE_LIST: TemplateMeta[] = [
  TEMPLATE_META['galaxy-3d'],
  TEMPLATE_META['polaroid-vinyl'],
  TEMPLATE_META['sweet-trap'],
  TEMPLATE_META['blindbox-2010']
];

export const DEFAULT_TEMPLATE_STYLE: TemplateStyle = 'galaxy-3d';

export function isTemplateStyle(value: unknown): value is TemplateStyle {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(TEMPLATE_META, value);
}

export function getTemplateMeta(value: string | undefined | null): TemplateMeta {
  return isTemplateStyle(value) ? TEMPLATE_META[value] : TEMPLATE_META[DEFAULT_TEMPLATE_STYLE];
}

/** Nhan marketing ngan hien tren nut xem thu o Hero */
export const TEMPLATE_BADGES: Record<TemplateStyle, string> = {
  'galaxy-3d': 'Lãng mạn',
  'polaroid-vinyl': 'Hoài cổ',
  'sweet-trap': 'Cưa Crush',
  'blindbox-2010': 'HOT 20/10'
};

// ----------------------------------------------------------------------------
// DU LIEU MAU CHO CAC MODULE V2 (dien san vao form de xem thu ngay)
// ----------------------------------------------------------------------------
export const SAMPLE_PASSCODE = '2010';
export const SAMPLE_PASSCODE_HINT = 'Gợi ý: năm chúng mình gặp nhau 🥰';

export const SAMPLE_SCRATCH_MESSAGE =
  'Bí mật nè: anh đã đặt sẵn bàn ở quán cũ, 7 giờ tối nay nhé. Mặc chiếc váy hôm đó em nhé! 💕';

export const SAMPLE_COUPONS: string[] = [
  '1 Chầu Trà Sữa Full Topping 🧋',
  '1 Buổi Đi Xem Phim Tự Chọn 🍿',
  'Đặc Quyền Sai Không Bị Giận 1 Lần 🎟️',
  '1 Ngày Được Chiều Chuộng Không Cần Lý Do 🛋️'
];

export const SAMPLE_CAPTIONS: string[] = [
  'Ngày đầu tiên mình đi chơi chung 🌸',
  'Chuyến đi Đà Lạt nhớ mãi ☁️',
  'Sinh nhật em năm ngoái 🎂',
  'Buổi tối dạo biển thật yên bình 🌊',
  'Cà phê chiều mưa ☕',
  'Lần đầu em nấu cho anh ăn 🍜'
];

// ----------------------------------------------------------------------------
// GIOI HAN ANH
// ----------------------------------------------------------------------------
export const MIN_PHOTOS = 4;
export const MAX_PHOTOS = 8;

// ----------------------------------------------------------------------------
// CAU HINH MO RONG CUA MON QUA (V2)
// Toan bo cau hinh nay luu trong MOT cot `config` kieu JSONB tren Supabase.
// Ly do chon JSONB thay vi them nhieu cot: sau nay them tuy chon moi (am thanh,
// hieu ung, font chu...) chi can sua code, KHONG phai chay ALTER TABLE nua.
// ----------------------------------------------------------------------------
export interface GiftConfig {
  /** Kieu trinh dien */
  template: TemplateStyle;
  /** Mat khau 4 chu so. Chuoi rong = khong khoa */
  passcode: string;
  /** Cau goi y hien duoi ban phim so */
  passcodeHint: string;
  /** Loi nhan bi mat an duoi the cao */
  scratchMessage: string;
  /** Danh sach ve dac quyen */
  coupons: string[];
  /** Chu thich cho tung anh, khop theo thu tu mang photos */
  captions: string[];
}

export const MAX_COUPONS = 8;
export const MAX_COUPON_LENGTH = 80;
export const MAX_CAPTION_LENGTH = 60;
export const MAX_SCRATCH_LENGTH = 240;
export const MAX_PASSCODE_HINT_LENGTH = 80;

export const DEFAULT_GIFT_CONFIG: GiftConfig = {
  template: DEFAULT_TEMPLATE_STYLE,
  passcode: '',
  passcodeHint: '',
  scratchMessage: '',
  coupons: [],
  captions: []
};

/** Bo ky tu dieu khien + gop khoang trang, giu nguyen xuong dong */
function cleanMultiline(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
}

/** Bo ky tu dieu khien + gop moi khoang trang thanh 1 dau cach */
function cleanSingleLine(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function cleanStringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, maxItems)
    .map((item) => cleanSingleLine(item, maxLength))
    .filter((item) => item.length > 0);
}

/**
 * Giong `cleanStringArray` nhung GIU NGUYEN VI TRI (khong bo phan tu rong).
 *
 * Dung cho `captions`: chu thich duoc gan theo CHI SO anh (captions[0] la chu
 * thich cua photos[0]). Neu bo di phan tu rong thi moi chu thich phia sau se
 * bi lech sang anh khac. Vi vay phan tu rong phai duoc giu lai nhu mot cho
 * trong de bao toan dung thu tu.
 */
function cleanAlignedArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const limit = Math.min(value.length, maxItems);
  for (let index = 0; index < limit; index += 1) {
    out.push(cleanSingleLine(value[index], maxLength));
  }
  return out;
}

/**
 * Chuan hoa du lieu `config` tho (tu JSONB, tu body API, hay tu form) thanh
 * GiftConfig an toan. Dung o CA HAI phia: client truoc khi gui, va server
 * truoc khi ghi/duyet. Nho vay du lieu rac khong bao gio vao database.
 */
export function normalizeGiftConfig(raw: unknown): GiftConfig {
  const source =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};

  const passcodeRaw = typeof source.passcode === 'string' ? source.passcode.trim() : '';

  return {
    template: isTemplateStyle(source.template) ? source.template : DEFAULT_TEMPLATE_STYLE,
    passcode: /^\d{4}$/.test(passcodeRaw) ? passcodeRaw : '',
    passcodeHint: cleanSingleLine(source.passcodeHint, MAX_PASSCODE_HINT_LENGTH),
    scratchMessage: cleanMultiline(source.scratchMessage, MAX_SCRATCH_LENGTH),
    coupons: cleanStringArray(source.coupons, MAX_COUPONS, MAX_COUPON_LENGTH),
    captions: cleanAlignedArray(source.captions, MAX_PHOTOS, MAX_CAPTION_LENGTH)
  };
}

/** Config nay co bat ky tuy chon tuong tac nao khong? */
export function hasInteractiveConfig(config: GiftConfig): boolean {
  return Boolean(config.passcode || config.scratchMessage || config.coupons.length > 0);
}

// ----------------------------------------------------------------------------
// KHO GOI Y 1-CLICK THEO DOI TUONG NGUOI NHAN
// ----------------------------------------------------------------------------
export interface WishAudience {
  id: 'lover' | 'crush' | 'family';
  label: string;
  emoji: string;
  badge: string;
  hint: string;
  wishes: string[];
}

export const WISH_AUDIENCES: WishAudience[] = [
  {
    id: 'lover',
    label: 'Người yêu',
    emoji: '💕',
    badge: 'HOT 20/10',
    hint: 'Ngọt ngào, sâu lắng, dành cho người đang yêu',
    wishes: [
      'Nhân ngày 20/10, anh chúc em luôn xinh đẹp, rạng rỡ và bình yên. Cảm ơn em đã đến và biến những ngày bình thường nhất của anh thành những ngày đáng nhớ. Yêu em rất nhiều!',
      '20/10 này anh không có gì to tát, chỉ có một trái tim luôn hướng về em và một lời hứa sẽ cố gắng mỗi ngày để em được vui. Chúc em thật nhiều sức khỏe và luôn cười thật tươi nhé!',
      'Gửi em yêu, chúc em một ngày 20/10 ngập tràn hoa và nắng. Cảm ơn em vì đã kiên nhẫn với anh, vì đã thương anh và vì đã ở đây. Anh thương em nhất trên đời.',
      'Có những ngày thật bình thường, nhưng vì có em mà trở thành ngày đáng nhớ. Chúc mừng ngày của em — người anh chọn cho cả tương lai.',
      'Em à, anh không giỏi nói mấy lời ngọt ngào, nhưng anh biết ơn mỗi ngày được ở cạnh em. Chúc em 20/10 thật nhiều niềm vui, và mong mọi chặng đường phía trước đều có em.'
    ]
  },
  {
    id: 'crush',
    label: 'Crush',
    emoji: '💌',
    badge: 'Cưa Crush',
    hint: 'Dễ thương, hơi ngập ngừng, đủ để gây thương nhớ',
    wishes: [
      'Chào cậu, hôm nay 20/10 nên tớ mạnh dạn nhắn một câu: cậu có biết cậu dễ thương nhất cái lớp này không? Chúc cậu ngày lễ thật vui và luôn rạng rỡ nhé!',
      'Tớ không giỏi nói mấy lời hoa mỹ, nên tớ chỉ nói thật: từ lúc gặp cậu, ngày nào của tớ cũng vui hơn một chút. Chúc cậu 20/10 thật hạnh phúc!',
      'Cậu ơi, 20/10 này tớ gửi cậu một món quà nhỏ. Không dám nói to, nhưng tớ để ý cậu từ lâu rồi. Chúc cậu luôn xinh và luôn vui nhé!',
      'Chúc cậu một ngày 20/10 thật đẹp. Mong cậu luôn là cô gái được yêu thương, được chiều chuộng — và nếu được, tớ muốn là người làm điều đó.',
      'Tớ đã nghĩ rất lâu mới dám gửi cái này. Chúc cậu 20/10 vui vẻ, và nếu cậu rảnh thì cho tớ một cơ hội mời cậu đi uống nước nhé!'
    ]
  },
  {
    id: 'family',
    label: 'Mẹ / Chị',
    emoji: '🌷',
    badge: 'Ấm áp',
    hint: 'Lễ phép, biết ơn, dành cho người thân trong nhà',
    wishes: [
      'Con chúc mẹ ngày 20/10 thật nhiều sức khỏe và luôn vui vẻ. Cảm ơn mẹ đã vất vả vì con suốt bao nhiêu năm qua. Con yêu mẹ nhiều lắm!',
      'Gửi chị yêu quý, chúc chị một ngày 20/10 thật hạnh phúc. Mong chị luôn xinh đẹp, mạnh mẽ và đạt được mọi điều mình mong muốn.',
      'Mẹ ơi, con không nói được nhiều lời ngọt ngào, nhưng con mong mẹ luôn khỏe và luôn cười. Chúc mừng ngày Phụ nữ Việt Nam của mẹ!',
      'Chúc mừng ngày 20/10! Cảm ơn mẹ đã là chỗ dựa lớn nhất của cả nhà. Mong mẹ luôn mạnh khỏe, bình an và được yêu thương thật nhiều.',
      'Nhân ngày của phụ nữ Việt Nam, con chúc mẹ và chị luôn rạng rỡ và bình an. Cả nhà mình mãi là nơi ấm áp nhất.'
    ]
  }
];

// ----------------------------------------------------------------------------
// KHO VE DAC QUYEN GOI Y
// ----------------------------------------------------------------------------
export const COUPON_SUGGESTIONS: string[] = [
  '1 Chầu Trà Sữa Full Topping 🧋',
  '1 Buổi Đi Xem Phim Tự Chọn 🍿',
  'Đặc Quyền Sai Không Bị Giận 1 Lần 🎟️',
  '1 Ngày Được Chiều Chuộng Không Cần Lý Do 🛋️',
  '1 Bữa Ăn Ở Quán Em Thích 🍜',
  '1 Chuyến Đi Chơi Cuối Tuần 🏖️',
  'Đặc Quyền Được Ôm 10 Phút Không Cần Xin Phép 🤗',
  '1 Lần Được Chọn Phim Cho Cả Tối 🎬',
  '1 Buổi Sáng Được Pha Cà Phê Tận Giường ☕',
  'Đặc Quyền Được Giận Vô Cớ 1 Ngày 😤'
];

// ----------------------------------------------------------------------------
// GOI Y LOI NHAN BI MAT (the cao bac)
// ----------------------------------------------------------------------------
export const SCRATCH_SUGGESTIONS: string[] = [
  'Tối 20/10 7h30 anh qua đón đi ăn món em thích nhé!',
  'Bí mật nè: anh đã đặt sẵn bàn ở quán cũ, 7 giờ tối nay nhé. Mặc chiếc váy hôm đó em nhé! 💕',
  'Quà thật đã giấu sẵn ở ngăn bàn của em rồi đó. Về nhà mở ra xem nhé!',
  'Cuối tuần này mình đi Đà Lạt nhé, anh đã đặt phòng rồi. Cào xong thì nhắn cho anh một câu nha!'
];

// ----------------------------------------------------------------------------
// QUYEN LOI KHI MO KHOA (dung chung cho banner xem thu & modal thanh toan)
// ----------------------------------------------------------------------------
export const UNLOCK_BENEFITS: string[] = [
  'Lưu giữ vĩnh viễn, không giới hạn lượt mở',
  'Xoá nhãn "Bản dùng thử" trên mọi khung hình',
  'Nhận Thiệp QR thiết kế riêng để gửi cho người ấy',
  'Mở khoá trọn bộ Game tương tác & Thẻ cào bí mật'
];

// ----------------------------------------------------------------------------
// DU LIEU MAU (dien san vao form de nguoi dung bam "Xem thu" ngay lap tuc)
// ----------------------------------------------------------------------------
export const SAMPLE_PHOTOS: string[] = [
  'https://picsum.photos/seed/lovebox-1/900/900',
  'https://picsum.photos/seed/lovebox-2/900/900',
  'https://picsum.photos/seed/lovebox-3/900/900',
  'https://picsum.photos/seed/lovebox-4/900/900',
  'https://picsum.photos/seed/lovebox-5/900/900',
  'https://picsum.photos/seed/lovebox-6/900/900'
];

export interface SampleGift {
  receiverName: string;
  senderName: string;
  message: string;
  themeId: ThemeId;
  musicId: string;
  photos: string[];
}

export const SAMPLE_GIFT: SampleGift = {
  receiverName: 'Người Thương',
  senderName: 'Anh',
  message:
    'Nhân ngày 20/10, anh chúc em luôn xinh đẹp, rạng rỡ và hạnh phúc. Cảm ơn em đã đến và làm cho cuộc sống của anh trở nên dịu dàng hơn mỗi ngày. Yêu em rất nhiều!',
  themeId: 'pastel-pink',
  musicId: 'romantic-piano',
  photos: SAMPLE_PHOTOS
};

export const BRAND_NAME = 'LoveBox 3D';
