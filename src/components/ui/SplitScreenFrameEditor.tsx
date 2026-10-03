'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Palette,
  Smile,
  Check,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Layers,
  ArrowRight,
  Image as ImageIcon,
} from 'lucide-react';
import { FrameTemplate, PhotoFilter, SlotAdjustment } from '@/types/photobooth';
import {
  StickerCanvasLayer,
  StickerItem,
  StickerPickerDrawer,
  StickerLibraryItem,
} from './StickerCanvasLayer';

export interface SplitScreenFrameEditorProps {
  /** Captured raw photos array */
  capturedPhotos: string[];
  /** Selected frame template */
  selectedTemplate: FrameTemplate;
  /** Slot mapping and filter adjustments */
  slotAdjustments: Record<string, SlotAdjustment>;
  /** Callback when slot adjustment is updated */
  onUpdateSlotAdjustment: (slotId: string, adjustment: Partial<SlotAdjustment>) => void;
  /** Stickers per slot: slotId -> StickerItem[] */
  slotStickers?: Record<string, StickerItem[]>;
  /** Callback when stickers for a slot are updated */
  onUpdateSlotStickers?: (slotId: string, stickers: StickerItem[]) => void;
  /** Callback when guest completes customization */
  onConfirm: () => void;
  /** Optional retake callback */
  onRetakePhoto?: (slotIndex: number, slotId: string) => void;
  /** Optional custom class */
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

export const SplitScreenFrameEditor: React.FC<SplitScreenFrameEditorProps> = ({
  capturedPhotos,
  selectedTemplate,
  slotAdjustments,
  onUpdateSlotAdjustment,
  slotStickers = {},
  onUpdateSlotStickers,
  onConfirm,
  onRetakePhoto,
  className = '',
}) => {
  const [activeSlotId, setActiveSlotId] = useState<string>(
    selectedTemplate.slots[0]?.id || 's1'
  );
  const [activeTab, setActiveTab] = useState<'filter' | 'stickers'>('filter');

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
  const [localStickers, setLocalStickers] = useState<Record<string, StickerItem[]>>(slotStickers);
  const currentStickers = localStickers[activeSlotId] || [];

  useEffect(() => {
    if (slotStickers) {
      setLocalStickers(slotStickers);
    }
  }, [slotStickers]);

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
  };

  const handleFilterSelect = (filterId: PhotoFilter) => {
    onUpdateSlotAdjustment(activeSlotId, { filter: filterId });
  };

  const handleApplyFilterToAll = () => {
    selectedTemplate.slots.forEach((s) => {
      onUpdateSlotAdjustment(s.id, { filter: currentFilter });
    });
  };

  const handleNextSlot = () => {
    const nextIdx = (activeSlotIndex + 1) % selectedTemplate.slots.length;
    setActiveSlotId(selectedTemplate.slots[nextIdx].id);
  };

  const handlePrevSlot = () => {
    const prevIdx = (activeSlotIndex - 1 + selectedTemplate.slots.length) % selectedTemplate.slots.length;
    setActiveSlotId(selectedTemplate.slots[prevIdx].id);
  };

