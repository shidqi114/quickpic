'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
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
  Printer,
  Eye,
  ArrowRight,
  ArrowLeft,
  Move,
  Clock,
  ShieldCheck,
  CreditCard,
  Gift,
  Palette,
  Sparkles,
  FileText,
  X,
  User,
  Store,
  LogOut,
  ChevronDown
} from 'lucide-react';
import { BoothSettings, FrameTemplate, FrameSlot, StripLayout, WelcomeScreenTheme, Outlet, OutletEvent } from '@/types/photobooth';
import { FRAME_TEMPLATES } from '@/lib/constants';
import { WELCOME_THEME_PRESETS } from './WelcomeScreen';
import {
  getUserOutlets,
  createOutlet,
  getOutletEvents,
  createOutletEvent,
  deleteOutletEvent,
  DEFAULT_DEMO_OUTLETS,
} from '@/lib/firebase';

export type OperatingMode = 'regular' | 'event';
export type CaptureModeType = 'photo' | 'gif' | 'boomerang' | 'video';

export interface EventProfile {
  id: string;
  name: string;
  date: string;
  hashtag: string;
  stripFooterText?: string;
  operatingMode?: OperatingMode;
  welcomeTheme?: WelcomeScreenTheme;
  createdAt: number;
}

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
  userAccountName?: string;
  outletName?: string;
  userId?: string;
  onSignOut?: () => void;
  onOutletChange?: (outlet: Outlet) => void;
}

const DEFAULT_EVENT_PROFILES: EventProfile[] = [
  {
    id: 'ev-1',
    name: 'Summer Gala 2026',
    date: 'OCT 2026',
    hashtag: '#QuickPicSummer',
    stripFooterText: '⚡ SUMMER GALA 2026',
    createdAt: 1,
  },
  {
    id: 'ev-2',
    name: 'Wedding Maya & Alex',
    date: '12.10.2026',
    hashtag: '#MayaAlexWedding',
    stripFooterText: '💍 MAYA & ALEX 2026',
    createdAt: 2,
  },
  {
    id: 'ev-3',
    name: 'Tech Summit 2026',
    date: 'NOV 2026',
    hashtag: '#TechSummit26',
    stripFooterText: '🚀 TECH SUMMIT 2026',
    createdAt: 3,
  },
  {
    id: 'ev-4',
    name: 'VIP Birthday Bash',
    date: '2026',
    hashtag: '#VIPBirthday',
    stripFooterText: '🎉 HAPPY BIRTHDAY VIP',
    createdAt: 4,
  },
];

