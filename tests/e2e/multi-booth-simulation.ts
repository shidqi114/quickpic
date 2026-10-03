/**
 * QuickPic Multi-Booth E2E Simulation Test Suite
 *
 * Scenario: Vendor managing 2 active photobooths simultaneously:
 *   - Station 1: booth-jkt-01 ('Central Mall Booth')
 *   - Station 2: booth-sub-02 ('Surabaya Plaza Booth')
 *
 * Verifies:
 *   1. 6-digit PIN generation and kiosk pairing via /api/booths/pair (device_token issuance).
 *   2. Hardware telemetry heartbeat ingestion via /api/booths/telemetry with Bearer auth:
 *      - Station 1: Ribbon = 550 cuts, Canon DSLR = online.
 *      - Station 2: Ribbon = 65 cuts (triggers low ribbon threshold < 100 cuts).
 *   3. Simulated guest sessions originating from both stations with QRIS and cash bypass.
 *   4. Fleet-wide aggregated revenue calculation and booth isolation.
 *
 * Usage:
 *   node --experimental-strip-types tests/e2e/multi-booth-simulation.ts
 */

import http from 'node:http';
import crypto from 'node:crypto';
import { strict as assert } from 'node:assert';

// ============================================================================
// Types and Interfaces
// ============================================================================

interface PhotoboothRecord {
  id: string;
  name: string;
  location: string;
  ownerId: string;
  pairingCode: string | null;
  pairingCodeExpiresAt: string | null;
  deviceToken: string | null;
  status: 'online' | 'offline' | 'maintenance';
  lastSeenAt: string | null;
  lastHeartbeatAt: string | null;
}

interface TelemetryRecord {
  id: string;
  boothId: string;
  ribbonRemaining: number;
  ribbonPercentage: number;
  queueDepth: number;
  cpuPct: number;
  ramPct: number;
  cameraConnected: boolean;
  cameraModel: string;
  printerConnected: boolean;
  printerName: string;
  pingedAt: string;
}

interface SessionRecord {
  id: string;
  boothId: string;
  packageId: string;
  packageName: string;
  compositeUrl: string;
  layout: string;
  payment: {
    method: 'qris_midtrans' | 'cash_bypass';
    amount: number;
    transactionId: string;
    status: 'settled' | 'bypassed';
    staffBypassPinUsed?: boolean;
  };
  createdAt: string;
}

// ============================================================================
// In-Memory Simulation State (Matching Database & API Behavior)
// ============================================================================

class SimulationDatabase {
  booths: Map<string, PhotoboothRecord> = new Map();
  telemetryLogs: TelemetryRecord[] = [];
  sessions: SessionRecord[] = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.booths.clear();
    this.telemetryLogs = [];
    this.sessions = [];
  }

  generatePin(): string {
    const num = crypto.randomInt(100000, 1000000);
    return num.toString();
  }

  generateDeviceToken(): string {
    const entropy = crypto.randomBytes(24).toString('hex');
    return `qp_dev_${entropy}`;
  }
}

const db = new SimulationDatabase();

// ============================================================================
// Embedded Simulation Server
// ============================================================================

