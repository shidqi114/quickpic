'use client';

import React, { useEffect, useState } from 'react';
import { getRecentSessions } from '@/lib/firebase';
import { PhotoSession } from '@/types/photobooth';
import { Sparkles, ArrowLeft, RefreshCw, Maximize, Play, Pause } from 'lucide-react';
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
    <main className="min-h-screen bg-black text-white flex flex-col justify-between p-6 select-none relative overflow-hidden">
      
      {/* Subtle Ambient Glow Background */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="flex items-center justify-between z-10">
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/80 border border-zinc-800 text-xs font-medium text-zinc-300 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Booth
        </Link>

        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-pink-500/20 border border-pink-500/30 text-pink-300 text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 animate-spin" /> Live Event Stream ({sessions.length} Photos)
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2 rounded-full bg-zinc-900/80 border border-zinc-800 text-zinc-300 hover:text-white transition"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-full bg-zinc-900/80 border border-zinc-800 text-zinc-300 hover:text-white transition"
          >
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Center Slideshow Showcase */}
      <section className="flex-1 flex items-center justify-center p-4 z-10">
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 text-pink-500 animate-spin" />
            <p className="text-zinc-400 text-sm font-medium">Connecting to live photobooth stream...</p>
          </div>
        ) : currentPhoto ? (
          <div className="relative flex flex-col items-center max-h-[78vh] transition-all duration-700 animate-fade-in">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={currentPhoto.id}
              src={currentPhoto.compositeUrl}
              alt="Live Photobooth Stream"
              className="max-h-[75vh] w-auto rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] border border-zinc-800 object-contain transition duration-500 hover:scale-[1.02]"
            />
          </div>
        ) : (
          <div className="text-center text-zinc-500">
            <p className="text-lg font-semibold">No photos taken yet!</p>
            <p className="text-sm mt-1">Photos will appear here live as guests use the booth.</p>
          </div>
        )}
      </section>

      {/* Bottom Ticker / Progress Indicator */}
      <footer className="flex items-center justify-center gap-2 z-10">
        {sessions.slice(0, 15).map((_, idx) => (
          <div
            key={idx}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              idx === currentIndex ? 'w-8 bg-pink-500' : 'w-2 bg-zinc-800'
            }`}
          />
        ))}
      </footer>
    </main>
  );
}
