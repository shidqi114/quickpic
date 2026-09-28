'use client';

import React, { useState } from 'react';
import { POSItem, QueueTicket } from '@/types/photobooth';
import { INITIAL_POS_ITEMS } from '@/lib/constants';
import { ShoppingBag, Users, Plus, Minus, Printer, ArrowLeft, Check, Ticket, Sparkles, CreditCard } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import Link from 'next/link';

export default function POSAndQueuePage() {
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

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-10 flex flex-col items-center select-none">
      <div className="w-full max-w-6xl space-y-8">
        
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
              <h1 className="text-2xl font-black text-white">Operator POS & Queue System</h1>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Sell merchandise, extra photo frames, and manage live customer queue ticketing.
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center gap-2 p-1.5 bg-zinc-900 border border-zinc-800 rounded-2xl">
            <button
              onClick={() => setActiveTab('pos')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
                activeTab === 'pos' ? 'bg-pink-500 text-white shadow-md shadow-pink-500/25' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" /> Merchandise POS
            </button>
            <button
              onClick={() => setActiveTab('queue')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
                activeTab === 'queue' ? 'bg-pink-500 text-white shadow-md shadow-pink-500/25' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" /> Digital Queue Tickets
            </button>
          </div>
        </header>

        {/* TAB 1: POINT OF SALE (POS) */}
        {activeTab === 'pos' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            
            {/* Left Items Grid */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Available Merchandise</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => addToCart(item.id)}
                    className="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 hover:border-pink-500/50 cursor-pointer transition shadow-lg flex flex-col justify-between group"
                  >
                    <div>
                      <div className="text-xs text-pink-400 font-bold uppercase">{item.category}</div>
                      <div className="font-bold text-white text-base mt-1 group-hover:text-pink-300 transition">
                        {item.name}
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between">
                      <span className="font-black text-white text-sm">
                        Rp {item.price.toLocaleString('id-ID')}
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-pink-500/10 text-pink-400 text-xs font-bold group-hover:bg-pink-500 group-hover:text-white transition">
                        + Add
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Cart Summary */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex flex-col justify-between shadow-2xl">
              <div>
                <div className="flex items-center gap-2 text-pink-400 font-bold text-xs uppercase tracking-wider mb-2">
                  <CreditCard className="w-4 h-4" /> Current Order
                </div>
                <h3 className="text-xl font-bold text-white mb-4">Cart Summary</h3>

                {Object.keys(cart).length === 0 ? (
                  <div className="text-center py-12 text-zinc-500 text-xs">
                    Cart is empty. Tap any item on the left to add.
                  </div>
                ) : (
                  <div className="space-y-3 divide-y divide-zinc-800/80">
                    {Object.entries(cart).map(([id, qty]) => {
                      const item = items.find((i) => i.id === id);
                      if (!item) return null;
                      return (
                        <div key={id} className="pt-3 flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-xs text-white">{item.name}</div>
                            <div className="text-[11px] text-zinc-400">
                              Rp {item.price.toLocaleString('id-ID')} x {qty}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => removeFromCart(id)}
                              className="w-6 h-6 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-300"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-xs font-bold text-white w-4 text-center">{qty}</span>
                            <button
                              onClick={() => addToCart(id)}
                              className="w-6 h-6 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-300"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Total & Checkout */}
              <div className="pt-6 border-t border-zinc-800 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400 uppercase font-semibold">Total Amount</span>
                  <span className="text-2xl font-black text-pink-400">
                    Rp {calculateTotal().toLocaleString('id-ID')}
                  </span>
                </div>

                {posSuccess && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-semibold text-center">
                    Payment confirmed & recorded!
                  </div>
                )}

                <button
                  disabled={Object.keys(cart).length === 0}
                  onClick={handleCheckoutPOS}
                  className={`w-full py-4 rounded-2xl font-bold text-sm uppercase tracking-wider transition ${
                    Object.keys(cart).length === 0
                      ? 'opacity-40 bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white shadow-lg shadow-pink-500/25 active:scale-95'
                  }`}
                >
                  Confirm Cash / QRIS Payment
                </button>
              </div>

            </div>

          </div>
        )}

        {/* TAB 2: DIGITAL QUEUE TICKETING */}
        {activeTab === 'queue' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            
            {/* Left: Issue New Ticket Form */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-6">
              <div>
                <div className="flex items-center gap-2 text-pink-400 text-xs font-bold uppercase tracking-wider mb-1">
                  <Ticket className="w-4 h-4" /> Issue Ticket
                </div>
                <h3 className="text-xl font-bold text-white">Generate Queue Number</h3>
              </div>

              <form onSubmit={handleIssueTicket} className="space-y-4">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Customer / Group Name</label>
                  <input
                    type="text"
                    required
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="e.g. Nadya & Friends"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-hidden focus:border-pink-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Package Choice</label>
                  <select
                    value={newPackageChoice}
                    onChange={(e) => setNewPackageChoice(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-hidden focus:border-pink-500"
                  >
                    <option value="Classic Twin Strips">Classic Twin Strips</option>
                    <option value="4R Polaroid Vintage">4R Polaroid Vintage</option>
                    <option value="VIP Live Photo Quad">VIP Live Photo Quad</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-pink-500/25 active:scale-95"
                >
                  Print Queue Ticket (QR)
                </button>
              </form>

              {/* Latest Ticket Print Preview Card */}
              {latestIssuedTicket && (
                <div className="bg-white text-zinc-950 p-5 rounded-2xl shadow-xl flex flex-col items-center text-center space-y-2 border border-zinc-200">
                  <div className="text-[10px] font-bold tracking-widest uppercase text-zinc-500">
                    QuickPic Booth Queue
                  </div>
                  <div className="text-4xl font-black text-pink-600 tracking-wider">
                    {latestIssuedTicket.ticketNumber}
                  </div>
                  <div className="text-xs font-semibold">{latestIssuedTicket.customerName}</div>
                  <div className="text-[10px] text-zinc-500">
                    Est. Wait: ~{latestIssuedTicket.estimatedWaitMinutes} mins
                  </div>
                  <div className="pt-2">
                    <QRCodeSVG value={latestIssuedTicket.qrVerificationCode} size={90} level="M" />
                  </div>
                </div>
              )}
            </div>

            {/* Right: Live Queue Manager List */}
            <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                <h2 className="font-bold text-white text-base">Live Waiting Queue ({tickets.length})</h2>
              </div>

              <div className="divide-y divide-zinc-800/80">
                {tickets.map((t) => (
                  <div key={t.ticketNumber} className="p-5 flex items-center justify-between hover:bg-zinc-800/30 transition">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center font-black text-pink-400 text-lg">
                        {t.ticketNumber}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-base">{t.customerName}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              t.status === 'called'
                                ? 'bg-amber-500/20 text-amber-300 animate-pulse'
                                : t.status === 'completed'
                                ? 'bg-zinc-800 text-zinc-500'
                                : 'bg-emerald-500/10 text-emerald-400'
                            }`}
                          >
                            {t.status}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">{t.packageName}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {t.status === 'waiting' && (
                        <button
                          onClick={() => handleCallNext(t.ticketNumber)}
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-xl text-xs uppercase tracking-wider transition"
                        >
                          Call Now
                        </button>
                      )}
                      {t.status === 'called' && (
                        <button
                          onClick={() => handleCompleteTicket(t.ticketNumber)}
                          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition"
                        >
                          Mark Done
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

      </div>
    </main>
  );
}
