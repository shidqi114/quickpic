'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ArrowLeft,
  Check,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Layers,
  Image as ImageIcon,
  Palette,
  Sliders,
  Smile,
  X,
} from 'lucide-react';
import {
  FrameTemplate,
  PhotoFilter,
  SlotAdjustment,
} from '@/types/photobooth';
import {
  StickerCanvasLayer,
  StickerItem,
  StickerPickerDrawer,
  StickerLibraryItem,
} from '@/components/ui/StickerCanvasLayer';

export interface PlacedSticker extends StickerItem { }

export interface SplitFrameEditorProps {
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
    <div className={`w-full max-w-7xl mx-auto flex flex-col gap-4 p-3 md:p-6 bg-zinc-950 text-white select-none animate-fade-in ${className}`}>
      {/* Main Uneven Split Layout: 35% Left Overview vs 65% Right Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

        {/* ========================================================= */}
        {/* Left Column (~35% width -> col-span-4)                     */}
        {/* Full Strip Preview with synchronized header/footer branding */}
        {/* ========================================================= */}
        <div className="lg:col-span-4 flex flex-col items-center">
          <div className="w-full max-w-[280px] flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-pink-400" />
              Full Strip Preview
            </span>
            <span className="text-[11px] font-mono text-pink-400 bg-pink-500/10 border border-pink-500/30 px-2 py-0.5 rounded-full font-semibold">
              Slot {activeSlotIndex + 1} of {selectedTemplate.slots.length}
            </span>
          </div>

          {/* Strip Frame Container */}
          <div
            className="relative shadow-2xl rounded-2xl overflow-hidden border-4 transition-all duration-300"
            style={{
              backgroundColor: selectedTemplate.backgroundColor,
              borderColor: selectedTemplate.accentColor,
              width: selectedTemplate.category === 'strip' ? '220px' : '300px',
              aspectRatio: selectedTemplate.aspectRatio
                ? `${selectedTemplate.aspectRatio}`
                : selectedTemplate.category === 'strip'
                ? '1/3'
                : '2/3',
            }}
          >
            {/* Custom Template Frame Artwork as the BACKGROUND layer */}
            {selectedTemplate.overlayPngUrl && (
              <img
                src={selectedTemplate.overlayPngUrl}
                alt="Template Frame Background"
                className="absolute inset-0 w-full h-full object-fill pointer-events-none z-0 select-none"
              />
            )}

            {/* Photo Slots in FRONT of the template background */}
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
                  className={`@container absolute cursor-pointer overflow-hidden rounded-lg transition-all ${isActive
                    ? 'ring-4 ring-pink-500 z-20 scale-[1.03] shadow-lg shadow-pink-500/30'
                    : 'ring-1 ring-zinc-400/40 z-10 hover:ring-pink-400/80'
                    }`}
                >
                  {/* Active Glowing Indicator Badge */}
                  {isActive && (
                    <div className="absolute top-1 left-1 z-30 bg-pink-500 text-white text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow flex items-center gap-1 animate-pulse">
                      <Sparkles className="w-2.5 h-2.5" />
                      <span>Editing</span>
                    </div>
                  )}

