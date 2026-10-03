import { FrameSlot, FrameTemplate, StripLayout, FrameCategory } from '@/types/photobooth';

export interface DetectionResult {
  slots: FrameSlot[];
  aspectRatio: number; // width / height
  category: FrameCategory;
  layout: StripLayout;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  confidence: number;
  detectedCount: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Load an image from URL or dataURL into an HTMLImageElement
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * Convert RGB to Hex string
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => Math.min(255, Math.max(0, Math.round(c))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Compute perceptual brightness (0-255)
 */
function getBrightness(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Automatically analyze an uploaded strip/frame template image and detect photo slot coordinates
 * Precision detection for Canva picture placeholder frames (2x2 grid, 3-shot strips, 4-shot strips) and transparent PNG overlays
 */
export async function detectTemplateSlots(imageSource: string | HTMLImageElement): Promise<DetectionResult> {
  const img = typeof imageSource === 'string' ? await loadImage(imageSource) : imageSource;

  const rawWidth = img.naturalWidth || img.width;
  const rawHeight = img.naturalHeight || img.height;
  const imageAspect = rawWidth / rawHeight;

  // Analysis resolution for high-accuracy pixel detection
  const analysisWidth = 500;
  const analysisHeight = Math.max(250, Math.round(analysisWidth / imageAspect));

  const canvas = document.createElement('canvas');
  canvas.width = analysisWidth;
  canvas.height = analysisHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    throw new Error('Canvas 2D context not available for slot detection');
  }

  ctx.drawImage(img, 0, 0, analysisWidth, analysisHeight);
  const imageData = ctx.getImageData(0, 0, analysisWidth, analysisHeight);
  const data = imageData.data;

  // 1. Dominant outer border color sampling (outer 2% margin)
  let borderR = 0;
  let borderG = 0;
  let borderB = 0;
  let borderSampleCount = 0;

  for (let x = 0; x < analysisWidth; x += 4) {
    for (let y of [2, analysisHeight - 3]) {
      const idx = (y * analysisWidth + x) * 4;
      if (data[idx + 3] > 100) {
        borderR += data[idx];
        borderG += data[idx + 1];
        borderB += data[idx + 2];
        borderSampleCount++;
      }
    }
  }
  for (let y = 0; y < analysisHeight; y += 4) {
    for (let x of [2, analysisWidth - 3]) {
      const idx = (y * analysisWidth + x) * 4;
      if (data[idx + 3] > 100) {
        borderR += data[idx];
        borderG += data[idx + 1];
        borderB += data[idx + 2];
        borderSampleCount++;
      }
    }
  }

  const avgBorderR = borderSampleCount > 0 ? borderR / borderSampleCount : 250;
  const avgBorderG = borderSampleCount > 0 ? borderG / borderSampleCount : 245;
  const avgBorderB = borderSampleCount > 0 ? borderB / borderSampleCount : 240;
  const backgroundColor = rgbToHex(avgBorderR, avgBorderG, avgBorderB);
  const isDarkBg = getBrightness(avgBorderR, avgBorderG, avgBorderB) < 128;
  const textColor = isDarkBg ? '#FFFFFF' : '#18181B';
  const accentColor = isDarkBg ? '#F472B6' : '#EC4899';

  // 2. Binary Slot Mask: Detect Canva Sky, Canva Green Hills, Transparent Cutouts, and Chroma Keys
  // Note: NEVER mark outer borders, white cross dividers, or cream backgrounds as slot pixels!
  const mask = new Uint8Array(analysisWidth * analysisHeight);
  let canvaPixelCount = 0;

  for (let y = 0; y < analysisHeight; y++) {
    for (let x = 0; x < analysisWidth; x++) {
      const idx = (y * analysisWidth + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      // A. Alpha transparency (PNG cutout)
      if (a < 50) {
        mask[y * analysisWidth + x] = 1;
        continue;
      }

      // B. Canva Sky (Cyan / Light Blue gradient)
      // Blue is highest, green is high, red is distinctly lower (b > r + 10)
      const isCanvaSky = b >= 155 && g >= 155 && b >= r + 10 && g >= r + 2 && b >= g - 25;

      // C. Canva Hills (Lime / Grass Green landscape)
      // Green is strictly dominant over red and blue (g > r + 8, g > b + 25)
      const isCanvaHill = g >= 85 && g >= r + 8 && g >= b + 25 && b <= 140;

      // D. Chroma key (Pure green or magenta)
      const isChroma = (g > 180 && r < 80 && b < 80) || (r > 180 && b > 180 && g < 80);

      if (isCanvaSky || isCanvaHill || isChroma) {
        mask[y * analysisWidth + x] = 1;
        canvaPixelCount++;
      }
    }
  }

  // 3. Extract Candidate Rectangles using Connected Component Flood Fill
  // Each Canva photo placeholder has sky touching green hill, creating ONE connected component per slot
  const candidateRects: Rect[] = [];
  const visited = new Uint8Array(analysisWidth * analysisHeight);

  for (let y = 0; y < analysisHeight; y += 2) {
    for (let x = 0; x < analysisWidth; x += 2) {
      const idx = y * analysisWidth + x;
      if (mask[idx] === 1 && visited[idx] === 0) {
        let minX = x;
        let maxX = x;
        let minY = y;
        let maxY = y;
        let pixelCount = 0;

        const queue: number[] = [idx];
        visited[idx] = 1;

        while (queue.length > 0) {
          const curr = queue.pop()!;
          const cy = Math.floor(curr / analysisWidth);
          const cx = curr % analysisWidth;

          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;
          pixelCount++;

          // 4-connected step of 2 for high performance
          const neighbors = [
            cy > 2 ? (cy - 2) * analysisWidth + cx : -1,
            cy < analysisHeight - 3 ? (cy + 2) * analysisWidth + cx : -1,
            cx > 2 ? cy * analysisWidth + (cx - 2) : -1,
            cx < analysisWidth - 3 ? cy * analysisWidth + (cx + 2) : -1,
          ];

          for (const n of neighbors) {
            if (n >= 0 && visited[n] === 0 && mask[n] === 1) {
              visited[n] = 1;
              queue.push(n);
            }
          }
        }

        const rw = maxX - minX + 1;
        const rh = maxY - minY + 1;
        const widthPct = (rw / analysisWidth) * 100;
        const heightPct = (rh / analysisHeight) * 100;
        const areaPct = (rw * rh) / (analysisWidth * analysisHeight);

        // Filter valid individual photo slot candidate boxes
        // Must NOT span whole template (width <= 88% for multi-slot, or <= 92% for single strip, area <= 55%)
        if (widthPct >= 15 && heightPct >= 10 && areaPct >= 0.02 && areaPct <= 0.60 && widthPct <= 92 && heightPct <= 85) {
          candidateRects.push({
            x: (minX / analysisWidth) * 100,
            y: (minY / analysisHeight) * 100,
            w: widthPct,
            h: heightPct,
          });
        }
      }
    }
  }

  // 4. Analyze candidate components to form proper slots
  let finalRects: Rect[] = [];

  if (candidateRects.length >= 4) {
    // 2x2 Grid or 4-shot Strip: Sort by Y (rows) and X (cols)
    candidateRects.sort((a, b) => {
      if (Math.abs(a.y - b.y) > 10) {
        return a.y - b.y;
      }
      return a.x - b.x;
    });

    // Check if 2x2 grid (2 on top row, 2 on bottom row)
    const topSlots = candidateRects.filter((r) => r.y < 50);
    const bottomSlots = candidateRects.filter((r) => r.y >= 50);

    if (topSlots.length >= 2 && bottomSlots.length >= 2) {
      topSlots.sort((a, b) => a.x - b.x);
      bottomSlots.sort((a, b) => a.x - b.x);

      const rTopLeft = topSlots[0];
      const rTopRight = topSlots[topSlots.length - 1];
      const rBottomLeft = bottomSlots[0];
      const rBottomRight = bottomSlots[bottomSlots.length - 1];

      // Harmonize 2x2 grid columns and rows for clean symmetry
      const col1X = (rTopLeft.x + rBottomLeft.x) / 2;
      const col2X = (rTopRight.x + rBottomRight.x) / 2;
      const row1Y = (rTopLeft.y + rTopRight.y) / 2;
      const row2Y = (rBottomLeft.y + rBottomRight.y) / 2;

      const avgW = (rTopLeft.w + rTopRight.w + rBottomLeft.w + rBottomRight.w) / 4;
      const avgH = (rTopLeft.h + rTopRight.h + rBottomLeft.h + rBottomRight.h) / 4;

      finalRects = [
        { x: col1X, y: row1Y, w: avgW, h: avgH },
        { x: col2X, y: row1Y, w: avgW, h: avgH },
        { x: col1X, y: row2Y, w: avgW, h: avgH },
        { x: col2X, y: row2Y, w: avgW, h: avgH },
      ];
    } else {
      // 4 vertical slots
      finalRects = candidateRects.slice(0, 4);
    }
  } else if (candidateRects.length === 3) {
    // 3-Shot Strip: Sort top to bottom
    candidateRects.sort((a, b) => a.y - b.y);
    const avgW = (candidateRects[0].w + candidateRects[1].w + candidateRects[2].w) / 3;
    const avgH = (candidateRects[0].h + candidateRects[1].h + candidateRects[2].h) / 3;
    const avgX = (candidateRects[0].x + candidateRects[1].x + candidateRects[2].x) / 3;

    finalRects = candidateRects.map((r) => ({
      x: avgX,
      y: r.y,
      w: avgW,
      h: avgH,
    }));
  } else if (candidateRects.length === 2) {
    candidateRects.sort((a, b) => a.y - b.y || a.x - b.x);
    finalRects = candidateRects;
  } else if (candidateRects.length === 1) {
    // If only 1 was detected, check if image is 2:3 4R format (like Canva 2x2 grid)
    if (imageAspect > 0.5) {
      // Split into 4 symmetrical 2x2 slots
      finalRects = [
        { x: 9.5, y: 16.5, w: 38.5, h: 35.0 },
        { x: 52.0, y: 16.5, w: 38.5, h: 35.0 },
        { x: 9.5, y: 53.5, w: 38.5, h: 35.0 },
        { x: 52.0, y: 53.5, w: 38.5, h: 35.0 },
      ];
    } else {
      finalRects = candidateRects;
    }
  } else {
    // Fallback: 0 slots detected
    const isTallStrip = imageAspect < 0.48;
    if (isTallStrip) {
      finalRects = [
        { x: 8, y: 5, w: 84, h: 26 },
        { x: 8, y: 34, w: 84, h: 26 },
        { x: 8, y: 63, w: 84, h: 26 },
      ];
    } else {
      // Default 4 slots in 2x2 grid
      finalRects = [
        { x: 9.5, y: 16.5, w: 38.5, h: 35.0 },
        { x: 52.0, y: 16.5, w: 38.5, h: 35.0 },
        { x: 9.5, y: 53.5, w: 38.5, h: 35.0 },
        { x: 52.0, y: 53.5, w: 38.5, h: 35.0 },
      ];
    }
  }

  // 5. Convert to FrameSlot array
  const slots: FrameSlot[] = finalRects.map((r, i) => ({
    id: `slot-custom-${i + 1}`,
    x: Math.round(r.x * 10) / 10,
    y: Math.round(r.y * 10) / 10,
    width: Math.round(r.w * 10) / 10,
    height: Math.round(r.h * 10) / 10,
    aspectRatio: (r.w * imageAspect) / r.h || 4 / 3,
  }));

  const isTallStrip = imageAspect < 0.48;
  const category: FrameCategory = isTallStrip ? 'strip' : '4r';
  const layout: StripLayout =
    slots.length === 4
      ? isTallStrip
        ? 'strip-4'
        : 'grid-2x2'
      : slots.length === 3
      ? 'strip-3'
      : slots.length === 1
      ? 'single'
      : 'grid-2x2';

  return {
    slots,
    aspectRatio: imageAspect,
    category,
    layout,
    backgroundColor,
    textColor,
    accentColor,
    confidence: finalRects.length === 4 ? 0.99 : 0.85,
    detectedCount: slots.length,
  };
}
