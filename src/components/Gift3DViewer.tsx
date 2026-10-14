'use client';

// ============================================================================
// LoveBox 3D - Gift3DViewer (V2 - Interactive Gift Engine)
// ----------------------------------------------------------------------------
// Mot component duy nhat, 4 kieu trinh dien khac biet hoan toan:
//   - galaxy-3d      : Tinh cau ky niem 3D (vong xoay preserve-3d + hat sang
//                      di theo ngon tay + lightbox chu thich)
//   - polaroid-vinyl : Dia than xoay + can gat may hat + so anh Polaroid
//   - sweet-trap     : Mini-game "nut tu choi chay tron"
//   - blindbox-2010  : Luoi tui mu, tu tay xe tung tui de mo anh
//
// Kem 3 module gamification dung chung cho ca 4 kieu:
//   - Man hinh khoa mat ma 4 so (ban phim kieu iOS, 4 cham trai tim)
//   - The cao bi mat (HTML5 Canvas, globalCompositeOperation = destination-out)
//   - Kho ve dac quyen (ticket UI, bam nhan ve + tim bay)
//
// Toan bo hieu ung 3D deu dung CSS transform/perspective, khong WebGL, de
// khong giat lag trong trinh duyet nhung cua Messenger / Zalo / TikTok.
// ============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Delete,
  Disc3,
  Gift,
  Heart,
  Lock,
  Music2,
  Package,
  PackageOpen,
  PartyPopper,
  Pause,
  Play,
  RotateCcw,
  Scissors,
  Sparkles,
  Star,
  Ticket,
  Volume2,
  VolumeX,
  Wallet,
  X
} from 'lucide-react';
import {
  DEFAULT_TEMPLATE_STYLE,
  getMusicTrack,
  getTheme,
  isTemplateStyle,
  TEMPLATE_META,
  type TemplateStyle,
  type ThemeId
} from '@/lib/constants';

// Re-export de noi khac chi can import tu component nay cung duoc
export {
  DEFAULT_TEMPLATE_STYLE,
  isTemplateStyle,
  TEMPLATE_LIST,
  TEMPLATE_META,
  type TemplateMeta,
  type TemplateStyle
} from '@/lib/constants';

// ============================================================================
// 1. INTERFACE DU LIEU
// ============================================================================

export interface Gift3DViewerProps {
  receiverName: string;
  senderName: string;
  message: string;
  photos: string[];
  themeId: ThemeId;
  musicId: string;
  /** Class bo sung cho khung ngoai */
  className?: string;
  /** Hien watermark "Ban xem thu" */
  isPreview?: boolean;
  /** Bo qua man hinh mo dau, vao thang noi dung */
  autoOpen?: boolean;

  /** Kieu trinh dien. Mac dinh 'galaxy-3d' */
  templateStyle?: TemplateStyle;
  /** Mat khau 4 chu so. Neu co gia tri, hien man hinh khoa truoc khi mo qua. */
  passcode?: string;
  /** Dong goi y hien duoi ban phim so */
  passcodeHint?: string;
  /** Loi nhan bi mat an duoi lop the cao */
  scratchMessage?: string;
  /** Danh sach "Ve dac quyen" nguoi nhan co the bam thu thap */
  coupons?: string[];
  /** Chu thich ngan cho tung anh, khop theo thu tu mang photos */
  photoCaptions?: string[];
}

/** Cac chang cua mon qua, di theo thu tu: passcode -> (envelope | trap | blindbox) -> content */
type GateStage = 'passcode' | 'envelope' | 'opening' | 'trap' | 'blindbox' | 'content';

// ============================================================================
// 2. HANG SO
// ============================================================================

const MAX_VISIBLE_PHOTOS = 8;
const OPEN_ANIMATION_MS = 1150;
const AUTO_ROTATE_SPEED = 12; // do/giay
const IDLE_RESUME_MS = 2400;
const TYPE_INTERVAL_MS = 34;
const SCRATCH_REVEAL_THRESHOLD = 0.5; // Cao >= 50% dien tich la lo het
const MAX_AGREE_SCALE = 2.2;

/** Cau chu doi tren nut "Khong them" moi lan no chay tron */
const DODGE_LINES: string[] = [
  'Ơ kìa bấm nhầm à? 😳',
  'Đừng mơ thoát nhé! 🏃',
  'Bấm nút màu hồng kìa! 💖',
  'Nút này hỏng rồi nha 😝',
  'Trượt rồi, thử lại đi! 🎯',
  'Cậu chắc chưa đó? 😏',
  'Không thoát được đâu! 🔒',
  'Ngoan nào, bấm Đồng ý đi~ 🥰'
];

/**
 * Vi tri nut "Khong them" chay toi.
 *
 * TAT CA deu nam o nua DUOI cua san choi, vi nut "Dong y" phong to dan theo
 * moi lan ne (toi da 2.2 lan) nen se chiem het nua tren. Neu de nut "Khong them"
 * roi vao nua tren, no se nam de len nut "Dong y" va chan nguoi dung bam.
 */
const DODGE_SPOTS: Array<{ left: number; top: number }> = [
  { left: 22, top: 66 },
  { left: 50, top: 72 },
  { left: 78, top: 66 },
  { left: 30, top: 90 },
  { left: 70, top: 90 }
];

/** Chon vi tri ne moi, uu tien vi tri khac xa cho dung hien tai */
function pickDodgeSpot(previous: { left: number; top: number }): { left: number; top: number } {
  const far = DODGE_SPOTS.filter(
    (spot) => Math.abs(spot.left - previous.left) > 14 || Math.abs(spot.top - previous.top) > 10
  );
  const pool = far.length > 0 ? far : DODGE_SPOTS;
  const spot = pool[Math.floor(Math.random() * pool.length)];
  return {
    left: Math.max(16, Math.min(84, spot.left + (Math.random() * 8 - 4))),
    top: Math.max(60, Math.min(94, spot.top + (Math.random() * 6 - 3)))
  };
}

/**
 * Moi kieu trinh dien co "chat" mau rieng, de 4 che do nhin khac han nhau
 * du nguoi dung chon cung mot chu de mau. Accent van lay tu chu de mau.
 */
const TEMPLATE_VAR_OVERRIDES: Record<TemplateStyle, Record<string, string>> = {
  'galaxy-3d': {
    '--lb-bg-1': '#05061a',
    '--lb-bg-2': '#131a44',
    '--lb-bg-3': '#2a1a5e',
    '--lb-text': '#eef3ff',
    '--lb-text-soft': 'rgba(238, 243, 255, 0.72)',
    '--lb-card': 'rgba(16, 22, 54, 0.55)',
    '--lb-card-border': 'rgba(160, 190, 255, 0.3)'
  },
  'polaroid-vinyl': {
    '--lb-bg-1': '#fbf3e4',
    '--lb-bg-2': '#f0dfc4',
    '--lb-bg-3': '#e4caa6',
    '--lb-text': '#4a3524',
    '--lb-text-soft': 'rgba(74, 53, 36, 0.68)',
    '--lb-card': 'rgba(255, 252, 245, 0.88)',
    '--lb-card-border': 'rgba(74, 53, 36, 0.16)'
  },
  'sweet-trap': {
    '--lb-bg-1': '#fff0f6',
    '--lb-bg-2': '#ffd6e6',
    '--lb-bg-3': '#ffe9f2',
    '--lb-text': '#5c1733',
    '--lb-text-soft': 'rgba(92, 23, 51, 0.68)',
    '--lb-card': 'rgba(255, 255, 255, 0.8)',
    '--lb-card-border': 'rgba(255, 61, 127, 0.24)'
  },
  'blindbox-2010': {
    '--lb-bg-1': '#eefcff',
    '--lb-bg-2': '#d3f0ff',
    '--lb-bg-3': '#e7e0ff',
    '--lb-text': '#1f2a44',
    '--lb-text-soft': 'rgba(31, 42, 68, 0.68)',
    '--lb-card': 'rgba(255, 255, 255, 0.84)',
    '--lb-card-border': 'rgba(31, 42, 68, 0.14)'
  }
};

// ============================================================================
// 3. TIEN ICH DUNG CHUNG
// ============================================================================

/** Rung nhe tren thiet bi ho tro (khong lam hong gi neu khong ho tro) */
function vibrate(pattern: number | number[]): void {
  if (typeof navigator === 'undefined') return;
  if (typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* Mot so trinh duyet chan API nay - bo qua */
  }
}

/** Ban phao hoa. Loi o day khong duoc lam hong luong chinh cua mon qua. */
function fireConfetti(accent: string): void {
  try {
    const colors = [accent, '#ffd166', '#ffffff', '#ff5c8a', '#8ab4ff'];
    confetti({
      particleCount: 90,
      spread: 80,
      origin: { y: 0.62 },
      colors,
      zIndex: 999,
      disableForReducedMotion: true
    });
    confetti({
      particleCount: 45,
      angle: 60,
      spread: 62,
      origin: { x: 0, y: 0.72 },
      colors,
      zIndex: 999,
      disableForReducedMotion: true
    });
    confetti({
      particleCount: 45,
      angle: 120,
      spread: 62,
      origin: { x: 1, y: 0.72 },
      colors,
      zIndex: 999,
      disableForReducedMotion: true
    });
  } catch {
    /* Hieu ung phu - khong lam gian doan trai nghiem */
  }
}

function cleanPhotos(photos: string[]): string[] {
  return photos
    .filter((src) => typeof src === 'string' && src.trim().length > 0)
    .slice(0, MAX_VISIBLE_PHOTOS);
}

/** Goc nghieng "tu nhien" nhung on dinh cho tung tam Polaroid */
function polaroidTilt(index: number): number {
  const table = [-4.5, 3.2, -2.4, 5.1, -5.6, 1.8, -3.4, 4.2];
  return table[index % table.length];
}

// ============================================================================
// 4. CANVAS: MUA TIM / CANH HOA ROI
// ============================================================================

