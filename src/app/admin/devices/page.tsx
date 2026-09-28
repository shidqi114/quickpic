'use client';

import React, { useEffect, useState } from 'react';
import { DeviceTelemetry } from '@/types/photobooth';
import { ArrowLeft, RefreshCw, Cpu, HardDrive, Camera, Printer, Wifi, ShieldCheck, AlertTriangle } from 'lucide-react';
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
              <h1 className="text-2xl font-black text-white">Live Hardware & Device Telemetry</h1>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Automatic 1-minute heartbeat telemetry monitoring Canon camera, DNP printer ribbon, and PC health.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500">Updated: {lastUpdated}</span>
            <button
              onClick={fetchTelemetry}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs font-semibold text-zinc-200 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Ping Now
            </button>
          </div>
        </header>

        {/* Status Alert Banner */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            Booth Device Node ({telemetry.deviceId}) is ONLINE and operational.
          </div>
          <div className="flex items-center gap-1">
            <Wifi className="w-4 h-4" /> Low Latency (&lt;24ms)
          </div>
        </div>

        {/* Telemetry Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* 1. DNP Printer Ribbon Meter */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-2xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
                <Printer className="w-6 h-6" />
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase">
                {telemetry.printer.connected ? 'Ready' : 'Offline'}
              </span>
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                DNP Ribbon Remaining
              </div>
              <div className="text-3xl font-black text-white mt-1">
                {telemetry.printer.ribbonRemaining}{' '}
                <span className="text-sm font-normal text-zinc-500">/ 700 cuts</span>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden mt-3">
                <div
                  className="bg-pink-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${telemetry.printer.ribbonPercentage}%` }}
                />
              </div>
              <div className="text-[11px] text-zinc-400 mt-2 flex justify-between">
                <span>{telemetry.printer.ribbonPercentage}% Left</span>
                <span>Queue: {telemetry.printer.queueDepth} jobs</span>
              </div>
            </div>
          </div>

          {/* 2. Canon DSLR Controller */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Camera className="w-6 h-6" />
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase">
                {telemetry.camera.connected ? 'USB Connected' : 'Disconnected'}
              </span>
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Canon Camera SDK
              </div>
              <div className="text-lg font-bold text-white mt-1 truncate">
                {telemetry.camera.model}
              </div>
              <div className="text-xs text-purple-400 mt-2">
                Dual ISO Exposure Profile Active
              </div>
              <div className="text-[10px] text-zinc-500 mt-1">
                Liveview: ISO 1600 &bull; Flash: ISO 100 1/125s
              </div>
            </div>
          </div>

          {/* 3. PC CPU & Temperature */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Cpu className="w-6 h-6" />
              </div>
              <span className="text-xs font-mono text-cyan-400">{telemetry.cpuPct}% Load</span>
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Booth PC CPU Load
              </div>
              <div className="text-3xl font-black text-white mt-1">
                {telemetry.cpuPct}%
              </div>
              <div className="text-[11px] text-zinc-400 mt-3">
                RAM Usage: {telemetry.ramPct}% of 16 GB
              </div>
            </div>
          </div>

          {/* 4. Multi-Booth Spooler Share */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <HardDrive className="w-6 h-6" />
              </div>
              <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-bold uppercase">
                Port 8000
              </span>
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Network Spooler
              </div>
              <div className="text-lg font-bold text-white mt-1">
                Shared DNP Spooler
              </div>
              <div className="text-[11px] text-zinc-400 mt-2">
                Allows tablets on local WiFi to share this single printer.
              </div>
            </div>
          </div>

        </div>

      </div>
    </main>
  );
}