function createSimulationServer(): http.Server {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    const method = req.method || 'GET';

    // Helper to send JSON
    const sendJson = (statusCode: number, payload: any) => {
      res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify(payload));
    };

    // Helper to read JSON body
    const readBody = async (): Promise<any> => {
      return new Promise((resolve) => {
        let bodyStr = '';
        req.on('data', (chunk) => {
          bodyStr += chunk;
        });
        req.on('end', () => {
          try {
            resolve(bodyStr ? JSON.parse(bodyStr) : {});
          } catch {
            resolve({});
          }
        });
      });
    };

    // ------------------------------------------------------------------------
    // Route: /api/booths/pair
    // ------------------------------------------------------------------------
    if (pathname === '/api/booths/pair') {
      if (method === 'POST') {
        const body = await readBody();
        const action = body.action || 'pair';

        // Action: Generate Pairing Code
        if (action === 'generate') {
          const { boothId, boothName = 'New Photobooth', location = 'Unassigned Venue', ownerId = 'vendor-snapstudio' } = body;
          if (!boothId) {
            return sendJson(400, { error: 'boothId is required to generate a pairing code' });
          }

          const pin = db.generatePin();
          const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

          const existing = db.booths.get(boothId) || {
            id: boothId,
            name: boothName,
            location,
            ownerId,
            pairingCode: null,
            pairingCodeExpiresAt: null,
            deviceToken: null,
            status: 'offline',
            lastSeenAt: null,
            lastHeartbeatAt: null,
          };

          existing.name = boothName;
          existing.location = location;
          existing.pairingCode = pin;
          existing.pairingCodeExpiresAt = expiresAt;
          db.booths.set(boothId, existing);

          return sendJson(200, {
            success: true,
            boothId,
            pairingCode: pin,
            expiresAt,
          });
        }

        // Action: Pair Kiosk
        if (action === 'pair') {
          const rawPin = body.pairingCode || body.pin || '';
          const cleanPin = String(rawPin).trim();
          const targetBoothId = body.boothId;

          if (!cleanPin) {
            return sendJson(400, { error: 'A 6-digit pairing PIN is required', code: 'MISSING_PIN' });
          }

          if (!/^\d{6}$/.test(cleanPin)) {
            return sendJson(400, { error: 'Invalid pairing PIN format. Expected exactly 6 digits.', code: 'INVALID_FORMAT' });
          }

          // Find booth by pairing code
          let matchedBooth: PhotoboothRecord | null = null;
          for (const booth of db.booths.values()) {
            if (booth.pairingCode === cleanPin) {
              if (!targetBoothId || booth.id === targetBoothId) {
                matchedBooth = booth;
                break;
              }
            }
          }

          if (!matchedBooth) {
            return sendJson(404, {
              error: 'Invalid pairing PIN. No matching photobooth found or PIN has expired.',
              code: 'PIN_NOT_FOUND',
            });
          }

          // Check expiration
          if (matchedBooth.pairingCodeExpiresAt && new Date(matchedBooth.pairingCodeExpiresAt).getTime() < Date.now()) {
            return sendJson(410, {
              error: 'Pairing PIN has expired. Please generate a new code from the vendor dashboard.',
              code: 'PIN_EXPIRED',
            });
          }

          // Issue device token & clear single-use PIN
          const deviceToken = db.generateDeviceToken();
          const nowIso = new Date().toISOString();

          matchedBooth.deviceToken = deviceToken;
          matchedBooth.pairingCode = null;
          matchedBooth.pairingCodeExpiresAt = null;
          matchedBooth.status = 'online';
          matchedBooth.lastSeenAt = nowIso;
          matchedBooth.lastHeartbeatAt = nowIso;
          db.booths.set(matchedBooth.id, matchedBooth);

          return sendJson(200, {
            success: true,
            boothId: matchedBooth.id,
            boothName: matchedBooth.name,
            location: matchedBooth.location,
            ownerId: matchedBooth.ownerId,
            deviceToken,
            pairedAt: nowIso,
          });
        }

        return sendJson(400, { error: `Unsupported action: ${action}` });
      }

      if (method === 'GET') {
        const boothId = url.searchParams.get('boothId');
        if (!boothId) {
          return sendJson(400, { error: 'boothId parameter is required' });
        }

        const booth = db.booths.get(boothId);
        if (!booth) {
          return sendJson(404, { error: 'Booth not found' });
        }

        return sendJson(200, {
          boothId: booth.id,
          name: booth.name,
          location: booth.location,
          status: booth.status,
          lastSeenAt: booth.lastSeenAt,
          isPaired: Boolean(booth.deviceToken),
          hasActivePairingCode: Boolean(booth.pairingCode),
        });
      }
    }

    // ------------------------------------------------------------------------
    // Route: /api/booths/telemetry
    // ------------------------------------------------------------------------
    if (pathname === '/api/booths/telemetry') {
      if (method === 'POST') {
        const authHeader = req.headers['authorization'] || '';
        const headerToken = req.headers['x-device-token'] as string || '';
        const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : headerToken.trim();

        const body = await readBody();
        const boothIdCandidate = body.boothId || body.booth_id || '';

        if (!boothIdCandidate && !bearerToken) {
          return sendJson(400, { error: 'boothId or valid device authorization token is required' });
        }

        // Authenticate token
        let targetBooth: PhotoboothRecord | null = null;
        if (bearerToken) {
          for (const booth of db.booths.values()) {
            if (booth.deviceToken === bearerToken) {
              targetBooth = booth;
              break;
            }
          }

          // If token was provided but no booth matched, unauthorized
          if (!targetBooth) {
            return sendJson(401, { error: 'Unauthorized: Invalid device_token', code: 'INVALID_DEVICE_TOKEN' });
          }

          // If both candidate boothId and token provided, enforce booth ownership isolation
          if (boothIdCandidate && targetBooth.id !== boothIdCandidate) {
            return sendJson(401, {
              error: 'Unauthorized: Device token does not match specified photobooth ID',
              code: 'INVALID_DEVICE_TOKEN',
            });
          }
        } else {
          return sendJson(401, { error: 'Missing device authentication token', code: 'UNAUTHORIZED' });
        }

        const resolvedBoothId = targetBooth.id;
        const nowIso = new Date().toISOString();

        const ribbonRemaining = Number(body.ribbonRemaining ?? body.ribbon_remaining ?? 700);
        const ribbonPercentage = Number(body.ribbonPercentage ?? body.ribbon_percentage ?? Math.round((ribbonRemaining / 700) * 100));
        const cameraConnected = Boolean(body.cameraConnected ?? body.camera_connected ?? false);
        const cameraModel = String(body.cameraModel ?? body.camera_model ?? 'Canon DSLR');
        const printerConnected = Boolean(body.printerConnected ?? body.printer_connected ?? false);
        const printerName = String(body.printerName ?? body.printer_name ?? 'DNP DS-RX1HS');
        const queueDepth = Number(body.queueDepth ?? body.queue_depth ?? 0);
        const cpuPct = Number(body.cpuPct ?? body.cpu_pct ?? 0);
        const ramPct = Number(body.ramPct ?? body.ram_pct ?? 0);

        // Update booth
        targetBooth.lastSeenAt = nowIso;
        targetBooth.lastHeartbeatAt = nowIso;
        targetBooth.status = 'online';
        db.booths.set(resolvedBoothId, targetBooth);

        // Record telemetry row
        const record: TelemetryRecord = {
          id: `tel_${crypto.randomBytes(8).toString('hex')}`,
          boothId: resolvedBoothId,
          ribbonRemaining,
          ribbonPercentage,
          queueDepth,
          cpuPct,
          ramPct,
          cameraConnected,
          cameraModel,
          printerConnected,
          printerName,
          pingedAt: nowIso,
        };
        db.telemetryLogs.push(record);

        return sendJson(200, {
          success: true,
          boothId: resolvedBoothId,
          timestamp: nowIso,
          status: 'online',
        });
      }

      if (method === 'GET') {
        const boothId = url.searchParams.get('boothId');
        if (!boothId) {
          return sendJson(200, { data: db.telemetryLogs });
        }

        const booth = db.booths.get(boothId);
        const logsForBooth = db.telemetryLogs
          .filter((t) => t.boothId === boothId)
          .sort((a, b) => new Date(b.pingedAt).getTime() - new Date(a.pingedAt).getTime());

        const latest = logsForBooth[0];
        const isOnline = Boolean(
          booth?.lastSeenAt && Date.now() - new Date(booth.lastSeenAt).getTime() < 3 * 60 * 1000
        );

        return sendJson(200, {
          boothId,
          boothName: booth?.name || boothId,
          isOnline,
          status: isOnline ? 'online' : (booth?.status || 'offline'),
          lastPingTime: latest?.pingedAt ? new Date(latest.pingedAt).getTime() : null,
          cpuPct: latest?.cpuPct ?? 0,
          ramPct: latest?.ramPct ?? 0,
          camera: {
            connected: latest?.cameraConnected ?? false,
            model: latest?.cameraModel ?? 'Unknown',
          },
          printer: {
            connected: latest?.printerConnected ?? false,
            name: latest?.printerName ?? 'Unknown',
            ribbonRemaining: latest?.ribbonRemaining ?? 0,
            ribbonPercentage: latest?.ribbonPercentage ?? 0,
            queueDepth: latest?.queueDepth ?? 0,
          },
        });
      }
    }

    // ------------------------------------------------------------------------
    // Route: /api/sessions (Simulated Guest Sessions & Reporting)
    // ------------------------------------------------------------------------
    if (pathname === '/api/sessions') {
      if (method === 'POST') {
        const authHeader = req.headers['authorization'] || '';
        const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

        const body = await readBody();
        const boothId = body.boothId;

        // Verify token matches booth
        const booth = db.booths.get(boothId);
        if (!booth || !bearerToken || booth.deviceToken !== bearerToken) {
          return sendJson(401, { error: 'Unauthorized session submission', code: 'INVALID_DEVICE_TOKEN' });
        }

        const sessionRecord: SessionRecord = {
          id: body.id || `sess_${crypto.randomBytes(6).toString('hex')}`,
          boothId,
          packageId: body.packageId || 'strip',
          packageName: body.packageName || 'Classic Twin Strips',
          compositeUrl: body.compositeUrl || 'https://res.cloudinary.com/quickpic/sim/render.jpg',
          layout: body.layout || 'strip-3',
          payment: body.payment || {
            method: 'cash_bypass',
            amount: 35000,
            transactionId: 'TX_SIM',
            status: 'settled',
          },
          createdAt: new Date().toISOString(),
        };

        db.sessions.push(sessionRecord);
        return sendJson(201, { success: true, sessionId: sessionRecord.id });
      }

      if (method === 'GET') {
        const boothId = url.searchParams.get('boothId');
        const filtered = boothId ? db.sessions.filter((s) => s.boothId === boothId) : db.sessions;
        return sendJson(200, { sessions: filtered });
      }
    }

    // ------------------------------------------------------------------------
    // Route: /api/admin/fleet/analytics (Aggregated Revenue & Health)
    // ------------------------------------------------------------------------
    if (pathname === '/api/admin/fleet/analytics') {
      const boothId = url.searchParams.get('boothId');
      const targetSessions = boothId ? db.sessions.filter((s) => s.boothId === boothId) : db.sessions;

      const totalRevenue = targetSessions.reduce((acc, s) => acc + s.payment.amount, 0);
      const qrisRevenue = targetSessions
        .filter((s) => s.payment.method === 'qris_midtrans')
        .reduce((acc, s) => acc + s.payment.amount, 0);
      const cashRevenue = targetSessions
        .filter((s) => s.payment.method === 'cash_bypass')
        .reduce((acc, s) => acc + s.payment.amount, 0);

      const qrisOrders = targetSessions.filter((s) => s.payment.method === 'qris_midtrans').length;
      const cashOrders = targetSessions.filter((s) => s.payment.method === 'cash_bypass').length;

      // Fleet health
      const allBooths = Array.from(db.booths.values());
      const fleetConsumables = allBooths.map((b) => {
        const latestTel = db.telemetryLogs
          .filter((t) => t.boothId === b.id)
          .sort((a, b) => new Date(b.pingedAt).getTime() - new Date(a.pingedAt).getTime())[0];
        const ribbon = latestTel?.ribbonRemaining ?? 700;
        return {
          boothId: b.id,
          name: b.name,
          ribbonRemaining: ribbon,
          isLowRibbon: ribbon < 100,
          cameraConnected: latestTel?.cameraConnected ?? false,
          printerConnected: latestTel?.printerConnected ?? false,
        };
      });

      return sendJson(200, {
        boothFilter: boothId || 'all',
        sessionCount: targetSessions.length,
        totalRevenue,
        qrisRevenue,
        cashRevenue,
        qrisOrders,
        cashOrders,
        fleetConsumables,
      });
    }

    sendJson(404, { error: 'Route not found' });
  });
}

