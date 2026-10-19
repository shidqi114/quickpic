'use client';

import React from 'react';
import { PHOTOBOOTH_PACKAGES } from '@/lib/constants';
import { WelcomeScreenTheme, BoothOperatingMode, WelcomeLanguage } from '@/types/photobooth';

export type { WelcomeLanguage };

const COPY: Record<WelcomeLanguage, {
  start: string;
  free: string;
  regularOffer: (price: string) => string;
  freeOffer: string;
  hint: string;
  price: (price: string) => string;
  freeLabel: string;
  switchLabel: string;
}> = {
  en: {
    start: 'Touch to start',
    free: 'Free session',
    regularOffer: (price) => `${price}. Pick a package, pay with QRIS, then take your photos.`,
    freeOffer: 'Free photo session. Your photos go to your phone as well as the printer.',
    hint: 'Tap the screen to start',
    price: (price) => `From ${price}`,
    freeLabel: 'Free session',
    switchLabel: 'Bahasa Indonesia',
  },
  id: {
    start: 'Sentuh untuk mulai',
    free: 'Sesi gratis',
    regularOffer: (price) => `Mulai ${price}. Pilih paket, bayar dengan QRIS, lalu mulai foto.`,
    freeOffer: 'Sesi foto gratis. Foto Anda dikirim ke ponsel dan juga dicetak.',
    hint: 'Sentuh layar untuk mulai',
    price: (price) => `Mulai ${price}`,
    freeLabel: 'Sesi gratis',
    switchLabel: 'English',
  },
};

const ACCENT_BY_THEME: Record<WelcomeScreenTheme, string> = {
  neon_cyber: '#1a4be0',
  luxury_gold: '#b8860b',
  retro_y2k: '#d6336c',
  clean_studio: '#111111',
  pastel_romance: '#c2528a',
  custom: '#1a4be0',
};

const MOCK_SESSIONS = ['/mock/session-1.jpg', '/mock/session-2.jpg', '/mock/session-3.jpg', '/mock/session-4.jpg'];

export const WELCOME_THEME_PRESETS: {
  id: WelcomeScreenTheme;
  name: string;
  subtitle: string;
  previewGradient: string;
}[] = [
  {
    id: 'neon_cyber',
    name: 'Neon Cyber Party',
    subtitle: 'High-energy magenta & cyan neon glow',
    previewGradient: 'from-pink-500 via-purple-600 to-cyan-400',
  },
  {
    id: 'luxury_gold',
    name: 'Luxury Wedding & Gala',
    subtitle: 'Deep obsidian & champagne gold elegance',
    previewGradient: 'from-amber-300 via-yellow-500 to-amber-700',
  },
  {
    id: 'retro_y2k',
    name: '90s Retro & Y2K Pop',
    subtitle: 'Nostalgic disco & vibrant pop gradients',
    previewGradient: 'from-yellow-400 via-rose-500 to-purple-600',
  },
  {
    id: 'clean_studio',
    name: 'Studio Minimal',
    subtitle: 'Crisp monochrome & modern glass typography',
    previewGradient: 'from-zinc-100 via-zinc-400 to-zinc-900',
  },
  {
    id: 'pastel_romance',
    name: 'Pastel Dream Romance',
    subtitle: 'Soft blush pink & lavender celebration',
    previewGradient: 'from-pink-300 via-rose-300 to-indigo-300',
  },
];

