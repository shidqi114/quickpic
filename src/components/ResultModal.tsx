'use client';

import React, { useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { PhotoSession, WelcomeLanguage } from '@/types/photobooth';

interface ResultModalProps {
  session: PhotoSession | null;
  guestUrl: string;
  language?: WelcomeLanguage;
  onReset: () => void;
  onPrint?: () => void;
}

const COPY: Record<WelcomeLanguage, {
  kicker: string;
  title: string;
  qrCaption: string;
  save: string;
  print: string;
  newShot: string;
  alt: string;
}> = {
  en: {
    kicker: 'Your photos are ready',
    title: 'Scan to get your photos',
    qrCaption: 'Point your phone camera here for full-size photos',
    save: 'Save to device',
    print: 'Print',
    newShot: 'New session',
    alt: 'Your photo strip',
  },
  id: {
    kicker: 'Foto Anda sudah siap',
    title: 'Pindai untuk mendapat foto Anda',
    qrCaption: 'Arahkan kamera ponsel ke sini untuk foto ukuran penuh',
    save: 'Simpan ke perangkat',
    print: 'Cetak',
    newShot: 'Sesi baru',
    alt: 'Strip foto Anda',
  },
};

export const ResultModal: React.FC<ResultModalProps> = ({
  session,
  guestUrl,
  language = 'en',
  onReset,
  onPrint,
}) => {
  const copy = COPY[language];

  useEffect(() => {
    if (session) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#1a4be0', '#ffffff', '#111111'],
      });
    }
  }, [session]);

  if (!session) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.download = `photobooth-${session.id}.jpg`;
    link.href = session.compositeUrl;
    link.click();
  };

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
      return;
    }
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>QuickPic Print</title>
            <style>
              @page { size: auto; margin: 0; }
              body { margin: 0; display: flex; align-items: center; justify-content: center; background: #fff; }
              img { max-width: 100vw; max-height: 100vh; object-fit: contain; }
            </style>
          </head>
          <body>
            <img src="${session.compositeUrl}" onload="window.print(); window.close();" />
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stage text-stage-ink font-display select-none overflow-y-auto">
      <div className="min-h-screen grid lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
        <div className="bg-stage-2 p-8 flex items-center justify-center min-h-[60vh]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={session.compositeUrl}
            alt={copy.alt}
            className="max-h-[84vh] w-auto object-contain"
          />
        </div>

        <div className="p-8 md:p-10 flex flex-col justify-between gap-10 border-t lg:border-t-0 lg:border-l border-stage-line">
          <div className="grid gap-5">
            <p className="text-[18px] text-stage-muted">{copy.kicker}</p>
            <h2 className="text-[clamp(36px,3.4vw,56px)] leading-none font-semibold tracking-[-0.03em]">{copy.title}</h2>
            <div className="bg-white text-ink p-6 rounded grid justify-items-center gap-3">
              <QRCodeSVG value={guestUrl || window.location.href} size={220} level="M" includeMargin={false} />
              <p className="text-[15px] text-center text-muted">{copy.qrCaption}</p>
            </div>
          </div>

          <div className="grid gap-3">
            <button
              type="button"
              onClick={handleDownload}
              className="h-16 rounded bg-accent hover:bg-accent-press text-white text-[19px] font-medium cursor-pointer active:translate-y-px"
            >
              {copy.save}
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handlePrint}
                className="h-16 rounded border border-stage-muted/50 text-[19px] cursor-pointer hover:bg-white/10"
              >
                {copy.print}
              </button>
              <button
                type="button"
                onClick={onReset}
                className="h-16 rounded border border-stage-muted/50 text-[19px] cursor-pointer hover:bg-white/10"
              >
                {copy.newShot}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
