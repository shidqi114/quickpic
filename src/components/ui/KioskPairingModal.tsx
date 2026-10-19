'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Clock, Copy, KeyRound, Monitor, QrCode, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { useOperatorT } from '@/lib/operatorStrings';

export interface PairedBoothResult {
  id: string;
  name: string;
  location: string;
  pairingCode?: string;
}

export interface KioskPairingModalProps {
  /** Controls modal visibility */
  isOpen: boolean;
  /** Modal close callback */
  onClose: () => void;
  /** Target booth ID to pair (optional, can be generated or assigned) */
  boothId?: string;
  /** Target booth display name */
  boothName?: string;
  /** Venue or location name */
  location?: string;
  /** Preloaded 6-digit pairing code (default generates random 6 digits) */
  initialCode?: string;
  /** Total validity window in seconds (default 900s = 15 minutes) */
  validitySeconds?: number;
  /** Custom handler to request code generation from backend API */
  onRegeneratePin?: (boothId?: string) => Promise<string | void> | void;
  /** Optional callback fired when pairing is confirmed */
  onPairSuccess?: (result?: PairedBoothResult) => void;
  /** Additional styling */
  className?: string;
}

/** Helper to generate a client fallback 6-digit PIN */
function generateFallbackPin(): string {
  const pin = Math.floor(100000 + Math.random() * 900000);
  return pin.toString();
}

/**
 * Format remaining seconds into MM:SS
 */
function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * KioskPairingModal Component
 *
 * Modal dialog for the Vendor Owner to view and generate a 6-digit kiosk pairing code.
 * Features:
 * - Formatted 6-digit display in large tracking font (`tracking-widest font-mono text-3xl font-black text-amber-400`)
 * - Live 15-minute validity countdown timer
 * - One-click 'Regenerate PIN' button with loading feedback
 * - Clear step-by-step instructions for entering the PIN on the kiosk desktop app
 * - Optional QR Code toggle for camera/scanner pairing
 */