  return (
    <div className={`w-full max-w-7xl mx-auto flex flex-col gap-4 p-3 md:p-6 bg-zinc-950 text-white select-none ${className}`}>
      {/* Top Banner Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900/90 border border-zinc-800 rounded-2xl px-5 py-3.5 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-pink-600 to-purple-600 rounded-xl shadow-md shadow-pink-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
              Uneven Split-Screen Photo & Sticker Studio
              <span className="text-xs px-2 py-0.5 rounded-full bg-pink-500/20 border border-pink-500/40 text-pink-300 font-bold uppercase">
                {selectedTemplate.name}
              </span>
            </h2>
            <p className="text-xs text-zinc-400">
              Pick a photo slot on the left strip preview, then style with live filters & free-transform stickers.
            </p>
          </div>
        </div>

        {/* Global Action: Finish & Print */}
        <button
          type="button"
          onClick={onConfirm}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-black rounded-xl text-sm shadow-lg shadow-pink-500/30 active:scale-95 transition-all transform"
        >
          <span>Complete & Print Strip</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Main Uneven Split Layout (35% Left vs 65% Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ========================================================= */}
        {/* Left Column (~35% width -> col-span-4 or 5)               */}
        {/* Full Composite Strip Preview with Active Slot Glow Indicator */}
        {/* ========================================================= */}
        <div className="lg:col-span-4 xl:col-span-4 flex flex-col items-center bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-4 md:p-5 shadow-2xl backdrop-blur-md">
          <div className="w-full flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-pink-400" />
              Composite Strip Preview
            </span>
            <span className="text-[11px] font-mono text-pink-400 bg-pink-500/10 border border-pink-500/30 px-2 py-0.5 rounded-full font-semibold">
              Slot {activeSlotIndex + 1} of {selectedTemplate.slots.length}
            </span>
          </div>

          {/* Strip Frame Container */}
          <div
            style={{
              backgroundColor: selectedTemplate.backgroundColor || '#ffffff',
              aspectRatio: selectedTemplate.category === 'strip' ? '1/3' : selectedTemplate.category === '4r' ? '4/6' : '3/4',
            }}
            className="relative w-full max-w-[280px] sm:max-w-[300px] rounded-2xl p-3 md:p-4 shadow-2xl flex flex-col justify-between overflow-hidden border border-zinc-700/50 transition-all"
          >
            {/* Template Header / Branding */}
            <div className="w-full text-center py-1">
              <span
                style={{ color: selectedTemplate.textColor || '#18181b' }}
                className="text-[11px] font-black tracking-widest uppercase font-mono block truncate"
              >
                QUICKPIC STUDIO
              </span>
            </div>

            {/* Picture Slots List */}
            <div className="flex-1 flex flex-col gap-2.5 my-1.5 justify-center">
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
                    onClick={() => setActiveSlotId(slot.id)}
                    style={{ aspectRatio: `${slot.aspectRatio || 4 / 3}` }}
                    className={`relative w-full rounded-xl overflow-hidden cursor-pointer transition-all duration-300 group ${
                      isActive
                        ? 'ring-4 ring-pink-500 ring-offset-2 ring-offset-zinc-950 shadow-2xl shadow-pink-500/60 scale-[1.03] z-20'
                        : 'hover:opacity-90 hover:scale-[1.01] opacity-75 z-10'
                    }`}
                  >
                    {/* Active Glowing Indicator Badge */}
                    {isActive && (
                      <div className="absolute top-2 left-2 z-30 bg-pink-500 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-md shadow-lg shadow-pink-500/40 flex items-center gap-1 animate-pulse">
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

                    {/* Slot Stickers Preview in composite strip */}
                    {stickersInSlot.map((stk) => (
                      <div
                        key={stk.id}
                        style={{
                          left: `${stk.x}%`,
                          top: `${stk.y}%`,
                          transform: `translate(-50%, -50%) rotate(${stk.rotation}deg) scale(${stk.scale * 0.6})`,
                        }}
                        className="absolute pointer-events-none select-none text-xl drop-shadow-sm"
                      >
                        {stk.type === 'emoji' ? stk.content : (
                          <span className="text-[7px] font-black uppercase px-1 py-0.5 bg-black/80 text-pink-300 border border-pink-400 rounded">
                            {stk.content}
                          </span>
                        )}
                      </div>
                    ))}

                    {/* Slot Number Label Overlay */}
                    <div className="absolute bottom-1.5 right-2 bg-black/60 backdrop-blur-xs text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
                      #{index + 1}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Template Footer Branding */}
            <div className="w-full text-center pt-1 border-t border-zinc-200/20">
              <span
                style={{ color: selectedTemplate.textColor || '#71717a' }}
                className="text-[9px] font-bold tracking-wider uppercase font-mono block"
              >
                ★ LIVE MEMORIES ★
              </span>
            </div>
          </div>

          {/* Slot Switcher Pills */}
          <div className="w-full mt-4 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={handlePrevSlot}
              className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition"
              title="Previous Slot"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex gap-1.5">
              {selectedTemplate.slots.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveSlotId(s.id)}
                  className={`w-8 h-8 rounded-xl font-bold text-xs transition-all ${
                    s.id === activeSlotId
                      ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/30 scale-105'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleNextSlot}
              className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition"
              title="Next Slot"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* Right Column (~65% width -> col-span-8 or 7)              */}
        {/* Enlarged Active Photo Workspace with Filter & Sticker Bar */}
        {/* (Note: Zoom/Pan/Face controls decommissioned)              */}
        {/* ========================================================= */}
        <div className="lg:col-span-8 xl:col-span-8 flex flex-col gap-4 bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-4 md:p-6 shadow-2xl backdrop-blur-md">
          
          {/* Top Toolbars: Filters & Sticker Catalog Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
            {/* Active Tab Selector */}
            <div className="flex items-center gap-2 bg-zinc-950 p-1.5 rounded-2xl border border-zinc-800">
              <button
                type="button"
                onClick={() => setActiveTab('filter')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'filter'
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md shadow-pink-500/25'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>Filters & Presets</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('stickers')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'stickers'
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md shadow-pink-500/25'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                }`}
              >
                <Smile className="w-3.5 h-3.5" />
                <span>Stickers & Stamps ({currentStickers.length})</span>
              </button>
            </div>

            {/* Quick Slot Actions */}
            <div className="flex items-center gap-2">
              {onRetakePhoto && (
                <button
                  type="button"
                  onClick={() => onRetakePhoto(activePhotoIndex, activeSlotId)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-rose-950/40 border border-zinc-700 hover:border-rose-500/40 text-rose-300 rounded-xl text-xs font-semibold transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retake Slot #{activeSlotIndex + 1}</span>
                </button>
              )}
            </div>
          </div>

          {/* Sub-Panel: Filter Presets Swatches */}
          {activeTab === 'filter' && (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Color Grading & Looks
                </span>
                <button
                  type="button"
                  onClick={handleApplyFilterToAll}
                  className="text-[11px] font-semibold text-pink-400 hover:text-pink-300 transition"
                >
                  Apply &quot;{activeFilterPreset.label}&quot; to all slots
                </button>
              </div>

              {/* Filter Swatches Carousel */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
                {FILTER_PRESETS.map((filter) => {
                  const isSelected = currentFilter === filter.id;
                  return (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => handleFilterSelect(filter.id)}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl border transition-all ${
                        isSelected
                          ? 'bg-pink-500/15 border-pink-500 ring-2 ring-pink-500/50 scale-105 shadow-lg shadow-pink-500/20'
                          : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/40'
                      }`}
                    >
                      {/* Thumbnail with filter preview */}
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-zinc-700">
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
                          <div className="absolute inset-0 bg-pink-500/20 flex items-center justify-center">
                            <Check className="w-4 h-4 text-white drop-shadow" />
                          </div>
                        )}
                      </div>
                      <span className={`text-[11px] font-bold text-center truncate max-w-full ${
                        isSelected ? 'text-pink-400' : 'text-zinc-400'
                      }`}>
                        {filter.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sub-Panel: Sticker Picker Drawer */}
          {activeTab === 'stickers' && (
            <StickerPickerDrawer
              onSelectSticker={handleAddSticker}
              onClearAll={() => handleStickersChange([])}
              stickersCount={currentStickers.length}
            />
          )}

          {/* Enlarged Photo Workspace Canvas */}
          <div className="relative w-full aspect-4/3 md:aspect-16/10 rounded-2xl bg-zinc-950 border-2 border-zinc-800 overflow-hidden flex items-center justify-center shadow-inner group">
            {activePhotoUrl ? (
              <div className="relative w-full h-full flex items-center justify-center">
                {/* Enlarged Photo with Active Filter */}
                <img
                  src={activePhotoUrl}
                  alt={`Slot ${activeSlotIndex + 1} Workspace`}
                  style={{ filter: activeFilterPreset.cssFilter }}
                  className="w-full h-full object-contain pointer-events-none select-none transition-all duration-200"
                />

                {/* Interactive Sticker Layer */}
                <StickerCanvasLayer
                  stickers={currentStickers}
                  onStickersChange={handleStickersChange}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 text-zinc-500">
                <ImageIcon className="w-10 h-10 stroke-1" />
                <span className="text-sm font-semibold">No photo captured for this slot</span>
              </div>
            )}

            {/* Slot Label Badge */}
            <div className="absolute top-3 left-3 bg-zinc-950/80 backdrop-blur-md border border-zinc-700 px-3 py-1 rounded-xl text-xs font-mono font-bold text-pink-300 flex items-center gap-1.5 shadow-lg">
              <span>Editing Slot #{activeSlotIndex + 1}</span>
            </div>
          </div>

          {/* Raw Shot Selector for Slot mapping */}
          {capturedPhotos.length > 1 && (
            <div className="flex items-center gap-3 bg-zinc-950/80 border border-zinc-800 rounded-2xl p-3">
              <span className="text-xs font-bold text-zinc-400 whitespace-nowrap">
                Map Raw Shot to Slot #{activeSlotIndex + 1}:
              </span>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {capturedPhotos.map((photo, idx) => {
                  const isAssigned = activePhotoIndex === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onUpdateSlotAdjustment(activeSlotId, { photoIndex: idx })}
                      className={`relative w-12 h-12 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${
                        isAssigned
                          ? 'border-pink-500 ring-2 ring-pink-500/50 scale-105'
                          : 'border-zinc-700 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={photo} alt={`Raw ${idx + 1}`} className="w-full h-full object-cover" />
                      <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-[9px] font-mono px-1 rounded text-white">
                        #{idx + 1}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
