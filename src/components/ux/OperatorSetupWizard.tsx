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
import { useOperatorT } from '@/lib/operatorStrings';

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
  const { t } = useOperatorT();
  const deleteLabel = (name: string) => t('wizard.deleteNamed', { name });
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
      alert(t('wizard.outlet.cannotDeleteAlert'));
      return;
    }
    const target = outlets.find((o) => o.id === outletId);
    const confirmed = window.confirm(t('wizard.outlet.confirmDelete', { name: target?.name || outletId }));
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
        setPrintTestMessage(t('wizard.printer.sentMsg', { model: selectedPrinterModel, format: selectedPaperFormat }));
        setPrinterRibbonCuts((prev) => Math.max(0, prev - (selectedPaperFormat === 'strip-2x6' ? 2 : 1)));
      } else {
        setPrintTestMessage(t('wizard.printer.queuedMsg', { model: selectedPrinterModel }));
      }
    } catch {
      setPrintTestMessage(t('wizard.printer.dispatchedMsg', { model: selectedPrinterModel }));
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
    setDetectionBanner(t('wizard.detect.analyzing'));

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
        setDetectionBanner(t('wizard.detect.done', { n: detection.detectedCount, category: detection.category.toUpperCase(), layout: detection.layout }));
        setTimeout(() => setDetectionBanner(null), 5000);
      } catch (err) {
        console.error('Template slot detection error:', err);
        setDetectionBanner(t('wizard.detect.failed'));
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
    setDetectionBanner(t('wizard.detect.deleted'));
    setTimeout(() => setDetectionBanner(null), 2500);
  };

  const handleReDetectCurrentTemplate = async () => {
    if (!template.overlayPngUrl) return;
    setIsAnalyzingTemplate(true);
    setDetectionBanner(t('wizard.detect.rescanning'));
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
      setDetectionBanner(t('wizard.detect.redone', { n: detection.detectedCount }));
      setTimeout(() => setDetectionBanner(null), 4000);
    } catch (err) {
      console.error('Re-detection failed:', err);
      setDetectionBanner(t('wizard.detect.redoFailed'));
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
                <p className="text-[14px] text-muted">{t('wizard.operator')}</p>
                <p className="text-[16px] font-medium">{userAccountName}</p>
              </div>
              <div className="relative" ref={outletDropdownRef}>
                <p className="text-[14px] text-muted">{t('wizard.outlet')}</p>
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
                      <span>{t('wizard.outlet.choose')}</span>
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
                                title={t('wizard.editNamed', { name: outlet.name })}
                                aria-label={t('wizard.editNamed', { name: outlet.name })}
                                className="w-9 h-9 rounded flex items-center justify-center text-muted hover:text-ink hover:bg-paper-control/40 cursor-pointer"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteOutlet(e, outlet.id)}
                                disabled={outlets.length <= 1}
                                title={outlets.length <= 1 ? t('wizard.outlet.cannotDeleteOnly') : t('wizard.deleteNamed', { name: outlet.name })}
                                aria-label={t('wizard.deleteNamed', { name: outlet.name })}
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
                      <Plus className="w-4 h-4" /> {t('wizard.outlet.add')}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <LanguageSwitch />
              <button type="button" onClick={() => setIsBoothSettingsOpen(true)} className={BTN_S}>
                {t('settings.open')}
              </button>
              <button type="button" onClick={() => onSignOut?.()} title={t('wizard.signOutTitle')} className={BTN_S}>
                {t('wizard.signOut')}
              </button>
            </div>
          </header>

          <div className="grid lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] gap-10 flex-1 min-h-0">
            <section className="flex flex-col gap-4 min-h-0">
              <div className="flex items-center justify-between">
                <h2 className="text-[20px] font-semibold tracking-tight">{t('wizard.events')}</h2>
                <button type="button" onClick={() => setIsAddEventModalOpen(true)} title={t('wizard.event.newTitle')} className="h-10 px-3 rounded border border-paper-control text-[15px] font-medium cursor-pointer hover:bg-paper-surface">
                  <span className="inline-flex items-center gap-1.5"><Plus className="w-4 h-4" /> {t('wizard.event.new')}</span>
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
                        title={events.length <= 1 ? t('wizard.event.cannotDeleteLast') : t('wizard.deleteNamed', { name: ev.name })}
                        aria-label={t('wizard.deleteNamed', { name: ev.name })}
                        className="w-9 h-9 rounded flex items-center justify-center text-muted hover:text-negative disabled:opacity-30 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>

              <p className="text-[14px] text-muted pt-3 border-t border-paper-line">
                {t('wizard.event.strip')} <span className="text-ink">{settings.eventName}</span>, {settings.eventDate}, {settings.eventHashtag}
              </p>
            </section>

            <section className="flex flex-col gap-8 min-w-0">
              <div className="flex flex-col gap-3">
                <h2 className="text-[20px] font-semibold tracking-tight">{t('wizard.mode')}</h2>
                <div className="grid md:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSettings((s) => ({ ...s, operatingMode: 'event' }))}
                    aria-pressed={settings.operatingMode === 'event'}
                    className={`p-4 rounded border text-left cursor-pointer ${settings.operatingMode === 'event' ? 'border-ink ring-1 ring-ink' : 'border-paper-control hover:bg-paper-surface'}`}
                  >
                    <p className="text-[18px] font-medium">{t('wizard.mode.event')}</p>
                    <p className="text-[15px] text-muted mt-1">{t('wizard.mode.eventDesc')}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings((s) => ({ ...s, operatingMode: 'regular' }))}
                    aria-pressed={settings.operatingMode === 'regular'}
                    className={`p-4 rounded border text-left cursor-pointer ${settings.operatingMode === 'regular' ? 'border-ink ring-1 ring-ink' : 'border-paper-control hover:bg-paper-surface'}`}
                  >
                    <p className="text-[18px] font-medium">{t('wizard.mode.regular')}</p>
                    <p className="text-[15px] text-muted mt-1">{t('wizard.mode.regularDesc')}</p>
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <h2 className="text-[20px] font-semibold tracking-tight">{t('wizard.capture')}</h2>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'photo' as CaptureModeType, name: t('wizard.capture.photo') },
                    { id: 'boomerang' as CaptureModeType, name: t('wizard.capture.boomerang') },
                    { id: 'gif' as CaptureModeType, name: t('wizard.capture.gif') },
                    { id: 'video' as CaptureModeType, name: t('wizard.capture.video') },
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
                  <h2 className="text-[20px] font-semibold tracking-tight">{t('wizard.welcome')}</h2>
                  <span className="text-[14px] text-muted">{settings.customWelcomeImageUrl ? t('wizard.welcome.hasPhoto') : t('wizard.welcome.pickOrUpload')}</span>
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
                    title={t('wizard.welcome.ownPhotoTitle')}
                    aria-pressed={settings.welcomeTheme === 'custom' || !!settings.customWelcomeImageUrl}
                    className={`p-3 rounded border text-left text-[14px] cursor-pointer ${settings.welcomeTheme === 'custom' || settings.customWelcomeImageUrl ? 'border-ink ring-1 ring-ink' : 'border-paper-control hover:bg-paper-surface'}`}
                  >
                    {t('wizard.welcome.ownPhoto')}
                  </button>
                </div>

                <input ref={welcomeFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleWelcomeImageUpload} />

                {settings.customWelcomeImageUrl ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded border border-paper-control">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={settings.customWelcomeImageUrl} alt={t('wizard.welcome.alt')} className="w-14 h-14 object-cover bg-paper-surface" />
                      <p className="text-[15px]">{t('wizard.welcome.photoOn')}</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => welcomeFileInputRef.current?.click()} className={BTN_S}>{t('wizard.replace')}</button>
                      <button type="button" onClick={handleRemoveWelcomeImage} className={BTN_S}>{t('wizard.remove')}</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[14px] text-muted">{t('wizard.welcome.hint')}</p>
                    <button type="button" onClick={() => welcomeFileInputRef.current?.click()} className={BTN_S}>{t('wizard.welcome.upload')}</button>
                  </div>
                )}

                <label className="flex flex-col gap-2">
                  <span className={LABEL}>{t('wizard.welcome.headline')}</span>
                  <input
                    type="text"
                    value={settings.customWelcomeHeadline || ''}
                    onChange={(e) => setSettings((s) => ({ ...s, customWelcomeHeadline: e.target.value }))}
                    placeholder={t('wizard.welcome.headlinePlaceholder')}
                    className={INPUT}
                  />
                </label>
              </div>

              <div className="mt-auto pt-6 border-t border-paper-line flex flex-wrap items-center justify-between gap-4">
                <p className="text-[15px] text-muted">{t('wizard.step1')}</p>
                <button type="button" onClick={() => setCurrentPage(2)} className={BTN_P}>
                  {t('wizard.nextLayout')}
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
              <p className="text-[14px] text-muted">{t('wizard.step2')}</p>
              <h1 className="text-[clamp(26px,2.4vw,36px)] leading-none font-semibold tracking-[-0.02em] mt-1">{t('wizard.page2.title')}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <LanguageSwitch />
              <button type="button" onClick={() => setIsBoothSettingsOpen(true)} className={BTN_S}>
                {t('settings.open')}
              </button>
              <button type="button" onClick={() => setCurrentPage(1)} className={BTN_S}>
                <span className="inline-flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> {t('wizard.back')}</span>
              </button>
              <button type="button" onClick={() => onSaveAndLaunch(settings, template)} className={BTN_P}>
                <span className="inline-flex items-center gap-2"><Check className="w-4 h-4" /> {t('wizard.launch')}</span>
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
                      {t('wizard.slotsCount', { n: template.slotCount })}
                      <ChevronDown className={`w-4 h-4 transition-transform ${isTemplateDropdownOpen ? 'rotate-180' : ''}`} />
                    </span>
                  </button>

                  {isTemplateDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 max-h-72 overflow-y-auto bg-paper border border-paper-control rounded z-50">
                      {customTemplates.length > 0 && (
                        <div className="py-1">
                          <p className="px-4 py-2 text-[13px] text-muted">{t('wizard.frames.yours')}</p>
                          {customTemplates.map((t) => {
                            const isSelected = template.id === t.id;
                            return (
                              <div key={t.id} className={`flex items-center justify-between gap-2 px-4 hover:bg-paper-surface ${isSelected ? 'bg-paper-surface' : ''}`}>
                                <button type="button" onClick={() => handleSelectPreset(t)} className="flex-1 text-left py-3 text-[16px] cursor-pointer flex items-center justify-between gap-3">
                                  <span className="truncate">{t.name}</span>
                                  {isSelected && <Check className="w-4 h-4 text-accent shrink-0" />}
                                </button>
                                <button type="button" onClick={(e) => handleDeleteCustomTemplate(e, t.id)} aria-label={deleteLabel(t.name)} className="w-9 h-9 flex items-center justify-center text-muted hover:text-negative cursor-pointer">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div className="py-1 border-t border-paper-line">
                        <p className="px-4 py-2 text-[13px] text-muted">{t('wizard.frames.builtIn')}</p>
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
                          <Upload className="w-4 h-4" /> {t('wizard.frame.upload')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <input ref={templateFileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleUploadCustomTemplate} className="hidden" />

                <div className="flex items-center gap-2">
                  <button type="button" onClick={handleAddSlot} disabled={template.slots.length >= 8} className={`${BTN_S} disabled:opacity-40`}>
                    <span className="inline-flex items-center gap-1.5"><Plus className="w-4 h-4" /> {t('wizard.window.add')}</span>
                  </button>
                  <button type="button" onClick={() => handleRemoveSlot(selectedSlotId)} disabled={template.slots.length <= 1} aria-label={t('wizard.window.removeTitle')} title={t('wizard.window.removeTitle')} className="w-12 h-12 rounded border border-paper-control flex items-center justify-center text-muted hover:text-negative disabled:opacity-40 cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 relative z-20">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[14px] text-muted tabular-nums">
                    {t('wizard.windowsCount', { category: template.category, n: template.slots.length })}
                  </span>
                  {template.overlayPngUrl && (
                    <button type="button" onClick={handleReDetectCurrentTemplate} disabled={isAnalyzingTemplate} title={t('wizard.frame.findAgainTitle')} className="h-9 px-3 rounded border border-paper-control text-[14px] cursor-pointer hover:bg-paper-surface disabled:opacity-40">
                      {t('wizard.frame.findAgain')}
                    </button>
                  )}
                  {template.isCustom && (
                    <button type="button" onClick={(e) => handleDeleteCustomTemplate(e, template.id)} title={t('wizard.frame.deleteTitle')} className="h-9 px-3 rounded text-[14px] text-negative cursor-pointer hover:bg-paper-surface">
                      {t('wizard.frame.delete')}
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
                    {t('wizard.window.sizePosition', { n: template.slots.findIndex((s) => s.id === currentSlot?.id) + 1 })}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isSlotCustomizationOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isSlotCustomizationOpen && (
                    <div className="absolute top-11 right-0 w-[340px] bg-paper border border-paper-control rounded p-5 z-50 grid gap-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[16px] font-medium">{t('wizard.window.title', { n: template.slots.findIndex((s) => s.id === currentSlot?.id) + 1 })}</p>
                        <button type="button" onClick={() => setIsSlotCustomizationOpen(false)} aria-label={t('wizard.close')} className="w-9 h-9 rounded flex items-center justify-center text-muted hover:text-ink hover:bg-paper-surface cursor-pointer">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-4 text-[14px]">
                        <label className="flex items-center gap-2">{t('wizard.frame.colour')} <input type="color" value={template.backgroundColor} onChange={(e) => setTemplate((prev) => ({ ...prev, backgroundColor: e.target.value }))} title={t('wizard.frame.colour')} className="w-8 h-8 cursor-pointer bg-transparent" /></label>
                        <label className="flex items-center gap-2">{t('wizard.frame.edgeColour')} <input type="color" value={template.accentColor} onChange={(e) => setTemplate((prev) => ({ ...prev, accentColor: e.target.value }))} title={t('wizard.frame.edgeColour')} className="w-8 h-8 cursor-pointer bg-transparent" /></label>
                      </div>

                      {currentSlot && (
                        <div className="grid grid-cols-2 gap-4 text-[14px]">
                          <label className="grid gap-2">
                            <span className="flex justify-between text-muted"><span>{t('wizard.slot.left')}</span><span className="tabular-nums text-ink">{Math.round(currentSlot.x)}%</span></span>
                            <input type="range" min="0" max={100 - currentSlot.width} value={currentSlot.x} onChange={(e) => handleSlotPositionChange(currentSlot.id, { x: parseFloat(e.target.value) })} className="w-full accent-ink cursor-pointer" />
                          </label>
                          <label className="grid gap-2">
                            <span className="flex justify-between text-muted"><span>{t('wizard.slot.top')}</span><span className="tabular-nums text-ink">{Math.round(currentSlot.y)}%</span></span>
                            <input type="range" min="0" max={100 - currentSlot.height} value={currentSlot.y} onChange={(e) => handleSlotPositionChange(currentSlot.id, { y: parseFloat(e.target.value) })} className="w-full accent-ink cursor-pointer" />
                          </label>
                          <label className="grid gap-2">
                            <span className="flex justify-between text-muted"><span>{t('wizard.slot.width')}</span><span className="tabular-nums text-ink">{Math.round(currentSlot.width)}%</span></span>
                            <input type="range" min="15" max="96" value={currentSlot.width} onChange={(e) => handleSlotPositionChange(currentSlot.id, { width: parseFloat(e.target.value) })} className="w-full accent-ink cursor-pointer" />
                          </label>
                          <label className="grid gap-2">
                            <span className="flex justify-between text-muted"><span>{t('wizard.slot.height')}</span><span className="tabular-nums text-ink">{Math.round(currentSlot.height)}%</span></span>
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
                    <img src={template.overlayPngUrl} alt={t('wizard.frame.artwork')} className="absolute inset-0 w-full h-full object-fill pointer-events-none z-10 select-none" />
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
                      <p className="text-[16px] font-medium">{t('wizard.finding')}</p>
                      <p className="text-[14px] text-muted">{t('wizard.takesMoment')}</p>
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
                  {t('wizard.textOnStrip')}
                </label>
                {template.includeText !== false && (
                  <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                    <input
                      type="text"
                      value={template.customText ?? settings.eventName ?? ''}
                      onChange={(e) => setTemplate((prev) => ({ ...prev, customText: e.target.value }))}
                      placeholder={t('wizard.textPlaceholder')}
                      className={`${INPUT} flex-1`}
                    />
                    <input type="color" value={template.textColor} onChange={(e) => setTemplate((prev) => ({ ...prev, textColor: e.target.value }))} title={t('wizard.textColour')} className="w-11 h-11 cursor-pointer bg-transparent" />
                  </div>
                )}
              </div>
            </section>

            <section className="flex flex-col gap-6 min-h-0 min-w-0 overflow-y-auto">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-[20px] font-semibold tracking-tight">{t('wizard.camera')}</h2>
                  <span className="text-[14px] text-muted">
                    {cameraStatus === 'connected' ? (dslrConnected && settings.useDslr ? t('wizard.camera.canonReady') : t('wizard.camera.connected')) : cameraStatus === 'checking' ? t('wizard.camera.checking') : t('wizard.camera.notConnected')}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <select value={selectedDeviceId} onChange={(e) => handleDeviceChange(e.target.value)} className={`${INPUT} flex-1`} aria-label={t('wizard.camera')}>
                    {videoDevices.length === 0 ? (
                      <option value="">{t('wizard.camera.default')}</option>
                    ) : (
                      videoDevices.map((dev, i) => (
                        <option key={dev.deviceId || i} value={dev.deviceId}>
                          {dev.label || t('wizard.camera.fallback', { n: i + 1 })}
                        </option>
                      ))
                    )}
                  </select>
                  <button type="button" onClick={refreshCameraDevices} title={t('wizard.camera.lookAgainTitle')} aria-label={t('wizard.camera.lookAgainTitle')} className="w-11 h-11 rounded border border-paper-control flex items-center justify-center cursor-pointer hover:bg-paper-surface shrink-0">
                    <RefreshCw className={`w-4 h-4 ${isProbingDevices ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {settings.useDslr && (
                  <div className="flex items-center justify-between gap-3 p-3 border border-paper-control rounded">
                    <div>
                      <p className="text-[15px] font-medium">{dslrConnected ? dslrModel : t('wizard.camera.noCanon')}</p>
                      <p className="text-[14px] text-muted">{dslrConnected ? t('devices.usbConnected') : t('wizard.camera.usbHint')}</p>
                    </div>
                    <button type="button" onClick={refreshCameraDevices} className={BTN_S}>{t('wizard.lookAgain')}</button>
                  </div>
                )}

                <div className="relative w-full aspect-video bg-stage overflow-hidden">
                  {!settings.useDslr ? (
                    <>
                      <video ref={previewVideoRef} autoPlay playsInline muted style={{ transform: settings.mirrorCamera ? 'scaleX(-1)' : 'none' }} className="w-full h-full object-cover" />
                      {!previewStreamActive && (
                        <div className="absolute inset-0 flex items-center justify-center text-[15px] text-stage-muted">{t('wizard.camera.starting')}</div>
                      )}
                    </>
                  ) : dslrConnected ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src="http://localhost:8000/camera/liveview" alt={t('wizard.camera.liveViewAlt')} className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }} />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-[15px] text-stage-muted">{t('wizard.camera.noLiveView')}</div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <h2 className="text-[20px] font-semibold tracking-tight">{t('wizard.timing')}</h2>
                <div className="grid sm:grid-cols-2 gap-6">
                  <label className="grid gap-2">
                    <span className="flex justify-between text-[15px]"><span>{t('wizard.timing.pose')}</span><span className="tabular-nums">{t('wizard.seconds', { n: settings.countdownSeconds })}</span></span>
                    <input type="range" min="2" max="10" step="1" value={settings.countdownSeconds} onChange={(e) => setSettings((s) => ({ ...s, countdownSeconds: parseInt(e.target.value) }))} className="w-full accent-ink cursor-pointer" />
                  </label>
                  <label className="grid gap-2">
                    <span className="flex justify-between text-[15px]"><span>{t('wizard.timing.review')}</span><span className="tabular-nums">{t('wizard.seconds', { n: settings.reviewDurationSeconds || 5 })}</span></span>
                    <input type="range" min="3" max="12" step="1" value={settings.reviewDurationSeconds || 5} onChange={(e) => setSettings((s) => ({ ...s, reviewDurationSeconds: parseInt(e.target.value) }))} className="w-full accent-ink cursor-pointer" />
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 p-4 border border-paper-control rounded">
                <div>
                  <p className="text-[14px] text-muted">{t('wizard.printer')}</p>
                  <p className="text-[16px] font-medium">{selectedPrinterModel}</p>
                </div>
                <button type="button" onClick={() => setIsPrinterModalOpen(true)} className={BTN_S}>{t('wizard.printer.setup')}</button>
              </div>

              <div className="flex flex-col gap-3">
                <h2 className="text-[20px] font-semibold tracking-tight">{t('wizard.options')}</h2>
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-[15px]">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={settings.playAudioCues} onChange={(e) => setSettings((s) => ({ ...s, playAudioCues: e.target.checked }))} className="w-4 h-4 accent-ink cursor-pointer" />
                    {t('wizard.opt.beeps')}
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={settings.showFlashEffect} onChange={(e) => setSettings((s) => ({ ...s, showFlashEffect: e.target.checked }))} className="w-4 h-4 accent-ink cursor-pointer" />
                    {t('wizard.opt.flash')}
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={settings.mirrorCamera} onChange={(e) => setSettings((s) => ({ ...s, mirrorCamera: e.target.checked }))} className="w-4 h-4 accent-ink cursor-pointer" />
                    {t('wizard.opt.mirror')}
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={settings.printEnabled} onChange={(e) => setSettings((s) => ({ ...s, printEnabled: e.target.checked }))} className="w-4 h-4 accent-ink cursor-pointer" />
                    {t('wizard.opt.print')}
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
              <h3 className="text-[22px] font-semibold tracking-tight">{t('wizard.event.new')}</h3>
              <button type="button" onClick={() => setIsAddEventModalOpen(false)} aria-label={t('wizard.close')} className="w-10 h-10 rounded flex items-center justify-center text-muted hover:text-ink hover:bg-paper-surface cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="grid gap-4">
              <label className="grid gap-2">
                <span className={LABEL}>{t('wizard.event.name')}</span>
                <input type="text" required placeholder={t('wizard.event.namePlaceholder')} value={newEventName} onChange={(e) => setNewEventName(e.target.value)} className={INPUT} />
              </label>
              <label className="grid gap-2">
                <span className={LABEL}>{t('wizard.event.date')}</span>
                <input type="text" placeholder={t('wizard.event.datePlaceholder')} value={newEventDate} onChange={(e) => setNewEventDate(e.target.value)} className={INPUT} />
              </label>
              <label className="grid gap-2">
                <span className={LABEL}>{t('wizard.event.hashtag')}</span>
                <input type="text" placeholder={t('wizard.event.hashtagPlaceholder')} value={newEventHashtag} onChange={(e) => setNewEventHashtag(e.target.value)} className={INPUT} />
              </label>
              <label className="grid gap-2">
                <span className={LABEL}>{t('wizard.event.footer')}</span>
                <input type="text" placeholder={t('wizard.event.footerPlaceholder')} value={newEventFooterText} onChange={(e) => setNewEventFooterText(e.target.value)} className={INPUT} />
              </label>

              <div className="flex flex-wrap justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsAddEventModalOpen(false)} className={BTN_S}>{t('wizard.cancel')}</button>
                <button type="submit" className={BTN_P}>{t('wizard.event.save')}</button>
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
              <h3 className="text-[22px] font-semibold tracking-tight">{t('wizard.outlet.add')}</h3>
              <button type="button" onClick={() => setIsAddOutletModalOpen(false)} aria-label={t('wizard.close')} className="w-10 h-10 rounded flex items-center justify-center text-muted hover:text-ink hover:bg-paper-surface cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOutlet} className="grid gap-4">
              <label className="grid gap-2">
                <span className={LABEL}>{t('wizard.outlet.name')}</span>
                <input type="text" required placeholder={t('wizard.outlet.namePlaceholder')} value={newOutletName} onChange={(e) => setNewOutletName(e.target.value)} className={INPUT} />
              </label>
              <label className="grid gap-2">
                <span className={LABEL}>{t('wizard.outlet.location')}</span>
                <input type="text" placeholder={t('wizard.outlet.locationPlaceholder')} value={newOutletLocation} onChange={(e) => setNewOutletLocation(e.target.value)} className={INPUT} />
              </label>
              <label className="grid gap-2">
                <span className={LABEL}>{t('wizard.outlet.code')}</span>
                <input type="text" placeholder={t('wizard.outlet.codePlaceholder')} value={newOutletCode} onChange={(e) => setNewOutletCode(e.target.value)} className={`${INPUT} tabular-nums`} />
              </label>

              <div className="flex flex-wrap justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsAddOutletModalOpen(false)} className={BTN_S}>{t('wizard.cancel')}</button>
                <button type="submit" className={BTN_P}>{t('wizard.outlet.save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditOutletModalOpen && (
        <div className="fixed inset-0 z-60 bg-ink/40 flex items-center justify-center p-6 animate-fade-in">
          <div className="w-full max-w-lg bg-paper border border-paper-control rounded p-8 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[22px] font-semibold tracking-tight">{t('wizard.outlet.edit')}</h3>
              <button type="button" onClick={() => setIsEditOutletModalOpen(false)} aria-label={t('wizard.close')} className="w-10 h-10 rounded flex items-center justify-center text-muted hover:text-ink hover:bg-paper-surface cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateOutlet} className="grid gap-4">
              <label className="grid gap-2">
                <span className={LABEL}>{t('wizard.outlet.name')}</span>
                <input type="text" required placeholder={t('wizard.outlet.namePlaceholder')} value={editOutletName} onChange={(e) => setEditOutletName(e.target.value)} className={INPUT} />
              </label>
              <label className="grid gap-2">
                <span className={LABEL}>{t('wizard.outlet.location')}</span>
                <input type="text" placeholder={t('wizard.outlet.locationPlaceholder')} value={editOutletLocation} onChange={(e) => setEditOutletLocation(e.target.value)} className={INPUT} />
              </label>
              <label className="grid gap-2">
                <span className={LABEL}>{t('wizard.outlet.code')}</span>
                <input type="text" placeholder={t('wizard.outlet.codePlaceholder')} value={editOutletCode} onChange={(e) => setEditOutletCode(e.target.value)} className={`${INPUT} tabular-nums`} />
              </label>

              <div className="flex flex-wrap justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsEditOutletModalOpen(false)} className={BTN_S}>{t('wizard.cancel')}</button>
                <button type="submit" className={BTN_P}>{t('wizard.outlet.update')}</button>
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
              <h3 className="text-[22px] font-semibold tracking-tight">{t('wizard.printer.setup')}</h3>
              <button type="button" onClick={() => setIsPrinterModalOpen(false)} aria-label={t('wizard.close')} className="w-10 h-10 rounded flex items-center justify-center text-muted hover:text-ink hover:bg-paper-surface cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid gap-3 p-4 border border-paper-control rounded">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[16px] font-medium">
                  {printerUsbStatus === 'connected' ? t('wizard.printer.connected') : t('wizard.printer.looking')}
                </p>
                <button type="button" onClick={handleScanUsbPrinters} disabled={isScanningPrinters} className={BTN_S}>
                  {isScanningPrinters ? t('wizard.printer.scanning') : t('wizard.lookAgain')}
                </button>
              </div>
              <div className="grid gap-2">
                <div className="flex justify-between text-[14px] text-muted">
                  <span>{t('wizard.printer.ribbon')}</span>
                  <span className="tabular-nums text-ink">{t('wizard.printer.count', { n: printerRibbonCuts, max: printerTotalCapacity, pct: Math.round((printerRibbonCuts / printerTotalCapacity) * 100) })}</span>
                </div>
                <div className="w-full h-2 bg-paper-surface overflow-hidden">
                  <div className="h-full bg-ink transition-all duration-500" style={{ width: `${Math.round((printerRibbonCuts / printerTotalCapacity) * 100)}%` }} />
                </div>
              </div>
            </div>

            <label className="grid gap-2">
              <span className={LABEL}>{t('wizard.printer')}</span>
              <select value={selectedPrinterModel} onChange={(e) => setSelectedPrinterModel(e.target.value)} className={INPUT}>
                <option value="DNP DS-RX1HS">{t('wizard.printer.opt.rx1hs')}</option>
                <option value="Citizen CY-02">{t('wizard.printer.opt.cy02')}</option>
                <option value="DNP QW410">{t('wizard.printer.opt.qw410')}</option>
                <option value="DNP DS620A">{t('wizard.printer.opt.ds620a')}</option>
                <option value="System Default Spooler">{t('wizard.printer.opt.system')}</option>
              </select>
            </label>

            <div className="grid gap-2">
              <span className={LABEL}>{t('wizard.paper')}</span>
              <div className="grid sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedPaperFormat('strip-2x6')}
                  aria-pressed={selectedPaperFormat === 'strip-2x6'}
                  className={`p-4 rounded border text-left cursor-pointer ${selectedPaperFormat === 'strip-2x6' ? 'border-ink ring-1 ring-ink' : 'border-paper-control hover:bg-paper-surface'}`}
                >
                  <p className="text-[16px] font-medium">{t('wizard.paper.strip')}</p>
                  <p className="text-[14px] text-muted mt-1">{t('wizard.paper.stripDesc')}</p>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPaperFormat('photo-4x6')}
                  aria-pressed={selectedPaperFormat === 'photo-4x6'}
                  className={`p-4 rounded border text-left cursor-pointer ${selectedPaperFormat === 'photo-4x6' ? 'border-ink ring-1 ring-ink' : 'border-paper-control hover:bg-paper-surface'}`}
                >
                  <p className="text-[16px] font-medium">{t('wizard.paper.photo')}</p>
                  <p className="text-[14px] text-muted mt-1">{t('wizard.paper.photoDesc')}</p>
                </button>
              </div>
            </div>

            {printTestMessage && (
              <p role="status" className="text-[15px] p-3 border border-paper-control rounded">{printTestMessage}</p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-paper-line">
              <button type="button" onClick={handleSendTestPrint} disabled={isTestingPrint} className={BTN_S}>
                {isTestingPrint ? t('wizard.printer.sending') : t('wizard.printer.testPrint')}
              </button>
              <button type="button" onClick={() => setIsPrinterModalOpen(false)} className={BTN_P}>
                {t('wizard.saveClose')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
