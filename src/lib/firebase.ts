import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, orderBy, limit, Firestore } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL, FirebaseStorage } from 'firebase/storage';
import { PhotoSession } from '@/types/photobooth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
};

const isConfigured = Boolean(
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
);

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

if (isConfigured) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    db = getFirestore(app);
    storage = getStorage(app);
  } catch (err) {
    console.warn('Firebase initialization skipped or failed:', err);
  }
}

// In-memory & LocalStorage Fallback for offline/development testing
const LOCAL_STORAGE_KEY = 'quickpic_sessions_cache';

function getLocalSessions(): Record<string, PhotoSession> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalSession(session: PhotoSession) {
  if (typeof window === 'undefined') return;
  try {
    const current = getLocalSessions();
    current[session.id] = session;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current));
  } catch (e) {
    console.error('LocalStorage write failed:', e);
  }
}

export async function savePhotoSession(session: PhotoSession): Promise<{ guestUrl: string; id: string }> {
  // Always save local cache first for instant kiosk access
  saveLocalSession(session);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const guestUrl = `${baseUrl}/gallery/${session.id}`;

  if (isConfigured && db && storage) {
    try {
      // 1. Upload composite image to Firebase Storage
      const storageRef = ref(storage, `photos/${session.eventId}/${session.id}.jpg`);
      const uploadResult = await uploadString(storageRef, session.compositeUrl, 'data_url');
      const publicDownloadUrl = await getDownloadURL(uploadResult.ref);

      // 2. Save metadata to Firestore
      const sessionDoc = doc(db, 'photo_sessions', session.id);
      await setDoc(sessionDoc, {
        ...session,
        compositeUrl: publicDownloadUrl,
        guestDownloadUrl: guestUrl,
        updatedAt: Date.now(),
      });

      return { guestUrl, id: session.id };
    } catch (err) {
      console.error('Firebase save failed, falling back to local mode:', err);
    }
  }

  return { guestUrl, id: session.id };
}

export async function getPhotoSession(id: string): Promise<PhotoSession | null> {
  // 1. Check Firestore if available
  if (isConfigured && db) {
    try {
      const docRef = doc(db, 'photo_sessions', id);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return snapshot.data() as PhotoSession;
      }
    } catch (err) {
      console.warn('Firestore fetch failed, checking local storage:', err);
    }
  }

  // 2. Fallback to LocalStorage
  const local = getLocalSessions();
  return local[id] || null;
}

export async function getRecentSessions(limitCount = 20): Promise<PhotoSession[]> {
  if (isConfigured && db) {
    try {
      const q = query(collection(db, 'photo_sessions'), orderBy('createdAt', 'desc'), limit(limitCount));
      const querySnapshot = await getDocs(q);
      const list: PhotoSession[] = [];
      querySnapshot.forEach((doc) => {
        list.push(doc.data() as PhotoSession);
      });
      if (list.length > 0) return list;
    } catch (err) {
      console.warn('Firestore fetch recent failed:', err);
    }
  }

  const local = Object.values(getLocalSessions());
  return local.sort((a, b) => b.createdAt - a.createdAt).slice(0, limitCount);
}

export { isConfigured as isFirebaseConfigured };
