'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, Volume2, VolumeX, Sparkles, VideoOff } from 'lucide-react';
import { PhotoFilter } from '@/types/photobooth';

interface CameraViewfinderProps {
  countdown: number | null;
  isCapturing: boolean;
  filter: PhotoFilter;
  mirror: boolean;
  onFrameCaptureReady?: (videoEl: HTMLVideoElement) => void;
  playAudio: boolean;
  onToggleAudio: () => void;
}

export const CameraViewfinder: React.FC<CameraViewfinderProps> = ({
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

  // Initialize Camera
  useEffect(() => {
    let currentStream: MediaStream | null = null;

    async function initCamera() {
      try {
        setCameraError(null);
        // List media devices
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const allDevices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = allDevices.filter((d) => d.kind === 'videoinput');
          setDevices(videoInputs);
          if (!selectedDeviceId && videoInputs.length > 0) {
            setSelectedDeviceId(videoInputs[0].deviceId);
          }
        }

        const constraints: MediaStreamConstraints = {
          audio: false,
          video: selectedDeviceId
            ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1920 }, height: { ideal: 1440 } }
            : { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1440 } },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        currentStream = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
        }
      } catch (err: unknown) {
        console.error('Camera stream error:', err);
        const errMsg = err instanceof Error ? err.message : 'Unable to access camera';
        setCameraError(errMsg);
        setCameraReady(false);
      }
    }

    initCamera();

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
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

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black/90 overflow-hidden rounded-3xl border border-zinc-800 shadow-2xl">
      {/* Live Video Element */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="w-full h-full object-cover transition-all duration-300"
        style={{
          transform: mirror ? 'scaleX(-1)' : 'none',
          ...getFilterStyle(filter),
        }}
      />

      {/* Screen Flash Overlay */}
      {flash && <div className="absolute inset-0 bg-white z-50 animate-flash pointer-events-none" />}

      {/* Countdown Overlay */}
      {countdown !== null && countdown > 0 && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/40 backdrop-blur-xs">
          <div className="text-white text-9xl md:text-[14rem] font-black drop-shadow-[0_10px_25px_rgba(0,0,0,0.8)] animate-countdown select-none">
            {countdown}
          </div>
          <p className="text-pink-400 font-semibold text-xl tracking-wider uppercase mt-4 animate-pulse">
            Get Ready & Smile!
          </p>
        </div>
      )}

      {/* Camera Error Fallback */}
      {cameraError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 p-6 text-center z-30">
          <VideoOff className="w-16 h-16 text-rose-500 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Camera Unavailable</h3>
          <p className="text-zinc-400 max-w-md text-sm mb-6">
            Please allow camera permissions in your browser or connect a webcam / capture card.
          </p>
          <button
            onClick={() => setSelectedDeviceId('')}
            className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-full text-sm font-medium transition"
          >
            <RefreshCw className="w-4 h-4" /> Retry Camera
          </button>
        </div>
      )}

      {/* Top Camera Controls Overlay */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
        {devices.length > 1 && (
          <button
            onClick={switchCamera}
            title="Switch Camera"
            className="p-3 rounded-full bg-zinc-900/80 backdrop-blur-md text-zinc-300 hover:text-white hover:bg-zinc-800 transition shadow-lg border border-zinc-700/50"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        )}
        <button
          onClick={onToggleAudio}
          title={playAudio ? 'Sound On' : 'Mute Sound'}
          className="p-3 rounded-full bg-zinc-900/80 backdrop-blur-md text-zinc-300 hover:text-white hover:bg-zinc-800 transition shadow-lg border border-zinc-700/50"
        >
          {playAudio ? <Volume2 className="w-5 h-5 text-pink-400" /> : <VolumeX className="w-5 h-5 text-zinc-500" />}
        </button>
      </div>

      {/* Bottom Live Filter Badge */}
      {filter !== 'none' && (
        <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900/80 backdrop-blur-md text-xs font-medium text-pink-300 border border-pink-500/30">
          <Sparkles className="w-3.5 h-3.5" />
          Filter: {filter.toUpperCase()}
        </div>
      )}
    </div>
  );
};
