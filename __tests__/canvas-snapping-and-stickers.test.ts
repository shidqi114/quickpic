import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ============================================================================
// Types & Domain Models for Canvas Snapping and Stickers
// ============================================================================

export interface SlotBox {
  id: string;
  x: number;      // percentage (0 - 100)
  y: number;      // percentage (0 - 100)
  width: number;  // percentage (0 - 100)
  height: number; // percentage (0 - 100)
}

export interface Guideline {
  type: 'h' | 'v';
  positionPct: number;
  label?: string;
}

export interface SnapCalculationResult {
  x: number;
  y: number;
  guidelines: Guideline[];
}

export interface StickerTransform {
  id: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  zIndex: number;
}

// ============================================================================
// 1. Canvas Snapping Calculation Engine
// ============================================================================

/**
 * Calculates snapped slot coordinates and active alignment guidelines
 * based on adjacent slots, center lines, margins, and paper boundary clamping.
 *
 * @param targetSlot - The slot being moved (targetX, targetY before snap)
 * @param otherSlots - Array of existing slots on the canvas
 * @param canvasDimensions - Canvas pixel width and height for threshold conversion
 * @param thresholdPx - Snap threshold in pixels (default: 10px)
 */
export function calculateSlotSnap(
  targetSlot: { id: string; x: number; y: number; width: number; height: number },
  otherSlots: SlotBox[],
  canvasDimensions: { width: number; height: number } = { width: 400, height: 600 },
  thresholdPx: number = 10
): SnapCalculationResult {
  const { width: canvasWidth, height: canvasHeight } = canvasDimensions;
  const snapThresholdX = (thresholdPx / canvasWidth) * 100;
  const snapThresholdY = (thresholdPx / canvasHeight) * 100;

  let targetX = targetSlot.x;
  let targetY = targetSlot.y;
  const width = targetSlot.width;
  const height = targetSlot.height;
  const guidelines: Guideline[] = [];

  // 1. Horizontal Center Snapping (Slot Center X === 50%)
  const slotCenterX = targetX + width / 2;
  if (Math.abs(slotCenterX - 50) < snapThresholdX) {
    targetX = 50 - width / 2;
    guidelines.push({ type: 'v', positionPct: 50, label: 'Center 50%' });
  }

  // 2. Vertical Center Snapping (Slot Center Y === 50%)
  const slotCenterY = targetY + height / 2;
  if (Math.abs(slotCenterY - 50) < snapThresholdY) {
    targetY = 50 - height / 2;
    guidelines.push({ type: 'h', positionPct: 50, label: 'Center 50%' });
  }

  // 3. Canvas Margins Snapping (Left 10%, Right 90%, Top 10%, Bottom 90%)
  if (Math.abs(targetX - 10) < snapThresholdX) {
    targetX = 10;
    guidelines.push({ type: 'v', positionPct: 10, label: 'Left Margin' });
  }
  if (Math.abs(targetX + width - 90) < snapThresholdX) {
    targetX = 90 - width;
    guidelines.push({ type: 'v', positionPct: 90, label: 'Right Margin' });
  }
  if (Math.abs(targetY - 10) < snapThresholdY) {
    targetY = 10;
    guidelines.push({ type: 'h', positionPct: 10, label: 'Top Margin' });
  }
  if (Math.abs(targetY + height - 90) < snapThresholdY) {
    targetY = 90 - height;
    guidelines.push({ type: 'h', positionPct: 90, label: 'Bottom Margin' });
  }

  // 4. Snapping to Adjacent Slots (Left, Right, Top, Bottom, Stack Gap)
  const neighbors = otherSlots.filter((s) => s.id !== targetSlot.id);
  for (const other of neighbors) {
    // Snap Left to other.Left
    if (Math.abs(targetX - other.x) < snapThresholdX) {
      targetX = other.x;
      guidelines.push({ type: 'v', positionPct: other.x, label: 'Align Left' });
    }
    // Snap Right to other.Right
    if (Math.abs(targetX + width - (other.x + other.width)) < snapThresholdX) {
      targetX = other.x + other.width - width;
      guidelines.push({ type: 'v', positionPct: other.x + other.width, label: 'Align Right' });
    }
    // Snap Top to other.Top
    if (Math.abs(targetY - other.y) < snapThresholdY) {
      targetY = other.y;
      guidelines.push({ type: 'h', positionPct: other.y, label: 'Align Top' });
    }
    // Snap Bottom to other.Bottom
    if (Math.abs(targetY + height - (other.y + other.height)) < snapThresholdY) {
      targetY = other.y + other.height - height;
      guidelines.push({ type: 'h', positionPct: other.y + other.height, label: 'Align Bottom' });
    }
    // Snap Top to other.Bottom + 4% gap (Adjacent Vertical Stack)
    if (Math.abs(targetY - (other.y + other.height + 4)) < snapThresholdY) {
      targetY = other.y + other.height + 4;
      guidelines.push({ type: 'h', positionPct: other.y + other.height, label: 'Adjacent Stack' });
    }
  }

  // 5. Paper Boundaries Clamping (0% to 100% - width/height)
  const clampedX = Math.max(0, Math.min(100 - width, targetX));
  const clampedY = Math.max(0, Math.min(100 - height, targetY));

  return {
    x: Number(clampedX.toFixed(2)),
    y: Number(clampedY.toFixed(2)),
    guidelines,
  };
}

