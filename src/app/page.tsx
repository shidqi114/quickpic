'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Settings,
  Maximize,
  Sparkles,
  RefreshCw,
  Layers,
  ArrowLeft,
  Heart,
  Check,
  QrCode,
  Printer,
  Undo2,
  RotateCcw,
  X,
  Sliders,
  Play,
  Gift,
  CreditCard,
  Eye,
  Clock,
  ChevronLeft
} from 'lucide-react';
import { CameraViewfinder } from '@/components/CameraViewfinder';
import { SettingsModal } from '@/components/SettingsModal';
import { PackagePaymentModal } from '@/components/Payment/PackagePaymentModal';
import { ConsentModal } from '@/components/ConsentModal';
import { ResultModal } from '@/components/ResultModal';
import { HardwareStatusBar } from '@/components/ui/HardwareStatusBar';
import {
  OperatorSetupWizard,
  ExtendedOperatorSettings,
  OperatingMode,
} from '@/components/ux/OperatorSetupWizard';
import { WelcomeScreen } from '@/components/ux/WelcomeScreen';
import { PhotoPickSlots } from '@/components/ux/PhotoPickSlots';
import { SplitFrameEditor } from '@/components/ux/SplitFrameEditor';
import { StickerItem } from '@/components/ui/StickerCanvasLayer';
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
import {
  savePhotoSession,
  ExtendedPhotoSession,
  subscribeToAuth,
  signOutUser,
  UserProfile,
  Outlet,
} from '@/lib/firebase';
import { livePhotoRecorder } from '@/lib/livephoto';
import { sendDnpPrintJob } from '@/lib/hardware/daemon-client';
import { LoginScreen } from '@/components/ux/LoginScreen';
import Link from 'next/link';

export type KioskStep =
  | 'LOGIN'
  | 'OPERATOR_SETUP'
  | 'WELCOME'
  | 'PACKAGE_PAYMENT'
  | 'CAMERA_SESSION'
  | 'PHOTO_PICK_SLOTS'
  | 'SPLIT_FRAME_EDITOR'
  | 'CONSENT_MODAL'
  | 'RESULT_QR';

const DEFAULT_OPERATOR_SETTINGS: ExtendedOperatorSettings = {
  eventName: 'Summer Gala 2026',
  eventDate: 'OCT 2026',
  eventHashtag: '#QuickPicBooth',
  layout: 'strip-3',
  countdownSeconds: 3,
  showFlashEffect: true,
  playAudioCues: true,
  selectedFilter: 'none',
  selectedThemeId: 'classic-white',
  welcomeTheme: 'neon_cyber',
  mirrorCamera: true,
  printEnabled: true,
  hardwareDaemonUrl: 'http://localhost:8000',
  operatingMode: 'event', // Default to seamless Event mode
  activeCaptureModes: ['photo', 'boomerang'],
  delayBetweenShots: 2,
  reviewDurationSeconds: 5,
};

