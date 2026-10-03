import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Domain model definitions for Multi-Tenant Testing
interface MockSession {
  id: string;
  boothId: string;
  eventId?: string;
  packageId: string;
  layout?: string;
  payment: {
    method: 'qris_midtrans' | 'qris_xendit' | 'cash_bypass';
    amount: number;
    status: 'settled' | 'pending' | 'bypassed';
  };
  createdAt: number;
}

interface MockBooth {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline' | 'maintenance';
  ribbonRemaining: number;
  ribbonPercentage?: number;
}

const CRITICAL_RIBBON_THRESHOLD = 100;

/**
 * Resolves session booth tenant ID adhering to QuickPic multi-tenant architecture.
 */
function resolveSessionBoothId(session: Partial<MockSession>, boothIdParam?: string): string {
  return boothIdParam || session.boothId || session.eventId || 'booth-default';
}

/**
 * Filters sessions strictly for a given tenant/booth scope.
 */
function filterSessionsByBooth(sessions: MockSession[], selectedBoothId: string | 'all'): MockSession[] {
  if (selectedBoothId === 'all') return sessions;
  return sessions.filter((s) => s.boothId === selectedBoothId || s.eventId === selectedBoothId);
}

/**
 * Aggregates total revenue for a list of filtered sessions.
 */
function aggregateTotalRevenue(sessions: MockSession[]): number {
  return sessions.reduce((acc, s) => acc + (s.payment?.amount || 0), 0);
}

/**
 * Counts sessions grouped by booth ID across the fleet.
 */
function aggregateSessionCountsByBooth(sessions: MockSession[], allBooths: MockBooth[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const booth of allBooths) {
    counts[booth.id] = 0;
  }
  for (const session of sessions) {
    if (counts[session.boothId] !== undefined) {
      counts[session.boothId]++;
    } else {
      counts[session.boothId] = 1;
    }
  }
  return counts;
}

/**
 * Aggregates revenue grouped by booth ID across the fleet.
 */
function aggregateRevenueByBooth(sessions: MockSession[], allBooths: MockBooth[]): Record<string, number> {
  const revenues: Record<string, number> = {};
  for (const booth of allBooths) {
    revenues[booth.id] = 0;
  }
  for (const session of sessions) {
    const amount = session.payment?.amount || 0;
    if (revenues[session.boothId] !== undefined) {
      revenues[session.boothId] += amount;
    } else {
      revenues[session.boothId] = amount;
    }
  }
  return revenues;
}

/**
 * Checks if a booth's ribbon remaining count falls below critical warning threshold (< 100).
 */
function isLowRibbonWarning(ribbonRemaining: number, threshold = CRITICAL_RIBBON_THRESHOLD): boolean {
  return typeof ribbonRemaining === 'number' && ribbonRemaining < threshold;
}

/**
 * Filters fleet booths requiring ribbon replacement alerts.
 */
function getLowRibbonBooths(booths: MockBooth[], threshold = CRITICAL_RIBBON_THRESHOLD): MockBooth[] {
  return booths.filter((b) => isLowRibbonWarning(b.ribbonRemaining, threshold));
}

