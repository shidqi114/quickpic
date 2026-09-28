'use client';

import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { PhotoboothPackage, PaymentDetails, VoucherCode } from '@/types/photobooth';
import { PHOTOBOOTH_PACKAGES } from '@/lib/constants';
import { validateVoucher, generateDynamicQRIS, verifyStaffPin } from '@/lib/payments';
import { Sparkles, Check, KeyRound, Tag, Plus, Minus, ArrowRight, ShieldAlert, CreditCard } from 'lucide-react';

interface PackagePaymentModalProps {
  isOpen: boolean;
  onPaymentSuccess: (packageSelected: PhotoboothPackage, payment: PaymentDetails, extraCopies: number) => void;
}

export const PackagePaymentModal: React.FC<PackagePaymentModalProps> = ({
  isOpen,
  onPaymentSuccess,
}) => {
  const [selectedPackage, setSelectedPackage] = useState<PhotoboothPackage>(PHOTOBOOTH_PACKAGES[0]);
  const [extraPrints, setExtraPrints] = useState<number>(0);
  const [voucherCodeInput, setVoucherCodeInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<VoucherCode | null>(null);
  const [voucherMessage, setVoucherMessage] = useState<string | null>(null);

  // Staff Bypass Modal state
  const [isStaffPinOpen, setIsStaffPinOpen] = useState(false);
  const [staffPin, setStaffPin] = useState('');
  const [staffPinError, setStaffPinError] = useState(false);

  if (!isOpen) return null;

  const extraPrintsPrice = extraPrints * 10000;
  const baseTotal = selectedPackage.price + extraPrintsPrice;

  // Calculate discount if voucher applied
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

  const transactionId = 'TRX_' + Math.random().toString(36).substring(2, 8).toUpperCase();
  const qrisString = generateDynamicQRIS(finalTotal, transactionId);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/90 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-5xl bg-zinc-900 border border-zinc-700/80 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[92vh]">
        
        {/* Left Side: Package & Extra Prints Selection */}
        <div className="flex-1 p-6 md:p-8 overflow-y-auto space-y-6">
          <div>
            <div className="flex items-center gap-2 text-pink-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Sparkles className="w-4 h-4" /> Select Your Session
            </div>
            <h2 className="text-2xl font-black text-white">Choose Package & Add-ons</h2>
          </div>

          {/* Package Cards */}
          <div className="space-y-3">
            {PHOTOBOOTH_PACKAGES.map((pkg) => (
              <div
                key={pkg.id}
                onClick={() => setSelectedPackage(pkg)}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                  selectedPackage.id === pkg.id
                    ? 'border-pink-500 bg-pink-500/10 shadow-lg shadow-pink-500/15 ring-2 ring-pink-500/20'
                    : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-white">{pkg.name}</span>
                    {pkg.isPopular && (
                      <span className="px-2 py-0.5 rounded-full bg-pink-500 text-[10px] font-extrabold uppercase text-white">
                        Popular
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 max-w-sm">{pkg.description}</p>
                </div>
                <div className="text-right">
                  <div className="font-black text-lg text-pink-400">{pkg.formattedPrice}</div>
                  <div className="text-[11px] text-zinc-500">{pkg.physicalPrintsCount} print(s)</div>
                </div>
              </div>
            ))}
          </div>

          {/* Extra Prints Counter */}
          <div className="bg-zinc-950/80 p-4 rounded-2xl border border-zinc-800 flex items-center justify-between">
            <div>
              <div className="font-semibold text-sm text-white">Extra Physical Prints</div>
              <div className="text-xs text-zinc-400">+Rp 10.000 per extra print</div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setExtraPrints(Math.max(0, extraPrints - 1))}
                className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-300 font-bold"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="font-bold text-base text-white w-6 text-center">{extraPrints}</span>
              <button
                onClick={() => setExtraPrints(extraPrints + 1)}
                className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-300 font-bold"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Promo / Voucher Code Field */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-pink-400" /> Have a Promo / Voucher Code?
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={voucherCodeInput}
                onChange={(e) => setVoucherCodeInput(e.target.value.toUpperCase())}
                placeholder="e.g. VIPFREE or DISCOUNT20"
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-hidden focus:border-pink-500 uppercase tracking-wider font-mono"
              />
              <button
                onClick={handleApplyVoucher}
                className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs uppercase tracking-wider rounded-xl transition border border-zinc-700"
              >
                Apply
              </button>
            </div>
            {voucherMessage && (
              <p className={`text-xs mt-1 ${appliedVoucher ? 'text-emerald-400' : 'text-rose-400'}`}>
                {voucherMessage}
              </p>
            )}
          </div>
        </div>

        {/* Right Side: QRIS Payment Generator */}
        <div className="w-full md:w-96 bg-zinc-950 p-6 md:p-8 flex flex-col justify-between border-t md:border-t-0 md:border-l border-zinc-800">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Payment Due</span>
              <span className="text-2xl font-black text-pink-400">
                Rp {finalTotal.toLocaleString('id-ID')}
              </span>
            </div>

            {/* QRIS Display Container */}
            <div className="bg-white p-5 rounded-2xl shadow-xl flex flex-col items-center justify-center mb-4">
              <div className="text-[10px] font-bold text-zinc-800 uppercase tracking-widest mb-2 flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-red-600" /> QRIS Dynamic Payment
              </div>
              <QRCodeSVG value={qrisString} size={190} level="M" />
              <div className="text-[11px] font-semibold text-zinc-600 text-center mt-3">
                Scan using GoPay, OVO, Dana, BCA, or any banking app
              </div>
            </div>
          </div>

          {/* Action Trigger Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleSimulateQRISPayment}
              className="w-full flex items-center justify-center gap-2 py-4 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-extrabold rounded-2xl transition shadow-lg shadow-emerald-500/25 active:scale-95 text-sm uppercase tracking-wider"
            >
              <Check className="w-5 h-5" />
              Simulate Scan / Confirm Payment
            </button>

            {/* Hidden Staff Bypass Button */}
            <div className="flex justify-center pt-2">
              <button
                onClick={() => setIsStaffPinOpen(true)}
                className="text-[11px] text-zinc-600 hover:text-zinc-400 flex items-center gap-1 transition"
              >
                <KeyRound className="w-3 h-3" /> Staff Cash Bypass PIN
              </button>
            </div>
          </div>
        </div>

        {/* Staff PIN Bypass Modal */}
        {isStaffPinOpen && (
          <div className="absolute inset-0 bg-black/95 z-50 flex items-center justify-center p-6 animate-fade-in">
            <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-xs w-full text-center space-y-4">
              <KeyRound className="w-10 h-10 text-amber-400 mx-auto" />
              <h3 className="text-lg font-bold text-white">Staff Cash Bypass</h3>
              <p className="text-xs text-zinc-400">
                Enter staff PIN to bypass payment for cash transactions (Default: 1144)
              </p>
              <input
                type="password"
                maxLength={6}
                value={staffPin}
                onChange={(e) => {
                  setStaffPin(e.target.value);
                  setStaffPinError(false);
                }}
                placeholder="PIN"
                className="w-full text-center text-2xl tracking-widest font-mono bg-zinc-950 border border-zinc-700 rounded-xl py-3 text-white focus:outline-hidden focus:border-amber-400"
              />
              {staffPinError && <p className="text-xs text-rose-400">Incorrect Staff PIN</p>}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => setIsStaffPinOpen(false)}
                  className="py-2.5 bg-zinc-800 rounded-xl text-xs font-semibold text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStaffBypassSubmit}
                  className="py-2.5 bg-amber-500 hover:bg-amber-600 rounded-xl text-xs font-bold text-black"
                >
                  Authorize
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
