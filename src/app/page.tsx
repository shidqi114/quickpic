'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Camera, Settings, Maximize, Sparkles, RefreshCw, Layers, ArrowLeft, Heart, Check, QrCode, Printer, Undo2, RotateCcw, X } from 'lucide-react';
import { CameraViewfinder } from '@/components/CameraViewfinder';
import { SettingsModal } from '@/components/SettingsModal';
import { PackagePaymentModal } from '@/components/Payment/PackagePaymentModal';
import { FrameSlotEditor } from '@/components/FrameEditor/FrameSlotEditor';
import { ConsentModal } from '@/components/ConsentModal';
import { ResultModal } from '@/components/ResultModal';
import {
  BoothSettings,
  PhotoFilter,
  PhotoSession,
  PhotoboothPackage,
  PaymentDetails,
  FrameTemplate,
  SlotAdjustment,
  SocialConsent,
  LivePhotoMedia,
} from '@/types/photobooth';
import { FRAME_TEMPLATES, PHOTOBOOTH_PACKAGES } from '@/lib/constants';
import { renderCustomFrameSlotComposite, FRAME_THEMES } from '@/lib/compositor';
import { photoboothAudio } from '@/lib/audio';
import { savePhotoSession } from '@/lib/firebase';
import { livePhotoRecorder } from '@/lib/livephoto';
import Link from 'next/link';

type KioskStep =
  | 'WELCOME'
  | 'PACKAGE_PAYMENT'
  | 'CAMERA_SESSION'
  | 'FRAME_EDITOR'
  | 'CONSENT_MODAL'
  | 'RESULT_QR';

const DEFAULT_SETTINGS: BoothSettings = {
  eventName: 'Summer Gala 2026',
  eventDate: 'SEP 2026',
  eventHashtag: '#QuickPicBooth',
  layout: 'strip-3',
  countdownSeconds: 3,
  showFlashEffect: true,
  playAudioCues: true,
  selectedFilter: 'none',
  selectedThemeId: 'classic-white',
  mirrorCamera: true,
  printEnabled: true,
  hardwareDaemonUrl: 'http://localhost:8000',
};

