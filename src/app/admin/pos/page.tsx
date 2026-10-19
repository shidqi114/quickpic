'use client';

import React, { useState } from 'react';
import { POSItem, QueueTicket } from '@/types/photobooth';
import { INITIAL_POS_ITEMS } from '@/lib/constants';
import { useOperatorT } from '@/lib/operatorStrings';
import { LanguageSwitch } from '@/components/ui/LanguageSwitch';
import { Plus, Minus, ArrowLeft } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import Link from 'next/link';

export default function POSAndQueuePage() {
  const { t } = useOperatorT();
  const [activeTab, setActiveTab] = useState<'pos' | 'queue'>('pos');

  // POS State
  const [cart, setCart] = useState<Record<string, number>>({});
  const [items, setItems] = useState<POSItem[]>(INITIAL_POS_ITEMS);
  const [posSuccess, setPosSuccess] = useState(false);

  // Queue State
  const [tickets, setTickets] = useState<QueueTicket[]>([
    { ticketNumber: 'Q-01', customerName: 'Rian & Sarah', packageName: 'Twin Strips', createdAt: Date.now() - 15 * 60000, estimatedWaitMinutes: 0, status: 'completed', qrVerificationCode: 'TKT-01-VERIFIED' },
    { ticketNumber: 'Q-02', customerName: 'Adit Team', packageName: 'VIP Live Photo', createdAt: Date.now() - 5 * 60000, estimatedWaitMinutes: 3, status: 'called', qrVerificationCode: 'TKT-02-VERIFIED' },
    { ticketNumber: 'Q-03', customerName: 'Maya', packageName: '4R Polaroid', createdAt: Date.now() - 1 * 60000, estimatedWaitMinutes: 8, status: 'waiting', qrVerificationCode: 'TKT-03-VERIFIED' },
  ]);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newPackageChoice, setNewPackageChoice] = useState('Classic Twin Strips');
  const [latestIssuedTicket, setLatestIssuedTicket] = useState<QueueTicket | null>(null);

  // Cart operations
  const addToCart = (id: string) => {
    setCart((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => {
      const copy = { ...prev };
      if (copy[id] > 1) {
        copy[id] -= 1;
      } else {
        delete copy[id];
      }
      return copy;
    });
  };

  const calculateTotal = () => {
    return Object.entries(cart).reduce((total, [id, qty]) => {
      const item = items.find((i) => i.id === id);
      return total + (item ? item.price * qty : 0);
    }, 0);
  };

  const handleCheckoutPOS = () => {
    setPosSuccess(true);
    setCart({});
    setTimeout(() => setPosSuccess(false), 3000);
  };

  // Queue ticketing
  const handleIssueTicket = (e: React.FormEvent) => {
    e.preventDefault();
    const nextNum = 'Q-' + String(tickets.length + 1).padStart(2, '0');
    const waitMins = tickets.filter((t) => t.status === 'waiting').length * 5 + 5;

    const newTicket: QueueTicket = {
      ticketNumber: nextNum,
      customerName: newCustomerName || 'Guest Customer',
      packageName: newPackageChoice,
      createdAt: Date.now(),
      estimatedWaitMinutes: waitMins,
      status: 'waiting',
      qrVerificationCode: `VERIFY_${nextNum}_${Date.now()}`,
    };

    setTickets([...tickets, newTicket]);
    setLatestIssuedTicket(newTicket);
    setNewCustomerName('');
  };

  const handleCallNext = (ticketNum: string) => {
    setTickets(tickets.map((t) => (t.ticketNumber === ticketNum ? { ...t, status: 'called' } : t)));
  };

  const handleCompleteTicket = (ticketNum: string) => {
    setTickets(tickets.map((t) => (t.ticketNumber === ticketNum ? { ...t, status: 'completed' } : t)));
  };

  const field = 'h-11 w-full px-3 rounded border border-paper-control bg-paper text-[16px] text-ink focus:outline-2 focus:outline-accent';
  const label = 'grid gap-2 text-[14px] font-medium';
  const tab = (on: boolean) =>
    `h-11 px-5 rounded text-[16px] cursor-pointer border ${on ? 'border-ink bg-ink text-white' : 'border-paper-control hover:bg-paper-surface'}`;
  const cartEmpty = Object.keys(cart).length === 0;

  return (
    <main className="min-h-screen bg-paper text-ink font-display select-none">
      <div className="max-w-6xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-8">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-paper-line">
          <div className="flex items-start gap-4">
            <Link href="/admin" aria-label={t('admin.backToFleet')} className="w-11 h-11 rounded border border-paper-control flex items-center justify-center hover:bg-paper-surface shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-[clamp(26px,2.6vw,36px)] leading-none font-semibold tracking-[-0.02em]">{t('pos.title')}</h1>
              <p className="text-[15px] text-muted mt-2 max-w-[60ch]">
                {t('pos.subtitle')}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <LanguageSwitch />
            <div className="flex gap-2" role="tablist">
              <button type="button" role="tab" aria-selected={activeTab === 'pos'} onClick={() => setActiveTab('pos')} className={tab(activeTab === 'pos')}>{t('pos.tabShop')}</button>
              <button type="button" role="tab" aria-selected={activeTab === 'queue'} onClick={() => setActiveTab('queue')} className={tab(activeTab === 'queue')}>{t('pos.tabQueue')}</button>
            </div>
          </div>
        </header>

        {activeTab === 'pos' && (
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] gap-10 animate-fade-in">
            <section className="flex flex-col gap-4">
              <h2 className="text-[20px] font-semibold tracking-tight">{t('pos.items')}</h2>
              <ul className="grid sm:grid-cols-2 border-t border-l border-paper-line">
                {items.map((item) => (
                  <li key={item.id} className="border-r border-b border-paper-line">
                    <button type="button" onClick={() => addToCart(item.id)} className="w-full h-full p-5 text-left flex flex-col justify-between gap-6 cursor-pointer hover:bg-paper-surface">
                      <span className="grid gap-1">
                        <span className="text-[14px] text-muted">{item.category}</span>
                        <span className="text-[17px] font-medium">{item.name}</span>
                      </span>
                      <span className="flex items-center justify-between text-[16px] tabular-nums">
                        <span>Rp {item.price.toLocaleString('id-ID')}</span>
                        <span className="text-accent font-medium">{t('pos.add')}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <aside className="flex flex-col gap-6 border-t lg:border-t-0 lg:border-l border-paper-line lg:pl-10 pt-6 lg:pt-0">
              <h2 className="text-[20px] font-semibold tracking-tight">{t('pos.order')}</h2>

              {cartEmpty ? (
                <p className="text-[15px] text-muted">{t('pos.emptyCart')}</p>
              ) : (
                <ul className="divide-y divide-paper-line border-y border-paper-line">
                  {Object.entries(cart).map(([id, qty]) => {
                    const item = items.find((i) => i.id === id);
                    if (!item) return null;
                    return (
                      <li key={id} className="py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[16px] font-medium truncate">{item.name}</p>
                          <p className="text-[14px] text-muted tabular-nums">Rp {item.price.toLocaleString('id-ID')} × {qty}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => removeFromCart(id)} aria-label={t('pos.removeOne', { name: item.name })} className="w-9 h-9 rounded border border-paper-control flex items-center justify-center hover:bg-paper-surface cursor-pointer">
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-6 text-center text-[16px] tabular-nums">{qty}</span>
                          <button type="button" onClick={() => addToCart(id)} aria-label={t('pos.addOne', { name: item.name })} className="w-9 h-9 rounded border border-paper-control flex items-center justify-center hover:bg-paper-surface cursor-pointer">
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="grid gap-4 mt-auto">
                <div className="flex items-baseline justify-between">
                  <span className="text-[15px] text-muted">{t('pos.total')}</span>
                  <span className="text-[28px] font-semibold tabular-nums">Rp {calculateTotal().toLocaleString('id-ID')}</span>
                </div>
                {posSuccess && (
                  <p role="status" className="text-[15px] text-positive">{t('pos.paid')}</p>
                )}
                <button
                  type="button"
                  disabled={cartEmpty}
                  onClick={handleCheckoutPOS}
                  className="h-14 rounded bg-accent hover:bg-accent-press text-white text-[17px] font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {t('pos.takePayment')}
                </button>
              </div>
            </aside>
          </div>
        )}

        {activeTab === 'queue' && (
          <div className="grid lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] gap-10 animate-fade-in">
            <section className="flex flex-col gap-6">
              <h2 className="text-[20px] font-semibold tracking-tight">{t('pos.newNumber')}</h2>

              <form onSubmit={handleIssueTicket} className="grid gap-4">
                <label className={label}>
                  {t('pos.name')}
                  <input type="text" required value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder={t('pos.nameHint')} className={field} />
                </label>
                <label className={label}>
                  {t('pos.package')}
                  <select value={newPackageChoice} onChange={(e) => setNewPackageChoice(e.target.value)} className={field}>
                    <option value="Classic Twin Strips">Classic Twin Strips</option>
                    <option value="4R Polaroid Vintage">4R Polaroid Vintage</option>
                    <option value="VIP Live Photo Quad">VIP Live Photo Quad</option>
                  </select>
                </label>
                <button type="submit" className="h-12 rounded bg-accent hover:bg-accent-press text-white text-[16px] font-medium cursor-pointer">
                  {t('pos.printTicket')}
                </button>
              </form>

              {latestIssuedTicket && (
                <div className="bg-white text-ink p-6 border border-paper-control flex flex-col items-center text-center gap-2">
                  <p className="text-[13px] text-muted">{t('pos.ticketLabel')}</p>
                  <p className="text-[40px] font-semibold tabular-nums leading-none">{latestIssuedTicket.ticketNumber}</p>
                  <p className="text-[15px]">{latestIssuedTicket.customerName}</p>
                  <p className="text-[14px] text-muted tabular-nums">{t('pos.aboutMinutes', { n: latestIssuedTicket.estimatedWaitMinutes })}</p>
                  <div className="pt-2">
                    <QRCodeSVG value={latestIssuedTicket.qrVerificationCode} size={96} level="M" />
                  </div>
                </div>
              )}
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-[20px] font-semibold tracking-tight">{t('pos.queueCount', { n: tickets.length })}</h2>
              <ul className="divide-y divide-paper-line border-y border-paper-line">
                {tickets.map((t_) => (
                  <li key={t_.ticketNumber} className="py-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="text-[20px] font-semibold tabular-nums w-16">{t_.ticketNumber}</span>
                      <div className="min-w-0">
                        <p className="text-[16px] font-medium truncate">
                          {t_.customerName}
                          <span className={`ml-3 text-[14px] font-normal ${t_.status === 'called' ? 'text-warning' : t_.status === 'completed' ? 'text-muted' : 'text-positive'}`}>
                            {t_.status === 'waiting' ? t('pos.waiting') : t_.status === 'called' ? t('pos.called') : t('pos.done')}
                          </span>
                        </p>
                        <p className="text-[14px] text-muted">{t_.packageName}</p>
                      </div>
                    </div>
                    {t_.status === 'waiting' && (
                      <button type="button" onClick={() => handleCallNext(t_.ticketNumber)} className="h-10 px-4 rounded border border-paper-control text-[15px] cursor-pointer hover:bg-paper-surface">
                        {t('pos.callNow')}
                      </button>
                    )}
                    {t_.status === 'called' && (
                      <button type="button" onClick={() => handleCompleteTicket(t_.ticketNumber)} className="h-10 px-4 rounded bg-accent hover:bg-accent-press text-white text-[15px] font-medium cursor-pointer">
                        {t('pos.markDone')}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
