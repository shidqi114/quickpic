'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getPhotoSession } from '@/lib/firebase';
import { PhotoSession } from '@/types/photobooth';
import { Download, Share2, Sparkles, Camera, Check, ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import confetti from 'canvas-confetti';

export default function GuestGalleryPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';
  const [session, setSession] = useState<PhotoSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;

    async function load() {
      try {
        const data = await getPhotoSession(id);
        setSession(data);
        if (data) {
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.4 },
          });
        }
      } catch (err) {
        console.error('Failed to load photo session:', err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  const handleDownload = (url: string, filename = 'photobooth-strip.jpg') => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  };

  const handleShare = async () => {
    if (navigator.share && session) {
      try {
        await navigator.share({
          title: 'My Photobooth Memory',
          text: 'Check out our photo strip!',
          url: window.location.href,
        });
      } catch {
        // Fallback to copy
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-zinc-100">
        <RefreshCw className="w-10 h-10 text-pink-500 animate-spin mb-4" />
        <p className="text-zinc-400 font-medium">Loading your photobooth memory...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center text-zinc-100">
        <Camera className="w-16 h-16 text-zinc-600 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Photo Strip Not Found</h2>
        <p className="text-zinc-400 text-sm max-w-sm mb-6">
          This photo session may have expired or is not yet available in the cloud.
        </p>
        <Link
          href="/"
          className="px-6 py-2.5 bg-pink-500 hover:bg-pink-600 text-white font-medium rounded-full text-sm transition"
        >
          Return to Photobooth
        </Link>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-8 flex flex-col items-center">
      {/* Header */}
      <header className="w-full max-w-md flex items-center justify-between py-4 mb-4">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-xs font-medium transition"
        >
          <ArrowLeft className="w-4 h-4" /> Booth
        </Link>
        <div className="flex items-center gap-1.5 text-pink-400 text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" /> QuickPic Memory
        </div>
        <div className="w-10" />
      </header>

      {/* Main Card */}
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center">
        {/* Rendered Strip */}
        <div className="w-full flex justify-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={session.compositeUrl}
            alt="Photobooth Strip"
            className="max-h-[60vh] w-auto rounded-xl shadow-2xl border border-zinc-800 object-contain"
          />
        </div>

        {/* Action Buttons */}
        <div className="w-full space-y-3">
          <button
            onClick={() => handleDownload(session.compositeUrl, `quickpic-${session.id}.jpg`)}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold rounded-2xl transition shadow-lg shadow-pink-500/25 active:scale-95"
          >
            <Download className="w-5 h-5" />
            Download Full Strip
          </button>

          <button
            onClick={handleShare}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold rounded-2xl border border-zinc-700 transition active:scale-95"
          >
            {copied ? (
              <>
                <Check className="w-5 h-5 text-green-400" />
                Link Copied!
              </>
            ) : (
              <>
                <Share2 className="w-5 h-5" />
                Share Strip
              </>
            )}
          </button>
        </div>

        {/* Individual Raw Shots */}
        {session.rawPhotos && session.rawPhotos.length > 1 && (
          <div className="w-full mt-8 pt-6 border-t border-zinc-800">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 text-center">
              Individual Photos ({session.rawPhotos.length})
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {session.rawPhotos.map((photo, idx) => (
                <div key={idx} className="relative group rounded-xl overflow-hidden border border-zinc-700 bg-zinc-950 aspect-4/3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo} alt={`Raw Shot ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => handleDownload(photo, `raw-shot-${idx + 1}.jpg`)}
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <footer className="mt-8 text-center text-xs text-zinc-600">
        Powered by QuickPic Cloud Photobooth &bull; Vercel + Firebase
      </footer>
    </main>
  );
}
