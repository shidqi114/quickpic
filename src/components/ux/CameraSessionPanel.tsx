'use client';

import React from 'react';
import { X } from 'lucide-react';
import { CameraViewfinder } from '@/components/CameraViewfinder';
import { PhotoFilter } from '@/types/photobooth';
import type { WelcomeLanguage } from '@/components/ux/WelcomeScreen';

export interface CameraSessionPanelProps {
  language?: WelcomeLanguage;
  countdown: number | null;
  isCapturing: boolean;
  isReviewing: boolean;
  reviewCountdown: number | null;
  filter: PhotoFilter;
  mirror: boolean;
  playAudio: boolean;
  capturedPhotos: (string | null)[];
  totalShots: number;
  currentShotIndex: number;
  earliestEmptySlot: number;
  filledCount: number;
  allShotsCompleted: boolean;
  onToggleAudio: () => void;
  onToggleMirror: () => void;
  onStart: () => void;
  onTakeNext: () => void;
  onTakeSlot: (idx: number) => void;
  onRemovePhoto: (idx: number) => void;
  onProceed: () => void;
  onContinueReview: () => void;
}

const COPY: Record<WelcomeLanguage, {
  pose: (n: number, total: number) => string;
  mirrorOn: string;
  mirrorOff: string;
  poses: (filled: number, total: number) => string;
  shooting: string;
  empty: string;
  clearPose: (n: number) => string;
  takePose: (n: number) => string;
  start: string;
  next: string;
  proceed: string;
  reviewing: (s: number) => string;
  reviewHint: string;
  continueLabel: string;
  lookAt: string;
}> = {
  en: {
    pose: (n, total) => `Pose ${n} of ${total}`,
    mirrorOn: 'Mirror on',
    mirrorOff: 'Mirror off',
    poses: (filled, total) => `Your poses (${filled}/${total})`,
    shooting: 'Shooting…',
    empty: 'Empty',
    clearPose: (n) => `Clear pose ${n} and retake`,
    takePose: (n) => `Take pose ${n}`,
    start: 'Start',
    next: 'Take next pose',
    proceed: 'Choose photos',
    reviewing: (s) => `Review your photos (${s}s)`,
    reviewHint: 'Tap × on a pose to retake it, or continue.',
    continueLabel: 'Continue',
    lookAt: 'Look at the camera',
  },
  id: {
    pose: (n, total) => `Pose ${n} dari ${total}`,
    mirrorOn: 'Cermin nyala',
    mirrorOff: 'Cermin mati',
    poses: (filled, total) => `Pose Anda (${filled}/${total})`,
    shooting: 'Memotret…',
    empty: 'Kosong',
    clearPose: (n) => `Hapus pose ${n} dan foto ulang`,
    takePose: (n) => `Foto pose ${n}`,
    start: 'Mulai',
    next: 'Foto pose berikutnya',
    proceed: 'Pilih foto',
    reviewing: (s) => `Tinjau foto Anda (${s} dtk)`,
    reviewHint: 'Ketuk × pada pose untuk memotret ulang, atau lanjut.',
    continueLabel: 'Lanjut',
    lookAt: 'Lihat ke kamera',
  },
};