export interface WelcomeScreenProps {
  /** Selected visual theme (1 of 5 styles or custom) */
  theme?: WelcomeScreenTheme;
  /** Operating mode (event = free, regular = paywall) */
  operatingMode?: BoothOperatingMode;
  /** Event title customized by operator */
  eventName?: string;
  /** Event date string */
  eventDate?: string;
  /** Event hashtag */
  eventHashtag?: string;
  /** Optional custom background image uploaded by operator */
  customWelcomeImageUrl?: string;
  /** Optional custom headline override */
  customHeadline?: string;
  /** Callback triggered when customer taps the touch screen */
  onStart: () => void;
  /** Guest-facing language; the guest can switch it on the screen */
  language?: WelcomeLanguage;
  /** Called when the guest switches language on the screen */
  onLanguageChange?: (language: WelcomeLanguage) => void;
  /** Optional custom class name */
  className?: string;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  theme = 'neon_cyber',
  operatingMode = 'event',
  eventName = 'Summer Gala 2026',
  eventDate = 'OCT 2026',
  eventHashtag = '#QuickPicBooth',
  customWelcomeImageUrl,
  customHeadline,
  language = 'en',
  onLanguageChange,
  onStart,
  className = '',
}) => {
  const lang = language;
  const copy = COPY[lang];
  const fromPrice = Math.min(...PHOTOBOOTH_PACKAGES.map((pkg) => pkg.price));
  const priceText = `Rp ${fromPrice.toLocaleString('id-ID')}`;
  const offer = operatingMode === 'event' ? copy.freeOffer : copy.regularOffer(priceText);
  const accent = ACCENT_BY_THEME[theme] ?? ACCENT_BY_THEME.neon_cyber;

  return (
    <div
      onClick={onStart}
      data-theme={theme}
      lang={lang}
      className={`relative w-full min-h-screen bg-stage text-stage-ink font-display select-none cursor-pointer overflow-hidden px-6 md:px-[6vw] ${className}`}
    >
      {customWelcomeImageUrl && (
        <>
          <img src={customWelcomeImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
          <div className="absolute inset-0 bg-stage/80 pointer-events-none" />
        </>
      )}

      <div className="relative z-10 min-h-screen md:h-screen grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-10 md:gap-[4vw] py-10 md:py-12">
        <div className="flex flex-col justify-between gap-12">
          <div className="flex items-center gap-2.5 text-base font-semibold tracking-tight">
            <svg viewBox="0 0 14 34" className="w-2.5 h-6" aria-hidden="true">
              <rect width="14" height="10" fill="currentColor" />
              <rect y="12" width="14" height="10" fill="currentColor" />
              <rect y="24" width="14" height="10" fill="#1a4be0" />
            </svg>
            QuickPic
          </div>

          <div className="my-auto">
            <h1 className="text-[clamp(56px,7vw,150px)] leading-[0.92] font-semibold tracking-[-0.04em] break-words">
              {customHeadline || eventName}
            </h1>
            <p className="mt-7 text-[clamp(22px,2.1vw,40px)] leading-[1.2] tracking-[-0.01em] tabular-nums">
              {eventDate}
              {eventHashtag && (
                <span className="block text-stage-muted text-[clamp(16px,1.3vw,24px)] mt-2">{eventHashtag}</span>
              )}
            </p>
            <p className="mt-4 max-w-[30ch] text-[clamp(18px,1.25vw,24px)] text-stage-muted leading-normal">{offer}</p>

            <div className="mt-12 flex flex-wrap items-center gap-6">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onStart();
                }}
                style={{ backgroundColor: accent }}
                className="h-[72px] px-8 rounded text-white text-[22px] font-medium cursor-pointer hover:brightness-110 active:translate-y-px"
              >
                {copy.start}
              </button>
              <span className="text-lg text-stage-muted tabular-nums">
                {operatingMode === 'event' ? copy.free : copy.price(priceText)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-6 text-[15px] text-stage-muted">
            <span>{copy.hint}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onLanguageChange?.(lang === 'en' ? 'id' : 'en');
              }}
              className="h-10 px-3 rounded border border-stage-muted/40 text-stage-ink cursor-pointer hover:bg-white/10"
            >
              {copy.switchLabel}
            </button>
          </div>
        </div>

        {!customWelcomeImageUrl && (
          <div className="hidden md:flex items-start justify-center gap-[1.2vw] pt-6 overflow-hidden" aria-hidden="true">
            {[0, 1].map((col) => (
              <div key={col} className="w-[clamp(180px,17vw,320px)] bg-paper p-[6%] pb-[14%] flex flex-col gap-[3%]">
                {MOCK_SESSIONS.map((src) => (
                  <img key={src} src={src} alt="" className="w-full aspect-[3/4] object-cover" />
                ))}
                <p className="mt-3 text-center text-ink text-sm font-semibold">{eventName}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