export const OperatorSetupWizard: React.FC<OperatorSetupWizardProps> = ({
  initialSettings,
  currentTemplate,
  onSaveAndLaunch,
  userAccountName = 'Alex Pratama (Operator)',
  outletName = 'Grand Indonesia - Flagship',
  userId = 'usr-demo-01',
  onSignOut,
  onOutletChange,
}) => {
  // Page 1 vs Page 2 navigation state
  const [currentPage, setCurrentPage] = useState<1 | 2>(1);

  // Outlets State (Firebase collection: users/{userId}/outlets)
  const [outlets, setOutlets] = useState<Outlet[]>(DEFAULT_DEMO_OUTLETS);
  const [selectedOutlet, setSelectedOutlet] = useState<Outlet>(DEFAULT_DEMO_OUTLETS[0]);
  const [isOutletDropdownOpen, setIsOutletDropdownOpen] = useState(false);
  const [isAddOutletModalOpen, setIsAddOutletModalOpen] = useState(false);
  const outletDropdownRef = useRef<HTMLDivElement | null>(null);

  // New outlet modal form fields
  const [newOutletName, setNewOutletName] = useState('');
  const [newOutletLocation, setNewOutletLocation] = useState('');
  const [newOutletCode, setNewOutletCode] = useState('');

  // Event profiles state (stored inside the selected outlet: users/{userId}/outlets/{outletId}/events)
  const [events, setEvents] = useState<EventProfile[]>(DEFAULT_EVENT_PROFILES);
  const [activeEventId, setActiveEventId] = useState<string>('ev-1');
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);

  // New event modal form fields
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventHashtag, setNewEventHashtag] = useState('');
  const [newEventFooterText, setNewEventFooterText] = useState('');

  // Settings & Template state
  const [settings, setSettings] = useState<ExtendedOperatorSettings>(initialSettings);
  const [template, setTemplate] = useState<FrameTemplate>(currentTemplate);
  const [selectedSlotId, setSelectedSlotId] = useState<string>(template.slots[0]?.id || 's1');

  // Page 2 single template dropdown open/close state
  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
  const templateDropdownRef = useRef<HTMLDivElement | null>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (templateDropdownRef.current && !templateDropdownRef.current.contains(event.target as Node)) {
        setIsTemplateDropdownOpen(false);
      }
      if (outletDropdownRef.current && !outletDropdownRef.current.contains(event.target as Node)) {
        setIsOutletDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentUserId = userId || 'usr-demo-01';

  // 1. Fetch Outlets for this User on mount
  useEffect(() => {
    let isMounted = true;
    getUserOutlets(currentUserId).then((fetchedOutlets) => {
      if (!isMounted) return;
      if (fetchedOutlets && fetchedOutlets.length > 0) {
        setOutlets(fetchedOutlets);
        const match = fetchedOutlets.find((o) => o.name === outletName || o.id === outletName) || fetchedOutlets[0];
        setSelectedOutlet(match);
      }
    });
    return () => { isMounted = false; };
  }, [currentUserId, outletName]);

  // 2. Fetch Events for the Active Selected Outlet
  useEffect(() => {
    let isMounted = true;
    if (!selectedOutlet) return;
    getOutletEvents(currentUserId, selectedOutlet.id).then((fetchedEvents) => {
      if (!isMounted) return;
      if (fetchedEvents && fetchedEvents.length > 0) {
        setEvents(fetchedEvents);
        setActiveEventId(fetchedEvents[0].id);
        setSettings((s) => ({
          ...s,
          eventName: fetchedEvents[0].name,
          eventDate: fetchedEvents[0].date,
          eventHashtag: fetchedEvents[0].hashtag,
          operatingMode: (fetchedEvents[0].operatingMode as OperatingMode) || s.operatingMode,
          welcomeTheme: fetchedEvents[0].welcomeTheme || s.welcomeTheme,
        }));
      } else {
        setEvents([]);
      }
    });
    return () => { isMounted = false; };
  }, [currentUserId, selectedOutlet?.id]);

  // Handle Outlet Selection
  const handleSelectOutlet = (outlet: Outlet) => {
    setSelectedOutlet(outlet);
    setIsOutletDropdownOpen(false);
    onOutletChange?.(outlet);
  };

  // Handle Add New Outlet
  const handleCreateOutlet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOutletName.trim()) return;

    const created = await createOutlet(currentUserId, {
      name: newOutletName.trim(),
      location: newOutletLocation.trim() || 'Central Zone',
      code: newOutletCode.trim() || `OUT-${Math.floor(100 + Math.random() * 900)}`,
    });

    const updated = [...outlets, created];
    setOutlets(updated);
    setSelectedOutlet(created);
    onOutletChange?.(created);

    // Reset and close modal
    setNewOutletName('');
    setNewOutletLocation('');
    setNewOutletCode('');
    setIsAddOutletModalOpen(false);
  };

  // Handle Event selection
  const handleSelectEvent = (event: EventProfile) => {
    setActiveEventId(event.id);
    setSettings((prev) => ({
      ...prev,
      eventName: event.name,
      eventDate: event.date,
      eventHashtag: event.hashtag,
      operatingMode: event.operatingMode || prev.operatingMode,
      welcomeTheme: event.welcomeTheme || prev.welcomeTheme,
    }));
  };

  // Handle Add New Event Profile inside the Active Selected Outlet
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName.trim() || !selectedOutlet) return;

    const created = await createOutletEvent(currentUserId, selectedOutlet.id, {
      name: newEventName.trim(),
      date: newEventDate.trim() || '2026',
      hashtag: newEventHashtag.trim() || '#QuickPicBooth',
      stripFooterText: newEventFooterText.trim() || `⚡ ${newEventName.trim().toUpperCase()}`,
      operatingMode: settings.operatingMode,
      welcomeTheme: settings.welcomeTheme,
    });

    const updated = [created, ...events];
    setEvents(updated);
    handleSelectEvent(created);

    // Reset and close modal
    setNewEventName('');
    setNewEventDate('');
    setNewEventHashtag('');
    setNewEventFooterText('');
    setIsAddEventModalOpen(false);
  };

  // Handle Delete Event Profile from the Active Selected Outlet
  const handleDeleteEvent = async (e: React.MouseEvent, eventId: string) => {
    e.stopPropagation();
    if (!selectedOutlet || events.length <= 1) return;

    await deleteOutletEvent(currentUserId, selectedOutlet.id, eventId);
    const updated = events.filter((ev) => ev.id !== eventId);
    setEvents(updated);
    if (activeEventId === eventId && updated.length > 0) {
      handleSelectEvent(updated[0]);
    }
  };

  // Snapping visual indicators
  const [activeSnapGuides, setActiveSnapGuides] = useState<{
    verticalCenter?: boolean;
    horizontalCenter?: boolean;
    topEdge?: boolean;
    bottomEdge?: boolean;
    leftEdge?: boolean;
    rightEdge?: boolean;
  }>({});

  // Canvas builder slot position & snapping handler
  const handleSlotPositionChange = (slotId: string, changes: Partial<FrameSlot>) => {
    setTemplate((prev) => {
      const updatedSlots = prev.slots.map((s) => {
        if (s.id !== slotId) return s;
        let newX = changes.x !== undefined ? changes.x : s.x;
        let newY = changes.y !== undefined ? changes.y : s.y;
        let newWidth = changes.width !== undefined ? changes.width : s.width;
        let newHeight = changes.height !== undefined ? changes.height : s.height;

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

        // Snap to edges (8% standard margin)
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
      if (exists && prev.activeCaptureModes.length <= 1) return prev;
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
    setIsTemplateDropdownOpen(false);
  };

  const currentSlot = template.slots.find((s) => s.id === selectedSlotId) || template.slots[0];

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 text-zinc-100 flex flex-col select-none overflow-hidden h-screen w-screen p-3 md:p-4">
      
      {/* ========================================================================= */}
      {/* PAGE 1: EVENT FILES, OPERATING MODE, CAPTURE CAPABILITIES & THEMES        */}
      {/* ========================================================================= */}
      {currentPage === 1 && (
        <div className="grid grid-cols-12 gap-3.5 flex-1 h-full min-h-0 overflow-hidden animate-fade-in">
          
          {/* LEFT SIDE: Event Files Tray with Independent Auto-Scroll (col-span-3) */}
          <div className="col-span-12 lg:col-span-3 bg-zinc-900/90 border border-zinc-800/80 rounded-3xl p-4 flex flex-col h-full min-h-0 overflow-hidden shadow-xl">
            {/* Header with '+' button */}
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-pink-400" />
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  Event Files ({events.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddEventModalOpen(true)}
                title="Add New Event Profile"
                className="p-1.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white shadow-md shadow-pink-500/25 active:scale-90 transition flex items-center justify-center cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
              </button>
            </div>

            {/* Event Cards Tray with Independent Auto-Scroll */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0 divide-y-0">
              {events.map((ev) => {
                const isSelected = activeEventId === ev.id;
                return (
                  <div
                    key={ev.id}
                    onClick={() => handleSelectEvent(ev)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                      isSelected
                        ? 'bg-pink-500/20 border-pink-500 ring-2 ring-pink-500/30 text-white'
                        : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="text-xs font-bold truncate text-white mb-0.5">
                        {ev.name}
                      </div>
                      <div className="text-[10px] text-zinc-400 truncate">
                        {ev.date} • {ev.hashtag}
                      </div>
                    </div>

                    {/* Trash Delete Button */}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteEvent(e, ev.id)}
                      disabled={events.length <= 1}
                      title={events.length <= 1 ? 'Cannot delete last event' : `Delete ${ev.name}`}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-20 transition cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Active Event Branding Snippet (Pinned at bottom of tray) */}
            <div className="mt-3 pt-2.5 border-t border-zinc-800/80 shrink-0 bg-zinc-950/80 p-2.5 rounded-2xl border border-zinc-800/60 text-[10px] text-zinc-400">
              <span className="uppercase font-bold text-pink-400 block mb-0.5">
                Active Print Title:
              </span>
              <span className="font-bold text-white block truncate">{settings.eventName}</span>
              <span className="text-zinc-500 block truncate">{settings.eventDate} • {settings.eventHashtag}</span>
            </div>
          </div>

          {/* RIGHT 9 COLUMNS: Account Header Tray + Middle Config + Next Action */}
          <div className="col-span-12 lg:col-span-9 flex flex-col gap-3.5 h-full min-h-0 overflow-hidden justify-between">
            
            {/* TOP TRAY: User Account Name, Outlet Dropdown & Sign Out Button */}
            <div className="p-3 bg-zinc-900/90 border border-zinc-800/80 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-md z-30">
              <div className="flex items-center gap-4 text-xs">
                {/* User Account */}
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center font-bold">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block uppercase font-bold tracking-wider leading-none">Operator Account</span>
                    <span className="font-bold text-white text-xs">{userAccountName}</span>
                  </div>
                </div>

                <div className="h-6 w-px bg-zinc-800 hidden sm:block" />

                {/* Outlet Dropdown Selector */}
                <div className="relative" ref={outletDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsOutletDropdownOpen(!isOutletDropdownOpen)}
                    className="flex items-center gap-2.5 p-1.5 px-3 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/70 hover:border-amber-500/50 transition cursor-pointer text-left"
                  >
                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold shrink-0">
                      <Store className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col min-w-0 pr-1">
                      <span className="text-[9px] text-zinc-400 block uppercase font-bold tracking-wider leading-none">Outlet Location</span>
                      <span className="font-bold text-zinc-100 text-xs truncate max-w-[160px] sm:max-w-[220px]">
                        {selectedOutlet?.name || outletName}
                      </span>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${isOutletDropdownOpen ? 'rotate-180 text-amber-400' : ''}`} />
                  </button>

                  {/* Fixed-Size, Auto-Scrolling Dropdown Modal */}
                  {isOutletDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1.5 w-72 sm:w-80 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col animate-fade-in">
                      <div className="p-2 border-b border-zinc-800/80 flex items-center justify-between text-[11px] font-bold text-zinc-400 px-3 bg-zinc-950/40">
                        <span>Select Outlet</span>
                        <span className="text-[10px] text-zinc-500 font-normal">{outlets.length} available</span>
                      </div>

                      {/* Scrollable outlets list with fixed max height */}
                      <div className="max-h-60 overflow-y-auto p-1.5 flex flex-col gap-1">
                        {outlets.map((outlet) => {
                          const isSelected = selectedOutlet?.id === outlet.id;
                          return (
                            <button
                              key={outlet.id}
                              type="button"
                              onClick={() => handleSelectOutlet(outlet)}
                              className={`p-2.5 rounded-xl text-left flex items-start justify-between gap-2 transition cursor-pointer ${
                                isSelected
                                  ? 'bg-amber-500/20 border border-amber-500/50 text-white'
                                  : 'hover:bg-zinc-800/70 text-zinc-300'
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs truncate">{outlet.name}</span>
                                  {outlet.code && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-zinc-800 text-amber-400 border border-amber-500/20 shrink-0">
                                      {outlet.code}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-zinc-400 truncate mt-0.5">{outlet.location}</div>
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}
                            </button>
                          );
                        })}
                      </div>

                      {/* Add an outlet Button at the Very Bottom of Dropdown Modal */}
                      <div className="p-2 border-t border-zinc-800 bg-zinc-950/60">
                        <button
                          type="button"
                          onClick={() => {
                            setIsOutletDropdownOpen(false);
                            setIsAddOutletModalOpen(true);
                          }}
                          className="w-full py-2 px-3 rounded-xl bg-pink-500/15 hover:bg-pink-500/25 border border-pink-500/40 hover:border-pink-500 text-pink-300 hover:text-pink-200 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer active:scale-95"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add an outlet</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Functional Sign Out Button */}
              <button
                type="button"
                onClick={() => {
                  onSignOut?.();
                }}
                title="Sign out of operator session"
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-rose-950/60 border border-zinc-700/70 hover:border-rose-800 text-zinc-300 hover:text-rose-200 text-xs font-semibold transition active:scale-95 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>

            {/* Main Middle & Next Layout Grid (2 Columns: Config col-span-8 + Next Action col-span-4) */}
            <div className="grid grid-cols-12 gap-3.5 flex-1 min-h-0 overflow-hidden">
              
              {/* Middle Configuration Section (col-span-8) */}
              <div className="col-span-12 lg:col-span-8 flex flex-col gap-3 h-full min-h-0 justify-between">
                
                {/* Operating Mode */}
                <div className="p-3.5 bg-zinc-900/90 border border-zinc-800/80 rounded-2xl flex flex-col gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-pink-400" /> 1. Operating Mode
                  </span>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setSettings((s) => ({ ...s, operatingMode: 'event' }))}
                      className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition cursor-pointer ${
                        settings.operatingMode === 'event'
                          ? 'bg-pink-500/20 border-pink-500 ring-2 ring-pink-500/30'
                          : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <Gift className="w-4 h-4 text-emerald-400" />
                        {settings.operatingMode === 'event' && (
                          <span className="px-2 py-0.5 rounded-full bg-pink-500 text-white text-[9px] font-black uppercase">
                            Selected
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-bold text-white">Event Mode</div>
                      <div className="text-[10px] text-zinc-400">No Paywall • Free Sessions</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSettings((s) => ({ ...s, operatingMode: 'regular' }))}
                      className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition cursor-pointer ${
                        settings.operatingMode === 'regular'
                          ? 'bg-pink-500/20 border-pink-500 ring-2 ring-pink-500/30'
                          : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <CreditCard className="w-4 h-4 text-pink-400" />
                        {settings.operatingMode === 'regular' && (
                          <span className="px-2 py-0.5 rounded-full bg-pink-500 text-white text-[9px] font-black uppercase">
                            Selected
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-bold text-white">Regular Mode</div>
                      <div className="text-[10px] text-zinc-400">With Paywall • Monetized Prints</div>
                    </button>
                  </div>
                </div>

                {/* Capture Capabilities */}
                <div className="p-3.5 bg-zinc-900/90 border border-zinc-800/80 rounded-2xl flex flex-col gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-pink-400" /> 2. Capture Capabilities
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: 'photo' as CaptureModeType, name: 'DSLR Photo', icon: Camera },
                      { id: 'boomerang' as CaptureModeType, name: 'Boomerang', icon: Film },
                      { id: 'gif' as CaptureModeType, name: 'Multi-GIF', icon: Zap },
                      { id: 'video' as CaptureModeType, name: 'Video Book', icon: Video },
                    ].map((mode) => {
                      const Icon = mode.icon;
                      const isSelected = settings.activeCaptureModes.includes(mode.id);
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => toggleCaptureMode(mode.id)}
                          className={`p-2 rounded-xl border text-center flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                            isSelected
                              ? 'bg-pink-500/20 border-pink-500 text-white shadow-md'
                              : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-pink-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-[10px] font-bold truncate">{mode.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Welcoming Screen Themes (5 Themes) */}
                <div className="p-3.5 bg-zinc-900/90 border border-zinc-800/80 rounded-2xl flex flex-col gap-2 flex-1 min-h-0 justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-pink-400" /> 3. Welcoming Screen Theme (5 Presets)
                  </span>
                  <div className="grid grid-cols-5 gap-1.5">
                    {WELCOME_THEME_PRESETS.map((t) => {
                      const isSelected = (settings.welcomeTheme || 'neon_cyber') === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSettings((s) => ({ ...s, welcomeTheme: t.id }))}
                          title={`${t.name} - ${t.subtitle}`}
                          className={`flex flex-col items-center p-1.5 rounded-xl border transition cursor-pointer ${
                            isSelected
                              ? 'border-pink-500 bg-pink-500/20 ring-2 ring-pink-500/30'
                              : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700'
                          }`}
                        >
                          <div className={`w-full h-9 rounded-lg bg-gradient-to-tr ${t.previewGradient} shadow-md mb-1 flex items-center justify-center`}>
                            {isSelected && <Check className="w-3.5 h-3.5 text-white drop-shadow stroke-[3]" />}
                          </div>
                          <span className="text-[9px] font-bold text-zinc-200 truncate w-full text-center leading-tight">
                            {t.name.split(' ')[0]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Right Summary & Next Step Action (col-span-4) */}
              <div className="col-span-12 lg:col-span-4 bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-4 flex flex-col justify-between h-full min-h-0">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-300 text-[10px] font-bold uppercase">
                    <Sparkles className="w-3 h-3" /> Step 1 of 2
                  </div>
                  <h3 className="text-base font-black text-white">Event Configuration</h3>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Select your active event file on the left, operating mode, media capture modes, and welcome theme.
                  </p>

                  <div className="p-3 bg-zinc-950/80 rounded-xl border border-zinc-800/80 space-y-1.5 text-[11px]">
                    <div className="flex justify-between text-zinc-400">
                      <span>Event:</span>
                      <span className="font-bold text-white truncate max-w-[120px]">{settings.eventName}</span>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>Mode:</span>
                      <span className="font-bold text-emerald-400 uppercase text-[9px]">
                        {settings.operatingMode === 'event' ? 'Event Mode' : 'Regular Mode'}
                      </span>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>Theme:</span>
                      <span className="font-bold text-pink-400 uppercase text-[9px]">
                        {settings.welcomeTheme || 'neon_cyber'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Next Button */}
                <button
                  type="button"
                  onClick={() => setCurrentPage(2)}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-yellow-400 hover:brightness-110 text-white font-black text-xs uppercase tracking-wider shadow-xl shadow-pink-500/25 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Next: Layout & Timers</span>
                  <ArrowRight className="w-4 h-4 stroke-[3]" />
                </button>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* PAGE 2: PRINT LAYOUT TEMPLATE, SLOT CUSTOMIZATION, TIMERS & HARDWARE      */}
      {/* ========================================================================= */}
      {currentPage === 2 && (
        <div className="grid grid-cols-12 gap-3.5 flex-1 h-full min-h-0 overflow-hidden animate-fade-in">
          
          {/* LEFT SIDE: Strip Choosing Single Dropdown Box & Live Canvas Viewport (col-span-6) */}
          <div className="col-span-12 lg:col-span-6 bg-zinc-900/90 border border-zinc-800/80 rounded-3xl p-4 flex flex-col justify-between h-full min-h-0 overflow-hidden">
            
            {/* Single Dropdown Box for Template Selection (Fixed Size & Auto-Scroll) */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-zinc-800 relative z-30">
              
              {/* Dropdown Container */}
              <div ref={templateDropdownRef} className="relative flex-1 max-w-xs">
                <button
                  type="button"
                  onClick={() => setIsTemplateDropdownOpen((prev) => !prev)}
                  className="w-full h-10 px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-700/80 hover:border-pink-500 text-xs font-bold text-white flex items-center justify-between gap-2 transition cursor-pointer shadow-sm"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Layout className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                    <span className="truncate">{template.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 uppercase">
                      {template.slotCount} Slots
                    </span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isTemplateDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Fixed-Size Auto-Scrolling Dropdown Menu */}
                {isTemplateDropdownOpen && (
                  <div className="absolute top-12 left-0 w-full max-h-48 overflow-y-auto bg-zinc-950 border border-zinc-700 rounded-2xl shadow-2xl p-1.5 space-y-1 z-50 animate-fade-in">
                    {FRAME_TEMPLATES.map((t) => {
                      const isSelected = template.id === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => handleSelectPreset(t)}
                          className={`w-full px-3 py-2 rounded-xl text-xs font-semibold text-left flex items-center justify-between transition cursor-pointer ${
                            isSelected
                              ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40'
                              : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="truncate">{t.name}</span>
                            <span className="text-[9px] uppercase px-1 rounded bg-zinc-800 text-zinc-400 font-mono">
                              {t.category}
                            </span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-pink-400 shrink-0 stroke-[3]" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add / Remove Slot Controls */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleAddSlot}
                  disabled={template.slots.length >= 6}
                  className="px-2.5 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> Slot
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveSlot(selectedSlotId)}
                  disabled={template.slots.length <= 1}
                  className="p-2 rounded-xl bg-zinc-800 hover:bg-rose-900/60 disabled:opacity-40 text-zinc-300 hover:text-rose-300 text-xs transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Paper Canvas Viewport with Dotted Alignment Guidelines */}
            <div className="flex-1 flex items-center justify-center my-2 relative min-h-0 overflow-hidden">
              <div
                className="relative shadow-2xl rounded-xl overflow-hidden border-2 transition-all shrink-0"
                style={{
                  backgroundColor: template.backgroundColor,
                  borderColor: template.accentColor,
                  height: '84%',
                  aspectRatio: template.category === 'strip' ? '1/3' : '2/3',
                }}
              >
                {/* Visual Dotted Snapping Guides */}
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
                      className={`absolute rounded cursor-pointer transition-all flex flex-col items-center justify-center ${
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
                      <span className="text-[10px] font-bold text-white bg-black/70 px-1.5 py-0.5 rounded">
                        Slot #{idx + 1}
                      </span>
                    </div>
                  );
                })}

                {/* Footer Event Title */}
                <div
                  className="absolute bottom-1.5 inset-x-0 text-center font-bold text-[8px] uppercase tracking-wider truncate px-1"
                  style={{ color: template.textColor }}
                >
                  ⚡ {settings.eventName || 'QUICKPIC PHOTOBOOTH'}
                </div>
              </div>
            </div>

            {/* Helper Tag */}
            <div className="text-[10px] text-zinc-500 text-center">
              Tap any slot above to adjust position & dimensions on the right.
            </div>
          </div>

          {/* RIGHT SIDE: Slot Customization, Timers & Launch Action (col-span-6) */}
          <div className="col-span-12 lg:col-span-6 flex flex-col gap-3 h-full min-h-0 overflow-hidden justify-between">
            
            {/* Top Right: Customization of Selected Slot */}
            <div className="p-3.5 bg-zinc-900/90 border border-zinc-800/80 rounded-3xl flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Layout className="w-3.5 h-3.5 text-pink-400" /> Slot Customization (Slot #{template.slots.findIndex((s) => s.id === currentSlot?.id) + 1})
                </span>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-400 text-[10px]">Colors:</span>
                  <input
                    type="color"
                    value={template.backgroundColor}
                    onChange={(e) => setTemplate((prev) => ({ ...prev, backgroundColor: e.target.value }))}
                    title="Canvas Background"
                    className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent"
                  />
                  <input
                    type="color"
                    value={template.accentColor}
                    onChange={(e) => setTemplate((prev) => ({ ...prev, accentColor: e.target.value }))}
                    title="Border Accent"
                    className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent"
                  />
                </div>
              </div>

              {currentSlot && (
                <div className="grid grid-cols-2 gap-2.5 text-xs bg-zinc-950/80 p-2.5 rounded-2xl border border-zinc-800/80">
                  <div>
                    <div className="flex justify-between text-[10px] text-zinc-400 mb-0.5">
                      <span>Position X</span>
                      <span className="font-mono text-pink-400 font-bold">{Math.round(currentSlot.x)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={100 - currentSlot.width}
                      value={currentSlot.x}
                      onChange={(e) => handleSlotPositionChange(currentSlot.id, { x: parseFloat(e.target.value) })}
                      className="w-full accent-pink-500 cursor-pointer h-1.5"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-zinc-400 mb-0.5">
                      <span>Position Y</span>
                      <span className="font-mono text-pink-400 font-bold">{Math.round(currentSlot.y)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={100 - currentSlot.height}
                      value={currentSlot.y}
                      onChange={(e) => handleSlotPositionChange(currentSlot.id, { y: parseFloat(e.target.value) })}
                      className="w-full accent-pink-500 cursor-pointer h-1.5"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-zinc-400 mb-0.5">
                      <span>Width</span>
                      <span className="font-mono text-pink-400 font-bold">{Math.round(currentSlot.width)}%</span>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="96"
                      value={currentSlot.width}
                      onChange={(e) => handleSlotPositionChange(currentSlot.id, { width: parseFloat(e.target.value) })}
                      className="w-full accent-pink-500 cursor-pointer h-1.5"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-zinc-400 mb-0.5">
                      <span>Height</span>
                      <span className="font-mono text-pink-400 font-bold">{Math.round(currentSlot.height)}%</span>
                    </div>
                    <input
                      type="range"
                      min="12"
                      max="60"
                      value={currentSlot.height}
                      onChange={(e) => handleSlotPositionChange(currentSlot.id, { height: parseFloat(e.target.value) })}
                      className="w-full accent-pink-500 cursor-pointer h-1.5"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Right: Timers, Audio & Hardware Settings */}
            <div className="p-3.5 bg-zinc-900/90 border border-zinc-800/80 rounded-3xl flex flex-col gap-2 flex-1 min-h-0 justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-yellow-400" /> Capture Timers & Hardware
              </span>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div>
                  <div className="flex justify-between text-[10px] text-zinc-400 mb-0.5">
                    <span>Pose Countdown</span>
                    <span className="font-mono text-pink-400 font-bold">{settings.countdownSeconds}s</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="10"
                    step="1"
                    value={settings.countdownSeconds}
                    onChange={(e) => setSettings((s) => ({ ...s, countdownSeconds: parseInt(e.target.value) }))}
                    className="w-full accent-pink-500 cursor-pointer h-1.5"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[10px] text-zinc-400 mb-0.5">
                    <span>Review Duration</span>
                    <span className="font-mono text-yellow-400 font-bold">{settings.reviewDurationSeconds || 5}s</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="12"
                    step="1"
                    value={settings.reviewDurationSeconds || 5}
                    onChange={(e) => setSettings((s) => ({ ...s, reviewDurationSeconds: parseInt(e.target.value) }))}
                    className="w-full accent-yellow-400 cursor-pointer h-1.5"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                <label className="flex items-center justify-between p-2 bg-zinc-950/80 border border-zinc-800/60 rounded-xl cursor-pointer">
                  <span className="text-zinc-300">Audible Beeps</span>
                  <input
                    type="checkbox"
                    checked={settings.playAudioCues}
                    onChange={(e) => setSettings((s) => ({ ...s, playAudioCues: e.target.checked }))}
                    className="accent-pink-500 w-3.5 h-3.5 rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-2 bg-zinc-950/80 border border-zinc-800/60 rounded-xl cursor-pointer">
                  <span className="text-zinc-300">Flash Screen</span>
                  <input
                    type="checkbox"
                    checked={settings.showFlashEffect}
                    onChange={(e) => setSettings((s) => ({ ...s, showFlashEffect: e.target.checked }))}
                    className="accent-pink-500 w-3.5 h-3.5 rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-2 bg-zinc-950/80 border border-zinc-800/60 rounded-xl cursor-pointer">
                  <span className="text-zinc-300">Mirror Camera</span>
                  <input
                    type="checkbox"
                    checked={settings.mirrorCamera}
                    onChange={(e) => setSettings((s) => ({ ...s, mirrorCamera: e.target.checked }))}
                    className="accent-pink-500 w-3.5 h-3.5 rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-2 bg-zinc-950/80 border border-zinc-800/60 rounded-xl cursor-pointer">
                  <span className="text-zinc-300">DNP Spooler</span>
                  <input
                    type="checkbox"
                    checked={settings.printEnabled}
                    onChange={(e) => setSettings((s) => ({ ...s, printEnabled: e.target.checked }))}
                    className="accent-pink-500 w-3.5 h-3.5 rounded cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* Bottom Action Buttons: Back to Page 1 & Launch Photobooth */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                className="px-4 py-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-white font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={() => onSaveAndLaunch(settings, template)}
                className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-yellow-400 hover:brightness-110 text-white font-black text-xs uppercase tracking-wider shadow-xl shadow-pink-500/25 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Launch Photobooth</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* DISCRETE MODAL: ADD NEW EVENT PROFILE                                     */}
      {/* ========================================================================= */}
      {isAddEventModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-pink-400" /> Create New Event File
              </h3>
              <button
                type="button"
                onClick={() => setIsAddEventModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-3 text-xs">
              <div>
                <label className="text-zinc-400 block mb-1 font-semibold">Event Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Summer Gala 2026"
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white focus:outline-pink-500"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1 font-semibold">Subtitle / Date</label>
                <input
                  type="text"
                  placeholder="e.g. OCT 2026"
                  value={newEventDate}
                  onChange={(e) => setNewEventDate(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white focus:outline-pink-500"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1 font-semibold">Social Hashtag</label>
                <input
                  type="text"
                  placeholder="e.g. #QuickPicSummer"
                  value={newEventHashtag}
                  onChange={(e) => setNewEventHashtag(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white focus:outline-pink-500"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1 font-semibold">Strip Bottom Text (Printed on Photo)</label>
                <input
                  type="text"
                  placeholder="e.g. ⚡ QUICKPIC SUMMER GALA"
                  value={newEventFooterText}
                  onChange={(e) => setNewEventFooterText(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white focus:outline-pink-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddEventModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:brightness-110 text-white font-bold text-xs shadow-lg shadow-pink-500/25 transition cursor-pointer"
                >
                  Save & Select Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DISCRETE MODAL: ADD NEW OUTLET                                             */}
      {/* ========================================================================= */}
      {isAddOutletModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Store className="w-4 h-4 text-amber-400" /> Add New Outlet Location
              </h3>
              <button
                type="button"
                onClick={() => setIsAddOutletModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOutlet} className="space-y-3 text-xs">
              <div>
                <label className="text-zinc-400 block mb-1 font-semibold">Outlet Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Grand Indonesia - Flagship"
                  value={newOutletName}
                  onChange={(e) => setNewOutletName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white focus:outline-amber-500"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1 font-semibold">Location / Venue Details</label>
                <input
                  type="text"
                  placeholder="e.g. West Mall Level 3, Jakarta Pusat"
                  value={newOutletLocation}
                  onChange={(e) => setNewOutletLocation(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white focus:outline-amber-500"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1 font-semibold">Branch Code</label>
                <input
                  type="text"
                  placeholder="e.g. GI-01"
                  value={newOutletCode}
                  onChange={(e) => setNewOutletCode(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white focus:outline-amber-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddOutletModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-pink-500 hover:brightness-110 text-white font-bold text-xs shadow-lg shadow-amber-500/25 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Save Outlet</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
