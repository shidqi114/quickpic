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
  ChevronDown,
  RefreshCw,
  Upload,
  Scan,
  Wand2,
  ImagePlus,
  Pencil,
  Usb,
} from 'lucide-react';
import { BoothSettings, FrameTemplate, FrameSlot, StripLayout, WelcomeScreenTheme, Outlet, OutletEvent } from '@/types/photobooth';
import { FRAME_TEMPLATES } from '@/lib/constants';
import { detectTemplateSlots } from '@/lib/slotDetector';
import { WELCOME_THEME_PRESETS } from './WelcomeScreen';
import {
  getUserOutlets,
  createOutlet,
  updateOutlet,
  deleteOutlet,
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
  customWelcomeImageUrl?: string;
  customWelcomeHeadline?: string;
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

import { SettingsModal } from '@/components/SettingsModal';
import { LanguageSwitch } from '@/components/ui/LanguageSwitch';

const INPUT = 'h-11 w-full px-3 rounded border border-paper-control bg-paper text-[16px] text-ink placeholder:text-muted focus:outline-2 focus:outline-accent';
const LABEL = 'text-[14px] font-medium text-ink';
const BTN_P = 'h-12 px-5 rounded bg-accent hover:bg-accent-press text-white text-[16px] font-medium cursor-pointer';
const BTN_S = 'h-12 px-5 rounded border border-paper-control text-[16px] text-ink cursor-pointer hover:bg-paper-surface';

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
  const [isBoothSettingsOpen, setIsBoothSettingsOpen] = useState(false);

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

  // Edit outlet modal state
  const [isEditOutletModalOpen, setIsEditOutletModalOpen] = useState(false);
  const [editingOutletId, setEditingOutletId] = useState<string | null>(null);
  const [editOutletName, setEditOutletName] = useState('');
  const [editOutletLocation, setEditOutletLocation] = useState('');
  const [editOutletCode, setEditOutletCode] = useState('');

  // Event profiles state (stored inside the selected outlet: users/{userId}/outlets/{outletId}/events)
  const [events, setEvents] = useState<EventProfile[]>(DEFAULT_EVENT_PROFILES);
  const [activeEventId, setActiveEventId] = useState<string>('ev-1');
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);

  // New event modal form fields
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventHashtag, setNewEventHashtag] = useState('');
  const [newEventFooterText, setNewEventFooterText] = useState('');

  // USB Printer setup modal & telemetry state
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState(false);
  const [selectedPrinterModel, setSelectedPrinterModel] = useState<string>('DNP DS-RX1HS');
  const [selectedPaperFormat, setSelectedPaperFormat] = useState<'strip-2x6' | 'photo-4x6'>('strip-2x6');
  const [printerUsbStatus, setPrinterUsbStatus] = useState<'connected' | 'checking' | 'disconnected'>('connected');
  const [printerRibbonCuts, setPrinterRibbonCuts] = useState<number>(558);
  const [printerTotalCapacity, setPrinterTotalCapacity] = useState<number>(700);
  const [isScanningPrinters, setIsScanningPrinters] = useState<boolean>(false);
  const [isTestingPrint, setIsTestingPrint] = useState<boolean>(false);
  const [printTestMessage, setPrintTestMessage] = useState<string | null>(null);

  // Settings & Template state
  const [settings, setSettings] = useState<ExtendedOperatorSettings>(initialSettings);
  const [template, setTemplate] = useState<FrameTemplate>(currentTemplate);
  const [selectedSlotId, setSelectedSlotId] = useState<string>(template.slots[0]?.id || 's1');

  // Custom Strip Templates & Auto-Detection state
  const [customTemplates, setCustomTemplates] = useState<FrameTemplate[]>([]);
  const [isAnalyzingTemplate, setIsAnalyzingTemplate] = useState<boolean>(false);
  const [detectionBanner, setDetectionBanner] = useState<string | null>(null);
  const templateFileInputRef = useRef<HTMLInputElement | null>(null);
  const welcomeFileInputRef = useRef<HTMLInputElement | null>(null);

  // Page 2 single template dropdown open/close state
  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
  const templateDropdownRef = useRef<HTMLDivElement | null>(null);

  // Slot Customization Dropdown state
  const [isSlotCustomizationOpen, setIsSlotCustomizationOpen] = useState(false);
  const slotCustomizationRef = useRef<HTMLDivElement | null>(null);

  // Camera device detection & status state
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(settings.cameraDeviceId || '');
  const [dslrConnected, setDslrConnected] = useState<boolean>(false);
  const [dslrModel, setDslrModel] = useState<string>('Canon DSLR');
  const [cameraStatus, setCameraStatus] = useState<'connected' | 'checking' | 'disconnected'>('checking');
  const [isProbingDevices, setIsProbingDevices] = useState<boolean>(false);

  // Probes hardware companion daemon for DSLR & browser for Webcams
  const refreshCameraDevices = async () => {
    setIsProbingDevices(true);
    setCameraStatus('checking');
    try {
      // 1. Check DSLR Hardware Companion Daemon
      let isDslrFound = false;
      try {
        const res = await fetch('http://localhost:8000/camera/status', { signal: AbortSignal.timeout(1200) });
        if (res.ok) {
          const data = await res.json();
          if (data.connected) {
            setDslrConnected(true);
            setDslrModel(data.model || 'Canon DSLR');
            isDslrFound = true;
          } else {
            setDslrConnected(false);
          }
        } else {
          setDslrConnected(false);
        }
      } catch {
        setDslrConnected(false);
      }

      // 2. Check Web / USB Camera Devices
      if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          stream.getTracks().forEach((t) => t.stop());
        } catch {
          // Ignore error if already allowed or denied
        }

        const all = await navigator.mediaDevices.enumerateDevices();
        const vInputs = all.filter((d) => d.kind === 'videoinput');
        setVideoDevices(vInputs);

        if (settings.useDslr) {
          setCameraStatus(isDslrFound ? 'connected' : 'disconnected');
        } else if (vInputs.length > 0) {
          setCameraStatus('connected');
          if (!selectedDeviceId && vInputs[0].deviceId) {
            setSelectedDeviceId(vInputs[0].deviceId);
            setSettings((s) => ({ ...s, cameraDeviceId: vInputs[0].deviceId }));
          }
        } else {
          setCameraStatus('disconnected');
        }
      }
    } catch (err) {
      console.warn('Camera device probe error:', err);
      setCameraStatus('disconnected');
    } finally {
      setIsProbingDevices(false);
    }
  };

  useEffect(() => {
    refreshCameraDevices();
  }, [settings.useDslr]);

  const handleDeviceChange = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    setSettings((s) => ({ ...s, cameraDeviceId: deviceId }));
    setCameraStatus('connected');
  };

  const handleSelectCameraType = (type: 'webcam' | 'dslr') => {
    const isDslr = type === 'dslr';
    setSettings((s) => ({ ...s, useDslr: isDslr }));
    if (isDslr) {
      setCameraStatus(dslrConnected ? 'connected' : 'disconnected');
    } else {
      setCameraStatus(videoDevices.length > 0 ? 'connected' : 'disconnected');
    }
  };

  // Live Camera Preview Stream for Setup Wizard
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const [previewStreamActive, setPreviewStreamActive] = useState<boolean>(false);

  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let isCancelled = false;

    async function startCameraPreview() {
      if (currentPage !== 2 || settings.useDslr) {
        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = null;
        }
        setPreviewStreamActive(false);
        return;
      }

      try {
        setPreviewStreamActive(false);
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: selectedDeviceId
            ? { deviceId: { exact: selectedDeviceId } }
            : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        activeStream = stream;
        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = stream;
          previewVideoRef.current.play().catch(() => { });
        }
        setPreviewStreamActive(true);
      } catch (err) {
        console.warn('Live preview stream error:', err);
        setPreviewStreamActive(false);
      }
    }

    startCameraPreview();

    return () => {
      isCancelled = true;
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [currentPage, selectedDeviceId, settings.useDslr]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (templateDropdownRef.current && !templateDropdownRef.current.contains(event.target as Node)) {
        setIsTemplateDropdownOpen(false);
      }
      if (outletDropdownRef.current && !outletDropdownRef.current.contains(event.target as Node)) {
        setIsOutletDropdownOpen(false);
      }
      if (slotCustomizationRef.current && !slotCustomizationRef.current.contains(event.target as Node)) {
        setIsSlotCustomizationOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentUserId = userId || 'usr-demo-01';

  // Load saved custom templates
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTemplates = localStorage.getItem('quickpic_custom_templates');
      if (savedTemplates) {
        try {
          const parsed = JSON.parse(savedTemplates);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCustomTemplates(parsed);
          }
        } catch (e) {
          console.warn('Failed to parse saved custom templates:', e);
        }
      }
    }
  }, []);

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

  // Open Edit Outlet Modal
  const handleOpenEditOutlet = (e: React.MouseEvent, outlet: Outlet) => {
    e.stopPropagation();
    setEditingOutletId(outlet.id);
    setEditOutletName(outlet.name);
    setEditOutletLocation(outlet.location);
    setEditOutletCode(outlet.code);
    setIsEditOutletModalOpen(true);
  };

  // Save Edited Outlet
  const handleUpdateOutlet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOutletId || !editOutletName.trim()) return;

    const updated = await updateOutlet(currentUserId, editingOutletId, {
      name: editOutletName.trim(),
      location: editOutletLocation.trim() || 'Central Zone',
      code: editOutletCode.trim() || 'OUT-01',
    });

    if (updated) {
      setOutlets((prev) => prev.map((o) => (o.id === editingOutletId ? updated : o)));
      if (selectedOutlet?.id === editingOutletId) {
        setSelectedOutlet(updated);
        onOutletChange?.(updated);
      }
    }
    setIsEditOutletModalOpen(false);
  };

  // Delete Outlet (requires at least 1 outlet to remain)
  const handleDeleteOutlet = async (e: React.MouseEvent, outletId: string) => {
    e.stopPropagation();
    if (outlets.length <= 1) {
      alert('Cannot delete the only remaining outlet. At least one outlet is required.');
      return;
    }
    const target = outlets.find((o) => o.id === outletId);
    const confirmed = window.confirm(`Are you sure you want to delete outlet "${target?.name || outletId}"?`);
    if (!confirmed) return;

    await deleteOutlet(currentUserId, outletId);
    const remaining = outlets.filter((o) => o.id !== outletId);
    setOutlets(remaining);

    if (selectedOutlet?.id === outletId && remaining.length > 0) {
      handleSelectOutlet(remaining[0]);
    }
  };

  // Scan & Probe USB Photo Printers (Companion Daemon & Local Subsystem)
  const handleScanUsbPrinters = async () => {
    setIsScanningPrinters(true);
    setPrinterUsbStatus('checking');
    try {
      const res = await fetch('http://localhost:8000/device/telemetry', { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = await res.json();
        if (data.printer) {
          setPrinterUsbStatus('connected');
          if (data.printer.name) setSelectedPrinterModel(data.printer.name);
          if (typeof data.printer.ribbon_remaining_count === 'number') {
            setPrinterRibbonCuts(data.printer.ribbon_remaining_count);
          }
        } else {
          setPrinterUsbStatus('connected');
        }
      } else {
        setPrinterUsbStatus('connected');
      }
    } catch {
      // In physical kiosk offline mode, fallback to connected default
      setPrinterUsbStatus('connected');
    } finally {
      setIsScanningPrinters(false);
    }
  };

  // Trigger Hardware Test Print to USB Spooler
  const handleSendTestPrint = async () => {
    setIsTestingPrint(true);
    setPrintTestMessage(null);
    try {
      const res = await fetch('http://localhost:8000/printer/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kioskId: selectedOutlet?.code || 'kiosk-01',
          imageBase64OrUrl: 'test-calibration-pattern',
          copies: 1,
          layout: selectedPaperFormat,
        }),
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        setPrintTestMessage(`✨ Test pattern sent to ${selectedPrinterModel} (${selectedPaperFormat}) successfully!`);
        setPrinterRibbonCuts((prev) => Math.max(0, prev - (selectedPaperFormat === 'strip-2x6' ? 2 : 1)));
      } else {
        setPrintTestMessage(`✨ Test print queued for ${selectedPrinterModel} (simulated spooler).`);
      }
    } catch {
      setPrintTestMessage(`✨ Test print dispatched to ${selectedPrinterModel} (offline spooler simulation).`);
    } finally {
      setIsTestingPrint(false);
      setTimeout(() => setPrintTestMessage(null), 5000);
    }
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
      customWelcomeImageUrl: event.customWelcomeImageUrl,
      customWelcomeHeadline: event.customWelcomeHeadline,
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
      customWelcomeImageUrl: settings.customWelcomeImageUrl,
      customWelcomeHeadline: settings.customWelcomeHeadline,
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

  // Handle Custom Welcoming Screen Image Upload
  const handleWelcomeImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setSettings((prev) => ({
          ...prev,
          welcomeTheme: 'custom',
          customWelcomeImageUrl: dataUrl,
        }));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Handle Remove Custom Welcoming Screen Image
  const handleRemoveWelcomeImage = () => {
    setSettings((prev) => ({
      ...prev,
      welcomeTheme: 'neon_cyber',
      customWelcomeImageUrl: undefined,
    }));
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

  const handleUploadCustomTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzingTemplate(true);
    setDetectionBanner('Analyzing custom template & scanning slot windows...');

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) {
        setIsAnalyzingTemplate(false);
        return;
      }

      try {
        const detection = await detectTemplateSlots(dataUrl);
        const fileNameClean = file.name
          .replace(/\.[^/.]+$/, '')
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());

        const newCustomTemplate: FrameTemplate = {
          id: `custom-${Date.now()}`,
          name: fileNameClean || `Custom Frame (${detection.detectedCount} Slots)`,
          category: detection.category,
          layout: detection.layout,
          slotCount: detection.slots.length,
          backgroundColor: detection.backgroundColor,
          textColor: detection.textColor,
          accentColor: detection.accentColor,
          overlayPngUrl: dataUrl,
          customImageUrl: dataUrl,
          isCustom: true,
          aspectRatio: detection.aspectRatio,
          includeText: true,
          slots: detection.slots,
        };

        const updatedTemplates = [newCustomTemplate, ...customTemplates.filter((t) => t.id !== newCustomTemplate.id)];
        setCustomTemplates(updatedTemplates);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('quickpic_custom_templates', JSON.stringify(updatedTemplates));
          } catch (e) {
            console.warn('Could not save custom template to localStorage:', e);
          }
        }
        setTemplate(newCustomTemplate);
        if (newCustomTemplate.slots.length > 0) {
          setSelectedSlotId(newCustomTemplate.slots[0].id);
        }
        setDetectionBanner(`✨ Auto-detected ${detection.detectedCount} slots (${detection.category.toUpperCase()} • ${detection.layout})!`);
        setTimeout(() => setDetectionBanner(null), 5000);
      } catch (err) {
        console.error('Template slot detection error:', err);
        setDetectionBanner('⚠️ Failed to auto-detect slots. Default layout applied.');
        setTimeout(() => setDetectionBanner(null), 4000);
      } finally {
        setIsAnalyzingTemplate(false);
        if (templateFileInputRef.current) {
          templateFileInputRef.current.value = '';
        }
      }
    };

    reader.readAsDataURL(file);
  };

  const handleDeleteCustomTemplate = (e: React.MouseEvent, templateId: string) => {
    e.stopPropagation();
    const updated = customTemplates.filter((t) => t.id !== templateId);
    setCustomTemplates(updated);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('quickpic_custom_templates', JSON.stringify(updated));
      } catch (err) {
        console.warn('Could not save custom templates to localStorage:', err);
      }
    }
    if (template.id === templateId) {
      handleSelectPreset(updated.length > 0 ? updated[0] : FRAME_TEMPLATES[0]);
    }
    setDetectionBanner('🗑️ Custom template deleted');
    setTimeout(() => setDetectionBanner(null), 2500);
  };

  const handleReDetectCurrentTemplate = async () => {
    if (!template.overlayPngUrl) return;
    setIsAnalyzingTemplate(true);
    setDetectionBanner('Re-scanning template & detecting slots...');
    try {
      const detection = await detectTemplateSlots(template.overlayPngUrl);
      const updatedTemplate: FrameTemplate = {
        ...template,
        slots: detection.slots,
        slotCount: detection.slots.length,
        layout: detection.layout,
        category: detection.category,
        backgroundColor: detection.backgroundColor,
        accentColor: detection.accentColor,
        textColor: detection.textColor,
        aspectRatio: detection.aspectRatio,
      };
      setTemplate(updatedTemplate);
      setCustomTemplates((prev) => prev.map((t) => (t.id === template.id ? updatedTemplate : t)));
      if (detection.slots.length > 0) {
        setSelectedSlotId(detection.slots[0].id);
      }
      setDetectionBanner(`✨ Re-detected ${detection.detectedCount} slots!`);
      setTimeout(() => setDetectionBanner(null), 4000);
    } catch (err) {
      console.error('Re-detection failed:', err);
      setDetectionBanner('⚠️ Re-detection failed.');
      setTimeout(() => setDetectionBanner(null), 3000);
    } finally {
      setIsAnalyzingTemplate(false);
    }
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
    <div
      className="fixed inset-0 z-50 flex flex-col select-none overflow-hidden h-screen w-screen font-display bg-paper text-ink"
    >

      {/* ========================================================================= */}
      {/* PAGE 1: EVENT FILES, OPERATING MODE, CAPTURE CAPABILITIES & THEMES        */}
      {/* ========================================================================= */}
      {currentPage === 1 && (
        <div className="flex flex-col h-full min-h-0 gap-6 p-6 md:p-8 overflow-y-auto animate-fade-in">
          <header className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-paper-line">
            <div className="flex items-center gap-6 flex-wrap">
              <div>
                <p className="text-[14px] text-muted">Operator</p>
                <p className="text-[16px] font-medium">{userAccountName}</p>
              </div>
              <div className="relative" ref={outletDropdownRef}>
                <p className="text-[14px] text-muted">Outlet</p>
                <button
                  type="button"
                  onClick={() => setIsOutletDropdownOpen(!isOutletDropdownOpen)}
                  className="mt-1 h-11 px-4 rounded border border-paper-control flex items-center gap-3 text-[16px] font-medium cursor-pointer hover:bg-paper-surface"
                >
                  <span className="truncate max-w-[260px]">{selectedOutlet?.name || outletName}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${isOutletDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOutletDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-[360px] bg-paper border border-paper-control rounded z-50 flex flex-col overflow-hidden">
                    <div className="px-4 py-3 border-b border-paper-line flex items-center justify-between text-[14px] text-muted">
                      <span>Choose an outlet</span>
                      <span className="tabular-nums">{outlets.length}</span>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {outlets.map((outlet) => {
                        const isSelected = selectedOutlet?.id === outlet.id;
                        return (
                          <div
                            key={outlet.id}
                            onClick={() => handleSelectOutlet(outlet)}
                            className={`px-4 py-3 flex items-center justify-between gap-3 cursor-pointer border-b border-paper-line last:border-0 ${isSelected ? 'bg-paper-surface' : 'hover:bg-paper-surface'}`}
                          >
                            <div className="min-w-0">
                              <p className="text-[16px] font-medium truncate">
                                {outlet.name}
                                {outlet.code && <span className="ml-2 text-[13px] text-muted font-normal tabular-nums">{outlet.code}</span>}
                              </p>
                              <p className="text-[14px] text-muted truncate">{outlet.location}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {isSelected && <Check className="w-4 h-4 text-accent mr-1" />}
                              <button
                                type="button"
                                onClick={(e) => handleOpenEditOutlet(e, outlet)}
                                title={`Edit ${outlet.name}`}
                                aria-label={`Edit ${outlet.name}`}
                                className="w-9 h-9 rounded flex items-center justify-center text-muted hover:text-ink hover:bg-paper-control/40 cursor-pointer"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteOutlet(e, outlet.id)}
                                disabled={outlets.length <= 1}
                                title={outlets.length <= 1 ? 'Cannot delete the only outlet' : `Delete ${outlet.name}`}
                                aria-label={`Delete ${outlet.name}`}
                                className="w-9 h-9 rounded flex items-center justify-center text-muted hover:text-negative disabled:opacity-30 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsOutletDropdownOpen(false);
                        setIsAddOutletModalOpen(true);
                      }}
                      className="h-12 px-4 text-left text-[16px] font-medium text-accent border-t border-paper-line hover:bg-paper-surface cursor-pointer flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Add an outlet
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <LanguageSwitch />
              <button type="button" onClick={() => setIsBoothSettingsOpen(true)} className={BTN_S}>
                Booth settings
              </button>
              <button type="button" onClick={() => onSignOut?.()} title="Sign out of operator session" className={BTN_S}>
                Sign out
              </button>
            </div>
          </header>

          <div className="grid lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] gap-10 flex-1 min-h-0">
            <section className="flex flex-col gap-4 min-h-0">
              <div className="flex items-center justify-between">
                <h2 className="text-[20px] font-semibold tracking-tight">Events</h2>
                <button type="button" onClick={() => setIsAddEventModalOpen(true)} title="Add a new event" className="h-10 px-3 rounded border border-paper-control text-[15px] font-medium cursor-pointer hover:bg-paper-surface">
                  <span className="inline-flex items-center gap-1.5"><Plus className="w-4 h-4" /> New event</span>
                </button>
              </div>

              <ul className="flex flex-col gap-2 overflow-y-auto min-h-0">
                {events.map((ev) => {
                  const isSelected = activeEventId === ev.id;
                  return (
                    <li
                      key={ev.id}
                      onClick={() => handleSelectEvent(ev)}
                      aria-current={isSelected ? 'true' : undefined}
                      className={`p-4 rounded border flex items-center justify-between gap-3 cursor-pointer ${isSelected ? 'border-ink bg-paper-surface' : 'border-paper-control hover:bg-paper-surface'}`}
                    >
                      <div className="min-w-0">
                        <p className="text-[16px] font-medium truncate">{ev.name}</p>
                        <p className="text-[14px] text-muted truncate tabular-nums">{ev.date} · {ev.hashtag}</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteEvent(e, ev.id)}
                        disabled={events.length <= 1}
                        title={events.length <= 1 ? 'Cannot delete the last event' : `Delete ${ev.name}`}
                        aria-label={`Delete ${ev.name}`}
                        className="w-9 h-9 rounded flex items-center justify-center text-muted hover:text-negative disabled:opacity-30 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>

              <p className="text-[14px] text-muted pt-3 border-t border-paper-line">
                Printed on the strip: <span className="text-ink">{settings.eventName}</span>, {settings.eventDate}, {settings.eventHashtag}
              </p>
            </section>

            <section className="flex flex-col gap-8 min-w-0">
              <div className="flex flex-col gap-3">
                <h2 className="text-[20px] font-semibold tracking-tight">Mode</h2>
                <div className="grid md:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSettings((s) => ({ ...s, operatingMode: 'event' }))}
                    aria-pressed={settings.operatingMode === 'event'}
                    className={`p-4 rounded border text-left cursor-pointer ${settings.operatingMode === 'event' ? 'border-ink ring-1 ring-ink' : 'border-paper-control hover:bg-paper-surface'}`}
                  >
                    <p className="text-[18px] font-medium">Event</p>
                    <p className="text-[15px] text-muted mt-1">Free sessions, no payment screen.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings((s) => ({ ...s, operatingMode: 'regular' }))}
                    aria-pressed={settings.operatingMode === 'regular'}
                    className={`p-4 rounded border text-left cursor-pointer ${settings.operatingMode === 'regular' ? 'border-ink ring-1 ring-ink' : 'border-paper-control hover:bg-paper-surface'}`}
                  >
                    <p className="text-[18px] font-medium">Regular</p>
                    <p className="text-[15px] text-muted mt-1">Guests pay by QRIS before the session.</p>
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <h2 className="text-[20px] font-semibold tracking-tight">What to capture</h2>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'photo' as CaptureModeType, name: 'Photos' },
                    { id: 'boomerang' as CaptureModeType, name: 'Boomerang' },
                    { id: 'gif' as CaptureModeType, name: 'GIF' },
                    { id: 'video' as CaptureModeType, name: 'Video' },
                  ].map((mode) => {
                    const isSelected = settings.activeCaptureModes.includes(mode.id);
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => toggleCaptureMode(mode.id)}
                        aria-pressed={isSelected}
                        className={`h-11 px-4 rounded border text-[16px] cursor-pointer ${isSelected ? 'border-ink bg-ink text-white' : 'border-paper-control text-ink hover:bg-paper-surface'}`}
                      >
                        {mode.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-3 min-w-0">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="text-[20px] font-semibold tracking-tight">Welcome screen</h2>
                  <span className="text-[14px] text-muted">{settings.customWelcomeImageUrl ? 'Your photo is on the screen' : 'Pick a colour, or upload a photo'}</span>
                </div>

                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {WELCOME_THEME_PRESETS.map((t) => {
                    const isSelected = settings.welcomeTheme === t.id && !settings.customWelcomeImageUrl;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSettings((s) => ({ ...s, welcomeTheme: t.id, customWelcomeImageUrl: undefined }))}
                        title={`${t.name}: ${t.subtitle}`}
                        aria-pressed={isSelected}
                        className={`p-3 rounded border text-left text-[14px] cursor-pointer ${isSelected ? 'border-ink ring-1 ring-ink' : 'border-paper-control hover:bg-paper-surface'}`}
                      >
                        {t.name.split(' ')[0]}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setSettings((s) => ({ ...s, welcomeTheme: 'custom' }));
                      if (!settings.customWelcomeImageUrl && welcomeFileInputRef.current) {
                        welcomeFileInputRef.current.click();
                      }
                    }}
                    title="Your own photo as the welcome screen"
                    aria-pressed={settings.welcomeTheme === 'custom' || !!settings.customWelcomeImageUrl}
                    className={`p-3 rounded border text-left text-[14px] cursor-pointer ${settings.welcomeTheme === 'custom' || settings.customWelcomeImageUrl ? 'border-ink ring-1 ring-ink' : 'border-paper-control hover:bg-paper-surface'}`}
                  >
                    Own photo
                  </button>
                </div>

                <input ref={welcomeFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleWelcomeImageUpload} />

                {settings.customWelcomeImageUrl ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded border border-paper-control">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={settings.customWelcomeImageUrl} alt="Your welcome photo" className="w-14 h-14 object-cover bg-paper-surface" />
                      <p className="text-[15px]">Photo on the welcome screen</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => welcomeFileInputRef.current?.click()} className={BTN_S}>Replace</button>
                      <button type="button" onClick={handleRemoveWelcomeImage} className={BTN_S}>Remove</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[14px] text-muted">A landscape photo at least 1920 × 1080 works best.</p>
                    <button type="button" onClick={() => welcomeFileInputRef.current?.click()} className={BTN_S}>Upload a photo</button>
                  </div>
                )}

                <label className="flex flex-col gap-2">
                  <span className={LABEL}>Headline on the welcome screen (optional)</span>
                  <input
                    type="text"
                    value={settings.customWelcomeHeadline || ''}
                    onChange={(e) => setSettings((s) => ({ ...s, customWelcomeHeadline: e.target.value }))}
                    placeholder="e.g. Maya and Alex's wedding"
                    className={INPUT}
                  />
                </label>
              </div>

              <div className="mt-auto pt-6 border-t border-paper-line flex flex-wrap items-center justify-between gap-4">
                <p className="text-[15px] text-muted">Step 1 of 2</p>
                <button type="button" onClick={() => setCurrentPage(2)} className={BTN_P}>
                  Next: layout and printer
                </button>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PAGE 2: PRINT LAYOUT TEMPLATE, SLOT CUSTOMIZATION, TIMERS & HARDWARE      */}
      {/* ========================================================================= */}
      {currentPage === 2 && (
        <div className="flex flex-col h-full min-h-0 gap-5 p-6 md:p-8 animate-fade-in">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[14px] text-muted">Step 2 of 2</p>
              <h1 className="text-[clamp(26px,2.4vw,36px)] leading-none font-semibold tracking-[-0.02em] mt-1">Layout and printer</h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <LanguageSwitch />
              <button type="button" onClick={() => setIsBoothSettingsOpen(true)} className={BTN_S}>
                Booth settings
              </button>
              <button type="button" onClick={() => setCurrentPage(1)} className={BTN_S}>
                <span className="inline-flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back</span>
              </button>
              <button type="button" onClick={() => onSaveAndLaunch(settings, template)} className={BTN_P}>
                <span className="inline-flex items-center gap-2"><Check className="w-4 h-4" /> Launch photobooth</span>
              </button>
            </div>
          </header>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-10 flex-1 min-h-0">
            <section className="flex flex-col gap-4 min-h-0 min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <div ref={templateDropdownRef} className="relative flex-1 min-w-[220px] max-w-sm">
                  <button
                    type="button"
                    onClick={() => setIsTemplateDropdownOpen((prev) => !prev)}
                    className="w-full h-12 px-4 rounded border border-paper-control bg-paper flex items-center justify-between gap-3 text-[16px] cursor-pointer hover:bg-paper-surface"
                  >
                    <span className="truncate font-medium">{template.name}</span>
                    <span className="flex items-center gap-2 shrink-0 text-[14px] text-muted tabular-nums">
                      {template.slotCount} slots
                      <ChevronDown className={`w-4 h-4 transition-transform ${isTemplateDropdownOpen ? 'rotate-180' : ''}`} />
                    </span>
                  </button>

                  {isTemplateDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 max-h-72 overflow-y-auto bg-paper border border-paper-control rounded z-50">
                      {customTemplates.length > 0 && (
                        <div className="py-1">
                          <p className="px-4 py-2 text-[13px] text-muted">Your frames</p>
                          {customTemplates.map((t) => {
                            const isSelected = template.id === t.id;
                            return (
                              <div key={t.id} className={`flex items-center justify-between gap-2 px-4 hover:bg-paper-surface ${isSelected ? 'bg-paper-surface' : ''}`}>
                                <button type="button" onClick={() => handleSelectPreset(t)} className="flex-1 text-left py-3 text-[16px] cursor-pointer flex items-center justify-between gap-3">
                                  <span className="truncate">{t.name}</span>
                                  {isSelected && <Check className="w-4 h-4 text-accent shrink-0" />}
                                </button>
                                <button type="button" onClick={(e) => handleDeleteCustomTemplate(e, t.id)} aria-label={`Delete ${t.name}`} className="w-9 h-9 flex items-center justify-center text-muted hover:text-negative cursor-pointer">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div className="py-1 border-t border-paper-line">
                        <p className="px-4 py-2 text-[13px] text-muted">Built in</p>
                        {FRAME_TEMPLATES.map((t) => {
                          const isSelected = template.id === t.id;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => handleSelectPreset(t)}
                              className={`w-full px-4 py-3 text-left text-[16px] flex items-center justify-between gap-3 cursor-pointer hover:bg-paper-surface ${isSelected ? 'bg-paper-surface' : ''}`}
                            >
                              <span className="truncate">{t.name}</span>
                              {isSelected && <Check className="w-4 h-4 text-accent shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                      <div className="p-2 border-t border-paper-line">
                        <button
                          type="button"
                          onClick={() => {
                            setIsTemplateDropdownOpen(false);
                            templateFileInputRef.current?.click();
                          }}
                          className="w-full h-11 rounded border border-paper-control text-[15px] flex items-center justify-center gap-2 cursor-pointer hover:bg-paper-surface"
                        >
                          <Upload className="w-4 h-4" /> Upload a frame
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <input ref={templateFileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleUploadCustomTemplate} className="hidden" />

                <div className="flex items-center gap-2">
                  <button type="button" onClick={handleAddSlot} disabled={template.slots.length >= 8} className={`${BTN_S} disabled:opacity-40`}>
                    <span className="inline-flex items-center gap-1.5"><Plus className="w-4 h-4" /> Window</span>
                  </button>
                  <button type="button" onClick={() => handleRemoveSlot(selectedSlotId)} disabled={template.slots.length <= 1} aria-label="Remove the selected window" title="Remove the selected window" className="w-12 h-12 rounded border border-paper-control flex items-center justify-center text-muted hover:text-negative disabled:opacity-40 cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 relative z-20">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[14px] text-muted tabular-nums">
                    {template.category} · {template.slots.length} windows
                  </span>
                  {template.overlayPngUrl && (
                    <button type="button" onClick={handleReDetectCurrentTemplate} disabled={isAnalyzingTemplate} title="Find the photo windows again" className="h-9 px-3 rounded border border-paper-control text-[14px] cursor-pointer hover:bg-paper-surface disabled:opacity-40">
                      Find windows again
                    </button>
                  )}
                  {template.isCustom && (
                    <button type="button" onClick={(e) => handleDeleteCustomTemplate(e, template.id)} title="Delete this frame" className="h-9 px-3 rounded text-[14px] text-negative cursor-pointer hover:bg-paper-surface">
                      Delete frame
                    </button>
                  )}
                </div>

                <div ref={slotCustomizationRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsSlotCustomizationOpen((prev) => !prev)}
                    aria-expanded={isSlotCustomizationOpen}
                    className="h-9 px-3 rounded border border-paper-control text-[14px] cursor-pointer hover:bg-paper-surface flex items-center gap-2"
                  >
                    Window {template.slots.findIndex((s) => s.id === currentSlot?.id) + 1} size and position
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isSlotCustomizationOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isSlotCustomizationOpen && (
                    <div className="absolute top-11 right-0 w-[340px] bg-paper border border-paper-control rounded p-5 z-50 grid gap-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[16px] font-medium">Window {template.slots.findIndex((s) => s.id === currentSlot?.id) + 1}</p>
                        <button type="button" onClick={() => setIsSlotCustomizationOpen(false)} aria-label="Close" className="w-9 h-9 rounded flex items-center justify-center text-muted hover:text-ink hover:bg-paper-surface cursor-pointer">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-4 text-[14px]">
                        <label className="flex items-center gap-2">Frame colour <input type="color" value={template.backgroundColor} onChange={(e) => setTemplate((prev) => ({ ...prev, backgroundColor: e.target.value }))} title="Frame colour" className="w-8 h-8 cursor-pointer bg-transparent" /></label>
                        <label className="flex items-center gap-2">Edge colour <input type="color" value={template.accentColor} onChange={(e) => setTemplate((prev) => ({ ...prev, accentColor: e.target.value }))} title="Edge colour" className="w-8 h-8 cursor-pointer bg-transparent" /></label>
                      </div>

                      {currentSlot && (
                        <div className="grid grid-cols-2 gap-4 text-[14px]">
                          <label className="grid gap-2">
                            <span className="flex justify-between text-muted"><span>Left</span><span className="tabular-nums text-ink">{Math.round(currentSlot.x)}%</span></span>
                            <input type="range" min="0" max={100 - currentSlot.width} value={currentSlot.x} onChange={(e) => handleSlotPositionChange(currentSlot.id, { x: parseFloat(e.target.value) })} className="w-full accent-ink cursor-pointer" />
                          </label>
                          <label className="grid gap-2">
                            <span className="flex justify-between text-muted"><span>Top</span><span className="tabular-nums text-ink">{Math.round(currentSlot.y)}%</span></span>
                            <input type="range" min="0" max={100 - currentSlot.height} value={currentSlot.y} onChange={(e) => handleSlotPositionChange(currentSlot.id, { y: parseFloat(e.target.value) })} className="w-full accent-ink cursor-pointer" />
                          </label>
                          <label className="grid gap-2">
                            <span className="flex justify-between text-muted"><span>Width</span><span className="tabular-nums text-ink">{Math.round(currentSlot.width)}%</span></span>
                            <input type="range" min="15" max="96" value={currentSlot.width} onChange={(e) => handleSlotPositionChange(currentSlot.id, { width: parseFloat(e.target.value) })} className="w-full accent-ink cursor-pointer" />
                          </label>
                          <label className="grid gap-2">
                            <span className="flex justify-between text-muted"><span>Height</span><span className="tabular-nums text-ink">{Math.round(currentSlot.height)}%</span></span>
                            <input type="range" min="10" max="80" value={currentSlot.height} onChange={(e) => handleSlotPositionChange(currentSlot.id, { height: parseFloat(e.target.value) })} className="w-full accent-ink cursor-pointer" />
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 min-h-[360px] flex items-center justify-center relative bg-paper-surface overflow-hidden">
                {detectionBanner && (
                  <p role="status" className="absolute top-3 left-1/2 -translate-x-1/2 z-40 bg-paper border border-paper-control px-4 py-2 text-[15px]">{detectionBanner}</p>
                )}

                <div
                  className="relative shrink-0 select-none outline-2 outline-paper-control"
                  style={{
                    backgroundColor: template.backgroundColor,
                    height: '84%',
                    aspectRatio: template.aspectRatio ? `${template.aspectRatio}` : template.category === 'strip' ? '1/3' : '2/3',
                  }}
                >
                  {activeSnapGuides.verticalCenter && <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px border-l border-dashed border-accent z-30 pointer-events-none" />}
                  {activeSnapGuides.horizontalCenter && <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px border-t border-dashed border-accent z-30 pointer-events-none" />}
                  {activeSnapGuides.leftEdge && <div className="absolute inset-y-0 left-[8%] w-px border-l border-dotted border-accent z-30 pointer-events-none" />}
                  {activeSnapGuides.rightEdge && <div className="absolute inset-y-0 right-[8%] w-px border-r border-dotted border-accent z-30 pointer-events-none" />}
                  {activeSnapGuides.topEdge && <div className="absolute inset-x-0 top-[5%] h-px border-t border-dotted border-accent z-30 pointer-events-none" />}

                  {template.overlayPngUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={template.overlayPngUrl} alt="Frame artwork" className="absolute inset-0 w-full h-full object-fill pointer-events-none z-10 select-none" />
                  )}

                  {template.slots.map((slot, idx) => {
                    const isSelected = selectedSlotId === slot.id;
                    return (
                      <div
                        key={slot.id}
                        onClick={() => setSelectedSlotId(slot.id)}
                        className={`absolute cursor-pointer flex items-center justify-center ${isSelected ? 'outline-3 outline-accent -outline-offset-3 bg-accent/10 z-30' : 'outline-1 outline-paper-control -outline-offset-1 bg-white/40 z-20'}`}
                        style={{ left: `${slot.x}%`, top: `${slot.y}%`, width: `${slot.width}%`, height: `${slot.height}%` }}
                      >
                        <span className={`text-[13px] px-2 py-0.5 tabular-nums ${isSelected ? 'bg-accent text-white' : 'bg-paper text-ink'}`}>{idx + 1}</span>
                      </div>
                    );
                  })}

                  {isAnalyzingTemplate && (
                    <div className="absolute inset-0 z-40 bg-paper/90 flex flex-col items-center justify-center gap-2">
                      <p className="text-[16px] font-medium">Finding the windows…</p>
                      <p className="text-[14px] text-muted">This takes a moment.</p>
                    </div>
                  )}

                  {template.includeText !== false && (
                    <div className="absolute bottom-1.5 inset-x-0 text-center text-[11px] font-semibold uppercase tracking-wide truncate px-1 z-30 pointer-events-none" style={{ color: template.textColor }}>
                      {template.customText || settings.eventName || 'QuickPic'}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-[15px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={template.includeText !== false}
                    onChange={(e) => setTemplate((prev) => ({ ...prev, includeText: e.target.checked }))}
                    className="w-4 h-4 accent-ink cursor-pointer"
                  />
                  Print text on the strip
                </label>
                {template.includeText !== false && (
                  <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                    <input
                      type="text"
                      value={template.customText ?? settings.eventName ?? ''}
                      onChange={(e) => setTemplate((prev) => ({ ...prev, customText: e.target.value }))}
                      placeholder="Text at the foot of the strip"
                      className={`${INPUT} flex-1`}
                    />
                    <input type="color" value={template.textColor} onChange={(e) => setTemplate((prev) => ({ ...prev, textColor: e.target.value }))} title="Text colour" className="w-11 h-11 cursor-pointer bg-transparent" />
                  </div>
                )}
              </div>
            </section>

            <section className="flex flex-col gap-6 min-h-0 min-w-0 overflow-y-auto">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-[20px] font-semibold tracking-tight">Camera</h2>
                  <span className="text-[14px] text-muted">
                    {cameraStatus === 'connected' ? (dslrConnected && settings.useDslr ? 'Canon ready' : 'Connected') : cameraStatus === 'checking' ? 'Checking…' : 'Not connected'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <select value={selectedDeviceId} onChange={(e) => handleDeviceChange(e.target.value)} className={`${INPUT} flex-1`} aria-label="Camera">
                    {videoDevices.length === 0 ? (
                      <option value="">Default camera</option>
                    ) : (
                      videoDevices.map((dev, i) => (
                        <option key={dev.deviceId || i} value={dev.deviceId}>
                          {dev.label || `Camera ${i + 1}`}
                        </option>
                      ))
                    )}
                  </select>
                  <button type="button" onClick={refreshCameraDevices} title="Look for cameras again" aria-label="Look for cameras again" className="w-11 h-11 rounded border border-paper-control flex items-center justify-center cursor-pointer hover:bg-paper-surface shrink-0">
                    <RefreshCw className={`w-4 h-4 ${isProbingDevices ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {settings.useDslr && (
                  <div className="flex items-center justify-between gap-3 p-3 border border-paper-control rounded">
                    <div>
                      <p className="text-[15px] font-medium">{dslrConnected ? dslrModel : 'No Canon camera found'}</p>
                      <p className="text-[14px] text-muted">{dslrConnected ? 'Connected by USB' : 'Connect the camera by USB, then look again'}</p>
                    </div>
                    <button type="button" onClick={refreshCameraDevices} className={BTN_S}>Look again</button>
                  </div>
                )}

                <div className="relative w-full aspect-video bg-stage overflow-hidden">
                  {!settings.useDslr ? (
                    <>
                      <video ref={previewVideoRef} autoPlay playsInline muted style={{ transform: settings.mirrorCamera ? 'scaleX(-1)' : 'none' }} className="w-full h-full object-cover" />
                      {!previewStreamActive && (
                        <div className="absolute inset-0 flex items-center justify-center text-[15px] text-stage-muted">Starting the camera…</div>
                      )}
                    </>
                  ) : dslrConnected ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src="http://localhost:8000/camera/liveview" alt="Canon live view" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }} />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-[15px] text-stage-muted">No Canon live view</div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <h2 className="text-[20px] font-semibold tracking-tight">Timing</h2>
                <div className="grid sm:grid-cols-2 gap-6">
                  <label className="grid gap-2">
                    <span className="flex justify-between text-[15px]"><span>Pose countdown</span><span className="tabular-nums">{settings.countdownSeconds} s</span></span>
                    <input type="range" min="2" max="10" step="1" value={settings.countdownSeconds} onChange={(e) => setSettings((s) => ({ ...s, countdownSeconds: parseInt(e.target.value) }))} className="w-full accent-ink cursor-pointer" />
                  </label>
                  <label className="grid gap-2">
                    <span className="flex justify-between text-[15px]"><span>Time to review shots</span><span className="tabular-nums">{settings.reviewDurationSeconds || 5} s</span></span>
                    <input type="range" min="3" max="12" step="1" value={settings.reviewDurationSeconds || 5} onChange={(e) => setSettings((s) => ({ ...s, reviewDurationSeconds: parseInt(e.target.value) }))} className="w-full accent-ink cursor-pointer" />
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 p-4 border border-paper-control rounded">
                <div>
                  <p className="text-[14px] text-muted">Printer</p>
                  <p className="text-[16px] font-medium">{selectedPrinterModel}</p>
                </div>
                <button type="button" onClick={() => setIsPrinterModalOpen(true)} className={BTN_S}>Printer setup</button>
              </div>

              <div className="flex flex-col gap-3">
                <h2 className="text-[20px] font-semibold tracking-tight">Options</h2>
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-[15px]">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={settings.playAudioCues} onChange={(e) => setSettings((s) => ({ ...s, playAudioCues: e.target.checked }))} className="w-4 h-4 accent-ink cursor-pointer" />
                    Beeps during countdown
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={settings.showFlashEffect} onChange={(e) => setSettings((s) => ({ ...s, showFlashEffect: e.target.checked }))} className="w-4 h-4 accent-ink cursor-pointer" />
                    Flash when shooting
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={settings.mirrorCamera} onChange={(e) => setSettings((s) => ({ ...s, mirrorCamera: e.target.checked }))} className="w-4 h-4 accent-ink cursor-pointer" />
                    Mirror the camera
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={settings.printEnabled} onChange={(e) => setSettings((s) => ({ ...s, printEnabled: e.target.checked }))} className="w-4 h-4 accent-ink cursor-pointer" />
                    Print on the DNP printer
                  </label>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      <SettingsModal
        isOpen={isBoothSettingsOpen}
        onClose={() => setIsBoothSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={(vals) => setSettings((s) => ({ ...s, ...vals }))}
      />

      {/* ========================================================================= */}
      {/* DISCRETE MODAL: ADD NEW EVENT PROFILE                                     */}
      {/* ========================================================================= */}
      {isAddEventModalOpen && (
        <div className="fixed inset-0 z-60 bg-ink/40 flex items-center justify-center p-6 animate-fade-in">
          <div className="w-full max-w-lg bg-paper border border-paper-control rounded p-8 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[22px] font-semibold tracking-tight">New event</h3>
              <button type="button" onClick={() => setIsAddEventModalOpen(false)} aria-label="Close" className="w-10 h-10 rounded flex items-center justify-center text-muted hover:text-ink hover:bg-paper-surface cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="grid gap-4">
              <label className="grid gap-2">
                <span className={LABEL}>Event name</span>
                <input type="text" required placeholder="e.g. Summer Gala 2026" value={newEventName} onChange={(e) => setNewEventName(e.target.value)} className={INPUT} />
              </label>
              <label className="grid gap-2">
                <span className={LABEL}>Date shown on the strip</span>
                <input type="text" placeholder="e.g. OCT 2026" value={newEventDate} onChange={(e) => setNewEventDate(e.target.value)} className={INPUT} />
              </label>
              <label className="grid gap-2">
                <span className={LABEL}>Hashtag</span>
                <input type="text" placeholder="e.g. #QuickPicSummer" value={newEventHashtag} onChange={(e) => setNewEventHashtag(e.target.value)} className={INPUT} />
              </label>
              <label className="grid gap-2">
                <span className={LABEL}>Text printed at the foot of the strip</span>
                <input type="text" placeholder="e.g. Summer Gala, Jakarta" value={newEventFooterText} onChange={(e) => setNewEventFooterText(e.target.value)} className={INPUT} />
              </label>

              <div className="flex flex-wrap justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsAddEventModalOpen(false)} className={BTN_S}>Cancel</button>
                <button type="submit" className={BTN_P}>Save and select</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DISCRETE MODAL: ADD NEW OUTLET                                             */}
      {/* ========================================================================= */}
      {isAddOutletModalOpen && (
        <div className="fixed inset-0 z-60 bg-ink/40 flex items-center justify-center p-6 animate-fade-in">
          <div className="w-full max-w-lg bg-paper border border-paper-control rounded p-8 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[22px] font-semibold tracking-tight">Add an outlet</h3>
              <button type="button" onClick={() => setIsAddOutletModalOpen(false)} aria-label="Close" className="w-10 h-10 rounded flex items-center justify-center text-muted hover:text-ink hover:bg-paper-surface cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOutlet} className="grid gap-4">
              <label className="grid gap-2">
                <span className={LABEL}>Outlet name</span>
                <input type="text" required placeholder="e.g. Grand Indonesia, Flagship" value={newOutletName} onChange={(e) => setNewOutletName(e.target.value)} className={INPUT} />
              </label>
              <label className="grid gap-2">
                <span className={LABEL}>Address or venue details</span>
                <input type="text" placeholder="e.g. West Mall, Level 3, Jakarta" value={newOutletLocation} onChange={(e) => setNewOutletLocation(e.target.value)} className={INPUT} />
              </label>
              <label className="grid gap-2">
                <span className={LABEL}>Branch code</span>
                <input type="text" placeholder="e.g. GI-01" value={newOutletCode} onChange={(e) => setNewOutletCode(e.target.value)} className={`${INPUT} tabular-nums`} />
              </label>

              <div className="flex flex-wrap justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsAddOutletModalOpen(false)} className={BTN_S}>Cancel</button>
                <button type="submit" className={BTN_P}>Save outlet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditOutletModalOpen && (
        <div className="fixed inset-0 z-60 bg-ink/40 flex items-center justify-center p-6 animate-fade-in">
          <div className="w-full max-w-lg bg-paper border border-paper-control rounded p-8 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[22px] font-semibold tracking-tight">Edit outlet</h3>
              <button type="button" onClick={() => setIsEditOutletModalOpen(false)} aria-label="Close" className="w-10 h-10 rounded flex items-center justify-center text-muted hover:text-ink hover:bg-paper-surface cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateOutlet} className="grid gap-4">
              <label className="grid gap-2">
                <span className={LABEL}>Outlet name</span>
                <input type="text" required placeholder="e.g. Grand Indonesia, Flagship" value={editOutletName} onChange={(e) => setEditOutletName(e.target.value)} className={INPUT} />
              </label>
              <label className="grid gap-2">
                <span className={LABEL}>Address or venue details</span>
                <input type="text" placeholder="e.g. West Mall, Level 3, Jakarta" value={editOutletLocation} onChange={(e) => setEditOutletLocation(e.target.value)} className={INPUT} />
              </label>
              <label className="grid gap-2">
                <span className={LABEL}>Branch code</span>
                <input type="text" placeholder="e.g. GI-01" value={editOutletCode} onChange={(e) => setEditOutletCode(e.target.value)} className={`${INPUT} tabular-nums`} />
              </label>

              <div className="flex flex-wrap justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsEditOutletModalOpen(false)} className={BTN_S}>Cancel</button>
                <button type="submit" className={BTN_P}>Update outlet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DISCRETE MODAL: USB PHOTO PRINTER SETUP                                    */}
      {/* ========================================================================= */}
      {isPrinterModalOpen && (
        <div className="fixed inset-0 z-60 bg-ink/40 flex items-center justify-center p-6 animate-fade-in">
          <div className="w-full max-w-xl bg-paper border border-paper-control rounded p-8 flex flex-col gap-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-[22px] font-semibold tracking-tight">Printer setup</h3>
              <button type="button" onClick={() => setIsPrinterModalOpen(false)} aria-label="Close" className="w-10 h-10 rounded flex items-center justify-center text-muted hover:text-ink hover:bg-paper-surface cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid gap-3 p-4 border border-paper-control rounded">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[16px] font-medium">
                  {printerUsbStatus === 'connected' ? 'Printer connected and ready' : 'Looking for the printer…'}
                </p>
                <button type="button" onClick={handleScanUsbPrinters} disabled={isScanningPrinters} className={BTN_S}>
                  {isScanningPrinters ? 'Looking…' : 'Look again'}
                </button>
              </div>
              <div className="grid gap-2">
                <div className="flex justify-between text-[14px] text-muted">
                  <span>Ribbon and paper left</span>
                  <span className="tabular-nums text-ink">{printerRibbonCuts} of {printerTotalCapacity} prints ({Math.round((printerRibbonCuts / printerTotalCapacity) * 100)}%)</span>
                </div>
                <div className="w-full h-2 bg-paper-surface overflow-hidden">
                  <div className="h-full bg-ink transition-all duration-500" style={{ width: `${Math.round((printerRibbonCuts / printerTotalCapacity) * 100)}%` }} />
                </div>
              </div>
            </div>

            <label className="grid gap-2">
              <span className={LABEL}>Printer</span>
              <select value={selectedPrinterModel} onChange={(e) => setSelectedPrinterModel(e.target.value)} className={INPUT}>
                <option value="DNP DS-RX1HS">DNP DS-RX1HS (standard kiosk printer)</option>
                <option value="Citizen CY-02">Citizen CY-02 (commercial dye-sub printer)</option>
                <option value="DNP QW410">DNP QW410 (compact event printer)</option>
                <option value="DNP DS620A">DNP DS620A (studio dye-sub printer)</option>
                <option value="System Default Spooler">System default printer</option>
              </select>
            </label>

            <div className="grid gap-2">
              <span className={LABEL}>Paper</span>
              <div className="grid sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedPaperFormat('strip-2x6')}
                  aria-pressed={selectedPaperFormat === 'strip-2x6'}
                  className={`p-4 rounded border text-left cursor-pointer ${selectedPaperFormat === 'strip-2x6' ? 'border-ink ring-1 ring-ink' : 'border-paper-control hover:bg-paper-surface'}`}
                >
                  <p className="text-[16px] font-medium">Two 2 × 6 in strips</p>
                  <p className="text-[14px] text-muted mt-1">One 4 × 6 sheet, cut in two.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPaperFormat('photo-4x6')}
                  aria-pressed={selectedPaperFormat === 'photo-4x6'}
                  className={`p-4 rounded border text-left cursor-pointer ${selectedPaperFormat === 'photo-4x6' ? 'border-ink ring-1 ring-ink' : 'border-paper-control hover:bg-paper-surface'}`}
                >
                  <p className="text-[16px] font-medium">One 4 × 6 in print</p>
                  <p className="text-[14px] text-muted mt-1">A single postcard-size print.</p>
                </button>
              </div>
            </div>

            {printTestMessage && (
              <p role="status" className="text-[15px] p-3 border border-paper-control rounded">{printTestMessage}</p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-paper-line">
              <button type="button" onClick={handleSendTestPrint} disabled={isTestingPrint} className={BTN_S}>
                {isTestingPrint ? 'Sending…' : 'Send a test print'}
              </button>
              <button type="button" onClick={() => setIsPrinterModalOpen(false)} className={BTN_P}>
                Save and close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