// ============================================================================
// HTTP Request Helper
// ============================================================================

async function request(
  baseUrl: string,
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  } = {}
): Promise<{ status: number; data: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const bodyStr = options.body ? JSON.stringify(options.body) : undefined;

    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    if (bodyStr) {
      reqHeaders['Content-Length'] = Buffer.byteLength(bodyStr).toString();
    }

    const req = http.request(
      url,
      {
        method: options.method || 'GET',
        headers: reqHeaders,
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = rawData ? JSON.parse(rawData) : {};
            resolve({ status: res.statusCode || 200, data: parsed, headers: res.headers });
          } catch {
            resolve({ status: res.statusCode || 200, data: rawData, headers: res.headers });
          }
        });
      }
    );

    req.on('error', reject);
    if (bodyStr) {
      req.write(bodyStr);
    }
    req.end();
  });
}

// ============================================================================
// Formatting & Logger Helpers
// ============================================================================

const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

function banner(title: string) {
  console.log(`\n${c.cyan}${c.bright}═════════════════════════════════════════════════════════════════════════${c.reset}`);
  console.log(`${c.magenta}${c.bright}  ${title}${c.reset}`);
  console.log(`${c.cyan}${c.bright}═════════════════════════════════════════════════════════════════════════${c.reset}`);
}

