'use client';

import React, { useState } from 'react';
import {
  Settings,
  Sparkles,
  Camera,
  Video,
  Film,
  Zap,
  Layout,
  Plus,
  Trash2,
  Check,
  RotateCcw,
  Sliders,
  Volume2,
  VolumeX,
  Printer,
  Eye,
  ArrowRight,
  Move,
  Layers,
  HelpCircle,
  Clock,
  ShieldCheck,
  CreditCard,
  Gift
} from 'lucide-react';
import { BoothSettings, FrameTemplate, FrameSlot, StripLayout } from '@/types/photobooth';
import { FRAME_TEMPLATES } from '@/lib/constants';

export type OperatingMode = 'regular' | 'event';
export type CaptureModeType = 'photo' | 'gif' | 'boomerang' | 'video';

export interface ExtendedOperatorSettings extends BoothSettings {
  operatingMode: OperatingMode;
  activeCaptureModes: CaptureModeType[];
  delayBetweenShots: number;
  reviewDurationSeconds: number;
}

interface OperatorSetupWizardProps {
  initialSettings: ExtendedOperatorSettings;
  currentTemplate: FrameTemplate;
  onSaveAndLaunch: (settings: ExtendedOperatorSettings, template: FrameTemplate) => void;
  onClose?: () => void;
}

type WizardTab = 'mode' | 'capture_modes' | 'canvas_builder' | 'timers';