describe('QuickPic Multi-Tenant Isolation & Fleet Aggregation Test Suite', () => {
  // Test fixture data
  const mockBooths: MockBooth[] = [
    {
      id: 'booth-jkt-01',
      name: 'Grand Indonesia Booth A',
      location: 'Jakarta',
      status: 'online',
      ribbonRemaining: 558,
      ribbonPercentage: 79.7,
    },
    {
      id: 'booth-sub-02',
      name: 'Tunjungan Plaza Booth B',
      location: 'Surabaya',
      status: 'online',
      ribbonRemaining: 412,
      ribbonPercentage: 58.8,
    },
    {
      id: 'booth-bdg-03',
      name: 'Paris Van Java Booth C',
      location: 'Bandung',
      status: 'maintenance',
      ribbonRemaining: 74, // Critical ribbon alert (< 100 cuts)
      ribbonPercentage: 10.5,
    },
    {
      id: 'booth-bali-04',
      name: 'Beachwalk Kuta Booth D',
      location: 'Bali',
      status: 'offline',
      ribbonRemaining: 630,
      ribbonPercentage: 90.0,
    },
  ];

  const mockSessions: MockSession[] = [
    {
      id: 'sess-001',
      boothId: 'booth-jkt-01',
      packageId: 'strip',
      layout: 'strip-3',
      payment: { method: 'qris_midtrans', amount: 35000, status: 'settled' },
      createdAt: 1000,
    },
    {
      id: 'sess-002',
      boothId: 'booth-jkt-01',
      packageId: '4r-classic',
      layout: 'grid-2x2',
      payment: { method: 'qris_midtrans', amount: 40000, status: 'settled' },
      createdAt: 2000,
    },
    {
      id: 'sess-003',
      boothId: 'booth-sub-02',
      packageId: 'vip',
      layout: 'strip-4',
      payment: { method: 'qris_midtrans', amount: 55000, status: 'settled' },
      createdAt: 3000,
    },
    {
      id: 'sess-004',
      boothId: 'booth-sub-02',
      packageId: 'strip',
      layout: 'strip-3',
      payment: { method: 'cash_bypass', amount: 35000, status: 'bypassed' },
      createdAt: 4000,
    },
    {
      id: 'sess-005',
      boothId: 'booth-bdg-03',
      packageId: 'strip',
      layout: 'strip-3',
      payment: { method: 'qris_midtrans', amount: 35000, status: 'settled' },
      createdAt: 5000,
    },
  ];

  // ============================================================================
  // 1. Session Multi-Tenant Tagging with boothId
  // ============================================================================
  describe('Session Multi-Tenant Tagging with boothId', () => {
    it('should correctly tag new sessions with explicit boothId', () => {
      const sessionData: Partial<MockSession> = {
        id: 'new-sess-1',
        packageId: 'strip',
      };
      const taggedBoothId = resolveSessionBoothId(sessionData, 'booth-jkt-01');
      assert.strictEqual(taggedBoothId, 'booth-jkt-01');
    });

    it('should use session.boothId if parameter is omitted', () => {
      const sessionData: Partial<MockSession> = {
        id: 'new-sess-2',
        boothId: 'booth-sub-02',
      };
      const resolved = resolveSessionBoothId(sessionData);
      assert.strictEqual(resolved, 'booth-sub-02');
    });

    it('should fallback to eventId or booth-default when boothId is not provided', () => {
      const withEvent = resolveSessionBoothId({ eventId: 'summer-event-2026' });
      assert.strictEqual(withEvent, 'summer-event-2026');

      const empty = resolveSessionBoothId({});
      assert.strictEqual(empty, 'booth-default');
    });

    it('should strictly isolate sessions by boothId with zero cross-tenant leakage', () => {
      const jktSessions = filterSessionsByBooth(mockSessions, 'booth-jkt-01');
      assert.strictEqual(jktSessions.length, 2);
      assert.ok(jktSessions.every((s) => s.boothId === 'booth-jkt-01'));
      // Zero leakage check
      assert.ok(!jktSessions.some((s) => s.boothId === 'booth-sub-02'));
      assert.ok(!jktSessions.some((s) => s.boothId === 'booth-bdg-03'));

      const subSessions = filterSessionsByBooth(mockSessions, 'booth-sub-02');
      assert.strictEqual(subSessions.length, 2);
      assert.ok(subSessions.every((s) => s.boothId === 'booth-sub-02'));

      const bdgSessions = filterSessionsByBooth(mockSessions, 'booth-bdg-03');
      assert.strictEqual(bdgSessions.length, 1);
      assert.strictEqual(bdgSessions[0].id, 'sess-005');
    });

    it('should return empty list when querying a registered booth with zero sessions', () => {
      const baliSessions = filterSessionsByBooth(mockSessions, 'booth-bali-04');
      assert.strictEqual(baliSessions.length, 0);
    });

    it('should return all sessions when selected booth is "all"', () => {
      const all = filterSessionsByBooth(mockSessions, 'all');
      assert.strictEqual(all.length, mockSessions.length);
    });
  });

  // ============================================================================
  // 2. Fleet Aggregation Logic (Total Revenue & Session Counts by Booth)
  // ============================================================================
  describe('Fleet Aggregation Logic', () => {
    it('should calculate total fleet revenue accurately across all booths', () => {
      const totalRevenue = aggregateTotalRevenue(mockSessions);
      // 35000 + 40000 + 55000 + 35000 + 35000 = 200,000 IDR
      assert.strictEqual(totalRevenue, 200000);
    });

    it('should calculate isolated revenue per booth correctly', () => {
      const revenues = aggregateRevenueByBooth(mockSessions, mockBooths);

      // booth-jkt-01: 35000 + 40000 = 75000
      assert.strictEqual(revenues['booth-jkt-01'], 75000);

      // booth-sub-02: 55000 + 35000 = 90000
      assert.strictEqual(revenues['booth-sub-02'], 90000);

      // booth-bdg-03: 35000
      assert.strictEqual(revenues['booth-bdg-03'], 35000);

      // booth-bali-04: 0
      assert.strictEqual(revenues['booth-bali-04'], 0);
    });

    it('should satisfy mathematical invariant: sum of per-booth revenues === total fleet revenue', () => {
      const totalFleetRevenue = aggregateTotalRevenue(mockSessions);
      const revenuesByBooth = aggregateRevenueByBooth(mockSessions, mockBooths);
      const sumOfBooths = Object.values(revenuesByBooth).reduce((a, b) => a + b, 0);

      assert.strictEqual(sumOfBooths, totalFleetRevenue);
    });

    it('should count sessions by booth accurately', () => {
      const sessionCounts = aggregateSessionCountsByBooth(mockSessions, mockBooths);

      assert.strictEqual(sessionCounts['booth-jkt-01'], 2);
      assert.strictEqual(sessionCounts['booth-sub-02'], 2);
      assert.strictEqual(sessionCounts['booth-bdg-03'], 1);
      assert.strictEqual(sessionCounts['booth-bali-04'], 0);
    });

    it('should satisfy mathematical invariant: sum of booth session counts === total sessions', () => {
      const sessionCounts = aggregateSessionCountsByBooth(mockSessions, mockBooths);
      const sumOfCounts = Object.values(sessionCounts).reduce((a, b) => a + b, 0);

      assert.strictEqual(sumOfCounts, mockSessions.length);
    });

    it('should correctly segment revenue by payment method per booth', () => {
      const jktSessions = filterSessionsByBooth(mockSessions, 'booth-jkt-01');
      const qrisRevenue = jktSessions
        .filter((s) => s.payment.method.startsWith('qris'))
        .reduce((sum, s) => sum + s.payment.amount, 0);
      assert.strictEqual(qrisRevenue, 75000);

      const subSessions = filterSessionsByBooth(mockSessions, 'booth-sub-02');
      const cashBypassRevenue = subSessions
        .filter((s) => s.payment.method === 'cash_bypass')
        .reduce((sum, s) => sum + s.payment.amount, 0);
      assert.strictEqual(cashBypassRevenue, 35000);
    });
  });

  // ============================================================================
  // 3. Low-Ribbon Warning Condition (ribbonRemaining < 100)
  // ============================================================================
  describe('Low-Ribbon Warning Condition (ribbonRemaining < 100)', () => {
    it('should trigger warning when ribbonRemaining is strictly below 100', () => {
      assert.strictEqual(isLowRibbonWarning(99), true, '99 cuts should trigger low ribbon warning');
      assert.strictEqual(isLowRibbonWarning(74), true, '74 cuts should trigger low ribbon warning');
      assert.strictEqual(isLowRibbonWarning(1), true, '1 cut should trigger low ribbon warning');
      assert.strictEqual(isLowRibbonWarning(0), true, '0 cuts (empty roll) should trigger low ribbon warning');
    });

    it('should NOT trigger warning at the exact boundary of 100 cuts', () => {
      assert.strictEqual(isLowRibbonWarning(100), false, '100 cuts is the boundary and should NOT trigger warning');
    });

    it('should NOT trigger warning when ribbonRemaining is above 100 cuts', () => {
      assert.strictEqual(isLowRibbonWarning(101), false, '101 cuts should NOT trigger warning');
      assert.strictEqual(isLowRibbonWarning(412), false, '412 cuts should NOT trigger warning');
      assert.strictEqual(isLowRibbonWarning(558), false, '558 cuts should NOT trigger warning');
      assert.strictEqual(isLowRibbonWarning(700), false, '700 cuts (full roll) should NOT trigger warning');
    });

    it('should filter only booths with low ribbon in a fleet', () => {
      const extendedFleet: MockBooth[] = [
        ...mockBooths,
        {
          id: 'booth-mdn-05',
          name: 'Medan Fair Booth E',
          location: 'Medan',
          status: 'online',
          ribbonRemaining: 100, // Boundary: exactly 100 (not low)
        },
        {
          id: 'booth-smg-06',
          name: 'Paragon Mall Booth F',
          location: 'Semarang',
          status: 'online',
          ribbonRemaining: 12, // Critical: 12 cuts (low)
        },
      ];

      const lowRibbonBooths = getLowRibbonBooths(extendedFleet);

      // Expected alerts: booth-bdg-03 (74 cuts) and booth-smg-06 (12 cuts)
      assert.strictEqual(lowRibbonBooths.length, 2);
      const lowRibbonIds = lowRibbonBooths.map((b) => b.id);
      assert.ok(lowRibbonIds.includes('booth-bdg-03'));
      assert.ok(lowRibbonIds.includes('booth-smg-06'));

      // Excluded booths
      assert.ok(!lowRibbonIds.includes('booth-jkt-01'));
      assert.ok(!lowRibbonIds.includes('booth-sub-02'));
      assert.ok(!lowRibbonIds.includes('booth-bali-04'));
      assert.ok(!lowRibbonIds.includes('booth-mdn-05')); // 100 cuts boundary
    });

    it('should correctly calculate ribbon roll percentage relative to 700-cut roll', () => {
      const calcPercentage = (cuts: number, maxRoll = 700) =>
        Math.max(0, Math.min(100, Math.round((cuts / maxRoll) * 100)));

      assert.strictEqual(calcPercentage(700), 100);
      assert.strictEqual(calcPercentage(350), 50);
      assert.strictEqual(calcPercentage(74), 11); // 74 / 700 = 10.57% -> 11%
      assert.strictEqual(calcPercentage(0), 0);
    });

    it('should handle custom threshold overrides if specified', () => {
      // With threshold = 50, booth with 74 cuts should NOT trigger warning
      assert.strictEqual(isLowRibbonWarning(74, 50), false);
      // With threshold = 200, booth with 150 cuts SHOULD trigger warning
      assert.strictEqual(isLowRibbonWarning(150, 200), true);
    });
  });
});
