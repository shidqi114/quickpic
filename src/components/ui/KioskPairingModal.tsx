'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  KeyRound,
  RefreshCw,
  Clock,
  Copy,
  Check,
  X,
  Monitor,
  ShieldCheck,
  QrCode,
} from 'lucide-react';

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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pairing-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none"
    >
      {/* Click outside backdrop */}
      <div className="fixed inset-0 -z-10" onClick={onClose} />

      <div
        className={`relative w-full max-w-lg overflow-hidden rounded-3xl bg-zinc-900 border border-zinc-800 p-6 md:p-8 shadow-2xl shadow-black/60 transition-all ${className}`}
      >
        {/* Ambient Top Glow */}
        <div className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-44 w-44 rounded-full bg-pink-500/10 blur-3xl" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-5 right-5 p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 p-0.5 shadow-lg shadow-amber-500/25">
            <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
              <KeyRound className="w-6 h-6 text-amber-400" />
            </div>
          </div>
          <div>
            <h2 id="pairing-modal-title" className="text-xl font-black text-white">
              Pair Physical Kiosk
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Connect a photobooth station to your fleet account
            </p>
          </div>
        </div>

        {/* Station Target Card */}
        <div className="mb-4 p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Monitor className="w-4 h-4 text-cyan-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-xs font-bold text-zinc-200 truncate block">
                {boothName}
              </span>
              <span className="text-[11px] text-zinc-500 truncate block">
                {location} · <span className="font-mono text-zinc-400">{boothId}</span>
              </span>
            </div>
          </div>

          {/* Mode Selector Tabs (PIN vs QR) */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('pin')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'pin'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <KeyRound className="w-3 h-3" />
              <span>PIN</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('qr')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'qr'
                  ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <QrCode className="w-3 h-3" />
              <span>QR</span>
            </button>
          </div>
        </div>

        {/* Display Card: 6-Digit PIN or QR Code */}
        {activeTab === 'pin' ? (
          <div className="mb-4 rounded-2xl bg-zinc-950 border border-zinc-800/90 p-5 flex flex-col items-center justify-center text-center shadow-inner relative group">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
              One-Time Kiosk Pairing PIN
            </span>

            {/* Formatted 6-Digit Display */}
            <div className="my-1 py-1">
              <span
                className={`tracking-widest font-mono text-3xl font-black ${
                  isExpired ? 'text-zinc-600 line-through' : 'text-amber-400'
                } drop-shadow-sm select-all`}
              >
                {formattedPinDisplay}
              </span>
            </div>

            {/* Copy Button & Validity Badge */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleCopyCode}
                disabled={isExpired}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition active:scale-95 cursor-pointer ${
                  isCopied
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : 'bg-zinc-900 border-zinc-700/80 hover:bg-zinc-800 text-zinc-300'
                } ${isExpired ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                {isCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>PIN Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>

              {/* Countdown Display */}
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-medium ${
                  isExpired
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                    : timeLeft < 180
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 animate-pulse'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {isExpired ? 'Expired' : `${formatCountdown(timeLeft)} valid`}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-4 rounded-2xl bg-zinc-950 border border-zinc-800/90 p-5 flex flex-col items-center justify-center text-center shadow-inner">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
              Scan with Kiosk Camera
            </span>
            <div className="p-3 bg-white rounded-2xl shadow-lg my-1">
              <QRCodeSVG value={qrPayload} size={140} level="M" />
            </div>
            <div className="mt-2 text-xs font-mono text-zinc-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatCountdown(timeLeft)} remaining</span>
            </div>
          </div>
        )}

        {/* Regenerate PIN Button */}
        <div className="mb-5 flex items-center justify-between">
          <p className="text-[11px] text-zinc-400">
            {isExpired
              ? 'This PIN has expired. Generate a new code to continue.'
              : 'Valid for 15 minutes before automatic expiration.'}
          </p>

          <button
            type="button"
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800/90 hover:bg-zinc-800 border border-zinc-700/80 text-xs font-bold text-amber-400 hover:text-amber-300 transition active:scale-95 shrink-0 cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`}
            />
            <span>Regenerate PIN</span>
          </button>
        </div>

        {/* Step-by-Step Instructions */}
        <div className="space-y-2.5 rounded-2xl bg-zinc-950/50 border border-zinc-800/80 p-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
            Desktop Kiosk Pairing Steps
          </span>

          <ol className="space-y-2 text-xs text-zinc-300">
            <li className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-300 border border-zinc-700">
                1
              </span>
              <span>
                Launch the <strong className="text-white">QuickPic Electron App</strong> on the photobooth venue PC.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-300 border border-zinc-700">
                2
              </span>
              <span>
                Select <strong className="text-white">Pair Station</strong> on the initial setup screen.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-bold text-amber-300 border border-amber-500/40">
                3
              </span>
              <span>
                Enter the <strong className="text-amber-300 font-mono">6-digit PIN</strong> shown above to authenticate.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-300 border border-zinc-700">
                4
              </span>
              <span>
                The station will safely bind its cryptographic <code className="text-[11px] text-zinc-400">device_token</code> and initiate automatic telemetry.
              </span>
            </li>
          </ol>
        </div>

        {/* Security Footer Note */}
        <div className="mt-4 flex items-center justify-between text-[11px] text-zinc-500 border-t border-zinc-800/80 pt-3.5">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Scoped Least-Privilege Token</span>
          </div>

          <button
            type="button"
            onClick={handleDone}
            className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