export default function PhotoboothKioskPage() {
  const [currentStep, setCurrentStep] = useState<KioskStep>('WELCOME');
  const [settings, setSettings] = useState<BoothSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Selected package & payment details
  const [selectedPackage, setSelectedPackage] = useState<PhotoboothPackage>(PHOTOBOOTH_PACKAGES[0]);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [extraPrintsCount, setExtraPrintsCount] = useState(0);

  // Camera session state
  const [isCapturing, setIsCapturing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [currentShotIndex, setCurrentShotIndex] = useState(0);
  const [capturedPhotos, setCapturedPhotos] = useState<(string | null)[]>(() =>
    Array(selectedPackage.shotsCount || 4).fill(null)
  );
  const capturedPhotosRef = useRef<(string | null)[]>(Array(selectedPackage.shotsCount || 4).fill(null));
  capturedPhotosRef.current = capturedPhotos;

  const [livePhotos, setLivePhotos] = useState<(LivePhotoMedia | null)[]>(() =>
    Array(selectedPackage.shotsCount || 4).fill(null)
  );

  // Monotonically increasing allowed retake slot (ensures only the single immediately prior image can be retaken)
  const [allowedRetakeSlot, setAllowedRetakeSlot] = useState<number | null>(null);
  const allowedRetakeSlotRef = useRef<number | null>(null);

  // Frame Slot Editor state
  const [selectedTemplate, setSelectedTemplate] = useState<FrameTemplate>(FRAME_TEMPLATES[0]);
  const [slotAdjustments, setSlotAdjustments] = useState<Record<string, SlotAdjustment>>({});

  // Consent & Output state
  const [socialConsent, setSocialConsent] = useState<SocialConsent>({ granted: false, timestamp: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentSession, setCurrentSession] = useState<PhotoSession | null>(null);
  const [guestUrl, setGuestUrl] = useState<string>('');

  const totalShotsRequired = selectedPackage.shotsCount || 4;

  // Active timers & sequence control
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sequenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isAutoSequenceRef = useRef<boolean>(false);

  // Helper to sync slot array length with selected package shots
  useEffect(() => {
    setCapturedPhotos((prev) => {
      const next = [...prev];
      while (next.length < totalShotsRequired) next.push(null);
      const res = next.slice(0, totalShotsRequired);
      capturedPhotosRef.current = res;
      return res;
    });
    setLivePhotos((prev) => {
      const next = [...prev];
      while (next.length < totalShotsRequired) next.push(null);
      return next.slice(0, totalShotsRequired);
    });
  }, [totalShotsRequired]);

  const clearAllActiveTimers = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (sequenceTimeoutRef.current) {
      clearTimeout(sequenceTimeoutRef.current);
      sequenceTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearAllActiveTimers();
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { });
    } else {
      document.exitFullscreen().catch(() => { });
    }
  };

  // Helper to capture single frame from viewfinder (supports standard webcam video and DSLR image stream)
  const captureFrameFromVideo = (): string | null => {
    const dslrImg = document.getElementById('dslr-liveview-stream') as HTMLImageElement | null;
    if (dslrImg && dslrImg.complete && dslrImg.naturalWidth > 0) {
      const width = dslrImg.naturalWidth;
      const height = dslrImg.naturalHeight;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      if (settings.mirrorCamera) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(dslrImg, 0, 0, width, height);
      return canvas.toDataURL('image/jpeg', 0.95);
    }

    const video = document.querySelector('video') as HTMLVideoElement | null;
    if (!video) return null;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 960;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (settings.mirrorCamera) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.95);
  };

  // Earliest empty slot index (0 to totalShotsRequired - 1), or -1 if full
  const earliestEmptySlot = capturedPhotos.findIndex((p) => !p);
  const filledPhotosCount = capturedPhotos.filter((p): p is string => Boolean(p)).length;
  const isAllShotsCompleted = filledPhotosCount === totalShotsRequired;
  const lastFilledIndex = capturedPhotos.reduce((last, p, i) => (p ? i : last), -1);

  // UNIVERSAL PICTURE TAKING ENGINE
  // Continually captures and always fills the most top empty slot available
  const runUniversalCapture = (preferredSlot: number, autoAdvance: boolean) => {
    clearAllActiveTimers();
    isAutoSequenceRef.current = autoAdvance;
    setIsCapturing(true);

    // Resolve target slot to the most top empty slot available
    const currentRefPhotos = [...capturedPhotosRef.current];
    while (currentRefPhotos.length < totalShotsRequired) currentRefPhotos.push(null);
    const topEmpty = currentRefPhotos.findIndex((p) => !p);
    const activeSlot = topEmpty !== -1 ? topEmpty : preferredSlot;
    setCurrentShotIndex(activeSlot);

    let count = settings.countdownSeconds;
    setCountdown(count);

    const video = document.querySelector('video') as HTMLVideoElement | null;
    if (video && video.srcObject) {
      livePhotoRecorder.startRecording(video.srcObject as MediaStream);
    }

    if (settings.playAudioCues) {
      photoboothAudio.playCountdownBeep(false);
    }

    countdownIntervalRef.current = setInterval(async () => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
        if (settings.playAudioCues) {
          photoboothAudio.playCountdownBeep(false);
        }
      } else if (count === 0) {
        setCountdown(0);
        if (settings.playAudioCues) {
          photoboothAudio.playShutterSound();
        }

        // Immediately terminate countdown interval to prevent any re-triggers
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }

        const newFrame = captureFrameFromVideo();
        const liveUrl = await livePhotoRecorder.stopRecording();

        // 1. Synchronously resolve destination slot from current ref state:
        const currentPhotos = [...capturedPhotosRef.current];
        while (currentPhotos.length < totalShotsRequired) currentPhotos.push(null);
        const topEmpty = currentPhotos.findIndex((p) => !p);
        const destinationSlot = topEmpty !== -1 ? topEmpty : activeSlot;

        // 2. Place captured frame directly into destinationSlot
        currentPhotos[destinationSlot] = newFrame || '';
        capturedPhotosRef.current = currentPhotos;
        setCapturedPhotos(currentPhotos);

        setCurrentShotIndex(destinationSlot);

        // 3. Monotonically increasing allowed retake slot
        // Ensures only the single immediately prior image can ever have the cross button
        // If the last picture has been taken (destinationSlot >= totalShotsRequired - 1), no picture can be removed nor retaken
        const nextAllowed =
          destinationSlot >= totalShotsRequired - 1
            ? null
            : allowedRetakeSlotRef.current === null
            ? destinationSlot
            : Math.max(allowedRetakeSlotRef.current, destinationSlot);
        allowedRetakeSlotRef.current = nextAllowed;
        setAllowedRetakeSlot(nextAllowed);

        setLivePhotos((prev) => {
          const next = [...prev];
          while (next.length < totalShotsRequired) next.push(null);
          next[destinationSlot] = { photoIndex: destinationSlot, gifUrl: liveUrl, durationSeconds: 5 };
          return next;
        });

        // 500ms post-shutter display before advancing or completing
        sequenceTimeoutRef.current = setTimeout(() => {
          setCountdown(null);

          if (isAutoSequenceRef.current) {
            const latestPhotos = [...capturedPhotosRef.current];
            const nextEmpty = latestPhotos.findIndex((p) => !p);

            if (nextEmpty !== -1 && isAutoSequenceRef.current) {
              setCurrentShotIndex(nextEmpty);
              sequenceTimeoutRef.current = setTimeout(() => {
                if (isAutoSequenceRef.current) {
                  runUniversalCapture(nextEmpty, true);
                }
              }, 1000);
            } else {
              isAutoSequenceRef.current = false;
              setIsCapturing(false);
            }
          } else {
            setIsCapturing(false);
          }
        }, 500);
      }
    }, 1000);
  };

  // Trigger universal picture taking: fills the earliest empty slot (or specific target slot)
  const triggerUniversalCapture = (specificSlot?: number) => {
    const target =
      typeof specificSlot === 'number' && specificSlot >= 0 && specificSlot < totalShotsRequired
        ? specificSlot
        : capturedPhotosRef.current.findIndex((p) => !p);

    if (target === -1) return;
    runUniversalCapture(target, true);
  };

  // Start complete capture sequence from earliest order
  const startCaptureSequence = () => {
    clearAllActiveTimers();
    allowedRetakeSlotRef.current = null;
    setAllowedRetakeSlot(null);
    const emptyArr = Array(totalShotsRequired).fill(null);
    capturedPhotosRef.current = emptyArr;
    setCapturedPhotos(emptyArr);
    setLivePhotos(Array(totalShotsRequired).fill(null));
    setCurrentShotIndex(0);
    runUniversalCapture(0, true);
  };

  // Remove a prior photo: slot becomes empty, and the picture taking action goes on filling top empty slots
  const handleRemovePhoto = (indexToRemove: number) => {
    // If the last picture has been taken or all shots are completed, no retake is allowed
    if (indexToRemove >= totalShotsRequired - 1 || isAllShotsCompleted) {
      return;
    }

    // Only the allowedRetakeSlot can be removed / retaken!
    if (allowedRetakeSlotRef.current === null || allowedRetakeSlotRef.current !== indexToRemove) {
      return;
    }

    // 1. Clear the specific slot in ref & state
    const current = [...capturedPhotosRef.current];
    while (current.length < totalShotsRequired) current.push(null);
    current[indexToRemove] = null;
    capturedPhotosRef.current = current;
    setCapturedPhotos(current);

    setLivePhotos((prev) => {
      const next = [...prev];
      while (next.length < totalShotsRequired) next.push(null);
      next[indexToRemove] = null;
      return next;
    });

    // 2. Ensure auto-taking sequence is active and does NOT stop
    isAutoSequenceRef.current = true;

    // 3. If currently capturing/counting down, do NOT stop!
    // Simply update currentShotIndex to the top empty slot so UI highlights it
    if (countdownIntervalRef.current) {
      const topEmpty = current.findIndex((p) => !p);
      if (topEmpty !== -1) {
        setCurrentShotIndex(topEmpty);
      }
    } else if (!isCapturing) {
      // If camera was idle / stopped, immediately start auto-taking for the top empty slot
      clearAllActiveTimers();
      const topEmpty = current.findIndex((p) => !p);
      const slotToTake = topEmpty !== -1 ? topEmpty : indexToRemove;
      runUniversalCapture(slotToTake, true);
    }
  };

  // Confirm Frame Adjustments & Open Consent Modal
  const handleConfirmFrame = () => {
    setCurrentStep('CONSENT_MODAL');
  };

  // Finalize Session, Render Strip, Trigger DNP Spooler, & Save to Cloud
  const handleFinalizeSession = async (consent: SocialConsent) => {
    setSocialConsent(consent);
    setCurrentStep('RESULT_QR');
    setIsProcessing(true);

    try {
      const validPhotos = capturedPhotos.map((p) => p || '');
      const compositeUrl = await renderCustomFrameSlotComposite(
        validPhotos,
        selectedTemplate,
        slotAdjustments,
        settings.eventName,
        settings.eventDate
      );

      const sessionId = 'session_' + Math.random().toString(36).substring(2, 9);
      const session: PhotoSession = {
        id: sessionId,
        createdAt: Date.now(),
        eventId: settings.eventName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        packageId: selectedPackage.id,
        rawPhotos: validPhotos,
        livePhotos: livePhotos.filter((lp): lp is LivePhotoMedia => Boolean(lp)),
        compositeUrl,
        layout: selectedTemplate.layout,
        filter: settings.selectedFilter,
        themeId: selectedTemplate.id,
        selectedTemplateId: selectedTemplate.id,
        payment: paymentDetails || {
          method: 'cash_bypass',
          amount: selectedPackage.price,
          transactionId: 'DIRECT_' + sessionId,
          status: 'settled',
        },
        consent,
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
        printStatus: 'queued',
      };

      // 1. Spool to local DNP printer daemon if enabled
      if (settings.printEnabled && settings.hardwareDaemonUrl) {
        fetch(`${settings.hardwareDaemonUrl}/printer/print`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kiosk_id: 'kiosk-01',
            image_url_or_base64: compositeUrl,
            copies: selectedPackage.physicalPrintsCount + extraPrintsCount,
            layout: selectedTemplate.category === 'strip' ? 'strip-2x6' : 'photo-4x6',
          }),
        }).catch((e) => console.warn('Local DNP spooler unreachable:', e));
      }

      // 2. Save session to Cloud Storage & Firestore
      const result = await savePhotoSession(session);
      setCurrentSession(session);
      setGuestUrl(result.guestUrl);

      if (settings.playAudioCues) {
        photoboothAudio.playSuccessChime();
      }
    } catch (err) {
      console.error('Finalize session error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetKiosk = () => {
    clearAllActiveTimers();
    setCurrentStep('WELCOME');
    allowedRetakeSlotRef.current = null;
    setAllowedRetakeSlot(null);
    const emptyArr = Array(totalShotsRequired).fill(null);
    capturedPhotosRef.current = emptyArr;
    setCapturedPhotos(emptyArr);
    setLivePhotos(Array(totalShotsRequired).fill(null));
    setCurrentShotIndex(0);
    setIsCapturing(false);
    setCountdown(null);
    setCurrentSession(null);
    setSlotAdjustments({});
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between p-4 md:p-6 select-none relative overflow-hidden">

      {/* Top Bar Navigation */}
      <header className="flex items-center justify-between gap-4 max-w-7xl mx-auto w-full z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 via-rose-500 to-yellow-400 flex items-center justify-center shadow-lg shadow-pink-500/25">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              QuickPic Enterprise Photobooth
            </h1>
            <p className="text-xs text-pink-400 font-medium">
              {settings.eventName} &bull; {selectedPackage.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
          >
            Admin Dashboard
          </Link>
          <Link
            href="/admin/devices"
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
          >
            Hardware Monitor
          </Link>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition"
          >
            <Maximize className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* STEP 1: WELCOME SCREEN */}
      {currentStep === 'WELCOME' && (
        <section className="flex-1 flex flex-col items-center justify-center text-center p-6 z-10 animate-fade-in">
          {/* Brand Logo Container */}
          <div className="relative group mb-8">
            <div className="w-32 h-32 rounded-3xl bg-gradient-to-tr from-pink-500 via-rose-500 to-yellow-400 p-1 shadow-2xl shadow-pink-500/30">
              <div className="w-full h-full bg-zinc-950 rounded-[22px] flex items-center justify-center">
                <Camera className="w-16 h-16 text-pink-500 animate-pulse" />
              </div>
            </div>
          </div>

          <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight mb-4">
            Capture Your Magic
          </h2>
          <p className="text-zinc-400 text-base md:text-lg max-w-md mb-10">
            High-res studio DSLR snapshots, 5-second Live Photo Boomerangs, and instant DNP dye-sub prints.
          </p>

          <button
            onClick={() => setCurrentStep('PACKAGE_PAYMENT')}
            className="px-12 py-6 rounded-3xl bg-gradient-to-r from-pink-500 via-rose-500 to-yellow-400 hover:brightness-110 text-white font-black text-2xl uppercase tracking-wider shadow-2xl shadow-pink-500/30 ring-4 ring-pink-500/20 active:scale-95 transition-all duration-300 animate-pulse flex items-center gap-3"
          >
            <Sparkles className="w-7 h-7 text-yellow-200" />
            Touch Screen to Start
          </button>
        </section>
      )}

      {/* STEP 2: CAMERA SESSION */}
      {currentStep === 'CAMERA_SESSION' && (
        <section className="flex-1 max-w-7xl mx-auto w-full flex flex-col lg:flex-row items-center justify-center gap-6 my-4 z-10 animate-fade-in">

          <div className="relative w-full max-w-4xl aspect-4/3 flex items-center justify-center">
            <CameraViewfinder
              countdown={countdown}
              isCapturing={isCapturing}
              filter={settings.selectedFilter}
              mirror={settings.mirrorCamera}
              playAudio={settings.playAudioCues}
              onToggleAudio={() => setSettings((s) => ({ ...s, playAudioCues: !s.playAudioCues }))}
            />

            {/* Mirror Toggle Button */}
            <button
              onClick={() => setSettings((s) => ({ ...s, mirrorCamera: !s.mirrorCamera }))}
              className="absolute top-4 left-4 z-20 px-3.5 py-1.5 rounded-full bg-zinc-900/80 backdrop-blur-md border border-zinc-700 text-xs font-semibold text-zinc-300 hover:text-white transition"
            >
              {settings.mirrorCamera ? 'Mirror: ON' : 'Mirror: OFF'}
            </button>

            {/* Sequence Status */}
            {isCapturing && (
              <div className="absolute top-4 right-16 z-20 px-4 py-1.5 rounded-full bg-pink-500 text-white text-xs font-black uppercase tracking-wider shadow-lg">
                Pose {(earliestEmptySlot !== -1 ? earliestEmptySlot : currentShotIndex) + 1} of {totalShotsRequired}
              </div>
            )}
          </div>

          {/* Captured Photos Strip & Action Control Column */}
          <div className="flex flex-col items-center gap-3 w-full lg:w-auto">
            <div className="flex lg:flex-col items-center gap-3 p-3 bg-zinc-900/90 border border-zinc-800 rounded-3xl shadow-xl">
              <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider text-center hidden lg:block mb-1">
                Your Poses ({filledPhotosCount}/{totalShotsRequired})
              </div>
              {Array.from({ length: totalShotsRequired }).map((_, idx) => {
                const photo = capturedPhotos[idx];
                // Highlight glow is on the earliest order of the empty slot!
                const isHighlightSlot = isCapturing && earliestEmptySlot === idx;

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (!photo && !isCapturing) {
                        triggerUniversalCapture(idx);
                      }
                    }}
                    className={`group relative w-24 h-20 lg:w-28 lg:h-22 rounded-2xl overflow-hidden border-2 flex flex-col items-center justify-between bg-zinc-950 transition-all ${isHighlightSlot
                      ? 'border-pink-500 ring-4 ring-pink-500/40 scale-105 shadow-xl shadow-pink-500/25'
                      : photo
                        ? 'border-zinc-700 hover:border-pink-400'
                        : 'border-zinc-800 hover:border-zinc-700 cursor-pointer'
                      }`}
                  >
                    {photo ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo} alt={`Pose ${idx + 1}`} className="w-full h-full object-cover" />

                        {/* Pose Number Badge */}
                        <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-bold text-white backdrop-blur-xs">
                          #{idx + 1}
                        </span>

                        {/* Cross button appears ONLY on the allowed retake slot, and NEVER on the last picture */}
                        {!isAllShotsCompleted && idx === allowedRetakeSlot && idx < totalShotsRequired - 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemovePhoto(idx);
                            }}
                            title={`Remove Pose #${idx + 1} and retake`}
                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-2xl flex items-center justify-center transition-all duration-200 active:scale-90 z-30 ring-2 ring-black/70 animate-pulse hover:scale-115 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5 stroke-[3]" />
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 group-hover:text-pink-400 transition-colors">
                        <Camera className={`w-4 h-4 mb-1 transition-all ${isHighlightSlot ? 'text-pink-400 animate-bounce' : 'opacity-40 group-hover:opacity-80 transition-opacity'}`} />
                        <span className={`text-[11px] font-bold ${isHighlightSlot ? 'text-pink-300' : ''}`}>Pose #{idx + 1}</span>
                        <span className={`text-[9px] font-medium ${isHighlightSlot ? 'text-pink-400 font-bold' : 'text-zinc-500'}`}>
                          {isHighlightSlot ? 'Shooting...' : 'Empty'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Action button just below the image strip (simplified to icon) */}
            {!isCapturing && (
              <div className="w-full flex items-center justify-center">
                {filledPhotosCount === 0 ? (
                  <button
                    onClick={startCaptureSequence}
                    title={`Start Capture (${totalShotsRequired} Poses)`}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 hover:brightness-110 text-white shadow-xl shadow-pink-500/30 active:scale-95 transition flex items-center justify-center cursor-pointer group"
                  >
                    <Camera className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  </button>
                ) : isAllShotsCompleted ? (
                  <button
                    onClick={() => setCurrentStep('FRAME_EDITOR')}
                    title="Proceed to Frame Selection & Edit"
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-yellow-400 hover:brightness-110 text-white shadow-xl shadow-pink-500/30 active:scale-95 transition flex items-center justify-center cursor-pointer group"
                  >
                    <Check className="w-6 h-6 stroke-[3] group-hover:scale-110 transition-transform" />
                  </button>
                ) : (
                  <button
                    onClick={() => triggerUniversalCapture()}
                    title={`Take Pose #${earliestEmptySlot + 1}`}
                    className="w-full py-4 rounded-2xl bg-pink-500 hover:bg-pink-600 text-white shadow-lg shadow-pink-500/25 active:scale-95 transition flex items-center justify-center cursor-pointer group"
                  >
                    <Camera className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* STEP 3: INTERACTIVE FRAME & PINCH-ZOOM SLOT EDITOR */}
      {currentStep === 'FRAME_EDITOR' && (
        <FrameSlotEditor
          capturedPhotos={capturedPhotos.map((p) => p || '')}
          selectedTemplate={selectedTemplate}
          onSelectTemplate={setSelectedTemplate}
          slotAdjustments={slotAdjustments}
          onUpdateSlotAdjustment={(slotId, adj) =>
            setSlotAdjustments((prev) => ({
              ...prev,
              [slotId]: { ...(prev[slotId] || { slotId, photoIndex: 0, zoom: 1, panX: 0, panY: 0, filter: 'none' }), ...adj },
            }))
          }
          onConfirm={handleConfirmFrame}
        />
      )}

      {/* PACKAGE & PAYMENT MODAL */}
      <PackagePaymentModal
        isOpen={currentStep === 'PACKAGE_PAYMENT'}
        onPaymentSuccess={(pkg, payment, extraCopies) => {
          setSelectedPackage(pkg);
          setPaymentDetails(payment);
          setExtraPrintsCount(extraCopies);
          setCurrentStep('CAMERA_SESSION');
        }}
      />

      {/* SOCIAL MEDIA CONSENT MODAL */}
      <ConsentModal
        isOpen={currentStep === 'CONSENT_MODAL'}
        onConfirmConsent={handleFinalizeSession}
      />

      {/* RESULT & INSTANT QR SHARE MODAL */}
      <ResultModal
        session={currentSession}
        guestUrl={guestUrl}
        onReset={handleResetKiosk}
      />

      {/* BOOTH SETTINGS MODAL */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={(vals) => setSettings((s) => ({ ...s, ...vals }))}
      />
    </main>
  );
}
