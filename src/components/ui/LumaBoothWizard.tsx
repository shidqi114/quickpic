'use client';

import React, { useState } from 'react';
import {
  Camera,
  Layers,
  Repeat,
  Video,
  Rocket,
  ShieldCheck,
  CreditCard,
  Gift,
  Settings,
  Sparkles,
  Calendar,
  CheckCircle2,
  PartyPopper,
  Building,
  Heart,
  Music,
  Disc,
} from 'lucide-react';
import { StripLayout, PhotoFilter } from '@/types/photobooth';

export type OperatingMode = 'event' | 'regular';

export type CaptureCapability = 'photo' | 'gif' | 'boomerang' | 'video';

export interface EventPreset {
  id: string;
  name: string;
  category: 'wedding' | 'corporate' | 'birthday' | 'party' | 'retro';
  icon: React.ElementType;
  description: string;
  mode: OperatingMode;
  enabledModes: CaptureCapability[];
  countdownSeconds: number;
  layout: StripLayout;
  filter: PhotoFilter;
  printsCount: number;
  hashtag: string;
}

export interface LumaBoothConfig {
  mode: OperatingMode;
  eventName: string;
  eventDate: string;
  eventHashtag: string;
  operatorPin: string;
  captureModes: {
    photo: boolean;
    gif: boolean;
    boomerang: boolean;
    video: boolean;
  };
  countdownSeconds: number;
  layout: StripLayout;
  filter: PhotoFilter;
  printsPerSession: number;
  allowGuestRetakes: boolean;
  enableLivePhotoUpload: boolean;
}

export const EVENT_PRESETS: EventPreset[] = [
  {
    id: 'preset-wedding',
    name: 'Wedding Glam & Romance',
    category: 'wedding',
    icon: Heart,
    description: 'Zero-paywall guest experience with Photo & Boomerang loops and elegant pastel themes.',
    mode: 'event',
    enabledModes: ['photo', 'boomerang'],
    countdownSeconds: 5,
    layout: 'strip-3',
    filter: 'warm',
    printsCount: 2,
    hashtag: '#SarahAndJohn2026',
  },
  {
    id: 'preset-corp',
    name: 'Corporate Gala & Expo',
    category: 'corporate',
    icon: Building,
    description: 'High-throughput branded experience with instant QR soft-files and single VIP prints.',
    mode: 'event',
    enabledModes: ['photo', 'gif', 'video'],
    countdownSeconds: 3,
    layout: '4r-classic',
    filter: 'none',
    printsCount: 1,
    hashtag: '#TechInnovate2026',
  },
  {
    id: 'preset-bday',
    name: 'Birthday Bash Pop-up',
    category: 'birthday',
    icon: PartyPopper,
    description: 'Fun-filled photobooth with stickers, all capture formats enabled, and 2 strip prints.',
    mode: 'event',
    enabledModes: ['photo', 'gif', 'boomerang', 'video'],
    countdownSeconds: 5,
    layout: 'strip-3',
    filter: 'vintage',
    printsCount: 2,
    hashtag: '#LilySweet17',
  },
  {
    id: 'preset-club',
    name: 'Nightclub & DJ Lounge',
    category: 'party',
    icon: Music,
    description: 'Monetized commercial setup with QRIS paywall, Cyberpunk color grading & Live GIF loops.',
    mode: 'regular',
    enabledModes: ['photo', 'boomerang'],
    countdownSeconds: 3,
    layout: 'grid-2x2',
    filter: 'cyberpunk',
    printsCount: 2,
    hashtag: '#NeonNightsJKT',
  },
  {
    id: 'preset-retro',
    name: 'Retro 90s Disco Vinyl',
    category: 'retro',
    icon: Disc,
    description: 'Classic 2x6 twin perforated strips with sepia/monochrome filters and vintage stamps.',
    mode: 'regular',
    enabledModes: ['photo', 'gif'],
    countdownSeconds: 5,
    layout: 'strip-3',
    filter: 'sepia',
    printsCount: 2,
    hashtag: '#RetroDiscoFever',
  },
];

export interface LumaBoothWizardProps {
  /** Initial configuration values */
  initialConfig?: Partial<LumaBoothConfig>;
  /** Callback fired when operator launches the event */
  onLaunchEvent: (config: LumaBoothConfig) => void;
  /** Callback fired when configuration is saved */
  onSaveConfig?: (config: LumaBoothConfig) => void;
  /** Optional custom class */
  className?: string;
}

