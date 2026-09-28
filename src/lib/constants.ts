import { PhotoboothPackage, FrameTemplate, VoucherCode, POSItem } from '@/types/photobooth';

export const STAFF_BYPASS_PIN = '1144';

export const PHOTOBOOTH_PACKAGES: PhotoboothPackage[] = [
  {
    id: 'pkg-standard-strip',
    name: 'Classic Twin Strips',
    description: '2x Physical 2x6 Photo Strips (3 or 4 poses) + Soft files',
    price: 35000,
    formattedPrice: 'Rp 35.000',
    shotsCount: 4,
    physicalPrintsCount: 2,
    includesLivePhotoGif: false,
    includesSoftFiles: true,
    isPopular: true,
  },
  {
    id: 'pkg-4r-polaroid',
    name: '4R Polaroid Vintage',
    description: '1x Large 4R (4x6 inch) High-Gloss Print with 2 or 4 slots',
    price: 40000,
    formattedPrice: 'Rp 40.000',
    shotsCount: 4,
    physicalPrintsCount: 1,
    includesLivePhotoGif: true,
    includesSoftFiles: true,
  },
  {
    id: 'pkg-vip-livephoto',
    name: 'VIP Live Photo + Quad Strips',
    description: '4x Photo Strips + 5s Animated Boomerang GIFs + 30-Day Cloud VIP Access',
    price: 55000,
    formattedPrice: 'Rp 55.000',
    shotsCount: 4,
    physicalPrintsCount: 4,
    includesLivePhotoGif: true,
    includesSoftFiles: true,
  },
];

export const FRAME_TEMPLATES: FrameTemplate[] = [
  // 1. Strip Category (2x6 inches)
  {
    id: 'tpl-strip-3-classic',
    name: 'Classic 3-Shot Strip',
    category: 'strip',
    layout: 'strip-3',
    slotCount: 3,
    backgroundColor: '#FAF5EF',
    textColor: '#18181b',
    accentColor: '#E4D5C7',
    slots: [
      { id: 's1', x: 8, y: 5, width: 84, height: 26, aspectRatio: 4 / 3 },
      { id: 's2', x: 8, y: 34, width: 84, height: 26, aspectRatio: 4 / 3 },
      { id: 's3', x: 8, y: 63, width: 84, height: 26, aspectRatio: 4 / 3 },
    ],
  },
  {
    id: 'tpl-strip-4-neon',
    name: 'Cyberpunk 4-Shot Strip',
    category: 'strip',
    layout: 'strip-4',
    slotCount: 4,
    backgroundColor: '#09090b',
    textColor: '#ec4899',
    accentColor: '#8b5cf6',
    slots: [
      { id: 's1', x: 8, y: 4, width: 84, height: 20, aspectRatio: 4 / 3 },
      { id: 's2', x: 8, y: 26, width: 84, height: 20, aspectRatio: 4 / 3 },
      { id: 's3', x: 8, y: 48, width: 84, height: 20, aspectRatio: 4 / 3 },
      { id: 's4', x: 8, y: 70, width: 84, height: 20, aspectRatio: 4 / 3 },
    ],
  },

  // 2. 4R Category (4x6 inches)
  {
    id: 'tpl-4r-grid-2x2',
    name: '4R Quad Grid (2x2)',
    category: '4r',
    layout: 'grid-2x2',
    slotCount: 4,
    backgroundColor: '#FFFFFF',
    textColor: '#0f172a',
    accentColor: '#cbd5e1',
    slots: [
      { id: 's1', x: 6, y: 6, width: 42, height: 38, aspectRatio: 4 / 3 },
      { id: 's2', x: 52, y: 6, width: 42, height: 38, aspectRatio: 4 / 3 },
      { id: 's3', x: 6, y: 48, width: 42, height: 38, aspectRatio: 4 / 3 },
      { id: 's4', x: 52, y: 48, width: 42, height: 38, aspectRatio: 4 / 3 },
    ],
  },
  {
    id: 'tpl-4r-polaroid-single',
    name: '4R Polaroid Solo',
    category: '4r',
    layout: 'single',
    slotCount: 1,
    backgroundColor: '#FFFFFF',
    textColor: '#18181b',
    accentColor: '#e2e8f0',
    slots: [
      { id: 's1', x: 8, y: 8, width: 84, height: 68, aspectRatio: 4 / 3 },
    ],
  },

  // 3. A4 Category (8x12 inches Collage)
  {
    id: 'tpl-a4-event-poster',
    name: 'A4 Event Showcase Poster',
    category: 'a4',
    layout: 'a4-collage',
    slotCount: 4,
    backgroundColor: '#0F172A',
    textColor: '#F8FAFC',
    accentColor: '#38BDF8',
    slots: [
      { id: 's1', x: 6, y: 6, width: 42, height: 40, aspectRatio: 4 / 3 },
      { id: 's2', x: 52, y: 6, width: 42, height: 40, aspectRatio: 4 / 3 },
      { id: 's3', x: 6, y: 49, width: 42, height: 40, aspectRatio: 4 / 3 },
      { id: 's4', x: 52, y: 49, width: 42, height: 40, aspectRatio: 4 / 3 },
    ],
  },
];

export const INITIAL_VOUCHERS: VoucherCode[] = [
  {
    code: 'VIPFREE',
    type: 'free',
    value: 100,
    description: '100% Free VIP Pass',
    validUntil: '2026-12-31',
    isActive: true,
    usageCount: 12,
  },
  {
    code: 'DISCOUNT20',
    type: 'percentage',
    value: 20,
    description: '20% OFF Any Package',
    validUntil: '2026-12-31',
    isActive: true,
    usageCount: 45,
  },
  {
    code: 'PROMO10K',
    type: 'fixed',
    value: 10000,
    description: 'Potongan Rp 10.000',
    validUntil: '2026-12-31',
    isActive: true,
    usageCount: 88,
  },
];

export const INITIAL_POS_ITEMS: POSItem[] = [
  {
    id: 'pos-keychain-acrylic',
    name: 'Custom Acrylic Photo Keychain',
    category: 'keychain',
    price: 15000,
    stock: 45,
  },
  {
    id: 'pos-magnetic-frame',
    name: 'Magnetic Wooden Photo Frame (2x6)',
    category: 'frame',
    price: 25000,
    stock: 30,
  },
  {
    id: 'pos-protective-sleeve',
    name: 'Holographic Protective Sleeve (Pack of 2)',
    category: 'packaging',
    price: 5000,
    stock: 120,
  },
  {
    id: 'pos-extra-strip-cut',
    name: 'Extra Photo Strip Duplicate',
    category: 'merchandise',
    price: 10000,
    stock: 999,
  },
];
