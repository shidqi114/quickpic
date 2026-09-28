'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Camera, Settings, Maximize, Sparkles, Image as ImageIcon, Layers, RefreshCw } from 'lucide-react';
import { CameraViewfinder } from '@/components/CameraViewfinder';
import { SettingsModal } from '@/components/SettingsModal';
import { ResultModal } from '@/components/ResultModal';
import { BoothSettings, PhotoFilter, PhotoSession } from '@/types/photobooth';
import { FRAME_THEMES, renderPhotoComposite } from '@/lib/compositor';
import { photoboothAudio } from '@/lib/audio';
import { savePhotoSession } from '@/lib/firebase';
import Link from 'next/link';

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
};

export default function PhotoboothPage() {
  const [settings, setSettings] = useState<BoothSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Photobooth state machine
  const [isCapturing, setIsCapturing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [currentShotIndex, setCurrentShotIndex] = useState(0);
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentSession, setCurrentSession] = useState<PhotoSession | null>(null);
  const [guestUrl, setGuestUrl] = useState<string>('');

  // Number of shots required for current layout
  const getRequiredShotCount = () => {
    switch (settings.layout) {
      case 'strip-3':
        return 3;
      case 'strip-4':
      case 'grid-2x2':
        return 4;
      case 'single':
      default:
        return 1;
    }
  };

  const totalShots = getRequiredShotCount();

  // Trigger Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Capture single frame from the live video feed
  const captureFrameFromVideo = (): string | null => {
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

  // Start capture sequence
  const startCaptureSequence = () => {
    if (isCapturing || isProcessing) return;
    setCapturedPhotos([]);
    setCurrentShotIndex(0);
    setIsCapturing(true);
    runShotCountdown(0, []);
  };

  // Countdown runner
  const runShotCountdown = (shotIdx: number, accumulatedShots: string[]) => {
    let count = settings.countdownSeconds;
    setCountdown(count);
    if (settings.playAudioCues) {
      photoboothAudio.playCountdownBeep(false);
    }

    const interval = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
        if (settings.playAudioCues) {
          photoboothAudio.playCountdownBeep(false);
        }
      } else if (count === 0) {
        // Flash & Shutter
        setCountdown(0);
        if (settings.playAudioCues) {
          photoboothAudio.playShutterSound();
        }

        // Snap photo
        const frameData = captureFrameFromVideo();
        const nextPhotos = [...accumulatedShots, frameData || ''];
        setCapturedPhotos(nextPhotos);

        clearInterval(interval);

        // Next shot or Finish
        setTimeout(() => {
          setCountdown(null);
          if (shotIdx + 1 < totalShots) {
            setCurrentShotIndex(shotIdx + 1);
            setTimeout(() => {
              runShotCountdown(shotIdx + 1, nextPhotos);
            }, 1000); // 1 sec pause between shots
          } else {
            // Sequence completed
            finishSession(nextPhotos);
          }
        }, 500);
      }
    }, 1000);
  };

  // Finish session, render strip, and save to Firebase/Storage
  const finishSession = async (photos: string[]) => {
    setIsCapturing(false);
    setIsProcessing(true);

    try {
      const selectedTheme = FRAME_THEMES.find((t) => t.id === settings.selectedThemeId) || FRAME_THEMES[0];
      const compositeUrl = await renderPhotoComposite(photos, settings, selectedTheme);

      const sessionId = 'snap_' + Math.random().toString(36).substring(2, 9);
      const session: PhotoSession = {
        id: sessionId,
        createdAt: Date.now(),
        eventId: settings.eventName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        rawPhotos: photos,
        compositeUrl,
        layout: settings.layout,
        filter: settings.selectedFilter,
        themeId: settings.selectedThemeId,
      };

      const result = await savePhotoSession(session);
      setCurrentSession(session);
      setGuestUrl(result.guestUrl);

      if (settings.playAudioCues) {
        photoboothAudio.playSuccessChime();
      }
    } catch (err) {
      console.error('Failed to render or save photobooth strip:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setCurrentSession(null);
    setCapturedPhotos([]);
    setCurrentShotIndex(0);
    setIsCapturing(false);
    setIsProcessing(false);
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between p-4 md:p-6 select-none">
      
      {/* Top Bar / Navigation */}
      <header className="flex items-center justify-between gap-4 max-w-7xl mx-auto w-full z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 via-rose-500 to-yellow-400 flex items-center justify-center shadow-lg shadow-pink-500/25">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              QuickPic Photobooth
            </h1>
            <p className="text-xs text-pink-400 font-medium">
              {settings.eventName} &bull; {settings.layout.toUpperCase()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
          >
            Dashboard
          </Link>
          <Link
            href="/live"
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
          >
            Live Wall
          </Link>
          <button
            onClick={() => setIsSettingsOpen(true)}
            title="Booth Settings"
            className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button
            onClick={toggleFullscreen}
            title="Toggle Kiosk Fullscreen"
            className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <Maximize className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Viewfinder & Strip Progression Container */}
      <section className="flex-1 max-w-7xl mx-auto w-full flex flex-col lg:flex-row items-center justify-center gap-6 my-4">
        
        {/* Viewfinder Centerpiece */}
        <div className="relative w-full max-w-4xl aspect-4/3 flex items-center justify-center">
          <CameraViewfinder
            countdown={countdown}
            isCapturing={isCapturing}
            filter={settings.selectedFilter}
            mirror={settings.mirrorCamera}
            playAudio={settings.playAudioCues}
            onToggleAudio={() => setSettings((s) => ({ ...s, playAudioCues: !s.playAudioCues }))}
          />

          {/* Sequence Progress Pill Overlay */}
          {isCapturing && (
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900/90 backdrop-blur-md border border-pink-500/40 text-pink-300 text-xs font-bold tracking-wide uppercase shadow-lg">
              <span className="w-2 h-2 rounded-full bg-pink-500 animate-ping" />
              Shot {currentShotIndex + 1} of {totalShots}
            </div>
          )}

          {/* Processing Loading Overlay */}
          {isProcessing && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-md rounded-3xl">
              <RefreshCw className="w-12 h-12 text-pink-500 animate-spin mb-4" />
              <h3 className="text-xl font-bold text-white">Stitching Your Strip...</h3>
              <p className="text-sm text-zinc-400 mt-1">Applying filters & generating QR code</p>
            </div>
          )}
        </div>

        {/* Live Shot Thumbnails Strip (Right on desktop, bottom on mobile) */}
        <div className="flex lg:flex-col items-center gap-3 p-3 bg-zinc-900/60 backdrop-blur-xs border border-zinc-800/80 rounded-2xl">
          {Array.from({ length: totalShots }).map((_, idx) => {
            const photo = capturedPhotos[idx];
            const isCurrent = isCapturing && currentShotIndex === idx;

            return (
              <div
                key={idx}
                className={`relative w-20 h-16 lg:w-24 lg:h-18 rounded-xl overflow-hidden border-2 transition-all flex items-center justify-center bg-zinc-950 ${
                  isCurrent
                    ? 'border-pink-500 ring-4 ring-pink-500/20 scale-105'
                    : photo
                    ? 'border-zinc-600'
                    : 'border-zinc-800/80'
                }`}
              >
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt={`Shot ${idx + 1}`} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-semibold text-zinc-600">#{idx + 1}</span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Bottom Action & Filter Bar */}
      <footer className="max-w-4xl mx-auto w-full flex flex-col items-center gap-4 z-10">
        
        {/* Filter Selection Chips */}
        {!isCapturing && !isProcessing && (
          <div className="flex items-center gap-2 overflow-x-auto max-w-full py-1 px-2">
            {[
              { id: 'none', label: 'Normal' },
              { id: 'bw', label: 'B&W' },
              { id: 'warm', label: 'Warm' },
              { id: 'vintage', label: 'Vintage' },
              { id: 'sepia', label: 'Sepia' },
              { id: 'cyberpunk', label: 'Cyber' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setSettings((s) => ({ ...s, selectedFilter: f.id as PhotoFilter }))}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition ${
                  settings.selectedFilter === f.id
                    ? 'bg-pink-500 text-white shadow-md shadow-pink-500/30'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* Big Touch-to-Start Button */}
        <div className="flex items-center justify-center w-full">
          <button
            disabled={isCapturing || isProcessing}
            onClick={startCaptureSequence}
            className={`group relative flex items-center justify-center gap-3 px-10 py-5 rounded-3xl font-extrabold text-xl tracking-wide uppercase transition-all duration-300 shadow-2xl active:scale-95 ${
              isCapturing || isProcessing
                ? 'opacity-50 cursor-not-allowed bg-zinc-800 text-zinc-500'
                : 'bg-gradient-to-r from-pink-500 via-rose-500 to-yellow-400 hover:brightness-110 text-white shadow-pink-500/30 ring-4 ring-pink-500/20 animate-pulse'
            }`}
          >
            <Sparkles className="w-6 h-6 text-yellow-200 group-hover:rotate-12 transition transform" />
            {isCapturing ? `Capturing Shot ${currentShotIndex + 1}...` : 'Touch to Start'}
          </button>
        </div>
      </footer>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={(newVals) => setSettings((s) => ({ ...s, ...newVals }))}
      />

      {/* Result & Instant QR Share Modal */}
      <ResultModal
        session={currentSession}
        guestUrl={guestUrl}
        onReset={handleReset}
      />
    </main>
  );
}
