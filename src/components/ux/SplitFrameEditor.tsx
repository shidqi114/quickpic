'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import {
  FrameTemplate,
  PhotoFilter,
  SlotAdjustment,
  WelcomeLanguage,
} from '@/types/photobooth';
import {
  StickerCanvasLayer,
  StickerItem,
  StickerPickerDrawer,
  StickerLibraryItem,
} from '@/components/ui/StickerCanvasLayer';

export interface PlacedSticker extends StickerItem { }

const COPY: Record<WelcomeLanguage, {
  preview: string;
  slot: (n: number, total: number) => string;
  editing: string;
  back: string;
  finish: string;
  filters: string;
  stickers: string;
  applyAll: (label: string) => string;
  filterLabel: (id: PhotoFilter, label: string) => string;
  noPhoto: string;
  close: string;
}> = {
  en: {
    preview: 'Your strip',
    slot: (n, total) => `Window ${n} of ${total}`,
    editing: 'Editing',
    back: 'Back to windows',
    finish: 'Finish and print',
    filters: 'Filters',
    stickers: 'Stickers',
    applyAll: (label) => `Use ${label} on every window`,
    filterLabel: (_id, label) => label,
    noPhoto: 'No photo for this window',
    close: 'Close',
  },
  id: {
    preview: 'Strip Anda',
    slot: (n, total) => `Jendela ${n} dari ${total}`,
    editing: 'Sedang mengedit',
    back: 'Kembali ke jendela',
    finish: 'Selesai dan cetak',
    filters: 'Filter',
    stickers: 'Stiker',
    applyAll: (label) => `Pakai ${label} di semua jendela`,
    filterLabel: (id) => FILTER_LABEL_ID[id],
    noPhoto: 'Tidak ada foto untuk jendela ini',
    close: 'Tutup',
  },
};

const FILTER_LABEL_ID: Record<PhotoFilter, string> = {
  none: 'Asli',
  bw: 'Hitam Putih',
  sepia: 'Sepia Retro',
  vintage: 'Film 90-an',
  warm: 'Jam Emas',
  cyberpunk: 'Siber',
  cold: 'Biru Dingin',
};

export interface SplitFrameEditorProps {
  /** Guest-facing language */
  language?: WelcomeLanguage;
  /** Array of raw captured photo URLs / base64 strings */
  capturedPhotos: string[];
  /** Selected frame template definition */
  selectedTemplate: FrameTemplate;
  /** Per-slot image adjustments (filters, zoom, pan, photoIndex) */
  slotAdjustments: Record<string, SlotAdjustment>;
  /** Callback when slot adjustment is updated */
  onUpdateSlotAdjustment: (slotId: string, adjustment: Partial<SlotAdjustment>) => void;
  /** Map of stickers per slot: slotId -> StickerItem[] */
  stickersBySlot?: Record<string, StickerItem[]>;
  /** Callback when stickers for a slot are updated */
  onUpdateSlotStickers?: (slotId: string, stickers: StickerItem[]) => void;
  /** Synchronized event name for strip header/footer branding */
  eventName?: string;
  /** Synchronized event date for strip footer branding */
  eventDate?: string;
  /** Callback to navigate back to step 1 (slot assignment) */
  onBackToStep1: () => void;
  /** Callback when customization is confirmed (proceed to print / QR) */
  onConfirm: () => void;
  /** Optional custom CSS classes */
  className?: string;
}

export const FILTER_PRESETS: {
  id: PhotoFilter;
  label: string;
  cssFilter: string;
  swatchGradient: string;
}[] = [
    { id: 'none', label: 'Original', cssFilter: 'none', swatchGradient: 'from-zinc-400 to-zinc-600' },
    { id: 'bw', label: 'B&W Classic', cssFilter: 'grayscale(100%) contrast(115%)', swatchGradient: 'from-gray-200 to-black' },
    { id: 'sepia', label: 'Retro Sepia', cssFilter: 'sepia(80%) contrast(95%) brightness(95%)', swatchGradient: 'from-amber-200 to-amber-800' },
    { id: 'vintage', label: '90s Film', cssFilter: 'sepia(30%) contrast(120%) saturate(125%) hue-rotate(-10deg)', swatchGradient: 'from-yellow-400 to-rose-600' },
    { id: 'warm', label: 'Golden Hour', cssFilter: 'saturate(140%) sepia(20%) brightness(105%)', swatchGradient: 'from-orange-400 to-pink-500' },
    { id: 'cyberpunk', label: 'Cyberpunk', cssFilter: 'contrast(130%) saturate(160%) hue-rotate(190deg)', swatchGradient: 'from-cyan-400 to-fuchsia-600' },
    { id: 'cold', label: 'Cold Cyan', cssFilter: 'contrast(110%) saturate(90%) hue-rotate(160deg) brightness(102%)', swatchGradient: 'from-teal-300 to-blue-700' },
  ];

