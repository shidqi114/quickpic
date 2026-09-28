'use client';

import React, { useEffect, useState } from 'react';
import { getRecentSessions, isFirebaseConfigured } from '@/lib/firebase';
import { PhotoSession } from '@/types/photobooth';
import { Download, Trash2, Camera, ExternalLink, ShieldCheck, Database, ArrowLeft, RefreshCw, Layout, Calendar, Sparkles } from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboardPage() {
  const [sessions, setSessions] = useState<PhotoSession[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const data = await getRecentSessions(50);
      setSessions(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleClearLocal = () => {
    if (confirm('Are you sure you want to clear locally cached photo sessions?')) {
      localStorage.removeItem('quickpic_sessions_cache');
      fetchSessions();
    }
  };

  const handleDownloadImage = (url: string, id: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `photobooth-${id}.jpg`;
    a.click();
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-10 flex flex-col items-center">
      <div className="w-full max-w-6xl">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-800 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Operator Dashboard
              </h1>
            </div>
            <p className="text-sm text-zinc-400 mt-1">
              Manage photobooth events, gallery sessions, and cloud connections.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Status Badges */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                isFirebaseConfigured
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              {isFirebaseConfigured ? 'Firebase Cloud Connected' : 'Local Storage Mode (Dev)'}
            </div>

            <button
              onClick={fetchSessions}
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white transition"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5">
            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Total Shots Taken</div>
            <div className="text-3xl font-black text-pink-400">{sessions.length}</div>
          </div>
          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5">
            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Deployment Platform</div>
            <div className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-cyan-400">▲ Vercel</span> &bull; Next.js
            </div>
          </div>
          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5">
            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Cloud Database</div>
            <div className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-amber-400">🔥 Firebase</span> Firestore
            </div>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">Recent Photo Sessions</h2>
          {sessions.length > 0 && (
            <button
              onClick={handleClearLocal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium transition"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear Local Cache
            </button>
          )}
        </div>

        {/* Sessions Grid */}
        {sessions.length === 0 ? (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-12 text-center">
            <Camera className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white">No Photos Yet</h3>
            <p className="text-sm text-zinc-400 mt-1 max-w-sm mx-auto">
              Start your first session on the kiosk to see photos and strips listed here.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-full bg-pink-500 hover:bg-pink-600 text-white text-sm font-semibold transition"
            >
              Launch Kiosk
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="group relative bg-zinc-900 border border-zinc-800/80 hover:border-pink-500/50 rounded-2xl overflow-hidden transition shadow-lg flex flex-col"
              >
                {/* Image Preview */}
                <div className="relative aspect-3/4 bg-zinc-950 flex items-center justify-center overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.compositeUrl}
                    alt="Strip preview"
                    className="h-full w-auto object-contain transition group-hover:scale-105 duration-300"
                  />
                  {/* Hover Overlay Buttons */}
                  <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 p-2">
                    <button
                      onClick={() => handleDownloadImage(s.compositeUrl, s.id)}
                      title="Download Strip"
                      className="p-2 rounded-full bg-pink-500 hover:bg-pink-600 text-white transition"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <Link
                      href={`/gallery/${s.id}`}
                      target="_blank"
                      title="Open Guest Share Page"
                      className="p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white transition"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                </div>

                {/* Info Footer */}
                <div className="p-3 bg-zinc-900/90 text-xs">
                  <div className="font-semibold text-zinc-200 truncate">{s.eventId || 'General'}</div>
                  <div className="text-zinc-500 text-[10px] mt-0.5">
                    {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull; {s.layout}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
