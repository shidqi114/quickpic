'use client';

import React from 'react';
import { BoothSettings, StripLayout, PhotoFilter } from '@/types/photobooth';
import { FRAME_THEMES } from '@/lib/compositor';
import { useOperatorT } from '@/lib/operatorStrings';
import { LanguageSwitch } from '@/components/ui/LanguageSwitch';

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
  const { t } = useOperatorT();

  if (!isOpen) return null;

  const layouts: { id: StripLayout; label: string; count: string }[] = [
    { id: 'strip-3', label: t('settings.layout.strip3'), count: t('settings.photos', { n: 3 }) },
    { id: 'strip-4', label: t('settings.layout.strip4'), count: t('settings.photos', { n: 4 }) },
    { id: 'grid-2x2', label: t('settings.layout.grid2x2'), count: t('settings.photos', { n: 4 }) },
    { id: 'single', label: t('settings.layout.single'), count: t('settings.photo', { n: 1 }) },
  ];

  const filters: { id: PhotoFilter; label: string }[] = [
    { id: 'none', label: t('settings.filter.none') },
    { id: 'bw', label: t('settings.filter.bw') },
    { id: 'warm', label: t('settings.filter.warm') },
    { id: 'vintage', label: t('settings.filter.vintage') },
    { id: 'sepia', label: t('settings.filter.sepia') },
    { id: 'cyberpunk', label: t('settings.filter.cyberpunk') },
    { id: 'cold', label: t('settings.filter.cold') },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-6 animate-fade-in">
      <div className="w-full max-w-2xl bg-paper text-ink font-display border border-paper-control rounded flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-8 py-6 border-b border-paper-line">
          <h2 className="text-[22px] font-semibold tracking-tight">{t('settings.title')}</h2>
          <button type="button" onClick={onClose} aria-label={t('settings.close')} className="w-10 h-10 rounded flex items-center justify-center text-muted hover:text-ink hover:bg-paper-surface cursor-pointer">
            <span className="text-[22px] leading-none">×</span>
          </button>
        </div>

        <div className="p-8 flex flex-col gap-8 overflow-y-auto">
          <section className="grid gap-4">
            <h3 className="text-[18px] font-semibold tracking-tight">{t('settings.language')}</h3>
            <LanguageSwitch />
          </section>

          <section className="grid gap-4">
            <h3 className="text-[18px] font-semibold tracking-tight">{t('settings.event')}</h3>
            <label className="grid gap-2">
              <span className="text-[14px] font-medium">{t('settings.nameLabel')}</span>
              <input type="text" value={settings.eventName} onChange={(e) => onUpdateSettings({ eventName: e.target.value })} placeholder={t('settings.namePlaceholder')} className={INPUT} />
            </label>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="grid gap-2">
                <span className="text-[14px] font-medium">{t('settings.dateLabel')}</span>
                <input type="text" value={settings.eventDate} onChange={(e) => onUpdateSettings({ eventDate: e.target.value })} placeholder={t('settings.datePlaceholder')} className={INPUT} />
              </label>
              <label className="grid gap-2">
                <span className="text-[14px] font-medium">{t('settings.hashtagLabel')}</span>
                <input type="text" value={settings.eventHashtag} onChange={(e) => onUpdateSettings({ eventHashtag: e.target.value })} placeholder={t('settings.hashtagPlaceholder')} className={INPUT} />
              </label>
            </div>
          </section>

          <section className="grid gap-4">
            <h3 className="text-[18px] font-semibold tracking-tight">{t('settings.layout')}</h3>
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
            <h3 className="text-[18px] font-semibold tracking-tight">{t('settings.background')}</h3>
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
            <h3 className="text-[18px] font-semibold tracking-tight">{t('settings.camera')}</h3>
            <label className="grid gap-2">
              <span className="text-[14px] font-medium">{t('settings.filterLabel')}</span>
              <select value={settings.selectedFilter} onChange={(e) => onUpdateSettings({ selectedFilter: e.target.value as PhotoFilter })} className={INPUT}>
                {filters.map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
            </label>

            <div className="grid gap-2">
              <span className="text-[14px] font-medium">{t('settings.countdownLabel')}</span>
              <div className="grid grid-cols-3 gap-3">
                {[3, 5, 7].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => onUpdateSettings({ countdownSeconds: sec })}
                    aria-pressed={settings.countdownSeconds === sec}
                    className={`h-11 rounded border text-[16px] cursor-pointer ${settings.countdownSeconds === sec ? 'bg-ink text-white border-ink' : OPTION_OFF}`}
                  >
                    {t('settings.seconds', { n: sec })}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-paper-line">
              <div>
                <p className="text-[16px] font-medium">{t('settings.mirror')}</p>
                <p className="text-[14px] text-muted">{t('settings.mirrorHint')}</p>
              </div>
              <button
                type="button"
                onClick={() => onUpdateSettings({ mirrorCamera: !settings.mirrorCamera })}
                aria-pressed={settings.mirrorCamera}
                className={`${BTN_S} min-w-24`}
              >
                {settings.mirrorCamera ? t('settings.on') : t('settings.off')}
              </button>
            </div>
          </section>
        </div>

        <div className="px-8 py-5 border-t border-paper-line flex justify-end">
          <button type="button" onClick={onClose} className="h-12 px-6 rounded bg-accent hover:bg-accent-press text-white text-[16px] font-medium cursor-pointer">
            {t('settings.save')}
          </button>
        </div>
      </div>
    </div>
  );
};
