import { StripLayout, PhotoFilter, FrameTheme, BoothSettings, FrameTemplate, SlotAdjustment } from '@/types/photobooth';

export const FRAME_THEMES: FrameTheme[] = [
  {
    id: 'classic-white',
    name: 'Classic White',
    backgroundColor: '#FFFFFF',
    textColor: '#1A1A1A',
    accentColor: '#E5E7EB',
    borderWidth: 24,
  },
  {
    id: 'midnight-black',
    name: 'Midnight Black',
    backgroundColor: '#0F172A',
    textColor: '#F8FAFC',
    accentColor: '#334155',
    borderWidth: 24,
  },
  {
    id: 'retro-cream',
    name: 'Retro Cream',
    backgroundColor: '#FAF5EF',
    textColor: '#451A03',
    accentColor: '#FDE68A',
    borderWidth: 24,
  },
  {
    id: 'cyber-neon',
    name: 'Cyber Neon',
    backgroundColor: '#0D0914',
    textColor: '#F43F5E',
    accentColor: '#A855F7',
    borderWidth: 28,
  },
  {
    id: 'pastel-pink',
    name: 'Pastel Blush',
    backgroundColor: '#FFF1F2',
    textColor: '#881337',
    accentColor: '#FDA4AF',
    borderWidth: 24,
  },
];

