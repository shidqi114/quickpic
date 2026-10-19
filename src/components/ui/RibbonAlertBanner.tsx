'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';

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
    <div role="alert" aria-live="assertive" className={`border-y border-ink py-4 px-1 font-display text-ink ${className}`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0 grid gap-2">
          <p className="text-[16px] font-medium">
            Low on prints: {primaryBooth.name}
            {primaryBooth.location && <span className="text-muted font-normal"> · {primaryBooth.location}</span>}
          </p>
          <p className="text-[15px] text-muted tabular-nums">
            {primaryBooth.ribbonRemaining} prints left of {maxRoll} ({percentage}%)
            {criticalBooths.length > 1 && ` · ${criticalBooths.length} booths need a new roll`}
          </p>
          <div className="w-full max-w-xs h-1.5 bg-paper-surface overflow-hidden">
            <div className="h-full bg-ink transition-all duration-500" style={{ width: `${Math.max(percentage, 5)}%` }} />
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {criticalBooths.length > 1 && (
            <button type="button" onClick={() => setExpanded((prev) => !prev)} className="h-10 px-4 rounded border border-paper-control text-[15px] cursor-pointer hover:bg-paper-surface">
              {expanded ? 'Hide list' : `See all ${criticalBooths.length}`}
            </button>
          )}

          {(onAction || onSelectBooth) && (
            <button type="button" onClick={() => handleAction(primaryBooth)} className="h-10 px-4 rounded bg-accent hover:bg-accent-press text-white text-[15px] font-medium cursor-pointer">
              {actionLabel}
            </button>
          )}

          {dismissible && (
            <button type="button" onClick={handleDismiss} aria-label="Dismiss alert" className="w-10 h-10 rounded flex items-center justify-center text-muted hover:text-ink hover:bg-paper-surface cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {expanded && criticalBooths.length > 1 && (
        <ul className="mt-4 border-t border-paper-line divide-y divide-paper-line">
          {criticalBooths.map((booth) => {
            const boothPercent =
              booth.ribbonPercentage ??
              Math.round((booth.ribbonRemaining / (booth.maxRibbon || 700)) * 100);
            return (
              <li key={booth.id}>
                <button
                  type="button"
                  onClick={() => onSelectBooth && onSelectBooth(booth.id)}
                  disabled={!onSelectBooth}
                  className="w-full py-3 flex items-center justify-between gap-4 text-left cursor-pointer hover:bg-paper-surface disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <span className="min-w-0">
                    <span className="block text-[15px] font-medium truncate">{booth.name}</span>
                    <span className="block text-[14px] text-muted truncate">{booth.location || booth.id}</span>
                  </span>
                  <span className="text-[15px] tabular-nums shrink-0">
                    {booth.ribbonRemaining} prints left
                    <span className="block text-[13px] text-muted">{boothPercent}%</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
