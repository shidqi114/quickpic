'use client';

import React, { useState } from 'react';
import {
  FrameTemplate,
  PhotoFilter,
  SlotAdjustment,
  FrameTheme,
} from '@/types/photobooth';
import { FRAME_THEMES } from '@/lib/compositor';
import {
  Sparkles,
  Palette,
  Check,
  ArrowLeft,
  Smile,
  Layers,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  StickerCanvasLayer,
  StickerItem,
  StickerPickerDrawer,
  StickerLibraryItem,
} from '@/components/ui/StickerCanvasLayer';

export interface PlacedSticker {
  id: string;
  emoji: string;
  x: number; // 0 - 100 percentage
  y: number; // 0 - 100 percentage
  scale: number; // 0.6 - 2.5
  rotation: number; // 0 - 360 deg
}

interface SplitFrameEditorProps {
  capturedPhotos: string[];
  selectedTemplate: FrameTemplate;
  onSelectTemplate: (template: FrameTemplate) => void;
  slotAdjustments: Record<string, SlotAdjustment>;
  onUpdateSlotAdjustment: (slotId: string, adjustment: Partial<SlotAdjustment>) => void;
  stickersBySlot: Record<string, PlacedSticker[]>;
  onUpdateSlotStickers: (slotId: string, stickers: PlacedSticker[]) => void;
  onBackToStep1: () => void;
  onConfirm: () => void;
}

const FILTERS: { id: PhotoFilter; label: string; cssFilter: string }[] = [
  { id: 'none', label: 'Normal', cssFilter: 'none' },
  { id: 'bw', label: 'B&W Classic', cssFilter: 'grayscale(100%) contrast(120%)' },
  { id: 'vintage', label: '90s Vintage', cssFilter: 'sepia(50%) contrast(90%) brightness(105%)' },
  { id: 'warm', label: 'Warm Glow', cssFilter: 'sepia(30%) saturate(140%)' },
  { id: 'sepia', label: 'Retro Sepia', cssFilter: 'sepia(85%)' },
  { id: 'cyberpunk', label: 'Cyberpunk', cssFilter: 'contrast(130%) saturate(160%) hue-rotate(15deg)' },
  { id: 'cold', label: 'Cold Breeze', cssFilter: 'saturate(90%) hue-rotate(190deg) brightness(105%)' },
];

