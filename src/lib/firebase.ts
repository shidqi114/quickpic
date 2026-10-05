import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Firestore,
} from 'firebase/firestore';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  Auth,
  User as FirebaseUser,
} from 'firebase/auth';
import { getStorage, ref, uploadString, getDownloadURL, FirebaseStorage } from 'firebase/storage';
import type { PhotoSession, UserProfile, Outlet, OutletEvent } from '@/types/photobooth';
export type { UserProfile, Outlet, OutletEvent };
import { uploadToCloudinary } from '@/lib/cloudinary';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
};

export const isFirebaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
);

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let storage: FirebaseStorage | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
  } catch (err) {
    console.warn('Firebase initialization skipped or failed:', err);
  }
}

export function getFirebaseAuth(): Auth | null {
  return auth;
}

export function getFirebaseDb(): Firestore | null {
  return db;
}

export function getFirebaseStorage(): FirebaseStorage | null {
  return storage;
}

// ==============================================================================
// Local Storage Cache Keys for Physical Offline Kiosk Operation
// Ensures kiosks operate seamlessly even in completely offline venues
// ==============================================================================
const AUTH_STORAGE_KEY = 'quickpic_auth_user';
const SESSIONS_STORAGE_KEY = 'quickpic_sessions_cache';
const OUTLETS_PREFIX = 'quickpic_outlets_';
const EVENTS_PREFIX = 'quickpic_events_';

// Default mock outlets for demo/offline fallback
export const DEFAULT_DEMO_OUTLETS: Outlet[] = [
  {
    id: 'outlet-gi-01',
    userId: 'usr-demo-01',
    name: 'Grand Indonesia - Flagship',
    location: 'West Mall Level 3, Jakarta Pusat',
    code: 'GI-01',
    createdAt: 1700000000000,
  },
  {
    id: 'outlet-pim-02',
    userId: 'usr-demo-01',
    name: 'Pondok Indah Mall 2 - Atrium',
    location: 'North Skywalk 2nd Floor, Jakarta Selatan',
    code: 'PIM-02',
    createdAt: 1700000001000,
  },
  {
    id: 'outlet-sp-03',
    userId: 'usr-demo-01',
    name: 'Senayan City - Basement Zone',
    location: 'LG Floor Promenade, Jakarta Pusat',
    code: 'SC-03',
    createdAt: 1700000002000,
  },
];

// Default mock events for demo/offline fallback
export const DEFAULT_DEMO_EVENTS: OutletEvent[] = [
  {
    id: 'ev-1',
    outletId: 'outlet-gi-01',
    userId: 'usr-demo-01',
    name: 'Summer Gala 2026',
    date: 'OCT 2026',
    hashtag: '#QuickPicSummer',
    stripFooterText: '⚡ SUMMER GALA 2026',
    operatingMode: 'event',
    welcomeTheme: 'neon_cyber',
    createdAt: 1,
  },
  {
    id: 'ev-2',
    outletId: 'outlet-gi-01',
    userId: 'usr-demo-01',
    name: 'Wedding Maya & Alex',
    date: '12.10.2026',
    hashtag: '#MayaAlexWedding',
    stripFooterText: '💍 MAYA & ALEX 2026',
    operatingMode: 'event',
    welcomeTheme: 'pastel_romance',
    createdAt: 2,
  },
  {
    id: 'ev-3',
    outletId: 'outlet-pim-02',
    userId: 'usr-demo-01',
    name: 'Tech Summit 2026',
    date: 'NOV 2026',
    hashtag: '#TechSummit26',
    stripFooterText: '🚀 TECH SUMMIT 2026',
    operatingMode: 'regular',
    welcomeTheme: 'clean_studio',
    createdAt: 3,
  },
  {
    id: 'ev-4',
    outletId: 'outlet-sp-03',
    userId: 'usr-demo-01',
    name: 'VIP Birthday Bash',
    date: '2026',
    hashtag: '#VIPBirthday',
    stripFooterText: '🎉 HAPPY BIRTHDAY VIP',
    operatingMode: 'event',
    welcomeTheme: 'luxury_gold',
    createdAt: 4,
  },
];

// ==============================================================================
// 1. Firebase Authentication Services
// ==============================================================================

