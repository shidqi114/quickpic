'use client';

import React, { useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, RefreshCw, Printer, Share2, Sparkles, Check, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { PhotoSession } from '@/types/photobooth';

interface ResultModalProps {
  session: PhotoSession | null;
  guestUrl: string;
  onReset: () => void;
  onPrint?: () => void;
}

export const ResultModal: React.FC<ResultModalProps> = ({
  session,
  guestUrl,
  onReset,
  onPrint,
}) => {
  useEffect(() => {
    if (session) {
      // Fire festive photobooth confetti
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ec4899', '#8b5cf6', '#06b6d4', '#fbbf24'],
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-5xl bg-zinc-900 border border-zinc-700/60 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[92vh]">
        
        {/* Left Side: Photo Strip Preview */}
        <div className="flex-1 bg-zinc-950 p-6 flex items-center justify-center overflow-y-auto">
          <div className="relative group max-h-[75vh] flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={session.compositeUrl}
              alt="Photobooth Strip"
              className="max-h-[70vh] w-auto rounded-lg shadow-2xl border border-zinc-800 object-contain transition duration-300"
            />
          </div>
        </div>

        {/* Right Side: QR Share & Actions */}
        <div className="w-full md:w-96 bg-zinc-900 p-6 md:p-8 flex flex-col justify-between border-t md:border-t-0 md:border-l border-zinc-800">
          <div>
            <div className="flex items-center gap-2 text-pink-400 text-sm font-semibold tracking-wide uppercase mb-1">
              <Sparkles className="w-4 h-4" />
              Your Photos Are Ready!
            </div>
            <h2 className="text-2xl font-bold text-white mb-6">Scan QR to Download</h2>

            {/* QR Code Card */}
            <div className="flex flex-col items-center justify-center bg-white p-6 rounded-2xl shadow-xl mb-6">
              <QRCodeSVG
                value={guestUrl || window.location.href}
                size={180}
                level="M"
                includeMargin={false}
              />
              <p className="text-zinc-700 text-xs font-semibold mt-3 text-center">
                Point your phone camera here to get high-res photos
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-semibold rounded-xl transition shadow-lg shadow-pink-500/25 active:scale-[0.98]"
            >
              <Download className="w-5 h-5" />
              Save to Device
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handlePrint}
                className="flex items-center justify-center gap-2 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium rounded-xl border border-zinc-700 transition active:scale-[0.98]"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>

              <button
                onClick={onReset}
                className="flex items-center justify-center gap-2 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium rounded-xl border border-zinc-700 transition active:scale-[0.98]"
              >
                <RefreshCw className="w-4 h-4" />
                New Shot
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
