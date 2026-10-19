'use client';

import React, { useState } from 'react';
import { VoucherCode } from '@/types/photobooth';
import { INITIAL_VOUCHERS } from '@/lib/constants';
import { useOperatorT } from '@/lib/operatorStrings';
import { LanguageSwitch } from '@/components/ui/LanguageSwitch';
import { Plus, ArrowLeft, Trash2 } from 'lucide-react';
import Link from 'next/link';

export default function VoucherManagerPage() {
  const { t } = useOperatorT();
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

  const field = 'h-11 w-full px-3 rounded border border-paper-control bg-paper text-[16px] text-ink focus:outline-2 focus:outline-accent';
  const label = 'grid gap-2 text-[14px] font-medium';
  const btnS = 'h-10 px-4 rounded border border-paper-control text-[15px] cursor-pointer hover:bg-paper-surface';

  return (
    <main className="min-h-screen bg-paper text-ink font-display select-none">
      <div className="max-w-5xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-8">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-paper-line">
          <div className="flex items-start gap-4">
            <Link href="/admin" aria-label={t('vouchers.back')} className="w-11 h-11 rounded border border-paper-control flex items-center justify-center hover:bg-paper-surface shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-[clamp(26px,2.6vw,36px)] leading-none font-semibold tracking-[-0.02em]">{t('vouchers.title')}</h1>
              <p className="text-[15px] text-muted mt-2 max-w-[60ch]">
                {t('vouchers.subtitle')}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <LanguageSwitch />
            <button type="button" onClick={() => setIsCreating(true)} className="h-11 px-5 rounded bg-accent hover:bg-accent-press text-white text-[16px] font-medium cursor-pointer">
              <span className="inline-flex items-center gap-2"><Plus className="w-4 h-4" /> {t('vouchers.new')}</span>
            </button>
          </div>
        </header>

        {isCreating && (
          <form onSubmit={handleCreateVoucher} className="border border-paper-control p-6 grid gap-5">
            <h2 className="text-[20px] font-semibold tracking-tight">{t('vouchers.new')}</h2>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <label className={label}>
                {t('vouchers.code')}
                <input type="text" required value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} placeholder={t('vouchers.codeHint')} className={`${field} tabular-nums`} />
              </label>
              <label className={label}>
                {t('vouchers.type')}
                <select value={newType} onChange={(e) => setNewType(e.target.value as 'percentage' | 'fixed' | 'free')} className={field}>
                  <option value="percentage">{t('vouchers.typePct')}</option>
                  <option value="fixed">{t('vouchers.typeFixed')}</option>
                  <option value="free">{t('vouchers.typeFree')}</option>
                </select>
              </label>
              {newType !== 'free' && (
                <label className={label}>
                  {newType === 'percentage' ? t('vouchers.percentOff') : t('vouchers.amountOff')}
                  <input type="number" min={1} value={newValue} onChange={(e) => setNewValue(parseInt(e.target.value) || 0)} className={`${field} tabular-nums`} />
                </label>
              )}
              <label className={label}>
                {t('vouchers.validUntil')}
                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className={field} />
              </label>
            </div>

            <label className={label}>
              {t('vouchers.description')}
              <input type="text" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder={t('vouchers.descHint')} className={field} />
            </label>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setIsCreating(false)} className={btnS}>{t('vouchers.cancel')}</button>
              <button type="submit" className="h-10 px-5 rounded bg-accent hover:bg-accent-press text-white text-[15px] font-medium cursor-pointer">{t('vouchers.save')}</button>
            </div>
          </form>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-[20px] font-semibold tracking-tight">{t('vouchers.all', { n: vouchers.length })}</h2>
          <ul className="divide-y divide-paper-line border-y border-paper-line">
            {vouchers.map((v) => (
              <li key={v.code} className="py-4 flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[17px] font-medium tabular-nums">
                    {v.code}
                    <span className={`ml-3 text-[14px] font-normal ${v.isActive ? 'text-positive' : 'text-muted'}`}>{v.isActive ? t('vouchers.active') : t('vouchers.off')}</span>
                  </p>
                  <p className="text-[15px] text-muted mt-1">{v.description}</p>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right text-[15px] tabular-nums">
                    <p>{t('vouchers.used', { n: v.usageCount })}</p>
                    <p className="text-[14px] text-muted">{t('vouchers.until', { date: v.validUntil })}</p>
                  </div>
                  <button type="button" onClick={() => handleToggleActive(v.code)} className={btnS}>
                    {v.isActive ? t('vouchers.turnOff') : t('vouchers.turnOn')}
                  </button>
                  <button type="button" onClick={() => handleDelete(v.code)} aria-label={t('vouchers.deleteCode', { code: v.code })} title={t('vouchers.delete')} className="w-10 h-10 rounded flex items-center justify-center text-muted hover:text-negative hover:bg-paper-surface cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
