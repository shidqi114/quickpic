'use client';

import React from 'react';
import { X, Sliders, Palette, LayoutGrid, Clock, Calendar, Hash, Type } from 'lucide-react';
import { BoothSettings, StripLayout, PhotoFilter } from '@/types/photobooth';
import { FRAME_THEMES } from '@/lib/compositor';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: BoothSettings;
  onUpdateSettings: (newSettings: Partial<BoothSettings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  if (!isOpen) return null;

  const layouts: { id: StripLayout; label: string; count: string }[] = [
    { id: 'strip-3', label: '3-Photo Strip', count: '3 shots' },
    { id: 'strip-4', label: '4-Photo Strip', count: '4 shots' },
    { id: 'grid-2x2', label: '2x2 Grid', count: '4 shots' },
    { id: 'single', label: 'Single Portrait', count: '1 shot' },
  ];

  const filters: { id: PhotoFilter; label: string }[] = [
    { id: 'none', label: 'Normal / Original' },
    { id: 'bw', label: 'Classic B&W' },
    { id: 'warm', label: 'Warm Glow' },
    { id: 'vintage', label: 'Vintage 90s' },
    { id: 'sepia', label: 'Retro Sepia' },
    { id: 'cyberpunk', label: 'Neon Cyberpunk' },
    { id: 'cold', label: 'Cool Blue' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl bg-zinc-900 border border-zinc-700/70 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800 bg-zinc-950/50">
          <div className="flex items-center gap-2 text-white font-bold text-lg">
            <Sliders className="w-5 h-5 text-pink-500" />
            Booth & Event Settings
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Event Branding */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5 text-pink-400" /> Event Branding
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-300 block mb-1">Event Name / Header</label>
                <input
                  type="text"
                  value={settings.eventName}
                  onChange={(e) => onUpdateSettings({ eventName: e.target.value })}
                  placeholder="e.g. Alex & Sam Wedding"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-hidden focus:border-pink-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-300 block mb-1">Date Stamp</label>
                  <input
                    type="text"
                    value={settings.eventDate}
                    onChange={(e) => onUpdateSettings({ eventDate: e.target.value })}
                    placeholder="e.g. SEP 2026"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-hidden focus:border-pink-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-300 block mb-1">Hashtag</label>
                  <input
                    type="text"
                    value={settings.eventHashtag}
                    onChange={(e) => onUpdateSettings({ eventHashtag: e.target.value })}
                    placeholder="e.g. #AlexSam2026"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-hidden focus:border-pink-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Layout Selection */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <LayoutGrid className="w-3.5 h-3.5 text-pink-400" /> Strip Layout
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              {layouts.map((l) => (
                <button
                  key={l.id}
                  onClick={() => onUpdateSettings({ layout: l.id })}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                    settings.layout === l.id
                      ? 'bg-pink-500/10 border-pink-500 text-pink-400'
                      : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-300 hover:border-zinc-600'
                  }`}
                >
                  <span className="font-semibold text-sm">{l.label}</span>
                  <span className="text-xs text-zinc-400 mt-1">{l.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Frame Theme */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-pink-400" /> Frame Background Theme
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {FRAME_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => onUpdateSettings({ selectedThemeId: theme.id })}
                  className={`p-2.5 rounded-xl border text-center text-xs font-medium flex flex-col items-center gap-2 transition ${
                    settings.selectedThemeId === theme.id
                      ? 'border-pink-500 bg-pink-500/10 text-white'
                      : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:text-white'
                  }`}
                >
                  <div
                    className="w-7 h-7 rounded-full border border-zinc-600 shadow-xs"
                    style={{ backgroundColor: theme.backgroundColor }}
                  />
                  <span>{theme.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Default Filter */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Default Photo Filter
            </h3>
            <select
              value={settings.selectedFilter}
              onChange={(e) => onUpdateSettings({ selectedFilter: e.target.value as PhotoFilter })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-hidden focus:border-pink-500"
            >
              {filters.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* Countdown & Camera Options */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-pink-400" /> Capture Timing
            </h3>
            <div className="flex items-center gap-3">
              {[3, 5, 7].map((sec) => (
                <button
                  key={sec}
                  onClick={() => onUpdateSettings({ countdownSeconds: sec })}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition ${
                    settings.countdownSeconds === sec
                      ? 'bg-pink-500 text-white border-pink-500'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white'
                  }`}
                >
                  {sec}s Timer
                </button>
              ))}
            </div>
          </div>

          {/* Mirror Camera Toggle */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
            <div>
              <div className="text-sm font-medium text-white">Mirror Camera View</div>
              <div className="text-xs text-zinc-400">Flips preview horizontally for natural selfie view</div>
            </div>
            <button
              onClick={() => onUpdateSettings({ mirrorCamera: !settings.mirrorCamera })}
              className={`w-12 h-6 flex items-center rounded-full p-1 transition duration-300 ${
                settings.mirrorCamera ? 'bg-pink-500' : 'bg-zinc-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition duration-300 ${
                  settings.mirrorCamera ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-pink-500 hover:bg-pink-600 text-white font-medium rounded-xl text-sm transition"
          >
            Save & Done
          </button>
        </div>
      </div>
    </div>
  );
};
