'use client';

import React, { useState } from 'react';
import { ShieldCheck, Heart, Sparkles, Share2, Check, X } from 'lucide-react';
import { SocialConsent } from '@/types/photobooth';

interface ConsentModalProps {
  isOpen: boolean;
  onConfirmConsent: (consent: SocialConsent) => void;
}

export const ConsentModal: React.FC<ConsentModalProps> = ({
  isOpen,
  onConfirmConsent,
}) => {
  const [handle, setHandle] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-700/80 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col items-center text-center">
        
        {/* Top Icon Badge */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-pink-500 via-purple-500 to-yellow-400 flex items-center justify-center shadow-lg shadow-pink-500/30 mb-5">
          <Heart className="w-7 h-7 text-white fill-white" />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-black text-white mb-2">Feature on Social Media?</h2>
        <p className="text-sm text-zinc-300 max-w-sm mb-6 leading-relaxed">
          May we feature your amazing photo memory on our official Instagram page & live venue projector wall?
        </p>

        {/* Optional Social Media Handle */}
        <div className="w-full mb-6">
          <div className="relative flex items-center">
            <Share2 className="absolute left-4 w-4 h-4 text-pink-400" />
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="Your @instagram / social handle (optional for tag)"
              className="w-full bg-zinc-950 border border-zinc-700 focus:border-pink-500 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-white focus:outline-hidden transition"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full grid grid-cols-2 gap-3">
          <button
            onClick={() => onConfirmConsent({ granted: false, timestamp: Date.now() })}
            className="flex items-center justify-center gap-2 py-3.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-2xl border border-zinc-700 transition active:scale-95 text-sm"
          >
            <X className="w-4 h-4" />
            Keep Private
          </button>

          <button
            onClick={() => onConfirmConsent({ granted: true, customerHandle: handle, timestamp: Date.now() })}
            className="flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold rounded-2xl transition shadow-lg shadow-pink-500/25 active:scale-95 text-sm"
          >
            <Check className="w-4 h-4" />
            Yes, Share It!
          </button>
        </div>

        <p className="text-[11px] text-zinc-500 mt-4">
          Your softfiles and physical prints will proceed immediately either way.
        </p>
      </div>
    </div>
  );
};
