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
import { WelcomeScreen, WelcomeLanguage } from '@/components/ux/WelcomeScreen';
import { CameraSessionPanel } from '@/components/ux/CameraSessionPanel';
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
  const [guestLanguage, setGuestLanguage] = useState<WelcomeLanguage>('en');
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
          language={guestLanguage}
          onLanguageChange={setGuestLanguage}
          onStart={handleStartFromWelcome}
        />
      )}

      {/* ========================================================================= */}
      {/* 3. CAMERA SESSION (With Retake Auto-Start & Review Duration Countdown) */}
      {/* ========================================================================= */}
      {currentStep === 'CAMERA_SESSION' && (
        <CameraSessionPanel
          language={guestLanguage}
          countdown={countdown}
          isCapturing={isCapturing}
          isReviewing={isReviewing}
          reviewCountdown={reviewCountdown}
          filter={operatorSettings.selectedFilter}
          mirror={operatorSettings.mirrorCamera}
          playAudio={operatorSettings.playAudioCues}
          capturedPhotos={capturedPhotos}
          totalShots={totalShotsRequired}
          currentShotIndex={currentShotIndex}
          earliestEmptySlot={earliestEmptySlot}
          filledCount={filledPhotosCount}
          allShotsCompleted={isAllShotsCompleted}
          onToggleAudio={() => setOperatorSettings((s) => ({ ...s, playAudioCues: !s.playAudioCues }))}
          onToggleMirror={() => setOperatorSettings((s) => ({ ...s, mirrorCamera: !s.mirrorCamera }))}
          onStart={startCaptureSequence}
          onTakeNext={() => triggerUniversalCapture()}
          onTakeSlot={(idx) => triggerUniversalCapture(idx)}
          onRemovePhoto={handleRemovePhoto}
          onProceed={() => setCurrentStep('PHOTO_PICK_SLOTS')}
          onContinueReview={() => {
            clearAllActiveTimers();
            setIsReviewing(false);
            setCurrentStep('PHOTO_PICK_SLOTS');
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* 4. POST-CAPTURE STEP 1: PHOTO PICK SLOTS */}
      {/* ========================================================================= */}
      {currentStep === 'PHOTO_PICK_SLOTS' && (
        <PhotoPickSlots
          language={guestLanguage}
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
          language={guestLanguage}
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
        language={guestLanguage}
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
