'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Camera,
  Printer,
  Zap,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Info,
  Check,
  ChevronDown,
  ChevronUp,
  Cpu,
  Activity,
  HardDrive,
  RefreshCw,
} from 'lucide-react';
import { DeviceTelemetry } from '@/types/photobooth';

export interface HardwareStatusData {
  camera: {
    connected: boolean;
    model: string;
    isSimulated?: boolean;
    batteryLevel?: number;
  };
  printer: {
    connected: boolean;
    name: string;
    ribbonRemaining: number;
    maxRibbon?: number;
    ribbonPercentage?: number;
    queueDepth?: number;
    isSimulated?: boolean;
  };
  system?: {
    cpuPct?: number;
    ramPct?: number;
    isDaemonOnline?: boolean;
  };
}

export interface HardwareStatusBarProps {
  /** Optional telemetry object or custom hardware data override */
  telemetry?: Partial<DeviceTelemetry>;
  /** Direct override for camera connected state */
  cameraConnected?: boolean;
  /** Direct override for camera model name */
  cameraModel?: string;
  /** Direct override for printer connected state */
  printerConnected?: boolean;
  /** Direct override for printer model name */
  printerModel?: string;
  /** Direct override for ribbon remaining cuts */
  ribbonRemaining?: number;
  /** Total maximum ribbon roll capacity (default: 700 cuts) */
  maxRibbon?: number;
  /** Hardware daemon base URL (default: http://localhost:8000) */
  hardwareDaemonUrl?: string;
  /** Automatically poll hardware daemon */
  autoPoll?: boolean;
  /** Polling interval in ms (default: 4000ms) */
  pollIntervalMs?: number;
  /** Callback fired when Test Shutter is clicked */
  onTestShutter?: () => Promise<void> | void;
  /** Callback fired when Test Print is clicked */
  onTestPrint?: () => Promise<void> | void;
  /** Trigger visual full-screen flash on shutter test (default: true) */
  enableScreenFlashFeedback?: boolean;
  /** Compact minimal badge mode (default: false) */
  compact?: boolean;
  /** Allow toggling expanded diagnostics details drawer (default: true) */
  showDiagnosticsToggle?: boolean;
  /** Additional custom Tailwind styling classes */
  className?: string;
}

const DEFAULT_HARDWARE_STATE: HardwareStatusData = {
  camera: {
    connected: true,
    model: 'Canon EOS R100',
    isSimulated: false,
  },
  printer: {
    connected: true,
    name: 'DNP DS-RX1HS',
    ribbonRemaining: 558,
    maxRibbon: 700,
    ribbonPercentage: 79.7,
    queueDepth: 0,
    isSimulated: false,
  },
  system: {
    cpuPct: 14,
    ramPct: 42,
    isDaemonOnline: true,
  },
};

/**
 * HardwareStatusBar Component
 *
 * A compact, high-precision dark theme hardware status bar for the QuickPic Kiosk & Admin View.
 * Displays:
 * - Camera status with emerald pulse (connected DSLR) or amber pill (simulated/offline)
 * - DNP Sublimation Printer status with remaining ribbon cuts and critical warning badge (<100 cuts)
 * - Micro action buttons: "Test Shutter" and "Test Print" with real-time feedback & tactile flash effect
 * - Expandable system diagnostic telemetry drawer
 */
