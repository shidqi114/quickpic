'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Camera,
  Sliders,
  Volume2,
  VolumeX,
  Zap,
  FlipHorizontal,
  LayoutGrid,
  RefreshCw,
  Move,
  Clock,
} from 'lucide-react';
import { FrameSlot, FrameCategory } from '@/types/photobooth';

export interface PaperPreset {
  id: FrameCategory;
  name: string;
  subtext: string;
  aspectRatio: number; // width / height
  cssAspect: string;
  defaultSlots: FrameSlot[];
}

export const PAPER_PRESETS: PaperPreset[] = [
  {
    id: 'strip',
    name: '2x6" Twin Strips',
    subtext: 'Classic 3 or 4 Cut Strip for DNP Perforated Paper',
    aspectRatio: 1 / 3,
    cssAspect: '1/3',
    defaultSlots: [
      { id: 'slot-1', x: 10, y: 10, width: 80, height: 25, aspectRatio: 4 / 3 },
      { id: 'slot-2', x: 10, y: 38, width: 80, height: 25, aspectRatio: 4 / 3 },
      { id: 'slot-3', x: 10, y: 66, width: 80, height: 25, aspectRatio: 4 / 3 },
    ],
  },
  {
    id: '4r',
    name: '4x6" Polaroid / 4R',
    subtext: 'Standard Postcard Landscape or 2x2 Grid',
    aspectRatio: 4 / 6,
    cssAspect: '4/6',
    defaultSlots: [
      { id: 'slot-1', x: 8, y: 8, width: 40, height: 40, aspectRatio: 1 },
      { id: 'slot-2', x: 52, y: 8, width: 40, height: 40, aspectRatio: 1 },
      { id: 'slot-3', x: 8, y: 52, width: 40, height: 40, aspectRatio: 1 },
      { id: 'slot-4', x: 52, y: 52, width: 40, height: 40, aspectRatio: 1 },
    ],
  },
  {
    id: 'a4',
    name: 'A4 Poster Collage',
    subtext: 'High-Density 6-Cut Event Poster',
    aspectRatio: 1 / 1.414,
    cssAspect: '1/1.414',
    defaultSlots: [
      { id: 'slot-1', x: 8, y: 6, width: 40, height: 26, aspectRatio: 4 / 3 },
      { id: 'slot-2', x: 52, y: 6, width: 40, height: 26, aspectRatio: 4 / 3 },
      { id: 'slot-3', x: 8, y: 36, width: 40, height: 26, aspectRatio: 4 / 3 },
      { id: 'slot-4', x: 52, y: 36, width: 40, height: 26, aspectRatio: 4 / 3 },
      { id: 'slot-5', x: 8, y: 66, width: 40, height: 26, aspectRatio: 4 / 3 },
      { id: 'slot-6', x: 52, y: 66, width: 40, height: 26, aspectRatio: 4 / 3 },
    ],
  },
];

export interface CaptureSettings {
  countdownSeconds: number; // 3, 5, 10
  delayBetweenShots: number; // 1, 2, 3, 5
  reviewDurationSeconds: number; // 0, 3, 5, 8
  audioCues: boolean;
  screenFlash: boolean;
  mirrorCamera: boolean;
}

export interface PrintLayoutCanvasEditorProps {
  /** Initial or controlled slots */
  initialSlots?: FrameSlot[];
  /** Callback when slots configuration changes */
  onSlotsChange?: (slots: FrameSlot[]) => void;
  /** Current paper category */
  paperCategory?: FrameCategory;
  /** Callback when paper category changes */
  onPaperCategoryChange?: (category: FrameCategory) => void;
  /** Initial capture settings */
  captureSettings?: CaptureSettings;
  /** Callback when capture settings change */
  onCaptureSettingsChange?: (settings: CaptureSettings) => void;
  /** Background color of the print template */
  backgroundColor?: string;
  /** Callback when background color changes */
  onBackgroundColorChange?: (color: string) => void;
  /** Optional custom class */
  className?: string;
}

interface ActiveGuideline {
  type: 'h' | 'v'; // horizontal or vertical
  positionPct: number; // 0 to 100%
  label?: string;
}

