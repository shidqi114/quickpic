'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, Volume2, VolumeX, VideoOff } from 'lucide-react';
import { PhotoFilter } from '@/types/photobooth';
import type { WelcomeLanguage } from '@/components/ux/WelcomeScreen';

const COPY: Record<WelcomeLanguage, {
  ready: string;
  unavailable: string;
  unavailableBody: string;
  retry: string;
  useDslr: string;
  switchTo: (model: string) => string;
  active: (model: string) => string;
  switchTitle: string;
  soundOn: string;
  soundOff: string;
  switchWebcam: string;
}> = {
  en: {
    ready: 'Get ready and smile',
    unavailable: 'Camera not available',
    unavailableBody: 'Allow camera access in your browser, or use the Canon camera.',
    retry: 'Try the webcam again',
    useDslr: 'Use Canon camera',
    switchTo: (model) => `Switch to ${model}`,
    active: (model) => `${model} (on)`,
    switchTitle: 'Click to switch between the Canon camera and the webcam',
    soundOn: 'Sound on',
    soundOff: 'Sound off',
    switchWebcam: 'Switch webcam',
  },
  id: {
    ready: 'Siap-siap dan senyum',
    unavailable: 'Kamera tidak tersedia',
    unavailableBody: 'Izinkan akses kamera di browser, atau gunakan kamera Canon.',
    retry: 'Coba webcam lagi',
    useDslr: 'Pakai kamera Canon',
    switchTo: (model) => `Ganti ke ${model}`,
    active: (model) => `${model} (aktif)`,
    switchTitle: 'Klik untuk berganti antara kamera Canon dan webcam',
    soundOn: 'Suara nyala',
    soundOff: 'Suara mati',
    switchWebcam: 'Ganti webcam',
  },
};

interface CameraViewfinderProps {
  language?: WelcomeLanguage;
  countdown: number | null;
  isCapturing: boolean;
  filter: PhotoFilter;
  mirror: boolean;
  onFrameCaptureReady?: (videoEl: HTMLVideoElement) => void;
  playAudio: boolean;
  onToggleAudio: () => void;
}

