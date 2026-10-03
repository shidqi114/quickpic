'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Store,
  Cpu,
  Radio,
  Layers,
  ChevronDown,
  Check,
  Search,
  X,
} from 'lucide-react';

export type BoothStatus = 'online' | 'offline' | 'maintenance';

export interface BoothOption {
  id: string;
  name: string;
  location?: string;
  status: BoothStatus;
  ribbonRemaining?: number;
  ribbonPercentage?: number;
  sessionCount?: number;
  revenue?: number;
  lastSeenAt?: string | number | Date;
  cameraConnected?: boolean;
  printerConnected?: boolean;
}

/** Compatibility alias for UX Engineer BoothSummary */
export type BoothSummary = BoothOption;

export interface FleetSelectorProps {
  /** Array of available photobooths in the fleet */
  booths?: BoothOption[];
  /** Currently selected booth ID or 'all' for fleet-wide overview */
  selectedBoothId?: 'all' | string;
  /** Callback fired when a booth is selected */
  onSelectBooth?: (boothId: 'all' | string) => void;
  /** Optional custom styling classes */
  className?: string;
  /** Disable the dropdown */
  disabled?: boolean;
  /** Label shown above the component */
  label?: string;
}

/** Standard default fleet list for fallback or demo testing */
export const DEFAULT_MOCK_BOOTHS: BoothOption[] = [
  {
    id: 'booth-jkt-01',
    name: 'Grand Indonesia Booth A',
    location: 'Grand Indonesia East Mall, L3',
    status: 'online',
    ribbonRemaining: 558,
    ribbonPercentage: 79.7,
  },
  {
    id: 'booth-pim-02',
    name: 'Pondok Indah Kiosk 2',
    location: 'Pondok Indah Mall 2, Ground Floor',
    status: 'online',
    ribbonRemaining: 85, // Critical low ribbon example
    ribbonPercentage: 12.1,
  },
  {
    id: 'booth-scbd-03',
    name: 'Pacific Place Pop-Up',
    location: 'Pacific Place Mall, L4 Atrium',
    status: 'maintenance',
    ribbonRemaining: 340,
    ribbonPercentage: 48.5,
  },
  {
    id: 'booth-cp-04',
    name: 'Central Park Booth B',
    location: 'Central Park Mall, Tribeca Park',
    status: 'offline',
    ribbonRemaining: 410,
    ribbonPercentage: 58.6,
  },
];

/**
 * Status indicator badge with emerald pulse for online,
 * amber dot for maintenance, and zinc dot for offline.
 */