function subHeader(title: string) {
  console.log(`\n${c.yellow}${c.bright}─── ${title} ───${c.reset}`);
}

function pass(msg: string) {
  console.log(`  ${c.green}✔ PASS:${c.reset} ${msg}`);
}

function info(msg: string) {
  console.log(`  ${c.cyan}ℹ INFO:${c.reset} ${msg}`);
}

function warn(msg: string) {
  console.log(`  ${c.yellow}⚠ WARN:${c.reset} ${msg}`);
}

// ============================================================================
// Main E2E Multi-Booth Simulation Test Runner
// ============================================================================

async function runMultiBoothSimulation() {
  banner('QUICKPIC MULTI-BOOTH FLEET SIMULATION — PHASE 3 QC VERIFICATION');
  console.log(`${c.dim}Runtime: Node.js (with --experimental-strip-types)${c.reset}`);
  console.log(`${c.dim}Architecture: concept.md & AGENTS.md multi-tenant fleet isolation${c.reset}\n`);

  // Start test simulation server
  const server = createSimulationServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  info(`Simulation test server active on ${c.bright}${baseUrl}${c.reset}`);

  // Test state holding credentials for both stations
  const fleet = {
    station1: {
      id: 'booth-jkt-01',
      name: 'Central Mall Booth',
      location: 'Grand Indonesia Level 3A, Jakarta Pusat',
      pairingPin: '',
      deviceToken: '',
    },
    station2: {
      id: 'booth-sub-02',
      name: 'Surabaya Plaza Booth',
      location: 'Tunjungan Plaza 4 Atrium, Surabaya',
      pairingPin: '',
      deviceToken: '',
    },
  };

  try {
    // ========================================================================
    // TEST 1: 6-Digit PIN Generation & Kiosk Pairing via /api/booths/pair
    // ========================================================================
    subHeader('TEST 1: 6-Digit PIN Generation & Kiosk Pairing (/api/booths/pair)');

    // 1.1 Vendor Dashboard generates pairing code for Station 1
    const genRes1 = await request(baseUrl, '/api/booths/pair', {
      method: 'POST',
      body: {
        action: 'generate',
        boothId: fleet.station1.id,
        boothName: fleet.station1.name,
        location: fleet.station1.location,
        ownerId: 'owner-snapstudio-vip',
      },
    });

    assert.equal(genRes1.status, 200, 'Station 1 PIN generation should return 200');
    assert.equal(genRes1.data.success, true, 'Station 1 PIN generation success flag');
    assert.match(genRes1.data.pairingCode, /^\d{6}$/, 'Station 1 PIN must be exactly 6 digits');
    fleet.station1.pairingPin = genRes1.data.pairingCode;
    pass(`Station 1 (${fleet.station1.id}) PIN generated: ${c.bright}${fleet.station1.pairingPin}${c.reset} (Valid 15m)`);

    // 1.2 Vendor Dashboard generates pairing code for Station 2
    const genRes2 = await request(baseUrl, '/api/booths/pair', {
      method: 'POST',
      body: {
        action: 'generate',
        boothId: fleet.station2.id,
        boothName: fleet.station2.name,
        location: fleet.station2.location,
        ownerId: 'owner-snapstudio-vip',
      },
    });

    assert.equal(genRes2.status, 200, 'Station 2 PIN generation should return 200');
    assert.equal(genRes2.data.success, true, 'Station 2 PIN generation success flag');
    assert.match(genRes2.data.pairingCode, /^\d{6}$/, 'Station 2 PIN must be exactly 6 digits');
    fleet.station2.pairingPin = genRes2.data.pairingCode;
    pass(`Station 2 (${fleet.station2.id}) PIN generated: ${c.bright}${fleet.station2.pairingPin}${c.reset} (Valid 15m)`);

    // 1.3 Negative Test: Attempt pairing with malformed PIN (<6 digits)
    const badPinRes = await request(baseUrl, '/api/booths/pair', {
      method: 'POST',
      body: { action: 'pair', pairingCode: '123' },
    });
    assert.equal(badPinRes.status, 400, 'Malformed PIN must be rejected with 400 Bad Request');
    pass('Negative validation: Malformed 3-digit PIN rejected with 400 (INVALID_FORMAT)');

    // 1.4 Negative Test: Attempt pairing with wrong 6-digit PIN
    const wrongPinRes = await request(baseUrl, '/api/booths/pair', {
      method: 'POST',
      body: { action: 'pair', pairingCode: '999999' },
    });
    assert.equal(wrongPinRes.status, 404, 'Non-existent PIN must return 404 PIN_NOT_FOUND');
    pass('Negative validation: Non-existent PIN rejected with 404 (PIN_NOT_FOUND)');

    // 1.5 Station 1 Kiosk pairs using its 6-digit PIN
    const pairRes1 = await request(baseUrl, '/api/booths/pair', {
      method: 'POST',
      body: {
        action: 'pair',
        boothId: fleet.station1.id,
        pairingCode: fleet.station1.pairingPin,
      },
    });

    assert.equal(pairRes1.status, 200, 'Station 1 pairing should return 200');
    assert.equal(pairRes1.data.success, true, 'Station 1 pairing success');
    assert.ok(pairRes1.data.deviceToken.startsWith('qp_dev_'), 'Station 1 device_token format qp_dev_');
    assert.ok(pairRes1.data.deviceToken.length >= 48, 'Station 1 token cryptographic entropy >= 48 chars');
    fleet.station1.deviceToken = pairRes1.data.deviceToken;
    pass(`Station 1 paired successfully! Device token issued: ${c.dim}${fleet.station1.deviceToken}${c.reset}`);

    // 1.6 Station 2 Kiosk pairs using its 6-digit PIN
    const pairRes2 = await request(baseUrl, '/api/booths/pair', {
      method: 'POST',
      body: {
        action: 'pair',
        boothId: fleet.station2.id,
        pairingCode: fleet.station2.pairingPin,
      },
    });

    assert.equal(pairRes2.status, 200, 'Station 2 pairing should return 200');
    assert.equal(pairRes2.data.success, true, 'Station 2 pairing success');
    assert.ok(pairRes2.data.deviceToken.startsWith('qp_dev_'), 'Station 2 device_token format qp_dev_');
    assert.notEqual(fleet.station1.deviceToken, pairRes2.data.deviceToken, 'Each station must receive unique device tokens');
    fleet.station2.deviceToken = pairRes2.data.deviceToken;
    pass(`Station 2 paired successfully! Device token issued: ${c.dim}${fleet.station2.deviceToken}${c.reset}`);

    // 1.7 Verify Single-Use PIN Replay Attack is prevented
    const replayRes = await request(baseUrl, '/api/booths/pair', {
      method: 'POST',
      body: { action: 'pair', pairingCode: fleet.station1.pairingPin },
    });
    assert.equal(replayRes.status, 404, 'Replayed single-use PIN must be rejected');
    pass('Single-Use Security: Reusing consumed pairing PIN rejected with 404');

    // 1.8 Verify pairing status query via GET /api/booths/pair
    const statusRes1 = await request(baseUrl, `/api/booths/pair?boothId=${fleet.station1.id}`);
    assert.equal(statusRes1.status, 200);
    assert.equal(statusRes1.data.isPaired, true);
    assert.equal(statusRes1.data.status, 'online');
    pass(`GET /api/booths/pair confirms ${fleet.station1.id} is registered ONLINE and paired.`);

    // ========================================================================
    // TEST 2: Hardware Telemetry Heartbeat Ingestion via /api/booths/telemetry
    // ========================================================================
    subHeader('TEST 2: Hardware Telemetry Heartbeat Ingestion & Thresholds');

    // 2.1 Station 1 Heartbeat: Ribbon = 550 cuts, Canon DSLR = online
    const telPayload1 = {
      boothId: fleet.station1.id,
      ribbonRemaining: 550,
      ribbonPercentage: 78.6,
      cameraConnected: true,
      cameraModel: 'Canon EOS R100 (EDSDK USB)',
      printerConnected: true,
      printerName: 'DNP DS-RX1HS',
      queueDepth: 0,
      cpuPct: 15.2,
      ramPct: 38.4,
    };

    const telRes1 = await request(baseUrl, '/api/booths/telemetry', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${fleet.station1.deviceToken}`,
      },
      body: telPayload1,
    });

    assert.equal(telRes1.status, 200, 'Station 1 telemetry ingestion 200 OK');
    assert.equal(telRes1.data.success, true);
    pass(`Station 1 Heartbeat accepted: Ribbon = 550 cuts, Canon DSLR = ONLINE, DNP = ONLINE`);

    // 2.2 Station 2 Heartbeat: Ribbon = 65 cuts (triggers critical low ribbon < 100), Canon DSLR = online
    const telPayload2 = {
      boothId: fleet.station2.id,
      ribbonRemaining: 65, // < 100 threshold
      ribbonPercentage: 9.3,
      cameraConnected: true,
      cameraModel: 'Canon EOS 200D II (EDSDK USB)',
      printerConnected: true,
      printerName: 'DNP DS-RX1HS',
      queueDepth: 2,
      cpuPct: 24.8,
      ramPct: 44.1,
    };

    const telRes2 = await request(baseUrl, '/api/booths/telemetry', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${fleet.station2.deviceToken}`,
      },
      body: telPayload2,
    });

    assert.equal(telRes2.status, 200, 'Station 2 telemetry ingestion 200 OK');
    assert.equal(telRes2.data.success, true);
    pass(`Station 2 Heartbeat accepted: Ribbon = 65 cuts (Low Threshold Active), Canon DSLR = ONLINE`);

    // 2.3 Security Negative Test: Telemetry request without Bearer token
    const noTokenRes = await request(baseUrl, '/api/booths/telemetry', {
      method: 'POST',
      body: { boothId: fleet.station1.id, ribbonRemaining: 500 },
    });
    assert.equal(noTokenRes.status, 401, 'Telemetry without auth token must return 401');
    pass('Security Guard: Unauthenticated telemetry heartbeat rejected (401 Unauthorized)');

    // 2.4 Security Negative Test: Cross-Station Spoofing (Station 1 token posting for Station 2)
    const spoofRes = await request(baseUrl, '/api/booths/telemetry', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${fleet.station1.deviceToken}`, // Station 1 token
      },
      body: {
        boothId: fleet.station2.id, // Station 2 ID (Spoof attempt!)
        ribbonRemaining: 10,
      },
    });
    assert.equal(spoofRes.status, 401, 'Cross-station telemetry spoofing must be rejected');
    pass('Least-Privilege Isolation: Station 1 token CANNOT report telemetry for Station 2 (401)');

    // 2.5 Verify Telemetry State & Ribbon Threshold Detection via GET /api/booths/telemetry
    const getTel1 = await request(baseUrl, `/api/booths/telemetry?boothId=${fleet.station1.id}`);
    assert.equal(getTel1.status, 200);
    assert.equal(getTel1.data.printer.ribbonRemaining, 550, 'Station 1 ribbon count is 550');
    assert.equal(getTel1.data.camera.connected, true, 'Station 1 Canon camera connected');
    const station1IsLowRibbon = getTel1.data.printer.ribbonRemaining < 100;
    assert.equal(station1IsLowRibbon, false, 'Station 1 ribbon 550 should NOT trigger low ribbon alert');
    pass(`Telemetry verified Station 1: Healthy consumable status (${getTel1.data.printer.ribbonRemaining} cuts, Alert: FALSE)`);

    const getTel2 = await request(baseUrl, `/api/booths/telemetry?boothId=${fleet.station2.id}`);
    assert.equal(getTel2.status, 200);
    assert.equal(getTel2.data.printer.ribbonRemaining, 65, 'Station 2 ribbon count is 65');
    assert.equal(getTel2.data.camera.connected, true, 'Station 2 Canon camera connected');
    const station2IsLowRibbon = getTel2.data.printer.ribbonRemaining < 100;
    assert.equal(station2IsLowRibbon, true, 'Station 2 ribbon 65 MUST trigger low ribbon alert (<100)');
    warn(`Telemetry verified Station 2: CRITICAL LOW RIBBON ALERT TRIGGERED (${getTel2.data.printer.ribbonRemaining} cuts < 100 cuts)`);

    // ========================================================================
    // TEST 3: Simulated Guest Sessions (QRIS & Cash Bypass)
    // ========================================================================
    subHeader('TEST 3: Simulated Guest Sessions (QRIS & Staff PIN Bypass)');

    // 3.1 Station 1 - Session 1A: Classic Twin Strips (Rp 35,000) via QRIS
    const sessRes1A = await request(baseUrl, '/api/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${fleet.station1.deviceToken}` },
      body: {
        id: 'sess-jkt-101',
        boothId: fleet.station1.id,
        packageId: 'pkg-standard-strip',
        packageName: 'Classic Twin Strips',
        layout: 'strip-3',
        compositeUrl: 'https://res.cloudinary.com/quickpic/image/upload/sess-jkt-101.jpg',
        payment: {
          method: 'qris_midtrans',
          amount: 35000,
          transactionId: 'QRIS_JKT_TX101',
          status: 'settled',
        },
      },
    });
    assert.equal(sessRes1A.status, 201);
    pass('Station 1 Session 1A captured: "Classic Twin Strips" - Rp 35.000 via Dynamic QRIS (Settled)');

    // 3.2 Station 1 - Session 1B: VIP Live Photo (Rp 55,000) via QRIS
    const sessRes1B = await request(baseUrl, '/api/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${fleet.station1.deviceToken}` },
      body: {
        id: 'sess-jkt-102',
        boothId: fleet.station1.id,
        packageId: 'pkg-vip-livephoto',
        packageName: 'VIP Live Photo + Quad Strips',
        layout: 'strip-4',
        compositeUrl: 'https://res.cloudinary.com/quickpic/image/upload/sess-jkt-102.jpg',
        payment: {
          method: 'qris_midtrans',
          amount: 55000,
          transactionId: 'QRIS_JKT_TX102',
          status: 'settled',
        },
      },
    });
    assert.equal(sessRes1B.status, 201);
    pass('Station 1 Session 1B captured: "VIP Live Photo" - Rp 55.000 via Dynamic QRIS (Settled)');

    // 3.3 Station 2 - Session 2A: 4R Polaroid Vintage (Rp 40,000) via Cash Bypass (Staff PIN 1144)
    const sessRes2A = await request(baseUrl, '/api/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${fleet.station2.deviceToken}` },
      body: {
        id: 'sess-sub-201',
        boothId: fleet.station2.id,
        packageId: 'pkg-4r-polaroid',
        packageName: '4R Polaroid Vintage',
        layout: 'grid-2x2',
        compositeUrl: 'https://res.cloudinary.com/quickpic/image/upload/sess-sub-201.jpg',
        payment: {
          method: 'cash_bypass',
          amount: 40000,
          transactionId: 'CASH_SUB_TX201',
          status: 'bypassed',
          staffBypassPinUsed: true,
        },
      },
    });
    assert.equal(sessRes2A.status, 201);
    pass('Station 2 Session 2A captured: "4R Polaroid Vintage" - Rp 40.000 via Cash / Staff PIN 1144');

    // 3.4 Station 2 - Session 2B: Classic Twin Strips (Rp 35,000) via QRIS
    const sessRes2B = await request(baseUrl, '/api/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${fleet.station2.deviceToken}` },
      body: {
        id: 'sess-sub-202',
        boothId: fleet.station2.id,
        packageId: 'pkg-standard-strip',
        packageName: 'Classic Twin Strips',
        layout: 'strip-3',
        compositeUrl: 'https://res.cloudinary.com/quickpic/image/upload/sess-sub-202.jpg',
        payment: {
          method: 'qris_midtrans',
          amount: 35000,
          transactionId: 'QRIS_SUB_TX202',
          status: 'settled',
        },
      },
    });
    assert.equal(sessRes2B.status, 201);
    pass('Station 2 Session 2B captured: "Classic Twin Strips" - Rp 35.000 via Dynamic QRIS (Settled)');

    // ========================================================================
    // TEST 4: Aggregated Revenue Calculation & Fleet Booth Isolation
    // ========================================================================
    subHeader('TEST 4: Fleet Aggregated Revenue & Station Isolation Audit');

    // 4.1 Query Station 1 isolated analytics
    const jktStatsRes = await request(baseUrl, `/api/admin/fleet/analytics?boothId=${fleet.station1.id}`);
    assert.equal(jktStatsRes.status, 200);
    assert.equal(jktStatsRes.data.sessionCount, 2, 'Station 1 session count');
    assert.equal(jktStatsRes.data.totalRevenue, 90000, 'Station 1 revenue = 35k + 55k = 90k');
    assert.equal(jktStatsRes.data.qrisRevenue, 90000, 'Station 1 QRIS revenue = 90k');
    assert.equal(jktStatsRes.data.cashRevenue, 0, 'Station 1 cash revenue = 0');
    pass(`Station 1 Isolated Revenue: Rp 90.000 (2 sessions, 100% QRIS)`);

    // 4.2 Query Station 2 isolated analytics
    const subStatsRes = await request(baseUrl, `/api/admin/fleet/analytics?boothId=${fleet.station2.id}`);
    assert.equal(subStatsRes.status, 200);
    assert.equal(subStatsRes.data.sessionCount, 2, 'Station 2 session count');
    assert.equal(subStatsRes.data.totalRevenue, 75000, 'Station 2 revenue = 40k + 35k = 75k');
    assert.equal(subStatsRes.data.qrisRevenue, 35000, 'Station 2 QRIS revenue = 35k');
    assert.equal(subStatsRes.data.cashRevenue, 40000, 'Station 2 Cash revenue = 40k');
    pass(`Station 2 Isolated Revenue: Rp 75.000 (2 sessions, Rp 40.000 Cash / Rp 35.000 QRIS)`);

    // 4.3 Query Consolidated Fleet-Wide Analytics
    const fleetStatsRes = await request(baseUrl, `/api/admin/fleet/analytics`);
    assert.equal(fleetStatsRes.status, 200);
    assert.equal(fleetStatsRes.data.sessionCount, 4, 'Fleet session count = 4');
    assert.equal(fleetStatsRes.data.totalRevenue, 165000, 'Fleet revenue = 90k + 75k = Rp 165.000');
    assert.equal(fleetStatsRes.data.qrisRevenue, 125000, 'Fleet QRIS = Rp 125.000');
    assert.equal(fleetStatsRes.data.cashRevenue, 40000, 'Fleet Cash = Rp 40.000');
    assert.equal(fleetStatsRes.data.qrisOrders, 3, 'Fleet QRIS orders = 3');
    assert.equal(fleetStatsRes.data.cashOrders, 1, 'Fleet Cash orders = 1');
    pass(`Consolidated Fleet Revenue: Rp 165.000 across 4 guest transactions`);

    // 4.4 Data Isolation Strictness Audit: Verify Station 1 sessions never leak into Station 2
    const jktSessionsRes = await request(baseUrl, `/api/sessions?boothId=${fleet.station1.id}`);
    const jktSessionIds = jktSessionsRes.data.sessions.map((s: any) => s.id);
    assert.deepEqual(jktSessionIds.sort(), ['sess-jkt-101', 'sess-jkt-102'].sort());
    assert.ok(!jktSessionIds.includes('sess-sub-201'), 'Zero Station 2 leakage in Station 1 feed');
    assert.ok(!jktSessionIds.includes('sess-sub-202'), 'Zero Station 2 leakage in Station 1 feed');
    pass('Data Isolation Audit: Station 1 query returns ONLY Station 1 sessions (Zero cross-leakage)');

    const subSessionsRes = await request(baseUrl, `/api/sessions?boothId=${fleet.station2.id}`);
    const subSessionIds = subSessionsRes.data.sessions.map((s: any) => s.id);
    assert.deepEqual(subSessionIds.sort(), ['sess-sub-201', 'sess-sub-202'].sort());
    assert.ok(!subSessionIds.includes('sess-jkt-101'), 'Zero Station 1 leakage in Station 2 feed');
    assert.ok(!subSessionIds.includes('sess-jkt-102'), 'Zero Station 1 leakage in Station 2 feed');
    pass('Data Isolation Audit: Station 2 query returns ONLY Station 2 sessions (Zero cross-leakage)');

    // 4.5 Consumables Fleet Overview
    const consumables = fleetStatsRes.data.fleetConsumables;
    const jktConsumable = consumables.find((c: any) => c.boothId === fleet.station1.id);
    const subConsumable = consumables.find((c: any) => c.boothId === fleet.station2.id);

    assert.equal(jktConsumable.ribbonRemaining, 550);
    assert.equal(jktConsumable.isLowRibbon, false);
    assert.equal(subConsumable.ribbonRemaining, 65);
    assert.equal(subConsumable.isLowRibbon, true);
    pass('Fleet Consumables: Station 1 is Healthy (550 cuts); Station 2 Alert Active (65 cuts < 100)');

    // ========================================================================
    // FINAL AUDIT SUMMARY TABLE
    // ========================================================================
    banner('PHASE 3 E2E SIMULATION VERIFICATION RESULTS — SUMMARY MATRIX');
    console.log(`
┌───────────────────────┬────────────────────────────┬────────────────────────────┐
│ Metric / Criterion    │ Station 1 (booth-jkt-01)   │ Station 2 (booth-sub-02)   │
├───────────────────────┼────────────────────────────┼────────────────────────────┤
│ Station Name          │ Central Mall Booth         │ Surabaya Plaza Booth       │
│ Venue Location        │ Grand Indonesia Fl. 3A     │ Tunjungan Plaza 4 Atrium   │
│ Pairing PIN           │ ${fleet.station1.pairingPin}                     │ ${fleet.station2.pairingPin}                     │
│ Device Token Prefix   │ ${fleet.station1.deviceToken.slice(0, 16)}...        │ ${fleet.station2.deviceToken.slice(0, 16)}...        │
│ Heartbeat Status      │ ONLINE                     │ ONLINE                     │
│ Canon DSLR Camera     │ ONLINE (EOS R100)          │ ONLINE (EOS 200D II)       │
│ DNP Ribbon Remaining  │ 550 cuts (78.6%)           │ 65 cuts (9.3%)             │
│ Low Ribbon Warning    │ NORMAL                     │ CRITICAL (< 100 cuts)      │
│ Sessions Processed    │ 2 sessions                 │ 2 sessions                 │
│ Session IDs           │ sess-jkt-101, sess-jkt-102 │ sess-sub-201, sess-sub-202 │
│ Dynamic QRIS Revenue  │ Rp 90.000 (2 tx)           │ Rp 35.000 (1 tx)           │
│ Cash / Staff PIN Rev  │ Rp 0 (0 tx)                │ Rp 40.000 (1 tx, PIN 1144) │
│ Station Gross Revenue │ Rp 90.000                  │ Rp 75.000                  │
│ Tenant Data Isolation │ VERIFIED STRICT            │ VERIFIED STRICT            │
└───────────────────────┴────────────────────────────┴────────────────────────────┘

${c.green}${c.bright}★ FLEET TOTAL AUDITED REVENUE: Rp 165.000 (4 Sessions: 3 QRIS + 1 Cash)${c.reset}
${c.green}${c.bright}★ ALL 4 SIMULATION TEST SUITES COMPLETED WITH 100% PASS RATE${c.reset}
`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    info('Simulation test server gracefully terminated.');
  }
}

// Execute Runner
runMultiBoothSimulation().catch((err) => {
  console.error(`\n${c.red}${c.bright}✖ SIMULATION RUNNER FAILED:${c.reset}`, err);
  process.exit(1);
});
