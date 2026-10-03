'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { getPhotoSession as getSupabasePhotoSession, getLocalSessions as getSupabaseLocalSessions } from '@/lib/supabase/client';
import { getPhotoSession as getFirebasePhotoSession } from '@/lib/firebase';
import { PhotoSession, LivePhotoMedia } from '@/types/photobooth';
import {
  Download,
  Share2,
  Sparkles,
  Camera,
  Check,
  ArrowLeft,
  RefreshCw,
  Film,
  Layers,
  ExternalLink,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import confetti from 'canvas-confetti';

export default function GuestGalleryPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = typeof params?.id === 'string' ? params.id : '';
  const queryImg = searchParams?.get('img') || '';

  const [session, setSession] = useState<PhotoSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [activeTab, setActiveTab] = useState<'strip' | 'live' | 'raw'>('strip');

  const loadSessionResilient = async (isManual = false) => {
    if (!id && !queryImg) {
      setLoading(false);
      return;
    }

    const isDirectImage = Boolean(
      queryImg ||
      (id && (id.startsWith('http') || id.includes('cloudinary') || id.includes('res.cloudinary.com')))
    );
    const directUrl = queryImg || (id && (id.startsWith('http') || id.includes('cloudinary')) ? id : '');

    // Immediately instantiate fallback session if direct image or cloudinary URL is provided
    if (directUrl) {
      const immediateSession: PhotoSession = {
        id: id || 'direct_url_session',
        createdAt: Date.now(),
        eventId: 'quickpic-guest',
        packageId: 'standard-strip',
        rawPhotos: [directUrl],
        compositeUrl: directUrl,
        layout: 'strip-3',
        filter: 'none',
        themeId: 'classic-white',
        selectedTemplateId: 'tpl-strip-3-classic',
        payment: {
          method: 'cash_bypass',
          amount: 0,
          transactionId: 'DIRECT',
          status: 'settled',
        },
        consent: { granted: true, timestamp: Date.now() },
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        printStatus: 'printed',
      };
      setSession((prev) => prev || immediateSession);
      setLoading(false);
    }

    try {
      let foundSession: PhotoSession | null = null;
      const maxAttempts = 3;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        // Source 1: Supabase Cloud Database
        if (id) {
          try {
            foundSession = await getSupabasePhotoSession(id);
          } catch (supabaseErr) {
            console.warn(`[Gallery] Supabase fetch attempt ${attempt} failed:`, supabaseErr);
          }
        }

        // Source 2: Firebase Firestore Fallback
        if (!foundSession && id) {
          try {
            foundSession = await getFirebasePhotoSession(id);
          } catch (firebaseErr) {
            console.warn(`[Gallery] Firebase fetch attempt ${attempt} failed:`, firebaseErr);
          }
        }

        // Source 3: Offline LocalStorage Cache
        if (!foundSession && id) {
          const localSupa = getSupabaseLocalSessions();
          if (localSupa && localSupa[id]) {
            foundSession = localSupa[id];
          } else if (typeof window !== 'undefined') {
            try {
              const raw = localStorage.getItem('quickpic_sessions_cache');
              if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed[id]) {
                  foundSession = parsed[id];
                }
              }
            } catch {}
          }
        }

        if (foundSession) {
          break;
        }

        // Auto-retry delay: wait 1 second before next attempt if cloud sync was in flight
        if (attempt < maxAttempts && !foundSession) {
          await new Promise((res) => setTimeout(res, 1000));
        }
      }

      // Source 4: Direct Cloudinary / Image URL parameter fallback
      if (!foundSession && directUrl) {
        foundSession = {
          id: id || 'direct_url_session',
          createdAt: Date.now(),
          eventId: 'quickpic-guest',
          packageId: 'standard-strip',
          rawPhotos: [directUrl],
          compositeUrl: directUrl,
          layout: 'strip-3',
          filter: 'none',
          themeId: 'classic-white',
          selectedTemplateId: 'tpl-strip-3-classic',
          payment: {
            method: 'cash_bypass',
            amount: 0,
            transactionId: 'DIRECT',
            status: 'settled',
          },
          consent: { granted: true, timestamp: Date.now() },
          expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
          printStatus: 'printed',
        };
      }

      if (foundSession) {
        setSession(foundSession);
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.4 },
          colors: ['#ec4899', '#8b5cf6', '#06b6d4', '#fbbf24'],
        });
      } else if (!isDirectImage) {
        setSession(null);
      }
    } catch (err) {
      console.error('[Gallery] Unexpected error resolving session:', err);
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  };

  useEffect(() => {
    loadSessionResilient();
  }, [id, queryImg]);

  const handleDownload = (url: string, filename = 'photobooth-strip.jpg') => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    if (navigator.share && session) {
      try {
        await navigator.share({
          title: 'My QuickPic Photobooth Memory',
          text: 'Check out our photo memory from QuickPic!',
          url: shareUrl,
        });
      } catch {
        // Fallback to clipboard
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleManualRetry = () => {
    setRetrying(true);
    loadSessionResilient();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-zinc-100 select-none">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-pink-500 via-purple-500 to-yellow-400 p-1 mb-6 animate-pulse">
          <div className="w-full h-full bg-zinc-950 rounded-[22px] flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-pink-500 animate-spin" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-white mb-1">Loading Your Memory</h2>
        <p className="text-zinc-400 text-xs">Retrieving high-res photos from QuickPic Cloud...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center text-zinc-100 select-none max-w-md mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-4">
          <Camera className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2">Memory Uploading or Not Found</h2>
        <p className="text-zinc-400 text-xs mb-6 leading-relaxed">
          If your photobooth session just completed, the kiosk may still be syncing high-res photos to the cloud. Please tap retry below.
        </p>

        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={handleManualRetry}
            disabled={retrying}
            className="w-full py-3.5 px-4 bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white font-bold rounded-2xl transition shadow-lg shadow-pink-500/25 active:scale-95 flex items-center justify-center gap-2 text-sm cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
            {retrying ? 'Connecting...' : 'Check Again / Refresh'}
          </button>

          <Link
            href="/"
            className="w-full py-3 px-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold rounded-2xl border border-zinc-800 text-xs transition"
          >
            Return to Photobooth Kiosk
          </Link>
        </div>
      </div>
    );
  }

  const hasLivePhotos = session.livePhotos && session.livePhotos.length > 0;
  const hasRawPhotos = session.rawPhotos && session.rawPhotos.length > 0;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-6 flex flex-col items-center justify-between select-none">
      
      {/* Top Header */}
      <header className="w-full max-w-md flex items-center justify-between py-3 mb-2">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-xs font-semibold transition"
        >
          <ArrowLeft className="w-4 h-4" /> Booth
        </Link>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-300 text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-yellow-300" /> QuickPic Cloud
        </div>
        <div className="w-10" />
      </header>

      {/* Main Guest Card */}
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col items-center">
        
        {/* Gallery Mode Tabs */}
        {(hasLivePhotos || hasRawPhotos) && (
          <div className="flex items-center gap-1 p-1 bg-zinc-950 border border-zinc-800 rounded-2xl mb-4 w-full">
            <button
              onClick={() => setActiveTab('strip')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'strip'
                  ? 'bg-pink-500 text-white shadow-md shadow-pink-500/25'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Full Strip
            </button>
            {hasLivePhotos && (
              <button
                onClick={() => setActiveTab('live')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'live'
                    ? 'bg-pink-500 text-white shadow-md shadow-pink-500/25'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Film className="w-3.5 h-3.5" /> Boomerangs
              </button>
            )}
            {hasRawPhotos && (
              <button
                onClick={() => setActiveTab('raw')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'raw'
                    ? 'bg-pink-500 text-white shadow-md shadow-pink-500/25'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Camera className="w-3.5 h-3.5" /> Raw ({session.rawPhotos.length})
              </button>
            )}
          </div>
        )}

        {/* Tab 1: Rendered Strip */}
        {activeTab === 'strip' && (
          <div className="w-full flex flex-col items-center mb-5 animate-fade-in">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={session.compositeUrl}
              alt="Photobooth Strip"
              className="max-h-[56vh] w-auto rounded-xl shadow-2xl border border-zinc-800 object-contain mb-4"
            />
            <button
              onClick={() => handleDownload(session.compositeUrl, `quickpic-${session.id}.jpg`)}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-pink-500 via-rose-500 to-yellow-400 hover:brightness-110 text-white font-extrabold text-sm rounded-2xl transition shadow-xl shadow-pink-500/25 active:scale-95 cursor-pointer"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              Download High-Res Strip
            </button>
          </div>
        )}

        {/* Tab 2: Live Photos / Boomerang Looping GIFs */}
        {activeTab === 'live' && session.livePhotos && (
          <div className="w-full flex flex-col items-center mb-5 animate-fade-in space-y-3">
            <div className="grid grid-cols-2 gap-2 w-full max-h-[56vh] overflow-y-auto p-1">
              {session.livePhotos.map((live, idx) => (
                <div key={idx} className="relative rounded-xl overflow-hidden border border-zinc-700 bg-zinc-950 aspect-4/3 flex flex-col justify-between">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={live.gifUrl} alt={`Live Boomerang ${idx + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute bottom-1 left-1 bg-black/70 px-1.5 py-0.5 rounded text-[9px] font-bold text-white">
                    Live #{idx + 1}
                  </div>
                  <button
                    onClick={() => handleDownload(live.gifUrl, `live-boomerang-${idx + 1}.gif`)}
                    className="absolute top-1 right-1 p-1.5 rounded-lg bg-black/60 text-white hover:bg-pink-500 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Individual Raw Photos */}
        {activeTab === 'raw' && session.rawPhotos && (
          <div className="w-full flex flex-col items-center mb-5 animate-fade-in">
            <div className="grid grid-cols-2 gap-2 w-full max-h-[56vh] overflow-y-auto p-1">
              {session.rawPhotos.map((photo, idx) => (
                <div key={idx} className="relative rounded-xl overflow-hidden border border-zinc-700 bg-zinc-950 aspect-4/3 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo} alt={`Pose ${idx + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute bottom-1 left-1 bg-black/70 px-1.5 py-0.5 rounded text-[9px] font-bold text-white">
                    Pose #{idx + 1}
                  </div>
                  <button
                    onClick={() => handleDownload(photo, `raw-shot-${idx + 1}.jpg`)}
                    className="absolute top-1 right-1 p-1.5 rounded-lg bg-black/60 text-white hover:bg-pink-500 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Share & Copy Link Button */}
        <button
          onClick={handleShare}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs uppercase tracking-wider rounded-2xl border border-zinc-700 transition active:scale-95 cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" /> Link Copied to Clipboard!
            </>
          ) : (
            <>
              <Share2 className="w-4 h-4" /> Share Photo Strip Link
            </>
          )}
        </button>

      </div>

      {/* Footer */}
      <footer className="my-4 text-center text-[11px] text-zinc-500 flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-pink-500" />
        <span>Powered by QuickPic Cloud Photobooth &bull; Supabase + Cloudinary CDN</span>
      </footer>
    </main>
  );
}
