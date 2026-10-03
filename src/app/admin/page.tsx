'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  getBoothSessions,
  getLocalSessions,
  isSupabaseConfigured,
  supabase,
  ExtendedPhotoSession,
} from '@/lib/supabase/client';
import { getRecentSessions, isFirebaseConfigured } from '@/lib/firebase';
import { PhotoSession } from '@/types/photobooth';
import { FleetSelector, BoothSummary } from '@/components/ui/FleetSelector';
import { RibbonAlertBanner, RibbonAlertItem } from '@/components/ui/RibbonAlertBanner';
import { KioskPairingModal } from '@/components/ui/KioskPairingModal';
import { HardwareStatusBar } from '@/components/ui/HardwareStatusBar';
import {
  Download,
  Camera,
  ExternalLink,
  Database,
  ArrowLeft,
  RefreshCw,
  Layout,
  Tag,
  ShoppingBag,
  Cpu,
  TrendingUp,
  CreditCard,
  Tv,
  Plus,
  Printer,
  Wifi,
  WifiOff,
  AlertTriangle,
  Server,
  Layers,
  Store,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';

// Seed default fleet booths for offline and development resilience
const INITIAL_FLEET_BOOTHS: BoothSummary[] = [
  {
    id: 'booth-jkt-01',
    name: 'Grand Indonesia Booth A',
    location: 'West Mall Fl. 3, Jakarta Pusat',
    status: 'online',
    ribbonRemaining: 558,
    ribbonPercentage: 79.7,
    lastSeenAt: Date.now() - 35 * 1000,
    cameraConnected: true,
    printerConnected: true,
  },
  {
    id: 'booth-sub-02',
    name: 'Tunjungan Plaza Booth B',
    location: 'Main Atrium TP 4, Surabaya',
    status: 'online',
    ribbonRemaining: 412,
    ribbonPercentage: 58.8,
    lastSeenAt: Date.now() - 90 * 1000,
    cameraConnected: true,
    printerConnected: true,
  },
  {
    id: 'booth-bdg-03',
    name: 'Paris Van Java Booth C',
    location: 'Glamour Level PVJ, Bandung',
    status: 'maintenance',
    ribbonRemaining: 74, // Critical ribbon alert (< 100 cuts)
    ribbonPercentage: 10.5,
    lastSeenAt: Date.now() - 15 * 60 * 1000,
    cameraConnected: true,
    printerConnected: true,
  },
  {
    id: 'booth-bali-04',
    name: 'Beachwalk Kuta Booth D',
    location: 'Sunset Terrace, Bali',
    status: 'offline',
    ribbonRemaining: 630,
    ribbonPercentage: 90.0,
    lastSeenAt: Date.now() - 3 * 3600 * 1000,
    cameraConnected: false,
    printerConnected: true,
  },
];

const CUSTOM_BOOTHS_STORAGE_KEY = 'quickpic_custom_booths';

export default function AdminDashboardPage() {
  const [selectedBoothId, setSelectedBoothId] = useState<'all' | string>('all');
  const [booths, setBooths] = useState<BoothSummary[]>(INITIAL_FLEET_BOOTHS);
  const [sessions, setSessions] = useState<ExtendedPhotoSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPairingModalOpen, setIsPairingModalOpen] = useState(false);
  const [dataSourceNotice, setDataSourceNotice] = useState<string>('Local & Mock Fleet');

  // Load custom paired booths from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(CUSTOM_BOOTHS_STORAGE_KEY);
        if (raw) {
          const customList: BoothSummary[] = JSON.parse(raw);
          setBooths((prev) => {
            const existingIds = new Set(prev.map((b) => b.id));
            const additions = customList.filter((b) => !existingIds.has(b.id));
            return [...prev, ...additions];
          });
        }
      } catch (e) {
        console.warn('Failed to load custom booths from localStorage:', e);
      }
    }
  }, []);

  // Fetch fleet data: Supabase with smooth fallback to LocalStorage & Mock data
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      let fetchedSessions: ExtendedPhotoSession[] = [];
      let cloudBooths: BoothSummary[] = [];

      // 1. Attempt fetching from Supabase if configured
      if (isSupabaseConfigured && supabase) {
        try {
          // Fetch photobooths
          const { data: dbBooths, error: boothError } = await supabase
            .from('photobooths')
            .select('*')
            .order('created_at', { ascending: false });

          // Fetch latest telemetry for each booth
          const { data: dbTelemetry } = await supabase
            .from('telemetry')
            .select('*')
            .order('pinged_at', { ascending: false })
            .limit(50);

          if (!boothError && dbBooths && dbBooths.length > 0) {
            cloudBooths = dbBooths.map((b: any) => {
              const tel = dbTelemetry?.find((t: any) => t.booth_id === b.id);
              const isOnline =
                b.last_seen_at &&
                Date.now() - new Date(b.last_seen_at).getTime() < 3 * 60 * 1000;

              return {
                id: b.id,
                name: b.name || b.id,
                location: b.location || 'Fleet Station',
                status: isOnline ? 'online' : (b.status || 'offline'),
                ribbonRemaining: tel?.ribbon_remaining ?? 700,
                ribbonPercentage: tel?.ribbon_percentage ?? 100,
                lastSeenAt: b.last_seen_at ? new Date(b.last_seen_at).getTime() : undefined,
                cameraConnected: tel?.camera_connected ?? true,
                printerConnected: tel?.printer_connected ?? true,
              };
            });
          }

          // Fetch photo sessions
          let sessionQuery = supabase
            .from('sessions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(60);

          const { data: dbSessions, error: sessionError } = await sessionQuery;

          if (!sessionError && dbSessions && dbSessions.length > 0) {
            fetchedSessions = dbSessions.map((rec: any) => ({
              id: rec.id,
              createdAt: rec.created_at ? new Date(rec.created_at).getTime() : Date.now(),
              eventId: rec.event_id || rec.booth_id,
              boothId: rec.booth_id || 'booth-jkt-01',
              packageId: rec.package_id || 'strip',
              rawPhotos: rec.raw_photos || [],
              livePhotos: rec.live_photos || [],
              compositeUrl: rec.composite_url,
              layout: rec.layout || 'strip-3',
              filter: rec.filter || 'none',
              themeId: rec.theme_id || '',
              selectedTemplateId: rec.selected_template_id || '',
              slotAdjustments: rec.slot_adjustments || [],
              payment: rec.payment || {
                method: 'cash_bypass',
                amount: 35000,
                transactionId: '',
                status: 'settled',
              },
              consent: rec.consent || { granted: true, timestamp: Date.now() },
              guestDownloadUrl: rec.guest_download_url,
              printStatus: rec.print_status || 'not_requested',
              storagePath: rec.storage_path,
              expiresAt: rec.expires_at ? new Date(rec.expires_at).getTime() : Date.now() + 30 * 86400000,
              synced: true,
            }));
            setDataSourceNotice('Supabase PostgreSQL Live');
          }
        } catch (cloudErr) {
          console.warn('[Admin Page] Supabase fetch error, fallback active:', cloudErr);
        }
      }

      // 2. Offline / LocalStorage & Firebase fallback
      const localMap = getLocalSessions();
      const localList = Object.values(localMap);

      let firebaseList: PhotoSession[] = [];
      if (fetchedSessions.length === 0) {
        try {
          firebaseList = await getRecentSessions(40);
        } catch (e) {
          // ignore firebase offline
        }
      }

      // Merge sessions without duplicate IDs
      const sessionMap = new Map<string, ExtendedPhotoSession>();

      // Seed mock sessions with distributed boothIds if none exist
      if (fetchedSessions.length === 0 && localList.length === 0 && firebaseList.length === 0) {
        const mockSeedSessions: ExtendedPhotoSession[] = [
          {
            id: 'sess-jkt-991',
            createdAt: Date.now() - 8 * 60 * 1000,
            eventId: 'summer-gala',
            boothId: 'booth-jkt-01',
            packageId: 'strip',
            rawPhotos: ['/placeholder.jpg'],
            compositeUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
            layout: 'strip-3',
            filter: 'none',
            themeId: 'classic-white',
            selectedTemplateId: 'classic-white',
            payment: { method: 'qris_midtrans', amount: 35000, transactionId: 'TRX_JKT_01', status: 'settled' },
            consent: { granted: true, timestamp: Date.now() },
            expiresAt: Date.now() + 30 * 86400000,
            printStatus: 'printed',
          },
          {
            id: 'sess-sub-412',
            createdAt: Date.now() - 24 * 60 * 1000,
            eventId: 'fashion-week',
            boothId: 'booth-sub-02',
            packageId: '4r-classic',
            rawPhotos: ['/placeholder.jpg'],
            compositeUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
            layout: '4r-classic',
            filter: 'warm',
            themeId: 'vintage-cream',
            selectedTemplateId: 'vintage-cream',
            payment: { method: 'cash_bypass', amount: 50000, transactionId: 'CASH_SUB_02', status: 'bypassed', staffBypassPinUsed: true },
            consent: { granted: true, timestamp: Date.now() },
            expiresAt: Date.now() + 30 * 86400000,
            printStatus: 'printed',
          },
          {
            id: 'sess-bdg-883',
            createdAt: Date.now() - 42 * 60 * 1000,
            eventId: 'wedding-fair',
            boothId: 'booth-bdg-03',
            packageId: 'strip',
            rawPhotos: ['/placeholder.jpg'],
            compositeUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80',
            layout: 'strip-3',
            filter: 'bw',
            themeId: 'classic-white',
            selectedTemplateId: 'classic-white',
            payment: { method: 'qris_midtrans', amount: 35000, transactionId: 'TRX_BDG_03', status: 'settled' },
            consent: { granted: true, timestamp: Date.now() },
            expiresAt: Date.now() + 30 * 86400000,
            printStatus: 'queued',
          },
          {
            id: 'sess-jkt-990',
            createdAt: Date.now() - 75 * 60 * 1000,
            eventId: 'summer-gala',
            boothId: 'booth-jkt-01',
            packageId: 'strip',
            rawPhotos: ['/placeholder.jpg'],
            compositeUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
            layout: 'strip-3',
            filter: 'cyberpunk',
            themeId: 'cyber-dark',
            selectedTemplateId: 'cyber-dark',
            payment: { method: 'qris_midtrans', amount: 45000, transactionId: 'TRX_JKT_02', status: 'settled' },
            consent: { granted: true, timestamp: Date.now() },
            expiresAt: Date.now() + 30 * 86400000,
            printStatus: 'printed',
          },
        ];
        mockSeedSessions.forEach((s) => sessionMap.set(s.id, s));
      }

      fetchedSessions.forEach((s) => sessionMap.set(s.id, s));
      localList.forEach((s) => {
        if (!sessionMap.has(s.id)) sessionMap.set(s.id, s);
      });
      firebaseList.forEach((s) => {
        if (!sessionMap.has(s.id)) {
          sessionMap.set(s.id, {
            ...s,
            boothId: (s as any).boothId || 'booth-jkt-01',
          });
        }
      });

      const combinedSessions = Array.from(sessionMap.values()).sort(
        (a, b) => b.createdAt - a.createdAt
      );
      setSessions(combinedSessions);

      // Merge Cloud Booths with existing fleet list
      if (cloudBooths.length > 0) {
        setBooths((prev) => {
          const map = new Map<string, BoothSummary>();
          prev.forEach((b) => map.set(b.id, b));
          cloudBooths.forEach((b) => map.set(b.id, b));
          return Array.from(map.values());
        });
      }
    } catch (e) {
      console.error('[Admin Page] Fetch dashboard error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Filtered Sessions according to selected booth
  const filteredSessions = useMemo(() => {
    if (selectedBoothId === 'all') return sessions;
    return sessions.filter((s) => s.boothId === selectedBoothId || s.eventId === selectedBoothId);
  }, [sessions, selectedBoothId]);

  // Compute Revenue Stats based on filtered view
  const totalRevenue = useMemo(() => {
    return filteredSessions.reduce((acc, s) => acc + (s.payment?.amount || 35000), 0);
  }, [filteredSessions]);

  const qrisTransactions = useMemo(() => {
    return filteredSessions.filter((s) => s.payment?.method === 'qris_midtrans' || s.payment?.method === 'qris_xendit');
  }, [filteredSessions]);

  const cashBypassTransactions = useMemo(() => {
    return filteredSessions.filter((s) => s.payment?.method === 'cash_bypass');
  }, [filteredSessions]);

  // Most Popular Frame Count in current view
  const framePopularity = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredSessions.forEach((s) => {
      const key = s.layout || 'strip-3';
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [filteredSessions]);

  // Selected Booth details
  const activeBooth = useMemo(() => {
    if (selectedBoothId === 'all') return null;
    return booths.find((b) => b.id === selectedBoothId) || null;
  }, [booths, selectedBoothId]);

  // Fleet Health Summaries (Consolidated Mode)
  const fleetStats = useMemo(() => {
    const totalBooths = booths.length;
    const onlineBooths = booths.filter((b) => b.status === 'online').length;
    const maintenanceBooths = booths.filter((b) => b.status === 'maintenance').length;
    const offlineBooths = booths.filter((b) => b.status === 'offline').length;
    const totalCuts = booths.reduce((acc, b) => acc + (b.ribbonRemaining ?? 700), 0);
    const maxCapacity = totalBooths * 700;
    const avgRibbonPct = maxCapacity > 0 ? Math.round((totalCuts / maxCapacity) * 100) : 100;

    return {
      totalBooths,
      onlineBooths,
      maintenanceBooths,
      offlineBooths,
      totalCuts,
      maxCapacity,
      avgRibbonPct,
    };
  }, [booths]);

  // Telemetry alerts for RibbonAlertBanner (any booth with < 100 cuts or printer issues)
  const ribbonAlerts = useMemo<RibbonAlertItem[]>(() => {
    const alerts: RibbonAlertItem[] = [];

    // If in specific booth mode, only alert for that booth
    const targetBooths = selectedBoothId === 'all' ? booths : booths.filter((b) => b.id === selectedBoothId);

    targetBooths.forEach((b) => {
      const remaining = b.ribbonRemaining ?? 700;
      if (remaining < 100 || b.printerConnected === false) {
        alerts.push({
          boothId: b.id,
          boothName: b.name,
          location: b.location,
          ribbonRemaining: remaining,
          ribbonPercentage: b.ribbonPercentage ?? Math.round((remaining / 700) * 100),
          printerConnected: b.printerConnected,
          cameraConnected: b.cameraConnected,
        });
      }
    });

    return alerts;
  }, [booths, selectedBoothId]);

  const handleDownloadImage = (url: string, id: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `photobooth-${id}.jpg`;
    a.click();
  };

  // Reload fleet when newly paired kiosk is confirmed
  const handlePairSuccess = () => {
    fetchDashboardData();
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-6 md:p-10 flex flex-col items-center select-none">
      <div className="w-full max-w-7xl space-y-6 md:space-y-8">

        {/* Top Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
                title="Return to Kiosk"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                  Multi-Booth Fleet Executive Dashboard
                </h1>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Real-time multi-tenant supervision, gross revenue audits, consumable tracking, and hardware heartbeats.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Database / Cloud Status Badge */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                isSupabaseConfigured
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>{dataSourceNotice}</span>
            </div>

            {/* Pair New Kiosk Button */}
            <button
              onClick={() => setIsPairingModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:brightness-110 text-white text-xs font-bold shadow-lg shadow-pink-500/20 active:scale-95 transition cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Pair New Kiosk</span>
            </button>

            {/* Refresh Data */}
            <button
              onClick={fetchDashboardData}
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white transition cursor-pointer"
              title="Refresh Fleet Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {/* Consumable & Hardware Ribbon Alert Banner */}
        <RibbonAlertBanner
          alerts={ribbonAlerts}
          onSelectBooth={(id: string) => setSelectedBoothId(id)}
        />

        {/* Multi-Booth Fleet Selector */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-pink-400" />
              Station Fleet Filter ({booths.length} Photobooths Configured)
            </span>
            {selectedBoothId !== 'all' && (
              <button
                onClick={() => setSelectedBoothId('all')}
                className="text-xs text-pink-400 hover:text-pink-300 font-semibold cursor-pointer"
              >
                Reset to Consolidated Fleet
              </button>
            )}
          </div>

          <FleetSelector
            booths={booths}
            selectedBoothId={selectedBoothId}
            onSelectBooth={(id) => setSelectedBoothId(id)}
          />

          {/* Real-time Hardware Status Bar for Selected Booth / Local Daemon */}
          <HardwareStatusBar
            cameraConnected={activeBooth ? activeBooth.cameraConnected : undefined}
            cameraModel={activeBooth ? (activeBooth.cameraConnected ? 'Canon EOS R100' : 'Simulated (Offline)') : undefined}
            printerConnected={activeBooth ? activeBooth.printerConnected : undefined}
            printerModel={activeBooth ? (activeBooth.printerConnected ? 'DNP DS-RX1HS' : 'Simulated (Offline)') : undefined}
            ribbonRemaining={activeBooth ? activeBooth.ribbonRemaining : undefined}
            autoPoll={selectedBoothId === 'all'}
            pollIntervalMs={4000}
            className="w-full"
          />
        </div>

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

        {/* Analytics & Key Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* Metric 1: Revenue Card */}
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800/80 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  {selectedBoothId === 'all' ? 'Consolidated Fleet Revenue' : `${activeBooth?.name || selectedBoothId} Revenue`}
                </span>
                <div className="text-[10px] text-zinc-500 mt-0.5">
                  {selectedBoothId === 'all' ? 'Aggregated across all stations' : (activeBooth?.location || 'Assigned Station')}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-pink-500/10 text-pink-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-black text-pink-400">
                Rp {totalRevenue.toLocaleString('id-ID')}
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">
                {filteredSessions.length} total sessions recorded in this view
              </p>
            </div>
          </div>

          {/* Metric 2: Payment Breakdown Card */}
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

          {/* Metric 3: Fleet Health Overview ('all' mode) OR Booth Telemetry (specific mode) */}
          {selectedBoothId === 'all' ? (
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800/80 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Fleet Health Overview</span>
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                  <Server className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-zinc-400">Consumables Capacity:</span>
                  <span className="font-mono font-bold text-white">
                    {fleetStats.totalCuts} / {fleetStats.maxCapacity} cuts ({fleetStats.avgRibbonPct}%)
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      fleetStats.avgRibbonPct < 25 ? 'bg-amber-500' : 'bg-cyan-500'
                    }`}
                    style={{ width: `${fleetStats.avgRibbonPct}%` }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400">
                  <span className="text-emerald-400 font-semibold">{fleetStats.onlineBooths} Online</span>
                  <span className="text-amber-400 font-semibold">{fleetStats.maintenanceBooths} Warning</span>
                  <span className="text-zinc-500 font-semibold">{fleetStats.offlineBooths} Offline</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800/80 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Station Hardware & Ribbon</span>
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                  <Printer className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-zinc-400">DNP DS-RX1HS Ribbon:</span>
                  <span className={`font-mono font-bold ${(activeBooth?.ribbonRemaining ?? 700) < 100 ? 'text-amber-400' : 'text-white'}`}>
                    {activeBooth?.ribbonRemaining ?? 700} / 700 cuts
                  </span>
                </div>
                <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      (activeBooth?.ribbonRemaining ?? 700) < 100 ? 'bg-amber-500' : 'bg-pink-500'
                    }`}
                    style={{ width: `${activeBooth?.ribbonPercentage ?? 100}%` }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400">
                    Camera:{' '}
                    <span className={activeBooth?.cameraConnected ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                      {activeBooth?.cameraConnected ? 'USB Online' : 'Disconnected'}
                    </span>
                  </span>
                  <span className="text-zinc-400">
                    Printer:{' '}
                    <span className={activeBooth?.printerConnected ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                      {activeBooth?.printerConnected ? 'Ready' : 'Offline'}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Consolidated Fleet Stations Grid ('all' mode only) */}
        {selectedBoothId === 'all' && (
          <div className="space-y-3">
            <h2 className="font-bold text-white text-sm flex items-center gap-2">
              <Store className="w-4 h-4 text-pink-400" />
              Active Fleet Photobooths ({booths.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {booths.map((b) => {
                const isLow = (b.ribbonRemaining ?? 700) < 100;
                return (
                  <div
                    key={b.id}
                    onClick={() => setSelectedBoothId(b.id)}
                    className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-pink-500/50 transition cursor-pointer flex flex-col justify-between group shadow-md"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            b.status === 'online'
                              ? 'bg-emerald-400 ring-2 ring-emerald-400/20'
                              : b.status === 'maintenance'
                              ? 'bg-amber-400 ring-2 ring-amber-400/20'
                              : 'bg-zinc-600'
                          }`}
                        />
                        <span className="text-[10px] uppercase font-bold text-zinc-500">
                          {b.id}
                        </span>
                      </div>
                      <div className="font-bold text-xs text-white group-hover:text-pink-300 transition-colors">
                        {b.name}
                      </div>
                      <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                        {b.location || 'Assigned Venue'}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px]">
                      <span className="text-zinc-500">Ribbon:</span>
                      <span className={`font-mono font-bold ${isLow ? 'text-amber-400' : 'text-zinc-300'}`}>
                        {b.ribbonRemaining ?? 700} cuts
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Transaction History & Session Feed */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="font-bold text-white text-base">
                Session Gallery & Audit Log ({filteredSessions.length})
              </h2>
              {selectedBoothId !== 'all' && (
                <span className="px-2.5 py-0.5 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20 text-xs font-bold">
                  Filtered: {activeBooth?.name || selectedBoothId}
                </span>
              )}
            </div>

            <span className="text-xs text-zinc-400">
              Showing newest guest captures
            </span>
          </div>

          {filteredSessions.length === 0 ? (
            <div className="p-12 text-center text-zinc-500">
              <Camera className="w-12 h-12 mx-auto mb-3 text-zinc-600" />
              <p className="font-semibold text-white">No sessions recorded for this selection</p>
              <p className="text-xs text-zinc-400 mt-1">
                {selectedBoothId === 'all'
                  ? 'Launch the Kiosk at the root page to take photos.'
                  : `No sessions have been submitted yet from station ${selectedBoothId}.`}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/80">
              {filteredSessions.map((s) => (
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
                        {/* Station / Booth Tag */}
                        <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 text-[10px] font-mono font-medium">
                          {s.boothId || s.eventId || 'booth-jkt-01'}
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
                      className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer"
                      title="Download Strip"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <Link
                      href={`/gallery/${s.id}`}
                      target="_blank"
                      className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer"
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

      {/* Kiosk Pairing Modal */}
      <KioskPairingModal
        isOpen={isPairingModalOpen}
        onClose={() => setIsPairingModalOpen(false)}
        onPairSuccess={handlePairSuccess}
      />
    </main>
  );
}
