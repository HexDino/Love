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
// GIOI HAN ANH
// ----------------------------------------------------------------------------
export const MIN_PHOTOS = 4;
export const MAX_PHOTOS = 8;

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
