export type BoothOperatingMode = 'event' | 'regular';

export type CaptureModeType = 'photo' | 'gif' | 'boomerang' | 'video';

export type WelcomeScreenTheme =
  | 'neon_cyber'
  | 'luxury_gold'
  | 'retro_y2k'
  | 'clean_studio'
  | 'pastel_romance';

export type StripLayout = 'strip-3' | 'strip-4' | 'grid-2x2' | 'single' | '4r-classic' | 'a4-collage';

export type FrameCategory = 'strip' | '4r' | 'a4' | 'square';

export type PhotoFilter = 
  | 'none' 
  | 'bw' 
  | 'sepia' 
  | 'vintage' 
  | 'warm' 
  | 'cyberpunk' 
  | 'cold';

export interface StickerItem {
  id: string;
  emojiOrUrl: string;
  x: number;          // Position (0-100% or px)
  y: number;          // Position (0-100% or px)
  scale: number;      // Scale multiplier (e.g. 1.0)
  rotation: number;   // Rotation in degrees (0-360)
}

export interface FrameTheme {
  id: string;
  name: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  borderWidth: number;
}

export interface FrameSlot {
  id: string;
  x: number;          // Percentage or pixel offset (0-100%)
  y: number;
  width: number;      // Width percentage (0-100%)
  height: number;
  rotation?: number;
  aspectRatio: number; // e.g. 4/3 or 1/1
}

export interface PrintLayoutConfig {
  paperSize: 'strip-2x6' | 'photo-4x6' | 'poster-a4' | 'custom';
  widthMm: number;
  heightMm: number;
  slots: FrameSlot[];
  backgroundColor: string;
  themeId: string;
}

export interface LumaBoothConfig {
  operatingMode: BoothOperatingMode;
  activeCaptureModes: CaptureModeType[];
  selectedCaptureMode: CaptureModeType;
  printLayout: PrintLayoutConfig;
  countdownSeconds: number;
  delayBetweenShots: number;
  photoReviewDurationSeconds: number;
  autoPrint: boolean;
}

export interface FrameTemplate {
  id: string;
  name: string;
  category: FrameCategory;
  layout: StripLayout;
  slotCount: number;
  slots: FrameSlot[];
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  overlayPngUrl?: string; // Optional custom PNG border
  previewThumbnailUrl?: string;
}

export interface SlotAdjustment {
  slotId: string;
  photoIndex: number;
  zoom?: number;       // 1.0 to 3.0 (default 1.0)
  panX?: number;       // -100 to +100 px (default 0)
  panY?: number;       // -100 to +100 px (default 0)
  filter: PhotoFilter;
  stickers?: StickerItem[];
}

export interface PhotoboothPackage {
  id: string;
  name: string;
  description: string;
  price: number;              // in IDR / currency
  formattedPrice: string;
  shotsCount: number;
  physicalPrintsCount: number;
  includesLivePhotoGif: boolean;
  includesSoftFiles: boolean;
  isPopular?: boolean;
}

export interface ExtraPrintOption {
  id: string;
  name: string;
  pricePerUnit: number;
  quantity: number;
}

export interface VoucherCode {
  code: string;
  type: 'percentage' | 'fixed' | 'free';
  value: number; // e.g. 20 (for 20%), 15000, or 100%
  description: string;
  validUntil: string;
  isActive: boolean;
  usageCount: number;
}

export interface PaymentDetails {
  method: 'qris_midtrans' | 'qris_xendit' | 'cash_bypass';
  amount: number;
  qrisPayloadString?: string;
  qrisImageUrl?: string;
  transactionId: string;
  status: 'pending' | 'settled' | 'bypassed';
  staffBypassPinUsed?: boolean;
  voucherApplied?: VoucherCode;
}

export interface LivePhotoMedia {
  photoIndex: number;
  gifUrl: string;
  videoUrl?: string;
  durationSeconds: number;
}

export interface SocialConsent {
  granted: boolean;
  customerHandle?: string;
  timestamp: number;
}

export interface PhotoSession {
  id: string;
  createdAt: number;
  eventId: string;
  packageId: string;
  rawPhotos: string[];          // Base64 or Cloud URLs
  livePhotos?: LivePhotoMedia[]; // 5-second video / GIF captures
  compositeUrl: string;         // Final rendered frame/strip URL
  layout: StripLayout;
  filter: PhotoFilter;
  themeId: string;
  selectedTemplateId: string;
  slotAdjustments?: SlotAdjustment[];
  payment: PaymentDetails;
  consent: SocialConsent;
  storagePath?: string;
  guestDownloadUrl?: string;
  expiresAt: number;            // 30 days from creation
  printStatus: 'not_requested' | 'queued' | 'printed';
}

export interface POSItem {
  id: string;
  name: string;
  category: 'merchandise' | 'frame' | 'keychain' | 'packaging';
  price: number;
  stock: number;
  imageUrl?: string;
}

export interface QueueTicket {
  ticketNumber: string;
  customerName?: string;
  packageName: string;
  createdAt: number;
  estimatedWaitMinutes: number;
  status: 'waiting' | 'called' | 'completed' | 'cancelled';
  qrVerificationCode: string;
}

export interface DeviceTelemetry {
  deviceId: string;
  lastPingTime: number;
  isOnline: boolean;
  cpuPct: number;
  ramPct: number;
  camera: {
    connected: boolean;
    model: string;
  };
  printer: {
    connected: boolean;
    name: string;
    ribbonRemaining: number;
    ribbonPercentage: number;
    queueDepth: number;
  };
}

export interface BoothSettings {
  eventName: string;
  eventDate: string;
  eventHashtag: string;
  layout: StripLayout;
  countdownSeconds: number;
  showFlashEffect: boolean;
  playAudioCues: boolean;
  selectedFilter: PhotoFilter;
  selectedThemeId: string;
  welcomeTheme?: WelcomeScreenTheme;
  customOverlayUrl?: string;
  mirrorCamera: boolean;
  printEnabled: boolean;
  hardwareDaemonUrl?: string; // e.g. http://localhost:8000
}

// ============================================================================
// Firebase User & Outlet Hierarchy Domain Models
// Schema: users/{userId} -> outlets/{outletId} -> events/{eventId}
// ============================================================================

export type UserRole = 'owner' | 'operator' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: number;
  lastLoginAt?: number;
}

export interface Outlet {
  id: string;
  userId: string;       // Owner or parent user account ID
  name: string;         // e.g. "Grand Indonesia - Flagship"
  location: string;     // e.g. "West Mall Level 3, Jakarta"
  code: string;         // e.g. "GI-JKT-01"
  createdAt: number;
  updatedAt?: number;
}

export interface OutletEvent {
  id: string;
  outletId: string;     // Parent outlet reference
  userId: string;       // Parent user reference
  name: string;         // e.g. "Summer Gala 2026"
  date: string;         // e.g. "OCT 2026"
  hashtag: string;      // e.g. "#QuickPicSummer"
  stripFooterText?: string;
  operatingMode?: BoothOperatingMode;
  welcomeTheme?: WelcomeScreenTheme;
  createdAt: number;
  updatedAt?: number;
}