type ParticleKind = 'heart' | 'petal' | 'star';

interface Particle {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  swayPhase: number;
  swaySpeed: number;
  rotation: number;
  rotationSpeed: number;
  alpha: number;
  kind: ParticleKind;
  color: string;
}

function drawHeart(ctx: CanvasRenderingContext2D, size: number): void {
  const top = size * 0.3;
  ctx.beginPath();
  ctx.moveTo(0, top);
  ctx.bezierCurveTo(0, 0, -size / 2, 0, -size / 2, top);
  ctx.bezierCurveTo(-size / 2, (size + top) / 2, 0, (size + top) / 2, 0, size);
  ctx.bezierCurveTo(0, (size + top) / 2, size / 2, (size + top) / 2, size / 2, top);
  ctx.bezierCurveTo(size / 2, 0, 0, 0, 0, top);
  ctx.closePath();
  ctx.fill();
}

function drawPetal(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.42, size * 0.24, 0, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
}

function drawStar(ctx: CanvasRenderingContext2D, size: number): void {
  const outer = size * 0.5;
  const inner = size * 0.12;
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 4) * i - Math.PI / 2;
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

interface FallingCanvasProps {
  active: boolean;
  colors: string[];
}

function FallingCanvas({ active, colors }: FallingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const sizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const activeRef = useRef<boolean>(active);
  const colorsRef = useRef<string[]>(colors);
  const frameRef = useRef<number>(0);

  activeRef.current = active;
  colorsRef.current = colors;

  const createParticle = useCallback((width: number, height: number, fromTop: boolean): Particle => {
    const palette = colorsRef.current.length > 0 ? colorsRef.current : ['#ff5c8a', '#ffd9a0', '#ffffff'];
    const kinds: ParticleKind[] = ['heart', 'petal', 'petal', 'star'];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const size = kind === 'heart' ? 12 + Math.random() * 14 : 9 + Math.random() * 13;
    return {
      x: Math.random() * width,
      y: fromTop ? -size * 2 - Math.random() * height * 0.35 : Math.random() * height,
      size,
      speedY: 26 + Math.random() * 46,
      speedX: -16 + Math.random() * 32,
      swayPhase: Math.random() * Math.PI * 2,
      swaySpeed: 0.6 + Math.random() * 1.1,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (-0.9 + Math.random() * 1.8) * 0.9,
      alpha: 0.45 + Math.random() * 0.5,
      kind,
      color: palette[Math.floor(Math.random() * palette.length)]
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { width, height };
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);

    const TARGET_COUNT = 34;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(now - last, 60) / 1000;
      last = now;

      const { width, height } = sizeRef.current;
      const particles = particlesRef.current;

      if (activeRef.current && width > 0) {
        while (particles.length < TARGET_COUNT) {
          particles.push(createParticle(width, height, particles.length > 0));
        }
      } else if (particles.length > 0) {
        particles.splice(0, Math.min(particles.length, 4));
      }

      ctx.clearRect(0, 0, width, height);

      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.swayPhase += p.swaySpeed * dt;
        p.y += p.speedY * dt;
        p.x += (p.speedX + Math.sin(p.swayPhase) * 22) * dt;
        p.rotation += p.rotationSpeed * dt;

        if (p.y - p.size > height || p.x < -80 || p.x > width + 80) {
          if (activeRef.current) {
            particles[i] = createParticle(width, height, true);
          } else {
            particles.splice(i, 1);
          }
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y - p.size / 2);
        ctx.rotate(p.rotation);
        if (p.kind === 'heart') drawHeart(ctx, p.size);
        else if (p.kind === 'petal') drawPetal(ctx, p.size);
        else drawStar(ctx, p.size);
        ctx.restore();
      }

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
    };
  }, [createParticle]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />;
}

// ============================================================================
// 5. CANVAS: HAT SANG DI THEO NGON TAY (chi che do galaxy-3d)
// ============================================================================

interface Sparkle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  size: number;
  color: string;
}

interface SparkleCanvasProps {
  active: boolean;
  colors: string[];
}

function SparkleCanvas({ active, colors }: SparkleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sparklesRef = useRef<Sparkle[]>([]);
  const activeRef = useRef<boolean>(active);
  const colorsRef = useRef<string[]>(colors);
  const lastSpawnRef = useRef<number>(0);

  activeRef.current = active;
  colorsRef.current = colors;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const palette = () => {
      const list = colorsRef.current.filter((c) => typeof c === 'string' && c.length > 0);
      return list.length > 0 ? list : ['#ffe9a8', '#9dc0ff', '#ffffff'];
    };

    const spawn = (x: number, y: number, strength: number) => {
      const list = palette();
      const count = Math.round(strength * (1 + Math.random() * 2));
      for (let i = 0; i < count; i += 1) {
        const ttl = 520 + Math.random() * 620;
        sparklesRef.current.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 26,
          vy: -12 - Math.random() * 30,
          life: ttl,
          ttl,
          size: 2 + Math.random() * 5,
          color: list[Math.floor(Math.random() * list.length)]
        });
      }
      if (sparklesRef.current.length > 260) {
        sparklesRef.current.splice(0, sparklesRef.current.length - 260);
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!activeRef.current) return;
      const now = performance.now();
      if (now - lastSpawnRef.current < 18) return;
      lastSpawnRef.current = now;
      const rect = canvas.getBoundingClientRect();
      spawn(event.clientX - rect.left, event.clientY - rect.top, 1);
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerMove, { passive: true });

    let last = performance.now();
    let ambientAt = last;
    let frame = 0;

    const tick = (now: number) => {
      const dt = Math.min(now - last, 60) / 1000;
      last = now;

      // Thinh thoang tu ban mot hat sang cho nen luon lung linh
      if (activeRef.current && width > 0 && now - ambientAt > 620) {
        ambientAt = now;
        spawn(Math.random() * width, Math.random() * height * 0.85, 0.6);
      }

      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';

      const list = sparklesRef.current;
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const s = list[i];
        s.life -= dt * 1000;
        if (s.life <= 0) {
          list.splice(i, 1);
          continue;
        }
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += 14 * dt;

        const progress = s.life / s.ttl;
        const radius = s.size * (0.6 + progress * 0.9);
        const gradient = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, radius * 3.4);
        gradient.addColorStop(0, s.color);
        gradient.addColorStop(0.34, s.color);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.globalAlpha = Math.min(1, progress * 1.15);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(s.x, s.y, radius * 3.4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerMove);
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />;
}

// ============================================================================
// 6. BAU TROI SAO (che do galaxy-3d)
// ============================================================================

/**
 * PRNG co seed co dinh (mulberry32).
 *
 * KHONG dung Math.random() o day: Starfield render ca tren server lan client,
 * neu moi ben random mot kieu thi React bao loi hydration mismatch. Seed co dinh
 * cho ra cung mot bau troi sao o ca hai phia ma van nhin tu nhien.
 */
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function Starfield() {
  const stars = useMemo(() => {
    const random = createSeededRandom(20261020);
    return Array.from({ length: 64 }, (_, index) => ({
      id: index,
      left: random() * 100,
      top: random() * 100,
      size: 1 + random() * 2.4,
      delay: random() * 4,
      duration: 2.2 + random() * 3
    }));
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {stars.map((star) => (
        <span
          key={star.id}
          className="lb-twinkle absolute rounded-full bg-white"
          style={{
            left: `${star.left}%`,
            top: `${star.top}%`,
            width: star.size,
            height: star.size,
            animationDelay: `${star.delay}s`,
            animationDuration: `${star.duration}s`
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// 7. MODULE 2 - THE CAO BI MAT (HTML5 Canvas)
// ============================================================================

interface ScratchCardProps {
  message: string;
  accent: string;
}

function ScratchCard({ message, accent }: ScratchCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const moveCountRef = useRef(0);
  const revealedRef = useRef(false);
  const [revealed, setRevealed] = useState(false);

  revealedRef.current = revealed;

  // --------------------------------------------------------------------------
  // Ve lop nhu bac/hong phu len tren
  // --------------------------------------------------------------------------
  const paintFoil = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, width, height);

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#e6d5e4');
    gradient.addColorStop(0.26, '#f8f0f8');
    gradient.addColorStop(0.48, '#cbbdd4');
    gradient.addColorStop(0.7, '#f4e7f2');
    gradient.addColorStop(1, '#d6c4d6');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 110; i += 1) {
      ctx.globalAlpha = 0.2 + Math.random() * 0.5;
      ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#b3a0bd';
      ctx.beginPath();
      ctx.arc(Math.random() * width, Math.random() * height, 0.7 + Math.random() * 2.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const titleSize = Math.max(12, Math.min(15, width / 21));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(92, 23, 51, 0.66)';
    ctx.font = `700 ${titleSize}px "Be Vietnam Pro", system-ui, -apple-system, sans-serif`;
    ctx.fillText('Dùng ngón tay cào nhẹ vào đây ✨', width / 2, height / 2 - 10);

    ctx.fillStyle = 'rgba(92, 23, 51, 0.44)';
    ctx.font = `500 ${Math.max(10, titleSize - 3)}px "Be Vietnam Pro", system-ui, -apple-system, sans-serif`;
    ctx.fillText('Cào tới khi lộ điều bí mật nhé', width / 2, height / 2 + 12);
  }, []);

  useEffect(() => {
    paintFoil();
    const handleResize = () => {
      if (!revealedRef.current) paintFoil();
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [paintFoil]);

  // --------------------------------------------------------------------------
  // Kiem tra ti le da cao duoc
  // --------------------------------------------------------------------------
  const checkProgress = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    try {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let cleared = 0;
      let sampled = 0;
      for (let i = 3; i < data.length; i += 16) {
        sampled += 1;
        if (data[i] < 40) cleared += 1;
      }
      if (sampled > 0 && cleared / sampled >= SCRATCH_REVEAL_THRESHOLD) {
        setRevealed(true);
        vibrate(24);
      }
    } catch {
      /* getImageData co the bi chan - bo qua, nguoi dung van cao tay duoc */
    }
  }, []);

  // --------------------------------------------------------------------------
  // Cao
  // --------------------------------------------------------------------------
  const scratchAt = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas || revealedRef.current) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const radius = Math.max(15, Math.min(27, rect.width * 0.062));

      ctx.globalCompositeOperation = 'destination-out';

      const last = lastPointRef.current;
      if (last) {
        const distance = Math.hypot(x - last.x, y - last.y);
        const steps = Math.max(1, Math.ceil(distance / Math.max(3, radius * 0.35)));
        for (let i = 1; i <= steps; i += 1) {
          const ix = last.x + ((x - last.x) * i) / steps;
          const iy = last.y + ((y - last.y) * i) / steps;
          ctx.beginPath();
          ctx.arc(ix, iy, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      lastPointRef.current = { x, y };
      moveCountRef.current += 1;
      if (moveCountRef.current % 5 === 0) checkProgress();
    },
    [checkProgress]
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (revealedRef.current) return;
      drawingRef.current = true;
      lastPointRef.current = null;
      scratchAt(event.clientX, event.clientY);
    },
    [scratchAt]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current || revealedRef.current) return;
      scratchAt(event.clientX, event.clientY);
    },
    [scratchAt]
  );

  const endStroke = useCallback(() => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    checkProgress();
  }, [checkProgress]);

  const revealAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
    setRevealed(true);
    vibrate(18);
  }, []);

  return (
    <section className="mt-4">
      <div className="mb-2 flex items-center gap-2">
        <Scissors className="h-3.5 w-3.5" style={{ color: accent }} />
        <span className="text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: 'var(--lb-text-soft)' }}>
          Thẻ cào bí mật
        </span>
      </div>

      <div className="relative h-[124px] overflow-hidden rounded-2xl" style={{ border: '1px solid var(--lb-card-border)' }}>
        {/* Noi dung ben duoi lop nhu */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center"
          style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(255,240,248,0.86) 100%)' }}
        >
          <Sparkles className="mb-1.5 h-4 w-4" style={{ color: accent }} />
          <p className="font-script text-[19px] leading-snug" style={{ color: '#5c1733' }}>
            {message}
          </p>
        </div>

        {/* Lop nhu bac */}
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          onPointerLeave={endStroke}
          className={`absolute inset-0 h-full w-full transition-opacity duration-700 ${
            revealed ? 'pointer-events-none opacity-0' : 'opacity-100'
          }`}
          style={{ touchAction: 'none', cursor: 'crosshair' }}
        />
      </div>

      {!revealed && (
        <button
          type="button"
          onClick={revealAll}
          className="mt-2 w-full text-center text-[11px] font-medium underline decoration-dotted underline-offset-4 transition active:scale-95"
          style={{ color: 'var(--lb-text-soft)' }}
        >
          Không cào được? Chạm vào đây để mở lớp nhũ
        </button>
      )}
    </section>
  );
}

