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
import { useOperatorT } from '@/lib/operatorStrings';
import { LanguageSwitch } from '@/components/ui/LanguageSwitch';

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
  const { t } = useOperatorT();
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

  const metricClass = 'flex flex-col gap-3 p-6 min-w-0';
  const panelLabel = 'text-[14px] text-muted';

  return (
    <main className="min-h-screen bg-paper text-ink font-display select-none">
      <div className="max-w-7xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-10">

        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-paper-line">
          <div className="flex items-start gap-4">
            <Link href="/" title={t('admin.backToBooth')} aria-label={t('admin.backToBooth')} className="w-11 h-11 rounded border border-paper-control flex items-center justify-center text-ink hover:bg-paper-surface shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-[clamp(26px,2.6vw,36px)] leading-none font-semibold tracking-[-0.02em]">{t('admin.title')}</h1>
              <p className="text-[15px] text-muted mt-2 max-w-[60ch]">
                {t('admin.subtitle')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <LanguageSwitch />
            <span className={`h-10 px-3 inline-flex items-center gap-2 text-[14px] ${isSupabaseConfigured ? 'text-positive' : 'text-warning'}`}>
              <Database className="w-4 h-4" />
              {dataSourceNotice}
            </span>
            <button type="button" onClick={() => setIsPairingModalOpen(true)} className="h-11 px-5 rounded bg-accent hover:bg-accent-press text-white text-[16px] font-medium cursor-pointer">
              <span className="inline-flex items-center gap-2"><Plus className="w-4 h-4" /> {t('admin.pairBooth')}</span>
            </button>
            <button type="button" onClick={fetchDashboardData} aria-label={t('admin.refresh')} title={t('admin.refresh')} className="w-11 h-11 rounded border border-paper-control flex items-center justify-center hover:bg-paper-surface cursor-pointer">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        <RibbonAlertBanner
          alerts={ribbonAlerts}
          onSelectBooth={(id: string) => setSelectedBoothId(id)}
        />

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[20px] font-semibold tracking-tight">{t('admin.booths', { n: booths.length })}</h2>
            {selectedBoothId !== 'all' && (
              <button type="button" onClick={() => setSelectedBoothId('all')} className="h-10 px-4 rounded border border-paper-control text-[15px] cursor-pointer hover:bg-paper-surface">
                {t('admin.showAll')}
              </button>
            )}
          </div>

          <FleetSelector
            booths={booths}
            selectedBoothId={selectedBoothId}
            onSelectBooth={(id) => setSelectedBoothId(id)}
          />

          <HardwareStatusBar
            cameraConnected={activeBooth ? activeBooth.cameraConnected : undefined}
            cameraModel={activeBooth ? (activeBooth.cameraConnected ? 'Canon EOS R100' : 'Simulated (offline)') : undefined}
            printerConnected={activeBooth ? activeBooth.printerConnected : undefined}
            printerModel={activeBooth ? (activeBooth.printerConnected ? 'DNP DS-RX1HS' : 'Simulated (offline)') : undefined}
            ribbonRemaining={activeBooth ? activeBooth.ribbonRemaining : undefined}
            autoPoll={selectedBoothId === 'all'}
            pollIntervalMs={4000}
            className="w-full"
          />
        </section>

        <nav aria-label="Tools" className="grid grid-cols-2 sm:grid-cols-4 border-y border-paper-line divide-x divide-paper-line">
          <Link href="/admin/devices" className="p-5 flex flex-col gap-1 no-underline hover:bg-paper-surface">
            <span className="text-[16px] font-medium">{t('admin.tool.hardware')}</span>
            <span className="text-[14px] text-muted">{t('admin.tool.hardwareSub')}</span>
          </Link>
          <Link href="/admin/vouchers" className="p-5 flex flex-col gap-1 no-underline hover:bg-paper-surface">
            <span className="text-[16px] font-medium">{t('admin.tool.vouchers')}</span>
            <span className="text-[14px] text-muted">{t('admin.tool.vouchersSub')}</span>
          </Link>
          <Link href="/admin/pos" className="p-5 flex flex-col gap-1 no-underline hover:bg-paper-surface">
            <span className="text-[16px] font-medium">{t('admin.tool.shop')}</span>
            <span className="text-[14px] text-muted">{t('admin.tool.shopSub')}</span>
          </Link>
          <Link href="/live" target="_blank" className="p-5 flex flex-col gap-1 no-underline hover:bg-paper-surface">
            <span className="text-[16px] font-medium">{t('admin.tool.venue')}</span>
            <span className="text-[14px] text-muted">{t('admin.tool.venueSub')}</span>
          </Link>
        </nav>

        <section className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-paper-line border border-paper-line">
          <div className={metricClass}>
            <p className={panelLabel}>{selectedBoothId === 'all' ? t('admin.takingsAll') : t('admin.takingsBooth', { name: activeBooth?.name || selectedBoothId })}</p>
            <p className="text-[clamp(30px,3vw,44px)] leading-none font-semibold tracking-[-0.02em] tabular-nums">
              Rp {totalRevenue.toLocaleString('id-ID')}
            </p>
            <p className="text-[14px] text-muted tabular-nums">
              {t('admin.sessionsInView', { n: filteredSessions.length })}
            </p>
          </div>

          <div className={metricClass}>
            <p className={panelLabel}>{t('admin.howPaid')}</p>
            <div className="flex gap-8">
              <div>
                <p className="text-[24px] font-semibold tabular-nums">{qrisTransactions.length}</p>
                <p className="text-[14px] text-muted">{t('admin.byQris')}</p>
              </div>
              <div>
                <p className="text-[24px] font-semibold tabular-nums">{cashBypassTransactions.length}</p>
                <p className="text-[14px] text-muted">{t('admin.byCash')}</p>
              </div>
            </div>
          </div>

          {selectedBoothId === 'all' ? (
            <div className={metricClass}>
              <p className={panelLabel}>{t('admin.rollAll')}</p>
              <p className="text-[24px] font-semibold tabular-nums">
                {fleetStats.totalCuts} <span className="text-[16px] font-normal text-muted">{t('admin.rollOf', { max: fleetStats.maxCapacity, pct: fleetStats.avgRibbonPct })}</span>
              </p>
              <div className="w-full h-2 bg-paper-surface overflow-hidden">
                <div className="h-full bg-ink transition-all duration-500" style={{ width: `${fleetStats.avgRibbonPct}%` }} />
              </div>
              <p className="text-[14px] text-muted tabular-nums">
                {t('admin.fleetStatus', { on: fleetStats.onlineBooths, attn: fleetStats.maintenanceBooths, off: fleetStats.offlineBooths })}
              </p>
            </div>
          ) : (
            <div className={metricClass}>
              <p className={panelLabel}>{t('admin.thisBooth')}</p>
              <p className="text-[24px] font-semibold tabular-nums">
                {t('admin.printsLeftOf', { n: activeBooth?.ribbonRemaining ?? 700 })}
              </p>
              <div className="w-full h-2 bg-paper-surface overflow-hidden">
                <div className="h-full bg-ink transition-all duration-500" style={{ width: `${activeBooth?.ribbonPercentage ?? 100}%` }} />
              </div>
              <p className="text-[14px] text-muted">
                {t('admin.cameraStatus', {
                  state: activeBooth?.cameraConnected ? t('admin.connected') : t('admin.notConnected'),
                  printer: activeBooth?.printerConnected ? t('admin.ready') : t('admin.offline'),
                })}
              </p>
            </div>
          )}
        </section>

        {selectedBoothId === 'all' && (
          <section className="flex flex-col gap-4">
            <h2 className="text-[20px] font-semibold tracking-tight">{t('admin.atAGlance')}</h2>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-4 border-t border-l border-paper-line">
              {booths.map((b) => {
                const isLow = (b.ribbonRemaining ?? 700) < 100;
                return (
                  <li key={b.id} className="border-r border-b border-paper-line">
                    <button type="button" onClick={() => setSelectedBoothId(b.id)} className="w-full h-full p-5 text-left flex flex-col gap-4 cursor-pointer hover:bg-paper-surface">
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-[13px] text-muted tabular-nums">{b.id}</span>
                        <span className={`text-[13px] ${b.status === 'online' ? 'text-positive' : b.status === 'maintenance' ? 'text-warning' : 'text-muted'}`}>
                          {b.status === 'online' ? t('admin.online') : b.status === 'maintenance' ? t('admin.needsAttention') : t('admin.offline')}
                        </span>
                      </span>
                      <span className="flex flex-col gap-1">
                        <span className="text-[17px] font-medium">{b.name}</span>
                        <span className="text-[14px] text-muted truncate">{b.location || t('admin.venueNotSet')}</span>
                      </span>
                      <span className="flex items-center justify-between text-[14px] mt-auto">
                        <span className="text-muted">{t('admin.printsLeft')}</span>
                        <span className={`tabular-nums ${isLow ? 'text-warning font-medium' : ''}`}>{b.ribbonRemaining ?? 700}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-[20px] font-semibold tracking-tight">
              {t('admin.sessions', { n: filteredSessions.length })}
              {selectedBoothId !== 'all' && <span className="text-[15px] font-normal text-muted"> · {activeBooth?.name || selectedBoothId}</span>}
            </h2>
            <span className="text-[14px] text-muted">{t('admin.newestFirst')}</span>
          </div>

          {filteredSessions.length === 0 ? (
            <div className="border border-dashed border-paper-control p-10 text-center">
              <p className="text-[18px] font-medium">{t('admin.noSessions')}</p>
              <p className="text-[15px] text-muted mt-1">
                {selectedBoothId === 'all'
                  ? t('admin.noSessionsHint')
                  : t('admin.noSessionsFrom', { id: selectedBoothId })}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-paper-line border-y border-paper-line">
              {filteredSessions.map((s) => (
                <li key={s.id} className="py-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.compositeUrl} alt="" className="w-12 h-16 object-cover bg-paper-surface outline-1 outline-paper-line shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[16px] font-medium tabular-nums truncate">{s.id}</p>
                      <p className="text-[14px] text-muted tabular-nums">
                        {new Date(s.createdAt).toLocaleString()} · {s.boothId || s.eventId || 'booth-jkt-01'} · {s.layout}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[16px] tabular-nums">
                      Rp {(s.payment?.amount || 35000).toLocaleString('id-ID')}
                      <span className="block text-[13px] text-muted">{s.payment?.method || 'cash'}</span>
                    </span>
                    <button type="button" onClick={() => handleDownloadImage(s.compositeUrl, s.id)} aria-label={t('admin.downloadStripId', { id: s.id })} title={t('admin.downloadStrip')} className="w-10 h-10 rounded border border-paper-control flex items-center justify-center hover:bg-paper-surface cursor-pointer">
                      <Download className="w-4 h-4" />
                    </button>
                    <Link href={`/gallery/${s.id}`} target="_blank" aria-label={t('admin.openGalleryId', { id: s.id })} title={t('admin.openGallery')}className="w-10 h-10 rounded border border-paper-control flex items-center justify-center hover:bg-paper-surface">
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <KioskPairingModal
        isOpen={isPairingModalOpen}
        onClose={() => setIsPairingModalOpen(false)}
        onPairSuccess={handlePairSuccess}
      />
    </main>
  );
}