export function getCachedUser(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCachedUser(user: UserProfile | null) {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch (err) {
    console.error('Failed to update cached user:', err);
  }
}

/**
 * Sign in using Firebase Authentication with Email & Password.
 * Seamlessly stores session in local state for kiosk persistence.
 */
export async function signInWithEmail(email: string, pass: string): Promise<UserProfile> {
  if (auth) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      const fbUser = userCredential.user;
      const profile: UserProfile = {
        uid: fbUser.uid,
        email: fbUser.email || email,
        displayName: fbUser.displayName || email.split('@')[0],
        role: 'operator',
        createdAt: Date.now(),
        lastLoginAt: Date.now(),
      };

      // Fetch or sync user document in Firestore
      if (db) {
        try {
          const userDocRef = doc(db, 'users', fbUser.uid);
          const snap = await getDoc(userDocRef);
          if (snap.exists()) {
            const data = snap.data();
            profile.role = data.role || profile.role;
            profile.displayName = data.displayName || profile.displayName;
          } else {
            await setDoc(userDocRef, profile, { merge: true });
          }
        } catch (dbErr) {
          console.warn('Firestore user doc sync warning:', dbErr);
        }
      }

      setCachedUser(profile);
      return profile;
    } catch (err: any) {
      // In offline/demo mode, allow fallback sign-in if offline
      if (!navigator.onLine || err?.code === 'auth/network-request-failed') {
        return demoSignIn(email, email.split('@')[0]);
      }
      throw err;
    }
  }

  // Fallback for environment without live Firebase credentials
  return demoSignIn(email, email.split('@')[0]);
}

/**
 * Demo / Offline kiosk sign-in bypass for testing and offline field deployments.
 */
export function demoSignIn(
  email: string = 'operator@quickpic.io',
  displayName: string = 'Alex Pratama (Operator)'
): UserProfile {
  const profile: UserProfile = {
    uid: 'usr-demo-01',
    email,
    displayName,
    role: 'operator',
    createdAt: Date.now(),
    lastLoginAt: Date.now(),
  };
  setCachedUser(profile);
  return profile;
}

/**
 * Sign out operator from Firebase and clear local storage session.
 */
export async function signOutUser(): Promise<void> {
  if (auth) {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn('Firebase signOut error:', err);
    }
  }
  setCachedUser(null);
}

/**
 * Listen to auth state changes.
 */
export function subscribeToAuth(callback: (user: UserProfile | null) => void): () => void {
  // First callback with local cache for instant UI rendering
  const cached = getCachedUser();
  callback(cached);

  if (!auth) {
    return () => {};
  }

  const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
    if (fbUser) {
      const profile: UserProfile = {
        uid: fbUser.uid,
        email: fbUser.email || 'operator@quickpic.io',
        displayName: fbUser.displayName || 'Alex Pratama (Operator)',
        role: 'operator',
        createdAt: Date.now(),
        lastLoginAt: Date.now(),
      };
      setCachedUser(profile);
      callback(profile);
    } else {
      // If we don't have a cached session, signal null
      if (!getCachedUser()) {
        callback(null);
      }
    }
  });

  return unsubscribe;
}

// ==============================================================================
// 2. User & Multi-Outlet Collection Hierarchy
// Schema: users/{userId} -> outlets/{outletId} -> events/{eventId}
// ==============================================================================

/**
 * Fetch outlets belonging to a user.
 */
export async function getUserOutlets(userId: string): Promise<Outlet[]> {
  const cacheKey = `${OUTLETS_PREFIX}${userId}`;
  
  if (db && isFirebaseConfigured) {
    try {
      const outletsCol = collection(db, 'users', userId, 'outlets');
      const snap = await getDocs(outletsCol);
      const list: Outlet[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Outlet);
      });
      if (list.length > 0) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(cacheKey, JSON.stringify(list));
        }
        return list;
      }
    } catch (err) {
      console.warn('Firestore fetch outlets failed, using cache:', err);
    }
  }

  // Fallback to localStorage cache
  if (typeof window !== 'undefined') {
    try {
      const local = localStorage.getItem(cacheKey);
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
  }

  // Return default outlets if nothing found
  return DEFAULT_DEMO_OUTLETS;
}

/**
 * Create a new outlet under users/{userId}/outlets/{outletId}.
 */
export async function createOutlet(
  userId: string,
  data: Omit<Outlet, 'id' | 'userId' | 'createdAt'>
): Promise<Outlet> {
  const newOutletId = `outlet-${Date.now()}`;
  const newOutlet: Outlet = {
    id: newOutletId,
    userId,
    name: data.name,
    location: data.location,
    code: data.code,
    createdAt: Date.now(),
  };

  // 1. Try Firestore
  if (db && isFirebaseConfigured) {
    try {
      const outletDoc = doc(db, 'users', userId, 'outlets', newOutletId);
      await setDoc(outletDoc, newOutlet);
    } catch (err) {
      console.warn('Firestore save outlet failed, caching locally:', err);
    }
  }

  // 2. Update local cache
  if (typeof window !== 'undefined') {
    try {
      const cacheKey = `${OUTLETS_PREFIX}${userId}`;
      const existing = await getUserOutlets(userId);
      const updated = [...existing, newOutlet];
      localStorage.setItem(cacheKey, JSON.stringify(updated));
    } catch (err) {
      console.error('LocalStorage write failed:', err);
    }
  }

  return newOutlet;
}

