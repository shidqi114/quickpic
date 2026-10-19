'use client';

import React from 'react';
import { PHOTOBOOTH_PACKAGES } from '@/lib/constants';
import { WelcomeScreenTheme, BoothOperatingMode } from '@/types/photobooth';

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
  /** Optional custom class name */
  className?: string;
}

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

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  operatingMode = 'event',
  eventName = 'Summer Gala 2026',
  eventDate = 'OCT 2026',
  eventHashtag = '#QuickPicBooth',
  customWelcomeImageUrl,
  customHeadline,
  onStart,
  className = '',
}) => {
  const fromPrice = Math.min(...PHOTOBOOTH_PACKAGES.map((pkg) => pkg.price));
  const priceLabel = `From Rp ${fromPrice.toLocaleString('id-ID')}`;
  const offer =
    operatingMode === 'event'
      ? 'Free photo session. Your photos go to your phone as well as the printer.'
      : `${priceLabel}. Pick a package, pay with QRIS, then take your photos.`;

  return (
    <div
      onClick={onStart}
      className={`relative flex-1 w-full h-full min-h-screen bg-stage text-stage-ink font-display select-none cursor-pointer overflow-hidden px-6 md:px-[6vw] ${className}`}
    >
      {customWelcomeImageUrl && (
        <>
          <img
            src={customWelcomeImageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />
          <div className="absolute inset-0 bg-stage/80 pointer-events-none" />
        </>
      )}

      <div className="relative z-10 min-h-screen flex flex-col justify-between py-10 md:py-12 gap-12">
        <div className="flex items-center gap-2.5 text-base font-semibold tracking-tight">
          <svg viewBox="0 0 14 34" className="w-2.5 h-6" aria-hidden="true">
            <rect width="14" height="10" fill="currentColor" />
            <rect y="12" width="14" height="10" fill="currentColor" />
            <rect y="24" width="14" height="10" fill="#1a4be0" />
          </svg>
          QuickPic
        </div>

        <div className="my-auto max-w-[60vw]">
          <h1 className="text-[clamp(56px,8.4vw,168px)] leading-[0.92] font-semibold tracking-[-0.04em] break-words">
            {customHeadline || eventName}
          </h1>
          <p className="mt-7 text-[clamp(22px,2.1vw,40px)] leading-[1.2] tracking-[-0.01em] tabular-nums">
            {eventDate}
            {eventHashtag && <span className="block text-stage-muted text-[clamp(16px,1.3vw,24px)] mt-2">{eventHashtag}</span>}
          </p>
          <p className="mt-4 max-w-[30ch] text-[clamp(18px,1.25vw,24px)] text-stage-muted leading-normal">{offer}</p>

          <div className="mt-12 flex flex-wrap items-center gap-6">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStart();
              }}
              className="h-[72px] px-8 rounded bg-accent hover:bg-accent-press text-white text-[22px] font-medium cursor-pointer active:translate-y-px"
            >
              Touch to start
            </button>
            <span className="text-lg text-stage-muted">
              {operatingMode === 'event' ? 'Free session' : priceLabel}
            </span>
          </div>
        </div>

        <div className="text-[15px] text-stage-muted">Tap the screen to start</div>
      </div>
    </div>
  );
};