export function applyFilterToCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  filter: PhotoFilter
) {
  if (filter === 'none') return;

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    switch (filter) {
      case 'bw': {
        const avg = 0.299 * r + 0.587 * g + 0.114 * b;
        // High contrast B&W
        const contrast = 1.2;
        const adjusted = (avg - 128) * contrast + 128;
        const clamped = Math.min(255, Math.max(0, adjusted));
        data[i] = clamped;
        data[i + 1] = clamped;
        data[i + 2] = clamped;
        break;
      }
      case 'sepia': {
        data[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
        data[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
        data[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
        break;
      }
      case 'warm': {
        data[i] = Math.min(255, r * 1.15 + 10);
        data[i + 1] = Math.min(255, g * 1.05);
        data[i + 2] = Math.max(0, b * 0.9 - 10);
        break;
      }
      case 'cold': {
        data[i] = Math.max(0, r * 0.9 - 10);
        data[i + 1] = Math.min(255, g * 1.05);
        data[i + 2] = Math.min(255, b * 1.2 + 15);
        break;
      }
      case 'vintage': {
        // Film vintage wash
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        data[i] = Math.min(255, gray * 0.9 + 40);
        data[i + 1] = Math.min(255, gray * 0.8 + 20);
        data[i + 2] = Math.min(255, gray * 0.7 + 10);
        break;
      }
      case 'cyberpunk': {
        // Boost cyan & magenta
        data[i] = Math.min(255, r * 1.3 + 20);
        data[i + 1] = Math.max(0, g * 0.8);
        data[i + 2] = Math.min(255, b * 1.4 + 30);
        break;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    if (!src) {
      const canvas = document.createElement('canvas');
      canvas.width = 900;
      canvas.height = 675;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#18181b';
        ctx.fillRect(0, 0, 900, 675);
      }
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = canvas.toDataURL();
      return;
    }

    const img = new Image();
    if (!src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => {
      // Graceful fallback image rather than rejecting/hanging
      const canvas = document.createElement('canvas');
      canvas.width = 900;
      canvas.height = 675;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#18181b';
        ctx.fillRect(0, 0, 900, 675);
      }
      const fallback = new Image();
      fallback.onload = () => resolve(fallback);
      fallback.src = canvas.toDataURL();
    };
    img.src = src;
  });
}

export async function renderPhotoComposite(
  photoUrls: string[],
  settings: BoothSettings,
  theme: FrameTheme = FRAME_THEMES[0]
): Promise<string> {
  const images = await Promise.all(photoUrls.map(loadImage));
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not supported');

  const { layout, selectedFilter, eventName, eventDate, eventHashtag } = settings;

  // Standard high-res target photo tile dimensions
  const photoW = 900;
  const photoH = 675; // 4:3 ratio standard photo
  const padding = theme.borderWidth || 30;
  const footerHeight = 220;
  const headerHeight = 60;

  if (layout === 'strip-3' || layout === 'strip-4') {
    const count = layout === 'strip-3' ? 3 : 4;
    const activeImages = images.slice(0, count);

    canvas.width = photoW + padding * 2;
    canvas.height = headerHeight + activeImages.length * photoH + (activeImages.length - 1) * padding + padding + footerHeight;

    // Background
    ctx.fillStyle = theme.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle inner border / accent
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    // Draw Photos
    activeImages.forEach((img, idx) => {
      const y = headerHeight + idx * (photoH + padding);

      // Create offscreen canvas for filter processing
      const tileCanvas = document.createElement('canvas');
      tileCanvas.width = photoW;
      tileCanvas.height = photoH;
      const tileCtx = tileCanvas.getContext('2d');
      if (tileCtx) {
        tileCtx.drawImage(img, 0, 0, photoW, photoH);
        applyFilterToCanvas(tileCtx, photoW, photoH, selectedFilter);
        ctx.drawImage(tileCanvas, padding, y, photoW, photoH);

        // Photo border
        ctx.strokeStyle = theme.accentColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(padding, y, photoW, photoH);
      }
    });

    // Draw Footer Event Branding
    const footerY = canvas.height - footerHeight + 40;
    ctx.fillStyle = theme.textColor;
    ctx.textAlign = 'center';

    // Event Title
    ctx.font = 'bold 38px sans-serif';
    ctx.fillText(eventName.toUpperCase(), canvas.width / 2, footerY + 20);

    // Date & Hashtag
    ctx.font = '22px sans-serif';
    ctx.fillStyle = theme.textColor;
    ctx.globalAlpha = 0.8;
    const subText = [eventDate, eventHashtag].filter(Boolean).join('  •  ');
    ctx.fillText(subText, canvas.width / 2, footerY + 65);
    ctx.globalAlpha = 1.0;

    // QuickPic Photobooth watermark
    ctx.font = 'italic 16px sans-serif';
    ctx.globalAlpha = 0.45;
    ctx.fillText('⚡ QUICKPIC PHOTOBOOTH', canvas.width / 2, footerY + 110);
    ctx.globalAlpha = 1.0;

  } else if (layout === 'grid-2x2') {
    const activeImages = images.slice(0, 4);

    canvas.width = photoW * 2 + padding * 3;
    canvas.height = headerHeight + photoH * 2 + padding * 2 + footerHeight;

    // Background
    ctx.fillStyle = theme.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    activeImages.forEach((img, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = padding + col * (photoW + padding);
      const y = headerHeight + row * (photoH + padding);

      const tileCanvas = document.createElement('canvas');
      tileCanvas.width = photoW;
      tileCanvas.height = photoH;
      const tileCtx = tileCanvas.getContext('2d');
      if (tileCtx) {
        tileCtx.drawImage(img, 0, 0, photoW, photoH);
        applyFilterToCanvas(tileCtx, photoW, photoH, selectedFilter);
        ctx.drawImage(tileCanvas, x, y, photoW, photoH);

        ctx.strokeStyle = theme.accentColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, photoW, photoH);
      }
    });

    // Footer
    const footerY = canvas.height - footerHeight + 50;
    ctx.fillStyle = theme.textColor;
    ctx.textAlign = 'center';

    ctx.font = 'bold 46px sans-serif';
    ctx.fillText(eventName.toUpperCase(), canvas.width / 2, footerY + 25);

    ctx.font = '26px sans-serif';
    ctx.globalAlpha = 0.8;
    const subText = [eventDate, eventHashtag].filter(Boolean).join('  •  ');
    ctx.fillText(subText, canvas.width / 2, footerY + 75);
    ctx.globalAlpha = 1.0;

  } else {
    // Single Photo layout
    const img = images[0];
    canvas.width = photoW + padding * 2;
    canvas.height = headerHeight + photoH + padding + footerHeight;

    ctx.fillStyle = theme.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (img) {
      const tileCanvas = document.createElement('canvas');
      tileCanvas.width = photoW;
      tileCanvas.height = photoH;
      const tileCtx = tileCanvas.getContext('2d');
      if (tileCtx) {
        tileCtx.drawImage(img, 0, 0, photoW, photoH);
        applyFilterToCanvas(tileCtx, photoW, photoH, selectedFilter);
        ctx.drawImage(tileCanvas, padding, headerHeight, photoW, photoH);
      }
    }

    const footerY = canvas.height - footerHeight + 40;
    ctx.fillStyle = theme.textColor;
    ctx.textAlign = 'center';

    ctx.font = 'bold 38px sans-serif';
    ctx.fillText(eventName.toUpperCase(), canvas.width / 2, footerY + 20);

    ctx.font = '22px sans-serif';
    ctx.globalAlpha = 0.8;
    const subText = [eventDate, eventHashtag].filter(Boolean).join('  •  ');
    ctx.fillText(subText, canvas.width / 2, footerY + 65);
    ctx.globalAlpha = 1.0;
  }

  return canvas.toDataURL('image/jpeg', 0.92);
}

export async function renderCustomFrameSlotComposite(
  photoUrls: string[],
  template: FrameTemplate,
  slotAdjustments: Record<string, SlotAdjustment>,
  eventName = 'QUICKPIC PHOTOBOOTH',
  eventDate = 'SEP 2026'
): Promise<string> {
  const images = await Promise.all(photoUrls.map(loadImage));
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not supported');

  // Set high-res print canvas dimensions based on template category
  if (template.category === 'strip') {
    canvas.width = 1200;
    canvas.height = 3600; // Standard 2x6 inch @ 600 DPI
  } else if (template.category === '4r') {
    canvas.width = 2400;
    canvas.height = 3600; // Standard 4x6 inch @ 600 DPI
  } else {
    canvas.width = 2480;
    canvas.height = 3508; // Standard A4 @ 300 DPI
  }

  // Draw frame background
  ctx.fillStyle = template.backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle border accent
  ctx.strokeStyle = template.accentColor;
  ctx.lineWidth = 12;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  // Render each slot with its zoom, pan, and filter adjustments
  for (let i = 0; i < template.slots.length; i++) {
    const slot = template.slots[i];
    const adj = slotAdjustments[slot.id] || {
      slotId: slot.id,
      photoIndex: i % images.length,
      zoom: 1.0,
      panX: 0,
      panY: 0,
      filter: 'none',
    };

    const img = images[adj.photoIndex] || images[0];
    if (!img) continue;

    const slotPixelX = (slot.x / 100) * canvas.width;
    const slotPixelY = (slot.y / 100) * canvas.height;
    const slotPixelW = (slot.width / 100) * canvas.width;
    const slotPixelH = (slot.height / 100) * canvas.height;

    // Create offscreen slot canvas
    const slotCanvas = document.createElement('canvas');
    slotCanvas.width = slotPixelW;
    slotCanvas.height = slotPixelH;
    const slotCtx = slotCanvas.getContext('2d');

    if (slotCtx) {
      slotCtx.save();
      // Apply zoom & pan translation from center
      const centerX = slotPixelW / 2;
      const centerY = slotPixelH / 2;
      slotCtx.translate(centerX + adj.panX * 2, centerY + adj.panY * 2);
      slotCtx.scale(adj.zoom, adj.zoom);
      slotCtx.drawImage(img, -centerX, -centerY, slotPixelW, slotPixelH);
      slotCtx.restore();

      // Apply per-slot filter
      applyFilterToCanvas(slotCtx, slotPixelW, slotPixelH, adj.filter);

      // Draw slot onto master canvas
      ctx.drawImage(slotCanvas, slotPixelX, slotPixelY);

      // Slot border
      ctx.strokeStyle = template.accentColor;
      ctx.lineWidth = 6;
      ctx.strokeRect(slotPixelX, slotPixelY, slotPixelW, slotPixelH);
    }
  }

  // Draw branding footer
  const footerY = canvas.height - 180;
  ctx.fillStyle = template.textColor;
  ctx.textAlign = 'center';

  ctx.font = 'bold 54px sans-serif';
  ctx.fillText(eventName.toUpperCase(), canvas.width / 2, footerY);

  ctx.font = '36px sans-serif';
  ctx.globalAlpha = 0.75;
  ctx.fillText(eventDate, canvas.width / 2, footerY + 60);
  ctx.globalAlpha = 1.0;

  return canvas.toDataURL('image/jpeg', 0.95);
}