export const SplitFrameEditor: React.FC<SplitFrameEditorProps> = ({
  language = 'en',
  capturedPhotos,
  selectedTemplate,
  slotAdjustments,
  onUpdateSlotAdjustment,
  stickersBySlot = {},
  onUpdateSlotStickers,
  eventName = 'QUICKPIC PHOTOBOOTH',
  eventDate = 'SEP 2026',
  onBackToStep1,
  onConfirm,
  className = '',
}) => {
  const copy = COPY[language];
  const [activeSlotId, setActiveSlotId] = useState<string>(
    selectedTemplate.slots[0]?.id || 's1'
  );
  const [activeTab, setActiveTab] = useState<'filter' | 'stickers' | null>(null);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);

  // Active slot & photo index
  const activeSlotIndex = selectedTemplate.slots.findIndex((s) => s.id === activeSlotId);
  const currentSlotAdj = slotAdjustments[activeSlotId] || {
    slotId: activeSlotId,
    photoIndex: Math.max(0, activeSlotIndex),
    zoom: 1.0,
    panX: 0,
    panY: 0,
    filter: 'none',
  };

  const activePhotoIndex = currentSlotAdj.photoIndex ?? activeSlotIndex;
  const activePhotoUrl = capturedPhotos[activePhotoIndex] || capturedPhotos[0] || '';
  const currentFilter = currentSlotAdj.filter || 'none';
  const activeFilterPreset = FILTER_PRESETS.find((f) => f.id === currentFilter) || FILTER_PRESETS[0];

  // Local or parent stickers for the active slot
  const [localStickers, setLocalStickers] = useState<Record<string, StickerItem[]>>(stickersBySlot);
  const currentStickers = localStickers[activeSlotId] || [];

  useEffect(() => {
    if (stickersBySlot) {
      setLocalStickers(stickersBySlot);
    }
  }, [stickersBySlot]);

  const handleSelectSlot = (slotId: string) => {
    setActiveSlotId(slotId);
    setSelectedStickerId(null);
  };

  const handleStickersChange = (updated: StickerItem[]) => {
    const nextMap = { ...localStickers, [activeSlotId]: updated };
    setLocalStickers(nextMap);
    if (onUpdateSlotStickers) {
      onUpdateSlotStickers(activeSlotId, updated);
    }
  };

  const handleAddSticker = (item: StickerLibraryItem) => {
    const nextZ = currentStickers.length > 0 ? Math.max(...currentStickers.map((s) => s.zIndex)) + 1 : 1;
    const newSticker: StickerItem = {
      id: `stk_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      type: item.type,
      content: item.content,
      x: 50,
      y: 50,
      scale: item.type === 'stamp' ? 1.0 : 1.4,
      rotation: 0,
      zIndex: nextZ,
    };
    handleStickersChange([...currentStickers, newSticker]);
    setSelectedStickerId(newSticker.id);
  };

  const handleFilterSelect = (filterId: PhotoFilter) => {
    onUpdateSlotAdjustment(activeSlotId, { filter: filterId });
  };

  const handleApplyFilterToAll = () => {
    selectedTemplate.slots.forEach((s) => {
      onUpdateSlotAdjustment(s.id, { filter: currentFilter });
    });
  };

  const activeSlot = selectedTemplate.slots[activeSlotIndex] || selectedTemplate.slots[0];
  const activeSlotAspect = activeSlot?.aspectRatio || 4 / 3;

  return (
    <section className={`min-h-screen bg-stage text-stage-ink font-display select-none grid lg:grid-cols-[minmax(0,35fr)_minmax(0,65fr)] ${className}`}>
      <div className="p-6 md:p-8 bg-stage-2 flex flex-col items-center gap-5">
        <div className="w-full max-w-[300px] flex items-center justify-between gap-3">
          <span className="text-[16px] text-stage-muted">{copy.preview}</span>
          <span className="text-[15px] text-stage-muted tabular-nums">{copy.slot(activeSlotIndex + 1, selectedTemplate.slots.length)}</span>
        </div>

        <div
          className="relative overflow-hidden"
          style={{
            backgroundColor: selectedTemplate.backgroundColor,
            width: selectedTemplate.category === 'strip' ? 'min(260px, 34vw)' : 'min(320px, 36vw)',
            aspectRatio: selectedTemplate.aspectRatio
              ? `${selectedTemplate.aspectRatio}`
              : selectedTemplate.category === 'strip'
              ? '1/3'
              : '2/3',
          }}
        >
          {selectedTemplate.overlayPngUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selectedTemplate.overlayPngUrl} alt="" className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none" />
          )}

          {selectedTemplate.slots.map((slot, index) => {
            const isActive = slot.id === activeSlotId;
            const slotAdj = slotAdjustments[slot.id];
            const photoIdx = slotAdj?.photoIndex ?? index;
            const photoUrl = capturedPhotos[photoIdx] || capturedPhotos[0];
            const slotFilter = slotAdj?.filter || 'none';
            const filterObj = FILTER_PRESETS.find((f) => f.id === slotFilter);
            const stickersInSlot = localStickers[slot.id] || [];

            return (
              <div
                key={slot.id}
                onClick={() => handleSelectSlot(slot.id)}
                style={{
                  left: `${slot.x}%`,
                  top: `${slot.y}%`,
                  width: `${slot.width}%`,
                  height: `${slot.height}%`,
                  containerType: 'inline-size',
                }}
                className={`@container absolute cursor-pointer overflow-hidden ${isActive ? 'outline-4 outline-accent -outline-offset-4 z-20' : 'outline-1 outline-stage-line -outline-offset-1 z-10'}`}
              >
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoUrl}
                    alt=""
                    style={{ filter: filterObj?.cssFilter || 'none' }}
                    className="w-full h-full object-cover select-none pointer-events-none"
                  />
                ) : (
                  <div className="w-full h-full bg-stage-3 flex items-center justify-center text-[14px] text-stage-muted">{copy.noPhoto}</div>
                )}

                {stickersInSlot.map((stk) => (
                  <div
                    key={stk.id}
                    style={{
                      left: `${stk.x}%`,
                      top: `${stk.y}%`,
                      transform: `translate(-50%, -50%) rotate(${stk.rotation}deg) scale(${stk.scale})`,
                      zIndex: stk.zIndex,
                    }}
                    className="absolute pointer-events-none select-none flex items-center justify-center"
                  >
                    {stk.type === 'emoji' && (
                      <span style={{ fontSize: '24cqw' }} className="leading-none inline-block">
                        {stk.content}
                      </span>
                    )}
                    {stk.type === 'stamp' && (
                      <div
                        style={{ fontSize: '7.5cqw', padding: '0.8cqw 1.8cqw' }}
                        className="bg-black/70 border border-pink-400 text-pink-300 font-black tracking-widest uppercase rounded whitespace-nowrap leading-tight"
                      >
                        {stk.content}
                      </div>
                    )}
                    {stk.type === 'badge' && (
                      <div
                        style={{ fontSize: '7cqw', padding: '0.8cqw 1.6cqw' }}
                        className="bg-amber-500/20 border border-amber-400 text-amber-300 font-extrabold tracking-wider rounded-full whitespace-nowrap leading-tight"
                      >
                        {stk.content}
                      </div>
                    )}
                  </div>
                ))}

                <span className="absolute bottom-1 right-1 px-1 bg-stage text-white text-[13px] tabular-nums">{index + 1}</span>
              </div>
            );
          })}

          {selectedTemplate.includeText !== false && (
            <div className="absolute bottom-3 inset-x-0 text-center px-3 z-20" style={{ color: selectedTemplate.textColor }}>
              <div className="font-semibold text-[15px] leading-tight truncate">{selectedTemplate.customText || eventName}</div>
              <div className="text-[13px] opacity-80 leading-tight mt-0.5 tabular-nums">{eventDate}</div>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 md:p-8 flex flex-col gap-5 min-w-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-[18px] text-stage-muted">
            {copy.editing} <span className="text-white font-medium">{copy.slot(activeSlotIndex + 1, selectedTemplate.slots.length)}</span>
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToStep1}
              className="h-14 px-5 rounded border border-stage-muted/50 text-[17px] cursor-pointer hover:bg-white/10"
            >
              {copy.back}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="h-14 px-7 rounded bg-accent hover:bg-accent-press text-white text-[18px] font-medium cursor-pointer"
            >
              {copy.finish}
            </button>
          </div>
        </div>

        <div className="relative flex-1 min-h-[420px] bg-stage-2 overflow-hidden flex items-center justify-center p-4">
          {activePhotoUrl ? (
            <div
              style={{
                aspectRatio: `${activeSlotAspect}`,
                containerType: 'inline-size',
                maxHeight: '100%',
                maxWidth: '100%',
              }}
              className={`@container relative overflow-hidden flex items-center justify-center select-none ${
                activeSlotAspect < 1 ? 'h-full w-auto max-w-full max-h-full' : 'w-full h-auto max-w-3xl max-h-full'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activePhotoUrl}
                alt={copy.slot(activeSlotIndex + 1, selectedTemplate.slots.length)}
                style={{ filter: activeFilterPreset.cssFilter }}
                className="w-full h-full object-cover pointer-events-none select-none"
              />

              <StickerCanvasLayer
                stickers={currentStickers}
                onStickersChange={handleStickersChange}
                selectedStickerId={selectedStickerId}
                onSelectSticker={setSelectedStickerId}
              />
            </div>
          ) : (
            <p className="text-[18px] text-stage-muted">{copy.noPhoto}</p>
          )}

          {activeTab && (
            <div className="absolute inset-0 z-25 bg-black/30" onClick={() => setActiveTab(null)} />
          )}

          <div className="absolute top-4 left-4 right-4 z-30 flex flex-col items-start gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-pressed={activeTab === 'filter'}
                onClick={() => setActiveTab(activeTab === 'filter' ? null : 'filter')}
                className={`h-12 px-5 rounded text-[17px] font-medium cursor-pointer border ${
                  activeTab === 'filter' ? 'bg-accent border-transparent text-white' : 'bg-stage border-stage-muted/50 text-white hover:bg-white/10'
                }`}
              >
                {copy.filters}
              </button>
              <button
                type="button"
                aria-pressed={activeTab === 'stickers'}
                onClick={() => setActiveTab(activeTab === 'stickers' ? null : 'stickers')}
                className={`h-12 px-5 rounded text-[17px] font-medium cursor-pointer border ${
                  activeTab === 'stickers' ? 'bg-accent border-transparent text-white' : 'bg-stage border-stage-muted/50 text-white hover:bg-white/10'
                }`}
              >
                {copy.stickers}{currentStickers.length > 0 ? ` (${currentStickers.length})` : ''}
              </button>
            </div>

            {activeTab && (
              <div className="w-full max-w-3xl bg-stage border border-stage-line p-4 flex flex-col gap-4 max-h-[380px] overflow-y-auto">
                {activeTab === 'filter' && (
                  <>
                    <div className="flex items-center justify-between gap-3 border-b border-stage-line pb-3">
                      <button
                        type="button"
                        onClick={handleApplyFilterToAll}
                        className="text-[15px] text-white underline underline-offset-4 cursor-pointer text-left"
                      >
                        {copy.applyAll(copy.filterLabel(activeFilterPreset.id, activeFilterPreset.label))}
                      </button>
                      <button type="button" onClick={() => setActiveTab(null)} className="h-10 px-3 rounded border border-stage-line text-[15px] cursor-pointer hover:bg-white/10" title={copy.close}>
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-3">
                      {FILTER_PRESETS.map((filter) => {
                        const isSelected = currentFilter === filter.id;
                        return (
                          <button
                            key={filter.id}
                            type="button"
                            onClick={() => handleFilterSelect(filter.id)}
                            aria-pressed={isSelected}
                            className={`flex flex-col items-center gap-2 p-2 rounded border ${isSelected ? 'border-white bg-stage-2' : 'border-stage-line hover:bg-stage-2'}`}
                          >
                            <div className="relative w-full aspect-square overflow-hidden">
                              {activePhotoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={activePhotoUrl} alt="" style={{ filter: filter.cssFilter }} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-stage-3" />
                              )}
                            </div>
                            <span className={`text-[14px] leading-tight text-center ${isSelected ? 'text-white font-medium' : 'text-stage-muted'}`}>
                              {copy.filterLabel(filter.id, filter.label)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {activeTab === 'stickers' && (
                  <StickerPickerDrawer
                    language={language}
                    onSelectSticker={handleAddSticker}
                    onClearAll={() => handleStickersChange([])}
                    stickersCount={currentStickers.length}
                    headerRight={
                      <button type="button" onClick={() => setActiveTab(null)} className="h-10 px-3 rounded border border-stage-line text-[15px] cursor-pointer hover:bg-white/10" title={copy.close}>
                        <X className="w-4 h-4" />
                      </button>
                    }
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
