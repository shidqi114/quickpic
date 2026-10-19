'use client';

import React, { useEffect, useState } from 'react';
import { getRecentSessions } from '@/lib/firebase';
import { PhotoSession } from '@/types/photobooth';
import { ArrowLeft, RefreshCw, Maximize, Play, Pause } from 'lucide-react';
import Link from 'next/link';

export default function LiveSlideshowPage() {
  const [sessions, setSessions] = useState<PhotoSession[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [loading, setLoading] = useState(true);

  // Poll / fetch sessions periodically
  useEffect(() => {
    async function fetchPhotos() {
      try {
        const list = await getRecentSessions(30);
        setSessions(list);
      } catch (e) {
        console.error('Failed to fetch live photos:', e);
      } finally {
        setLoading(false);
      }
    }

    fetchPhotos();
    const interval = setInterval(fetchPhotos, 10000); // Check every 10s for new photos
    return () => clearInterval(interval);
  }, []);

  // Slideshow transition
  useEffect(() => {
    if (!isPlaying || sessions.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % sessions.length);
    }, 4500); // 4.5s per photo
    return () => clearInterval(timer);
  }, [isPlaying, sessions.length]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const currentPhoto = sessions[currentIndex];

  return (
    <main className="min-h-screen bg-stage text-stage-ink font-display flex flex-col select-none overflow-hidden">
      <header className="flex items-center justify-between gap-4 px-6 md:px-10 py-6">
        <Link href="/" className="flex items-center gap-2 h-11 px-4 rounded border border-stage-muted/50 text-[16px] text-stage-ink no-underline hover:bg-white/10">
          <ArrowLeft className="w-4 h-4" /> Back to booth
        </Link>

        <p className="text-[16px] text-stage-muted tabular-nums">
          Live from the booth · {sessions.length} photos
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="w-11 h-11 rounded border border-stage-muted/50 flex items-center justify-center cursor-pointer hover:bg-white/10"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label="Full screen"
            className="w-11 h-11 rounded border border-stage-muted/50 flex items-center justify-center cursor-pointer hover:bg-white/10"
          >
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </header>

      <section className="flex-1 flex items-center justify-center px-6 md:px-10 min-h-0">
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-stage-muted" />
            <p className="text-[16px] text-stage-muted">Connecting to the booth…</p>
          </div>
        ) : currentPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={currentPhoto.id}
            src={currentPhoto.compositeUrl}
            alt="A photo from the booth"
            className="max-h-[72vh] w-auto object-contain"
          />
        ) : (
          <div className="text-center">
            <p className="text-[clamp(28px,3vw,48px)] font-semibold tracking-tight">No photos yet</p>
            <p className="text-[18px] text-stage-muted mt-2">Photos appear here as guests finish their strips.</p>
          </div>
        )}
      </section>

      <footer className="flex items-center justify-center gap-1.5 pb-8 pt-4">
        {sessions.slice(0, 15).map((_, idx) => (
          <span
            key={idx}
            className={`h-1 transition-all duration-300 ${idx === currentIndex ? 'w-10 bg-stage-ink' : 'w-3 bg-stage-line'}`}
          />
        ))}
      </footer>
    </main>
  );
}