// ============================================================================
// 2. Sticker Transformation Geometry Engine
// ============================================================================

export const STICKER_SCALE_BOUNDS = {
  MIN: 0.2,
  MAX: 3.0,
};

/**
 * Calculates translated sticker coordinates clamped to canvas boundaries (0 - 100%).
 */
export function calculateStickerTranslation(
  initialX: number,
  initialY: number,
  deltaXPct: number,
  deltaYPct: number
): { x: number; y: number } {
  const x = Math.max(0, Math.min(100, initialX + deltaXPct));
  const y = Math.max(0, Math.min(100, initialY + deltaYPct));
  return {
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
  };
}

/**
 * Normalizes rotation degrees to the strictly clamped 0 to 360 degree circular range [0, 360).
 */
export function normalizeRotationAngle(degrees: number): number {
  let normalized = Math.round(degrees) % 360;
  if (normalized < 0) {
    normalized += 360;
  }
  return (normalized === 360 || normalized === 0) ? 0 : (normalized + 0);
}

/**
 * Calculates rotation from pointer drag coordinates relative to sticker center.
 */
export function calculateStickerRotation(
  initialRotation: number,
  initialPointerAngleDeg: number,
  centerX: number,
  centerY: number,
  pointerX: number,
  pointerY: number
): number {
  const currentRad = Math.atan2(pointerY - centerY, pointerX - centerX);
  const currentDeg = (currentRad * 180) / Math.PI;
  const angleDiff = currentDeg - initialPointerAngleDeg;
  return normalizeRotationAngle(initialRotation + angleDiff);
}

/**
 * Clamps scale factor within predefined bounds (0.2 to 3.0).
 */
export function clampScaleFactor(
  scale: number,
  min: number = STICKER_SCALE_BOUNDS.MIN,
  max: number = STICKER_SCALE_BOUNDS.MAX
): number {
  const clamped = Math.max(min, Math.min(max, scale));
  return Number(clamped.toFixed(2));
}

/**
 * Calculates sticker scale adjustment based on pointer drag delta.
 */
export function calculateStickerScale(
  initialScale: number,
  deltaPointerX: number,
  deltaPointerY: number,
  sensitivity: number = 120,
  min: number = STICKER_SCALE_BOUNDS.MIN,
  max: number = STICKER_SCALE_BOUNDS.MAX
): number {
  const delta = deltaPointerX - deltaPointerY; // Dragging right/up increases scale
  const scaleDelta = delta / sensitivity;
  return clampScaleFactor(initialScale + scaleDelta, min, max);
}

/**
 * Duplicates a sticker with spatial offset, rotated offset, and incremented zIndex.
 */
export function duplicateStickerTransform(
  target: StickerTransform,
  existingStickers: StickerTransform[]
): StickerTransform {
  const maxZ = existingStickers.length > 0 ? Math.max(...existingStickers.map((s) => s.zIndex)) : 0;
  return {
    id: `sticker_${Date.now()}_dup`,
    x: Number(Math.min(90, target.x + 5).toFixed(2)),
    y: Number(Math.min(90, target.y + 5).toFixed(2)),
    scale: target.scale,
    rotation: normalizeRotationAngle(target.rotation + 15),
    zIndex: maxZ + 1,
  };
}

