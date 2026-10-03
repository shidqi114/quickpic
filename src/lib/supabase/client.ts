import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PhotoSession } from '@/types/photobooth';
import { uploadToCloudinary } from '@/lib/cloudinary';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  '';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Singleton Supabase browser client instance.
 * Safe for use in Next.js client components and Electron desktop runtime.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  return supabase;
}

// ==============================================================================
// Offline LocalStorage Resilience Cache
// Ensures physical photobooths never halt even during complete venue WiFi dropouts.
// ==============================================================================
const LOCAL_SESSIONS_STORAGE_KEY = 'quickpic_sessions_cache';
const PENDING_SYNC_STORAGE_KEY = 'quickpic_pending_sync_queue';

export type ExtendedPhotoSession = PhotoSession & {
  boothId?: string;
  synced?: boolean;
};

export function getLocalSessions(): Record<string, ExtendedPhotoSession> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LOCAL_SESSIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocalSession(session: ExtendedPhotoSession): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getLocalSessions();
    
    // Minimize payload for localStorage to prevent quota exhaustion
    // (Strip giant uncompressed raw photos arrays if they are huge data URLs)
    const sanitizedSession: ExtendedPhotoSession = {
      ...session,
      rawPhotos: (session.rawPhotos || []).map((p, idx) => 
        (p && p.length > 500000) ? p.slice(0, 100) : p
      ),
    };

    current[session.id] = sanitizedSession;

    // Retain only the 5 most recent sessions in local cache
    const keys = Object.keys(current);
    if (keys.length > 5) {
      const sortedKeys = keys.sort((a, b) => {
        const timeA = current[a]?.createdAt || 0;
        const timeB = current[b]?.createdAt || 0;
        return timeB - timeA; // Descending
      });
      const trimmed: Record<string, ExtendedPhotoSession> = {};
      sortedKeys.slice(0, 5).forEach((k) => {
        trimmed[k] = current[k];
      });
      localStorage.setItem(LOCAL_SESSIONS_STORAGE_KEY, JSON.stringify(trimmed));
      return;
    }

    localStorage.setItem(LOCAL_SESSIONS_STORAGE_KEY, JSON.stringify(current));
  } catch (err: any) {
    if (err?.name === 'QuotaExceededError' || err?.code === 22) {
      try {
        // Quota exceeded: keep only the single current session
        const minimal: Record<string, ExtendedPhotoSession> = {};
        minimal[session.id] = {
          ...session,
          rawPhotos: [],
        };
        localStorage.setItem(LOCAL_SESSIONS_STORAGE_KEY, JSON.stringify(minimal));
      } catch {
        // If still full, clear non-critical caches
        localStorage.removeItem(LOCAL_SESSIONS_STORAGE_KEY);
      }
    }
  }
}

function queueForPendingSync(sessionId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(PENDING_SYNC_STORAGE_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(sessionId)) {
      list.push(sessionId);
      localStorage.setItem(PENDING_SYNC_STORAGE_KEY, JSON.stringify(list));
    }
  } catch (err) {
    console.error('[Supabase Client] Failed to enqueue session for sync:', err);
  }
}

function removeFromPendingSync(sessionId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(PENDING_SYNC_STORAGE_KEY);
    if (!raw) return;
    const list: string[] = JSON.parse(raw);
    const updated = list.filter((id) => id !== sessionId);
    localStorage.setItem(PENDING_SYNC_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('[Supabase Client] Failed to remove session from sync queue:', err);
  }
}

export function getPendingSyncSessionIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PENDING_SYNC_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Format database record back to PhotoSession domain model.
 */
function mapRecordToPhotoSession(record: any): ExtendedPhotoSession {
  return {
    id: record.id,
    createdAt: record.created_at ? new Date(record.created_at).getTime() : Date.now(),
    eventId: record.event_id || record.booth_id,
    boothId: record.booth_id,
    packageId: record.package_id || 'strip',
    rawPhotos: record.raw_photos || [],
    livePhotos: record.live_photos || [],
    compositeUrl: record.composite_url,
    layout: record.layout || 'strip-3',
    filter: record.filter || 'none',
    themeId: record.theme_id || '',
    selectedTemplateId: record.selected_template_id || '',
    slotAdjustments: record.slot_adjustments || [],
    payment: record.payment || {
      method: 'cash_bypass',
      amount: 0,
      transactionId: '',
      status: 'settled',
    },
    consent: record.consent || { granted: true, timestamp: Date.now() },
    guestDownloadUrl: record.guest_download_url,
    printStatus: record.print_status || 'not_requested',
    storagePath: record.storage_path,
    expiresAt: record.expires_at
      ? new Date(record.expires_at).getTime()
      : Date.now() + 30 * 24 * 3600 * 1000,
    synced: true,
  };
}

export const PUBLIC_GALLERY_BASE_URL =
  process.env.NEXT_PUBLIC_PUBLIC_GALLERY_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://quickpic-olive.vercel.app';

export function resolveGuestGalleryUrl(sessionId: string, cloudinaryUrl?: string): string {
  const base = PUBLIC_GALLERY_BASE_URL.replace(/\/+$/, '');
  return cloudinaryUrl
    ? `${base}/gallery/${sessionId}?img=${encodeURIComponent(cloudinaryUrl)}`
    : `${base}/gallery/${sessionId}`;
}

/**
 * Save photo session with instantaneous local caching and cloud sync.
 * Robust offline fallback ensures physical photobooth kiosks remain fully operational
 * even when internet connection drops.
 */