export const SplitFrameEditor: React.FC<SplitFrameEditorProps> = ({
  capturedPhotos,
  selectedTemplate,
  onSelectTemplate,
  slotAdjustments,
  onUpdateSlotAdjustment,
  stickersBySlot,
  onUpdateSlotStickers,
  onBackToStep1,
  onConfirm,
}) => {
  const [activeSlotId, setActiveSlotId] = useState<string>(selectedTemplate.slots[0]?.id || 's1');

  const activeSlotIndex = selectedTemplate.slots.findIndex((s) => s.id === activeSlotId);
  const currentAdj = slotAdjustments[activeSlotId] || {
    slotId: activeSlotId,
    photoIndex: Math.max(0, activeSlotIndex),
    zoom: 1.0,
    panX: 0,
    panY: 0,
    filter: 'none',
  };

  const activePhotoIndex = currentAdj.photoIndex ?? activeSlotIndex;
  const activePhoto = capturedPhotos[activePhotoIndex] || capturedPhotos[0] || '';
  const currentRawStickers = stickersBySlot[activeSlotId] || [];

  // Convert PlacedSticker[] to StickerItem[] for StickerCanvasLayer
  const canvasStickers: StickerItem[] = currentRawStickers.map((s) => ({
    id: s.id,
    type: 'emoji',
    content: s.emoji,
    x: s.x,
    y: s.y,
    scale: s.scale,
    rotation: s.rotation,
    zIndex: 1,
  }));

  const handleStickersChange = (updatedItems: StickerItem[]) => {
    const updatedPlaced: PlacedSticker[] = updatedItems.map((item) => ({
      id: item.id,
      emoji: item.content,
      x: item.x,
      y: item.y,
      scale: item.scale,
      rotation: item.rotation,
    }));
    onUpdateSlotStickers(activeSlotId, updatedPlaced);
  };

  const handleAddStickerFromDrawer = (item: StickerLibraryItem) => {
    const newSticker: StickerItem = {
      id: `stk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: item.type,
      content: item.content,
      x: 50,
      y: 50,
      scale: 1.2,
      rotation: 0,
      zIndex: canvasStickers.length + 1,
    };
    handleStickersChange([...canvasStickers, newSticker]);
  };

  const handleNextSlot = () => {
    const nextIdx = (activeSlotIndex + 1) % selectedTemplate.slots.length;
    setActiveSlotId(selectedTemplate.slots[nextIdx].id);
  };

  const handlePrevSlot = () => {
    const prevIdx = (activeSlotIndex - 1 + selectedTemplate.slots.length) % selectedTemplate.slots.length;
    setActiveSlotId(selectedTemplate.slots[prevIdx].id);
  };

  const activeFilterPreset = FILTERS.find((f) => f.id === currentAdj.filter) || FILTERS[0];

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col p-3 md:p-6 text-zinc-100 select-none animate-fade-in">
      {/* Top Banner */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-300 text-[11px] font-bold uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5" /> Step 2: 35/65 Uneven Split Editor
          </div>
          <h2 className="text-xl md:text-2xl font-black text-white">
            Custom Filters & Canva-Style Stickers
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToStep1}
            className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Slots
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 via-rose-500 to-yellow-400 hover:brightness-110 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-pink-500/25 active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[3]" /> Finish & Print
          </button>
        </div>
      </div>

      {/* 35% / 65% Uneven Split-Screen Layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-stretch">
        
        {/* ========================================================================= */}
        {/* LEFT COLUMN (~35% Width): Composite Strip Preview with Active Slot Glow  */}
        {/* ========================================================================= */}
        <div className="w-full lg:w-[35%] bg-zinc-900 border border-zinc-800 rounded-3xl p-5 flex flex-col items-center justify-between shadow-2xl">
          <div className="w-full flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-pink-400" />
              Composite Strip Preview
            </span>
            <span className="text-[11px] font-mono text-pink-400 bg-pink-500/10 border border-pink-500/30 px-2 py-0.5 rounded-full font-semibold">
              Slot {activeSlotIndex + 1} of {selectedTemplate.slots.length}
            </span>
          </div>

          {/* Frame Container */}
          <div
            className="relative shadow-2xl rounded-xl overflow-hidden border-2 transition-all my-auto"
            style={{
              backgroundColor: selectedTemplate.backgroundColor || '#ffffff',
              borderColor: selectedTemplate.accentColor || '#ec4899',
              width: selectedTemplate.category === 'strip' ? '210px' : '280px',
              aspectRatio:
                selectedTemplate.category === 'strip'
                  ? '1/3'
                  : selectedTemplate.category === '4r'
                  ? '4/6'
                  : '3/4',
            }}
          >
            {selectedTemplate.slots.map((slot, idx) => {
              const adj = slotAdjustments[slot.id] || {
                slotId: slot.id,
                photoIndex: idx % capturedPhotos.length,
                zoom: 1.0,
                panX: 0,
                panY: 0,
                filter: 'none',
              };
              const photo = capturedPhotos[adj.photoIndex] || capturedPhotos[0];
              const isSelected = slot.id === activeSlotId;
              const slotStkList = stickersBySlot[slot.id] || [];
              const filterPreset = FILTERS.find((f) => f.id === adj.filter) || FILTERS[0];

              return (
                <div
                  key={slot.id}
                  onClick={() => setActiveSlotId(slot.id)}
                  className={`absolute rounded overflow-hidden cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? 'ring-4 ring-pink-500 ring-offset-2 ring-offset-black scale-[1.03] z-20 shadow-xl'
                      : 'border border-black/20 hover:ring-2 hover:ring-pink-300 z-10'
                  }`}
                  style={{
                    left: `${slot.x}%`,
                    top: `${slot.y}%`,
                    width: `${slot.width}%`,
                    height: `${slot.height}%`,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo}
                    alt={`Slot ${idx + 1}`}
                    className="w-full h-full object-cover"
                    style={{ filter: filterPreset.cssFilter }}
                  />

                  {/* Stickers preview in mini slot */}
                  {slotStkList.map((stk) => (
                    <div
                      key={stk.id}
                      className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 select-none"
                      style={{
                        left: `${stk.x}%`,
                        top: `${stk.y}%`,
                        transform: `translate(-50%, -50%) scale(${stk.scale * 0.4}) rotate(${stk.rotation}deg)`,
                        fontSize: '24px',
                      }}
                    >
                      {stk.emoji}
                    </div>
                  ))}

                  {/* Active highlight label badge */}
                  {isSelected && (
                    <span className="absolute top-1 left-1 bg-pink-500 text-white text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow">
                      Editing #{idx + 1}
                    </span>
                  )}
                </div>
              );
            })}

            {/* Footer Event Title */}
            <div
              className="absolute bottom-2 inset-x-0 text-center font-bold text-[9px] uppercase tracking-wider"
              style={{ color: selectedTemplate.textColor || '#000000' }}
            >
              ⚡ QUICKPIC PHOTOBOOTH
            </div>
          </div>

          {/* Theme Color Presets */}
          <div className="w-full mt-4 pt-3 border-t border-zinc-800">
            <span className="text-[11px] font-bold text-zinc-400 block mb-2 uppercase tracking-wider">
              Frame Theme Style:
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {FRAME_THEMES.map((th) => (
                <button
                  key={th.id}
                  type="button"
                  onClick={() =>
                    onSelectTemplate({
                      ...selectedTemplate,
                      backgroundColor: th.backgroundColor,
                      textColor: th.textColor,
                      accentColor: th.accentColor,
                    })
                  }
                  className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1.5 whitespace-nowrap transition cursor-pointer ${
                    selectedTemplate.backgroundColor === th.backgroundColor
                      ? 'border-pink-500 bg-pink-500/20 text-pink-300'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-white/20"
                    style={{ backgroundColor: th.backgroundColor }}
                  />
                  {th.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT PANEL (~65% Width): Enlarged Workspace + Canva Bounding Box Engine */}
        {/* ========================================================================= */}
        <div className="w-full lg:w-[65%] bg-zinc-900 border border-zinc-800 rounded-3xl p-5 flex flex-col justify-between shadow-2xl space-y-4">
          
          {/* Top Toolbars: Filters & Sticker Drawer */}
          <div className="space-y-3">
            {/* Slot Switcher Navigation */}
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-300">
                  Active Photo Slot: <span className="text-pink-400 font-mono">#{activeSlotIndex + 1}</span>
                </span>
                <span className="text-[10px] text-zinc-500">
                  ({canvasStickers.length} stickers placed)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePrevSlot}
                  className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev Slot
                </button>
                <button
                  type="button"
                  onClick={handleNextSlot}
                  className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  Next Slot <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 1. Filter Chips Bar */}
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <Palette className="w-3.5 h-3.5 text-pink-400" /> Photo Color Filter
              </label>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onUpdateSlotAdjustment(activeSlotId, { filter: f.id })}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                      currentAdj.filter === f.id
                        ? 'bg-pink-500 text-white shadow-md shadow-pink-500/25 ring-1 ring-pink-400'
                        : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Sticker Library Drawer */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Smile className="w-3.5 h-3.5 text-yellow-400" /> Canva-Style Free-Transform Stickers
                </label>
                <span className="text-[10px] text-zinc-500">Tap to place • Drag corners to resize • Rotate stem to angle</span>
              </div>
              <StickerPickerDrawer onSelectSticker={handleAddStickerFromDrawer} />
            </div>
          </div>

          {/* Canva-Style Sticker Canvas Layer Workspace */}
          <div className="relative w-full flex items-center justify-center bg-zinc-950 rounded-2xl p-4 border border-zinc-800 overflow-hidden min-h-[380px]">
            <div className="relative aspect-4/3 w-full max-w-lg rounded-2xl overflow-hidden border-2 border-zinc-700 shadow-2xl">
              {/* Active Base Photo */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activePhoto}
                alt="Active Pose"
                className="w-full h-full object-cover pointer-events-none select-none"
                style={{ filter: activeFilterPreset.cssFilter }}
              />

              {/* Canva-Style Bounding Box Interactive Sticker Canvas */}
              <StickerCanvasLayer
                stickers={canvasStickers}
                onStickersChange={handleStickersChange}
                readOnly={false}
              />
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
