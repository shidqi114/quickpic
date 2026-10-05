'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  RotateCw,
  Trash2,
  Copy,
  Sparkles,
  Smile,
  Stamp,
  Glasses,
  PartyPopper,
  Award,
  Maximize2,
  X,
} from 'lucide-react';

export interface StickerItem {
  id: string;
  type: 'emoji' | 'stamp' | 'prop' | 'badge' | 'custom';
  content: string; // Emoji character, text label, or SVG icon identifier
  x: number;       // Percentage X position (0 - 100%)
  y: number;       // Percentage Y position (0 - 100%)
  scale: number;   // Scale factor (0.5 to 3.0)
  rotation: number;// Rotation in degrees (0 - 360)
  zIndex: number;
}

export interface StickerLibraryItem {
  id: string;
  category: 'emoji' | 'stamp' | 'sunglasses' | 'party' | 'sparkles' | 'vip';
  label: string;
  content: string;
  type: 'emoji' | 'stamp' | 'badge';
  badgeColor?: string;
  textColor?: string;
}

export const STICKER_CATALOG: StickerLibraryItem[] = [
  // Emojis
  { id: 'e-fire', category: 'emoji', label: 'Fire', content: '🔥', type: 'emoji' },
  { id: 'e-cool', category: 'emoji', label: 'Cool Shades', content: '😎', type: 'emoji' },
  { id: 'e-sparkle', category: 'emoji', label: 'Sparkles', content: '✨', type: 'emoji' },
  { id: 'e-heart-eyes', category: 'emoji', label: 'Love Eyes', content: '😍', type: 'emoji' },
  { id: 'e-party', category: 'emoji', label: 'Party Popper', content: '🥳', type: 'emoji' },
  { id: 'e-crown', category: 'emoji', label: 'Crown', content: '👑', type: 'emoji' },
  { id: 'e-camera', category: 'emoji', label: 'Camera', content: '📸', type: 'emoji' },
  { id: 'e-kiss', category: 'emoji', label: 'Kiss', content: '💋', type: 'emoji' },
  { id: 'e-unicorn', category: 'emoji', label: 'Unicorn', content: '🦄', type: 'emoji' },
  { id: 'e-star', category: 'emoji', label: 'Glowing Star', content: '🌟', type: 'emoji' },
  { id: 'e-cheers', category: 'emoji', label: 'Cheers', content: '🥂', type: 'emoji' },
  { id: 'e-peace', category: 'emoji', label: 'Peace', content: '✌️', type: 'emoji' },

  // Retro Stamps
  { id: 's-vip', category: 'stamp', label: 'VIP ACCESS', content: '★ VIP ACCESS ★', type: 'stamp', badgeColor: 'bg-amber-500/20 border-amber-400 text-amber-300' },
  { id: 's-limited', category: 'stamp', label: 'LIMITED EDITION', content: 'LIMITED EDITION 001', type: 'stamp', badgeColor: 'bg-rose-500/20 border-rose-400 text-rose-300' },
  { id: 's-party-animal', category: 'stamp', label: 'PARTY ANIMAL', content: '⚡ PARTY ANIMAL ⚡', type: 'stamp', badgeColor: 'bg-purple-500/20 border-purple-400 text-purple-300' },
  { id: 's-good-vibes', category: 'stamp', label: 'GOOD VIBES', content: '✿ GOOD VIBES ONLY ✿', type: 'stamp', badgeColor: 'bg-emerald-500/20 border-emerald-400 text-emerald-300' },
  { id: 's-90s', category: 'stamp', label: '90s DISCO', content: '📼 90s RETRO FEVER 📼', type: 'stamp', badgeColor: 'bg-cyan-500/20 border-cyan-400 text-cyan-300' },
  { id: 's-official', category: 'stamp', label: 'VERIFIED GUEST', content: '✔ VERIFIED GUEST ✔', type: 'stamp', badgeColor: 'bg-blue-500/20 border-blue-400 text-blue-300' },

  // Sunglasses & Headwear Props
  { id: 'p-glasses-retro', category: 'sunglasses', label: 'Retro Shades', content: '🕶️', type: 'emoji' },
  { id: 'p-glasses-goggles', category: 'sunglasses', label: 'Cyber Visor', content: '🥽', type: 'emoji' },
  { id: 'p-glasses-nerd', category: 'sunglasses', label: 'Round Specs', content: '👓', type: 'emoji' },
  { id: 'p-glasses-heart', category: 'sunglasses', label: 'Heart Eyes', content: '💖', type: 'emoji' },

  // Party Hats & Props
  { id: 'p-party-hat', category: 'party', label: 'Party Cone', content: '🎉', type: 'emoji' },
  { id: 'p-balloon', category: 'party', label: 'Balloon', content: '🎈', type: 'emoji' },
  { id: 'p-disco', category: 'party', label: 'Disco Ball', content: '🪩', type: 'emoji' },
  { id: 'p-ribbon', category: 'party', label: 'Pink Ribbon', content: '🎀', type: 'emoji' },
  { id: 'p-top-hat', category: 'party', label: 'Gentleman Hat', content: '🎩', type: 'emoji' },

  // Sparkles & Hearts
  { id: 'h-neon-heart', category: 'sparkles', label: 'Neon Heart', content: '💖', type: 'emoji' },
  { id: 'h-heart-fire', category: 'sparkles', label: 'Heart on Fire', content: '❤️‍🔥', type: 'emoji' },
  { id: 'h-stars', category: 'sparkles', label: 'Star Cluster', content: '💫', type: 'emoji' },
  { id: 'h-magic', category: 'sparkles', label: 'Magic Wand', content: '🪄', type: 'emoji' },

  // VIP Badges
  { id: 'b-gold', category: 'vip', label: 'Gold Trophy', content: '🏆', type: 'emoji' },
  { id: 'b-medal', category: 'vip', label: '1st Place', content: '🥇', type: 'emoji' },
  { id: 'b-diamond', category: 'vip', label: 'Diamond Pass', content: '💎', type: 'emoji' },
  { id: 'b-vip-gold', category: 'vip', label: 'VIP Gold Seal', content: '👑 TOP TIER VIP 👑', type: 'stamp', badgeColor: 'bg-yellow-500/30 border-yellow-400 text-yellow-200' },
];