/**
 * Fetch events under a specific outlet: users/{userId}/outlets/{outletId}/events.
 */
export async function getOutletEvents(userId: string, outletId: string): Promise<OutletEvent[]> {
  const cacheKey = `${EVENTS_PREFIX}${userId}_${outletId}`;

  if (db && isFirebaseConfigured) {
    try {
      const eventsCol = collection(db, 'users', userId, 'outlets', outletId, 'events');
      const snap = await getDocs(eventsCol);
      const list: OutletEvent[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as OutletEvent);
      });
      if (list.length > 0) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(cacheKey, JSON.stringify(list));
        }
        return list;
      }
    } catch (err) {
      console.warn('Firestore fetch outlet events failed, checking cache:', err);
    }
  }

  // Fallback to localStorage
  if (typeof window !== 'undefined') {
    try {
      const local = localStorage.getItem(cacheKey);
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
  }

  // Default events filtered for this outlet (or general demo events)
  const filtered = DEFAULT_DEMO_EVENTS.filter((e) => e.outletId === outletId);
  return filtered.length > 0 ? filtered : DEFAULT_DEMO_EVENTS;
}

/**
 * Create a new event under users/{userId}/outlets/{outletId}/events/{eventId}.
 */
export async function createOutletEvent(
  userId: string,
  outletId: string,
  data: Omit<OutletEvent, 'id' | 'userId' | 'outletId' | 'createdAt'>
): Promise<OutletEvent> {
  const newEventId = `ev-${Date.now()}`;
  const newEvent: OutletEvent = {
    id: newEventId,
    userId,
    outletId,
    name: data.name,
    date: data.date,
    hashtag: data.hashtag,
    stripFooterText: data.stripFooterText,
    operatingMode: data.operatingMode || 'event',
    welcomeTheme: data.welcomeTheme || 'neon_cyber',
    createdAt: Date.now(),
  };

  // 1. Save to Firestore
  if (db && isFirebaseConfigured) {
    try {
      const eventDoc = doc(db, 'users', userId, 'outlets', outletId, 'events', newEventId);
      await setDoc(eventDoc, newEvent);
    } catch (err) {
      console.warn('Firestore save event failed, caching locally:', err);
    }
  }

  // 2. Save to local storage
  if (typeof window !== 'undefined') {
    try {
      const cacheKey = `${EVENTS_PREFIX}${userId}_${outletId}`;
      const existing = await getOutletEvents(userId, outletId);
      const updated = [newEvent, ...existing];
      localStorage.setItem(cacheKey, JSON.stringify(updated));
    } catch (err) {
      console.error('LocalStorage write failed:', err);
    }
  }

  return newEvent;
}

/**
 * Delete an event under users/{userId}/outlets/{outletId}/events/{eventId}.
 */
export async function deleteOutletEvent(
  userId: string,
  outletId: string,
  eventId: string
): Promise<void> {
  if (db && isFirebaseConfigured) {
    try {
      const eventDoc = doc(db, 'users', userId, 'outlets', outletId, 'events', eventId);
      await deleteDoc(eventDoc);
    } catch (err) {
      console.warn('Firestore delete event failed:', err);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const cacheKey = `${EVENTS_PREFIX}${userId}_${outletId}`;
      const existing = await getOutletEvents(userId, outletId);
      const updated = existing.filter((e) => e.id !== eventId);
      localStorage.setItem(cacheKey, JSON.stringify(updated));
    } catch (err) {
      console.error('LocalStorage delete failed:', err);
    }
  }
}

// ==============================================================================
// 3. Photo Sessions & Booth Sessions
// ==============================================================================

export type ExtendedPhotoSession = PhotoSession & {
  boothId?: string;
  outletId?: string;
  synced?: boolean;
};

export function getLocalSessions(): Record<string, ExtendedPhotoSession> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocalSession(session: ExtendedPhotoSession): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getLocalSessions();
    const sanitizedSession: ExtendedPhotoSession = {
      ...session,
      rawPhotos: (session.rawPhotos || []).map((p) =>
        p && p.length > 500000 ? p.slice(0, 100) : p
      ),
    };

    current[session.id] = sanitizedSession;

    // Retain only the 10 most recent sessions in local cache
    const keys = Object.keys(current);
    if (keys.length > 10) {
      const sortedKeys = keys.sort((a, b) => {
        const timeA = current[a]?.createdAt || 0;
        const timeB = current[b]?.createdAt || 0;
        return timeB - timeA;
      });
      const trimmed: Record<string, ExtendedPhotoSession> = {};
      sortedKeys.slice(0, 10).forEach((k) => {
        trimmed[k] = current[k];
      });
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(trimmed));
      return;
    }

    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(current));
  } catch (e) {
    console.error('LocalStorage write failed:', e);
  }
}

