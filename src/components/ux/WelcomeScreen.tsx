'use client';

import React from 'react';
import {
  Camera,
  Sparkles,
  Gift,
  CreditCard,
  Crown,
  Heart,
  PartyPopper,
  Radio,
  Flame,
  Star,
  ChevronRight
} from 'lucide-react';
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
  theme = 'neon_cyber',
  operatingMode = 'event',
  eventName = 'Summer Gala 2026',
  eventDate = 'OCT 2026',
  eventHashtag = '#QuickPicBooth',
  customWelcomeImageUrl,
  customHeadline,
  onStart,
  className = '',
}) => {
  return (
    <div
      onClick={onStart}
      className={`w-full h-full flex-1 flex flex-col items-center justify-between p-6 md:p-12 text-center select-none cursor-pointer transition-all duration-500 relative overflow-hidden ${className}`}
    >
      {/* Background Ambience Layers: Custom Image Backdrop or Theme Presets */}
      {customWelcomeImageUrl ? (
        <>
          <img
            src={customWelcomeImageUrl}
            alt="Custom Welcome Screen Backdrop"
            className="absolute inset-0 w-full h-full object-cover -z-20 pointer-events-none transition-all duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/70 to-zinc-950/40 -z-10 pointer-events-none" />
          <div className="absolute inset-0 backdrop-blur-[1px] -z-10 pointer-events-none" />
        </>
      ) : (
        <>
          {theme === 'neon_cyber' && (
            <>
              <div className="absolute inset-0 bg-radial from-purple-900/40 via-zinc-950 to-zinc-950 -z-10 pointer-events-none" />
              <div className="absolute top-1/4 -left-32 w-96 h-96 bg-pink-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
              <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
            </>
          )}

          {theme === 'luxury_gold' && (
            <>
              <div className="absolute inset-0 bg-radial from-amber-950/30 via-zinc-950 to-zinc-950 -z-10 pointer-events-none" />
              <div className="absolute inset-8 border border-amber-500/20 rounded-3xl pointer-events-none" />
              <div className="absolute inset-10 border border-amber-500/10 rounded-2xl pointer-events-none" />
            </>
          )}

          {theme === 'retro_y2k' && (
            <>
              <div className="absolute inset-0 bg-radial from-yellow-950/25 via-zinc-950 to-zinc-950 -z-10 pointer-events-none" />
              <div className="absolute top-10 right-10 w-24 h-24 bg-yellow-400/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute bottom-10 left-10 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />
            </>
          )}

          {theme === 'clean_studio' && (
            <>
              <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/50 via-zinc-950 to-zinc-950 -z-10 pointer-events-none" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-64 bg-zinc-500/5 rounded-full blur-3xl pointer-events-none" />
            </>
          )}

          {theme === 'pastel_romance' && (
            <>
              <div className="absolute inset-0 bg-radial from-pink-950/30 via-zinc-950 to-zinc-950 -z-10 pointer-events-none" />
              <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-pink-400/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-purple-400/10 rounded-full blur-3xl pointer-events-none" />
            </>
          )}

          {theme === 'custom' && (
            <>
              <div className="absolute inset-0 bg-radial from-purple-900/30 via-zinc-950 to-zinc-950 -z-10 pointer-events-none" />
              <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
            </>
          )}
        </>
      )}

      {/* Top Header Event Information */}
      <div className="w-full flex flex-col items-center gap-1.5 pt-4 z-10 animate-fade-in">
        <div className="flex items-center gap-2">
          {theme === 'luxury_gold' && <Crown className="w-4 h-4 text-amber-400" />}
          {theme === 'neon_cyber' && <Flame className="w-4 h-4 text-pink-500" />}
          {theme === 'retro_y2k' && <Star className="w-4 h-4 text-yellow-400" />}
          {theme === 'pastel_romance' && <Heart className="w-4 h-4 text-pink-400 fill-pink-400/30" />}
          {theme === 'clean_studio' && <Radio className="w-3.5 h-3.5 text-zinc-400 animate-pulse" />}
          {theme === 'custom' && <Sparkles className="w-4 h-4 text-pink-400 animate-pulse" />}

          <span
            className={`text-xs font-bold uppercase tracking-widest ${
              theme === 'luxury_gold'
                ? 'text-amber-300 font-serif tracking-[0.25em]'
                : theme === 'pastel_romance'
                ? 'text-pink-300'
                : theme === 'retro_y2k'
                ? 'text-yellow-400 font-mono'
                : 'text-zinc-400'
            }`}
          >
            {eventName}
          </span>
        </div>

        {eventHashtag && (
          <span className="text-[11px] font-mono text-zinc-500 tracking-wider">
            {eventHashtag} • {eventDate}
          </span>
        )}
      </div>

      {/* Main Center Content / Icon Hero */}
      <div className="flex flex-col items-center justify-center my-auto z-10 animate-fade-in">
        {/* Animated Badge Icon */}
        <div className="relative group mb-8 transform transition duration-500 group-hover:scale-105">
          {theme === 'luxury_gold' && (
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-2 border-amber-400/60 p-2 shadow-2xl shadow-amber-500/20">
              <div className="w-full h-full rounded-full bg-gradient-to-tr from-amber-950/60 to-zinc-900 border border-amber-400/30 flex items-center justify-center">
                <Camera className="w-14 h-14 md:w-16 md:h-16 text-amber-300" />
              </div>
            </div>
          )}

          {theme === 'retro_y2k' && (
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-gradient-to-tr from-yellow-400 via-rose-500 to-purple-600 p-1.5 shadow-2xl shadow-yellow-500/20 rotate-3">
              <div className="w-full h-full bg-zinc-950 rounded-[20px] flex items-center justify-center -rotate-3">
                <PartyPopper className="w-16 h-16 md:w-20 md:h-20 text-yellow-300 animate-bounce" />
              </div>
            </div>
          )}

          {theme === 'clean_studio' && (
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-zinc-900 border border-zinc-700/60 p-1 shadow-2xl">
              <div className="w-full h-full bg-zinc-950 rounded-[22px] flex items-center justify-center">
                <Camera className="w-14 h-14 md:w-16 md:h-16 text-white" />
              </div>
            </div>
          )}

          {theme === 'pastel_romance' && (
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-tr from-pink-300 via-rose-300 to-indigo-300 p-1.5 shadow-2xl shadow-pink-500/20">
              <div className="w-full h-full rounded-full bg-zinc-950 flex items-center justify-center">
                <Heart className="w-16 h-16 md:w-18 md:h-18 text-pink-300 fill-pink-300/40 animate-pulse" />
              </div>
            </div>
          )}

          {(theme === 'neon_cyber' || theme === 'custom' || !['luxury_gold', 'retro_y2k', 'clean_studio', 'pastel_romance'].includes(theme || '')) && (
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-gradient-to-tr from-pink-500 via-purple-600 to-cyan-400 p-1 shadow-2xl shadow-pink-500/30 animate-pulse">
              <div className="w-full h-full bg-zinc-950 rounded-[22px] flex items-center justify-center">
                <Camera className="w-16 h-16 md:w-20 md:h-20 text-pink-500" />
              </div>
            </div>
          )}
        </div>

        {/* Mode Tag */}
        <div className="mb-3">
          <span
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border ${
              operatingMode === 'event'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                : 'bg-pink-500/15 border-pink-500/30 text-pink-300'
            }`}
          >
            {operatingMode === 'event' ? (
              <>
                <Gift className="w-3.5 h-3.5" /> Event Mode: Free Photo Session
              </>
            ) : (
              <>
                <CreditCard className="w-3.5 h-3.5" /> Regular Mode: Pay & Print
              </>
            )}
          </span>
        </div>

        {/* Headline */}
        <h2
          className={`text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight mb-3 ${
            theme === 'luxury_gold'
              ? 'font-serif text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-100'
              : theme === 'retro_y2k'
              ? 'text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-pink-400 to-purple-400 drop-shadow-[0_4px_10px_rgba(234,179,8,0.3)]'
              : theme === 'pastel_romance'
              ? 'text-transparent bg-clip-text bg-gradient-to-r from-pink-200 via-rose-300 to-purple-200'
              : theme === 'clean_studio'
              ? 'text-white'
              : 'text-transparent bg-clip-text bg-gradient-to-r from-white via-pink-200 to-purple-300'
          }`}
        >
          {customHeadline ||
            (theme === 'luxury_gold'
              ? 'Cherish Every Moment'
              : theme === 'retro_y2k'
              ? 'Strike A Rad Pose!'
              : theme === 'pastel_romance'
              ? 'Create Sweet Memories'
              : theme === 'clean_studio'
              ? 'Studio Photobooth'
              : 'Capture Your Magic')}
        </h2>

        <p className="text-zinc-400 text-sm md:text-base max-w-lg mb-10 leading-relaxed drop-shadow-md">
          High-res studio DSLR snapshots, 5-second Live Photo Boomerangs, free-transform Canva stickers, and instant DNP prints.
        </p>

        {/* Large Prominent Touch Screen Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onStart();
          }}
          className={`px-10 md:px-14 py-5 md:py-6 rounded-3xl font-black text-xl md:text-2xl uppercase tracking-wider shadow-2xl ring-4 active:scale-95 transition-all duration-300 flex items-center gap-3 cursor-pointer ${
            theme === 'luxury_gold'
              ? 'bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 hover:brightness-110 text-zinc-950 ring-amber-400/30 shadow-amber-500/30'
              : theme === 'retro_y2k'
              ? 'bg-gradient-to-r from-yellow-400 via-rose-500 to-purple-600 hover:brightness-110 text-white ring-yellow-400/30 shadow-yellow-500/30 animate-pulse'
              : theme === 'pastel_romance'
              ? 'bg-gradient-to-r from-pink-400 via-rose-400 to-purple-400 hover:brightness-110 text-white ring-pink-400/30 shadow-pink-500/30'
              : theme === 'clean_studio'
              ? 'bg-white hover:bg-zinc-100 text-zinc-950 ring-white/20 shadow-white/20'
              : 'bg-gradient-to-r from-pink-500 via-rose-500 to-yellow-400 hover:brightness-110 text-white ring-pink-500/20 shadow-pink-500/30 animate-pulse'
          }`}
        >
          <Sparkles className="w-6 h-6 md:w-7 md:h-7" />
          <span>Touch Screen To Start</span>
          <ChevronRight className="w-6 h-6 md:w-7 md:h-7" />
        </button>
      </div>

      {/* Bottom Footer Note */}
      <div className="w-full flex items-center justify-center pb-2 z-10 text-xs text-zinc-600 font-medium">
        <span>Powered by QuickPic Studio • Tap anywhere on the screen to begin</span>
      </div>
    </div>
  );
};