export const OperatorSetupWizard: React.FC<OperatorSetupWizardProps> = ({
  initialSettings,
  currentTemplate,
  onSaveAndLaunch,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<WizardTab>('mode');
  const [settings, setSettings] = useState<ExtendedOperatorSettings>(initialSettings);
  const [template, setTemplate] = useState<FrameTemplate>(currentTemplate);
  const [selectedSlotId, setSelectedSlotId] = useState<string>(template.slots[0]?.id || 's1');

  // Snapping visual indicators
  const [activeSnapGuides, setActiveSnapGuides] = useState<{
    verticalCenter?: boolean;
    horizontalCenter?: boolean;
    topEdge?: boolean;
    bottomEdge?: boolean;
    leftEdge?: boolean;
    rightEdge?: boolean;
  }>({});

  // Canvas builder helper functions
  const handleSlotPositionChange = (slotId: string, changes: Partial<FrameSlot>) => {
    setTemplate((prev) => {
      const updatedSlots = prev.slots.map((s) => {
        if (s.id !== slotId) return s;
        let newX = changes.x !== undefined ? changes.x : s.x;
        let newY = changes.y !== undefined ? changes.y : s.y;
        let newWidth = changes.width !== undefined ? changes.width : s.width;
        let newHeight = changes.height !== undefined ? changes.height : s.height;

        // Snapping calculations (5% tolerance)
        const snapTolerance = 3;
        const guides = {
          verticalCenter: false,
          horizontalCenter: false,
          topEdge: false,
          bottomEdge: false,
          leftEdge: false,
          rightEdge: false,
        };

        // Snap to center
        const slotCenterX = newX + newWidth / 2;
        if (Math.abs(slotCenterX - 50) < snapTolerance) {
          newX = 50 - newWidth / 2;
          guides.verticalCenter = true;
        }

        const slotCenterY = newY + newHeight / 2;
        if (Math.abs(slotCenterY - 50) < snapTolerance) {
          newY = 50 - newHeight / 2;
          guides.horizontalCenter = true;
        }

        // Snap to edges (10% standard margin)
        if (Math.abs(newX - 8) < snapTolerance) {
          newX = 8;
          guides.leftEdge = true;
        }
        if (Math.abs(newX + newWidth - 92) < snapTolerance) {
          newX = 92 - newWidth;
          guides.rightEdge = true;
        }
        if (Math.abs(newY - 5) < snapTolerance) {
          newY = 5;
          guides.topEdge = true;
        }

        setActiveSnapGuides(guides);

        return {
          ...s,
          x: Math.max(0, Math.min(100 - newWidth, newX)),
          y: Math.max(0, Math.min(100 - newHeight, newY)),
          width: Math.max(15, Math.min(100, newWidth)),
          height: Math.max(10, Math.min(100, newHeight)),
        };
      });

      return { ...prev, slots: updatedSlots };
    });
  };

  const handleAddSlot = () => {
    if (template.slots.length >= 6) return;
    const newId = `s${Date.now() % 1000}`;
    const newSlot: FrameSlot = {
      id: newId,
      x: 8,
      y: Math.min(80, template.slots.length * 24 + 4),
      width: 84,
      height: 20,
      aspectRatio: 4 / 3,
    };
    setTemplate((prev) => ({
      ...prev,
      slotCount: prev.slots.length + 1,
      slots: [...prev.slots, newSlot],
    }));
    setSelectedSlotId(newId);
  };

  const handleRemoveSlot = (slotId: string) => {
    if (template.slots.length <= 1) return;
    setTemplate((prev) => ({
      ...prev,
      slotCount: prev.slots.length - 1,
      slots: prev.slots.filter((s) => s.id !== slotId),
    }));
    const remaining = template.slots.filter((s) => s.id !== slotId);
    if (remaining.length > 0) {
      setSelectedSlotId(remaining[0].id);
    }
  };

  const toggleCaptureMode = (mode: CaptureModeType) => {
    setSettings((prev) => {
      const exists = prev.activeCaptureModes.includes(mode);
      if (exists && prev.activeCaptureModes.length <= 1) return prev; // Keep at least one
      const updated = exists
        ? prev.activeCaptureModes.filter((m) => m !== mode)
        : [...prev.activeCaptureModes, mode];
      return { ...prev, activeCaptureModes: updated };
    });
  };

  const handleSelectPreset = (t: FrameTemplate) => {
    setTemplate(t);
    if (t.slots.length > 0) {
      setSelectedSlotId(t.slots[0].id);
    }
  };

  const currentSlot = template.slots.find((s) => s.id === selectedSlotId) || template.slots[0];

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/95 backdrop-blur-md text-zinc-100 flex flex-col select-none overflow-y-auto">
      {/* Top Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/80 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 via-purple-500 to-yellow-400 flex items-center justify-center shadow-lg shadow-pink-500/20">
            <Sliders className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
              LumaBooth Operator Wizard
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">
                Setup & Print Builder
              </span>
            </h1>
            <p className="text-xs text-zinc-400">Configure kiosk experience, layout canvas & capture timers</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition"
            >
              Cancel
            </button>
          )}
          <button
            onClick={() => onSaveAndLaunch(settings, template)}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 via-rose-500 to-yellow-400 hover:brightness-110 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-pink-500/25 active:scale-95 transition flex items-center gap-2"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            Save & Launch Kiosk
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-2 flex items-center gap-2 overflow-x-auto">
        {[
          { id: 'mode' as WizardTab, label: '1. Operating Mode', icon: ShieldCheck },
          { id: 'capture_modes' as WizardTab, label: '2. Capture Modes', icon: Camera },
          { id: 'canvas_builder' as WizardTab, label: '3. Print Layout Canvas', icon: Layout },
          { id: 'timers' as WizardTab, label: '4. Capture Timers & Audio', icon: Clock },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
                isActive
                  ? 'bg-pink-500 text-white shadow-md shadow-pink-500/30 ring-1 ring-pink-400'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content Body */}
      <div className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {/* TAB 1: OPERATING MODE */}
        {activeTab === 'mode' && (
          <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
            <div>
              <h2 className="text-2xl font-black text-white mb-2">Select Photobooth Operating Mode</h2>
              <p className="text-zinc-400 text-sm">
                Choose how guests interact with the kiosk. Event mode skips all payment gates for private parties.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Event Mode */}
              <div
                onClick={() => setSettings((s) => ({ ...s, operatingMode: 'event' }))}
                className={`p-6 rounded-3xl border-2 cursor-pointer transition-all duration-300 flex flex-col justify-between ${
                  settings.operatingMode === 'event'
                    ? 'bg-pink-500/10 border-pink-500 ring-4 ring-pink-500/20 shadow-2xl shadow-pink-500/20'
                    : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
                    <Gift className="w-6 h-6" />
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold text-white">Event Mode (No Paywall)</h3>
                    {settings.operatingMode === 'event' && (
                      <span className="px-2.5 py-1 rounded-full bg-pink-500 text-white text-[10px] font-black uppercase">
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                    Optimized for weddings, corporate brand activations, birthday bashes, and private parties.
                    Guests bypass the payment screen completely and start taking photos immediately upon touching the screen.
                  </p>
                  <ul className="text-xs text-zinc-300 space-y-2">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400" /> Instant capture flow without gatekeeping
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400" /> Unlimited free sessions for event guests
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400" /> Direct QR sharing & instant DNP printing
                    </li>
                  </ul>
                </div>
              </div>

              {/* Regular Mode */}
              <div
                onClick={() => setSettings((s) => ({ ...s, operatingMode: 'regular' }))}
                className={`p-6 rounded-3xl border-2 cursor-pointer transition-all duration-300 flex flex-col justify-between ${
                  settings.operatingMode === 'regular'
                    ? 'bg-pink-500/10 border-pink-500 ring-4 ring-pink-500/20 shadow-2xl shadow-pink-500/20'
                    : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-pink-500/20 text-pink-400 flex items-center justify-center mb-4">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold text-white">Regular Mode (Paywall)</h3>
                    {settings.operatingMode === 'regular' && (
                      <span className="px-2.5 py-1 rounded-full bg-pink-500 text-white text-[10px] font-black uppercase">
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                    For public retail venues, malls, and tourist spots. Guests choose their package, purchase extra prints, and scan dynamic QRIS payment before capturing.
                  </p>
                  <ul className="text-xs text-zinc-300 space-y-2">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-pink-400" /> Monetized package checkout & extra copy sales
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-pink-400" /> Dynamic QRIS simulation & promo vouchers
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-pink-400" /> Staff override PIN bypass (PIN 1144)
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Event Branding Details */}
            <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-3xl space-y-4 mt-6">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-yellow-400" /> Event Branding & Title
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Event / Booth Name</label>
                  <input
                    type="text"
                    value={settings.eventName}
                    onChange={(e) => setSettings((s) => ({ ...s, eventName: e.target.value }))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-pink-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Event Date / Subtitle</label>
                  <input
                    type="text"
                    value={settings.eventDate}
                    onChange={(e) => setSettings((s) => ({ ...s, eventDate: e.target.value }))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-pink-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Hashtag / Social</label>
                  <input
                    type="text"
                    value={settings.eventHashtag}
                    onChange={(e) => setSettings((s) => ({ ...s, eventHashtag: e.target.value }))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-pink-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={() => setActiveTab('capture_modes')}
                className="px-6 py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition"
              >
                Next: Capture Modes <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: CAPTURE MODES */}
        {activeTab === 'capture_modes' && (
          <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
            <div>
              <h2 className="text-2xl font-black text-white mb-2">Active Capture Capabilities</h2>
              <p className="text-zinc-400 text-sm">
                Enable or disable media types for this event. QuickPic dynamically adapts the capture engine.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  id: 'photo' as CaptureModeType,
                  name: 'DSLR Studio Photo',
                  desc: 'High-res Canon DSLR snapshot series for physical print strips.',
                  icon: Camera,
                },
                {
                  id: 'boomerang' as CaptureModeType,
                  name: 'Boomerang Live Photo',
                  desc: '5-second looped animated MP4/GIF accompanying each snapshot.',
                  icon: Film,
                },
                {
                  id: 'gif' as CaptureModeType,
                  name: 'Animated Multi-Shot GIF',
                  desc: 'Stitched animated sequence of all taken poses for instant TikTok/IG reels.',
                  icon: Zap,
                },
                {
                  id: 'video' as CaptureModeType,
                  name: 'Video Guestbook',
                  desc: '10-second audio/video message recording for the event host.',
                  icon: Video,
                },
              ].map((mode) => {
                const Icon = mode.icon;
                const isSelected = settings.activeCaptureModes.includes(mode.id);
                return (
                  <div
                    key={mode.id}
                    onClick={() => toggleCaptureMode(mode.id)}
                    className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-4 ${
                      isSelected
                        ? 'bg-pink-500/10 border-pink-500 ring-2 ring-pink-500/30'
                        : 'bg-zinc-900 border-zinc-800 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-pink-500 text-white' : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white">{mode.name}</h3>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="accent-pink-500 w-4 h-4 rounded cursor-pointer"
                        />
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">{mode.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between pt-4">
              <button
                onClick={() => setActiveTab('mode')}
                className="px-6 py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold uppercase tracking-wider transition"
              >
                Back
              </button>
              <button
                onClick={() => setActiveTab('canvas_builder')}
                className="px-6 py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition"
              >
                Next: Print Layout Canvas <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: PRINT LAYOUT CANVAS BUILDER */}
        {activeTab === 'canvas_builder' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-white mb-1">Print Layout Canvas Builder</h2>
                <p className="text-zinc-400 text-xs">
                  Drag, resize, and snap photo slots on the physical paper canvas. Snapping guides show automatically.
                </p>
              </div>

              {/* Template Presets */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {FRAME_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleSelectPreset(t)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap transition ${
                      template.id === t.id
                        ? 'border-pink-500 bg-pink-500/20 text-pink-300'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Canvas Viewport (7 cols) */}
              <div className="lg:col-span-7 bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 flex flex-col items-center justify-center relative min-h-[520px]">
                {/* Paper Canvas */}
                <div
                  className="relative shadow-2xl rounded-xl overflow-hidden border-2 transition-all"
                  style={{
                    backgroundColor: template.backgroundColor,
                    borderColor: template.accentColor,
                    width: template.category === 'strip' ? '220px' : '340px',
                    aspectRatio: template.category === 'strip' ? '1/3' : '2/3',
                  }}
                >
                  {/* Visual Snapping Guides (Dotted alignment lines) */}
                  {activeSnapGuides.verticalCenter && (
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 border-l-2 border-dashed border-cyan-400 z-30 pointer-events-none" />
                  )}
                  {activeSnapGuides.horizontalCenter && (
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 border-t-2 border-dashed border-cyan-400 z-30 pointer-events-none" />
                  )}
                  {activeSnapGuides.leftEdge && (
                    <div className="absolute inset-y-0 left-[8%] w-0.5 border-l-2 border-dotted border-pink-400 z-30 pointer-events-none" />
                  )}
                  {activeSnapGuides.rightEdge && (
                    <div className="absolute inset-y-0 right-[8%] w-0.5 border-r-2 border-dotted border-pink-400 z-30 pointer-events-none" />
                  )}
                  {activeSnapGuides.topEdge && (
                    <div className="absolute inset-x-0 top-[5%] h-0.5 border-t-2 border-dotted border-pink-400 z-30 pointer-events-none" />
                  )}

                  {/* Photo Slots */}
                  {template.slots.map((slot, idx) => {
                    const isSelected = selectedSlotId === slot.id;
                    return (
                      <div
                        key={slot.id}
                        onClick={() => setSelectedSlotId(slot.id)}
                        className={`absolute rounded-md cursor-pointer transition-all flex flex-col items-center justify-center ${
                          isSelected
                            ? 'ring-2 ring-pink-500 bg-pink-500/30 z-20 shadow-lg'
                            : 'ring-1 ring-zinc-500/50 bg-zinc-800/80 hover:bg-zinc-700/80 z-10'
                        }`}
                        style={{
                          left: `${slot.x}%`,
                          top: `${slot.y}%`,
                          width: `${slot.width}%`,
                          height: `${slot.height}%`,
                        }}
                      >
                        <span className="text-[10px] font-bold text-white bg-black/60 px-1.5 py-0.5 rounded">
                          Slot #{idx + 1}
                        </span>
                        <span className="text-[8px] text-zinc-300 mt-0.5 font-mono">
                          {Math.round(slot.width)}% × {Math.round(slot.height)}%
                        </span>
                      </div>
                    );
                  })}

                  {/* Canvas Footer Text */}
                  <div
                    className="absolute bottom-2 inset-x-0 text-center font-bold text-[9px] uppercase tracking-wider"
                    style={{ color: template.textColor }}
                  >
                    ⚡ {settings.eventName || 'QUICKPIC PHOTOBOOTH'}
                  </div>
                </div>

                {/* Snapping info badge */}
                <div className="mt-4 flex items-center gap-2 text-xs text-zinc-400">
                  <Move className="w-3.5 h-3.5 text-pink-400" />
                  <span>Dotted guides appear automatically when aligned to canvas center or edge margins</span>
                </div>
              </div>

              {/* Right Slot Adjustments Panel (5 cols) */}
              <div className="lg:col-span-5 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-6 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Layout className="w-4 h-4 text-pink-400" /> Slot Controls ({template.slots.length} Slots)
                    </h3>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleAddSlot}
                        disabled={template.slots.length >= 6}
                        className="p-2 rounded-xl bg-pink-500 hover:bg-pink-600 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1 transition"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Slot
                      </button>
                      <button
                        onClick={() => handleRemoveSlot(selectedSlotId)}
                        disabled={template.slots.length <= 1}
                        className="p-2 rounded-xl bg-zinc-800 hover:bg-rose-900/60 disabled:opacity-40 text-zinc-300 hover:text-rose-300 text-xs transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Slot Selector Pills */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    {template.slots.map((s, idx) => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedSlotId(s.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition ${
                          selectedSlotId === s.id
                            ? 'bg-pink-500 text-white'
                            : 'bg-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                      >
                        Slot #{idx + 1}
                      </button>
                    ))}
                  </div>

                  {/* Dimension Sliders for Selected Slot */}
                  {currentSlot && (
                    <div className="space-y-3 bg-zinc-950/60 p-4 rounded-2xl border border-zinc-800 text-xs">
                      <div>
                        <div className="flex justify-between mb-1 text-zinc-300 font-semibold">
                          <span>Horizontal Position (X)</span>
                          <span className="font-mono text-pink-400">{Math.round(currentSlot.x)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max={100 - currentSlot.width}
                          value={currentSlot.x}
                          onChange={(e) =>
                            handleSlotPositionChange(currentSlot.id, { x: parseFloat(e.target.value) })
                          }
                          className="w-full accent-pink-500 cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between mb-1 text-zinc-300 font-semibold">
                          <span>Vertical Position (Y)</span>
                          <span className="font-mono text-pink-400">{Math.round(currentSlot.y)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max={100 - currentSlot.height}
                          value={currentSlot.y}
                          onChange={(e) =>
                            handleSlotPositionChange(currentSlot.id, { y: parseFloat(e.target.value) })
                          }
                          className="w-full accent-pink-500 cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between mb-1 text-zinc-300 font-semibold">
                          <span>Slot Width</span>
                          <span className="font-mono text-pink-400">{Math.round(currentSlot.width)}%</span>
                        </div>
                        <input
                          type="range"
                          min="20"
                          max="96"
                          value={currentSlot.width}
                          onChange={(e) =>
                            handleSlotPositionChange(currentSlot.id, { width: parseFloat(e.target.value) })
                          }
                          className="w-full accent-pink-500 cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between mb-1 text-zinc-300 font-semibold">
                          <span>Slot Height</span>
                          <span className="font-mono text-pink-400">{Math.round(currentSlot.height)}%</span>
                        </div>
                        <input
                          type="range"
                          min="12"
                          max="60"
                          value={currentSlot.height}
                          onChange={(e) =>
                            handleSlotPositionChange(currentSlot.id, { height: parseFloat(e.target.value) })
                          }
                          className="w-full accent-pink-500 cursor-pointer"
                        />
                      </div>
                    </div>
                  )}

                  {/* Frame Theme Color Customization */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
                      Canvas Frame Colors
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[11px] text-zinc-400 block mb-1">Background</span>
                        <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-700 p-1.5 rounded-xl">
                          <input
                            type="color"
                            value={template.backgroundColor}
                            onChange={(e) => setTemplate((prev) => ({ ...prev, backgroundColor: e.target.value }))}
                            className="w-6 h-6 rounded border-0 cursor-pointer bg-transparent"
                          />
                          <span className="text-xs font-mono text-zinc-300">{template.backgroundColor}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[11px] text-zinc-400 block mb-1">Accent / Border</span>
                        <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-700 p-1.5 rounded-xl">
                          <input
                            type="color"
                            value={template.accentColor}
                            onChange={(e) => setTemplate((prev) => ({ ...prev, accentColor: e.target.value }))}
                            className="w-6 h-6 rounded border-0 cursor-pointer bg-transparent"
                          />
                          <span className="text-xs font-mono text-zinc-300">{template.accentColor}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between pt-4 border-t border-zinc-800">
                  <button
                    onClick={() => setActiveTab('capture_modes')}
                    className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold uppercase tracking-wider transition"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setActiveTab('timers')}
                    className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition"
                  >
                    Next: Timers & Audio <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CAPTURE TIMERS & HARDWARE */}
        {activeTab === 'timers' && (
          <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
            <div>
              <h2 className="text-2xl font-black text-white mb-2">Capture Timers, Audio & Hardware</h2>
              <p className="text-zinc-400 text-sm">
                Fine-tune countdown pacing, review display duration, and hardware peripherals.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Countdown Seconds */}
              <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-3xl space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-pink-400" /> Pose Countdown
                  </span>
                  <span className="text-sm font-mono text-pink-400 font-bold">
                    {settings.countdownSeconds} Seconds
                  </span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="10"
                  step="1"
                  value={settings.countdownSeconds}
                  onChange={(e) => setSettings((s) => ({ ...s, countdownSeconds: parseInt(e.target.value) }))}
                  className="w-full accent-pink-500 cursor-pointer"
                />
                <p className="text-[11px] text-zinc-400">
                  Time guests have to strike a pose before the DSLR shutter fires.
                </p>
              </div>

              {/* Review Duration Countdown */}
              <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-3xl space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-white flex items-center gap-2">
                    <Eye className="w-4 h-4 text-yellow-400" /> Post-Capture Review Duration
                  </span>
                  <span className="text-sm font-mono text-yellow-400 font-bold">
                    {settings.reviewDurationSeconds || 5} Seconds
                  </span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="12"
                  step="1"
                  value={settings.reviewDurationSeconds || 5}
                  onChange={(e) => setSettings((s) => ({ ...s, reviewDurationSeconds: parseInt(e.target.value) }))}
                  className="w-full accent-yellow-400 cursor-pointer"
                />
                <p className="text-[11px] text-zinc-400">
                  Countdown displayed right after the final shot, allowing guests to review or tap &apos;X&apos; to retake before slot mapping.
                </p>
              </div>

              {/* Audio & Visual FX */}
              <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-3xl space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-purple-400" /> Audio & Visual Cues
                </h3>
                <div className="space-y-2">
                  <label className="flex items-center justify-between p-2.5 bg-zinc-950 rounded-xl cursor-pointer">
                    <span className="text-xs text-zinc-300">Audible Beeps & Shutter Chime</span>
                    <input
                      type="checkbox"
                      checked={settings.playAudioCues}
                      onChange={(e) => setSettings((s) => ({ ...s, playAudioCues: e.target.checked }))}
                      className="accent-pink-500 w-4 h-4 rounded cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between p-2.5 bg-zinc-950 rounded-xl cursor-pointer">
                    <span className="text-xs text-zinc-300">Flash Screen Animation</span>
                    <input
                      type="checkbox"
                      checked={settings.showFlashEffect}
                      onChange={(e) => setSettings((s) => ({ ...s, showFlashEffect: e.target.checked }))}
                      className="accent-pink-500 w-4 h-4 rounded cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between p-2.5 bg-zinc-950 rounded-xl cursor-pointer">
                    <span className="text-xs text-zinc-300">Mirror Live View Camera</span>
                    <input
                      type="checkbox"
                      checked={settings.mirrorCamera}
                      onChange={(e) => setSettings((s) => ({ ...s, mirrorCamera: e.target.checked }))}
                      className="accent-pink-500 w-4 h-4 rounded cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* Hardware Daemon & Printer */}
              <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-3xl space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Printer className="w-4 h-4 text-emerald-400" /> DNP Hardware Printer
                </h3>
                <label className="flex items-center justify-between p-2.5 bg-zinc-950 rounded-xl cursor-pointer">
                  <span className="text-xs text-zinc-300">Auto-Spool to Local DNP Daemon</span>
                  <input
                    type="checkbox"
                    checked={settings.printEnabled}
                    onChange={(e) => setSettings((s) => ({ ...s, printEnabled: e.target.checked }))}
                    className="accent-pink-500 w-4 h-4 rounded cursor-pointer"
                  />
                </label>
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Local Daemon Endpoint</label>
                  <input
                    type="text"
                    value={settings.hardwareDaemonUrl || 'http://localhost:8000'}
                    onChange={(e) => setSettings((s) => ({ ...s, hardwareDaemonUrl: e.target.value }))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-pink-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-6">
              <button
                onClick={() => setActiveTab('canvas_builder')}
                className="px-6 py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold uppercase tracking-wider transition"
              >
                Back
              </button>
              <button
                onClick={() => onSaveAndLaunch(settings, template)}
                className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-yellow-400 hover:brightness-110 text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-pink-500/25 active:scale-95 transition flex items-center gap-2"
              >
                <Check className="w-5 h-5 stroke-[3]" />
                Launch Photobooth
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