                  {/* Slot Photo Image with applied filter */}
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={`Slot ${index + 1}`}
                      style={{ filter: filterObj?.cssFilter || 'none' }}
                      className="w-full h-full object-cover select-none pointer-events-none transition-all duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-500 text-xs font-semibold">
                      Photo #{index + 1}
                    </div>
                  )}

                  {/* Slot Stickers Preview in composite strip (100% matched container-query proportions) */}
                  {stickersInSlot.map((stk) => (
                    <div
                      key={stk.id}
                      style={{
                        left: `${stk.x}%`,
                        top: `${stk.y}%`,
                        transform: `translate(-50%, -50%) rotate(${stk.rotation}deg) scale(${stk.scale})`,
                        zIndex: stk.zIndex,
                      }}
                      className="absolute pointer-events-none select-none drop-shadow-sm flex items-center justify-center"
                    >
                      {stk.type === 'emoji' && (
                        <span style={{ fontSize: '24cqw' }} className="leading-none inline-block filter drop-shadow-sm">
                          {stk.content}
                        </span>
                      )}
                      {stk.type === 'stamp' && (
                        <div
                          style={{ fontSize: '7.5cqw', padding: '0.8cqw 1.8cqw' }}
                          className="bg-black/70 backdrop-blur-xs border border-pink-400 text-pink-300 font-black tracking-widest uppercase rounded shadow whitespace-nowrap leading-tight"
                        >
                          {stk.content}
                        </div>
                      )}
                      {stk.type === 'badge' && (
                        <div
                          style={{ fontSize: '7cqw', padding: '0.8cqw 1.6cqw' }}
                          className="bg-amber-500/20 border border-amber-400 text-amber-300 font-extrabold tracking-wider rounded-full shadow whitespace-nowrap leading-tight"
                        >
                          {stk.content}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Slot Number Label Overlay */}
                  <div className="absolute bottom-1 right-1 bg-black/60 backdrop-blur-xs text-white text-[9px] font-mono px-1 rounded">
                    #{index + 1}
                  </div>
                </div>
              );
            })}

            {/* Template Footer Branding (if enabled) */}
            {selectedTemplate.includeText !== false && (
              <div
                className="absolute bottom-2 inset-x-0 text-center font-mono select-none px-2 z-20"
                style={{ color: selectedTemplate.textColor }}
              >
                <div className="font-black text-[10px] tracking-widest uppercase truncate leading-tight">
                  {selectedTemplate.customText || eventName.toUpperCase()}
                </div>
                <div className="text-[8px] font-semibold tracking-wider opacity-75 leading-tight mt-0.5">
                  ★ {eventDate} ★
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* Right Column (~65% width -> col-span-8)                    */}
        {/* Enlarged Active Slot Workspace + Sticker Engine            */}
        {/* ========================================================= */}
        <div className="lg:col-span-8 flex flex-col gap-4 bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-4 md:p-6 shadow-2xl backdrop-blur-md h-full">

          {/* Top Bar: Slot Information & Action Buttons */}
          <div className="flex items-center justify-between gap-3 border-b border-zinc-800 pb-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="bg-zinc-900/90 border border-zinc-800 px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold text-pink-300 flex items-center gap-1.5 shadow-sm">
                <span>Editing Slot #{activeSlotIndex + 1}</span>
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onBackToStep1}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white font-semibold rounded-xl text-xs transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Slots</span>
              </button>

              <button
                type="button"
                onClick={onConfirm}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-pink-500 via-rose-500 to-yellow-400 hover:brightness-110 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-pink-500/30 active:scale-95 transition-all"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Finish & Print Strip</span>
              </button>
            </div>
          </div>

          {/* Enlarged Photo Workspace Canvas */}
          <div className="relative w-full flex-1 rounded-2xl bg-zinc-950 border-2 border-zinc-800 p-2 md:p-4 overflow-hidden flex items-center justify-center shadow-inner group min-h-[480px] max-h-[660px]">
            {activePhotoUrl ? (
              <div
                style={{
                  aspectRatio: `${activeSlotAspect}`,
                  containerType: 'inline-size',
                  maxHeight: '100%',
                  maxWidth: '100%',
                }}
                className={`@container relative rounded-xl overflow-hidden shadow-2xl border border-zinc-700 bg-zinc-900 flex items-center justify-center select-none transition-all duration-300 ${
                  activeSlotAspect < 1
                    ? 'h-full w-auto max-w-full max-h-full'
                    : 'w-full h-auto max-w-3xl max-h-full'
                }`}
              >
                {/* Enlarged Photo with Active Filter */}
                <img
                  src={activePhotoUrl}
                  alt={`Slot ${activeSlotIndex + 1} Workspace`}
                  style={{ filter: activeFilterPreset.cssFilter }}
                  className="w-full h-full object-cover pointer-events-none select-none transition-all duration-200"
                />

                {/* Interactive Sticker Layer matching exact photo frame */}
                <StickerCanvasLayer
                  stickers={currentStickers}
                  onStickersChange={handleStickersChange}
                  selectedStickerId={selectedStickerId}
                  onSelectSticker={setSelectedStickerId}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 text-zinc-500 py-12">
                <ImageIcon className="w-10 h-10 stroke-1" />
                <span className="text-sm font-semibold">No photo captured for this slot</span>
              </div>
            )}

            {/* Click-outside backdrop to dismiss dropdown */}
            {activeTab && (
              <div
                className="absolute inset-0 z-25 bg-black/20"
                onClick={() => setActiveTab(null)}
              />
            )}

            {/* Top-Left Action Buttons & Dropdown Container */}
            <div className="absolute top-3 left-3 right-3 z-30 flex flex-col items-start gap-2">
              {/* Trigger Buttons Row */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab(activeTab === 'filter' ? null : 'filter')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold backdrop-blur-md border transition-all ${activeTab === 'filter'
                    ? 'bg-pink-500 text-white border-pink-400 shadow-lg shadow-pink-500/30 ring-2 ring-pink-400/50'
                    : 'bg-zinc-950/80 border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-900/90 shadow-lg'
                    }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Photo Filters ({FILTER_PRESETS.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab(activeTab === 'stickers' ? null : 'stickers')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold backdrop-blur-md border transition-all ${activeTab === 'stickers'
                    ? 'bg-pink-500 text-white border-pink-400 shadow-lg shadow-pink-500/30 ring-2 ring-pink-400/50'
                    : 'bg-zinc-950/80 border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-900/90 shadow-lg'
                    }`}
                >
                  <Smile className="w-3.5 h-3.5" />
                  <span>Sticker Drawer {currentStickers.length > 0 ? `(${currentStickers.length})` : ''}</span>
                </button>
              </div>

              {/* Dropdown Panel positioned directly underneath the trigger buttons */}
              {activeTab && (
                <div className="w-full bg-zinc-950/85 backdrop-blur-xl border border-zinc-700/80 rounded-2xl p-3 md:p-4 shadow-2xl shadow-black/80 flex flex-col gap-3 max-h-[380px] overflow-y-auto animate-fade-in ring-1 ring-white/10">
                  {/* Filter Tab: Header with Apply to all + Close button */}
                  {activeTab === 'filter' && (
                    <>
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                        <div>
                          <button
                            type="button"
                            onClick={handleApplyFilterToAll}
                            className="text-[11px] font-semibold text-pink-400 hover:text-pink-300 transition bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 px-2.5 py-1 rounded-lg"
                          >
                            Apply &quot;{activeFilterPreset.label}&quot; to all slots
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTab(null)}
                          className="p-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition ml-auto"
                          title="Close"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Filter Swatches Content */}
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2 pt-1">
                        {FILTER_PRESETS.map((filter) => {
                          const isSelected = currentFilter === filter.id;
                          return (
                            <button
                              key={filter.id}
                              type="button"
                              onClick={() => handleFilterSelect(filter.id)}
                              className={`flex flex-col items-center gap-1.5 p-1.5 rounded-xl border transition-all ${
                                isSelected
                                  ? 'bg-pink-500/20 border-pink-500 ring-2 ring-pink-500/50 scale-105 shadow-md shadow-pink-500/20'
                                  : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50'
                              }`}
                            >
                              <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-zinc-700">
                                {activePhotoUrl ? (
                                  <img
                                    src={activePhotoUrl}
                                    alt={filter.label}
                                    style={{ filter: filter.cssFilter }}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className={`w-full h-full bg-gradient-to-tr ${filter.swatchGradient}`} />
                                )}
                                {isSelected && (
                                  <div className="absolute inset-0 bg-pink-500/25 flex items-center justify-center">
                                    <Check className="w-3.5 h-3.5 text-white drop-shadow" />
                                  </div>
                                )}
                              </div>
                              <span
                                className={`text-[10px] font-bold text-center truncate max-w-full ${
                                  isSelected ? 'text-pink-400' : 'text-zinc-400'
                                }`}
                              >
                                {filter.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* Sticker Tab: Category Pills & Close button in the same header row */}
                  {activeTab === 'stickers' && (
                    <StickerPickerDrawer
                      onSelectSticker={handleAddSticker}
                      onClearAll={() => handleStickersChange([])}
                      stickersCount={currentStickers.length}
                      headerRight={
                        <button
                          type="button"
                          onClick={() => setActiveTab(null)}
                          className="p-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition"
                          title="Close"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      }
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