// ============================================================================
// 8. MODULE 3 - KHO VE DAC QUYEN (LOVE COUPONS)
// ============================================================================

interface LoveCouponsProps {
  coupons: string[];
  accent: string;
}

function LoveCoupons({ coupons, accent }: LoveCouponsProps) {
  const [claimed, setClaimed] = useState<number[]>([]);
  const [burst, setBurst] = useState<{ index: number; key: number } | null>(null);
  const burstTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (burstTimerRef.current !== null) window.clearTimeout(burstTimerRef.current);
    };
  }, []);

  const collect = useCallback(
    (index: number) => {
      setClaimed((prev) => (prev.includes(index) ? prev : [...prev, index]));
      setBurst({ index, key: Date.now() });
      vibrate([0, 18, 40, 18]);
      if (burstTimerRef.current !== null) window.clearTimeout(burstTimerRef.current);
      burstTimerRef.current = window.setTimeout(() => setBurst(null), 1200);
    },
    []
  );

  return (
    <section className="mt-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Ticket className="h-3.5 w-3.5" style={{ color: accent }} />
          <span className="text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: 'var(--lb-text-soft)' }}>
            Kho vé đặc quyền
          </span>
        </div>
        <span className="text-[10px] font-semibold" style={{ color: accent }}>
          {claimed.length}/{coupons.length} đã nhận
        </span>
      </div>

      <div className="space-y-2.5">
        {coupons.map((coupon, index) => {
          const isClaimed = claimed.includes(index);
          return (
            <div
              key={`${coupon}-${index}`}
              className="lb-ticket relative flex items-stretch gap-3 overflow-hidden p-2.5"
              style={{
                background: isClaimed
                  ? 'linear-gradient(135deg, rgba(255,246,250,0.96) 0%, rgba(255,235,244,0.92) 100%)'
                  : 'linear-gradient(135deg, rgba(255,255,255,0.94) 0%, rgba(252,244,250,0.9) 100%)',
                boxShadow: '0 10px 24px -16px rgba(92,23,51,0.45)',
                opacity: isClaimed ? 0.94 : 1
              }}
            >
              <div
                className="flex w-10 shrink-0 flex-col items-center justify-center rounded-xl"
                style={{ background: isClaimed ? accent : 'rgba(92,23,51,0.14)' }}
              >
                <Ticket className="h-3.5 w-3.5 text-white" />
                <span className="mt-0.5 text-[9px] font-bold text-white">#{index + 1}</span>
              </div>

              <div className="min-w-0 flex-1 py-0.5">
                <p className="text-[13px] font-semibold leading-snug" style={{ color: '#4a1226' }}>
                  {coupon}
                </p>
                <p className="mt-1 text-[10px] leading-tight" style={{ color: 'rgba(74,18,38,0.6)' }}>
                  {isClaimed ? 'Đã lưu vào ví — dùng lúc nào cũng được nhé!' : 'Vé đặc quyền • bấm để nhận vào ví'}
                </p>
              </div>

              <div className="flex shrink-0 items-center pl-2" style={{ borderLeft: '1px dashed rgba(92,23,51,0.22)' }}>
                <button
                  type="button"
                  onClick={() => collect(index)}
                  disabled={isClaimed}
                  className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-bold text-white transition active:scale-95 disabled:cursor-default"
                  style={{ background: isClaimed ? 'rgba(92,23,51,0.35)' : accent }}
                >
                  {isClaimed ? (
                    <>
                      <Wallet className="h-3.5 w-3.5" />
                      Đã lưu
                    </>
                  ) : (
                    <>
                      <Heart className="h-3.5 w-3.5" fill="currentColor" />
                      Nhận vé
                    </>
                  )}
                </button>
              </div>

              {/* Tim bay khi nhan ve */}
              {burst && burst.index === index && (
                <div key={burst.key} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                  {[0, 1, 2, 3, 4, 5].map((heartIndex) => (
                    <Heart
                      key={heartIndex}
                      className="lb-heart-fly absolute h-4 w-4"
                      fill="currentColor"
                      style={{
                        color: accent,
                        left: `${62 + heartIndex * 5}%`,
                        bottom: 8,
                        animationDelay: `${heartIndex * 70}ms`
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ============================================================================
// 9. BUC THU GO CHU (TYPEWRITER)
// ============================================================================

interface TypewriterLetterProps {
  message: string;
  senderName: string;
  accent: string;
  active: boolean;
  replayKey: number;
}

function TypewriterLetter({ message, senderName, accent, active, replayKey }: TypewriterLetterProps) {
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (!active) {
      setTyped('');
      return;
    }
    setTyped('');
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setTyped(message.slice(0, index));
      if (index >= message.length) window.clearInterval(timer);
    }, TYPE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [active, message, replayKey]);

  const isTyping = active && typed.length < message.length;

  return (
    <section
      className="mt-5 rounded-3xl p-4"
      style={{
        background: 'var(--lb-card)',
        border: '1px solid var(--lb-card-border)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)'
      }}
    >
      <div className="mb-2 flex items-center gap-2">
        <Heart className="h-3.5 w-3.5" style={{ color: accent }} fill="currentColor" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: 'var(--lb-text-soft)' }}>
          Lời nhắn gửi em
        </span>
      </div>
      <p className="min-h-[72px] whitespace-pre-wrap text-[13.5px] leading-relaxed" style={{ color: 'var(--lb-text)' }}>
        {typed}
        {isTyping && (
          <span
            className="ml-0.5 inline-block h-4 w-[2px] animate-pulse align-middle"
            style={{ background: accent }}
          />
        )}
      </p>
      <p className="font-script mt-3 text-right text-xl" style={{ color: accent }}>
        — {senderName || 'Người gửi'}
      </p>
    </section>
  );
}

// ============================================================================
// 10. LIGHTBOX ANH + CHU THICH
// ============================================================================

interface PhotoLightboxProps {
  photos: string[];
  captions: string[];
  index: number;
  accent: string;
  onClose: () => void;
  onChange: (index: number) => void;
}

function PhotoLightbox({ photos, captions, index, accent, onClose, onChange }: PhotoLightboxProps) {
  const total = photos.length;
  const photo = photos[index] ?? '';
  const caption = captions[index] ?? '';

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') onChange((index + 1) % total);
      if (event.key === 'ArrowLeft') onChange((index - 1 + total) % total);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [index, total, onClose, onChange]);

  const goPrev = useCallback(() => onChange((index - 1 + total) % total), [index, total, onChange]);
  const goNext = useCallback(() => onChange((index + 1) % total), [index, total, onChange]);

  return (
    <div className="absolute inset-0 z-[80] flex flex-col bg-black/92 px-4 pb-8 pt-5 backdrop-blur-md">
      <div className="flex shrink-0 items-center justify-between">
        <span className="text-[11px] font-semibold tracking-wide text-white/70">
          {index + 1} / {total}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng ảnh"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/12 text-white transition active:scale-90"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center py-4">
        <div className="lb-lightbox-in relative w-full max-w-[440px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo}
            alt={caption || `Ảnh kỷ niệm ${index + 1}`}
            draggable={false}
            className="max-h-[58vh] w-full rounded-2xl object-contain"
            style={{ boxShadow: `0 26px 60px -22px ${accent}` }}
          />
        </div>
      </div>

      <div className="shrink-0 text-center">
        {caption ? (
          <p className="font-script mx-auto max-w-[420px] text-[21px] leading-snug text-white">{caption}</p>
        ) : (
          <p className="text-[13px] text-white/60">Kỷ niệm {index + 1}</p>
        )}
      </div>

      {total > 1 && (
        <div className="mt-5 flex shrink-0 items-center justify-center gap-5">
          <button
            type="button"
            onClick={goPrev}
            aria-label="Ảnh trước"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/12 text-white transition active:scale-90"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-1.5">
            {photos.map((_, dotIndex) => (
              <span
                key={`lb-dot-${dotIndex}`}
                className="block rounded-full transition-all duration-300"
                style={{
                  width: dotIndex === index ? 18 : 6,
                  height: 6,
                  background: dotIndex === index ? accent : 'rgba(255,255,255,0.32)'
                }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={goNext}
            aria-label="Ảnh sau"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/12 text-white transition active:scale-90"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 11. MODULE 1 - MAN HINH KHOA MAT MA
// ============================================================================

interface PasscodeLockProps {
  passcode: string;
  hint?: string;
  receiverName: string;
  accent: string;
  onUnlock: () => void;
}

function PasscodeLock({ passcode, hint, receiverName, accent, onUnlock }: PasscodeLockProps) {
  const [entry, setEntry] = useState('');
  const [shake, setShake] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const entryRef = useRef('');
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
    };
  }, []);

  const press = useCallback(
    (digit: string) => {
      if (success || entryRef.current.length >= 4) return;

      const next = `${entryRef.current}${digit}`;
      entryRef.current = next;
      setEntry(next);
      setError('');
      vibrate(8);

      if (next.length < 4) return;

      if (next === passcode) {
        setSuccess(true);
        fireConfetti(accent);
        vibrate([0, 30, 50, 30]);
        timersRef.current.push(window.setTimeout(() => onUnlock(), 780));
        return;
      }

      setShake(true);
      setError('Mật mã chưa đúng, thử lại nhé!');
      vibrate([0, 45, 70, 45]);
      timersRef.current.push(
        window.setTimeout(() => {
          setShake(false);
          entryRef.current = '';
          setEntry('');
        }, 640)
      );
    },
    [accent, onUnlock, passcode, success]
  );

  const backspace = useCallback(() => {
    if (success) return;
    const next = entryRef.current.slice(0, -1);
    entryRef.current = next;
    setEntry(next);
    setError('');
    vibrate(6);
  }, [success]);

  // Ho tro ban phim vat ly tren may tinh
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (/^[0-9]$/.test(event.key)) press(event.key);
      else if (event.key === 'Backspace') backspace();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [press, backspace]);

  const keys: Array<string | 'blank' | 'back'> = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'blank', '0', 'back'];

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center px-8">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full"
        style={{ background: 'var(--lb-card)', border: '1px solid var(--lb-card-border)' }}
      >
        <Lock className="h-6 w-6" style={{ color: accent }} />
      </div>

      <h3 className="mt-4 text-center text-[17px] font-bold" style={{ color: 'var(--lb-text)' }}>
        Món quà này đang được khoá
      </h3>
      <p className="mt-1 text-center text-[12.5px]" style={{ color: 'var(--lb-text-soft)' }}>
        Nhập mật mã 4 số để mở quà dành cho {receiverName || 'em'} nhé
      </p>

      <div className={`mt-6 flex items-center gap-4 ${shake ? 'lb-shake' : ''}`}>
        {[0, 1, 2, 3].map((slot) => {
          const filled = slot < entry.length;
          return (
            <span
              key={`slot-${slot}`}
              className="flex items-center justify-center rounded-full transition-all duration-300"
              style={{
                width: filled ? 20 : 16,
                height: filled ? 20 : 16,
                background: filled ? accent : 'var(--lb-card)',
                border: `2px solid ${filled ? accent : 'var(--lb-text-soft)'}`,
                transform: success ? 'scale(1.22)' : 'scale(1)'
              }}
            >
              {filled && <Heart className="h-2.5 w-2.5 text-white" fill="currentColor" />}
            </span>
          );
        })}
      </div>

      <p className="mt-3 h-4 text-center text-[11.5px] font-medium" style={{ color: error ? '#e0364f' : 'transparent' }}>
        {error || '—'}
      </p>

      <div className="mt-2 grid w-full max-w-[268px] grid-cols-3 gap-3">
        {keys.map((key, index) => {
          if (key === 'blank') {
            return <span key={`blank-${index}`} aria-hidden="true" />;
          }
          if (key === 'back') {
            return (
              <button
                key="back"
                type="button"
                onClick={backspace}
                aria-label="Xoá một số"
                className="flex h-16 items-center justify-center rounded-2xl transition active:scale-95"
                style={{ color: 'var(--lb-text)' }}
              >
                <Delete className="h-6 w-6" />
              </button>
            );
          }
          return (
            <button
              key={`key-${key}`}
              type="button"
              onClick={() => press(key)}
              disabled={success}
              className="lb-keypad flex h-16 items-center justify-center rounded-2xl text-[23px] font-semibold transition active:scale-95 disabled:opacity-60"
              style={{ color: 'var(--lb-text)', background: 'var(--lb-card)', border: '1px solid var(--lb-card-border)' }}
            >
              {key}
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex items-center gap-1.5" style={{ color: 'var(--lb-text-soft)' }}>
        <Sparkles className="h-3.5 w-3.5" />
        <span className="text-[11.5px]">{hint && hint.trim().length > 0 ? hint : 'Gợi ý: một ngày thật đặc biệt'}</span>
      </div>
    </div>
  );
}

// ============================================================================
// 12. CONG 1 - PHONG BI MO RA (galaxy-3d & polaroid-vinyl)
// ============================================================================

interface EnvelopeGateProps {
  stage: 'envelope' | 'opening';
  receiverName: string;
  trackName: string;
  photos: string[];
  accent: string;
  onOpen: () => void;
}

function EnvelopeGate({ stage, receiverName, trackName, photos, accent, onOpen }: EnvelopeGateProps) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-7 px-6">
      <div className={`lb-envelope-scene ${stage === 'opening' ? 'lb-env-open' : ''}`}>
        <div className="lb-env-shell relative" style={{ width: 268, height: 174 }}>
          <div className="lb-env-body absolute inset-0 rounded-xl" />

          <div
            className="lb-env-letter absolute bottom-3 rounded-lg px-3 py-3 shadow-lg"
            style={{ left: '9%', width: '82%', height: 148, background: '#fffdfa' }}
          >
            <div className="flex items-center justify-center gap-1.5">
              <Heart className="h-3 w-3 text-rose-500" fill="currentColor" />
              <span className="font-script text-lg text-rose-500">Gửi {receiverName || 'em'}</span>
              <Heart className="h-3 w-3 text-rose-500" fill="currentColor" />
            </div>
            <div className="mt-2 space-y-1.5">
              <div className="h-1.5 w-full rounded-full bg-rose-100" />
              <div className="h-1.5 w-5/6 rounded-full bg-rose-100" />
              <div className="h-1.5 w-4/6 rounded-full bg-rose-100" />
            </div>
            <div className="mt-3 flex justify-center gap-1">
              {photos.slice(0, 4).map((src, index) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`mini-${index}`}
                  src={src}
                  alt=""
                  draggable={false}
                  className="h-8 w-8 rounded object-cover ring-1 ring-rose-100"
                />
              ))}
            </div>
          </div>

          <div
            className="absolute inset-0 rounded-xl"
            style={{
              clipPath: 'polygon(0 0, 50% 52%, 100% 0, 100% 100%, 0 100%)',
              background: 'linear-gradient(180deg, var(--lb-envelope) 0%, var(--lb-envelope-dark) 100%)',
              transform: 'translateZ(8px)'
            }}
          />

          <div
            className="lb-env-flap absolute inset-x-0 top-0"
            style={{
              height: '100%',
              clipPath: 'polygon(0 0, 100% 0, 50% 58%)',
              background: 'linear-gradient(180deg, var(--lb-envelope-dark) 0%, var(--lb-envelope) 100%)'
            }}
          />

          <div
            className="lb-seal-pulse absolute left-1/2 top-[46%] flex h-11 w-11 items-center justify-center rounded-full"
            style={{
              background: 'var(--lb-seal)',
              transform: 'translate(-50%, -50%) translateZ(20px)',
              boxShadow: '0 8px 18px -6px rgba(0,0,0,.45)'
            }}
          >
            <Heart className="h-5 w-5 text-white" fill="currentColor" />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpen}
        disabled={stage === 'opening'}
        className="lb-btn-glow group flex items-center gap-2.5 rounded-full px-7 py-3.5 text-[15px] font-bold text-white transition active:scale-95 disabled:opacity-80"
        style={{ background: accent }}
      >
        {stage === 'opening' ? (
          <>
            <Sparkles className="animate-spin" style={{ width: 18, height: 18 }} />
            Đang mở món quà...
          </>
        ) : (
          <>
            <Gift className="h-5 w-5 transition group-hover:-rotate-6" />
            Chạm để mở món quà
          </>
        )}
      </button>

      <p className="text-center text-[11px]" style={{ color: 'var(--lb-text-soft)' }}>
        Bật âm thanh để cảm nhận trọn vẹn nhé
      </p>

      <div className="flex items-center gap-1.5" style={{ color: 'var(--lb-text-soft)' }}>
        <Music2 className="h-3.5 w-3.5" />
        <span className="text-[11px]">{trackName}</span>
      </div>
    </div>
  );
}

// ============================================================================
// 13. CONG 2 - MINI-GAME BAY TINH YEU (sweet-trap)
// ============================================================================

interface SweetTrapGameProps {
  receiverName: string;
  senderName: string;
  accent: string;
  onAgree: () => void;
}

function SweetTrapGame({ receiverName, senderName, accent, onAgree }: SweetTrapGameProps) {
  const [dodges, setDodges] = useState(0);
  const [noLabel, setNoLabel] = useState('Không thèm 😝');
  const [noPos, setNoPos] = useState({ left: 50, top: 74 });
  const [accepted, setAccepted] = useState(false);
  const dodgesRef = useRef(0);
  const noPosRef = useRef({ left: 50, top: 74 });
  const acceptTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (acceptTimerRef.current !== null) window.clearTimeout(acceptTimerRef.current);
    };
  }, []);

  const dodge = useCallback(() => {
    if (accepted) return;
    const next = dodgesRef.current + 1;
    dodgesRef.current = next;
    setDodges(next);
    setNoLabel(DODGE_LINES[(next - 1) % DODGE_LINES.length]);

    const spot = pickDodgeSpot(noPosRef.current);
    noPosRef.current = spot;
    setNoPos(spot);

    vibrate(14);
  }, [accepted]);

  const accept = useCallback(() => {
    if (accepted) return;
    setAccepted(true);
    fireConfetti(accent);
    vibrate([0, 30, 50, 30, 50, 60]);
    acceptTimerRef.current = window.setTimeout(() => onAgree(), 1000);
  }, [accepted, accent, onAgree]);

  const agreeScale = Math.min(1 + dodges * 0.2, MAX_AGREE_SCALE);

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center px-6">
      <div
        className="w-full max-w-[420px] rounded-3xl p-5 text-center"
        style={{
          background: 'var(--lb-card)',
          border: '1px solid var(--lb-card-border)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          boxShadow: '0 24px 60px -28px rgba(255,61,127,0.55)'
        }}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full" style={{ background: accent }}>
          <Heart className="h-6 w-6 text-white" fill="currentColor" />
        </div>

        <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.28em]" style={{ color: 'var(--lb-text-soft)' }}>
          {senderName || 'Người gửi'} gửi {receiverName || 'em'}
        </p>
        <h3 className="mt-1.5 text-[17px] font-bold leading-snug" style={{ color: 'var(--lb-text)' }}>
          Nhân ngày đặc biệt này, cậu đồng ý nhận món quà này và đi chơi với tớ nhé?
        </h3>

        {dodges > 0 && (
          <p className="mt-2 text-[11.5px] font-medium" style={{ color: accent }}>
            Cậu đã né {dodges} lần rồi đó nha 😆
          </p>
        )}

        {/* San choi cho 2 nut */}
        <div className="relative mt-5 h-[212px] w-full">
          <button
            type="button"
            onClick={accept}
            disabled={accepted}
            className="lb-btn-glow absolute left-1/2 top-[26%] flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-bold text-white transition-transform duration-500 active:scale-95"
            style={{
              background: accent,
              transform: `translate(-50%, -50%) scale(${agreeScale})`,
              whiteSpace: 'nowrap'
            }}
          >
            {accepted ? (
              <>
                <PartyPopper className="h-5 w-5" />
                Yêu cậu!
              </>
            ) : (
              <>
                <Heart className="h-5 w-5" fill="currentColor" />
                Đồng ý luôn
              </>
            )}
          </button>

          <button
            type="button"
            onPointerEnter={dodge}
            onPointerDown={dodge}
            onMouseEnter={dodge}
            onTouchStart={dodge}
            onFocus={dodge}
            onClick={dodge}
            disabled={accepted}
            className="absolute flex items-center gap-1.5 rounded-full px-5 py-3 text-[14px] font-semibold transition-all duration-300 disabled:opacity-0"
            style={{
              background: 'var(--lb-card)',
              border: '1.5px solid var(--lb-card-border)',
              color: 'var(--lb-text)',
              left: `${noPos.left}%`,
              top: `${noPos.top}%`,
              transform: 'translate(-50%, -50%)',
              whiteSpace: 'nowrap'
            }}
          >
            {noLabel}
          </button>
        </div>

        <p className="mt-1 text-[11px]" style={{ color: 'var(--lb-text-soft)' }}>
          {accepted ? 'Chuẩn bị mở quà nha...' : 'Bấm nút màu hồng để mở quà nhé!'}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// 14. CONG 3 - XE TUI MU (blindbox-2010)
// ============================================================================

interface BlindBoxGateProps {
  photos: string[];
  captions: string[];
  receiverName: string;
  accent: string;
  onAllOpened: () => void;
}

function BlindBoxGate({ photos, captions, receiverName, accent, onAllOpened }: BlindBoxGateProps) {
  const total = photos.length;
  const [opened, setOpened] = useState<number[]>([]);
  const [reveal, setReveal] = useState<number | null>(null);
  const [justOpened, setJustOpened] = useState<number | null>(null);
  const revealTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current);
    };
  }, []);

  const allOpened = total > 0 && opened.length >= total;

  const openBag = useCallback(
    (index: number) => {
      const isFirstTime = !opened.includes(index);
      if (isFirstTime) {
        setOpened((prev) => (prev.includes(index) ? prev : [...prev, index]));
        setJustOpened(index);
        fireConfetti(accent);
        vibrate([0, 24, 40, 24]);
      } else {
        vibrate(10);
      }
      setReveal(index);
      if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current);
    },
    [accent, opened]
  );

  const closeReveal = useCallback(() => {
    setReveal(null);
    setJustOpened(null);
    if (total > 0 && opened.length >= total) {
      fireConfetti(accent);
      onAllOpened();
    }
  }, [accent, onAllOpened, opened.length, total]);

  return (
    <div className="absolute inset-0 z-30 flex flex-col px-5 pb-6 pt-8">
      <div className="shrink-0 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em]" style={{ color: 'var(--lb-text-soft)' }}>
          Túi mù bí ẩn
        </p>
        <h3 className="mt-1 text-[19px] font-bold" style={{ color: 'var(--lb-text)' }}>
          Xé từng túi để mở quà của {receiverName || 'em'}
        </h3>
        <p className="mt-1.5 text-[12px]" style={{ color: 'var(--lb-text-soft)' }}>
          Đã mở {opened.length}/{total} túi • mở hết sẽ lộ ra bức thư 💌
        </p>
      </div>

      <div className="lb-no-scrollbar mt-5 min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-3.5 pb-4">
          {photos.map((src, index) => {
            const isOpened = opened.includes(index);
            return (
              <button
                key={`bag-${index}`}
                type="button"
                onClick={() => openBag(index)}
                className="lb-bag relative flex aspect-[4/5] flex-col items-center justify-center overflow-hidden rounded-2xl transition active:scale-95"
                style={{
                  animationDelay: `${index * 130}ms`,
                  background: isOpened
                    ? 'linear-gradient(160deg, rgba(255,255,255,0.95) 0%, rgba(233,224,255,0.9) 100%)'
                    : 'linear-gradient(160deg, #ffd166 0%, #ff8fb6 52%, #b892ff 100%)',
                  border: '1px solid var(--lb-card-border)',
                  boxShadow: isOpened ? '0 10px 26px -18px rgba(31,42,68,0.6)' : `0 16px 34px -18px ${accent}`
                }}
              >
                {isOpened ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" draggable={false} className="h-full w-full object-cover" />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/72 to-transparent px-2 pb-1.5 pt-6 text-left text-[10.5px] font-medium text-white">
                      {captions[index] || `Kỷ niệm ${index + 1}`}
                    </span>
                    <span
                      className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full"
                      style={{ background: accent }}
                    >
                      <Check className="h-3 w-3 text-white" />
                    </span>
                  </>
                ) : (
                  <>
                    <span className="lb-bag-shine pointer-events-none absolute inset-0" />
                    <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white/28 backdrop-blur-sm">
                      <Package className="h-5 w-5 text-white" />
                    </span>
                    <span className="relative mt-2 text-[26px] font-black leading-none text-white drop-shadow">?</span>
                    <span className="relative mt-1.5 text-[10.5px] font-bold tracking-wide text-white/92">
                      TÚI #{index + 1}
                    </span>
                    <span className="relative mt-0.5 text-[9.5px] text-white/80">chạm để xé</span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        {allOpened && (
          <button
            type="button"
            onClick={closeReveal}
            className="lb-btn-glow mb-2 flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[14.5px] font-bold text-white transition active:scale-95"
            style={{ background: accent }}
          >
            <PackageOpen className="h-5 w-5" />
            Mở bức thư tâm tình 💌
          </button>
        )}
      </div>

      {/* Overlay khi xe tui */}
      {reveal !== null && (
        <div className="absolute inset-0 z-[70] flex flex-col items-center justify-center bg-black/72 px-6 backdrop-blur-md">
          <div className="lb-burst relative flex w-full max-w-[340px] flex-col items-center">
            {justOpened === reveal && (
              <>
                <span
                  className="lb-burst-ring absolute left-1/2 top-1/2 h-24 w-24 rounded-full"
                  style={{ border: `3px solid ${accent}`, marginLeft: -48, marginTop: -48 }}
                />
                <span
                  className="lb-burst-ring absolute left-1/2 top-1/2 h-24 w-24 rounded-full"
                  style={{ border: '3px solid #ffd166', marginLeft: -48, marginTop: -48, animationDelay: '160ms' }}
                />
              </>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[reveal]}
              alt=""
              draggable={false}
              className="lb-pop-in w-full rounded-2xl object-cover"
              style={{ maxHeight: '46vh', boxShadow: `0 26px 60px -22px ${accent}` }}
            />
            <p className="font-script mt-3 text-center text-[21px] leading-snug text-white">
              {captions[reveal] || `Kỷ niệm ${reveal + 1}`}
            </p>
            <button
              type="button"
              onClick={closeReveal}
              className="mt-5 flex items-center gap-2 rounded-full bg-white/16 px-6 py-3 text-[13.5px] font-semibold text-white transition active:scale-95"
            >
              <Sparkles className="h-4 w-4" />
              Tuyệt vời, tiếp tục!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 15. CHE DO galaxy-3d - VONG XOAY ANH 3D
// ============================================================================

interface GalaxyRingProps {
  photos: string[];
  captions: string[];
  accent: string;
  onOpen: (index: number) => void;
}

function GalaxyRing({ photos, captions, accent, onOpen }: GalaxyRingProps) {
  const count = Math.max(photos.length, 1);
  const angleStep = 360 / count;

  const [cardWidth, setCardWidth] = useState(150);
  const [radius, setRadius] = useState(210);
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [dragging, setDragging] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);

  const rotationRef = useRef(0);
  const velocityRef = useRef(0);
  const draggingRef = useRef(false);
  const snappingRef = useRef(false);
  const autoRef = useRef(true);
  const lastXRef = useRef(0);
  const dragMovedRef = useRef(0);
  const idleTimerRef = useRef<number | null>(null);
  const activeIndexRef = useRef(0);

  const applyRotation = useCallback(
    (deg: number) => {
      const ring = ringRef.current;
      if (ring) ring.style.transform = `rotateY(${deg}deg)`;
      const step = 360 / count;
      const index = ((Math.round(-deg / step) % count) + count) % count;
      if (index !== activeIndexRef.current) {
        activeIndexRef.current = index;
        setActiveIndex(index);
      }
    },
    [count]
  );

  useEffect(() => {
    const compute = () => {
      const el = stageRef.current;
      const width = el && el.clientWidth > 0 ? el.clientWidth : 340;
      const cw = Math.max(96, Math.min(width * 0.46, 182));
      const rawRadius = (cw / 2) / Math.tan(Math.PI / count) * 1.18;
      setCardWidth(cw);
      setRadius(Math.max(Math.min(rawRadius, width * 0.7), cw * 0.74));
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('orientationchange', compute);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('orientationchange', compute);
    };
  }, [count]);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - last, 50) / 1000;
      last = now;

      if (!draggingRef.current && !snappingRef.current) {
        if (autoRef.current) {
          rotationRef.current += AUTO_ROTATE_SPEED * dt;
        } else if (Math.abs(velocityRef.current) > 0.6) {
          rotationRef.current += velocityRef.current * dt;
          velocityRef.current *= Math.pow(0.92, dt * 60);
        } else {
          velocityRef.current = 0;
        }
        applyRotation(rotationRef.current);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [applyRotation]);

  useEffect(() => {
    return () => {
      if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
    };
  }, []);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    snappingRef.current = false;
    lastXRef.current = event.clientX;
    dragMovedRef.current = 0;
    velocityRef.current = 0;
    autoRef.current = false;
    setAutoRotate(false);
    setDragging(true);
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    const el = stageRef.current;
    if (el && typeof el.setPointerCapture === 'function') {
      try {
        el.setPointerCapture(event.pointerId);
      } catch {
        /* Trinh duyet khong ho tro pointer capture - van keo duoc binh thuong */
      }
    }
  }, []);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      const dx = event.clientX - lastXRef.current;
      lastXRef.current = event.clientX;
      dragMovedRef.current += Math.abs(dx);
      const delta = dx * 0.32;
      rotationRef.current += delta;
      velocityRef.current = delta * 55;
      applyRotation(rotationRef.current);
    },
    [applyRotation]
  );

  const releasePointer = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      velocityRef.current = 0;
      autoRef.current = true;
      setAutoRotate(true);
    }, IDLE_RESUME_MS);
  }, []);

  const snapToIndex = useCallback(
    (index: number) => {
      if (dragMovedRef.current > 6) return;
      snappingRef.current = true;
      autoRef.current = false;
      setAutoRotate(false);
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }

      const step = 360 / count;
      const targetBase = -index * step;
      const start = rotationRef.current;
      const turns = Math.round((start - targetBase) / 360);
      const target = targetBase + turns * 360;
      const distance = target - start;
      const duration = 620;
      const startedAt = performance.now();

      const animate = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        rotationRef.current = start + distance * eased;
        applyRotation(rotationRef.current);
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          snappingRef.current = false;
          idleTimerRef.current = window.setTimeout(() => {
            autoRef.current = true;
            setAutoRotate(true);
          }, IDLE_RESUME_MS);
        }
      };
      requestAnimationFrame(animate);
    },
    [applyRotation, count]
  );

  return (
    <div className="shrink-0">
      <div
        ref={stageRef}
        className={`lb-stage relative h-[302px] w-full ${dragging ? 'lb-grabbing' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={releasePointer}
        onPointerCancel={releasePointer}
        onPointerLeave={releasePointer}
      >
        {photos.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm" style={{ color: 'var(--lb-text-soft)' }}>
              Chưa có ảnh kỷ niệm nào
            </p>
          </div>
        ) : (
          <div ref={ringRef} className="lb-ring absolute left-1/2 top-1/2 h-0 w-0" style={{ transform: 'rotateY(0deg)' }}>
            {photos.map((src, index) => {
              const isActive = index === activeIndex;
              const caption = captions[index];
              return (
                <div
                  key={`${src}-${index}`}
                  className="lb-card lb-glass-frame absolute overflow-hidden rounded-2xl transition-[box-shadow,opacity,transform] duration-300"
                  style={{
                    width: cardWidth,
                    height: cardWidth,
                    marginLeft: -cardWidth / 2,
                    marginTop: -cardWidth / 2,
                    transform: `rotateY(${index * angleStep}deg) translateZ(${radius}px)`,
                    opacity: isActive ? 1 : 0.68,
                    padding: 6,
                    background: 'rgba(255,255,255,0.1)',
                    border: `1px solid ${isActive ? accent : 'rgba(255,255,255,0.24)'}`,
                    boxShadow: isActive
                      ? `0 26px 50px -18px rgba(0,0,0,0.62), 0 0 26px -2px ${accent}`
                      : '0 14px 30px -18px rgba(0,0,0,0.55)'
                  }}
                  onClick={() => snapToIndex(index)}
                >
                  <div className="relative h-full w-full overflow-hidden rounded-xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={`Ảnh kỷ niệm ${index + 1}`}
                      loading="lazy"
                      draggable={false}
                      className="h-full w-full object-cover"
                    />
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{
                        background:
                          'linear-gradient(180deg, rgba(255,255,255,.16) 0%, rgba(0,0,0,0) 34%, rgba(0,0,0,.28) 100%)'
                      }}
                    />
                    {caption && (
                      <span
                        className="pointer-events-none absolute inset-x-0 bottom-0 px-2 pb-1.5 pt-6 text-center text-[10.5px] font-semibold leading-tight text-white"
                        style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.62) 100%)' }}
                      >
                        {caption}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div
          className="pointer-events-none absolute bottom-3 left-1/2 h-10 w-3/5 -translate-x-1/2 rounded-[50%] blur-2xl"
          style={{ background: accent, opacity: 0.24 }}
        />

        {photos.length > 1 && (
          <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
            {photos.map((_, index) => (
              <span
                key={`dot-${index}`}
                className="block rounded-full transition-all duration-300"
                style={{
                  width: index === activeIndex ? 16 : 5,
                  height: 5,
                  background: index === activeIndex ? accent : 'rgba(255,255,255,0.34)'
                }}
              />
            ))}
          </div>
        )}
      </div>

      <p className="pb-1 text-center text-[10px] tracking-wide" style={{ color: 'var(--lb-text-soft)' }}>
        {autoRotate ? 'Kéo ngang để xoay • Chạm ảnh để ngắm kỹ' : 'Đang xem ảnh bạn chọn'}
      </p>

      <button
        type="button"
        onClick={() => onOpen(activeIndex)}
        className="mx-auto mt-1 flex items-center gap-1.5 rounded-full px-4 py-2 text-[11.5px] font-semibold transition active:scale-95"
        style={{ background: 'var(--lb-card)', border: '1px solid var(--lb-card-border)', color: accent }}
      >
        <Star className="h-3.5 w-3.5" />
        Xem ảnh lớn + lời chú thích
      </button>
    </div>
  );
}

// ============================================================================
// 16. CHE DO polaroid-vinyl - DIA THAN + SO ANH POLAROID
// ============================================================================

interface VinylPlayerProps {
  playing: boolean;
  accent: string;
  receiverName: string;
  senderName: string;
}

function VinylPlayer({ playing, accent, receiverName, senderName }: VinylPlayerProps) {
  const initial = (receiverName || senderName || 'L').trim().charAt(0).toUpperCase();

  return (
    <div className="relative mx-auto mt-1 h-[150px] w-[150px] shrink-0">
      <div
        className="lb-vinyl absolute inset-0 rounded-full"
        style={{
          animationPlayState: playing ? 'running' : 'paused',
          background:
            'radial-gradient(circle at 50% 50%, #2c2c36 0%, #16161d 42%, #2a2a36 43%, #101015 44%, #1d1d26 72%, #0d0d12 100%)',
          boxShadow: '0 22px 44px -20px rgba(0,0,0,0.75), inset 0 0 0 2px rgba(255,255,255,0.06)'
        }}
      >
        <span className="absolute inset-[14%] rounded-full" style={{ border: '1px solid rgba(255,255,255,0.07)' }} />
        <span className="absolute inset-[26%] rounded-full" style={{ border: '1px solid rgba(255,255,255,0.06)' }} />
        <span className="absolute inset-[38%] rounded-full" style={{ border: '1px solid rgba(255,255,255,0.05)' }} />

        <span
          className="absolute left-1/2 top-1/2 flex h-[50px] w-[50px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
          style={{ background: accent, boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.35)' }}
        >
          <span className="font-script text-[22px] font-bold text-white">{initial}</span>
        </span>
        <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/85" />
      </div>

      {/* Can gat may hat */}
      <div className="pointer-events-none absolute -right-1 top-0 h-[104px] w-[9px] origin-top" style={{ transform: playing ? 'rotate(26deg)' : 'rotate(-7deg)', transition: 'transform 900ms cubic-bezier(0.22, 0.8, 0.2, 1)' }}>
        <span className="block h-full w-full rounded-full" style={{ background: 'linear-gradient(180deg, #f4f4f5 0%, #a1a1aa 60%, #71717a 100%)' }} />
        <span className="absolute -bottom-1.5 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full" style={{ background: 'linear-gradient(160deg,#fafafa,#a1a1aa)' }} />
      </div>
      <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full" style={{ background: 'linear-gradient(160deg,#fafafa,#a1a1aa)', boxShadow: '0 4px 10px -3px rgba(0,0,0,0.6)' }} />

      {/* Song nhac gia lap */}
      <div className="absolute -bottom-1 left-1/2 flex h-8 -translate-x-1/2 items-end gap-[3px]">
        {[0, 1, 2, 3, 4].map((bar) => (
          <span
            key={`eq-${bar}`}
            className={`lb-eq-bar w-[3px] rounded-full ${playing ? '' : 'lb-eq-paused'}`}
            style={{ background: accent, animationDelay: `${bar * 130}ms`, height: `${10 + ((bar * 7) % 18)}px` }}
          />
        ))}
      </div>
    </div>
  );
}

interface PolaroidAlbumProps {
  photos: string[];
  captions: string[];
  accent: string;
  onOpen: (index: number) => void;
}

function PolaroidAlbum({ photos, captions, accent, onOpen }: PolaroidAlbumProps) {
  const total = photos.length;
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);

  const goTo = useCallback(
    (next: number, dir: 'next' | 'prev') => {
      if (total === 0) return;
      setDirection(dir);
      setIndex(((next % total) + total) % total);
      vibrate(8);
    },
    [total]
  );

  const goNext = useCallback(() => goTo(index + 1, 'next'), [goTo, index]);
  const goPrev = useCallback(() => goTo(index - 1, 'prev'), [goTo, index]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    startXRef.current = event.clientX;
    startYRef.current = event.clientY;
  }, []);

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const startX = startXRef.current;
      const startY = startYRef.current;
      startXRef.current = null;
      startYRef.current = null;
      if (startX === null || startY === null) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.abs(dx) < 42 || Math.abs(dx) < Math.abs(dy)) return;
      if (dx < 0) goNext();
      else goPrev();
    },
    [goNext, goPrev]
  );

  if (total === 0) {
    return (
      <p className="py-10 text-center text-sm" style={{ color: 'var(--lb-text-soft)' }}>
        Chưa có ảnh kỷ niệm nào
      </p>
    );
  }

  const caption = captions[index];

  return (
    <div className="shrink-0">
      <div
        className="lb-stage relative h-[336px] w-full"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          startXRef.current = null;
          startYRef.current = null;
        }}
        style={{ touchAction: 'pan-y' }}
      >
        {/* The phia sau tao do sau */}
        {total > 1 && (
          <>
            <div
              className="absolute left-1/2 top-1/2 h-[268px] w-[228px] rounded-[10px] bg-white/70"
              style={{ transform: 'translate(-50%, -46%) rotate(-8deg)', boxShadow: '0 12px 26px -18px rgba(74,53,36,0.6)' }}
            />
            <div
              className="absolute left-1/2 top-1/2 h-[268px] w-[228px] rounded-[10px] bg-white/85"
              style={{ transform: 'translate(-50%, -48%) rotate(5deg)', boxShadow: '0 12px 26px -16px rgba(74,53,36,0.55)' }}
            />
          </>
        )}

        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(-50%, -50%) rotate(${polaroidTilt(index)}deg)`
          }}
        >
          <div key={index} className={direction === 'next' ? 'lb-polaroid-in' : 'lb-polaroid-in-rev'}>
            <button
              type="button"
              onClick={() => onOpen(index)}
              className="relative block rounded-[10px] bg-white p-3 pb-[58px] text-left transition active:scale-[0.98]"
              style={{ boxShadow: '0 26px 48px -22px rgba(74,53,36,0.72), 0 2px 0 rgba(255,255,255,0.9) inset' }}
            >
              <span
                className="absolute -top-3 left-1/2 h-6 w-6 -translate-x-1/2 rounded-full"
                style={{ background: 'linear-gradient(160deg,#ffe08a,#e0a93b)', boxShadow: '0 4px 8px -2px rgba(0,0,0,0.4)' }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photos[index]}
                alt={`Ảnh kỷ niệm ${index + 1}`}
                draggable={false}
                className="h-[204px] w-[204px] rounded-[4px] object-cover"
                style={{ background: '#efe6d6' }}
              />
              <span className="absolute inset-x-3 bottom-3 block text-center">
                <span className="font-script block truncate text-[19px] leading-tight" style={{ color: '#3f2d1d' }}>
                  {caption || `Kỷ niệm ${index + 1}`}
                </span>
                <span className="mt-0.5 block text-[10px]" style={{ color: 'rgba(63,45,29,0.5)' }}>
                  {index + 1} / {total} • chạm để xem lớn
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="mt-1 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={goPrev}
          aria-label="Ảnh trước"
          className="flex h-10 w-10 items-center justify-center rounded-full transition active:scale-90"
          style={{ background: 'var(--lb-card)', border: '1px solid var(--lb-card-border)', color: accent }}
        >
          <ChevronLeft className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
        </button>
        <div className="flex items-center gap-1.5">
          {photos.map((_, dotIndex) => (
            <span
              key={`pol-dot-${dotIndex}`}
              className="block rounded-full transition-all duration-300"
              style={{
                width: dotIndex === index ? 16 : 5,
                height: 5,
                background: dotIndex === index ? accent : 'var(--lb-card-border)'
              }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={goNext}
          aria-label="Ảnh sau"
          className="flex h-10 w-10 items-center justify-center rounded-full transition active:scale-90"
          style={{ background: 'var(--lb-card)', border: '1px solid var(--lb-card-border)', color: accent }}
        >
          <ChevronRight className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// 17. ALBUM DANG LUOI (dung cho sweet-trap va blindbox sau khi mo khoa)
// ============================================================================

interface PhotoGridAlbumProps {
  photos: string[];
  captions: string[];
  accent: string;
  onOpen: (index: number) => void;
  note: string;
}

function PhotoGridAlbum({ photos, captions, accent, onOpen, note }: PhotoGridAlbumProps) {
  return (
    <div className="shrink-0">
      <div className="mb-2 flex items-center gap-2">
        <Disc3 className="h-3.5 w-3.5" style={{ color: accent }} />
        <span className="text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: 'var(--lb-text-soft)' }}>
          {note}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {photos.map((src, index) => (
          <button
            key={`grid-${src}-${index}`}
            type="button"
            onClick={() => onOpen(index)}
            className="lb-card-in relative aspect-square overflow-hidden rounded-2xl transition active:scale-[0.97]"
            style={{
              animationDelay: `${index * 70}ms`,
              border: '1px solid var(--lb-card-border)',
              boxShadow: '0 12px 26px -18px rgba(31,42,68,0.6)'
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`Ảnh kỷ niệm ${index + 1}`} draggable={false} className="h-full w-full object-cover" />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/74 to-transparent px-2 pb-1.5 pt-7 text-left text-[10.5px] font-medium leading-tight text-white">
              {captions[index] || `Kỷ niệm ${index + 1}`}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 18. COMPONENT CHINH
// ============================================================================

export default function Gift3DViewer({
  receiverName,
  senderName,
  message,
  photos,
  themeId,
  musicId,
  className = '',
  isPreview = false,
  autoOpen = false,
  templateStyle = DEFAULT_TEMPLATE_STYLE,
  passcode,
  passcodeHint,
  scratchMessage,
  coupons,
  photoCaptions
}: Gift3DViewerProps) {
  const theme = useMemo(() => getTheme(themeId), [themeId]);
  const track = useMemo(() => getMusicTrack(musicId), [musicId]);

  const style: TemplateStyle = isTemplateStyle(templateStyle) ? templateStyle : DEFAULT_TEMPLATE_STYLE;

  const visiblePhotos = useMemo(() => cleanPhotos(photos), [photos]);
  const captions = useMemo(
    () => visiblePhotos.map((_, index) => (photoCaptions?.[index] ?? '').trim()),
    [visiblePhotos, photoCaptions]
  );
  const couponList = useMemo(
    () => (coupons ?? []).map((item) => (typeof item === 'string' ? item.trim() : '')).filter((item) => item.length > 0),
    [coupons]
  );
  const scratchText = (scratchMessage ?? '').trim();

  const normalizedPasscode = useMemo(() => {
    const raw = (passcode ?? '').trim();
    return /^\d{4}$/.test(raw) ? raw : '';
  }, [passcode]);
  const hasPasscode = normalizedPasscode.length === 4;

  const accent = theme.vars['--lb-accent'];
  const particleColors = useMemo(
    () => [theme.vars['--lb-particle-1'], theme.vars['--lb-particle-2'], theme.vars['--lb-particle-3']],
    [theme]
  );

  const rootVars = useMemo(
    () => ({
      ...(theme.vars as React.CSSProperties),
      ...(TEMPLATE_VAR_OVERRIDES[style] as React.CSSProperties)
    }),
    [theme, style]
  );

  /** Cong dau tien cua tung kieu trinh dien (khi khong co mat khau) */
  const firstGate = useCallback(
    (target: TemplateStyle): GateStage =>
      target === 'sweet-trap' ? 'trap' : target === 'blindbox-2010' ? 'blindbox' : 'envelope',
    []
  );

  const [stage, setStage] = useState<GateStage>(() => {
    if (autoOpen) return 'content';
    if (hasPasscode) return 'passcode';
    return style === 'sweet-trap' ? 'trap' : style === 'blindbox-2010' ? 'blindbox' : 'envelope';
  });
  const [replayKey, setReplayKey] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [sourceIndex, setSourceIndex] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const openTimerRef = useRef<number | null>(null);

  const isContent = stage === 'content';
  const musicSrc = sourceIndex === 0 ? track.src : track.fallback;

  // Doi kieu trinh dien hoac them/bot mat khau -> quay ve cong dau tien
  const gateSignature = `${style}|${hasPasscode ? normalizedPasscode : 'none'}`;
  const gateSignatureRef = useRef(gateSignature);
  useEffect(() => {
    if (gateSignatureRef.current === gateSignature) return;
    gateSignatureRef.current = gateSignature;
    if (autoOpen) return;
    setLightboxIndex(null);
    setStage(hasPasscode ? 'passcode' : firstGate(style));
  }, [autoOpen, firstGate, gateSignature, hasPasscode, style]);

  useEffect(() => {
    return () => {
      if (openTimerRef.current !== null) window.clearTimeout(openTimerRef.current);
    };
  }, []);

  // --------------------------------------------------------------------------
  // NHAC NEN
  // --------------------------------------------------------------------------
  const playMusic = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      audio.volume = 0.55;
      audio.muted = muted;
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  }, [muted]);

  const musicActive = stage === 'trap' || stage === 'blindbox' || stage === 'content';

  useEffect(() => {
    if (!musicActive) return;
    void playMusic();
  }, [musicActive, sourceIndex, playMusic]);

  const handleAudioError = useCallback(() => {
    if (sourceIndex === 0 && track.fallback && track.fallback !== track.src) {
      setSourceIndex(1);
    }
  }, [sourceIndex, track]);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    const next = !muted;
    setMuted(next);
    if (!audio) return;
    audio.muted = next;
    if (!next && audio.paused && musicActive) {
      void audio
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    }
  }, [muted, musicActive]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    } else {
      audio.pause();
      setPlaying(false);
    }
  }, []);

  // --------------------------------------------------------------------------
  // DIEU KHIEN CAC CONG
  // --------------------------------------------------------------------------
  const handleOpenEnvelope = useCallback(() => {
    setStage((prev) => {
      if (prev !== 'envelope') return prev;
      return 'opening';
    });
    if (openTimerRef.current !== null) window.clearTimeout(openTimerRef.current);
    openTimerRef.current = window.setTimeout(() => setStage('content'), OPEN_ANIMATION_MS);
  }, []);

  const handlePasscodeUnlocked = useCallback(() => {
    setStage(firstGate(style));
  }, [firstGate, style]);

  const handleTrapAgreed = useCallback(() => {
    setStage('content');
  }, []);

  const handleBlindBoxAllOpened = useCallback(() => {
    setStage('content');
  }, []);

  const handleReplay = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setPlaying(false);
    setSourceIndex(0);
    setLightboxIndex(null);
    setReplayKey((key) => key + 1);

    if (hasPasscode) {
      setStage('passcode');
      return;
    }

    // Kieu co cong rieng (bay tinh yeu / tui mu) thi quay ve dung cong do
    const gate = firstGate(style);
    if (gate !== 'envelope') {
      setStage(gate);
      return;
    }

    setStage('envelope');
    window.setTimeout(() => {
      setStage('opening');
      if (openTimerRef.current !== null) window.clearTimeout(openTimerRef.current);
      openTimerRef.current = window.setTimeout(() => setStage('content'), OPEN_ANIMATION_MS);
    }, 160);
  }, [firstGate, hasPasscode, style]);

  useEffect(() => {
    if (!autoOpen) return;
    const timer = window.setTimeout(() => setStage('content'), 320);
    return () => window.clearTimeout(timer);
  }, [autoOpen]);

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------
  const gridNote = style === 'blindbox-2010' ? 'Album vừa mở từ túi mù' : 'Album kỷ niệm của chúng mình';

  return (
    <div
      className={`relative h-full w-full overflow-hidden ${className}`}
      style={{
        ...rootVars,
        background: 'linear-gradient(165deg, var(--lb-bg-1) 0%, var(--lb-bg-2) 58%, var(--lb-bg-3) 100%)'
      }}
    >
      {/* Anh sang nen mo */}
      <div
        className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full blur-3xl"
        style={{ background: accent, opacity: 0.26 }}
      />
      <div
        className="pointer-events-none absolute -bottom-28 -right-20 h-72 w-72 rounded-full blur-3xl"
        style={{ background: 'var(--lb-accent-soft)', opacity: 0.22 }}
      />

      {style === 'galaxy-3d' && <Starfield />}

      <FallingCanvas active={isContent} colors={particleColors} />
      {style === 'galaxy-3d' && <SparkleCanvas active={isContent} colors={particleColors} />}

      {/* ------------------------------------------------------------------ */}
      {/* NOI DUNG CHINH                                                      */}
      {/* ------------------------------------------------------------------ */}
      <div
        className={`lb-no-scrollbar absolute inset-0 overflow-y-auto transition-opacity duration-700 ${
          isContent ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div className="mx-auto flex min-h-full w-full max-w-[520px] flex-col px-4 pb-9 pt-14">
          <header className="shrink-0 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em]" style={{ color: 'var(--lb-text-soft)' }}>
              Món quà dành cho
            </p>
            <h2 className="font-script mt-1 text-4xl leading-tight" style={{ color: accent }}>
              {receiverName || 'Người thương'}
            </h2>
            <p className="mt-1 text-[11px]" style={{ color: 'var(--lb-text-soft)' }}>
              {TEMPLATE_META[style].emoji} {TEMPLATE_META[style].name}
            </p>
          </header>

          <div className="mt-3">
            {style === 'galaxy-3d' && (
              <GalaxyRing photos={visiblePhotos} captions={captions} accent={accent} onOpen={setLightboxIndex} />
            )}

            {style === 'polaroid-vinyl' && (
              <>
                <VinylPlayer
                  playing={playing && !muted}
                  accent={accent}
                  receiverName={receiverName}
                  senderName={senderName}
                />
                <PolaroidAlbum photos={visiblePhotos} captions={captions} accent={accent} onOpen={setLightboxIndex} />
              </>
            )}

            {(style === 'sweet-trap' || style === 'blindbox-2010') && (
              <PhotoGridAlbum
                photos={visiblePhotos}
                captions={captions}
                accent={accent}
                onOpen={setLightboxIndex}
                note={gridNote}
              />
            )}
          </div>

          <TypewriterLetter
            message={message}
            senderName={senderName}
            accent={accent}
            active={isContent}
            replayKey={replayKey}
          />

          {scratchText.length > 0 && <ScratchCard message={scratchText} accent={accent} />}

          {couponList.length > 0 && <LoveCoupons coupons={couponList} accent={accent} />}

          <p className="mt-6 text-center text-[10.5px]" style={{ color: 'var(--lb-text-soft)' }}>
            Gửi từ {senderName || 'người thương'} • LoveBox 3D
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* DIEU KHIEN NHAC                                                     */}
      {/* ------------------------------------------------------------------ */}
      <div
        className={`absolute right-3 top-3 z-40 flex items-center gap-1.5 transition-opacity duration-500 ${
          isContent ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? 'Tạm dừng nhạc' : 'Phát nhạc'}
          className="flex h-9 w-9 items-center justify-center rounded-full transition active:scale-90"
          style={{ background: 'var(--lb-card)', border: '1px solid var(--lb-card-border)', color: accent }}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? 'Bật tiếng' : 'Tắt tiếng'}
          className="flex h-9 w-9 items-center justify-center rounded-full transition active:scale-90"
          style={{ background: 'var(--lb-card)', border: '1px solid var(--lb-card-border)', color: accent }}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={handleReplay}
          aria-label="Xem lại từ đầu"
          className="flex h-9 w-9 items-center justify-center rounded-full transition active:scale-90"
          style={{ background: 'var(--lb-card)', border: '1px solid var(--lb-card-border)', color: accent }}
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* CAC CONG MO QUA                                                     */}
      {/* ------------------------------------------------------------------ */}
      {stage === 'passcode' && (
        <PasscodeLock
          passcode={normalizedPasscode}
          hint={passcodeHint}
          receiverName={receiverName}
          accent={accent}
          onUnlock={handlePasscodeUnlocked}
        />
      )}

      {(stage === 'envelope' || stage === 'opening') && (
        <EnvelopeGate
          stage={stage}
          receiverName={receiverName}
          trackName={track.name}
          photos={visiblePhotos}
          accent={accent}
          onOpen={handleOpenEnvelope}
        />
      )}

      {stage === 'trap' && (
        <SweetTrapGame
          receiverName={receiverName}
          senderName={senderName}
          accent={accent}
          onAgree={handleTrapAgreed}
        />
      )}

      {stage === 'blindbox' && (
        <BlindBoxGate
          photos={visiblePhotos}
          captions={captions}
          receiverName={receiverName}
          accent={accent}
          onAllOpened={handleBlindBoxAllOpened}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* LIGHTBOX                                                            */}
      {/* ------------------------------------------------------------------ */}
      {lightboxIndex !== null && visiblePhotos.length > 0 && (
        <PhotoLightbox
          photos={visiblePhotos}
          captions={captions}
          index={Math.min(lightboxIndex, visiblePhotos.length - 1)}
          accent={accent}
          onClose={() => setLightboxIndex(null)}
          onChange={setLightboxIndex}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* WATERMARK BAN XEM THU                                               */}
      {/* ------------------------------------------------------------------ */}
      {isPreview && (
        <div className="lb-watermark">
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={`wm-${index}`} className="lb-watermark__row" style={{ top: `${index * 12 + 1}%` }}>
              LoveBox 3D • Bản xem thử • Chưa mở khóa
            </div>
          ))}
        </div>
      )}

      {/* Trinh phat nhac an */}
      <audio
        key={`${musicId}-${sourceIndex}-${replayKey}`}
        ref={audioRef}
        src={musicSrc}
        loop
        preload="auto"
        playsInline
        onError={handleAudioError}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
    </div>
  );
}
