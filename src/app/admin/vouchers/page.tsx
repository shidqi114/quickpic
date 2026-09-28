'use client';

import React, { useState } from 'react';
import { VoucherCode } from '@/types/photobooth';
import { INITIAL_VOUCHERS } from '@/lib/constants';
import { Tag, Plus, Trash2, ArrowLeft, Check, Calendar, Sparkles } from 'lucide-react';
import Link from 'next/link';

export default function VoucherManagerPage() {
  const [vouchers, setVouchers] = useState<VoucherCode[]>(INITIAL_VOUCHERS);
  const [isCreating, setIsCreating] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newType, setNewType] = useState<'percentage' | 'fixed' | 'free'>('percentage');
  const [newValue, setNewValue] = useState<number>(20);
  const [newDesc, setNewDesc] = useState('');
  const [newDate, setNewDate] = useState('2026-12-31');

  const handleCreateVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) return;

    const voucher: VoucherCode = {
      code: newCode.trim().toUpperCase(),
      type: newType,
      value: newType === 'free' ? 100 : newValue,
      description: newDesc || (newType === 'free' ? 'Free Session Pass' : `${newValue}% OFF`),
      validUntil: newDate,
      isActive: true,
      usageCount: 0,
    };

    setVouchers([voucher, ...vouchers]);
    setIsCreating(false);
    setNewCode('');
    setNewDesc('');
  };

  const handleToggleActive = (code: string) => {
    setVouchers(
      vouchers.map((v) => (v.code === code ? { ...v, isActive: !v.isActive } : v))
    );
  };

  const handleDelete = (code: string) => {
    setVouchers(vouchers.filter((v) => v.code !== code));
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-10 flex flex-col items-center select-none">
      <div className="w-full max-w-5xl space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-3">
              <Link
                href="/admin"
                className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <h1 className="text-2xl font-black text-white">Voucher & Promo Code Management</h1>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Create discount promo codes or 100% free passes for influencers and events.
            </p>
          </div>

          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-pink-500/25 active:scale-95"
          >
            <Plus className="w-4 h-4" /> Create New Voucher
          </button>
        </header>

        {/* Create Modal Form */}
        {isCreating && (
          <form
            onSubmit={handleCreateVoucher}
            className="bg-zinc-900 border border-zinc-700/80 rounded-3xl p-6 space-y-4 animate-fade-in shadow-2xl"
          >
            <div className="flex items-center gap-2 text-pink-400 font-bold text-sm uppercase tracking-wider">
              <Sparkles className="w-4 h-4" /> New Voucher Details
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Promo Code</label>
                <input
                  type="text"
                  required
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  placeholder="e.g. FESTIVAL50"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono uppercase focus:outline-hidden focus:border-pink-500"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">Discount Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as 'percentage' | 'fixed' | 'free')}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-hidden focus:border-pink-500"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Cut (IDR)</option>
                  <option value="free">100% Free Pass</option>
                </select>
              </div>

              {newType !== 'free' && (
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">
                    {newType === 'percentage' ? 'Percentage (e.g. 20)' : 'Amount in IDR (e.g. 15000)'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newValue}
                    onChange={(e) => setNewValue(parseInt(e.target.value) || 0)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-hidden focus:border-pink-500 font-mono"
                  />
                </div>
              )}

              <div>
                <label className="text-xs text-zinc-400 block mb-1">Valid Until Date</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-hidden focus:border-pink-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1">Description / Customer Label</label>
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="e.g. 20% Grand Opening Discount"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-hidden focus:border-pink-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-xl text-xs font-bold"
              >
                Save Code
              </button>
            </div>
          </form>
        )}

        {/* Voucher List Table */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="font-bold text-white text-base">Active Promo Codes ({vouchers.length})</h2>
          </div>

          <div className="divide-y divide-zinc-800/80">
            {vouchers.map((v) => (
              <div key={v.code} className="p-5 flex items-center justify-between hover:bg-zinc-800/30 transition">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
                    <Tag className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-base text-white">{v.code}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          v.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        {v.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">{v.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right text-xs">
                    <div className="text-zinc-300 font-semibold">{v.usageCount} Redeemed</div>
                    <div className="text-zinc-500 text-[10px]">Valid until {v.validUntil}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(v.code)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                        v.isActive
                          ? 'border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                      }`}
                    >
                      {v.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => handleDelete(v.code)}
                      className="p-2 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
