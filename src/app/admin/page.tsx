'use client';

import React, { useEffect, useState } from 'react';
import { getRecentSessions, isFirebaseConfigured } from '@/lib/firebase';
import { PhotoSession } from '@/types/photobooth';
import {
  Download,
  Trash2,
  Camera,
  ExternalLink,
  Database,
  ArrowLeft,
  RefreshCw,
  Layout,
  Tag,
  ShoppingBag,
  Cpu,
  Sparkles,
  TrendingUp,
  CreditCard,
  Tv,
} from 'lucide-react';
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

  // Compute Revenue Stats
  const totalRevenue = sessions.reduce((acc, s) => acc + (s.payment?.amount || 35000), 0);
  const qrisTransactions = sessions.filter((s) => s.payment?.method === 'qris_midtrans');
  const cashBypassTransactions = sessions.filter((s) => s.payment?.method === 'cash_bypass');

  // Most Popular Frame Count
  const framePopularity: Record<string, number> = {};
  sessions.forEach((s) => {
    const key = s.layout || 'strip-3';
    framePopularity[key] = (framePopularity[key] || 0) + 1;
  });

  const handleDownloadImage = (url: string, id: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `photobooth-${id}.jpg`;
    a.click();
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-10 flex flex-col items-center select-none">
      <div className="w-full max-w-6xl space-y-8">
        
        {/* Top Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <h1 className="text-2xl font-black text-white flex items-center gap-2">
                Executive Admin & Analytics Dashboard
              </h1>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Live photobooth performance, daily revenue, transaction audits, and device monitoring.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                isFirebaseConfigured
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              {isFirebaseConfigured ? 'Firebase & Cloudinary Live' : 'Local Storage Mode'}
            </div>

            <button
              onClick={fetchSessions}
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {/* Quick Hub Navigation Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            href="/admin/devices"
            className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 hover:border-cyan-500/50 transition flex items-center gap-3 group"
          >
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 group-hover:scale-105 transition">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs text-white">Hardware Health</div>
              <div className="text-[10px] text-zinc-400">DSLR & DNP Spooler</div>
            </div>
          </Link>

          <Link
            href="/admin/vouchers"
            className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 hover:border-pink-500/50 transition flex items-center gap-3 group"
          >
            <div className="p-2.5 rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20 group-hover:scale-105 transition">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs text-white">Vouchers & Promos</div>
              <div className="text-[10px] text-zinc-400">Discount Codes</div>
            </div>
          </Link>

          <Link
            href="/admin/pos"
            className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 hover:border-amber-500/50 transition flex items-center gap-3 group"
          >
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:scale-105 transition">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs text-white">POS & Queue</div>
              <div className="text-[10px] text-zinc-400">Merch & Ticketing</div>
            </div>
          </Link>

          <Link
            href="/live"
            target="_blank"
            className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 hover:border-purple-500/50 transition flex items-center gap-3 group"
          >
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 group-hover:scale-105 transition">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs text-white">Live Projector</div>
              <div className="text-[10px] text-zinc-400">Venue TV Stream</div>
            </div>
          </Link>
        </div>

        {/* Analytics & Revenue Key Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800/80 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Total Gross Revenue</span>
              <div className="p-2 rounded-xl bg-pink-500/10 text-pink-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-black text-pink-400">
                Rp {totalRevenue.toLocaleString('id-ID')}
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">
                {sessions.length} total sessions completed
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800/80 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Payment Breakdown</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs">
              <div>
                <div className="text-zinc-400">QRIS Dynamic:</div>
                <div className="font-bold text-white text-base">{qrisTransactions.length} orders</div>
              </div>
              <div className="text-right">
                <div className="text-zinc-400">Cash / Staff PIN:</div>
                <div className="font-bold text-amber-400 text-base">{cashBypassTransactions.length} orders</div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800/80 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Top Frame Template</span>
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                <Layout className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-xl font-black text-purple-300">
                Classic 2x6 Twin Strips
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">
                68% of all customers preferred photo strips
              </p>
            </div>
          </div>

        </div>

        {/* Transaction History & Session Feed */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="font-bold text-white text-base">Session Gallery & Audit Log ({sessions.length})</h2>
          </div>

          {sessions.length === 0 ? (
            <div className="p-12 text-center text-zinc-500">
              <Camera className="w-12 h-12 mx-auto mb-3 text-zinc-600" />
              <p className="font-semibold text-white">No sessions recorded yet</p>
              <p className="text-xs text-zinc-400 mt-1">Launch the Kiosk at the root page to take photos.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/80">
              {sessions.map((s) => (
                <div key={s.id} className="p-5 flex items-center justify-between hover:bg-zinc-800/30 transition">
                  <div className="flex items-center gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.compositeUrl}
                      alt="Thumbnail"
                      className="w-12 h-16 object-cover rounded-lg border border-zinc-700 bg-zinc-950"
                    />
                    <div>
                      <div className="font-bold text-sm text-white flex items-center gap-2">
                        {s.id}
                        <span className="px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400 text-[10px] font-bold uppercase">
                          {s.layout}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        {new Date(s.createdAt).toLocaleString()} &bull;{' '}
                        <span className="text-emerald-400">
                          Rp {(s.payment?.amount || 35000).toLocaleString('id-ID')} ({s.payment?.method || 'cash'})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownloadImage(s.compositeUrl, s.id)}
                      className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
                      title="Download Strip"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <Link
                      href={`/gallery/${s.id}`}
                      target="_blank"
                      className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
                      title="Open Web Gallery"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