export const PUBLIC_GALLERY_ORIGIN = (
  process.env.NEXT_PUBLIC_PUBLIC_GALLERY_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://quickpic-olive.vercel.app'
).replace(/\/+$/, '');

export async function savePhotoSession(
  session: ExtendedPhotoSession,
  boothId?: string
): Promise<{ guestUrl: string; id: string; cloudinaryUrl?: string }> {
  const resolvedBoothId = boothId || session.boothId || session.eventId || 'booth-default';

  let finalImageUrl = session.compositeUrl;
  let cloudinaryUrl: string | undefined = undefined;

  // 1. Try Cloudinary upload for fast CDN delivery
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
      console.warn('Cloudinary upload warning:', err);
    }
  } else if (
    session.compositeUrl &&
    (session.compositeUrl.startsWith('http://') || session.compositeUrl.startsWith('https://'))
  ) {
    cloudinaryUrl = session.compositeUrl;
  }

  const guestUrl = cloudinaryUrl
    ? `${PUBLIC_GALLERY_ORIGIN}/gallery/${session.id}?img=${encodeURIComponent(cloudinaryUrl)}`
    : `${PUBLIC_GALLERY_ORIGIN}/gallery/${session.id}`;

  const extendedSession: ExtendedPhotoSession = {
    ...session,
    boothId: resolvedBoothId,
    compositeUrl: finalImageUrl,
    guestDownloadUrl: guestUrl,
    synced: false,
  };

  // Immediate local save for kiosk resilience
  saveLocalSession(extendedSession);

  // Background Cloud Sync to Firebase Firestore & Storage
  const syncTask = async () => {
    try {
      if (storage && (!cloudinaryUrl || !finalImageUrl.startsWith('http'))) {
        try {
          const storageRef = ref(storage, `photos/${session.eventId}/${session.id}.jpg`);
          const uploadResult = await uploadString(storageRef, session.compositeUrl, 'data_url');
          finalImageUrl = await getDownloadURL(uploadResult.ref);
        } catch (storageErr) {
          console.warn('Firebase Storage upload skipped/failed:', storageErr);
        }
      }

      if (db && isFirebaseConfigured) {
        const sessionDoc = doc(db, 'photo_sessions', session.id);
        await setDoc(sessionDoc, {
          ...extendedSession,
          compositeUrl: finalImageUrl,
          guestDownloadUrl: guestUrl,
          synced: true,
          updatedAt: Date.now(),
        });
      }
    } catch (syncErr) {
      console.warn('Background sync warning:', syncErr);
    }
  };

  syncTask();

  return { guestUrl, id: session.id, cloudinaryUrl };
}

export async function getPhotoSession(id: string): Promise<ExtendedPhotoSession | null> {
  // 1. Firestore fetch
  if (db && isFirebaseConfigured) {
    try {
      const docRef = doc(db, 'photo_sessions', id);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return snapshot.data() as ExtendedPhotoSession;
      }
    } catch (err) {
      console.warn('Firestore fetch failed, checking local storage:', err);
    }
  }

  // 2. LocalStorage fallback
  const local = getLocalSessions();
  return local[id] || null;
}

export async function getBoothSessions(boothId: string): Promise<ExtendedPhotoSession[]> {
  if (db && isFirebaseConfigured) {
    try {
      let q = query(
        collection(db, 'photo_sessions'),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      if (boothId && boothId !== 'all') {
        q = query(
          collection(db, 'photo_sessions'),
          where('boothId', '==', boothId),
          limit(50)
        );
      }
      const snap = await getDocs(q);
      const list: ExtendedPhotoSession[] = [];
      snap.forEach((d) => {
        list.push(d.data() as ExtendedPhotoSession);
      });
      if (list.length > 0) return list;
    } catch (err) {
      console.warn('Firestore getBoothSessions failed, checking local:', err);
    }
  }

  const all = Object.values(getLocalSessions());
  if (boothId && boothId !== 'all') {
    return all.filter((s) => s.boothId === boothId || s.eventId === boothId);
  }
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getRecentSessions(limitCount = 20): Promise<ExtendedPhotoSession[]> {
  return getBoothSessions('all').then((s) => s.slice(0, limitCount));
}
