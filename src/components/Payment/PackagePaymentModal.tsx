'use client';

import React, { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { PhotoboothPackage, PaymentDetails, VoucherCode } from '@/types/photobooth';
import { PHOTOBOOTH_PACKAGES } from '@/lib/constants';
import { validateVoucher, generateDynamicQRIS, verifyStaffPin } from '@/lib/payments';
import type { WelcomeLanguage } from '@/components/ux/WelcomeScreen';

interface PackagePaymentModalProps {
  isOpen: boolean;
  language?: WelcomeLanguage;
  onPaymentSuccess: (packageSelected: PhotoboothPackage, payment: PaymentDetails, extraCopies: number) => void;
}

const COPY: Record<WelcomeLanguage, {
  kicker: string;
  title: string;
  extraPrints: string;
  extraPrice: string;
  promoLabel: string;
  promoPlaceholder: string;
  apply: string;
  payDue: string;
  qrisLabel: string;
  scanHint: string;
  confirm: string;
  staffPin: string;
  staffTitle: string;
  staffBody: string;
  staffPlaceholder: string;
  wrongPin: string;
  cancel: string;
  authorize: string;
  popular: string;
  onePrint: (n: number) => string;
}> = {
  en: {
    kicker: 'Choose your session',
    title: 'Package and extras',
    extraPrints: 'Extra prints',
    extraPrice: 'Rp 10.000 for each extra print',
    promoLabel: 'Promo or voucher code',
    promoPlaceholder: 'e.g. VIPFREE',
    apply: 'Apply',
    payDue: 'To pay',
    qrisLabel: 'Scan to pay with QRIS',
    scanHint: 'GoPay, OVO, DANA, BCA or any banking app',
    confirm: 'Payment done',
    staffPin: 'Staff cash PIN',
    staffTitle: 'Staff cash payment',
    staffBody: 'Enter the staff PIN to skip payment for a cash sale.',
    staffPlaceholder: 'PIN',
    wrongPin: 'Wrong PIN',
    cancel: 'Cancel',
    authorize: 'Authorize',
    popular: 'Popular',
    onePrint: (n) => `${n} print${n === 1 ? '' : 's'}`,
  },
  id: {
    kicker: 'Pilih sesi Anda',
    title: 'Paket dan tambahan',
    extraPrints: 'Cetakan tambahan',
    extraPrice: 'Rp 10.000 untuk setiap cetakan tambahan',
    promoLabel: 'Kode promo atau voucher',
    promoPlaceholder: 'contoh: VIPFREE',
    apply: 'Pakai',
    payDue: 'Total bayar',
    qrisLabel: 'Pindai untuk bayar dengan QRIS',
    scanHint: 'GoPay, OVO, DANA, BCA, atau aplikasi bank apa pun',
    confirm: 'Sudah dibayar',
    staffPin: 'PIN kasir tunai',
    staffTitle: 'Pembayaran tunai staf',
    staffBody: 'Masukkan PIN staf untuk melewati pembayaran penjualan tunai.',
    staffPlaceholder: 'PIN',
    wrongPin: 'PIN salah',
    cancel: 'Batal',
    authorize: 'Izinkan',
    popular: 'Populer',
    onePrint: (n) => `${n} cetakan`,
  },
};

const PACKAGE_TEXT_ID: Record<string, { name: string; description: string }> = {
  'pkg-standard-strip': {
    name: 'Dua Strip Klasik',
    description: '2 strip foto fisik 2x6 (3 atau 4 pose) + file digital',
  },
  'pkg-4r-polaroid': {
    name: '4R Polaroid Vintage',
    description: '1 cetakan besar 4R (4x6 inci) dengan 2 atau 4 slot',
  },
  'pkg-vip-livephoto': {
    name: 'VIP Live Photo + Strip Lengkap',
    description: '4 strip foto + GIF boomerang 5 detik + akses VIP cloud 30 hari',
  },
};

const newTransactionId = () => 'TRX_' + Math.random().toString(36).substring(2, 8).toUpperCase();

export const PackagePaymentModal: React.FC<PackagePaymentModalProps> = ({
  isOpen,
  language = 'en',
  onPaymentSuccess,
}) => {
  const copy = COPY[language];
  const [selectedPackage, setSelectedPackage] = useState<PhotoboothPackage>(PHOTOBOOTH_PACKAGES[0]);
  const [extraPrints, setExtraPrints] = useState<number>(0);
  const [voucherCodeInput, setVoucherCodeInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<VoucherCode | null>(null);
  const [voucherMessage, setVoucherMessage] = useState<string | null>(null);
  const transactionId = useMemo(() => newTransactionId(), [isOpen]);

  const [isStaffPinOpen, setIsStaffPinOpen] = useState(false);
  const [staffPin, setStaffPin] = useState('');
  const [staffPinError, setStaffPinError] = useState(false);

  if (!isOpen) return null;

  const extraPrintsPrice = extraPrints * 10000;
  const baseTotal = selectedPackage.price + extraPrintsPrice;

  let finalTotal = baseTotal;
  if (appliedVoucher) {
    if (appliedVoucher.type === 'free') {
      finalTotal = 0;
    } else if (appliedVoucher.type === 'percentage') {
      finalTotal = Math.max(0, baseTotal - Math.round((baseTotal * appliedVoucher.value) / 100));
    } else if (appliedVoucher.type === 'fixed') {
      finalTotal = Math.max(0, baseTotal - appliedVoucher.value);
    }
  }

  const qrisString = generateDynamicQRIS(finalTotal, transactionId);
  const priceText = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  const handleApplyVoucher = () => {
    const res = validateVoucher(voucherCodeInput, baseTotal);
    if (res.valid && res.voucher) {
      setAppliedVoucher(res.voucher);
      setVoucherMessage(res.message);
    } else {
      setAppliedVoucher(null);
      setVoucherMessage(res.message);
    }
  };

  const handleStaffBypassSubmit = () => {
    if (verifyStaffPin(staffPin)) {
      setIsStaffPinOpen(false);
      onPaymentSuccess(
        selectedPackage,
        {
          method: 'cash_bypass',
          amount: finalTotal,
          transactionId: 'CASH_' + transactionId,
          status: 'bypassed',
          staffBypassPinUsed: true,
          voucherApplied: appliedVoucher || undefined,
        },
        extraPrints
      );
    } else {
      setStaffPinError(true);
      setStaffPin('');
    }
  };

  const handleSimulateQRISPayment = () => {
    onPaymentSuccess(
      selectedPackage,
      {
        method: 'qris_midtrans',
        amount: finalTotal,
        transactionId,
        qrisPayloadString: qrisString,
        status: 'settled',
        voucherApplied: appliedVoucher || undefined,
      },
      extraPrints
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-stage text-stage-ink font-display select-none overflow-y-auto">
      <div className="min-h-screen grid lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] gap-0">
        <section className="p-6 md:p-[4vw] flex flex-col gap-8">
          <header>
            <p className="text-base text-stage-muted">{copy.kicker}</p>
            <h2 className="mt-1 text-[clamp(32px,3.4vw,56px)] leading-none font-semibold tracking-[-0.03em]">{copy.title}</h2>
          </header>

          <div className="grid gap-3">
            {PHOTOBOOTH_PACKAGES.map((pkg) => {
              const selected = selectedPackage.id === pkg.id;
              return (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => setSelectedPackage(pkg)}
                  aria-pressed={selected}
                  className={`text-left p-5 rounded border flex items-center justify-between gap-6 cursor-pointer min-h-[84px] ${
                    selected ? 'border-stage-ink bg-stage-2' : 'border-stage-line bg-stage hover:bg-stage-2'
                  }`}
                >
                  <span className="grid gap-1">
                    <span className="flex items-center gap-3 flex-wrap">
                      <span className="text-[22px] font-medium">{language === 'id' ? PACKAGE_TEXT_ID[pkg.id]?.name ?? pkg.name : pkg.name}</span>
                      {pkg.isPopular && (
                        <span className="px-2 py-0.5 rounded-full bg-accent text-white text-[13px] font-medium">{copy.popular}</span>
                      )}
                    </span>
                    <span className="text-[16px] text-stage-muted leading-normal max-w-prose">{language === 'id' ? PACKAGE_TEXT_ID[pkg.id]?.description ?? pkg.description : pkg.description}</span>
                  </span>
                  <span className="text-right shrink-0 grid gap-1">
                    <span className="text-[24px] font-medium tabular-nums">{pkg.formattedPrice}</span>
                    <span className="text-[14px] text-stage-muted">{copy.onePrint(pkg.physicalPrintsCount)}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-5 rounded border border-stage-line flex items-center justify-between gap-4">
              <div>
                <p className="text-[18px] font-medium">{copy.extraPrints}</p>
                <p className="text-[14px] text-stage-muted">{copy.extraPrice}</p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  aria-label="Remove one print"
                  onClick={() => setExtraPrints(Math.max(0, extraPrints - 1))}
                  className="w-12 h-12 rounded border border-stage-line text-[24px] hover:bg-stage-2 cursor-pointer"
                >
                  −
                </button>
                <span className="w-8 text-center text-[22px] font-medium tabular-nums">{extraPrints}</span>
                <button
                  type="button"
                  aria-label="Add one print"
                  onClick={() => setExtraPrints(extraPrints + 1)}
                  className="w-12 h-12 rounded border border-stage-line text-[24px] hover:bg-stage-2 cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            <div className="grid gap-2">
              <label htmlFor="promo" className="text-[16px] text-stage-muted">{copy.promoLabel}</label>
              <div className="flex gap-2">
                <input
                  id="promo"
                  type="text"
                  value={voucherCodeInput}
                  onChange={(e) => setVoucherCodeInput(e.target.value.toUpperCase())}
                  placeholder={copy.promoPlaceholder}
                  className="flex-1 h-12 px-4 rounded border border-stage-line bg-stage-2 text-[18px] tracking-wider placeholder:text-stage-muted/60 focus:outline-2 focus:outline-accent"
                />
                <button
                  type="button"
                  onClick={handleApplyVoucher}
                  className="h-12 px-5 rounded border border-stage-line bg-stage-2 text-[16px] font-medium cursor-pointer hover:bg-stage-3"
                >
                  {copy.apply}
                </button>
              </div>
              {voucherMessage && (
                <p role="status" className={`text-[15px] ${appliedVoucher ? 'text-emerald-400' : 'text-red-400'}`}>
                  {voucherMessage}
                </p>
              )}
            </div>
          </div>
        </section>

        <aside className="p-6 md:p-[4vw] lg:p-8 bg-stage-2 flex flex-col justify-between gap-8 border-t lg:border-t-0 lg:border-l border-stage-line">
          <div className="grid gap-6">
            <div className="grid gap-1">
              <span className="text-[16px] text-stage-muted">{copy.payDue}</span>
              <span className="text-[clamp(36px,3.4vw,56px)] leading-none font-semibold tracking-[-0.02em] tabular-nums whitespace-nowrap">{priceText(finalTotal)}</span>
            </div>
            <div className="bg-white text-ink rounded p-6 grid justify-items-center gap-4">
              <p className="text-[15px] font-medium">{copy.qrisLabel}</p>
              <QRCodeSVG value={qrisString} size={220} level="M" />
              <p className="text-[14px] text-muted text-center">{copy.scanHint}</p>
            </div>
          </div>

          <div className="grid gap-3">
            <button
              type="button"
              onClick={handleSimulateQRISPayment}
              className="h-16 rounded bg-accent hover:bg-accent-press text-white text-[20px] font-medium cursor-pointer active:translate-y-px"
            >
              {copy.confirm}
            </button>
            <div className="flex justify-between items-center gap-4">
              <button
                type="button"
                onClick={() => setIsStaffPinOpen(true)}
                className="h-11 px-2 text-[15px] text-stage-muted underline underline-offset-4 cursor-pointer hover:text-stage-ink"
              >
                {copy.staffPin}
              </button>
            </div>
          </div>
        </aside>

        {isStaffPinOpen && (
          <div role="dialog" aria-modal="true" aria-labelledby="staff-title" className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-6">
            <div className="bg-stage-2 border border-stage-line rounded p-8 w-full max-w-sm grid gap-5">
              <h3 id="staff-title" className="text-[24px] font-medium">{copy.staffTitle}</h3>
              <p className="text-[16px] text-stage-muted">{copy.staffBody}</p>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={staffPin}
                onChange={(e) => {
                  setStaffPin(e.target.value);
                  setStaffPinError(false);
                }}
                placeholder={copy.staffPlaceholder}
                aria-label={copy.staffPlaceholder}
                className="h-14 text-center text-[28px] tracking-[0.3em] tabular-nums rounded border border-stage-line bg-stage px-4"
              />
              {staffPinError && <p role="alert" className="text-[15px] text-red-400">{copy.wrongPin}</p>}
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setIsStaffPinOpen(false)} className="h-12 rounded border border-stage-line text-[16px] cursor-pointer hover:bg-stage-3">
                  {copy.cancel}
                </button>
                <button type="button" onClick={handleStaffBypassSubmit} className="h-12 rounded bg-accent hover:bg-accent-press text-white text-[16px] font-medium cursor-pointer">
                  {copy.authorize}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
