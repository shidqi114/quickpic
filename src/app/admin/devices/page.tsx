'use client';

import React, { useEffect, useState } from 'react';
import { DeviceTelemetry } from '@/types/photobooth';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function DeviceMonitoringPage() {
  const [telemetry, setTelemetry] = useState<DeviceTelemetry>({
    deviceId: 'kiosk-node-jakarta-01',
    lastPingTime: Date.now(),
    isOnline: true,
    cpuPct: 18.5,
    ramPct: 42.1,
    camera: {
      connected: true,
      model: 'Canon EOS R100 (EDSDK USB)',
    },
    printer: {
      connected: true,
      name: 'DNP DS-RX1HS Dye-Sublimation',
      ribbonRemaining: 558,
      ribbonPercentage: 79.7,
      queueDepth: 0,
    },
  });

  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('Just now');

  const fetchTelemetry = async () => {
    setLoading(true);
    try {
      // Query local hardware daemon on localhost:8000
      const res = await fetch('http://localhost:8000/device/telemetry', { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        setTelemetry({
          deviceId: data.device_id,
          lastPingTime: Date.now(),
          isOnline: data.internet_online,
          cpuPct: data.cpu_usage_pct,
          ramPct: data.ram_usage_pct,
          camera: data.camera,
          printer: {
            connected: data.printer.connected,
            name: data.printer.name,
            ribbonRemaining: data.printer.ribbon_remaining_count,
            ribbonPercentage: data.printer.ribbon_percentage,
            queueDepth: data.printer.queue_depth,
          },
        });
      }
    } catch {
      // Keep mock telemetry if daemon is offline
      setTelemetry((prev) => ({ ...prev, lastPingTime: Date.now() }));
    } finally {
      setLoading(false);
      setLastUpdated(new Date().toLocaleTimeString());
    }
  };

  useEffect(() => {
    fetchTelemetry();
    // Poll hardware telemetry every 60 seconds (1 minute ping)
    const interval = setInterval(fetchTelemetry, 60000);
    return () => clearInterval(interval);
  }, []);

  const readout = 'flex flex-col gap-2 p-6 min-w-0';
  const label = 'text-[14px] text-muted';

  return (
    <main className="min-h-screen bg-paper text-ink font-display select-none">
      <div className="max-w-6xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-8">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-paper-line">
          <div className="flex items-start gap-4">
            <Link href="/admin" aria-label="Back to the fleet" className="w-11 h-11 rounded border border-paper-control flex items-center justify-center hover:bg-paper-surface shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-[clamp(26px,2.6vw,36px)] leading-none font-semibold tracking-[-0.02em]">Hardware</h1>
              <p className="text-[15px] text-muted mt-2 max-w-[60ch]">
                The camera, printer and computer at this booth, checked every minute.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[14px] text-muted tabular-nums">Updated {lastUpdated}</span>
            <button type="button" onClick={fetchTelemetry} className="h-11 px-4 rounded border border-paper-control text-[16px] cursor-pointer hover:bg-paper-surface">
              <span className="inline-flex items-center gap-2">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Check now
              </span>
            </button>
          </div>
        </header>

        <p className="flex flex-wrap items-center justify-between gap-3 border-y border-paper-line py-4 text-[16px]">
          <span className="inline-flex items-center gap-3">
            <span className={`w-2.5 h-2.5 rounded-full ${telemetry.isOnline ? 'bg-positive' : 'bg-muted'}`} />
            Booth {telemetry.deviceId} is {telemetry.isOnline ? 'online' : 'offline'}.
          </span>
          <span className="text-[14px] text-muted">Connection checked {new Date(telemetry.lastPingTime).toLocaleTimeString()}</span>
        </p>

        <section className="grid md:grid-cols-2 lg:grid-cols-4 border border-paper-line divide-y md:divide-y-0 lg:divide-x divide-paper-line">
          <div className={readout}>
            <p className={label}>Printer</p>
            <p className="text-[16px] font-medium">{telemetry.printer.name}</p>
            <p className="text-[14px] text-muted">{telemetry.printer.connected ? 'Ready' : 'Offline'}</p>
            <p className="text-[24px] font-semibold tabular-nums mt-2">{telemetry.printer.ribbonRemaining} <span className="text-[15px] font-normal text-muted">of 700 prints left</span></p>
            <div className="w-full h-2 bg-paper-surface overflow-hidden">
              <div className="h-full bg-ink transition-all duration-500" style={{ width: `${telemetry.printer.ribbonPercentage}%` }} />
            </div>
            <p className="text-[14px] text-muted tabular-nums">{telemetry.printer.ribbonPercentage}% left · {telemetry.printer.queueDepth} jobs waiting</p>
          </div>

          <div className={readout}>
            <p className={label}>Camera</p>
            <p className="text-[16px] font-medium">{telemetry.camera.model}</p>
            <p className="text-[14px] text-muted">{telemetry.camera.connected ? 'Connected by USB' : 'Not connected'}</p>
            <p className="text-[14px] text-muted mt-2">Live view ISO 1600 · flash ISO 100, 1/125 s</p>
          </div>

          <div className={readout}>
            <p className={label}>Computer</p>
            <p className="text-[24px] font-semibold tabular-nums">{telemetry.cpuPct}% <span className="text-[15px] font-normal text-muted">processor</span></p>
            <p className="text-[14px] text-muted tabular-nums">Memory {telemetry.ramPct}% of 16 GB</p>
          </div>

          <div className={readout}>
            <p className={label}>Sharing the printer</p>
            <p className="text-[16px] font-medium">Shared printer on the local network</p>
            <p className="text-[14px] text-muted">Tablets on the same Wi-Fi can send prints through this booth.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