function StatusBadge({ status, label }: { status: BoothStatus; label?: boolean }) {
  if (status === 'online') {
    return (
      <span className="flex items-center gap-1.5" title="Online & Heartbeat Active">
        <span className="relative flex h-2.5 w-2.5 items-center justify-center">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-xs shadow-emerald-500/50" />
        </span>
        {label && <span className="text-[11px] font-medium text-emerald-400">Online</span>}
      </span>
    );
  }

  if (status === 'maintenance') {
    return (
      <span className="flex items-center gap-1.5" title="In Maintenance Mode">
        <span className="relative flex h-2.5 w-2.5 items-center justify-center">
          <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-amber-400/50" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
        </span>
        {label && <span className="text-[11px] font-medium text-amber-400">Maintenance</span>}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5" title="Offline / No Heartbeat">
      <span className="inline-flex rounded-full h-2 w-2 bg-zinc-500" />
      {label && <span className="text-[11px] font-medium text-zinc-400">Offline</span>}
    </span>
  );
}

/**
 * Helper to select appropriate visual Lucide icon for booth type / location
 */
function getBoothIcon(booth?: BoothOption) {
  if (!booth) return <Layers className="w-4 h-4 text-violet-400" />;
  const loc = (booth.location || '').toLowerCase();
  const name = booth.name.toLowerCase();

  if (loc.includes('mall') || loc.includes('plaza') || loc.includes('atrium') || loc.includes('store')) {
    return <Store className="w-4 h-4 text-pink-400" />;
  }
  if (name.includes('kiosk') || name.includes('node') || name.includes('station')) {
    return <Cpu className="w-4 h-4 text-cyan-400" />;
  }
  return <Radio className="w-4 h-4 text-amber-400" />;
}

/**
 * FleetSelector Component
 *
 * Interactive dropdown / station selector for photobooth stations across the fleet.
 * Features:
 * - Option 'all' (All Booths / Consolidated Fleet Overview) or specific booth IDs
 * - Visual badges: online (emerald pulse), offline (zinc dot), maintenance (amber dot)
 * - Booth name and location labels with icons (Store / Cpu / Radio)
 * - Dark modern theme (zinc-900, border-zinc-800, Tailwind CSS v4, Lucide icons)
 * - Search filter for large fleets & accessible keyboard/click-outside navigation
 */
export const FleetSelector: React.FC<FleetSelectorProps> = ({
  booths = DEFAULT_MOCK_BOOTHS,
  selectedBoothId = 'all',
  onSelectBooth,
  className = '',
  disabled = false,
  label,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const selectedBooth = booths.find((b) => b.id === selectedBoothId);
  const isFleetOverview = selectedBoothId === 'all' || !selectedBooth;

  // Filtered booth list based on search query
  const filteredBooths = booths.filter((b) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      b.name.toLowerCase().includes(q) ||
      b.id.toLowerCase().includes(q) ||
      (b.location && b.location.toLowerCase().includes(q))
    );
  });

  // Calculate fleet stats
  const onlineCount = booths.filter((b) => b.status === 'online').length;
  const maintenanceCount = booths.filter((b) => b.status === 'maintenance').length;
  const offlineCount = booths.filter((b) => b.status === 'offline').length;

  const handleSelect = (id: 'all' | string) => {
    if (onSelectBooth) {
      onSelectBooth(id);
    }
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {label && (
        <span className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
          {label}
        </span>
      )}

      {/* Main Dropdown Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`group flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/80 transition-all shadow-md focus:outline-hidden focus:ring-2 focus:ring-pink-500/50 ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        } ${isOpen ? 'ring-2 ring-pink-500/40 border-pink-500/40' : ''}`}
      >
        <div className="flex items-center gap-2.5 min-w-0 text-left">
          {/* Leading Icon */}
          <div className="w-8 h-8 rounded-xl bg-zinc-800/90 border border-zinc-700/60 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            {isFleetOverview ? (
              <Layers className="w-4 h-4 text-violet-400" />
            ) : (
              getBoothIcon(selectedBooth)
            )}
          </div>

          {/* Text Information */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-zinc-100 truncate">
                {isFleetOverview ? 'All Booths (Fleet Overview)' : selectedBooth.name}
              </span>
              {!isFleetOverview && selectedBooth && (
                <StatusBadge status={selectedBooth.status} />
              )}
            </div>

            <p className="text-[11px] text-zinc-400 truncate">
              {isFleetOverview
                ? `${onlineCount} of ${booths.length} stations online`
                : selectedBooth?.location || selectedBooth?.id}
            </p>
          </div>
        </div>

        {/* Chevron Icon */}
        <ChevronDown
          className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-pink-400' : 'group-hover:text-zinc-200'
          }`}
        />
      </button>

      {/* Dropdown Menu Popover */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute z-50 mt-2 w-80 md:w-96 rounded-2xl bg-zinc-900/98 border border-zinc-800 p-2 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 origin-top-left"
        >
          {/* Search Bar (Shown when 3+ booths available) */}
          {booths.length >= 3 && (
            <div className="relative mb-2 px-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search booth name, venue, ID..."
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-hidden focus:border-pink-500 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Option: All Booths (Fleet Overview) */}
          {!searchQuery && (
            <div className="pb-1.5 mb-1.5 border-b border-zinc-800/80">
              <button
                type="button"
                role="option"
                aria-selected={isFleetOverview}
                onClick={() => handleSelect('all')}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-colors text-left cursor-pointer ${
                  isFleetOverview
                    ? 'bg-violet-500/15 border border-violet-500/30 text-white'
                    : 'hover:bg-zinc-800/70 text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-violet-950/60 border border-violet-500/30 flex items-center justify-center shrink-0">
                    <Layers className="w-4 h-4 text-violet-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-zinc-100">
                      All Booths (Fleet Overview)
                    </div>
                    <div className="text-[11px] text-zinc-400 flex items-center gap-2">
                      <span className="text-emerald-400 font-medium">{onlineCount} online</span>
                      {maintenanceCount > 0 && (
                        <span className="text-amber-400 font-medium">{maintenanceCount} maint</span>
                      )}
                      {offlineCount > 0 && (
                        <span className="text-zinc-400">{offlineCount} offline</span>
                      )}
                    </div>
                  </div>
                </div>

                {isFleetOverview && (
                  <Check className="w-4 h-4 text-violet-400 shrink-0 ml-2" />
                )}
              </button>
            </div>
          )}

          {/* Booths List */}
          <div className="max-h-64 overflow-y-auto space-y-1 pr-0.5">
            {filteredBooths.length === 0 ? (
              <div className="p-4 text-center text-xs text-zinc-500">
                No photobooth stations found matching &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              filteredBooths.map((booth) => {
                const isSelected = selectedBoothId === booth.id;

                return (
                  <button
                    key={booth.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(booth.id)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-colors text-left cursor-pointer ${
                      isSelected
                        ? 'bg-pink-500/15 border border-pink-500/30 text-white'
                        : 'hover:bg-zinc-800/70 text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Booth Type / Location Icon */}
                      <div className="w-8 h-8 rounded-lg bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center shrink-0">
                        {getBoothIcon(booth)}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-zinc-100 truncate">
                            {booth.name}
                          </span>
                          <span className="font-mono text-[9px] text-zinc-400 bg-zinc-800/90 px-1.5 py-0.5 rounded border border-zinc-700/40">
                            {booth.id}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-400">
                          {booth.location ? (
                            <span className="truncate max-w-[170px]">{booth.location}</span>
                          ) : (
                            <span>Venue unassigned</span>
                          )}

                          {booth.ribbonRemaining !== undefined && (
                            <span
                              className={`font-mono text-[10px] shrink-0 ${
                                booth.ribbonRemaining < 100
                                  ? 'text-amber-400 font-semibold'
                                  : 'text-zinc-400'
                              }`}
                            >
                              · {booth.ribbonRemaining} cuts
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <StatusBadge status={booth.status} />
                      {isSelected && <Check className="w-4 h-4 text-pink-400" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
