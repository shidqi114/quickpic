'use client';

import React, { useState } from 'react';
import { FrameTemplate, SlotAdjustment } from '@/types/photobooth';
import type { WelcomeLanguage } from '@/components/ux/WelcomeScreen';

const COPY: Record<WelcomeLanguage, {
  kicker: string;
  title: string;
  autoFill: string;
  filling: string;
  slot: (n: number) => string;
  pose: (n: number) => string;
  empty: string;
  shots: (n: number) => string;
  hint: string;
  reshoot: string;
  next: string;
  yourPoses: string;
  tapToPlace: string;
}> = {
  en: {
    kicker: 'Step 1 of 2',
    title: 'Pick a photo for each window',
    autoFill: 'Fill in order',
    filling: 'Filling',
    slot: (n) => `Window ${n}`,
    pose: (n) => `Pose ${n}`,
    empty: 'Empty',
    shots: (n) => `${n} shots`,
    hint: 'Tap a pose to put it in the selected window. A pose can go in more than one window.',
    reshoot: 'Retake photos',
    next: 'Next: filters and stickers',
    yourPoses: 'Your poses',
    tapToPlace: 'Tap a pose',
  },
  id: {
    kicker: 'Langkah 1 dari 2',
    title: 'Pilih foto untuk setiap jendela',
    autoFill: 'Isi berurutan',
    filling: 'Sedang mengisi',
    slot: (n) => `Jendela ${n}`,
    pose: (n) => `Pose ${n}`,
    empty: 'Kosong',
    shots: (n) => `${n} foto`,
    hint: 'Ketuk pose untuk memasukkannya ke jendela yang dipilih. Satu pose boleh dipakai di beberapa jendela.',
    reshoot: 'Foto ulang',
    next: 'Lanjut: filter dan stiker',
    yourPoses: 'Pose Anda',
    tapToPlace: 'Ketuk pose',
  },
};

interface PhotoPickSlotsProps {
  language?: WelcomeLanguage;
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
  language = 'en',
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

  const copy = COPY[language];
  const selectedIndex = Math.max(0, template.slots.findIndex((s) => s.id === selectedSlotId));
  const isStrip = template.category === 'strip';

  return (
    <section className="min-h-screen bg-stage text-stage-ink font-display select-none p-6 md:p-10 grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="flex flex-col items-center gap-5">
        <div className="w-full max-w-[360px] flex items-center justify-between gap-4">
          <span className="text-[16px] text-stage-muted">{template.name}</span>
          <button
            type="button"
            onClick={onAutoFillInOrder}
            className="h-11 px-4 rounded border border-stage-muted/50 text-[16px] cursor-pointer hover:bg-white/10"
          >
            {copy.autoFill}
          </button>
        </div>

        <div
          className="relative overflow-hidden"
          style={{
            backgroundColor: template.backgroundColor,
            width: isStrip ? 'min(260px, 36vw)' : 'min(340px, 40vw)',
            aspectRatio: template.aspectRatio ? `${template.aspectRatio}` : isStrip ? '1/3' : '2/3',
          }}
        >
          {template.overlayPngUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={template.overlayPngUrl} alt="" className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none" />
          )}

          {template.slots.map((slot, idx) => {
            const adj = slotAdjustments[slot.id] || {
              slotId: slot.id,
              photoIndex: idx % Math.max(1, capturedPhotos.length),
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
                className={`absolute cursor-pointer overflow-hidden ${isSelected ? 'outline-4 outline-accent -outline-offset-4 z-20' : 'outline-1 outline-stage-line -outline-offset-1 z-10'}`}
                style={{
                  left: `${slot.x}%`,
                  top: `${slot.y}%`,
                  width: `${slot.width}%`,
                  height: `${slot.height}%`,
                }}
              >
                {assignedPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={assignedPhoto} alt={copy.slot(idx + 1)} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-stage-2 flex items-center justify-center text-[14px] text-stage-muted">{copy.empty}</div>
                )}
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-stage text-[14px] text-white tabular-nums">
                  {idx + 1}
                </span>
              </div>
            );
          })}

          {template.includeText !== false && (
            <div className="absolute bottom-3 inset-x-0 text-center px-3 z-20" style={{ color: template.textColor }}>
              <div className="font-semibold text-[15px] leading-tight truncate">{template.customText || eventName}</div>
              <div className="text-[13px] opacity-80 leading-tight mt-0.5 tabular-nums">{eventDate}</div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col justify-between gap-8 min-w-0">
        <div className="grid gap-5">
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[16px] text-stage-muted">{copy.kicker}</p>
              <h1 className="text-[clamp(32px,3vw,52px)] leading-none font-semibold tracking-[-0.03em] mt-1">{copy.title}</h1>
            </div>
            <p className="text-[16px] text-stage-muted tabular-nums">
              {copy.filling} {copy.slot(selectedIndex + 1)}
            </p>
          </div>

          <div>
            <p className="text-[16px] text-stage-muted mb-3">
              {copy.yourPoses} · {copy.shots(capturedPhotos.length)}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {capturedPhotos.map((photo, idx) => {
                const isAssigned = (slotAdjustments[selectedSlotId]?.photoIndex ?? -1) === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onClick={() => handleTapPhoto(idx)}
                    aria-pressed={isAssigned}
                    aria-label={`${copy.pose(idx + 1)} ${copy.tapToPlace}`}
                    className={`relative aspect-[4/3] overflow-hidden cursor-pointer bg-stage-2 ${isAssigned ? 'outline-4 outline-white -outline-offset-4' : 'outline-1 outline-stage-line -outline-offset-1 hover:outline-stage-muted'}`}
                  >
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center text-[14px] text-stage-muted">{copy.empty}</span>
                    )}
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-stage text-[14px] text-white tabular-nums">
                      {copy.pose(idx + 1)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-[16px] text-stage-muted max-w-[60ch] leading-normal">{copy.hint}</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-stage-line">
          <button
            type="button"
            onClick={onBackToCamera}
            className="h-16 px-6 rounded border border-stage-muted/50 text-[18px] cursor-pointer hover:bg-white/10"
          >
            {copy.reshoot}
          </button>
          <button
            type="button"
            onClick={onProceedToEditor}
            className="h-16 px-8 rounded bg-accent hover:bg-accent-press text-white text-[18px] font-medium cursor-pointer"
          >
            {copy.next}
          </button>
        </div>
      </div>
    </section>
  );
};