export const LumaBoothWizard: React.FC<LumaBoothWizardProps> = ({
  initialConfig,
  onLaunchEvent,
  onSaveConfig,
  className = '',
}) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('preset-wedding');

  const [config, setConfig] = useState<LumaBoothConfig>({
    mode: initialConfig?.mode || 'event',
    eventName: initialConfig?.eventName || 'Grand Opening Celebration',
    eventDate: initialConfig?.eventDate || new Date().toISOString().split('T')[0],
    eventHashtag: initialConfig?.eventHashtag || '#QuickPicMoments',
    operatorPin: initialConfig?.operatorPin || '1144',
    captureModes: initialConfig?.captureModes || {
      photo: true,
      gif: true,
      boomerang: true,
      video: false,
    },
    countdownSeconds: initialConfig?.countdownSeconds || 5,
    layout: initialConfig?.layout || 'strip-3',
    filter: initialConfig?.filter || 'none',
    printsPerSession: initialConfig?.printsPerSession || 2,
    allowGuestRetakes: initialConfig?.allowGuestRetakes ?? true,
    enableLivePhotoUpload: initialConfig?.enableLivePhotoUpload ?? true,
  });

  // Apply Preset
  const handleApplyPreset = (preset: EventPreset) => {
    setSelectedPresetId(preset.id);
    const updated: LumaBoothConfig = {
      ...config,
      mode: preset.mode,
      eventName: preset.name,
      eventHashtag: preset.hashtag,
      countdownSeconds: preset.countdownSeconds,
      layout: preset.layout,
      filter: preset.filter,
      printsPerSession: preset.printsCount,
      captureModes: {
        photo: preset.enabledModes.includes('photo'),
        gif: preset.enabledModes.includes('gif'),
        boomerang: preset.enabledModes.includes('boomerang'),
        video: preset.enabledModes.includes('video'),
      },
    };
    setConfig(updated);
    if (onSaveConfig) onSaveConfig(updated);
  };

  // Toggle Capture Capability
  const toggleCaptureMode = (mode: CaptureCapability) => {
    // Ensure at least one mode is active
    const nextModes = {
      ...config.captureModes,
      [mode]: !config.captureModes[mode],
    };
    const hasActive = Object.values(nextModes).some(Boolean);
    if (!hasActive) return; // Prevent disabling everything

    const updated = { ...config, captureModes: nextModes };
    setConfig(updated);
    if (onSaveConfig) onSaveConfig(updated);
  };

  // Toggle Operating Mode: Event vs Regular
  const handleModeChange = (mode: OperatingMode) => {
    const updated = { ...config, mode };
    setConfig(updated);
    if (onSaveConfig) onSaveConfig(updated);
  };

  const handleLaunch = () => {
    onLaunchEvent(config);
  };

  return (
    <div className={`w-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-6 p-4 md:p-6 bg-zinc-950 text-white select-none ${className}`}>
      
      {/* ========================================================= */}
      {/* Left Sidebar: Event Presets & Prominent Launch Event      */}
      {/* ========================================================= */}
      <div className="w-full lg:w-80 flex flex-col justify-between gap-6 bg-zinc-900/70 border border-zinc-800/80 rounded-3xl p-5 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-zinc-800">
            <div className="p-2 bg-pink-500/20 text-pink-400 rounded-xl border border-pink-500/30">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                Event Presets
              </h3>
              <p className="text-[11px] text-zinc-400">Quick 1-click booth templates</p>
            </div>
          </div>

          {/* Preset Buttons List */}
          <div className="flex flex-col gap-2">
            {EVENT_PRESETS.map((preset) => {
              const isSelected = selectedPresetId === preset.id;
              const Icon = preset.icon;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className={`flex items-start gap-3 p-3 rounded-2xl text-left transition-all border ${
                    isSelected
                      ? 'bg-gradient-to-r from-pink-500/20 to-purple-500/20 border-pink-500/60 shadow-lg shadow-pink-500/15 ring-1 ring-pink-500/50'
                      : 'bg-zinc-950/40 border-zinc-800/60 hover:border-zinc-700 hover:bg-zinc-900/60'
                  }`}
                >
                  <div
                    className={`p-2 rounded-xl mt-0.5 ${
                      isSelected
                        ? 'bg-pink-500 text-white shadow-md shadow-pink-500/40'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-black truncate ${
                          isSelected ? 'text-pink-300' : 'text-zinc-200'
                        }`}
                      >
                        {preset.name}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400 line-clamp-2 mt-0.5">
                      {preset.description}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        preset.mode === 'event'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {preset.mode === 'event' ? 'No Paywall' : 'Monetized'}
                      </span>
                      <span className="text-[9px] text-zinc-500 font-mono">
                        {preset.enabledModes.length} Modes
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Prominent Launch Event Button */}
        <div className="pt-4 border-t border-zinc-800 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleLaunch}
            className="w-full py-4 px-6 bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-black text-base rounded-2xl shadow-xl shadow-pink-500/40 flex items-center justify-center gap-3 transform hover:scale-[1.02] active:scale-95 transition-all group"
          >
            <Rocket className="w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            <span>Launch Event Now</span>
          </button>
          <span className="text-[10px] text-center text-zinc-400">
            Locks operator settings & starts kiosk visitor flow
          </span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* Right Area: Mode Selector & Capture Mode Icons Grid        */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col gap-6">
        
        {/* Section 1: Mode Toggle (Event vs Regular) */}
        <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-3xl p-5 md:p-6 shadow-2xl backdrop-blur-md flex flex-col gap-4">
          <div>
            <span className="text-xs font-bold text-pink-400 uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Step 1: Operating Mode
            </span>
            <h2 className="text-lg font-black text-white mt-0.5">
              Select Kiosk Paywall & Access Strategy
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Event Mode (No Paywall) */}
            <div
              onClick={() => handleModeChange('event')}
              className={`p-5 rounded-2xl border-2 cursor-pointer transition-all relative flex flex-col justify-between ${
                config.mode === 'event'
                  ? 'bg-gradient-to-br from-emerald-950/40 via-zinc-900 to-zinc-900 border-emerald-500 ring-2 ring-emerald-500/40 shadow-xl shadow-emerald-500/20'
                  : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700 opacity-70 hover:opacity-100'
              }`}
            >
              {config.mode === 'event' && (
                <div className="absolute top-3 right-3 bg-emerald-500 text-white rounded-full p-1 shadow-md shadow-emerald-500/40">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mb-3">
                  <Gift className="w-5 h-5" />
                </div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  Event Mode
                  <span className="text-[10px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold px-2 py-0.5 rounded-full uppercase">
                    No Paywall
                  </span>
                </h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Guests touch to start immediately with zero payment screens. Perfect for private parties, weddings, and corporate sponsored booths.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center gap-2 text-xs text-emerald-400 font-semibold">
                <ShieldCheck className="w-4 h-4" />
                <span>Zero Gatekeeping Guest Flow</span>
              </div>
            </div>

            {/* Regular Mode (With Paywall) */}
            <div
              onClick={() => handleModeChange('regular')}
              className={`p-5 rounded-2xl border-2 cursor-pointer transition-all relative flex flex-col justify-between ${
                config.mode === 'regular'
                  ? 'bg-gradient-to-br from-purple-950/40 via-zinc-900 to-zinc-900 border-purple-500 ring-2 ring-purple-500/40 shadow-xl shadow-purple-500/20'
                  : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700 opacity-70 hover:opacity-100'
              }`}
            >
              {config.mode === 'regular' && (
                <div className="absolute top-3 right-3 bg-purple-500 text-white rounded-full p-1 shadow-md shadow-purple-500/40">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
              <div>
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-400 flex items-center justify-center mb-3">
                  <CreditCard className="w-5 h-5" />
                </div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  Regular Mode
                  <span className="text-[10px] bg-purple-500/20 border border-purple-500/40 text-purple-300 font-bold px-2 py-0.5 rounded-full uppercase">
                    Paywall Active
                  </span>
                </h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Guests must scan simulated QRIS dynamic payment or operator enters staff PIN <span className="font-mono text-purple-300 font-bold">{config.operatorPin}</span> to unlock session.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center gap-2 text-xs text-purple-400 font-semibold">
                <CreditCard className="w-4 h-4" />
                <span>Simulated QRIS & PIN Bypass</span>
              </div>
            </div>

          </div>
        </div>

        {/* Section 2: Capture Mode Icons Grid with Active Glow */}
        <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-3xl p-5 md:p-6 shadow-2xl backdrop-blur-md flex flex-col gap-4">
          <div>
            <span className="text-xs font-bold text-pink-400 uppercase tracking-widest flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" />
              Step 2: Capture Capabilities
            </span>
            <h2 className="text-lg font-black text-white mt-0.5">
              Enable Active Capture Media Modes
            </h2>
            <p className="text-xs text-zinc-400">
              Click icons to toggle customer options on the kiosk welcome screen.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            
            {/* 1. Photo Mode */}
            <button
              type="button"
              onClick={() => toggleCaptureMode('photo')}
              className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center text-center transition-all ${
                config.captureModes.photo
                  ? 'bg-gradient-to-b from-pink-500/20 to-purple-900/20 border-pink-500 ring-2 ring-pink-500/60 shadow-xl shadow-pink-500/30 scale-105'
                  : 'bg-zinc-950/60 border-zinc-800 text-zinc-500 opacity-60 hover:opacity-100'
              }`}
            >
              <div
                className={`p-3 rounded-2xl mb-2.5 transition-transform ${
                  config.captureModes.photo
                    ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/50 scale-110'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                <Camera className="w-6 h-6" />
              </div>
              <span className="text-sm font-black text-white tracking-wide">Photo 📷</span>
              <span className="text-[10px] text-zinc-400 mt-0.5">High-Res DSLR Print</span>
              {config.captureModes.photo && (
                <span className="mt-2 text-[9px] font-bold uppercase text-pink-300 bg-pink-500/20 px-2 py-0.5 rounded-full">
                  Enabled
                </span>
              )}
            </button>

            {/* 2. GIF Mode */}
            <button
              type="button"
              onClick={() => toggleCaptureMode('gif')}
              className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center text-center transition-all ${
                config.captureModes.gif
                  ? 'bg-gradient-to-b from-purple-500/20 to-indigo-900/20 border-purple-500 ring-2 ring-purple-500/60 shadow-xl shadow-purple-500/30 scale-105'
                  : 'bg-zinc-950/60 border-zinc-800 text-zinc-500 opacity-60 hover:opacity-100'
              }`}
            >
              <div
                className={`p-3 rounded-2xl mb-2.5 transition-transform ${
                  config.captureModes.gif
                    ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/50 scale-110'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                <Layers className="w-6 h-6" />
              </div>
              <span className="text-sm font-black text-white tracking-wide">GIF 📑</span>
              <span className="text-[10px] text-zinc-400 mt-0.5">Multi-Frame Animated</span>
              {config.captureModes.gif && (
                <span className="mt-2 text-[9px] font-bold uppercase text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full">
                  Enabled
                </span>
              )}
            </button>

            {/* 3. Boomerang Mode */}
            <button
              type="button"
              onClick={() => toggleCaptureMode('boomerang')}
              className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center text-center transition-all ${
                config.captureModes.boomerang
                  ? 'bg-gradient-to-b from-cyan-500/20 to-blue-900/20 border-cyan-400 ring-2 ring-cyan-400/60 shadow-xl shadow-cyan-400/30 scale-105'
                  : 'bg-zinc-950/60 border-zinc-800 text-zinc-500 opacity-60 hover:opacity-100'
              }`}
            >
              <div
                className={`p-3 rounded-2xl mb-2.5 transition-transform ${
                  config.captureModes.boomerang
                    ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/50 scale-110'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                <Repeat className="w-6 h-6" />
              </div>
              <span className="text-sm font-black text-white tracking-wide">Boomerang ♾️</span>
              <span className="text-[10px] text-zinc-400 mt-0.5">Infinite Back-and-Forth</span>
              {config.captureModes.boomerang && (
                <span className="mt-2 text-[9px] font-bold uppercase text-cyan-300 bg-cyan-500/20 px-2 py-0.5 rounded-full">
                  Enabled
                </span>
              )}
            </button>

            {/* 4. Video Mode */}
            <button
              type="button"
              onClick={() => toggleCaptureMode('video')}
              className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center text-center transition-all ${
                config.captureModes.video
                  ? 'bg-gradient-to-b from-amber-500/20 to-orange-900/20 border-amber-400 ring-2 ring-amber-400/60 shadow-xl shadow-amber-400/30 scale-105'
                  : 'bg-zinc-950/60 border-zinc-800 text-zinc-500 opacity-60 hover:opacity-100'
              }`}
            >
              <div
                className={`p-3 rounded-2xl mb-2.5 transition-transform ${
                  config.captureModes.video
                    ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/50 scale-110'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                <Video className="w-6 h-6" />
              </div>
              <span className="text-sm font-black text-white tracking-wide">Video 📹</span>
              <span className="text-[10px] text-zinc-400 mt-0.5">5s Guest Video Message</span>
              {config.captureModes.video && (
                <span className="mt-2 text-[9px] font-bold uppercase text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full">
                  Enabled
                </span>
              )}
            </button>

          </div>
        </div>

        {/* Section 3: Event Information Form */}
        <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-3xl p-5 md:p-6 shadow-2xl backdrop-blur-md flex flex-col gap-4">
          <div>
            <span className="text-xs font-bold text-pink-400 uppercase tracking-widest flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Step 3: Event Details & Branding
            </span>
            <h2 className="text-lg font-black text-white mt-0.5">
              Event Metadata & Watermarks
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Event Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">Event Title</label>
              <input
                type="text"
                value={config.eventName}
                onChange={(e) => setConfig({ ...config, eventName: e.target.value })}
                placeholder="e.g. Sarah & John Wedding"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500"
              />
            </div>

            {/* Event Date */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">Date</label>
              <input
                type="date"
                value={config.eventDate}
                onChange={(e) => setConfig({ ...config, eventDate: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-pink-500"
              />
            </div>

            {/* Event Hashtag */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">Social Hashtag</label>
              <div className="relative">
                <input
                  type="text"
                  value={config.eventHashtag}
                  onChange={(e) => setConfig({ ...config, eventHashtag: e.target.value })}
                  placeholder="#YourHashtag"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500 font-mono"
                />
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