export default function PhotoboothKioskPage() {
  const [currentStep, setCurrentStep] = useState<KioskStep>('LOGIN');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeOutlet, setActiveOutlet] = useState<Outlet | null>(null);

  const [operatorSettings, setOperatorSettings] =
    useState<ExtendedOperatorSettings>(DEFAULT_OPERATOR_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Selected package & payment details
  const [selectedPackage, setSelectedPackage] = useState<PhotoboothPackage>(PHOTOBOOTH_PACKAGES[0]);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [extraPrintsCount, setExtraPrintsCount] = useState(0);

  // Kiosk Machine Identification (booth_id)
  const [boothId, setBoothId] = useState<string>('booth-jkt-01');

  // Firebase Auth state listener
  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
      setCurrentUser(user);
      if (user) {
        // If user is authenticated, route to Operator Setup Wizard
        setCurrentStep((prev) => (prev === 'LOGIN' ? 'OPERATOR_SETUP' : prev));
      } else {
        setCurrentStep('LOGIN');
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await signOutUser();
    setCurrentUser(null);
    setCurrentStep('LOGIN');
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedBoothId =
        localStorage.getItem('quickpic_booth_id') ||
        localStorage.getItem('booth_id') ||
        'booth-jkt-01';
      setBoothId(storedBoothId);

      const savedMode = localStorage.getItem('quickpic_operating_mode') as OperatingMode | null;
      if (savedMode) {
        setOperatorSettings((prev) => ({ ...prev, operatingMode: savedMode }));
      }
    }
  }, []);

  // Frame Template & Slot Editor state
  const [selectedTemplate, setSelectedTemplate] = useState<FrameTemplate>(FRAME_TEMPLATES[0]);
  const [slotAdjustments, setSlotAdjustments] = useState<Record<string, SlotAdjustment>>({});
  const [stickersBySlot, setStickersBySlot] = useState<Record<string, StickerItem[]>>({});

  // Camera session state
  const [isCapturing, setIsCapturing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [currentShotIndex, setCurrentShotIndex] = useState(0);

  const totalShotsRequired = selectedPackage.shotsCount || selectedTemplate.slotCount || 4;

  const [capturedPhotos, setCapturedPhotos] = useState<(string | null)[]>(() =>
    Array(totalShotsRequired).fill(null)
  );
  const capturedPhotosRef = useRef<(string | null)[]>(Array(totalShotsRequired).fill(null));
  capturedPhotosRef.current = capturedPhotos;

  const [livePhotos, setLivePhotos] = useState<(LivePhotoMedia | null)[]>(() =>
    Array(totalShotsRequired).fill(null)
  );

  // Monotonically tracked allowed retake slot
  const [allowedRetakeSlot, setAllowedRetakeSlot] = useState<number | null>(null);
  const allowedRetakeSlotRef = useRef<number | null>(null);

  // Review Duration Countdown state
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewCountdown, setReviewCountdown] = useState<number | null>(null);
  const reviewIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Consent & Output state
  const [socialConsent, setSocialConsent] = useState<SocialConsent>({ granted: false, timestamp: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentSession, setCurrentSession] = useState<PhotoSession | null>(null);
  const [guestUrl, setGuestUrl] = useState<string>('');

  // Active timers & sequence control
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sequenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isAutoSequenceRef = useRef<boolean>(false);

  // Helper to sync slot array length with required shots
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

  // Initialize default slot mapping whenever template changes
  useEffect(() => {
    setSlotAdjustments((prev) => {
      const updated = { ...prev };
      selectedTemplate.slots.forEach((slot, idx) => {
        if (!updated[slot.id]) {
          updated[slot.id] = {
            slotId: slot.id,
            photoIndex: idx % totalShotsRequired,
            zoom: 1.0,
            panX: 0,
            panY: 0,
            filter: 'none',
          };
        }
      });
      return updated;
    });
  }, [selectedTemplate, totalShotsRequired]);

  const clearAllActiveTimers = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (sequenceTimeoutRef.current) {
      clearTimeout(sequenceTimeoutRef.current);
      sequenceTimeoutRef.current = null;
    }
    if (reviewIntervalRef.current) {
      clearInterval(reviewIntervalRef.current);
      reviewIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearAllActiveTimers();
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Helper to capture single frame from video / DSLR stream
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

      if (operatorSettings.mirrorCamera) {
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

    if (operatorSettings.mirrorCamera) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.95);
  };

  const earliestEmptySlot = capturedPhotos.findIndex((p) => !p);
  const filledPhotosCount = capturedPhotos.filter((p): p is string => Boolean(p)).length;
  const isAllShotsCompleted = filledPhotosCount === totalShotsRequired;

  // Review Duration Countdown Sequence
  const startReviewDurationCountdown = () => {
    clearAllActiveTimers();
    setIsReviewing(true);
    let secondsLeft = operatorSettings.reviewDurationSeconds || 5;
    setReviewCountdown(secondsLeft);

    reviewIntervalRef.current = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft > 0) {
        setReviewCountdown(secondsLeft);
      } else {
        if (reviewIntervalRef.current) {
          clearInterval(reviewIntervalRef.current);
          reviewIntervalRef.current = null;
        }
        setIsReviewing(false);
        setReviewCountdown(null);
        // Automatically advance to Step 1 Post-Capture: Slot Mapping
        setCurrentStep('PHOTO_PICK_SLOTS');
      }
    }, 1000);
  };

  // UNIVERSAL PICTURE TAKING ENGINE
  const runUniversalCapture = (preferredSlot: number, autoAdvance: boolean) => {
    clearAllActiveTimers();
    setIsReviewing(false);
    setReviewCountdown(null);
    isAutoSequenceRef.current = autoAdvance;
    setIsCapturing(true);

    const currentRefPhotos = [...capturedPhotosRef.current];
    while (currentRefPhotos.length < totalShotsRequired) currentRefPhotos.push(null);
    const topEmpty = currentRefPhotos.findIndex((p) => !p);
    const activeSlot = topEmpty !== -1 ? topEmpty : preferredSlot;
    setCurrentShotIndex(activeSlot);

    let count = operatorSettings.countdownSeconds || 3;
    setCountdown(count);

    const video = document.querySelector('video') as HTMLVideoElement | null;
    if (video && video.srcObject) {
      livePhotoRecorder.startRecording(video.srcObject as MediaStream);
    }

    if (operatorSettings.playAudioCues) {
      photoboothAudio.playCountdownBeep(false);
    }

    countdownIntervalRef.current = setInterval(async () => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
        if (operatorSettings.playAudioCues) {
          photoboothAudio.playCountdownBeep(false);
        }
      } else if (count === 0) {
        setCountdown(0);
        if (operatorSettings.playAudioCues) {
          photoboothAudio.playShutterSound();
        }

        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }

        const newFrame = captureFrameFromVideo();
        const liveUrl = await livePhotoRecorder.stopRecording();

        const currentPhotos = [...capturedPhotosRef.current];
        while (currentPhotos.length < totalShotsRequired) currentPhotos.push(null);
        const topEmptyAfter = currentPhotos.findIndex((p) => !p);
        const destinationSlot = topEmptyAfter !== -1 ? topEmptyAfter : activeSlot;

        currentPhotos[destinationSlot] = newFrame || '';
        capturedPhotosRef.current = currentPhotos;
        setCapturedPhotos(currentPhotos);
        setCurrentShotIndex(destinationSlot);

        // Update allowed retake slot
        const nextAllowed = destinationSlot;
        allowedRetakeSlotRef.current = nextAllowed;
        setAllowedRetakeSlot(nextAllowed);

        setLivePhotos((prev) => {
          const next = [...prev];
          while (next.length < totalShotsRequired) next.push(null);
          next[destinationSlot] = {
            photoIndex: destinationSlot,
            gifUrl: liveUrl,
            durationSeconds: 5,
          };
          return next;
        });

        // 500ms post-shutter display before next shot or review countdown
        sequenceTimeoutRef.current = setTimeout(() => {
          setCountdown(null);

          const latestPhotos = [...capturedPhotosRef.current];
          const nextEmpty = latestPhotos.findIndex((p) => !p);

          if (isAutoSequenceRef.current && nextEmpty !== -1) {
            setCurrentShotIndex(nextEmpty);
            sequenceTimeoutRef.current = setTimeout(() => {
              if (isAutoSequenceRef.current) {
                runUniversalCapture(nextEmpty, true);
              }
            }, (operatorSettings.delayBetweenShots || 2) * 1000);
          } else {
            isAutoSequenceRef.current = false;
            setIsCapturing(false);

            // Check if all shots have now been taken -> trigger Review Countdown!
            const allDone = latestPhotos.filter(Boolean).length === totalShotsRequired;
            if (allDone) {
              startReviewDurationCountdown();
            }
          }
        }, 500);
      }
    }, 1000);
  };

  const triggerUniversalCapture = (specificSlot?: number) => {
    const target =
      typeof specificSlot === 'number' && specificSlot >= 0 && specificSlot < totalShotsRequired
        ? specificSlot
        : capturedPhotosRef.current.findIndex((p) => !p);

    if (target === -1) return;
    runUniversalCapture(target, true);
  };

  const startCaptureSequence = () => {
    clearAllActiveTimers();
    setIsReviewing(false);
    setReviewCountdown(null);
    allowedRetakeSlotRef.current = null;
    setAllowedRetakeSlot(null);
    const emptyArr = Array(totalShotsRequired).fill(null);
    capturedPhotosRef.current = emptyArr;
    setCapturedPhotos(emptyArr);
    setLivePhotos(Array(totalShotsRequired).fill(null));
    setCurrentShotIndex(0);
    runUniversalCapture(0, true);
  };

  // RETAKE AUTO-START:
  // When guest clicks 'X' on an image slot:
  // 1. Clear photo from slot
  // 2. Reset countdown / timers
  // 3. IMMEDIATELY auto-start countdown for earliest empty slot!
  const handleRemovePhoto = (indexToRemove: number) => {
    clearAllActiveTimers();
    setIsReviewing(false);
    setReviewCountdown(null);

    // 1. Clear slot in state & ref
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

    // 2. Determine earliest empty slot
    const topEmpty = current.findIndex((p) => !p);
    const slotToShoot = topEmpty !== -1 ? topEmpty : indexToRemove;

    // 3. Immediately auto-start countdown sequence for that slot!
    runUniversalCapture(slotToShoot, true);
  };

  // Start Kiosk Experience from Welcome Screen
  const handleStartFromWelcome = () => {
    if (operatorSettings.operatingMode === 'event') {
      // Event Mode: zero paywall gatekeeping -> bypass directly to Camera Session
      setCurrentStep('CAMERA_SESSION');
      startCaptureSequence();
    } else {
      // Regular Mode: open package & payment modal
      setCurrentStep('PACKAGE_PAYMENT');
    }
  };

  // Post-Capture Step 1: Slot Mapping updates
  const handleUpdateSlotPhoto = (slotId: string, photoIndex: number) => {
    setSlotAdjustments((prev) => ({
      ...prev,
      [slotId]: {
        ...(prev[slotId] || {
          slotId,
          photoIndex: 0,
          zoom: 1,
          panX: 0,
          panY: 0,
          filter: 'none',
        }),
        photoIndex,
      },
    }));
  };

  const handleAutoFillInOrder = () => {
    setSlotAdjustments((prev) => {
      const next = { ...prev };
      selectedTemplate.slots.forEach((slot, idx) => {
        next[slot.id] = {
          ...(next[slot.id] || {
            slotId: slot.id,
            photoIndex: 0,
            zoom: 1,
            panX: 0,
            panY: 0,
            filter: 'none',
          }),
          photoIndex: idx % capturedPhotos.length,
        };
      });
      return next;
    });
  };

  // Finalize Session, Render Strip with Filters & Stickers, Spool Print, Save Cloud
  const handleFinalizeSession = async (consent: SocialConsent) => {
    setSocialConsent(consent);
    setCurrentStep('RESULT_QR');
    setIsProcessing(true);

    try {
      const validPhotos = capturedPhotos.map((p) => p || '');
      // Merge per-slot stickers into slotAdjustments so compositor prints all placed stickers
      const mergedAdjustments: Record<string, SlotAdjustment> = {};
      selectedTemplate.slots.forEach((slot, idx) => {
        const adj = slotAdjustments[slot.id] || {
          slotId: slot.id,
          photoIndex: idx,
          zoom: 1.0,
          panX: 0,
          panY: 0,
          filter: 'none',
        };
        const slotStkList = stickersBySlot[slot.id] || [];
        mergedAdjustments[slot.id] = {
          ...adj,
          stickers: slotStkList.map((s) => ({
            id: s.id,
            emojiOrUrl: s.content || '',
            x: s.x,
            y: s.y,
            scale: s.scale,
            rotation: s.rotation,
          })),
        };
      });

      const compositeUrl = await renderCustomFrameSlotComposite(
        validPhotos,
        selectedTemplate,
        mergedAdjustments,
        operatorSettings.eventName,
        operatorSettings.eventDate
      );

      const sessionId = 'session_' + Math.random().toString(36).substring(2, 9);
      const session: ExtendedPhotoSession = {
        id: sessionId,
        createdAt: Date.now(),
        eventId: operatorSettings.eventName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        boothId: boothId,
        packageId: selectedPackage.id,
        rawPhotos: validPhotos,
        livePhotos: livePhotos.filter((lp): lp is LivePhotoMedia => Boolean(lp)),
        compositeUrl,
        layout: selectedTemplate.layout,
        filter: operatorSettings.selectedFilter,
        themeId: selectedTemplate.id,
        selectedTemplateId: selectedTemplate.id,
        payment: paymentDetails || {
          method: 'cash_bypass',
          amount: operatorSettings.operatingMode === 'event' ? 0 : selectedPackage.price,
          transactionId: 'DIRECT_' + sessionId,
          status: 'settled',
        },
        consent,
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        printStatus: 'queued',
      };

      // Spool to local DNP printer daemon if enabled
      if (operatorSettings.printEnabled) {
        await sendDnpPrintJob({
          kioskId: boothId,
          imageBase64OrUrl: compositeUrl,
          copies: selectedPackage.physicalPrintsCount + extraPrintsCount,
          layout: selectedTemplate.category === 'strip' ? 'strip-2x6' : 'photo-4x6',
        }).catch((e) => console.warn('Local DNP spooler unreachable:', e));
      }

      // Save session to Supabase database & local offline cache
      const result = await savePhotoSession(session, boothId);
      setCurrentSession(session);

      let finalGuestUrl = result.guestUrl;
      if (result.cloudinaryUrl) {
        const separator = finalGuestUrl.includes('?') ? '&' : '?';
        finalGuestUrl = `${finalGuestUrl}${separator}img=${encodeURIComponent(result.cloudinaryUrl)}`;
      } else if (compositeUrl && compositeUrl.startsWith('http')) {
        const separator = finalGuestUrl.includes('?') ? '&' : '?';
        finalGuestUrl = `${finalGuestUrl}${separator}img=${encodeURIComponent(compositeUrl)}`;
      }
      setGuestUrl(finalGuestUrl);

      if (operatorSettings.playAudioCues) {
        photoboothAudio.playSuccessChime();
      }
    } catch (err) {
      console.error('Finalize session error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualPrint = async () => {
    if (!currentSession?.compositeUrl) return;
    try {
      await sendDnpPrintJob({
        kioskId: boothId,
        imageBase64OrUrl: currentSession.compositeUrl,
        copies: 1,
        layout: selectedTemplate.category === 'strip' ? 'strip-2x6' : 'photo-4x6',
      });
      if (operatorSettings.playAudioCues) {
        photoboothAudio.playSuccessChime();
      }
    } catch (err) {
      console.warn('Manual DNP print error:', err);
    }
  };

  const handleResetKiosk = () => {
    clearAllActiveTimers();
    setCurrentStep('WELCOME');
    allowedRetakeSlotRef.current = null;
    setAllowedRetakeSlot(null);
    setIsReviewing(false);
    setReviewCountdown(null);
    const emptyArr = Array(totalShotsRequired).fill(null);
    capturedPhotosRef.current = emptyArr;
    setCapturedPhotos(emptyArr);
    setLivePhotos(Array(totalShotsRequired).fill(null));
    setCurrentShotIndex(0);
    setIsCapturing(false);
    setCountdown(null);
    setCurrentSession(null);
    setStickersBySlot({});
  };

  const handleGoBack = () => {
    if (currentStep === 'WELCOME') {
      setCurrentStep('OPERATOR_SETUP');
    } else if (currentStep === 'PACKAGE_PAYMENT') {
      setCurrentStep('WELCOME');
    } else if (currentStep === 'CAMERA_SESSION') {
      clearAllActiveTimers();
      handleResetKiosk();
      setCurrentStep('WELCOME');
    } else if (currentStep === 'PHOTO_PICK_SLOTS') {
      setCurrentStep('CAMERA_SESSION');
    } else if (currentStep === 'SPLIT_FRAME_EDITOR') {
      setCurrentStep('PHOTO_PICK_SLOTS');
    } else if (currentStep === 'CONSENT_MODAL') {
      setCurrentStep('SPLIT_FRAME_EDITOR');
    } else if (currentStep === 'RESULT_QR') {
      handleResetKiosk();
      setCurrentStep('WELCOME');
    }
  };

  if (currentStep === 'LOGIN') {
    return (
      <LoginScreen
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setCurrentStep('OPERATOR_SETUP');
        }}
      />
    );
  }

  return (
    <main className="h-screen w-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between select-none relative overflow-hidden">
      {/* Minimal Single Top-Left Back Arrow (only shown on Welcome Screen to access Operator Setup) */}
      {currentStep === 'WELCOME' && (
        <button
          onClick={handleGoBack}
          aria-label="Back"
          className="absolute top-4 left-4 z-40 p-3 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 shadow-xl backdrop-blur-md active:scale-95 transition flex items-center justify-center cursor-pointer group"
        >
          <ChevronLeft className="w-6 h-6 group-hover:-translate-x-0.5 transition-transform" />
        </button>
      )}

      {/* ========================================================================= */}
      {/* 1. OPERATOR SETUP WIZARD (Admin Interface before Welcome Screen) */}
      {/* ========================================================================= */}
      {currentStep === 'OPERATOR_SETUP' && (
        <OperatorSetupWizard
          initialSettings={operatorSettings}
          currentTemplate={selectedTemplate}
          userAccountName={currentUser?.displayName || 'Alex Pratama (Operator)'}
          outletName={activeOutlet?.name || 'Grand Indonesia - Flagship'}
          userId={currentUser?.uid || 'usr-demo-01'}
          onOutletChange={(outlet) => setActiveOutlet(outlet)}
          onSignOut={handleSignOut}
          onSaveAndLaunch={(newSettings, newTemplate) => {
            setOperatorSettings(newSettings);
            setSelectedTemplate(newTemplate);
            localStorage.setItem('quickpic_operating_mode', newSettings.operatingMode);
            setCurrentStep('WELCOME');
          }}
          onClose={() => setCurrentStep('WELCOME')}
        />
      )}

      {/* ========================================================================= */}
      {/* 2. WELCOME SCREEN (Discrete UX Component with 5 Visual Themes) */}
      {/* ========================================================================= */}
      {currentStep === 'WELCOME' && (
        <WelcomeScreen
          theme={operatorSettings.welcomeTheme || 'neon_cyber'}
          operatingMode={operatorSettings.operatingMode}
          eventName={operatorSettings.eventName}
          eventDate={operatorSettings.eventDate}
          eventHashtag={operatorSettings.eventHashtag}
          customWelcomeImageUrl={operatorSettings.customWelcomeImageUrl}
          customHeadline={operatorSettings.customWelcomeHeadline}
          onStart={handleStartFromWelcome}
        />
      )}

      {/* ========================================================================= */}
      {/* 3. CAMERA SESSION (With Retake Auto-Start & Review Duration Countdown) */}
      {/* ========================================================================= */}
      {currentStep === 'CAMERA_SESSION' && (
        <section className="flex-1 max-w-7xl mx-auto w-full flex flex-col lg:flex-row items-center justify-center gap-6 my-4 z-10 animate-fade-in">
          
          {/* Viewfinder Container */}
          <div className="relative w-full max-w-4xl aspect-4/3 flex items-center justify-center">
            <CameraViewfinder
              countdown={countdown}
              isCapturing={isCapturing}
              filter={operatorSettings.selectedFilter}
              mirror={operatorSettings.mirrorCamera}
              playAudio={operatorSettings.playAudioCues}
              onToggleAudio={() =>
                setOperatorSettings((s) => ({ ...s, playAudioCues: !s.playAudioCues }))
              }
            />

            {/* Mirror Toggle */}
            <button
              onClick={() =>
                setOperatorSettings((s) => ({ ...s, mirrorCamera: !s.mirrorCamera }))
              }
              className="absolute top-4 left-4 z-20 px-3.5 py-1.5 rounded-full bg-zinc-900/80 backdrop-blur-md border border-zinc-700 text-xs font-semibold text-zinc-300 hover:text-white transition"
            >
              {operatorSettings.mirrorCamera ? 'Mirror: ON' : 'Mirror: OFF'}
            </button>

            {/* Shooting Sequence Status */}
            {isCapturing && (
              <div className="absolute top-4 right-16 z-20 px-4 py-1.5 rounded-full bg-pink-500 text-white text-xs font-black uppercase tracking-wider shadow-lg animate-pulse">
                Pose {(earliestEmptySlot !== -1 ? earliestEmptySlot : currentShotIndex) + 1} of{' '}
                {totalShotsRequired}
              </div>
            )}

            {/* Review Duration Countdown Banner */}
            {isReviewing && reviewCountdown !== null && (
              <div className="absolute inset-x-4 bottom-6 z-30 p-4 bg-zinc-950/90 backdrop-blur-md border-2 border-yellow-400 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-yellow-400/20 text-yellow-400 flex items-center justify-center font-mono font-bold text-xl">
                    {reviewCountdown}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <Eye className="w-4 h-4 text-yellow-400" /> Reviewing your shots ({reviewCountdown}s)
                    </h4>
                    <p className="text-xs text-zinc-400">
                      Tap <span className="text-rose-400 font-bold">&apos;X&apos;</span> on any pose to retake, or tap Continue.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    clearAllActiveTimers();
                    setIsReviewing(false);
                    setCurrentStep('PHOTO_PICK_SLOTS');
                  }}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:brightness-110 text-white font-bold text-xs uppercase tracking-wider shadow-lg active:scale-95 transition"
                >
                  Continue to Frame ➔
                </button>
              </div>
            )}
          </div>

          {/* Captured Photos Strip & Retake Cross Buttons */}
          <div className="flex flex-col items-center gap-3 w-full lg:w-auto">
            <div className="flex lg:flex-col items-center gap-3 p-3 bg-zinc-900/90 border border-zinc-800 rounded-3xl shadow-xl">
              <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider text-center hidden lg:block mb-1">
                Your Poses ({filledPhotosCount}/{totalShotsRequired})
              </div>

              {Array.from({ length: totalShotsRequired }).map((_, idx) => {
                const photo = capturedPhotos[idx];
                const isHighlightSlot = isCapturing && earliestEmptySlot === idx;

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (!photo && !isCapturing) {
                        triggerUniversalCapture(idx);
                      }
                    }}
                    className={`group relative w-24 h-20 lg:w-28 lg:h-22 rounded-2xl overflow-hidden border-2 flex flex-col items-center justify-between bg-zinc-950 transition-all ${
                      isHighlightSlot
                        ? 'border-pink-500 ring-4 ring-pink-500/40 scale-105 shadow-xl shadow-pink-500/25'
                        : photo
                        ? 'border-zinc-700 hover:border-pink-400'
                        : 'border-zinc-800 hover:border-zinc-700 cursor-pointer'
                    }`}
                  >
                    {photo ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo}
                          alt={`Pose ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />

                        {/* Pose Number Badge */}
                        <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-bold text-white backdrop-blur-xs">
                          #{idx + 1}
                        </span>

                        {/* Retake Auto-Start Cross Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemovePhoto(idx);
                          }}
                          title={`Clear Pose #${idx + 1} and auto-retake`}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-2xl flex items-center justify-center transition-all duration-200 active:scale-90 z-30 ring-2 ring-black/70 animate-pulse hover:scale-115 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5 stroke-[3]" />
                        </button>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 group-hover:text-pink-400 transition-colors">
                        <Camera
                          className={`w-4 h-4 mb-1 transition-all ${
                            isHighlightSlot
                              ? 'text-pink-400 animate-bounce'
                              : 'opacity-40 group-hover:opacity-80'
                          }`}
                        />
                        <span
                          className={`text-[11px] font-bold ${
                            isHighlightSlot ? 'text-pink-300' : ''
                          }`}
                        >
                          Pose #{idx + 1}
                        </span>
                        <span
                          className={`text-[9px] font-medium ${
                            isHighlightSlot ? 'text-pink-400 font-bold' : 'text-zinc-500'
                          }`}
                        >
                          {isHighlightSlot ? 'Shooting...' : 'Empty'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Action Button Below Strip */}
            {!isCapturing && !isReviewing && (
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
                    onClick={() => setCurrentStep('PHOTO_PICK_SLOTS')}
                    title="Proceed to Step 1: Assign Slots"
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

      {/* ========================================================================= */}
      {/* 4. POST-CAPTURE STEP 1: PHOTO PICK SLOTS */}
      {/* ========================================================================= */}
      {currentStep === 'PHOTO_PICK_SLOTS' && (
        <PhotoPickSlots
          capturedPhotos={capturedPhotos.map((p) => p || '')}
          template={selectedTemplate}
          onSelectTemplate={setSelectedTemplate}
          slotAdjustments={slotAdjustments}
          onUpdateSlotPhoto={handleUpdateSlotPhoto}
          onAutoFillInOrder={handleAutoFillInOrder}
          eventName={operatorSettings.eventName}
          eventDate={operatorSettings.eventDate}
          onProceedToEditor={() => setCurrentStep('SPLIT_FRAME_EDITOR')}
          onBackToCamera={() => setCurrentStep('CAMERA_SESSION')}
        />
      )}

      {/* ========================================================================= */}
      {/* 5. POST-CAPTURE STEP 2: 35/65 UNEVEN SPLIT-SCREEN EDITOR */}
      {/* ========================================================================= */}
      {currentStep === 'SPLIT_FRAME_EDITOR' && (
        <SplitFrameEditor
          capturedPhotos={capturedPhotos.map((p) => p || '')}
          selectedTemplate={selectedTemplate}
          slotAdjustments={slotAdjustments}
          onUpdateSlotAdjustment={(slotId, adj) =>
            setSlotAdjustments((prev) => ({
              ...prev,
              [slotId]: {
                ...(prev[slotId] || {
                  slotId,
                  photoIndex: 0,
                  zoom: 1,
                  panX: 0,
                  panY: 0,
                  filter: 'none',
                }),
                ...adj,
              },
            }))
          }
          stickersBySlot={stickersBySlot}
          onUpdateSlotStickers={(slotId, stickers) =>
            setStickersBySlot((prev) => ({ ...prev, [slotId]: stickers }))
          }
          eventName={operatorSettings.eventName}
          eventDate={operatorSettings.eventDate}
          onBackToStep1={() => setCurrentStep('PHOTO_PICK_SLOTS')}
          onConfirm={() => setCurrentStep('CONSENT_MODAL')}
        />
      )}

      {/* ========================================================================= */}
      {/* PACKAGE & PAYMENT MODAL (Only when Operating Mode === 'regular') */}
      {/* ========================================================================= */}
      <PackagePaymentModal
        isOpen={currentStep === 'PACKAGE_PAYMENT'}
        onPaymentSuccess={(pkg, payment, extraCopies) => {
          setSelectedPackage(pkg);
          setPaymentDetails(payment);
          setExtraPrintsCount(extraCopies);
          setCurrentStep('CAMERA_SESSION');
          startCaptureSequence();
        }}
      />

      {/* ========================================================================= */}
      {/* SOCIAL MEDIA CONSENT MODAL */}
      {/* ========================================================================= */}
      <ConsentModal
        isOpen={currentStep === 'CONSENT_MODAL'}
        onConfirmConsent={handleFinalizeSession}
      />

      {/* ========================================================================= */}
      {/* 6. RESULT & INSTANT QR SHARE MODAL */}
      {/* ========================================================================= */}
      <ResultModal
        session={currentSession}
        guestUrl={guestUrl}
        onReset={handleResetKiosk}
        onPrint={handleManualPrint}
      />

      {/* BOOTH SETTINGS MODAL */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={operatorSettings}
        onUpdateSettings={(vals) =>
          setOperatorSettings((s) => ({ ...s, ...vals }))
        }
      />
    </main>
  );
}
