'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { useOperatorT } from '@/lib/operatorStrings';

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

export const FleetSelector: React.FC<FleetSelectorProps> = ({
  booths = DEFAULT_MOCK_BOOTHS,
  selectedBoothId = 'all',
  onSelectBooth,
  className = '',
  disabled = false,
  label,
}) => {
  const { t } = useOperatorT();
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

  const dot = (status: BoothStatus) =>
    status === 'online' ? 'bg-positive' : status === 'maintenance' ? 'bg-warning' : 'bg-muted';
  const statusText = (status: BoothStatus) =>
    status === 'online' ? t('admin.online') : status === 'maintenance' ? t('admin.needsAttention') : t('admin.offline');

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
    <div className={`relative inline-block text-left font-display text-ink ${className}`} ref={dropdownRef}>
      {label && <span className="block text-[14px] text-muted mb-2">{label}</span>}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`h-14 min-w-[280px] px-4 rounded border border-paper-control bg-paper flex items-center justify-between gap-4 text-left cursor-pointer hover:bg-paper-surface disabled:opacity-40 ${isOpen ? 'outline-2 outline-accent' : ''}`}
      >
        <span className="min-w-0">
          <span className="block text-[16px] font-medium truncate">
            {isFleetOverview ? t('admin.fleet.all') : selectedBooth.name}
          </span>
          <span className="block text-[14px] text-muted truncate">
            {isFleetOverview
              ? t('admin.fleet.online', { n: onlineCount, m: booths.length })
              : `${statusText(selectedBooth.status)}${selectedBooth.location ? ` · ${selectedBooth.location}` : ''}`}
          </span>
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div role="listbox" className="absolute z-50 mt-2 w-full min-w-[320px] md:w-[400px] bg-paper border border-paper-control flex flex-col">
          {booths.length >= 3 && (
            <div className="relative p-3 border-b border-paper-line">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('admin.fleet.search')}
                className="w-full h-11 pl-10 pr-10 rounded border border-paper-control bg-paper text-[15px] placeholder:text-muted focus:outline-2 focus:outline-accent"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} aria-label={t('admin.fleet.clear')} className="absolute right-6 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-muted hover:text-ink cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {!searchQuery && (
            <button
              type="button"
              role="option"
              aria-selected={isFleetOverview}
              onClick={() => handleSelect('all')}
              className={`w-full px-4 py-3 flex items-center justify-between gap-3 text-left border-b border-paper-line cursor-pointer hover:bg-paper-surface ${isFleetOverview ? 'bg-paper-surface' : ''}`}
            >
              <span>
                <span className="block text-[16px] font-medium">{t('admin.fleet.all')}</span>
                <span className="block text-[14px] text-muted">{t('admin.fleetStatus', { on: onlineCount, attn: maintenanceCount, off: offlineCount })}</span>
              </span>
              {isFleetOverview && <Check className="w-4 h-4 text-accent" />}
            </button>
          )}

          <div className="max-h-80 overflow-y-auto">
            {filteredBooths.length === 0 ? (
              <p className="px-4 py-6 text-center text-[15px] text-muted">{t('admin.fleet.noMatch')}</p>
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
                    className={`w-full px-4 py-3 flex items-center justify-between gap-3 text-left border-b border-paper-line last:border-0 cursor-pointer hover:bg-paper-surface ${isSelected ? 'bg-paper-surface' : ''}`}
                  >
                    <span className="min-w-0">
                      <span className="block text-[16px] font-medium truncate">{booth.name}</span>
                      <span className="block text-[14px] text-muted truncate">
                        {booth.location || t('admin.venueNotSet')}
                        {booth.ribbonRemaining !== undefined && <span className="tabular-nums"> · {t('admin.ribbon.printsLeft', { n: booth.ribbonRemaining })}</span>}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0 text-[14px]">
                      <span className={`w-2 h-2 rounded-full ${dot(booth.status)}`} />
                      {statusText(booth.status)}
                    </span>
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