export const PrintLayoutCanvasEditor: React.FC<PrintLayoutCanvasEditorProps> = ({
  initialSlots,
  onSlotsChange,
  paperCategory = 'strip',
  onPaperCategoryChange,
  captureSettings: externalSettings,
  onCaptureSettingsChange,
  backgroundColor = '#18181b',
  onBackgroundColorChange,
  className = '',
}) => {
  const currentPreset = PAPER_PRESETS.find((p) => p.id === paperCategory) || PAPER_PRESETS[0];

  // Internal slots state
  const [slots, setSlots] = useState<FrameSlot[]>(
    initialSlots && initialSlots.length > 0 ? initialSlots : currentPreset.defaultSlots
  );
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(slots[0]?.id || null);
  const [currentBgColor, setCurrentBgColor] = useState<string>(backgroundColor);

  const handleBgColorSelect = (color: string) => {
    setCurrentBgColor(color);
    if (onBackgroundColorChange) onBackgroundColorChange(color);
  };

  // Capture settings state
  const [settings, setSettings] = useState<CaptureSettings>(
    externalSettings || {
      countdownSeconds: 5,
      delayBetweenShots: 2,
      reviewDurationSeconds: 3,
      audioCues: true,
      screenFlash: true,
      mirrorCamera: true,
    }
  );

  // Guidelines state during dragging
  const [activeGuides, setActiveGuides] = useState<ActiveGuideline[]>([]);

  // Canvas Reference
  const canvasRef = useRef<HTMLDivElement | null>(null);

  // Dragging state ref
  const dragRef = useRef<{
    isDragging: boolean;
    slotId: string;
    startX: number;
    startY: number;
    initialSlotX: number;
    initialSlotY: number;
  } | null>(null);

  const updateSlots = useCallback(
    (newSlots: FrameSlot[]) => {
      setSlots(newSlots);
      if (onSlotsChange) onSlotsChange(newSlots);
    },
    [onSlotsChange]
  );

  const updateSettings = (partial: Partial<CaptureSettings>) => {
    const updated = { ...settings, ...partial };
    setSettings(updated);
    if (onCaptureSettingsChange) onCaptureSettingsChange(updated);
  };

  // Change Paper Preset
  const handleSelectPaper = (preset: PaperPreset) => {
    if (onPaperCategoryChange) onPaperCategoryChange(preset.id);
    updateSlots(preset.defaultSlots);
    setSelectedSlotId(preset.defaultSlots[0]?.id || null);
  };

  // Add new picture slot
  const handleAddSlot = () => {
    const newId = `slot-${Date.now().toString().slice(-4)}`;
    const newSlot: FrameSlot = {
      id: newId,
      x: 20 + (Math.random() * 10),
      y: 20 + (Math.random() * 10),
      width: paperCategory === 'strip' ? 80 : 40,
      height: paperCategory === 'strip' ? 25 : 30,
      aspectRatio: 4 / 3,
    };
    updateSlots([...slots, newSlot]);
    setSelectedSlotId(newId);
  };

  // Delete picture slot
  const handleDeleteSlot = (slotId: string) => {
    if (slots.length <= 1) return; // Keep at least 1 slot
    const filtered = slots.filter((s) => s.id !== slotId);
    updateSlots(filtered);
    if (selectedSlotId === slotId) {
      setSelectedSlotId(filtered[0]?.id || null);
    }
  };

  // Reset to default layout
  const handleResetLayout = () => {
    updateSlots(currentPreset.defaultSlots);
    setSelectedSlotId(currentPreset.defaultSlots[0]?.id || null);
  };

  // Drag pointer down
  const handleSlotPointerDown = (e: React.PointerEvent, slot: FrameSlot) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedSlotId(slot.id);

    dragRef.current = {
      isDragging: true,
      slotId: slot.id,
      startX: e.clientX,
      startY: e.clientY,
      initialSlotX: slot.x,
      initialSlotY: slot.y,
    };
  };

  // Pointer Move with Snapping Engine
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!dragRef.current?.isDragging || !canvasRef.current) return;

      const { slotId, startX, startY, initialSlotX, initialSlotY } = dragRef.current;
      const rect = canvasRef.current.getBoundingClientRect();
      const deltaXPct = ((e.clientX - startX) / rect.width) * 100;
      const deltaYPct = ((e.clientY - startY) / rect.height) * 100;

      const currentSlot = slots.find((s) => s.id === slotId);
      if (!currentSlot) return;

      let targetX = initialSlotX + deltaXPct;
      let targetY = initialSlotY + deltaYPct;

      const width = currentSlot.width;
      const height = currentSlot.height;
      const otherSlots = slots.filter((s) => s.id !== slotId);

      // Snap Threshold in Percent (converted from ~10px)
      const snapThresholdX = (10 / rect.width) * 100;
      const snapThresholdY = (10 / rect.height) * 100;

      const newGuides: ActiveGuideline[] = [];

      // 1. Horizontal Center Snapping (X Center = 50%)
      const slotCenterX = targetX + width / 2;
      if (Math.abs(slotCenterX - 50) < snapThresholdX) {
        targetX = 50 - width / 2;
        newGuides.push({ type: 'v', positionPct: 50, label: 'Center 50%' });
      }

      // 2. Vertical Center Snapping (Y Center = 50%)
      const slotCenterY = targetY + height / 2;
      if (Math.abs(slotCenterY - 50) < snapThresholdY) {
        targetY = 50 - height / 2;
        newGuides.push({ type: 'h', positionPct: 50, label: 'Center 50%' });
      }

      // 3. Canvas Margins Snapping (Left 10%, Right 90%, Top 10%, Bottom 90%)
      if (Math.abs(targetX - 10) < snapThresholdX) {
        targetX = 10;
        newGuides.push({ type: 'v', positionPct: 10, label: 'Left Margin' });
      }
      if (Math.abs(targetX + width - 90) < snapThresholdX) {
        targetX = 90 - width;
        newGuides.push({ type: 'v', positionPct: 90, label: 'Right Margin' });
      }

      // 4. Snapping to adjacent slots (Left, Right, Top, Bottom)
      otherSlots.forEach((other) => {
        // Snap Left to other.Left
        if (Math.abs(targetX - other.x) < snapThresholdX) {
          targetX = other.x;
          newGuides.push({ type: 'v', positionPct: other.x, label: 'Align Left' });
        }
        // Snap Right to other.Right
        if (Math.abs(targetX + width - (other.x + other.width)) < snapThresholdX) {
          targetX = other.x + other.width - width;
          newGuides.push({ type: 'v', positionPct: other.x + other.width, label: 'Align Right' });
        }
        // Snap Top to other.Top
        if (Math.abs(targetY - other.y) < snapThresholdY) {
          targetY = other.y;
          newGuides.push({ type: 'h', positionPct: other.y, label: 'Align Top' });
        }
        // Snap Bottom to other.Bottom
        if (Math.abs(targetY + height - (other.y + other.height)) < snapThresholdY) {
          targetY = other.y + other.height - height;
          newGuides.push({ type: 'h', positionPct: other.y + other.height, label: 'Align Bottom' });
        }
        // Snap Top to other.Bottom + 4% gap
        if (Math.abs(targetY - (other.y + other.height + 4)) < snapThresholdY) {
          targetY = other.y + other.height + 4;
          newGuides.push({ type: 'h', positionPct: other.y + other.height, label: 'Adjacent Stack' });
        }
      });

      // Clamp target within canvas boundaries
      const clampedX = Math.max(0, Math.min(100 - width, targetX));
      const clampedY = Math.max(0, Math.min(100 - height, targetY));

      setActiveGuides(newGuides);

      const nextSlots = slots.map((s) =>
        s.id === slotId ? { ...s, x: Number(clampedX.toFixed(1)), y: Number(clampedY.toFixed(1)) } : s
      );
      updateSlots(nextSlots);
    };

    const handlePointerUp = () => {
      dragRef.current = null;
      setActiveGuides([]);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [slots, updateSlots]);

  const selectedSlot = slots.find((s) => s.id === selectedSlotId);

  return (
    <div className={`w-full max-w-7xl mx-auto flex flex-col gap-6 p-4 md:p-6 bg-zinc-950 text-white select-none ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-zinc-900/90 border border-zinc-800 rounded-3xl p-5 shadow-xl backdrop-blur-md">
        <div>
          <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-pink-500" />
            Print Layout & Snapping Canvas Editor
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Configure paper geometry, arrange interactive picture slots with real-time alignment snapping, and tune shutter capture settings.
          </p>
        </div>

        {/* Paper Size Selector Pills */}
        <div className="flex items-center gap-2 bg-zinc-950 p-1.5 rounded-2xl border border-zinc-800">
          {PAPER_PRESETS.map((preset) => {
            const isSelected = preset.id === paperCategory;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPaper(preset)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  isSelected
                    ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/30'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                }`}
              >
                <span>{preset.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ========================================================= */}
        {/* Left Column: Interactive Canvas with Draggable Slots      */}
        {/* ========================================================= */}
        <div className="lg:col-span-7 flex flex-col items-center bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 shadow-2xl backdrop-blur-md">
          <div className="w-full flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                {currentPreset.name} Canvas ({slots.length} Slots)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddSlot}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/50 text-pink-300 rounded-xl text-xs font-bold transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Slot
              </button>
              <button
                type="button"
                onClick={handleResetLayout}
                className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-xl text-xs font-semibold transition"
                title="Reset layout to default"
              >
                <RefreshCw className="w-3 h-3" />
                Reset
              </button>
            </div>
          </div>

          {/* Interactive Print Canvas Container */}
          <div
            ref={canvasRef}
            style={{
              backgroundColor: currentBgColor,
              aspectRatio: currentPreset.cssAspect,
            }}
            className="relative w-full max-w-[340px] sm:max-w-[380px] rounded-2xl p-4 shadow-2xl border-2 border-zinc-700 overflow-hidden relative select-none touch-none transition-all"
          >
            {/* Real-Time Snapping Alignment Guidelines */}
            {activeGuides.map((guide, idx) => {
              if (guide.type === 'v') {
                return (
                  <div
                    key={`guide-v-${idx}`}
                    style={{ left: `${guide.positionPct}%` }}
                    className="absolute top-0 bottom-0 w-0 border-r-2 border-dashed border-pink-400 animate-pulse z-40 pointer-events-none shadow-sm shadow-pink-500"
                  >
                    <span className="absolute top-2 left-1 bg-pink-500 text-white text-[9px] font-mono px-1 rounded shadow">
                      {guide.label}
                    </span>
                  </div>
                );
              }
              return (
                <div
                  key={`guide-h-${idx}`}
                  style={{ top: `${guide.positionPct}%` }}
                  className="absolute left-0 right-0 h-0 border-b-2 border-dashed border-pink-400 animate-pulse z-40 pointer-events-none shadow-sm shadow-pink-500"
                >
                  <span className="absolute left-2 -top-4 bg-pink-500 text-white text-[9px] font-mono px-1 rounded shadow">
                    {guide.label}
                  </span>
                </div>
              );
            })}

            {/* Draggable Picture Slots */}
            {slots.map((slot, index) => {
              const isSelected = selectedSlotId === slot.id;
              return (
                <div
                  key={slot.id}
                  onPointerDown={(e) => handleSlotPointerDown(e, slot)}
                  style={{
                    left: `${slot.x}%`,
                    top: `${slot.y}%`,
                    width: `${slot.width}%`,
                    height: `${slot.height}%`,
                  }}
                  className={`absolute rounded-xl border-2 cursor-grab active:cursor-grabbing transition-shadow flex flex-col items-center justify-center select-none ${
                    isSelected
                      ? 'border-pink-500 bg-pink-500/20 ring-4 ring-pink-500/40 shadow-xl shadow-pink-500/30 z-30'
                      : 'border-zinc-500/60 bg-zinc-800/80 hover:border-pink-400/80 hover:bg-zinc-800 z-10'
                  }`}
                >
                  <div className="flex flex-col items-center justify-center p-2 text-center pointer-events-none">
                    <Camera className={`w-5 h-5 mb-1 ${isSelected ? 'text-pink-400' : 'text-zinc-400'}`} />
                    <span className="text-xs font-black uppercase text-white font-mono">
                      Slot #{index + 1}
                    </span>
                    <span className="text-[9px] text-zinc-400 font-mono">
                      {slot.width}% × {slot.height}%
                    </span>
                  </div>

                  {/* Slot Delete Button */}
                  {isSelected && slots.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSlot(slot.id);
                      }}
                      className="absolute -top-2.5 -right-2.5 w-6 h-6 bg-rose-600 hover:bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg transition pointer-events-auto"
                      title="Delete Slot"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Canvas Branding Watermark */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-center pointer-events-none">
              <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest font-bold">
                ★ QUICKPIC PRINT ENGINE ★
              </span>
            </div>
          </div>

          <div className="w-full mt-4 flex items-center justify-between text-xs text-zinc-400 px-2">
            <span className="flex items-center gap-1.5">
              <Move className="w-3.5 h-3.5 text-pink-400" />
              Touch or drag slots to reposition. Real-time guidelines will snap to center & edges.
            </span>
          </div>
        </div>

        {/* ========================================================= */}
        {/* Right Column: Slot Fine-Tuning & Capture Settings Panel    */}
        {/* ========================================================= */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          
          {/* Active Slot Dimensions Editor */}
          {selectedSlot && (
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-5 shadow-xl backdrop-blur-md flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-pink-500" />
                  Selected Slot Dimensions ({selectedSlot.id})
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Width slider */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400">Width</span>
                    <span className="font-mono text-pink-400 font-bold">{selectedSlot.width}%</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="95"
                    value={selectedSlot.width}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      updateSlots(
                        slots.map((s) => (s.id === selectedSlot.id ? { ...s, width: val } : s))
                      );
                    }}
                    className="w-full accent-pink-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Height slider */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400">Height</span>
                    <span className="font-mono text-pink-400 font-bold">{selectedSlot.height}%</span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="90"
                    value={selectedSlot.height}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      updateSlots(
                        slots.map((s) => (s.id === selectedSlot.id ? { ...s, height: val } : s))
                      );
                    }}
                    className="w-full accent-pink-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
              {/* Canvas Background Color Swatches */}
              <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800">
                <span className="text-xs font-semibold text-zinc-400">Canvas Base Color</span>
                <div className="flex items-center gap-2">
                  {[
                    { color: '#18181b', label: 'Dark Zinc' },
                    { color: '#ffffff', label: 'Pure White' },
                    { color: '#fce7f3', label: 'Pastel Pink' },
                    { color: '#0f172a', label: 'Midnight Blue' },
                    { color: '#fef08a', label: 'Pastel Gold' },
                  ].map((item) => (
                    <button
                      key={item.color}
                      type="button"
                      onClick={() => handleBgColorSelect(item.color)}
                      style={{ backgroundColor: item.color }}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        currentBgColor === item.color
                          ? 'border-pink-500 ring-2 ring-pink-500/50 scale-110 shadow-md'
                          : 'border-zinc-600 opacity-80 hover:opacity-100'
                      }`}
                      title={item.label}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Capture Settings Panel */}
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-5 shadow-xl backdrop-blur-md flex flex-col gap-5">
            <div className="border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" />
                Kiosk Capture & Shutter Sequence Settings
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Set countdown timers, shot intervals, and post-capture guest preview time.
              </p>
            </div>

            {/* 1. Countdown Timer Seconds */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-zinc-300">
                Countdown Timer Duration (Per Shot)
              </span>
              <div className="grid grid-cols-3 gap-2">
                {[3, 5, 10].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => updateSettings({ countdownSeconds: sec })}
                    className={`py-2 rounded-xl text-xs font-black transition-all ${
                      settings.countdownSeconds === sec
                        ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md shadow-pink-500/30'
                        : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {sec} Seconds
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Delay Between Shots */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-zinc-300">
                Delay Between Shots
              </span>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 5].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => updateSettings({ delayBetweenShots: sec })}
                    className={`py-2 rounded-xl text-xs font-bold transition-all ${
                      settings.delayBetweenShots === sec
                        ? 'bg-pink-500 text-white shadow-md shadow-pink-500/25'
                        : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {sec}s Delay
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Photo Review Duration */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-zinc-300">
                Photo Review Duration (Preview Before Next)
              </span>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { sec: 0, label: 'Instant (0s)' },
                  { sec: 3, label: '3 Seconds' },
                  { sec: 5, label: '5 Seconds' },
                  { sec: 8, label: '8 Seconds' },
                ].map((item) => (
                  <button
                    key={item.sec}
                    type="button"
                    onClick={() => updateSettings({ reviewDurationSeconds: item.sec })}
                    className={`py-2 rounded-xl text-xs font-bold transition-all ${
                      settings.reviewDurationSeconds === item.sec
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25'
                        : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles: Audio Cues, Flash, Mirror */}
            <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800/80">
              {/* Audio Cues */}
              <label className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800 cursor-pointer hover:bg-zinc-900 transition">
                <div className="flex items-center gap-2.5">
                  {settings.audioCues ? (
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-zinc-500" />
                  )}
                  <span className="text-xs font-semibold text-zinc-200">
                    Audible Countdown Beeps & Shutter Click
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.audioCues}
                  onChange={(e) => updateSettings({ audioCues: e.target.checked })}
                  className="w-4 h-4 accent-pink-500 rounded cursor-pointer"
                />
              </label>

              {/* Screen Flash */}
              <label className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800 cursor-pointer hover:bg-zinc-900 transition">
                <div className="flex items-center gap-2.5">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span className="text-xs font-semibold text-zinc-200">
                    White Screen Flash On Shutter Release
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.screenFlash}
                  onChange={(e) => updateSettings({ screenFlash: e.target.checked })}
                  className="w-4 h-4 accent-pink-500 rounded cursor-pointer"
                />
              </label>

              {/* Mirror Camera Viewfinder */}
              <label className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800 cursor-pointer hover:bg-zinc-900 transition">
                <div className="flex items-center gap-2.5">
                  <FlipHorizontal className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-semibold text-zinc-200">
                    Mirror Camera Viewfinder (Selfie Mode)
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.mirrorCamera}
                  onChange={(e) => updateSettings({ mirrorCamera: e.target.checked })}
                  className="w-4 h-4 accent-pink-500 rounded cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