export const CameraViewfinder: React.FC<CameraViewfinderProps> = ({
  language = 'en',
  countdown,
  isCapturing,
  filter,
  mirror,
  playAudio,
  onToggleAudio,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [dslrAvailable, setDslrAvailable] = useState(false);
  const [dslrModel, setDslrModel] = useState<string>('Canon DSLR');
  const [useDslrStream, setUseDslrStream] = useState(false);

  // Poll for local hardware companion daemon Canon DSLR connection
  useEffect(() => {
    let active = true;
    async function checkDSLR() {
      try {
        const res = await fetch('http://localhost:8000/camera/status', { signal: AbortSignal.timeout(1500) });
        if (res.ok) {
          const data = await res.json();
          if (active && data.connected) {
            setDslrAvailable(true);
            setDslrModel(data.model || 'Canon DSLR');
            return;
          }
        }
      } catch {
        // Daemon offline or no DSLR
      }
      if (active) {
        setDslrAvailable(false);
      }
    }

    checkDSLR();
    const interval = setInterval(checkDSLR, 4000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Initialize Camera
  useEffect(() => {
    let isCancelled = false;
    let currentStream: MediaStream | null = null;

    async function initCamera() {
      try {
        setCameraError(null);

        // Fallback camera constraints for broad webcam compatibility
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: selectedDeviceId
            ? { deviceId: { exact: selectedDeviceId } }
            : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        currentStream = stream;

        // Populate device list once permissions are granted
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const allDevices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = allDevices.filter((d) => d.kind === 'videoinput');
          if (!isCancelled) {
            setDevices(videoInputs);
          }
        }

        const video = videoRef.current;
        if (video && !isCancelled) {
          video.srcObject = stream;
          video.onloadedmetadata = () => {
            if (!isCancelled && videoRef.current) {
              videoRef.current.play().catch((e) => {
                // Ignore benign play interruptions on rapid re-render
                if (e.name !== 'AbortError') {
                  console.warn('Video playback warning:', e);
                }
              });
              setCameraReady(true);
            }
          };
        }
      } catch (err: unknown) {
        if (isCancelled) return;
        const errObj = err as Error;
        // Ignore benign AbortError during component unmount / remount
        if (errObj?.name === 'AbortError') return;

        console.error('Camera stream error:', err);
        const errMsg = errObj?.message || 'Unable to access camera';
        setCameraError(errMsg);
        setCameraReady(false);
      }
    }

    if (typeof window !== 'undefined' && navigator.mediaDevices) {
      initCamera();
    } else {
      setCameraError('Camera API not supported by this browser');
    }

    return () => {
      isCancelled = true;
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [selectedDeviceId]);

  // Flash trigger when countdown hits 0
  useEffect(() => {
    if (countdown === 0) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 450);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // CSS Filter simulation on live preview
  const getFilterStyle = (f: PhotoFilter): React.CSSProperties => {
    switch (f) {
      case 'bw':
        return { filter: 'grayscale(100%) contrast(120%)' };
      case 'sepia':
        return { filter: 'sepia(85%) contrast(105%)' };
      case 'warm':
        return { filter: 'sepia(30%) saturate(140%) brightness(105%)' };
      case 'cold':
        return { filter: 'hue-rotate(190deg) saturate(110%)' };
      case 'vintage':
        return { filter: 'sepia(45%) contrast(90%) brightness(110%)' };
      case 'cyberpunk':
        return { filter: 'contrast(130%) saturate(160%) hue-rotate(-20deg)' };
      default:
        return {};
    }
  };

  const switchCamera = () => {
    if (devices.length < 2) return;
    const currentIndex = devices.findIndex((d) => d.deviceId === selectedDeviceId);
    const nextIndex = (currentIndex + 1) % devices.length;
    setSelectedDeviceId(devices[nextIndex].deviceId);
  };

  const copy = COPY[language];
  return (
    <div className="relative w-full h-full flex items-center justify-center bg-stage overflow-hidden">
      {useDslrStream ? (
        <img
          id="dslr-liveview-stream"
          src="http://localhost:8000/camera/stream"
          alt="Canon camera live view"
          className="w-full h-full object-cover"
          style={{ transform: mirror ? 'scaleX(-1)' : 'none', ...getFilterStyle(filter) }}
          onError={() => setUseDslrStream(false)}
        />
      ) : (
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="w-full h-full object-cover"
          style={{ transform: mirror ? 'scaleX(-1)' : 'none', ...getFilterStyle(filter) }}
        />
      )}

      {flash && <div className="absolute inset-0 bg-white z-50 animate-flash pointer-events-none" />}

      {countdown !== null && countdown > 0 && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/35">
          <div className="bg-stage px-10 pt-4 pb-6 text-white text-[clamp(120px,16vw,240px)] leading-none font-semibold tracking-[-0.04em] tabular-nums select-none">
            {countdown}
          </div>
          <p className="mt-6 text-white text-[clamp(18px,1.6vw,28px)] font-medium bg-stage px-5 py-2">{copy.ready}</p>
        </div>
      )}

      {cameraError && !useDslrStream && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-stage p-8 text-center z-30 gap-5">
          <VideoOff className="w-14 h-14 text-stage-muted" />
          <h3 className="text-[clamp(24px,2.4vw,40px)] font-semibold text-white">{copy.unavailable}</h3>
          <p className="text-stage-muted max-w-md text-[18px] leading-normal">{copy.unavailableBody}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedDeviceId('')}
              className="h-14 px-6 rounded bg-accent hover:bg-accent-press text-white text-[18px] font-medium cursor-pointer"
            >
              {copy.retry}
            </button>
            {dslrAvailable && (
              <button
                type="button"
                onClick={() => setUseDslrStream(true)}
                className="h-14 px-6 rounded border border-stage-muted/50 text-white text-[18px] font-medium cursor-pointer hover:bg-white/10"
              >
                {copy.useDslr}
              </button>
            )}
          </div>
        </div>
      )}

      {dslrAvailable && (
        <div className="absolute top-4 left-4 z-20">
          <button
            type="button"
            onClick={() => setUseDslrStream((prev) => !prev)}
            className={`h-11 flex items-center gap-2 px-4 rounded text-[16px] font-medium cursor-pointer border ${
              useDslrStream ? 'bg-accent border-transparent text-white' : 'bg-stage border-stage-muted/50 text-white hover:bg-white/10'
            }`}
            title={copy.switchTitle}
          >
            <Camera className="w-4 h-4" />
            {useDslrStream ? copy.active(dslrModel) : copy.switchTo(dslrModel)}
          </button>
        </div>
      )}

      <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
        {!useDslrStream && devices.length > 1 && (
          <button
            type="button"
            onClick={switchCamera}
            title={copy.switchWebcam}
            aria-label={copy.switchWebcam}
            className="w-11 h-11 rounded bg-stage text-white border border-stage-muted/50 flex items-center justify-center cursor-pointer hover:bg-white/10"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        )}
        <button
          type="button"
          onClick={onToggleAudio}
          title={playAudio ? copy.soundOn : copy.soundOff}
          aria-label={playAudio ? copy.soundOn : copy.soundOff}
          className="w-11 h-11 rounded bg-stage text-white border border-stage-muted/50 flex items-center justify-center cursor-pointer hover:bg-white/10"
        >
          {playAudio ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5 text-stage-muted" />}
        </button>
      </div>
    </div>
  );
};