export async function savePhotoSession(
  session: ExtendedPhotoSession,
  boothId?: string
): Promise<{ guestUrl: string; id: string; cloudinaryUrl?: string }> {
  const resolvedBoothId = boothId || session.boothId || session.eventId || 'booth-default';

  let finalImageUrl = session.compositeUrl;
  let cloudinaryUrl: string | undefined = undefined;

  // 1. Upload rendered composite to Cloudinary if it's a data URL / base64 before creating guestUrl
  if (session.compositeUrl && session.compositeUrl.startsWith('data:')) {
    try {
      const uploaded = await uploadToCloudinary(
        session.compositeUrl,
        session.eventId || resolvedBoothId,
        session.id
      );
      if (uploaded) {
        cloudinaryUrl = uploaded;
        finalImageUrl = uploaded;
      }
    } catch (err) {
      console.warn('[Supabase Client] Cloudinary upload warning in savePhotoSession:', err);
    }
  } else if (
    session.compositeUrl &&
    (session.compositeUrl.startsWith('http://') || session.compositeUrl.startsWith('https://'))
  ) {
    cloudinaryUrl = session.compositeUrl;
  }

  // 2. Resolve public guest gallery URL (externally reachable by guest mobile phones scanning QR)
  const guestUrl = cloudinaryUrl
    ? `${PUBLIC_GALLERY_BASE_URL.replace(/\/+$/, '')}/gallery/${session.id}?img=${encodeURIComponent(cloudinaryUrl)}`
    : `${PUBLIC_GALLERY_BASE_URL.replace(/\/+$/, '')}/gallery/${session.id}`;

  const extendedSession: ExtendedPhotoSession = {
    ...session,
    boothId: resolvedBoothId,
    compositeUrl: finalImageUrl,
    guestDownloadUrl: guestUrl,
    synced: false,
  };

  // 3. Instant local persistence for zero kiosk latency
  saveLocalSession(extendedSession);
  queueForPendingSync(session.id);

  // 4. Sync to Supabase PostgreSQL database
  if (isSupabaseConfigured && supabase) {
    try {
      const payload = {
        id: session.id,
        booth_id: resolvedBoothId,
        event_id: session.eventId || resolvedBoothId,
        package_id: session.packageId || 'strip',
        raw_photos: session.rawPhotos || [],
        composite_url: finalImageUrl,
        live_photos: session.livePhotos || [],
        layout: session.layout,
        filter: session.filter,
        theme_id: session.themeId,
        selected_template_id: session.selectedTemplateId,
        slot_adjustments: session.slotAdjustments || [],
        payment: session.payment,
        consent: session.consent,
        guest_download_url: guestUrl,
        print_status: session.printStatus || 'not_requested',
        storage_path: session.storagePath || null,
        expires_at: session.expiresAt
          ? new Date(session.expiresAt).toISOString()
          : new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        created_at: new Date(session.createdAt || Date.now()).toISOString(),
      };

      const { error } = await supabase
        .from('sessions')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        console.warn('[Supabase Client] Session sync warning (persisted locally):', error.message);
      } else {
        // Successfully synced to cloud
        removeFromPendingSync(session.id);
        saveLocalSession({
          ...extendedSession,
          synced: true,
        });
      }
    } catch (err) {
      console.warn('[Supabase Client] Supabase sync offline buffer active:', err);
    }
  }

  return { guestUrl, id: session.id, cloudinaryUrl };
}

/**
 * Fetch a single photo session by ID with offline LocalStorage fallback.
 */
export async function getPhotoSession(id: string): Promise<PhotoSession | null> {
  if (!id) return null;

  // 1. Attempt fetching from Supabase cloud
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        return mapRecordToPhotoSession(data);
      }
    } catch (err) {
      console.warn('[Supabase Client] Cloud fetch failed, falling back to local cache:', err);
    }
  }

  // 2. Offline / LocalStorage fallback
  const local = getLocalSessions();
  if (local[id]) {
    return local[id];
  }

  const sessions = Object.values(local);
  const found = sessions.find((s) => s.id === id || s.id?.toLowerCase() === id?.toLowerCase());
  return found || null;
}

/**
 * Fetch recent sessions for a specific photobooth station.
 */
export async function getBoothSessions(
  boothId: string,
  limitCount = 20
): Promise<PhotoSession[]> {
  // 1. Attempt fetching from Supabase cloud
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('booth_id', boothId)
        .order('created_at', { ascending: false })
        .limit(limitCount);

      if (!error && data && data.length > 0) {
        return data.map(mapRecordToPhotoSession);
      }
    } catch (err) {
      console.warn('[Supabase Client] Cloud getBoothSessions failed, checking local cache:', err);
    }
  }

  // 2. Offline / LocalStorage fallback
  const localSessions = Object.values(getLocalSessions());
  const filtered = localSessions.filter(
    (s) => !boothId || s.boothId === boothId || s.eventId === boothId
  );

  return filtered
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limitCount);
}

/**
 * Synchronize any sessions captured while the kiosk was offline.
 * Can be triggered automatically upon window 'online' event or manual retry.
 */
export async function syncPendingSessions(boothId?: string): Promise<{ syncedCount: number; errors: number }> {
  if (!isSupabaseConfigured || !supabase) {
    return { syncedCount: 0, errors: 0 };
  }

  const pendingIds = getPendingSyncSessionIds();
  if (pendingIds.length === 0) {
    return { syncedCount: 0, errors: 0 };
  }

  const localSessions = getLocalSessions();
  let syncedCount = 0;
  let errors = 0;

  for (const id of pendingIds) {
    const session = localSessions[id];
    if (!session) {
      removeFromPendingSync(id);
      continue;
    }

    try {
      await savePhotoSession(session, boothId || session.boothId);
      syncedCount++;
    } catch {
      errors++;
    }
  }

  return { syncedCount, errors };
}