// ============================================================================
// 3. Public Cloudinary QR Resolution Engine
// ============================================================================

export const DEFAULT_PUBLIC_GALLERY_FALLBACK = 'https://quickpic-olive.vercel.app';

export interface ResolveGalleryUrlOptions {
  origin?: string;
  appUrl?: string;
  publicGalleryUrl?: string;
  forceHttps?: boolean;
}

/**
 * Resolves a universally reachable, public QR code URL for mobile phones scanning the screen.
 * Replaces Electron/Kiosk 'localhost', '127.0.0.1', or private intranet IPs with the public Vercel domain fallback.
 * Ensures the resolved URL uses HTTPS and points to the /gallery/[id] endpoint.
 */
export function resolvePublicGalleryUrl(
  sessionId: string,
  options?: ResolveGalleryUrlOptions
): string {
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('sessionId is required to resolve public gallery URL');
  }

  const rawOrigin =
    options?.publicGalleryUrl ||
    options?.appUrl ||
    options?.origin ||
    process.env.NEXT_PUBLIC_PUBLIC_GALLERY_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    DEFAULT_PUBLIC_GALLERY_FALLBACK;

  let origin = rawOrigin.trim().replace(/\/+$/, '');

  // Detect local Electron or private development hostnames
  const isLocalHost =
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    origin.includes('0.0.0.0') ||
    origin.startsWith('app://') ||
    origin.startsWith('file://');

  if (isLocalHost) {
    origin = DEFAULT_PUBLIC_GALLERY_FALLBACK;
  }

  // Force HTTPS if http is present and not explicitly disabled
  if (origin.startsWith('http://') && !origin.includes('localhost')) {
    origin = origin.replace(/^http:\/\//, 'https://');
  } else if (!origin.startsWith('https://')) {
    origin = `https://${origin.replace(/^[^/]+:\/\//, '')}`;
  }

  const cleanSessionId = encodeURIComponent(sessionId.trim());
  return `${origin}/gallery/${cleanSessionId}`;
}

// ============================================================================
// Test Suite: Canvas Snapping, Free-Transform Stickers & QR Resolution
// ============================================================================

