export type StripLayout = 'strip-3' | 'strip-4' | 'grid-2x2' | 'single';

export type PhotoFilter = 
  | 'none' 
  | 'bw' 
  | 'sepia' 
  | 'vintage' 
  | 'warm' 
  | 'cyberpunk' 
  | 'cold';

export interface FrameTheme {
  id: string;
  name: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  borderWidth: number;
  overlayUrl?: string; // Optional custom PNG frame
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
  customOverlayUrl?: string;
  mirrorCamera: boolean;
  printEnabled: boolean;
}

export interface PhotoSession {
  id: string;
  createdAt: number;
  eventId: string;
  rawPhotos: string[]; // Base64 or Blob URLs
  compositeUrl: string; // Final rendered strip URL / Base64
  layout: StripLayout;
  filter: PhotoFilter;
  themeId: string;
  storagePath?: string;
  guestDownloadUrl?: string;
}

export interface EventConfig {
  id: string;
  title: string;
  date: string;
  hashtag: string;
  boothSettings: BoothSettings;
  photoCount: number;
  createdAt: number;
}