export const KioskPairingModal: React.FC<KioskPairingModalProps> = ({
  isOpen,
  onClose,
  boothId = 'booth-new-01',
  boothName = 'New Photobooth Kiosk',
  location = 'Unassigned Venue',
  initialCode,
  validitySeconds = 900, // 15 minutes
  onRegeneratePin,
  onPairSuccess,
  className = '',
}) => {
  const { t } = useOperatorT();
  const [pairingCode, setPairingCode] = useState<string>(
    initialCode || generateFallbackPin()
  );
  const [timeLeft, setTimeLeft] = useState<number>(validitySeconds);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'pin' | 'qr'>('pin');

  // Synchronize state when initialCode prop changes (React recommended pattern)
  const [prevInitialCode, setPrevInitialCode] = useState(initialCode);
  if (initialCode !== prevInitialCode) {
    setPrevInitialCode(initialCode);
    setPairingCode(initialCode || generateFallbackPin());
    setTimeLeft(validitySeconds);
  }

  // Countdown timer effect
  useEffect(() => {
    if (!isOpen) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, pairingCode]);

  // Handle escape key to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Regenerate PIN action
  const handleRegenerate = useCallback(async () => {
    setIsRegenerating(true);
    try {
      if (onRegeneratePin) {
        const newPin = await onRegeneratePin(boothId);
        if (newPin && typeof newPin === 'string') {
          setPairingCode(newPin);
        } else {
          setPairingCode(generateFallbackPin());
        }
      } else {
        // Fallback simulate regeneration
        await new Promise((r) => setTimeout(r, 450));
        setPairingCode(generateFallbackPin());
      }
      setTimeLeft(validitySeconds);
      setIsCopied(false);
    } catch (err) {
      console.error('Failed to regenerate pairing code:', err);
    } finally {
      setIsRegenerating(false);
    }
  }, [onRegeneratePin, boothId, validitySeconds]);

  // Copy code to clipboard
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(pairingCode);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      // Fallback if clipboard API is blocked
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  const handleDone = () => {
    if (onPairSuccess) {
      onPairSuccess({
        id: boothId,
        name: boothName,
        location,
        pairingCode,
      });
    }
    onClose();
  };

  if (!isOpen) return null;

  const isExpired = timeLeft <= 0;

  // Split PIN for formatted display (e.g. "849 201")
  const formattedPinDisplay =
    pairingCode.length === 6
      ? `${pairingCode.slice(0, 3)} ${pairingCode.slice(3)}`
      : pairingCode;

  // Pairing QR URL payload for Electron kiosk scanner
  const qrPayload = JSON.stringify({
    action: 'pair',
    boothId,
    pairingCode,
  });

  const tabClass = (on: boolean) =>
    `h-10 px-4 rounded text-[15px] cursor-pointer border ${on ? 'border-ink bg-ink text-white' : 'border-paper-control hover:bg-paper-surface'}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pairing-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-ink/40 font-display text-ink select-none"
    >
      <div className="fixed inset-0 -z-10" onClick={onClose} />

      <div className={`relative w-full max-w-xl bg-paper border border-paper-control rounded p-8 flex flex-col gap-6 max-h-[92vh] overflow-y-auto ${className}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="pairing-modal-title" className="text-[22px] font-semibold tracking-tight">{t('admin.pair.title')}</h2>
            <p className="text-[15px] text-muted mt-1">
              {t('admin.pair.intro', { location })}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label={t('admin.pair.close')} className="w-10 h-10 rounded flex items-center justify-center text-muted hover:text-ink hover:bg-paper-surface cursor-pointer shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[15px]">
            {boothName} <span className="text-muted tabular-nums">· {boothId}</span>
          </p>
          <div className="flex gap-2" role="group" aria-label={t('admin.pair.method')}>
            <button type="button" onClick={() => setActiveTab('pin')} aria-pressed={activeTab === 'pin'} className={tabClass(activeTab === 'pin')}>
              {t('admin.pair.code')}
            </button>
            <button type="button" onClick={() => setActiveTab('qr')} aria-pressed={activeTab === 'qr'} className={tabClass(activeTab === 'qr')}>
              {t('admin.pair.qr')}
            </button>
          </div>
        </div>

        {activeTab === 'pin' ? (
          <div className="border border-paper-control p-6 flex flex-col items-center text-center gap-4">
            <p className="text-[14px] text-muted">{t('admin.pair.codeFor')}</p>
            <p className={`tabular-nums text-[clamp(36px,4vw,48px)] font-semibold tracking-[0.2em] leading-none ${isExpired ? 'text-muted line-through' : ''} select-all`}>
              {formattedPinDisplay}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleCopyCode}
                disabled={isExpired}
                className="h-10 px-4 rounded border border-paper-control text-[15px] cursor-pointer hover:bg-paper-surface disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="inline-flex items-center gap-2">
                  {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {isCopied ? t('admin.pair.copied') : t('admin.pair.copy')}
                </span>
              </button>
              <span className={`inline-flex items-center gap-2 text-[14px] tabular-nums ${isExpired ? 'text-negative' : timeLeft < 180 ? 'text-warning' : 'text-muted'}`}>
                <Clock className="w-4 h-4" />
                {isExpired ? t('admin.pair.expired') : t('admin.pair.left', { t: formatCountdown(timeLeft) })}
              </span>
            </div>
          </div>
        ) : (
          <div className="border border-paper-control p-6 flex flex-col items-center text-center gap-3">
            <p className="text-[14px] text-muted">{t('admin.pair.scan')}</p>
            <div className="bg-white p-3">
              <QRCodeSVG value={qrPayload} size={160} level="M" />
            </div>
            <span className="inline-flex items-center gap-2 text-[14px] text-muted tabular-nums">
              <Clock className="w-4 h-4" /> {t('admin.pair.left', { t: formatCountdown(timeLeft) })}
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[14px] text-muted">
            {isExpired ? t('admin.pair.expiredNote') : t('admin.pair.validNote')}
          </p>
          <button type="button" onClick={handleRegenerate} disabled={isRegenerating} className="h-10 px-4 rounded border border-paper-control text-[15px] cursor-pointer hover:bg-paper-surface disabled:opacity-40">
            <span className="inline-flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
              {t('admin.pair.newCode')}
            </span>
          </button>
        </div>

        <div className="border-t border-paper-line pt-5 grid gap-3">
          <p className="text-[16px] font-medium">{t('admin.pair.stepsTitle')}</p>
          <ol className="grid gap-2 text-[15px] list-decimal pl-5 marker:text-muted">
            <li>{t('admin.pair.step1')}</li>
            <li>{t('admin.pair.step2')}</li>
            <li>{t('admin.pair.step3')}</li>
            <li>{t('admin.pair.step4')}</li>
          </ol>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-paper-line pt-5">
          <span className="inline-flex items-center gap-2 text-[14px] text-muted">
            <ShieldCheck className="w-4 h-4" /> {t('admin.pair.secure')}
          </span>
          <button type="button" onClick={handleDone} className="h-11 px-5 rounded bg-accent hover:bg-accent-press text-white text-[16px] font-medium cursor-pointer">
            {t('admin.pair.done')}
          </button>
        </div>
      </div>
    </div>
  );
};