describe('QuickPic Canvas Snapping, Stickers & Public QR Resolution Suite', () => {

  // ==========================================================================
  // 1. Snap Calculation Algorithm Tests
  // ==========================================================================
  describe('Snap Calculation Algorithm', () => {
    const canvasDimensions = { width: 400, height: 600 };
    // Threshold in % for 400px width: (10 / 400) * 100 = 2.5%
    // Threshold in % for 600px height: (10 / 600) * 100 = 1.667%

    describe('Horizontal & Vertical Center Snapping (50%)', () => {
      it('should snap slot center to Horizontal Center (50%) within 10px threshold', () => {
        // Slot width = 80%. Center X = targetX + 40%. For center at 50%, targetX should be 10%.
        // Target at 11.5% -> slot center is 51.5% -> diff from 50% is 1.5% (< 2.5% threshold)
        const slot = { id: 'slot-1', x: 11.5, y: 30, width: 80, height: 25 };
        const result = calculateSlotSnap(slot, [], canvasDimensions);

        assert.strictEqual(result.x, 10, 'Target X should snap so center is exactly 50% (50 - 40 = 10)');
        const guide = result.guidelines.find((g) => g.type === 'v' && g.positionPct === 50);
        assert.ok(guide, 'Guideline for Center 50% must be generated');
      });

      it('should snap slot center to Vertical Center (50%) within 10px threshold', () => {
        // Slot height = 20%. Center Y = targetY + 10%. For center at 50%, targetY should be 40%.
        // Target at 41% -> slot center is 51% -> diff from 50% is 1.0% (< 1.667% threshold)
        const slot = { id: 'slot-1', x: 20, y: 41, width: 40, height: 20 };
        const result = calculateSlotSnap(slot, [], canvasDimensions);

        assert.strictEqual(result.y, 40, 'Target Y should snap so center is exactly 50% (50 - 10 = 40)');
        const guide = result.guidelines.find((g) => g.type === 'h' && g.positionPct === 50);
        assert.ok(guide, 'Guideline for Vertical Center 50% must be generated');
      });

      it('should snap simultaneously to both Horizontal and Vertical Centers', () => {
        const slot = { id: 'slot-center', x: 11.8, y: 40.8, width: 80, height: 20 };
        const result = calculateSlotSnap(slot, [], canvasDimensions);

        assert.strictEqual(result.x, 10, 'X must snap to 10%');
        assert.strictEqual(result.y, 40, 'Y must snap to 40%');
        assert.strictEqual(result.guidelines.length >= 2, true);
        assert.ok(result.guidelines.some((g) => g.type === 'v' && g.positionPct === 50));
        assert.ok(result.guidelines.some((g) => g.type === 'h' && g.positionPct === 50));
      });

      it('should NOT snap to center when outside the 10px threshold', () => {
        // Target at 16% -> slot center is 56% -> diff is 6% (> 2.5% threshold)
        const slot = { id: 'slot-1', x: 16, y: 30, width: 80, height: 25 };
        const result = calculateSlotSnap(slot, [], canvasDimensions);

        assert.strictEqual(result.x, 16, 'X should not snap when distance exceeds threshold');
        const guide = result.guidelines.find((g) => g.positionPct === 50);
        assert.strictEqual(guide, undefined);
      });
    });

    describe('Adjacent Slot Edge Snapping (Top, Bottom, Left, Right)', () => {
      const neighborSlot: SlotBox = { id: 'slot-neighbor', x: 10, y: 10, width: 80, height: 25 };

      it('should snap Left edge to neighbor Left edge within 10px threshold', () => {
        // Neighbor Left = 10%. Target X = 11.2% (< 2.5% diff)
        const movingSlot = { id: 'slot-2', x: 11.2, y: 45, width: 80, height: 25 };
        const result = calculateSlotSnap(movingSlot, [neighborSlot], canvasDimensions);

        assert.strictEqual(result.x, 10, 'Left edge should snap to 10%');
        assert.ok(result.guidelines.some((g) => g.type === 'v' && g.positionPct === 10));
      });

      it('should snap Right edge to neighbor Right edge within 10px threshold', () => {
        // Neighbor Right = 10 + 80 = 90%. Target slot width = 40%.
        // To align Right: targetX + 40 = 90 -> targetX = 50%.
        // Target X at 51.5% -> Right is 91.5% (< 2.5% diff from 90%)
        const movingSlot = { id: 'slot-2', x: 51.5, y: 45, width: 40, height: 25 };
        const result = calculateSlotSnap(movingSlot, [neighborSlot], canvasDimensions);

        assert.strictEqual(result.x, 50, 'Right edge should align with neighbor Right edge');
        assert.ok(result.guidelines.some((g) => g.type === 'v' && g.positionPct === 90));
      });

      it('should snap Top edge to neighbor Top edge within 10px threshold', () => {
        // Neighbor Top = 10%. Target Y = 10.9% (< 1.667% diff)
        const movingSlot = { id: 'slot-2', x: 50, y: 10.9, width: 40, height: 25 };
        const result = calculateSlotSnap(movingSlot, [neighborSlot], canvasDimensions);

        assert.strictEqual(result.y, 10, 'Top edge should snap to neighbor Top (10%)');
        assert.ok(result.guidelines.some((g) => g.type === 'h' && g.positionPct === 10));
      });

      it('should snap Bottom edge to neighbor Bottom edge within 10px threshold', () => {
        // Neighbor Bottom = 10 + 25 = 35%. Target height = 25%.
        // To align Bottom: targetY + 25 = 35 -> targetY = 10%.
        // Target Y at 11% -> target Bottom = 36% (< 1.667% diff from 35%)
        const movingSlot = { id: 'slot-2', x: 50, y: 11, width: 40, height: 25 };
        const result = calculateSlotSnap(movingSlot, [neighborSlot], canvasDimensions);

        assert.strictEqual(result.y, 10, 'Bottom edge should snap to neighbor Bottom (35 - 25 = 10)');
        assert.ok(result.guidelines.some((g) => g.type === 'h' && g.positionPct === 35));
      });

      it('should snap to Adjacent Stack (Top aligned to Neighbor Bottom + 4% gap)', () => {
        // Neighbor Bottom = 10 + 25 = 35%. Stack target = 35 + 4 = 39%.
        // Target Y at 39.8% -> diff from 39% is 0.8% (< 1.667% diff)
        const movingSlot = { id: 'slot-2', x: 10, y: 39.8, width: 80, height: 25 };
        const result = calculateSlotSnap(movingSlot, [neighborSlot], canvasDimensions);

        assert.strictEqual(result.y, 39, 'Top should snap to neighbor bottom + 4% gap (39%)');
        assert.ok(result.guidelines.some((g) => g.type === 'h' && g.label === 'Adjacent Stack'));
      });
    });

    describe('Coordinate Clamping within Paper Boundaries (0% to 100%)', () => {
      it('should clamp negative X coordinate to 0', () => {
        const slot = { id: 'slot-oob', x: -15, y: 20, width: 80, height: 25 };
        const result = calculateSlotSnap(slot, [], canvasDimensions);

        assert.strictEqual(result.x, 0, 'Negative X must be clamped to 0');
      });

      it('should clamp negative Y coordinate to 0', () => {
        const slot = { id: 'slot-oob', x: 10, y: -25, width: 80, height: 25 };
        const result = calculateSlotSnap(slot, [], canvasDimensions);

        assert.strictEqual(result.y, 0, 'Negative Y must be clamped to 0');
      });

      it('should clamp X coordinate when exceeding 100% - width', () => {
        // Width = 80%, Max allowable X = 20%
        const slot = { id: 'slot-oob', x: 60, y: 20, width: 80, height: 25 };
        const result = calculateSlotSnap(slot, [], canvasDimensions);

        assert.strictEqual(result.x, 20, 'Oversized X must be clamped to 100 - width (20%)');
      });

      it('should clamp Y coordinate when exceeding 100% - height', () => {
        // Height = 25%, Max allowable Y = 75%
        const slot = { id: 'slot-oob', x: 10, y: 95, width: 80, height: 25 };
        const result = calculateSlotSnap(slot, [], canvasDimensions);

        assert.strictEqual(result.y, 75, 'Oversized Y must be clamped to 100 - height (75%)');
      });

      it('should preserve coordinates cleanly when strictly within safe boundary bounds', () => {
        const slot = { id: 'slot-safe', x: 15.5, y: 25.5, width: 40, height: 30 };
        const result = calculateSlotSnap(slot, [], canvasDimensions);

        assert.strictEqual(result.x, 15.5);
        assert.strictEqual(result.y, 25.5);
      });
    });
  });

  // ==========================================================================
  // 2. Sticker Transformation Geometry Tests
  // ==========================================================================
  describe('Sticker Transformation Geometry', () => {

    describe('Translation Coordinates (x, y)', () => {
      it('should calculate translation accurately from pointer deltas', () => {
        const initialX = 20;
        const initialY = 30;
        const deltaX = 15.5;
        const deltaY = -10.2;

        const result = calculateStickerTranslation(initialX, initialY, deltaX, deltaY);
        assert.strictEqual(result.x, 35.5);
        assert.strictEqual(result.y, 19.8);
      });

      it('should clamp translation coordinates to minimum 0% boundary', () => {
        const result = calculateStickerTranslation(5, 10, -25, -50);
        assert.strictEqual(result.x, 0, 'X must clamp to 0%');
        assert.strictEqual(result.y, 0, 'Y must clamp to 0%');
      });

      it('should clamp translation coordinates to maximum 100% boundary', () => {
        const result = calculateStickerTranslation(90, 85, 30, 40);
        assert.strictEqual(result.x, 100, 'X must clamp to 100%');
        assert.strictEqual(result.y, 100, 'Y must clamp to 100%');
      });
    });

    describe('Rotation Angle Clamping & Circular Normalization (0 to 360 degrees)', () => {
      it('should preserve standard positive angles within (0, 360)', () => {
        assert.strictEqual(normalizeRotationAngle(45), 45);
        assert.strictEqual(normalizeRotationAngle(90), 90);
        assert.strictEqual(normalizeRotationAngle(180), 180);
        assert.strictEqual(normalizeRotationAngle(270), 270);
      });

      it('should normalize 360 and 0 degrees to 0 degrees', () => {
        assert.strictEqual(normalizeRotationAngle(0), 0);
        assert.strictEqual(normalizeRotationAngle(360), 0);
      });

      it('should wrap negative angles into [0, 360) range', () => {
        assert.strictEqual(normalizeRotationAngle(-45), 315);
        assert.strictEqual(normalizeRotationAngle(-90), 270);
        assert.strictEqual(normalizeRotationAngle(-180), 180);
        assert.strictEqual(normalizeRotationAngle(-350), 10);
        assert.strictEqual(normalizeRotationAngle(-360), 0);
      });

      it('should wrap angles exceeding 360 degrees into [0, 360) range', () => {
        assert.strictEqual(normalizeRotationAngle(375), 15);
        assert.strictEqual(normalizeRotationAngle(720), 0);
        assert.strictEqual(normalizeRotationAngle(750), 30);
      });

      it('should compute geometric rotation from pointer drag coordinates accurately', () => {
        const centerX = 100;
        const centerY = 100;
        const initialRotation = 0;
        const initialAngleDeg = 0; // Pointer was directly right: (150, 100)

        // Drag pointer directly downwards: (100, 150) -> angle is 90 deg
        const newRotation = calculateStickerRotation(
          initialRotation,
          initialAngleDeg,
          centerX,
          centerY,
          100,
          150
        );
        assert.strictEqual(newRotation, 90);
      });

      it('should compute counter-clockwise pointer drag into wrapped 270 degree rotation', () => {
        const centerX = 100;
        const centerY = 100;
        const initialRotation = 0;
        const initialAngleDeg = 0;

        // Drag pointer directly upwards: (100, 50) -> angle is -90 deg -> 270 deg
        const newRotation = calculateStickerRotation(
          initialRotation,
          initialAngleDeg,
          centerX,
          centerY,
          100,
          50
        );
        assert.strictEqual(newRotation, 270);
      });
    });

    describe('Scale Factor Bounds (0.2 to 3.0)', () => {
      it('should enforce minimum scale factor bound of 0.2', () => {
        assert.strictEqual(clampScaleFactor(0.1), 0.2);
        assert.strictEqual(clampScaleFactor(-0.5), 0.2);
        assert.strictEqual(clampScaleFactor(0.0), 0.2);
      });

      it('should enforce maximum scale factor bound of 3.0', () => {
        assert.strictEqual(clampScaleFactor(3.5), 3.0);
        assert.strictEqual(clampScaleFactor(5.0), 3.0);
        assert.strictEqual(clampScaleFactor(10.0), 3.0);
      });

      it('should maintain valid scale values within [0.2, 3.0] bounds', () => {
        assert.strictEqual(clampScaleFactor(0.2), 0.2);
        assert.strictEqual(clampScaleFactor(1.0), 1.0);
        assert.strictEqual(clampScaleFactor(1.75), 1.75);
        assert.strictEqual(clampScaleFactor(2.5), 2.5);
        assert.strictEqual(clampScaleFactor(3.0), 3.0);
      });

      it('should calculate scale adjustment from pointer drag correctly', () => {
        const initialScale = 1.0;
        // Dragging 60px right and 60px up -> delta = 60 - (-60) = 120 -> scaleDelta = +1.0
        const scaled = calculateStickerScale(initialScale, 60, -60, 120);
        assert.strictEqual(scaled, 2.0);
      });

      it('should clamp downscale pointer drag to minimum bound 0.2', () => {
        const initialScale = 1.0;
        // Severe downscale drag
        const scaled = calculateStickerScale(initialScale, -300, 300, 120);
        assert.strictEqual(scaled, 0.2);
      });
    });

    describe('Sticker Duplication Geometry', () => {
      it('should duplicate sticker with +5% offset, +15 deg rotation, and incremented zIndex', () => {
        const target: StickerTransform = {
          id: 'sticker-1',
          x: 20,
          y: 30,
          scale: 1.2,
          rotation: 30,
          zIndex: 4,
        };
        const allStickers: StickerTransform[] = [target];

        const dup = duplicateStickerTransform(target, allStickers);
        assert.strictEqual(dup.x, 25);
        assert.strictEqual(dup.y, 35);
        assert.strictEqual(dup.scale, 1.2);
        assert.strictEqual(dup.rotation, 45);
        assert.strictEqual(dup.zIndex, 5);
      });

      it('should cap duplication coordinates to 90% to stay visible within canvas', () => {
        const target: StickerTransform = {
          id: 'sticker-edge',
          x: 88,
          y: 95,
          scale: 1.0,
          rotation: 350,
          zIndex: 1,
        };
        const dup = duplicateStickerTransform(target, [target]);
        assert.strictEqual(dup.x, 90);
        assert.strictEqual(dup.y, 90);
        assert.strictEqual(dup.rotation, 5); // (350 + 15) % 360 = 5
      });
    });
  });

  // ==========================================================================
  // 3. Public Cloudinary QR Resolution Tests (`resolvePublicGalleryUrl`)
  // ==========================================================================
  describe('Public Cloudinary QR Resolution (resolvePublicGalleryUrl)', () => {
    const testSessionId = 'sess_xyz_789456';

    it('should resolve URLs starting with https:// and pointing to public domain', () => {
      const url = resolvePublicGalleryUrl(testSessionId, {
        origin: 'https://quickpic-olive.vercel.app',
      });

      assert.strictEqual(typeof url, 'string');
      assert.strictEqual(url.startsWith('https://'), true);
      assert.strictEqual(url, `https://quickpic-olive.vercel.app/gallery/${testSessionId}`);
    });

    it('should automatically replace local Electron localhost origin with public fallback', () => {
      const localhostUrls = [
        'http://localhost:3000',
        'http://localhost:8000',
        'http://localhost',
        'https://localhost:3000',
        'http://127.0.0.1:3000',
        'http://127.0.0.1',
        'app://quickpic-desktop',
        'file:///Applications/QuickPic.app',
      ];

      for (const localOrigin of localhostUrls) {
        const resolved = resolvePublicGalleryUrl(testSessionId, { origin: localOrigin });
        assert.strictEqual(
          resolved.startsWith('https://quickpic-olive.vercel.app/gallery/'),
          true,
          `Local origin "${localOrigin}" must be replaced with public Vercel domain`
        );
        assert.strictEqual(resolved, `https://quickpic-olive.vercel.app/gallery/${testSessionId}`);
      }
    });

    it('should upgrade non-localhost HTTP origins to HTTPS for secure mobile sharing', () => {
      const resolved = resolvePublicGalleryUrl(testSessionId, {
        origin: 'http://custom-booth.events',
      });
      assert.strictEqual(resolved, `https://custom-booth.events/gallery/${testSessionId}`);
    });

    it('should strip trailing slashes cleanly from origin', () => {
      const resolved = resolvePublicGalleryUrl(testSessionId, {
        origin: 'https://quickpic-olive.vercel.app///',
      });
      assert.strictEqual(resolved, `https://quickpic-olive.vercel.app/gallery/${testSessionId}`);
    });

    it('should support custom production gallery domain overrides', () => {
      const customDomain = 'https://gallery.photoboothpro.com';
      const resolved = resolvePublicGalleryUrl(testSessionId, {
        publicGalleryUrl: customDomain,
      });
      assert.strictEqual(resolved, `${customDomain}/gallery/${testSessionId}`);
    });

    it('should properly encode special characters in session ID', () => {
      const complexSessionId = 'sess-2026/10/03 #1';
      const resolved = resolvePublicGalleryUrl(complexSessionId);
      assert.strictEqual(
        resolved,
        'https://quickpic-olive.vercel.app/gallery/sess-2026%2F10%2F03%20%231'
      );
    });

    it('should throw an error when sessionId is missing or invalid', () => {
      assert.throws(() => {
        resolvePublicGalleryUrl('');
      }, /sessionId is required/);

      assert.throws(() => {
        // @ts-expect-error testing invalid type
        resolvePublicGalleryUrl(null);
      }, /sessionId is required/);
    });
  });
});
