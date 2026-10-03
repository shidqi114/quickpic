'use client';

import React, { useState, useRef } from 'react';
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
  RotateCw,
  Trash2,
  Smile,
  Plus,
  Layers,
  Wand2,
} from 'lucide-react';

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

const STICKER_LIBRARY = [
  '🕶️', '👑', '🎉', '💖', '⭐', '✨', '🔥', '📸',
  '🎀', '🎂', '✌️', '🌸', '🦄', '🚀', '🍿', '⚡',
  '😎', '🥳', '💎', '🌟', '🥂', '🌹', '🦋', '🎈',
];

const FILTERS: { id: PhotoFilter; label: string }[] = [
  { id: 'none', label: 'Normal' },
  { id: 'bw', label: 'B&W Classic' },
  { id: 'vintage', label: '90s Vintage' },
  { id: 'warm', label: 'Warm Glow' },
  { id: 'sepia', label: 'Retro Sepia' },
  { id: 'cyberpunk', label: 'Cyberpunk' },
  { id: 'cold', label: 'Cold Breeze' },
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
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [isDraggingSticker, setIsDraggingSticker] = useState<boolean>(false);
  const photoWorkspaceRef = useRef<HTMLDivElement | null>(null);

  const activeSlot =
    selectedTemplate.slots.find((s) => s.id === activeSlotId) || selectedTemplate.slots[0];
  const currentAdj = slotAdjustments[activeSlotId] || {
    slotId: activeSlotId,
    photoIndex: 0,
    zoom: 1.0,
    panX: 0,
    panY: 0,
    filter: 'none',
  };

  const activePhoto = capturedPhotos[currentAdj.photoIndex] || capturedPhotos[0];
  const currentSlotStickers = stickersBySlot[activeSlotId] || [];
  const selectedSticker = currentSlotStickers.find((s) => s.id === selectedStickerId);

  // Sticker actions
  const handleAddSticker = (emoji: string) => {
    const newSticker: PlacedSticker = {
      id: `stk_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      emoji,
      x: 50, // Center
      y: 50,
      scale: 1.2,
      rotation: 0,
    };
    const nextList = [...currentSlotStickers, newSticker];
    onUpdateSlotStickers(activeSlotId, nextList);
    setSelectedStickerId(newSticker.id);
  };

  const handleUpdateSelectedSticker = (changes: Partial<PlacedSticker>) => {
    if (!selectedStickerId) return;
    const nextList = currentSlotStickers.map((s) =>
      s.id === selectedStickerId ? { ...s, ...changes } : s
    );
    onUpdateSlotStickers(activeSlotId, nextList);
  };

  const handleDeleteSelectedSticker = () => {
    if (!selectedStickerId) return;
    const nextList = currentSlotStickers.filter((s) => s.id !== selectedStickerId);
    onUpdateSlotStickers(activeSlotId, nextList);
    setSelectedStickerId(null);
  };

  // Sticker dragging over the enlarged canvas
  const handleWorkspacePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingSticker || !selectedStickerId || !photoWorkspaceRef.current) return;
    const rect = photoWorkspaceRef.current.getBoundingClientRect();
    const xPct = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(5, Math.min(95, ((e.clientY - rect.top) / rect.height) * 100));
    handleUpdateSelectedSticker({ x: xPct, y: yPct });
  };

  const getFilterStyle = (filter: PhotoFilter): React.CSSProperties => {
    switch (filter) {
      case 'bw':
        return { filter: 'grayscale(100%) contrast(120%)' };
      case 'vintage':
        return { filter: 'sepia(50%) contrast(90%) brightness(105%)' };
      case 'warm':
        return { filter: 'sepia(30%) saturate(140%)' };
      case 'sepia':
        return { filter: 'sepia(85%)' };
      case 'cyberpunk':
        return { filter: 'contrast(130%) saturate(160%) hue-rotate(15deg)' };
      case 'cold':
        return { filter: 'saturate(90%) hue-rotate(190deg) brightness(105%)' };
      default:
        return {};
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col p-3 md:p-6 text-zinc-100 select-none animate-fade-in">
      {/* Top Banner */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-300 text-[11px] font-bold uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5" /> Step 2 of 2: Uneven Split-Screen Editor
          </div>
          <h2 className="text-xl md:text-2xl font-black text-white">
            Custom Filters & Free-Transform Stickers
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onBackToStep1}
            className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Slots
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 via-rose-500 to-yellow-400 hover:brightness-110 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-pink-500/25 active:scale-95 transition flex items-center gap-1.5"
          >
            <Check className="w-4 h-4 stroke-[3]" /> Finish & Print
          </button>
        </div>
      </div>

      {/* 35% / 65% Uneven Split-Screen Layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-stretch">
        
        {/* ========================================================================= */}
        {/* LEFT PANEL (~35% Width): Strip Overview & Active Slot Highlight */}
        {/* ========================================================================= */}
        <div className="w-full lg:w-[35%] bg-zinc-900/90 border border-zinc-800 rounded-3xl p-5 flex flex-col items-center justify-between shadow-2xl">
          <div className="w-full flex flex-col items-center">
            <div className="flex items-center justify-between w-full mb-3 px-1">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Full Strip Preview
              </span>
              <span className="text-[10px] text-pink-400 font-semibold">
                Tap slot to edit
              </span>
            </div>

            {/* Master Strip Container */}
            <div
              className="relative shadow-2xl rounded-2xl overflow-hidden border-4 transition-all duration-300"
              style={{
                backgroundColor: selectedTemplate.backgroundColor,
                borderColor: selectedTemplate.accentColor,
                width: selectedTemplate.category === 'strip' ? '210px' : '260px',
                aspectRatio: selectedTemplate.category === 'strip' ? '1/3' : '2/3',
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
                const isActive = activeSlotId === slot.id;
                const stickers = stickersBySlot[slot.id] || [];

                return (
                  <div
                    key={slot.id}
                    onClick={() => {
                      setActiveSlotId(slot.id);
                      setSelectedStickerId(null);
                    }}
                    className={`absolute cursor-pointer overflow-hidden rounded-lg transition-all ${
                      isActive
                        ? 'ring-4 ring-pink-500 z-30 scale-[1.04] shadow-2xl shadow-pink-500/40'
                        : 'ring-1 ring-zinc-400/30 z-10 hover:ring-zinc-200'
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
                      style={getFilterStyle(adj.filter)}
                    />

                    {/* Mini stickers rendering on strip */}
                    {stickers.map((stk) => (
                      <div
                        key={stk.id}
                        className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                        style={{
                          left: `${stk.x}%`,
                          top: `${stk.y}%`,
                          transform: `translate(-50%, -50%) scale(${stk.scale * 0.6}) rotate(${stk.rotation}deg)`,
                          fontSize: '18px',
                        }}
                      >
                        {stk.emoji}
                      </div>
                    ))}

                    {/* Active highlight tag */}
                    {isActive && (
                      <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-pink-500 text-[8px] font-black text-white uppercase tracking-wider shadow">
                        Editing
                      </div>
                    )}
                  </div>
                );
              })}

              <div
                className="absolute bottom-2 inset-x-0 text-center font-bold text-[8px] tracking-wider uppercase opacity-80"
                style={{ color: selectedTemplate.textColor }}
              >
                ⚡ QUICKPIC PHOTOBOOTH
              </div>
            </div>
          </div>

          {/* Theme Switcher Quick Bar */}
          <div className="w-full mt-4 pt-3 border-t border-zinc-800 space-y-2">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
              Frame Theme
            </span>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {FRAME_THEMES.map((th) => (
                <button
                  key={th.id}
                  onClick={() =>
                    onSelectTemplate({
                      ...selectedTemplate,
                      backgroundColor: th.backgroundColor,
                      textColor: th.textColor,
                      accentColor: th.accentColor,
                    })
                  }
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-bold whitespace-nowrap transition flex items-center gap-1.5 border ${
                    selectedTemplate.backgroundColor === th.backgroundColor
                      ? 'border-pink-500 bg-pink-500/20 text-pink-300'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full border border-white/20"
                    style={{ backgroundColor: th.backgroundColor }}
                  />
                  {th.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT PANEL (~65% Width): Enlarged Active Slot Workspace + Sticker Engine */}
        {/* ========================================================================= */}
        <div className="w-full lg:w-[65%] bg-zinc-900 border border-zinc-800 rounded-3xl p-5 flex flex-col justify-between shadow-2xl space-y-4">
          
          {/* Top Toolbars: Filters & Sticker Drawer */}
          <div className="space-y-4">
            
            {/* 1. Filter Chips Bar */}
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Palette className="w-3.5 h-3.5 text-pink-400" /> Photo Color Filter
              </label>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => onUpdateSlotAdjustment(activeSlotId, { filter: f.id })}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
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
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Smile className="w-3.5 h-3.5 text-yellow-400" /> Free-Transform Sticker Library
                </label>
                <span className="text-[10px] text-zinc-500">Tap to place on photo</span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-2 p-2 bg-zinc-950/70 border border-zinc-800 rounded-2xl">
                {STICKER_LIBRARY.map((emoji, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAddSticker(emoji)}
                    className="w-10 h-10 rounded-xl bg-zinc-900 hover:bg-pink-500/20 border border-zinc-800 hover:border-pink-400 flex items-center justify-center text-xl active:scale-90 transition shrink-0"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Large Interactive Photo Canvas with Free-Transform Sticker Layer */}
          <div className="relative w-full flex items-center justify-center bg-zinc-950 rounded-2xl p-4 border border-zinc-800 overflow-hidden min-h-[360px]">
            <div
              ref={photoWorkspaceRef}
              onPointerMove={handleWorkspacePointerMove}
              onPointerUp={() => setIsDraggingSticker(false)}
              className="relative aspect-4/3 w-full max-w-lg rounded-2xl overflow-hidden border-2 border-zinc-700 shadow-2xl touch-none select-none cursor-crosshair"
            >
              {/* Active Base Photo */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activePhoto}
                alt="Active Pose"
                className="w-full h-full object-cover pointer-events-none"
                style={getFilterStyle(currentAdj.filter)}
              />

              {/* Free-Transform Stickers Layer */}
              {currentSlotStickers.map((stk) => {
                const isSelected = selectedStickerId === stk.id;

                return (
                  <div
                    key={stk.id}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setSelectedStickerId(stk.id);
                      setIsDraggingSticker(true);
                    }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing transition-shadow ${
                      isSelected
                        ? 'ring-2 ring-pink-500 ring-offset-2 ring-offset-black rounded-lg z-30'
                        : 'hover:scale-110 z-20'
                    }`}
                    style={{
                      left: `${stk.x}%`,
                      top: `${stk.y}%`,
                      transform: `translate(-50%, -50%) scale(${stk.scale}) rotate(${stk.rotation}deg)`,
                      fontSize: '38px',
                    }}
                  >
                    {stk.emoji}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Sticker Controls Bar (Scale, 360 Rotation & Delete) */}
          {selectedSticker ? (
            <div className="p-3 bg-zinc-950/80 border border-pink-500/30 rounded-2xl flex flex-wrap items-center justify-between gap-4 animate-fade-in text-xs">
              <div className="flex items-center gap-2">
                <span className="text-lg">{selectedSticker.emoji}</span>
                <span className="font-bold text-white">Sticker Controls:</span>
              </div>

              {/* Scale Slider */}
              <div className="flex items-center gap-2">
                <span className="text-zinc-400">Size:</span>
                <input
                  type="range"
                  min="0.6"
                  max="2.5"
                  step="0.1"
                  value={selectedSticker.scale}
                  onChange={(e) =>
                    handleUpdateSelectedSticker({ scale: parseFloat(e.target.value) })
                  }
                  className="w-24 accent-pink-500 cursor-pointer"
                />
              </div>

              {/* 360-Degree Rotation Handle Slider */}
              <div className="flex items-center gap-2">
                <RotateCw className="w-3.5 h-3.5 text-pink-400" />
                <span className="text-zinc-400">Rotate:</span>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="5"
                  value={selectedSticker.rotation}
                  onChange={(e) =>
                    handleUpdateSelectedSticker({ rotation: parseInt(e.target.value) })
                  }
                  className="w-24 accent-pink-500 cursor-pointer"
                />
                <span className="font-mono text-[10px] text-pink-400 w-8">
                  {selectedSticker.rotation}°
                </span>
              </div>

              {/* Delete Button */}
              <button
                onClick={handleDeleteSelectedSticker}
                className="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 hover:bg-rose-500 hover:text-white border border-rose-500/30 font-semibold flex items-center gap-1 transition"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove
              </button>
            </div>
          ) : (
            <div className="text-center py-2 text-xs text-zinc-500">
              💡 Tap any placed sticker to scale, rotate 360°, or drag it anywhere on the image.
            </div>
          )}

          {/* Bottom Confirmation Bar */}
          <div className="pt-2 flex items-center justify-between">
            <button
              onClick={onBackToStep1}
              className="px-5 py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs uppercase tracking-wider transition flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Slots
            </button>

            <button
              onClick={onConfirm}
              className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-yellow-400 hover:brightness-110 text-white font-extrabold text-sm uppercase tracking-wider shadow-xl shadow-pink-500/25 active:scale-95 transition flex items-center gap-2"
            >
              <Check className="w-5 h-5 stroke-[3]" /> Finish & Print Strip
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
