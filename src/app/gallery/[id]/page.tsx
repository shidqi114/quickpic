'use client';

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { getPhotoSession as getSupabasePhotoSession, getLocalSessions as getSupabaseLocalSessions } from '@/lib/supabase/client';
import { getPhotoSession as getFirebasePhotoSession } from '@/lib/firebase';
import { PhotoSession, WelcomeLanguage } from '@/types/photobooth';
import Link from 'next/link';
import confetti from 'canvas-confetti';

const COPY: Record<WelcomeLanguage, {
  loadingTitle: string;
  loadingBody: string;
  notFoundTitle: string;
  notFoundBody: string;
  retry: string;
  retrying: string;
  back: string;
  strip: string;
  boomerangs: string;
  raw: (n: number) => string;
  stripAlt: string;
  save: string;
  saved: string;
  copied: string;
  share: string;
  pose: (n: number) => string;
  live: (n: number) => string;
  keep: string;
  footer: string;
}> = {
  en: {
    loadingTitle: 'Finding your photos',
    loadingBody: 'This takes a few seconds.',
    notFoundTitle: 'Your photos are not ready yet',
    notFoundBody: 'The booth may still be uploading them. Try again in a moment.',
    retry: 'Check again',
    retrying: 'Checking…',
    back: 'Booth',
    strip: 'Strip',
    boomerangs: 'Boomerangs',
    raw: (n) => `All poses (${n})`,
    stripAlt: 'Your photo strip',
    save: 'Save strip',
    saved: 'Saved',
    copied: 'Link copied',
    share: 'Share link',
    pose: (n) => `Pose ${n}`,
    live: (n) => `Boomerang ${n}`,
    keep: 'Kept for 30 days.',
    footer: 'QuickPic',
  },
  id: {
    loadingTitle: 'Mencari foto Anda',
    loadingBody: 'Ini memakan beberapa detik.',
    notFoundTitle: 'Foto Anda belum siap',
    notFoundBody: 'Booth mungkin masih mengunggah foto. Coba lagi sebentar lagi.',
    retry: 'Periksa lagi',
    retrying: 'Memeriksa…',
    back: 'Booth',
    strip: 'Strip',
    boomerangs: 'Boomerang',
    raw: (n) => `Semua pose (${n})`,
    stripAlt: 'Strip foto Anda',
    save: 'Simpan strip',
    saved: 'Tersimpan',
    copied: 'Tautan disalin',
    share: 'Bagikan tautan',
    pose: (n) => `Pose ${n}`,
    live: (n) => `Boomerang ${n}`,
    keep: 'Disimpan selama 30 hari.',
    footer: 'QuickPic',
  },
};

const subscribeNever = () => () => {};

function serverLanguage(): WelcomeLanguage {
  return 'en';
}

