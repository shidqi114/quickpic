'use client';

import React from 'react';
import { BoothSettings, StripLayout, PhotoFilter } from '@/types/photobooth';
import { FRAME_THEMES } from '@/lib/compositor';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: BoothSettings;
  onUpdateSettings: (newSettings: Partial<BoothSettings>) => void;
}

const INPUT = 'h-11 w-full px-3 rounded border border-paper-control bg-paper text-[16px] text-ink placeholder:text-muted focus:outline-2 focus:outline-accent';
const BTN_S = 'h-11 px-4 rounded border border-paper-control text-[16px] text-ink cursor-pointer hover:bg-paper-surface';
const OPTION_ON = 'border-ink ring-1 ring-ink';
const OPTION_OFF = 'border-paper-control hover:bg-paper-surface';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  if (!isOpen) return null;

  const layouts: { id: StripLayout; label: string; count: string }[] = [
    { id: 'strip-3', label: '3-photo strip', count: '3 photos' },
    { id: 'strip-4', label: '4-photo strip', count: '4 photos' },
    { id: 'grid-2x2', label: '2 × 2 grid', count: '4 photos' },
    { id: 'single', label: 'Single portrait', count: '1 photo' },
  ];

  const filters: { id: PhotoFilter; label: string }[] = [
    { id: 'none', label: 'Normal' },
    { id: 'bw', label: 'Black and white' },
    { id: 'warm', label: 'Warm glow' },
    { id: 'vintage', label: 'Vintage' },
    { id: 'sepia', label: 'Sepia' },
    { id: 'cyberpunk', label: 'Neon' },
    { id: 'cold', label: 'Cool blue' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-6 animate-fade-in">
      <div className="w-full max-w-2xl bg-paper text-ink font-display border border-paper-control rounded flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-8 py-6 border-b border-paper-line">
          <h2 className="text-[22px] font-semibold tracking-tight">Booth and event settings</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="w-10 h-10 rounded flex items-center justify-center text-muted hover:text-ink hover:bg-paper-surface cursor-pointer">
            <span className="text-[22px] leading-none">×</span>
          </button>
        </div>

        <div className="p-8 flex flex-col gap-8 overflow-y-auto">
          <section className="grid gap-4">
            <h3 className="text-[18px] font-semibold tracking-tight">Event</h3>
            <label className="grid gap-2">
              <span className="text-[14px] font-medium">Name at the top of the strip</span>
              <input type="text" value={settings.eventName} onChange={(e) => onUpdateSettings({ eventName: e.target.value })} placeholder="e.g. Alex and Sam's wedding" className={INPUT} />
            </label>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="grid gap-2">
                <span className="text-[14px] font-medium">Date</span>
                <input type="text" value={settings.eventDate} onChange={(e) => onUpdateSettings({ eventDate: e.target.value })} placeholder="e.g. SEP 2026" className={INPUT} />
              </label>
              <label className="grid gap-2">
                <span className="text-[14px] font-medium">Hashtag</span>
                <input type="text" value={settings.eventHashtag} onChange={(e) => onUpdateSettings({ eventHashtag: e.target.value })} placeholder="e.g. #AlexSam2026" className={INPUT} />
              </label>
            </div>
          </section>

          <section className="grid gap-4">
            <h3 className="text-[18px] font-semibold tracking-tight">Strip layout</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {layouts.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => onUpdateSettings({ layout: l.id })}
                  aria-pressed={settings.layout === l.id}
                  className={`p-4 rounded border text-left cursor-pointer ${settings.layout === l.id ? OPTION_ON : OPTION_OFF}`}
                >
                  <p className="text-[16px] font-medium">{l.label}</p>
                  <p className="text-[14px] text-muted mt-1">{l.count}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="grid gap-4">
            <h3 className="text-[18px] font-semibold tracking-tight">Background</h3>
            <div className="grid grid-cols-3 gap-3">
              {FRAME_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => onUpdateSettings({ selectedThemeId: theme.id })}
                  aria-pressed={settings.selectedThemeId === theme.id}
                  className={`p-3 rounded border text-[15px] flex items-center gap-3 cursor-pointer ${settings.selectedThemeId === theme.id ? OPTION_ON : OPTION_OFF}`}
                >
                  <span className="w-6 h-6 rounded-full border border-paper-control shrink-0" style={{ backgroundColor: theme.backgroundColor }} />
                  <span className="truncate">{theme.name}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="grid gap-4">
            <h3 className="text-[18px] font-semibold tracking-tight">Camera</h3>
            <label className="grid gap-2">
              <span className="text-[14px] font-medium">Starting look for every photo</span>
              <select value={settings.selectedFilter} onChange={(e) => onUpdateSettings({ selectedFilter: e.target.value as PhotoFilter })} className={INPUT}>
                {filters.map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
            </label>

            <div className="grid gap-2">
              <span className="text-[14px] font-medium">Countdown before each photo</span>
              <div className="grid grid-cols-3 gap-3">
                {[3, 5, 7].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => onUpdateSettings({ countdownSeconds: sec })}
                    aria-pressed={settings.countdownSeconds === sec}
                    className={`h-11 rounded border text-[16px] cursor-pointer ${settings.countdownSeconds === sec ? 'bg-ink text-white border-ink' : OPTION_OFF}`}
                  >
                    {sec} seconds
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-paper-line">
              <div>
                <p className="text-[16px] font-medium">Mirror the camera</p>
                <p className="text-[14px] text-muted">Shows the preview the way a mirror does.</p>
              </div>
              <button
                type="button"
                onClick={() => onUpdateSettings({ mirrorCamera: !settings.mirrorCamera })}
                aria-pressed={settings.mirrorCamera}
                className={`${BTN_S} min-w-24`}
              >
                {settings.mirrorCamera ? 'On' : 'Off'}
              </button>
            </div>
          </section>
        </div>

        <div className="px-8 py-5 border-t border-paper-line flex justify-end">
          <button type="button" onClick={onClose} className="h-12 px-6 rounded bg-accent hover:bg-accent-press text-white text-[16px] font-medium cursor-pointer">
            Save and close
          </button>
        </div>
      </div>
    </div>
  );
};
