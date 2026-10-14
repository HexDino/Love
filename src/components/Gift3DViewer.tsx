'use client';

// ============================================================================
// LoveBox 3D - Gift3DViewer
// Trinh dien mon qua:
//   1. Phong thu dong -> cham de mo (CSS 3D rotateX, khong dung WebGL)
//   2. Nhac nen tu dong phat sau khi mo
//   3. Vong xoay anh 3D (transform-style: preserve-3d) + vuot tay tren mobile
//   4. Hieu ung go chu (Typewriter) cho loi chuc
//   5. Mua tim / canh hoa roi bang HTML5 Canvas
// ============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Gift, Heart, Music2, Pause, Play, RotateCcw, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { getMusicTrack, getTheme, type ThemeId } from '@/lib/constants';

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
  /** Mo san phong thu (dung cho trang nguoi nhan xem qua tang) */
  autoOpen?: boolean;
}

type Stage = 'closed' | 'opening' | 'open';

const MAX_VISIBLE_PHOTOS = 8;
const OPEN_ANIMATION_MS = 1150;
const AUTO_ROTATE_SPEED = 12; // do/giay
const IDLE_RESUME_MS = 2400;
const TYPE_INTERVAL_MS = 34;

// ============================================================================
// MUA TIM / CANH HOA ROI (HTML5 Canvas)
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
// GIFT 3D VIEWER
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
  autoOpen = false
}: Gift3DViewerProps) {
  const theme = useMemo(() => getTheme(themeId), [themeId]);
  const track = useMemo(() => getMusicTrack(musicId), [musicId]);

  const visiblePhotos = useMemo(
    () => photos.filter((src) => typeof src === 'string' && src.trim().length > 0).slice(0, MAX_VISIBLE_PHOTOS),
    [photos]
  );
  const count = Math.max(visiblePhotos.length, 1);
  const angleStep = 360 / count;

  const particleColors = useMemo(
    () => [
      theme.vars['--lb-particle-1'],
      theme.vars['--lb-particle-2'],
      theme.vars['--lb-particle-3']
    ],
    [theme]
  );

  // --------------------------------------------------------------------------
  // STATE
  // --------------------------------------------------------------------------
  const [stage, setStage] = useState<Stage>(autoOpen ? 'open' : 'closed');
  const [replayKey, setReplayKey] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [cardWidth, setCardWidth] = useState(150);
  const [radius, setRadius] = useState(210);
  const [autoRotate, setAutoRotate] = useState(true);
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [typed, setTyped] = useState('');
  const [sourceIndex, setSourceIndex] = useState(0);

  // --------------------------------------------------------------------------
  // REFS DUNG CHO VONG LAP ANIMATION (tranh re-render 60fps)
  // --------------------------------------------------------------------------
  const stageRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const rotationRef = useRef(0);
  const velocityRef = useRef(0);
  const draggingRef = useRef(false);
  const snappingRef = useRef(false);
  const autoRef = useRef(true);
  const lastXRef = useRef(0);
  const dragMovedRef = useRef(0);
  const idleTimerRef = useRef<number | null>(null);
  const activeIndexRef = useRef(0);

  const musicSrc = sourceIndex === 0 ? track.src : track.fallback;
  const isTyping = typed.length < message.length;

  // --------------------------------------------------------------------------
  // AP DUNG GOC XOAY TRUC TIEP LEN DOM
  // --------------------------------------------------------------------------
  const applyRotation = useCallback(
    (deg: number) => {
      const ring = ringRef.current;
      if (ring) {
        ring.style.transform = `rotateY(${deg}deg)`;
      }
      const step = 360 / count;
      const index = ((Math.round(-deg / step) % count) + count) % count;
      if (index !== activeIndexRef.current) {
        activeIndexRef.current = index;
        setActiveIndex(index);
      }
    },
    [count]
  );

  // --------------------------------------------------------------------------
  // TINH BAN KINH VONG XOAY THEO KICH THUOC MAN HINH
  // --------------------------------------------------------------------------
  useEffect(() => {
    const compute = () => {
      const el = stageRef.current;
      const width = el && el.clientWidth > 0 ? el.clientWidth : 340;
      const cw = Math.max(94, Math.min(width * 0.44, 178));
      const rawRadius = (cw / 2) / Math.tan(Math.PI / count) * 1.16;
      setCardWidth(cw);
      setRadius(Math.max(Math.min(rawRadius, width * 0.68), cw * 0.72));
    };

    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('orientationchange', compute);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('orientationchange', compute);
    };
  }, [count, stage]);

  // --------------------------------------------------------------------------
  // VONG LAP XOAY TU DONG + QUAN TINH SAU KHI VUOT
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (stage !== 'open') return;
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
  }, [stage, applyRotation]);

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

  useEffect(() => {
    if (stage !== 'open') return;
    void playMusic();
  }, [stage, sourceIndex, playMusic]);

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
    if (!next && audio.paused && stage === 'open') {
      void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  }, [muted, stage]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      audio.pause();
      setPlaying(false);
    }
  }, []);

  // --------------------------------------------------------------------------
  // MO PHONG THU
  // --------------------------------------------------------------------------
  const handleOpen = useCallback(() => {
    if (stage !== 'closed') return;
    setStage('opening');
    window.setTimeout(() => {
      setStage('open');
    }, OPEN_ANIMATION_MS);
  }, [stage]);

  useEffect(() => {
    if (!autoOpen) return;
    const timer = window.setTimeout(() => setStage('open'), 400);
    return () => window.clearTimeout(timer);
  }, [autoOpen]);

  const handleReplay = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setPlaying(false);
    setTyped('');
    setSourceIndex(0);
    setReplayKey((key) => key + 1);
    rotationRef.current = 0;
    velocityRef.current = 0;
    activeIndexRef.current = 0;
    setActiveIndex(0);
    autoRef.current = true;
    setAutoRotate(true);
    setStage('closed');
    window.setTimeout(() => {
      setStage('opening');
      window.setTimeout(() => setStage('open'), OPEN_ANIMATION_MS);
    }, 160);
  }, []);

  // --------------------------------------------------------------------------
  // HIEU UNG GO CHU
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (stage !== 'open') {
      setTyped('');
      return;
    }
    setTyped('');
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setTyped(message.slice(0, index));
      if (index >= message.length) {
        window.clearInterval(timer);
      }
    }, TYPE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [stage, message, replayKey]);

  // --------------------------------------------------------------------------
  // VUOT TAY / CHUOT DE XOAY
  // --------------------------------------------------------------------------
  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (stage !== 'open') return;
      draggingRef.current = true;
      snappingRef.current = false;
      lastXRef.current = event.clientX;
      dragMovedRef.current = 0;
      velocityRef.current = 0;
      autoRef.current = false;
      setAutoRotate(false);
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
    },
    [stage]
  );

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
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
    }
    idleTimerRef.current = window.setTimeout(() => {
      velocityRef.current = 0;
      autoRef.current = true;
      setAutoRotate(true);
    }, IDLE_RESUME_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
      }
    };
  }, []);

  // --------------------------------------------------------------------------
  // CHAM VAO ANH -> XOAY ANH DO RA TRUOC
  // --------------------------------------------------------------------------
  const snapToIndex = useCallback(
    (index: number) => {
      if (stage !== 'open') return;
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
    [stage, count, applyRotation]
  );

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------
  const isOpen = stage === 'open';

  return (
    <div
      className={`relative h-full w-full overflow-hidden ${className}`}
      style={{
        ...(theme.vars as React.CSSProperties),
        background: 'linear-gradient(165deg, var(--lb-bg-1) 0%, var(--lb-bg-2) 58%, var(--lb-bg-3) 100%)'
      }}
    >
      {/* Anh sang nen mo (ambient blobs) */}
      <div
        className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full blur-3xl"
        style={{ background: 'var(--lb-accent)', opacity: 0.28 }}
      />
      <div
        className="pointer-events-none absolute -bottom-28 -right-20 h-72 w-72 rounded-full blur-3xl"
        style={{ background: 'var(--lb-accent-soft)', opacity: 0.24 }}
      />

      {/* Mua tim / canh hoa roi */}
      <FallingCanvas active={isOpen} colors={particleColors} />

      {/* ------------------------------------------------------------------ */}
      {/* NOI DUNG KHI DA MO                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div
        className={`absolute inset-0 flex flex-col transition-opacity duration-700 ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <header className="shrink-0 px-5 pt-6 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em]" style={{ color: 'var(--lb-text-soft)' }}>
            Món quà dành cho
          </p>
          <h2 className="font-script mt-1 text-4xl leading-tight" style={{ color: 'var(--lb-accent)' }}>
            {receiverName || 'Người thương'}
          </h2>
        </header>

        {/* VONG XOAY ANH 3D */}
        <div
          ref={stageRef}
          className={`lb-stage lb-drag relative min-h-[210px] flex-1 ${draggingRef.current ? 'lb-grabbing' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={releasePointer}
          onPointerCancel={releasePointer}
          onPointerLeave={releasePointer}
        >
          {visiblePhotos.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm" style={{ color: 'var(--lb-text-soft)' }}>
                Chưa có ảnh kỷ niệm nào
              </p>
            </div>
          ) : (
            <div
              ref={ringRef}
              className="lb-ring absolute left-1/2 top-1/2 h-0 w-0"
              style={{ transform: 'rotateY(0deg)' }}
            >
              {visiblePhotos.map((src, index) => {
                const isActive = index === activeIndex;
                return (
                  <div
                    key={`${src}-${index}`}
                    className="lb-card absolute overflow-hidden rounded-2xl transition-[box-shadow,opacity] duration-300"
                    style={{
                      width: cardWidth,
                      height: cardWidth,
                      marginLeft: -cardWidth / 2,
                      marginTop: -cardWidth / 2,
                      transform: `rotateY(${index * angleStep}deg) translateZ(${radius}px)`,
                      opacity: isActive ? 1 : 0.72,
                      boxShadow: isActive
                        ? '0 24px 46px -16px rgba(0,0,0,.6), 0 0 0 3px var(--lb-accent)'
                        : '0 14px 28px -16px rgba(0,0,0,.5), 0 0 0 2px var(--lb-card-border)',
                      background: 'var(--lb-card)'
                    }}
                    onClick={() => snapToIndex(index)}
                  >
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
                          'linear-gradient(180deg, rgba(255,255,255,.14) 0%, rgba(0,0,0,0) 32%, rgba(0,0,0,.22) 100%)'
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Anh phan chieu san */}
          <div
            className="pointer-events-none absolute bottom-1 left-1/2 h-10 w-3/5 -translate-x-1/2 rounded-[50%] blur-2xl"
            style={{ background: 'var(--lb-accent)', opacity: 0.22 }}
          />

          {/* Cham trang thai anh */}
          {visiblePhotos.length > 1 && (
            <div className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
              {visiblePhotos.map((_, index) => (
                <span
                  key={`dot-${index}`}
                  className="block rounded-full transition-all duration-300"
                  style={{
                    width: index === activeIndex ? 16 : 5,
                    height: 5,
                    background: index === activeIndex ? 'var(--lb-accent)' : 'var(--lb-card-border)'
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <p
          className="shrink-0 pb-1 text-center text-[10px] tracking-wide"
          style={{ color: 'var(--lb-text-soft)' }}
        >
          {autoRotate ? 'Kéo ngang để xoay • Chạm ảnh để ngắm kỹ' : 'Đang xem ảnh bạn chọn'}
        </p>

        {/* BUC THU GO CHU */}
        <div className="shrink-0 px-4 pb-4">
          <div
            className="rounded-3xl p-4"
            style={{
              background: 'var(--lb-card)',
              border: '1px solid var(--lb-card-border)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)'
            }}
          >
            <div className="mb-2 flex items-center gap-2">
              <Heart className="h-3.5 w-3.5" style={{ color: 'var(--lb-accent)' }} fill="currentColor" />
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.24em]"
                style={{ color: 'var(--lb-text-soft)' }}
              >
                Lời nhắn gửi em
              </span>
            </div>
            <p
              className="whitespace-pre-wrap text-[13.5px] leading-relaxed"
              style={{ color: 'var(--lb-text)' }}
            >
              {typed}
              {isTyping && (
                <span
                  className="ml-0.5 inline-block h-4 w-[2px] animate-pulse align-middle"
                  style={{ background: 'var(--lb-accent)' }}
                />
              )}
            </p>
            <p className="font-script mt-3 text-right text-xl" style={{ color: 'var(--lb-accent)' }}>
              — {senderName || 'Người gửi'}
            </p>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* DIEU KHIEN NHAC                                                     */}
      {/* ------------------------------------------------------------------ */}
      <div
        className={`absolute right-3 top-3 z-40 flex items-center gap-1.5 transition-opacity duration-500 ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? 'Tạm dừng nhạc' : 'Phát nhạc'}
          className="flex h-9 w-9 items-center justify-center rounded-full transition active:scale-90"
          style={{ background: 'var(--lb-card)', border: '1px solid var(--lb-card-border)', color: 'var(--lb-accent)' }}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? 'Bật tiếng' : 'Tắt tiếng'}
          className="flex h-9 w-9 items-center justify-center rounded-full transition active:scale-90"
          style={{ background: 'var(--lb-card)', border: '1px solid var(--lb-card-border)', color: 'var(--lb-accent)' }}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={handleReplay}
          aria-label="Xem lại từ đầu"
          className="flex h-9 w-9 items-center justify-center rounded-full transition active:scale-90"
          style={{ background: 'var(--lb-card)', border: '1px solid var(--lb-card-border)', color: 'var(--lb-accent)' }}
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* PHONG THU DONG                                                      */}
      {/* ------------------------------------------------------------------ */}
      {stage !== 'open' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-7 px-6">
          <div className={`lb-envelope-scene ${stage === 'opening' ? 'lb-env-open' : ''}`}>
            <div className="lb-env-shell relative" style={{ width: 268, height: 174 }}>
              {/* Mat sau phong bi */}
              <div className="lb-env-body absolute inset-0 rounded-xl" />

              {/* La thu ben trong */}
              <div
                className="lb-env-letter absolute bottom-3 rounded-lg px-3 py-3 shadow-lg"
                style={{ left: '9%', width: '82%', height: 148, background: '#fffdfa' }}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <Heart className="h-3 w-3 text-rose-500" fill="currentColor" />
                  <span className="font-script text-lg text-rose-500">Gửi em</span>
                  <Heart className="h-3 w-3 text-rose-500" fill="currentColor" />
                </div>
                <div className="mt-2 space-y-1.5">
                  <div className="h-1.5 w-full rounded-full bg-rose-100" />
                  <div className="h-1.5 w-5/6 rounded-full bg-rose-100" />
                  <div className="h-1.5 w-4/6 rounded-full bg-rose-100" />
                </div>
                <div className="mt-3 flex justify-center gap-1">
                  {visiblePhotos.slice(0, 4).map((src, index) => (
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

              {/* Mat truoc phong bi (tui dung thu) */}
              <div
                className="absolute inset-0 rounded-xl"
                style={{
                  clipPath: 'polygon(0 0, 50% 52%, 100% 0, 100% 100%, 0 100%)',
                  background: 'linear-gradient(180deg, var(--lb-envelope) 0%, var(--lb-envelope-dark) 100%)',
                  transform: 'translateZ(8px)'
                }}
              />

              {/* Nap phong bi */}
              <div
                className="lb-env-flap absolute inset-x-0 top-0"
                style={{
                  height: '100%',
                  clipPath: 'polygon(0 0, 100% 0, 50% 58%)',
                  background: 'linear-gradient(180deg, var(--lb-envelope-dark) 0%, var(--lb-envelope) 100%)'
                }}
              />

              {/* Con dau sap */}
              <div
                className="lb-seal-pulse absolute left-1/2 top-[46%] flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
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
            onClick={handleOpen}
            disabled={stage === 'opening'}
            className="lb-btn-glow group flex items-center gap-2.5 rounded-full px-7 py-3.5 text-[15px] font-bold text-white transition active:scale-95 disabled:opacity-80"
            style={{ background: 'var(--lb-accent)' }}
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
            <span className="text-[11px]">{track.name}</span>
          </div>
        </div>
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