function detectLanguage(): WelcomeLanguage {
  const fromQuery = new URLSearchParams(window.location.search).get('lang');
  if (fromQuery === 'id' || fromQuery === 'en') return fromQuery;
  return navigator.language?.toLowerCase().startsWith('id') ? 'id' : 'en';
}

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
  const lang = useSyncExternalStore(subscribeNever, detectLanguage, serverLanguage);
  const copy = COPY[lang];

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
        // Source 1: Firebase Cloud Firestore
        if (id) {
          try {
            foundSession = await getFirebasePhotoSession(id);
          } catch (firebaseErr) {
            console.warn(`[Gallery] Firebase fetch attempt ${attempt} failed:`, firebaseErr);
          }
        }

        // Source 2: Cloud Fallback
        if (!foundSession && id) {
          try {
            foundSession = await getSupabasePhotoSession(id);
          } catch (cloudErr) {
            console.warn(`[Gallery] Cloud fetch attempt ${attempt} failed:`, cloudErr);
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
          colors: ['#1a4be0', '#ffffff', '#111111'],
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
      <main className="min-h-screen bg-paper text-ink font-display flex flex-col items-center justify-center gap-2 p-6 select-none text-center">
        <h1 className="text-[28px] font-semibold tracking-tight">{copy.loadingTitle}</h1>
        <p className="text-[16px] text-muted">{copy.loadingBody}</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-paper text-ink font-display flex flex-col justify-center gap-6 p-6 max-w-md mx-auto select-none">
        <div className="grid gap-3">
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight">{copy.notFoundTitle}</h1>
          <p className="text-[16px] text-muted leading-normal">{copy.notFoundBody}</p>
        </div>
        <div className="grid gap-3">
          <button
            type="button"
            onClick={handleManualRetry}
            disabled={retrying}
            className="h-14 rounded bg-accent hover:bg-accent-press disabled:opacity-50 text-white text-[18px] font-medium cursor-pointer"
          >
            {retrying ? copy.retrying : copy.retry}
          </button>
          <Link href="/" className="h-14 rounded border border-paper-control text-[18px] flex items-center justify-center no-underline">
            {copy.back}
          </Link>
        </div>
      </main>
    );
  }

  const hasLivePhotos = session.livePhotos && session.livePhotos.length > 0;
  const hasRawPhotos = session.rawPhotos && session.rawPhotos.length > 0;
  const tabClass = (active: boolean) =>
    `flex-1 h-12 rounded text-[16px] font-medium cursor-pointer ${active ? 'bg-ink text-white' : 'bg-paper-surface text-ink hover:bg-paper-control/40'}`;

  return (
    <main className="min-h-screen bg-paper text-ink font-display select-none">
      <div className="max-w-md mx-auto px-5 py-6 flex flex-col gap-6 min-h-screen">
        <header className="flex items-center justify-between">
          <Link href="/" className="text-[16px] text-muted no-underline">{copy.back}</Link>
          <span className="text-[16px] font-semibold tracking-tight">{copy.footer}</span>
        </header>

        {(hasLivePhotos || hasRawPhotos) && (
          <div className="flex gap-2" role="tablist">
            <button type="button" role="tab" aria-selected={activeTab === 'strip'} onClick={() => setActiveTab('strip')} className={tabClass(activeTab === 'strip')}>
              {copy.strip}
            </button>
            {hasLivePhotos && (
              <button type="button" role="tab" aria-selected={activeTab === 'live'} onClick={() => setActiveTab('live')} className={tabClass(activeTab === 'live')}>
                {copy.boomerangs}
              </button>
            )}
            {hasRawPhotos && (
              <button type="button" role="tab" aria-selected={activeTab === 'raw'} onClick={() => setActiveTab('raw')} className={tabClass(activeTab === 'raw')}>
                {copy.raw(session.rawPhotos.length)}
              </button>
            )}
          </div>
        )}

        {activeTab === 'strip' && (
          <section className="grid gap-4 justify-items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={session.compositeUrl} alt={copy.stripAlt} className="max-h-[62vh] w-auto object-contain outline-1 outline-paper-line" />
            <button
              type="button"
              onClick={() => handleDownload(session.compositeUrl, `quickpic-${session.id}.jpg`)}
              className="w-full h-14 rounded bg-accent hover:bg-accent-press text-white text-[18px] font-medium cursor-pointer"
            >
              {copy.save}
            </button>
          </section>
        )}

        {activeTab === 'live' && session.livePhotos && (
          <section className="grid grid-cols-2 gap-3">
            {session.livePhotos.map((live, idx) => (
              <div key={idx} className="grid gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={live.gifUrl} alt={copy.live(idx + 1)} className="w-full aspect-[3/4] object-cover bg-paper-surface" />
                <button
                  type="button"
                  onClick={() => handleDownload(live.gifUrl, `live-boomerang-${idx + 1}.gif`)}
                  className="h-11 rounded border border-paper-control text-[15px] cursor-pointer hover:bg-paper-surface"
                >
                  {copy.save} · {copy.live(idx + 1)}
                </button>
              </div>
            ))}
          </section>
        )}

        {activeTab === 'raw' && session.rawPhotos && (
          <section className="grid grid-cols-2 gap-3">
            {session.rawPhotos.map((photo, idx) => (
              <div key={idx} className="grid gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt={copy.pose(idx + 1)} className="w-full aspect-[3/4] object-cover bg-paper-surface" />
                <button
                  type="button"
                  onClick={() => handleDownload(photo, `raw-shot-${idx + 1}.jpg`)}
                  className="h-11 rounded border border-paper-control text-[15px] cursor-pointer hover:bg-paper-surface"
                >
                  {copy.save} · {copy.pose(idx + 1)}
                </button>
              </div>
            ))}
          </section>
        )}

        <div className="mt-auto grid gap-3">
          <button
            type="button"
            onClick={handleShare}
            className="h-14 rounded border border-paper-control text-[18px] font-medium cursor-pointer hover:bg-paper-surface"
          >
            {copied ? copy.copied : copy.share}
          </button>
          <p className="text-[14px] text-muted text-center">{copy.keep}</p>
        </div>
      </div>
    </main>
  );
}