export interface StickerCanvasLayerProps {
  /** Array of active stickers placed on the canvas */
  stickers: StickerItem[];
  /** Callback when stickers are updated */
  onStickersChange: (stickers: StickerItem[]) => void;
  /** Width & height container bounds */
  containerRef?: React.RefObject<HTMLDivElement | null>;
  /** Whether the sticker canvas is interactive */
  readOnly?: boolean;
  /** Currently selected sticker ID */
  selectedStickerId?: string | null;
  /** Callback when a sticker is selected */
  onSelectSticker?: (id: string | null) => void;
  /** Optional custom class names */
  className?: string;
}

export const StickerCanvasLayer: React.FC<StickerCanvasLayerProps> = ({
  stickers,
  onStickersChange,
  containerRef: externalContainerRef,
  readOnly = false,
  selectedStickerId: externalSelectedId,
  onSelectSticker,
  className = '',
}) => {
  const internalContainerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = externalContainerRef || internalContainerRef;

  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const activeStickerId = externalSelectedId !== undefined ? externalSelectedId : internalSelectedId;

  const setActiveStickerId = useCallback((id: string | null) => {
    if (onSelectSticker) {
      onSelectSticker(id);
    } else {
      setInternalSelectedId(id);
    }
  }, [onSelectSticker]);

  // Dragging state
  const dragInfoRef = useRef<{
    isDragging: boolean;
    stickerId: string;
    startX: number;
    startY: number;
    initialStickerX: number;
    initialStickerY: number;
  } | null>(null);

  // Rotating state
  const rotateInfoRef = useRef<{
    isRotating: boolean;
    stickerId: string;
    centerX: number;
    centerY: number;
    initialAngle: number;
    initialRotation: number;
    hasMoved: boolean;
    startX: number;
    startY: number;
  } | null>(null);

  // Scaling state
  const scaleInfoRef = useRef<{
    isScaling: boolean;
    stickerId: string;
    centerX: number;
    centerY: number;
    initialDist: number;
    initialScale: number;
    hasMoved: boolean;
    startX: number;
    startY: number;
  } | null>(null);

  // Delete sticker
  const handleDeleteSticker = useCallback((id: string) => {
    const updated = stickers.filter((s) => s.id !== id);
    onStickersChange(updated);
    if (activeStickerId === id) {
      setActiveStickerId(null);
    }
  }, [stickers, activeStickerId, onStickersChange, setActiveStickerId]);

  // Duplicate sticker
  const handleDuplicateSticker = useCallback((id: string) => {
    const target = stickers.find((s) => s.id === id);
    if (!target) return;
    const nextZ = Math.max(...stickers.map((s) => s.zIndex), 0) + 1;
    const duplicated: StickerItem = {
      ...target,
      id: `sticker_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      x: Math.min(90, target.x + 5),
      y: Math.min(90, target.y + 5),
      rotation: (target.rotation + 15) % 360,
      zIndex: nextZ,
    };
    const updated = [...stickers, duplicated];
    onStickersChange(updated);
    setActiveStickerId(duplicated.id);
  }, [stickers, onStickersChange, setActiveStickerId]);

  // Update specific sticker properties
  const updateSticker = useCallback((id: string, updates: Partial<StickerItem>) => {
    const updated = stickers.map((s) => (s.id === id ? { ...s, ...updates } : s));
    onStickersChange(updated);
  }, [stickers, onStickersChange]);

  // Pointer Down for Move
  const handleStickerPointerDown = (e: React.PointerEvent, sticker: StickerItem) => {
    if (readOnly) return;
    e.stopPropagation();
    setActiveStickerId(sticker.id);

    const container = containerRef.current;
    if (!container) return;

    dragInfoRef.current = {
      isDragging: true,
      stickerId: sticker.id,
      startX: e.clientX,
      startY: e.clientY,
      initialStickerX: sticker.x,
      initialStickerY: sticker.y,
    };
  };

  // Pointer Down for Rotation Handle
  const handleRotatePointerDown = (e: React.PointerEvent, sticker: StickerItem) => {
    if (readOnly) return;
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement)?.setPointerCapture(e.pointerId);
    } catch {}

    const targetEl = (e.currentTarget as HTMLElement).closest('[data-sticker-wrapper]') as HTMLElement;
    if (!targetEl) return;

    const rect = targetEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const rad = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    const deg = (rad * 180) / Math.PI;

    rotateInfoRef.current = {
      isRotating: true,
      stickerId: sticker.id,
      centerX,
      centerY,
      initialAngle: deg,
      initialRotation: sticker.rotation,
      hasMoved: false,
      startX: e.clientX,
      startY: e.clientY,
    };
  };

  // Pointer Down for Scale Handle (Corner Handles)
  const handleScalePointerDown = (e: React.PointerEvent, sticker: StickerItem) => {
    if (readOnly) return;
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement)?.setPointerCapture(e.pointerId);
    } catch {}

    const targetEl = (e.currentTarget as HTMLElement).closest('[data-sticker-wrapper]') as HTMLElement;
    if (!targetEl) return;

    const rect = targetEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const initialDist = Math.max(10, Math.hypot(e.clientX - centerX, e.clientY - centerY));

    scaleInfoRef.current = {
      isScaling: true,
      stickerId: sticker.id,
      centerX,
      centerY,
      initialDist,
      initialScale: sticker.scale,
      hasMoved: false,
      startX: e.clientX,
      startY: e.clientY,
    };
  };

  // Global Pointer Move & Up listeners for reliable touch and mouse drag
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      // 1. Move
      if (dragInfoRef.current?.isDragging && containerRef.current) {
        const { stickerId, startX, startY, initialStickerX, initialStickerY } = dragInfoRef.current;
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const deltaXPct = ((e.clientX - startX) / rect.width) * 100;
          const deltaYPct = ((e.clientY - startY) / rect.height) * 100;

          const nextX = Math.max(0, Math.min(100, initialStickerX + deltaXPct));
          const nextY = Math.max(0, Math.min(100, initialStickerY + deltaYPct));

          updateSticker(stickerId, { x: nextX, y: nextY });
        }
      }

      // 2. Rotate (Drag 360 deg)
      if (rotateInfoRef.current?.isRotating) {
        const { stickerId, centerX, centerY, initialAngle, initialRotation, startX, startY } = rotateInfoRef.current;
        if (Math.hypot(e.clientX - startX, e.clientY - startY) > 3) {
          rotateInfoRef.current.hasMoved = true;
        }
        const currentRad = Math.atan2(e.clientY - centerY, e.clientX - centerX);
        const currentDeg = (currentRad * 180) / Math.PI;
        const angleDiff = currentDeg - initialAngle;
        let newRotation = Math.round((initialRotation + angleDiff) % 360);
        if (newRotation < 0) newRotation += 360;

        updateSticker(stickerId, { rotation: newRotation });
      }

      // 3. Scale (Distance from center: 0.2x to 3.0x)
      if (scaleInfoRef.current?.isScaling) {
        const { stickerId, centerX, centerY, initialDist, initialScale, startX, startY } = scaleInfoRef.current;
        if (Math.hypot(e.clientX - startX, e.clientY - startY) > 3) {
          scaleInfoRef.current.hasMoved = true;
        }
        const currentDist = Math.hypot(e.clientX - centerX, e.clientY - centerY);
        const scaleFactor = currentDist / initialDist;
        const newScale = Math.max(0.2, Math.min(3.0, Number((initialScale * scaleFactor).toFixed(2))));

        updateSticker(stickerId, { scale: newScale });
      }
    };

    const handlePointerUp = () => {
      // Tap/click on rotate handle without dragging -> Rotate +45°
      if (rotateInfoRef.current?.isRotating && !rotateInfoRef.current.hasMoved) {
        const { stickerId } = rotateInfoRef.current;
        const target = stickers.find((s) => s.id === stickerId);
        if (target) {
          const nextRot = (target.rotation + 45) % 360;
          updateSticker(stickerId, { rotation: nextRot });
        }
      }

      // Tap/click on scale handle without dragging -> Cycle scale
      if (scaleInfoRef.current?.isScaling && !scaleInfoRef.current.hasMoved) {
        const { stickerId } = scaleInfoRef.current;
        const target = stickers.find((s) => s.id === stickerId);
        if (target) {
          const scaleSteps = [0.6, 1.0, 1.5, 2.2, 3.0];
          const nextScale = scaleSteps.find((sc) => sc > target.scale + 0.15) || scaleSteps[0];
          updateSticker(stickerId, { scale: nextScale });
        }
      }

      dragInfoRef.current = null;
      rotateInfoRef.current = null;
      scaleInfoRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [containerRef, stickers, updateSticker]);

  return (
    <div
      ref={containerRef}
      style={{ containerType: 'inline-size' }}
      onClick={() => !readOnly && setActiveStickerId(null)}
      className={`@container absolute inset-0 overflow-hidden pointer-events-auto select-none ${className}`}
    >
      {stickers.map((sticker) => {
        const isSelected = activeStickerId === sticker.id && !readOnly;

        return (
          <div
            key={sticker.id}
            data-sticker-wrapper="true"
            onPointerDown={(e) => handleStickerPointerDown(e, sticker)}
            onClick={(e) => {
              e.stopPropagation();
              if (!readOnly) {
                setActiveStickerId(sticker.id);
              }
            }}
            style={{
              left: `${sticker.x}%`,
              top: `${sticker.y}%`,
              transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg) scale(${sticker.scale})`,
              zIndex: isSelected ? 99 : sticker.zIndex,
              touchAction: 'none',
            }}
            className={`absolute cursor-grab active:cursor-grabbing transition-shadow group ${
              isSelected ? 'z-50' : ''
            }`}
          >
            {/* Active Bounding Box Highlight */}
            {isSelected && (
              <div className="absolute -inset-3 border-2 border-pink-500 rounded-xl ring-2 ring-pink-500/30 bg-pink-500/5 pointer-events-none shadow-lg shadow-pink-500/20" />
            )}

            {/* Sticker Visual Content with proportional cqw sizing */}
            <div className="relative flex items-center justify-center p-1">
              {sticker.type === 'emoji' && (
                <span
                  style={{ fontSize: '24cqw' }}
                  className="filter drop-shadow-md select-none transition-transform leading-none inline-block"
                >
                  {sticker.content}
                </span>
              )}

              {sticker.type === 'stamp' && (
                <div
                  style={{ fontSize: '7.5cqw', padding: '0.8cqw 1.8cqw' }}
                  className="bg-black/70 backdrop-blur-md border-2 border-pink-400 text-pink-300 font-black tracking-widest uppercase rounded-lg shadow-xl shadow-pink-500/30 whitespace-nowrap leading-tight"
                >
                  {sticker.content}
                </div>
              )}

              {sticker.type === 'badge' && (
                <div
                  style={{ fontSize: '7cqw', padding: '0.8cqw 1.6cqw' }}
                  className="bg-amber-500/20 border-2 border-amber-400 text-amber-300 font-extrabold tracking-wider rounded-full shadow-lg shadow-amber-500/20 whitespace-nowrap leading-tight"
                >
                  {sticker.content}
                </div>
              )}
            </div>

            {/* Canva-Style Interactive Transformation Controls (Visible when active) */}
            {isSelected && (
              <>
                {/* 4 Corner Resize Handles - Constant size regardless of sticker scale */}
                {/* Top-Left */}
                <div
                  onPointerDown={(e) => handleScalePointerDown(e, sticker)}
                  onClick={(e) => e.stopPropagation()}
                  title="Drag to resize / Tap to cycle size"
                  className="absolute -top-3 -left-3 w-4 h-4 bg-white border-2 border-pink-500 rounded-full shadow-lg cursor-nwse-resize hover:scale-125 active:scale-110 transition-transform z-30 pointer-events-auto"
                  style={{
                    transform: `translate(-50%, -50%) scale(${1 / sticker.scale})`,
                    transformOrigin: 'center center',
                    touchAction: 'none',
                  }}
                />
                {/* Top-Right */}
                <div
                  onPointerDown={(e) => handleScalePointerDown(e, sticker)}
                  onClick={(e) => e.stopPropagation()}
                  title="Drag to resize / Tap to cycle size"
                  className="absolute -top-3 -right-3 w-4 h-4 bg-white border-2 border-pink-500 rounded-full shadow-lg cursor-nesw-resize hover:scale-125 active:scale-110 transition-transform z-30 pointer-events-auto"
                  style={{
                    transform: `translate(50%, -50%) scale(${1 / sticker.scale})`,
                    transformOrigin: 'center center',
                    touchAction: 'none',
                  }}
                />
                {/* Bottom-Left */}
                <div
                  onPointerDown={(e) => handleScalePointerDown(e, sticker)}
                  onClick={(e) => e.stopPropagation()}
                  title="Drag to resize / Tap to cycle size"
                  className="absolute -bottom-3 -left-3 w-4 h-4 bg-white border-2 border-pink-500 rounded-full shadow-lg cursor-nesw-resize hover:scale-125 active:scale-110 transition-transform z-30 pointer-events-auto"
                  style={{
                    transform: `translate(-50%, 50%) scale(${1 / sticker.scale})`,
                    transformOrigin: 'center center',
                    touchAction: 'none',
                  }}
                />
                {/* Bottom-Right */}
                <div
                  onPointerDown={(e) => handleScalePointerDown(e, sticker)}
                  onClick={(e) => e.stopPropagation()}
                  title="Drag to resize / Tap to cycle size"
                  className="absolute -bottom-3 -right-3 w-4 h-4 bg-white border-2 border-pink-500 rounded-full shadow-lg cursor-nwse-resize hover:scale-125 active:scale-110 transition-transform z-30 pointer-events-auto"
                  style={{
                    transform: `translate(50%, 50%) scale(${1 / sticker.scale})`,
                    transformOrigin: 'center center',
                    touchAction: 'none',
                  }}
                />

                {/* Canva Rotate Handle (Stem & Circular Button) - Constant size */}
                <div
                  className="absolute -bottom-3 left-1/2 w-0.5 h-4 bg-pink-500 pointer-events-none"
                  style={{
                    transform: `translateX(-50%) scaleY(${1 / sticker.scale})`,
                    transformOrigin: 'top center',
                  }}
                />
                <button
                  type="button"
                  onPointerDown={(e) => handleRotatePointerDown(e, sticker)}
                  onClick={(e) => e.stopPropagation()}
                  title="Drag to rotate 360° / Tap to rotate +45°"
                  className="absolute -bottom-3 left-1/2 bg-pink-500 text-white rounded-full p-1.5 shadow-lg cursor-grab hover:scale-110 active:cursor-grabbing flex items-center justify-center transition-transform z-30 pointer-events-auto"
                  style={{
                    transform: `translate(-50%, calc(16px * ${1 / sticker.scale})) scale(${1 / sticker.scale})`,
                    transformOrigin: 'top center',
                    touchAction: 'none',
                  }}
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>

                {/* Quick Action Buttons (Duplicate & Delete Pill on Top) - Constant size */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute -top-3 left-1/2 flex items-center gap-1 bg-zinc-950/95 border border-pink-500/40 rounded-full p-1 shadow-xl backdrop-blur-md z-30 pointer-events-auto"
                  style={{
                    transform: `translate(-50%, calc(-100% - 10px * ${1 / sticker.scale})) scale(${1 / sticker.scale})`,
                    transformOrigin: 'bottom center',
                  }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicateSticker(sticker.id);
                    }}
                    title="Duplicate Sticker"
                    className="p-1 hover:bg-zinc-800 text-pink-300 hover:text-white rounded-full transition"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <div className="w-px h-3.5 bg-zinc-700" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSticker(sticker.id);
                    }}
                    title="Delete Sticker"
                    className="p-1 hover:bg-rose-600/30 text-rose-400 hover:text-rose-200 rounded-full transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

/**
 * StickerPickerDrawer: Standalone sticker library catalog picker for inserting stickers
 */
export interface StickerPickerDrawerProps {
  onSelectSticker: (item: StickerLibraryItem) => void;
  onClearAll?: () => void;
  stickersCount?: number;
  className?: string;
  headerRight?: React.ReactNode;
}

export const StickerPickerDrawer: React.FC<StickerPickerDrawerProps> = ({
  onSelectSticker,
  onClearAll,
  stickersCount = 0,
  className = '',
  headerRight,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'All', icon: Sparkles },
    { id: 'emoji', label: 'Emojis', icon: Smile },
    { id: 'stamp', label: 'Stamps', icon: Stamp },
    { id: 'sunglasses', label: 'Shades', icon: Glasses },
    { id: 'party', label: 'Party', icon: PartyPopper },
    { id: 'vip', label: 'VIP Badges', icon: Award },
  ];

  const filtered = activeCategory === 'all'
    ? STICKER_CATALOG
    : STICKER_CATALOG.filter((s) => s.category === activeCategory);

  return (
    <div className={`flex flex-col gap-2.5 ${className}`}>
      {/* Category Pills, Clear All & Header Right (X button) in the same row */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-2">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 min-w-0">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-pink-500 text-white shadow-md shadow-pink-500/25'
                    : 'bg-zinc-900/80 text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}

          {onClearAll && stickersCount > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-lg transition whitespace-nowrap ml-1 flex-shrink-0"
            >
              <Trash2 className="w-3 h-3" />
              Clear ({stickersCount})
            </button>
          )}
        </div>

        {headerRight && (
          <div className="flex items-center flex-shrink-0 ml-2">
            {headerRight}
          </div>
        )}
      </div>

      {/* Stickers Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-52 overflow-y-auto pr-1">
        {filtered.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectSticker(item)}
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-zinc-900/60 hover:bg-pink-500/10 border border-zinc-800/60 hover:border-pink-500/40 hover:scale-105 active:scale-95 transition group"
          >
            {item.type === 'emoji' ? (
              <span className="text-2xl filter group-hover:drop-shadow-md">{item.content}</span>
            ) : (
              <span className="text-[10px] font-black tracking-tight text-center text-pink-400 uppercase leading-tight line-clamp-2">
                {item.label}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
