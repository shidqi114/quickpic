'use client';

import React, { useState } from 'react';
import { FrameTemplate, SlotAdjustment } from '@/types/photobooth';
import { FRAME_THEMES } from '@/lib/compositor';
import { Sparkles, ArrowRight, RotateCcw, Check, Wand2, Layers, RefreshCw, Palette } from 'lucide-react';

interface PhotoPickSlotsProps {
  capturedPhotos: string[];
  template: FrameTemplate;
  onSelectTemplate?: (template: FrameTemplate) => void;
  slotAdjustments: Record<string, SlotAdjustment>;
  onUpdateSlotPhoto: (slotId: string, photoIndex: number) => void;
  onAutoFillInOrder: () => void;
  onProceedToEditor: () => void;
  onBackToCamera: () => void;
  eventName?: string;
  eventDate?: string;
}

export const PhotoPickSlots: React.FC<PhotoPickSlotsProps> = ({
  capturedPhotos,
  template,
  onSelectTemplate,
  slotAdjustments,
  onUpdateSlotPhoto,
  onAutoFillInOrder,
  onProceedToEditor,
  onBackToCamera,
  eventName = 'QUICKPIC PHOTOBOOTH',
  eventDate = 'SEP 2026',
}) => {
  const [selectedSlotId, setSelectedSlotId] = useState<string>(template.slots[0]?.id || 's1');
  const [draggedPhotoIndex, setDraggedPhotoIndex] = useState<number | null>(null);

  const handleDragStart = (idx: number) => {
    setDraggedPhotoIndex(idx);
  };

  const handleDropOnSlot = (slotId: string) => {
    if (draggedPhotoIndex !== null) {
      onUpdateSlotPhoto(slotId, draggedPhotoIndex);
      setSelectedSlotId(slotId);
      setDraggedPhotoIndex(null);
    }
  };

  const handleTapPhoto = (idx: number) => {
    if (selectedSlotId) {
      onUpdateSlotPhoto(selectedSlotId, idx);
      // Auto-advance to the next slot for speedy ergonomic flow!
      const currentIdx = template.slots.findIndex((s) => s.id === selectedSlotId);
      if (currentIdx !== -1 && currentIdx < template.slots.length - 1) {
        setSelectedSlotId(template.slots[currentIdx + 1].id);
      }
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col items-center p-4 md:p-6 text-zinc-100 select-none animate-fade-in">


      {/* Main Workspace Layout */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left / Center: Interactive Print Strip Preview (5 cols) */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center">
          <div className="flex items-center justify-between w-full max-w-[280px] mb-3 px-2">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              {template.name}
            </span>
            <button
              onClick={onAutoFillInOrder}
              className="text-xs text-pink-400 hover:text-pink-300 flex items-center gap-1 font-semibold transition cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5" /> Auto-Fill
            </button>
          </div>

          {/* Strip Canvas */}
          <div
            className="relative shadow-2xl rounded-2xl overflow-hidden border-4 transition-all duration-300"
            style={{
              backgroundColor: template.backgroundColor,
              borderColor: template.accentColor,
              width: template.category === 'strip' ? '220px' : '300px',
              aspectRatio: template.aspectRatio
                ? `${template.aspectRatio}`
                : template.category === 'strip'
                ? '1/3'
                : '2/3',
            }}
          >
            {/* Custom Template Frame Artwork in the BACKGROUND */}
            {template.overlayPngUrl && (
              <img
                src={template.overlayPngUrl}
                alt="Template Frame Background"
                className="absolute inset-0 w-full h-full object-fill pointer-events-none z-0 select-none"
              />
            )}

            {/* Photo Slots in FRONT of the template background */}
            {template.slots.map((slot, idx) => {
              const adj = slotAdjustments[slot.id] || {
                slotId: slot.id,
                photoIndex: idx % capturedPhotos.length,
                zoom: 1.0,
                panX: 0,
                panY: 0,
                filter: 'none',
              };
              const assignedPhoto = capturedPhotos[adj.photoIndex];
              const isSelected = selectedSlotId === slot.id;

              return (
                <div
                  key={slot.id}
                  onClick={() => setSelectedSlotId(slot.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDropOnSlot(slot.id)}
                  className={`absolute cursor-pointer overflow-hidden rounded-lg transition-all ${isSelected
                    ? 'ring-4 ring-pink-500 z-20 scale-[1.03] shadow-lg shadow-pink-500/30'
                    : 'ring-1 ring-zinc-400/40 z-10 hover:ring-pink-400/80'
                    }`}
                  style={{
                    left: `${slot.x}%`,
                    top: `${slot.y}%`,
                    width: `${slot.width}%`,
                    height: `${slot.height}%`,
                  }}
                >
                  {assignedPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={assignedPhoto}
                      alt={`Slot ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-500 font-bold">
                      Empty Slot
                    </div>
                  )}

                  {/* Slot Indicator Label */}
                  <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/75 text-[9px] font-bold text-white uppercase backdrop-blur-xs flex items-center gap-1">
                    <span>Slot #{idx + 1}</span>
                    {assignedPhoto && (
                      <span className="text-pink-400 font-normal">➔ Pose #{adj.photoIndex + 1}</span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Template Footer Branding (if enabled) */}
            {template.includeText !== false && (
              <div
                className="absolute bottom-2 inset-x-0 text-center font-mono select-none px-2 z-20"
                style={{ color: template.textColor }}
              >
                <div className="font-black text-[10px] tracking-widest uppercase truncate leading-tight">
                  {template.customText || eventName.toUpperCase()}
                </div>
                <div className="text-[8px] font-semibold tracking-wider opacity-75 leading-tight mt-0.5">
                  ★ {eventDate} ★
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Captured Raw Photos Palette & Quick Controls (7 cols) */}
        <div className="lg:col-span-7 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex flex-col justify-between shadow-2xl min-h-[460px]">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Your Captured Poses</h3>
                <p className="text-xs text-zinc-400">
                  Currently filling:{' '}
                  <span className="text-pink-400 font-bold">
                    Slot #{template.slots.findIndex((s) => s.id === selectedSlotId) + 1}
                  </span>
                </p>
              </div>
              <span className="text-xs font-mono text-zinc-400 bg-zinc-950 px-2.5 py-1 rounded-full border border-zinc-800">
                {capturedPhotos.length} Shots Available
              </span>
            </div>

            {/* Raw Poses Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {capturedPhotos.map((photo, idx) => {
                const isCurrentlyAssignedToSelected =
                  (slotAdjustments[selectedSlotId]?.photoIndex ?? -1) === idx;

                return (
                  <div
                    key={idx}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onClick={() => handleTapPhoto(idx)}
                    className={`group relative cursor-pointer rounded-2xl overflow-hidden aspect-4/3 border-2 transition-all active:scale-95 ${isCurrentlyAssignedToSelected
                      ? 'border-pink-500 ring-4 ring-pink-500/30 scale-105 shadow-xl shadow-pink-500/25'
                      : 'border-zinc-700 hover:border-pink-400'
                      }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo} alt={`Pose ${idx + 1}`} className="w-full h-full object-cover" />

                    {/* Pose Number Badge */}
                    <div className="absolute bottom-1.5 left-1.5 bg-black/80 px-2 py-0.5 rounded-md text-[10px] font-bold text-white backdrop-blur-xs flex items-center gap-1">
                      <span>Pose #{idx + 1}</span>
                    </div>

                    {isCurrentlyAssignedToSelected && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-pink-500 text-white flex items-center justify-center shadow-lg">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Hint Box */}
            <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800 text-xs text-zinc-400 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <p>
                You can reuse the same pose in multiple slots or arrange them in any order you love before applying creative filters and stickers!
              </p>
            </div>
          </div>

          {/* Action Navigation Footer */}
          <div className="pt-6 border-t border-zinc-800 flex items-center justify-between gap-4">
            <button
              onClick={onBackToCamera}
              className="px-5 py-3.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs uppercase tracking-wider transition flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> Reshoot / Camera
            </button>

            <button
              onClick={onProceedToEditor}
              className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-yellow-400 hover:brightness-110 text-white font-extrabold text-sm uppercase tracking-wider shadow-xl shadow-pink-500/25 active:scale-95 transition flex items-center gap-2"
            >
              Next: Filters & Stickers (Step 2) <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
