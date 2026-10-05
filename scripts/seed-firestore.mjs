import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCdh5bO7_CMeNnsIxTlo7FwLcawwLkbTmc",
  authDomain: "quickpic-booth.firebaseapp.com",
  projectId: "quickpic-booth",
  storageBucket: "quickpic-booth.firebasestorage.app",
  messagingSenderId: "261142064252",
  appId: "1:261142064252:web:fa3d5f3269a64457476df9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seed() {
  console.log('Seeding initial Firestore collections for quickpic-booth...');

  const userId = 'usr-demo-01';

  // 1. Create User Document in /users/usr-demo-01
  console.log('1. Creating User Profile in users/usr-demo-01...');
  await setDoc(doc(db, 'users', userId), {
    uid: userId,
    email: 'operator@quickpic.io',
    displayName: 'Alex Pratama (Operator)',
    role: 'operator',
    createdAt: Date.now(),
    lastLoginAt: Date.now()
  });

  // 2. Create Outlets subcollection: /users/usr-demo-01/outlets/{outletId}
  console.log('2. Creating Outlets in users/usr-demo-01/outlets/...');
  const outlets = [
    {
      id: 'outlet-gi-01',
      userId,
      name: 'Grand Indonesia - Flagship',
      location: 'West Mall Level 3, Jakarta Pusat',
      code: 'GI-01',
      createdAt: Date.now()
    },
    {
      id: 'outlet-pim-02',
      userId,
      name: 'Pondok Indah Mall 2 - Atrium',
      location: 'North Skywalk 2nd Floor, Jakarta Selatan',
      code: 'PIM-02',
      createdAt: Date.now()
    },
    {
      id: 'outlet-sc-03',
      userId,
      name: 'Senayan City - Basement Zone',
      location: 'LG Floor Promenade, Jakarta Pusat',
      code: 'SC-03',
      createdAt: Date.now()
    }
  ];

  for (const outlet of outlets) {
    await setDoc(doc(db, 'users', userId, 'outlets', outlet.id), outlet);
    console.log(`   - Created outlet: ${outlet.name} (${outlet.id})`);
  }

  // 3. Create Events subcollection: /users/usr-demo-01/outlets/{outletId}/events/{eventId}
  console.log('3. Creating Events under outlets...');
  const events = [
    {
      id: 'ev-1',
      outletId: 'outlet-gi-01',
      userId,
      name: 'Summer Gala 2026',
      date: 'OCT 2026',
      hashtag: '#QuickPicSummer',
      stripFooterText: '⚡ SUMMER GALA 2026',
      operatingMode: 'event',
      welcomeTheme: 'neon_cyber',
      createdAt: Date.now()
    },
    {
      id: 'ev-2',
      outletId: 'outlet-gi-01',
      userId,
      name: 'Wedding Maya & Alex',
      date: '12.10.2026',
      hashtag: '#MayaAlexWedding',
      stripFooterText: '💍 MAYA & ALEX 2026',
      operatingMode: 'event',
      welcomeTheme: 'pastel_romance',
      createdAt: Date.now()
    },
    {
      id: 'ev-3',
      outletId: 'outlet-pim-02',
      userId,
      name: 'Tech Summit 2026',
      date: 'NOV 2026',
      hashtag: '#TechSummit26',
      stripFooterText: '🚀 TECH SUMMIT 2026',
      operatingMode: 'regular',
      welcomeTheme: 'clean_studio',
      createdAt: Date.now()
    },
    {
      id: 'ev-4',
      outletId: 'outlet-sc-03',
      userId,
      name: 'VIP Birthday Bash',
      date: '2026',
      hashtag: '#VIPBirthday',
      stripFooterText: '🎉 HAPPY BIRTHDAY VIP',
      operatingMode: 'event',
      welcomeTheme: 'luxury_gold',
      createdAt: Date.now()
    }
  ];

  for (const ev of events) {
    await setDoc(doc(db, 'users', userId, 'outlets', ev.outletId, 'events', ev.id), ev);
    console.log(`   - Created event: ${ev.name} in ${ev.outletId}`);
  }

  // 4. Create Photo Sessions collection: /photo_sessions/{sessionId}
  console.log('4. Creating sample session in photo_sessions/...');
  await setDoc(doc(db, 'photo_sessions', 'sample-session-001'), {
    id: 'sample-session-001',
    createdAt: Date.now(),
    eventId: 'ev-1',
    outletId: 'outlet-gi-01',
    boothId: 'booth-jkt-01',
    packageId: 'strip-3',
    rawPhotos: ['https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'],
    compositeUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    layout: 'strip-3',
    filter: 'none',
    themeId: 'classic-white',
    selectedTemplateId: 'strip-classic',
    payment: {
      method: 'cash_bypass',
      amount: 0,
      transactionId: 'TX_SAMPLE',
      status: 'settled'
    },
    consent: { granted: true, timestamp: Date.now() },
    guestDownloadUrl: 'https://quickpic-olive.vercel.app/gallery/sample-session-001',
    printStatus: 'printed',
    expiresAt: Date.now() + 30 * 86400000
  });

  // 5. Create Telemetry collection: /telemetry/booth-jkt-01
  console.log('5. Creating sample telemetry in telemetry/booth-jkt-01...');
  await setDoc(doc(db, 'telemetry', 'booth-jkt-01'), {
    boothId: 'booth-jkt-01',
    outletId: 'outlet-gi-01',
    lastPingTime: Date.now(),
    isOnline: true,
    cpuPct: 18.5,
    ramPct: 42.1,
    camera: {
      connected: true,
      model: 'Canon EOS R100'
    },
    printer: {
      connected: true,
      name: 'DNP DS-RX1HS',
      ribbonRemaining: 558,
      ribbonPercentage: 79.7,
      queueDepth: 0
    }
  });

  console.log('\n✅ All Firestore collections and documents successfully seeded!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