export const CameraSessionPanel: React.FC<CameraSessionPanelProps> = ({
  language = 'en',
  countdown,
  isCapturing,
  isReviewing,
  reviewCountdown,
  filter,
  mirror,
  playAudio,
  capturedPhotos,
  totalShots,
  currentShotIndex,
  earliestEmptySlot,
  filledCount,
  allShotsCompleted,
  onToggleAudio,
  onToggleMirror,
  onStart,
  onTakeNext,
  onTakeSlot,
  onRemovePhoto,
  onProceed,
  onContinueReview,
}) => {
  const copy = COPY[language];
  const currentPose = (earliestEmptySlot !== -1 ? earliestEmptySlot : currentShotIndex) + 1;

  return (
    <section className="bg-stage text-stage-ink font-display select-none min-h-screen flex flex-col gap-6 p-6 md:p-10">
      <header className="flex items-baseline justify-between gap-6">
        <h1 className="text-[clamp(36px,3.2vw,64px)] leading-none font-semibold tracking-[-0.035em]">
          {isCapturing ? copy.pose(currentPose, totalShots) : copy.lookAt}
        </h1>
        <button
          type="button"
          onClick={onToggleMirror}
          className="h-11 px-4 rounded border border-stage-muted/50 text-[16px] cursor-pointer hover:bg-white/10"
        >
          {mirror ? copy.mirrorOn : copy.mirrorOff}
        </button>
      </header>

      <div className="flex-1 min-h-0 grid lg:grid-cols-[minmax(0,1fr)_auto] gap-8 items-start">
        <div className="relative aspect-[3/2] w-full max-h-[70vh] bg-stage overflow-hidden">
          <CameraViewfinder
            language={language}
            countdown={countdown}
            isCapturing={isCapturing}
            filter={filter}
            mirror={mirror}
            playAudio={playAudio}
            onToggleAudio={onToggleAudio}
          />
        </div>

        <aside className="grid gap-4">
          <p className="text-[16px] text-stage-muted tabular-nums">{copy.poses(filledCount, totalShots)}</p>
          <div className="grid grid-cols-4 lg:grid-cols-2 gap-3 w-full lg:w-[clamp(200px,18vw,300px)]">
            {Array.from({ length: totalShots }).map((_, idx) => {
              const photo = capturedPhotos[idx];
              const isNext = isCapturing && earliestEmptySlot === idx;
              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (!photo && !isCapturing) onTakeSlot(idx);
                  }}
                  className={`relative aspect-[3/4] rounded overflow-hidden border-2 bg-stage-2 ${
                    isNext ? 'border-accent' : photo ? 'border-stage-line' : 'border-stage-line border-dashed cursor-pointer'
                  }`}
                >
                  {photo ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo} alt={`Pose ${idx + 1}`} className="w-full h-full object-cover" />
                      <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-stage text-[14px] tabular-nums">{idx + 1}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemovePhoto(idx);
                        }}
                        aria-label={copy.clearPose(idx + 1)}
                        title={copy.clearPose(idx + 1)}
                        className="absolute top-2 right-2 w-9 h-9 rounded bg-stage text-white flex items-center justify-center cursor-pointer hover:bg-stage-3"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-stage-muted">
                      <span className="text-[24px] font-medium tabular-nums">{idx + 1}</span>
                      <span className={`text-[14px] ${isNext ? 'text-stage-ink' : ''}`}>{isNext ? copy.shooting : copy.empty}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-4 min-h-[72px]">
        {isReviewing && reviewCountdown !== null ? (
          <>
            <div>
              <p className="text-[20px] font-medium tabular-nums">{copy.reviewing(reviewCountdown)}</p>
              <p className="text-[16px] text-stage-muted">{copy.reviewHint}</p>
            </div>
            <button
              type="button"
              onClick={onContinueReview}
              className="h-[64px] px-8 rounded bg-accent hover:bg-accent-press text-white text-[20px] font-medium cursor-pointer"
            >
              {copy.continueLabel}
            </button>
          </>
        ) : !isCapturing ? (
          <>
            <span />
            {filledCount === 0 ? (
              <button type="button" onClick={onStart} className="h-[64px] px-8 rounded bg-accent hover:bg-accent-press text-white text-[20px] font-medium cursor-pointer">
                {copy.start}
              </button>
            ) : allShotsCompleted ? (
              <button type="button" onClick={onProceed} className="h-[64px] px-8 rounded bg-accent hover:bg-accent-press text-white text-[20px] font-medium cursor-pointer">
                {copy.proceed}
              </button>
            ) : (
              <button type="button" onClick={onTakeNext} className="h-[64px] px-8 rounded bg-accent hover:bg-accent-press text-white text-[20px] font-medium cursor-pointer">
                {copy.next}
              </button>
            )}
          </>
        ) : (
          <span />
        )}
      </footer>
    </section>
  );
};
