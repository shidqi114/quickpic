'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  Printer,
  X,
  RotateCcw,
} from 'lucide-react';

export interface LowRibbonBooth {
  id: string;
  name: string;
  location?: string;
  ribbonRemaining: number; // e.g. 42 cuts remaining
  maxRibbon?: number; // DNP standard roll usually 700 cuts
  printerName?: string;
  ribbonPercentage?: number;
  printerConnected?: boolean;
}

/** Compatibility item interface matching UX specs */
export interface RibbonAlertItem {
  boothId: string;
  boothName: string;
  location?: string;
  ribbonRemaining: number;
  ribbonPercentage?: number;
  printerConnected?: boolean;
  cameraConnected?: boolean;
}

export interface RibbonAlertBannerProps {
  /** List of booths with low ribbon or all fleet booths */
  booths?: LowRibbonBooth[];
  /** Compatibility prop for alerts list */
  alerts?: RibbonAlertItem[];
  /** Cutoff threshold below which a warning triggers (default 100 cuts) */
  threshold?: number;
  /** Primary action callback (e.g. open maintenance instructions or reorder) */
  onAction?: (booth: LowRibbonBooth) => void;
  /** Callback fired when a booth is clicked */
  onSelectBooth?: (boothId: string) => void;
  /** Action button label (default: 'Replace Ribbon') */
  actionLabel?: string;
  /** Allow dismissing the alert */
  dismissible?: boolean;
  /** Callback fired when dismissed */
  onDismiss?: () => void;
  /** Additional styling */
  className?: string;
}

export const RibbonAlertBanner: React.FC<RibbonAlertBannerProps> = ({
  booths = [],
  alerts,
  threshold = 100,
  onAction,
  onSelectBooth,
  actionLabel = 'Replace Ribbon',
  dismissible = true,
  onDismiss,
  className = '',
}) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Normalize booths and alerts into a single unified array
  const rawList: LowRibbonBooth[] = alerts
    ? alerts.map((a) => ({
        id: a.boothId,
        name: a.boothName,
        location: a.location,
        ribbonRemaining: a.ribbonRemaining,
        ribbonPercentage: a.ribbonPercentage,
        printerConnected: a.printerConnected,
      }))
    : booths;

  // Filter booths that are below the critical threshold
  const criticalBooths = rawList.filter(
    (b) => typeof b.ribbonRemaining === 'number' && b.ribbonRemaining < threshold
  );

  // If no booths have low ribbon or user dismissed, don't render anything
  if (criticalBooths.length === 0 || isDismissed) {
    return null;
  }

  const primaryBooth = criticalBooths[0];
  const maxRoll = primaryBooth.maxRibbon || 700;
  const percentage =
    primaryBooth.ribbonPercentage ??
    Math.max(0, Math.min(100, Math.round((primaryBooth.ribbonRemaining / maxRoll) * 100)));

  const handleDismiss = () => {
    setIsDismissed(true);
    if (onDismiss) {
      onDismiss();
    }
  };

  const handleAction = (booth: LowRibbonBooth) => {
    if (onAction) {
      onAction(booth);
    }
    if (onSelectBooth) {
      onSelectBooth(booth.id);
    }
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/80 via-zinc-900/95 to-amber-950/60 p-4 md:p-5 shadow-xl shadow-amber-950/40 backdrop-blur-md transition-all ${className}`}
    >
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute -top-12 -left-12 h-36 w-36 rounded-full bg-amber-500/15 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 -right-10 h-36 w-36 rounded-full bg-rose-500/10 blur-2xl" />

      <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Icon & Critical Details */}
        <div className="flex items-start md:items-center gap-3.5 min-w-0">
          {/* Animated Warning Icon */}
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 shadow-inner">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-2xl bg-amber-400/20 opacity-70" />
            <AlertTriangle className="relative h-5 w-5 text-amber-400" />
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5" />
                Low Ribbon Consumable Alert
              </span>

              {criticalBooths.length > 1 && (
                <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                  {criticalBooths.length} Booths Affected
                </span>
              )}
            </div>

            {/* Booth Information & Remaining cuts */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-100 font-medium">
              <span className="font-bold text-white truncate">{primaryBooth.name}</span>
              {primaryBooth.location && (
                <span className="text-xs text-zinc-400 truncate">
                  ({primaryBooth.location})
                </span>
              )}
              <span className="text-zinc-500">·</span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-xs font-mono font-bold text-amber-300">
                {primaryBooth.ribbonRemaining} cuts remaining ({percentage}%)
              </span>
            </div>

            {/* Ribbon Stock Bar */}
            <div className="flex items-center gap-2 pt-1 max-w-xs">
              <div className="h-1.5 flex-1 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-red-500 to-amber-400 transition-all duration-500"
                  style={{ width: `${Math.max(percentage, 5)}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                {primaryBooth.ribbonRemaining} / {maxRoll}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
          {criticalBooths.length > 1 && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="px-3 py-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/60 text-xs font-semibold text-zinc-300 hover:text-white transition cursor-pointer"
            >
              {expanded ? 'Hide List' : `View All (${criticalBooths.length})`}
            </button>
          )}

          {(onAction || onSelectBooth) && (
            <button
              type="button"
              onClick={() => handleAction(primaryBooth)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 font-bold text-xs shadow-md shadow-amber-500/20 active:scale-95 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {actionLabel}
            </button>
          )}

          {dismissible && (
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss alert"
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded list for multi-booth low ribbon alerts */}
      {expanded && criticalBooths.length > 1 && (
        <div className="mt-4 pt-3 border-t border-amber-500/20 space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-400/90 mb-1">
            All Fleet Stations Requiring Ribbon Replacement
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {criticalBooths.map((booth) => {
              const boothPercent =
                booth.ribbonPercentage ??
                Math.round((booth.ribbonRemaining / (booth.maxRibbon || 700)) * 100);
              return (
                <div
                  key={booth.id}
                  onClick={() => onSelectBooth && onSelectBooth(booth.id)}
                  className={`p-2.5 rounded-xl bg-zinc-950/70 border border-amber-500/20 flex items-center justify-between gap-2 ${
                    onSelectBooth ? 'cursor-pointer hover:border-amber-500/40 hover:bg-zinc-900/80 transition' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-zinc-100 truncate">{booth.name}</div>
                    <div className="text-[11px] text-zinc-400 truncate">{booth.location || booth.id}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-xs font-bold text-amber-400">
                      {booth.ribbonRemaining} cuts
                    </div>
                    <div className="text-[10px] text-zinc-500">{boothPercent}% left</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
