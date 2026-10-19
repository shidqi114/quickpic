'use client';

import React, { useState } from 'react';
import { SocialConsent, WelcomeLanguage } from '@/types/photobooth';

interface ConsentModalProps {
  isOpen: boolean;
  language?: WelcomeLanguage;
  onConfirmConsent: (consent: SocialConsent) => void;
}

const COPY: Record<WelcomeLanguage, {
  title: string;
  body: string;
  handlePlaceholder: string;
  keep: string;
  share: string;
  note: string;
}> = {
  en: {
    title: 'Share your photo?',
    body: 'May we feature your photo on our Instagram and on the venue screen? Your prints go ahead either way.',
    handlePlaceholder: 'Your @handle (optional, so we can tag you)',
    keep: 'Keep private',
    share: 'Yes, share it',
    note: 'Your strips print either way.',
  },
  id: {
    title: 'Bagikan foto Anda?',
    body: 'Boleh kami tampilkan foto Anda di Instagram kami dan di layar venue? Cetakan Anda tetap diproses.',
    handlePlaceholder: 'Akun @Anda (opsional, agar kami bisa menandai)',
    keep: 'Simpan privat',
    share: 'Ya, bagikan',
    note: 'Strip Anda tetap dicetak.',
  },
};

export const ConsentModal: React.FC<ConsentModalProps> = ({
  isOpen,
  language = 'en',
  onConfirmConsent,
}) => {
  const [handle, setHandle] = useState('');
  const copy = COPY[language];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-stage text-stage-ink font-display select-none flex items-center justify-center p-6">
      <div className="w-full max-w-[640px] grid gap-8">
        <div className="grid gap-4">
          <h2 className="text-[clamp(36px,4vw,56px)] leading-none font-semibold tracking-[-0.03em]">{copy.title}</h2>
          <p className="text-[clamp(18px,1.5vw,22px)] text-stage-muted leading-normal">{copy.body}</p>
        </div>

        <label className="sr-only" htmlFor="consent-handle">{copy.handlePlaceholder}</label>
        <input
          id="consent-handle"
          type="text"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder={copy.handlePlaceholder}
          className="h-16 px-5 rounded border border-stage-line bg-stage-2 text-[20px] placeholder:text-stage-muted/70 focus:outline-2 focus:outline-accent"
        />

        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => onConfirmConsent({ granted: false, timestamp: Date.now() })}
            className="h-16 rounded border border-stage-muted/50 text-[19px] cursor-pointer hover:bg-white/10"
          >
            {copy.keep}
          </button>
          <button
            type="button"
            onClick={() => onConfirmConsent({ granted: true, customerHandle: handle, timestamp: Date.now() })}
            className="h-16 rounded bg-accent hover:bg-accent-press text-white text-[19px] font-medium cursor-pointer active:translate-y-px"
          >
            {copy.share}
          </button>
        </div>

        <p className="text-[16px] text-stage-muted">{copy.note}</p>
      </div>
    </div>
  );
};