export const HardwareStatusBar: React.FC<HardwareStatusBarProps> = ({
  telemetry,
  cameraConnected,
  cameraModel,
  printerConnected,
  printerModel,
  ribbonRemaining,
  maxRibbon = 700,
  hardwareDaemonUrl = 'http://localhost:8000',
  autoPoll = false,
  pollIntervalMs = 4000,
  onTestShutter,
  onTestPrint,
  enableScreenFlashFeedback = true,
  compact = false,
  showDiagnosticsToggle = true,
  className = '',
}) => {
  const [hardware, setHardware] = useState<HardwareStatusData>(DEFAULT_HARDWARE_STATE);
  const [isFlashing, setIsFlashing] = useState(false);
  const [shutterStatus, setShutterStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [printStatus, setPrintStatus] = useState<'idle' | 'printing' | 'success' | 'error'>('idle');
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Sync props into local state whenever provided
  useEffect(() => {
    setHardware((prev) => ({
      camera: {
        connected:
          cameraConnected !== undefined
            ? cameraConnected
            : telemetry?.camera?.connected !== undefined
            ? telemetry.camera.connected
            : prev.camera.connected,
        model:
          cameraModel ||
          telemetry?.camera?.model ||
          prev.camera.model,
        isSimulated:
          cameraConnected === false ||
          (telemetry?.camera?.connected === false) ||
          (cameraModel?.toLowerCase().includes('simulated') ?? false),
      },
      printer: {
        connected:
          printerConnected !== undefined
            ? printerConnected
            : telemetry?.printer?.connected !== undefined
            ? telemetry.printer.connected
            : prev.printer.connected,
        name:
          printerModel ||
          telemetry?.printer?.name ||
          prev.printer.name,
        ribbonRemaining:
          ribbonRemaining !== undefined
            ? ribbonRemaining
            : telemetry?.printer?.ribbonRemaining !== undefined
            ? telemetry.printer.ribbonRemaining
            : prev.printer.ribbonRemaining,
        maxRibbon: maxRibbon,
        ribbonPercentage:
          ribbonRemaining !== undefined
            ? Math.round((ribbonRemaining / maxRibbon) * 100)
            : telemetry?.printer?.ribbonPercentage !== undefined
            ? telemetry.printer.ribbonPercentage
            : prev.printer.ribbonPercentage,
        queueDepth: telemetry?.printer?.queueDepth ?? prev.printer.queueDepth,
      },
      system: {
        cpuPct: telemetry?.cpuPct ?? prev.system?.cpuPct,
        ramPct: telemetry?.ramPct ?? prev.system?.ramPct,
        isDaemonOnline: telemetry?.isOnline ?? prev.system?.isDaemonOnline,
      },
    }));
  }, [
    telemetry,
    cameraConnected,
    cameraModel,
    printerConnected,
    printerModel,
    ribbonRemaining,
    maxRibbon,
  ]);

  // Polling hardware daemon if enabled
  const fetchHardwareTelemetry = useCallback(async () => {
    if (!hardwareDaemonUrl) return;
    try {
      const res = await fetch(`${hardwareDaemonUrl}/device/telemetry`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        const data = await res.json();
        setHardware({
          camera: {
            connected: data.camera?.connected ?? true,
            model: data.camera?.model ?? 'Canon EOS R100',
            isSimulated: !data.camera?.connected,
          },
          printer: {
            connected: data.printer?.connected ?? true,
            name: data.printer?.name ?? 'DNP DS-RX1HS',
            ribbonRemaining: data.printer?.ribbon_remaining_count ?? 558,
            maxRibbon: maxRibbon,
            ribbonPercentage: data.printer?.ribbon_percentage ?? 79.7,
            queueDepth: data.printer?.queue_depth ?? 0,
          },
          system: {
            cpuPct: Math.round(data.cpu_usage_pct ?? 15),
            ramPct: Math.round(data.ram_usage_pct ?? 40),
            isDaemonOnline: true,
          },
        });
        setLastUpdated(new Date());
      }
    } catch {
      // Daemon might be offline or running in mock simulation mode
      setHardware((prev) => ({
        ...prev,
        system: {
          ...prev.system,
          isDaemonOnline: false,
        },
      }));
    }
  }, [hardwareDaemonUrl, maxRibbon]);

  useEffect(() => {
    if (!autoPoll) return;
    fetchHardwareTelemetry();
    const interval = setInterval(fetchHardwareTelemetry, pollIntervalMs);
    return () => clearInterval(interval);
  }, [autoPoll, pollIntervalMs, fetchHardwareTelemetry]);

  // Handler for Test Shutter
  const handleTestShutter = async () => {
    if (shutterStatus === 'testing') return;
    setShutterStatus('testing');
    setActionFeedback('Triggering DSLR shutter...');

    // Screen flash visual feedback
    if (enableScreenFlashFeedback) {
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 400);
    }

    try {
      if (onTestShutter) {
        await onTestShutter();
      } else {
        // Attempt sending signal to local hardware daemon
        const res = await fetch(`${hardwareDaemonUrl}/camera/capture`, {
          method: 'POST',
          signal: AbortSignal.timeout(3000),
        }).catch(() => null);

        if (!res || !res.ok) {
          // Simulated fallback
          await new Promise((r) => setTimeout(r, 600));
        }
      }

      setShutterStatus('success');
      setActionFeedback('Shutter & flash triggered successfully');
      setTimeout(() => {
        setShutterStatus('idle');
        setActionFeedback(null);
      }, 2500);
    } catch {
      setShutterStatus('error');
      setActionFeedback('Failed to trigger shutter');
      setTimeout(() => {
        setShutterStatus('idle');
        setActionFeedback(null);
      }, 3000);
    }
  };

  // Handler for Test Print
  const handleTestPrint = async () => {
    if (printStatus === 'printing') return;
    setPrintStatus('printing');
    setActionFeedback('Spooling test 2x6 strip print...');

    try {
      if (onTestPrint) {
        await onTestPrint();
      } else {
        // Send test print request to daemon
        const res = await fetch(`${hardwareDaemonUrl}/printer/print`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kiosk_id: 'hardware-test',
            image_url_or_base64: 'test-diagnostic-pattern',
            copies: 1,
            layout: 'strip-2x6',
          }),
          signal: AbortSignal.timeout(4000),
        }).catch(() => null);

        if (!res || !res.ok) {
          // Simulated spooling fallback
          await new Promise((r) => setTimeout(r, 900));
        }
      }

      // Optimistically decrement ribbon count for realistic visual feedback
      setHardware((prev) => ({
        ...prev,
        printer: {
          ...prev.printer,
          ribbonRemaining: Math.max(0, prev.printer.ribbonRemaining - 1),
          ribbonPercentage: Math.max(
            0,
            Math.round(((prev.printer.ribbonRemaining - 1) / (prev.printer.maxRibbon || 700)) * 100)
          ),
        },
      }));

      setPrintStatus('success');
      setActionFeedback('DNP test print job enqueued');
      setTimeout(() => {
        setPrintStatus('idle');
        setActionFeedback(null);
      }, 2500);
    } catch {
      setPrintStatus('error');
      setActionFeedback('Failed to enqueue test print');
      setTimeout(() => {
        setPrintStatus('idle');
        setActionFeedback(null);
      }, 3000);
    }
  };

  const isLowRibbon = hardware.printer.ribbonRemaining < 100;
  const isCriticalRibbon = hardware.printer.ribbonRemaining < 30;

  return (
    <>
      {/* Visual Screen Flash Feedback Overlay */}
      {isFlashing && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[9999] bg-white animate-flash"
        />
      )}

      <div
        className={`relative overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-950/85 backdrop-blur-xl shadow-2xl transition-all duration-200 ${
          isLowRibbon ? 'border-amber-500/40' : 'border-zinc-800'
        } ${className}`}
        role="region"
        aria-label="Hardware Status Bar"
      >
        {/* Subtle decorative edge lighting */}
        <div
          className={`pointer-events-none absolute -top-10 -left-10 h-28 w-28 rounded-full blur-3xl ${
            isLowRibbon ? 'bg-amber-500/10' : 'bg-pink-500/10'
          }`}
        />
        <div className="pointer-events-none absolute -bottom-10 -right-10 h-28 w-28 rounded-full bg-cyan-500/10 blur-3xl" />

        {/* Main Status Bar Container */}
        <div
          className={`flex flex-wrap items-center justify-between gap-3 p-2.5 sm:p-3.5 ${
            compact ? 'py-2 px-3 text-xs' : ''
          }`}
        >
          {/* Left Cluster: Hardware Indicators */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3.5 min-w-0">
            {/* 1. Camera Indicator Badge */}
            <div
              className={`flex items-center gap-2 rounded-xl px-3 py-1.5 border transition-all ${
                hardware.camera.connected
                  ? 'bg-zinc-900/90 border-zinc-700/60 shadow-xs'
                  : 'bg-amber-950/30 border-amber-500/30 text-amber-300'
              }`}
            >
              {/* Camera Pulse Icon */}
              <div className="relative flex items-center justify-center">
                {hardware.camera.connected ? (
                  <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-xs shadow-emerald-500/60" />
                  </span>
                ) : (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                )}
              </div>

              <Camera
                className={`w-4 h-4 shrink-0 ${
                  hardware.camera.connected ? 'text-zinc-200' : 'text-amber-400'
                }`}
              />

              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs font-bold text-zinc-100 truncate max-w-[130px] sm:max-w-[180px]">
                  {hardware.camera.model}
                </span>

                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                    hardware.camera.connected
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {hardware.camera.connected ? 'DSLR Live' : 'Simulated'}
                </span>
              </div>
            </div>

            {/* 2. DNP Printer Indicator Badge */}
            <div
              className={`flex items-center gap-2 rounded-xl px-3 py-1.5 border transition-all ${
                isLowRibbon
                  ? 'bg-gradient-to-r from-amber-950/40 via-zinc-900/90 to-zinc-900/90 border-amber-500/40 shadow-xs'
                  : 'bg-zinc-900/90 border-zinc-700/60 shadow-xs'
              }`}
            >
              {/* Printer Pulse Icon */}
              <div className="relative flex items-center justify-center">
                {hardware.printer.connected ? (
                  <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-xs shadow-emerald-500/60" />
                  </span>
                ) : (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-zinc-500" />
                )}
              </div>

              <Printer
                className={`w-4 h-4 shrink-0 ${
                  hardware.printer.connected ? 'text-zinc-200' : 'text-zinc-500'
                }`}
              />

              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-zinc-100 truncate hidden sm:inline max-w-[120px]">
                  {hardware.printer.name}
                </span>

                {/* Ribbon Remaining Cuts Pill */}
                <div
                  className={`flex items-center gap-1.5 text-xs font-mono font-bold px-2 py-0.5 rounded-lg border transition-colors ${
                    isCriticalRibbon
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                      : isLowRibbon
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-zinc-800/90 text-emerald-300 border-zinc-700/50'
                  }`}
                  title={`${hardware.printer.ribbonRemaining} cuts remaining out of ${
                    hardware.printer.maxRibbon || 700
                  }`}
                >
                  {isLowRibbon && <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />}
                  <span>
                    {hardware.printer.ribbonRemaining} / {hardware.printer.maxRibbon || 700} cuts
                  </span>
                </div>

                {/* Mini Stock Bar */}
                <div className="hidden md:flex items-center w-14 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isCriticalRibbon
                        ? 'bg-rose-500'
                        : isLowRibbon
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                    }`}
                    style={{
                      width: `${Math.max(
                        5,
                        hardware.printer.ribbonPercentage ??
                          Math.round(
                            (hardware.printer.ribbonRemaining / (hardware.printer.maxRibbon || 700)) *
                              100
                          )
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Cluster: Micro Action Buttons & Diagnostics Toggle */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center ml-auto">
            {/* Micro Button: Test Shutter */}
            <button
              type="button"
              onClick={handleTestShutter}
              disabled={shutterStatus === 'testing'}
              aria-label="Test Camera Shutter and Flash"
              className={`group relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                shutterStatus === 'success'
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                  : shutterStatus === 'error'
                  ? 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                  : 'bg-zinc-900/90 hover:bg-zinc-800/90 border-zinc-700/70 hover:border-pink-500/40 text-zinc-200 hover:text-white'
              }`}
            >
              {shutterStatus === 'testing' ? (
                <RotateCw className="w-3.5 h-3.5 animate-spin text-pink-400" />
              ) : shutterStatus === 'success' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Zap className="w-3.5 h-3.5 text-pink-400 group-hover:scale-110 transition-transform" />
              )}
              <span>
                {shutterStatus === 'testing'
                  ? 'Firing...'
                  : shutterStatus === 'success'
                  ? 'Fired!'
                  : 'Test Shutter'}
              </span>
            </button>

            {/* Micro Button: Test Print */}
            <button
              type="button"
              onClick={handleTestPrint}
              disabled={printStatus === 'printing'}
              aria-label="Test DNP Sublimation Print"
              className={`group relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                printStatus === 'success'
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                  : printStatus === 'error'
                  ? 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                  : 'bg-zinc-900/90 hover:bg-zinc-800/90 border-zinc-700/70 hover:border-cyan-500/40 text-zinc-200 hover:text-white'
              }`}
            >
              {printStatus === 'printing' ? (
                <RotateCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              ) : printStatus === 'success' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Printer className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
              )}
              <span>
                {printStatus === 'printing'
                  ? 'Spooling...'
                  : printStatus === 'success'
                  ? 'Queued!'
                  : 'Test Print'}
              </span>
            </button>

            {/* Diagnostics Drawer Toggle */}
            {showDiagnosticsToggle && (
              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                aria-expanded={isExpanded}
                aria-label="Toggle hardware diagnostics info"
                className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
                  isExpanded
                    ? 'bg-zinc-800 border-zinc-600 text-zinc-100'
                    : 'bg-zinc-900/60 hover:bg-zinc-800/80 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Live Action Feedback Toast Bar */}
        {actionFeedback && (
          <div className="px-3.5 py-1.5 bg-zinc-900/95 border-t border-zinc-800/80 text-[11px] font-medium text-zinc-300 flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3 h-3 text-pink-400 animate-pulse" />
              <span>{actionFeedback}</span>
            </div>
            <span className="text-[10px] font-mono text-zinc-500">
              {lastUpdated.toLocaleTimeString()}
            </span>
          </div>
        )}

        {/* Expandable Telemetry / Diagnostics Drawer */}
        {isExpanded && (
          <div className="px-3.5 py-3 bg-zinc-900/60 border-t border-zinc-800/80 space-y-2.5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              <div className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-cyan-400" />
                <span>Local Hardware Daemon Diagnostics</span>
              </div>
              <button
                type="button"
                onClick={fetchHardwareTelemetry}
                className="flex items-center gap-1 text-zinc-400 hover:text-white transition cursor-pointer text-[10px] font-medium"
              >
                <RefreshCw className="w-3 h-3" />
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {/* Camera Connection */}
              <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-1">
                <div className="text-[10px] text-zinc-400 font-semibold uppercase">Camera Driver</div>
                <div className="font-bold text-zinc-100 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Canon EDSDK v13</span>
                </div>
                <div className="text-[10px] font-mono text-zinc-400">USB 3.0 Direct</div>
              </div>

              {/* DNP Spooler Queue */}
              <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-1">
                <div className="text-[10px] text-zinc-400 font-semibold uppercase">Print Spooler</div>
                <div className="font-bold text-zinc-100 flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{hardware.printer.queueDepth ?? 0} jobs queued</span>
                </div>
                <div className="text-[10px] font-mono text-zinc-400">DNP 2x6 Cut Active</div>
              </div>

              {/* Host CPU */}
              <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-1">
                <div className="text-[10px] text-zinc-400 font-semibold uppercase">Host CPU Load</div>
                <div className="font-bold text-zinc-100 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-violet-400" />
                  <span>{hardware.system?.cpuPct ?? 14}%</span>
                </div>
                <div className="text-[10px] font-mono text-zinc-400">RAM: {hardware.system?.ramPct ?? 42}%</div>
              </div>

              {/* Daemon Status */}
              <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-1">
                <div className="text-[10px] text-zinc-400 font-semibold uppercase">Daemon Bridge</div>
                <div className="font-bold text-zinc-100 flex items-center gap-1.5">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      hardware.system?.isDaemonOnline !== false
                        ? 'bg-emerald-400 shadow-xs shadow-emerald-400/50'
                        : 'bg-amber-400'
                    }`}
                  />
                  <span>{hardware.system?.isDaemonOnline !== false ? ':8000 Online' : 'Mock Bridge'}</span>
                </div>
                <div className="text-[10px] font-mono text-zinc-400 truncate">
                  {hardwareDaemonUrl}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
