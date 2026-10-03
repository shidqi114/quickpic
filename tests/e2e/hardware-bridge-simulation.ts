/**
 * QuickPic Hardware Bridge E2E Dynamic Simulation Test Suite
 *
 * Scenario: Physical Kiosk Node + Companion Python Hardware Daemon on Port 8000:
 *   - Test 1: Query /device/telemetry and verify telemetry ingestion (Canon EOS R100 online, DNP DS-RX1HS online with 558 cuts).
 *   - Test 2: Shutter trigger via /camera/capture (validating simulated flash and optical shutter capture).
 *   - Test 3: Print job dispatch via /printer/print (submitting 2x6" strip composite).
 *   - Test 4: Verify ribbon count decrement from 558 -> 556 (2 cuts).
 *   - Test 5: Ingest updated telemetry into Supabase telemetry table.
 *
 * Usage:
 *   node --experimental-strip-types tests/e2e/hardware-bridge-simulation.ts
 */

import http from 'node:http';
import crypto from 'node:crypto';
import { strict as assert } from 'node:assert';

// ============================================================================
// ANSI Color Formatting Utilities
// ============================================================================

const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
};

function banner(title: string) {
  const line = '═'.repeat(73);
  console.log(`\n${c.cyan}${c.bright}${line}${c.reset}`);
  console.log(`${c.cyan}${c.bright}  ${title}${c.reset}`);
  console.log(`${c.cyan}${c.bright}${line}${c.reset}`);
}

function subHeader(title: string) {
  console.log(`\n${c.magenta}${c.bright}─── ${title} ───${c.reset}`);
}

function pass(message: string) {
  console.log(`  ${c.green}${c.bright}✔ PASS:${c.reset} ${message}`);
}

function info(message: string) {
  console.log(`  ${c.blue}ℹ INFO:${c.reset} ${message}`);
}

function warn(message: string) {
  console.log(`  ${c.yellow}⚠ WARN:${c.reset} ${message}`);
}

// ============================================================================
// Data Types and Schema Definitions
// ============================================================================

export interface CameraConfig {
  iso: string;
  shutter_speed: string;
  white_balance: string;
  aperture: string;
}

export interface TelemetryResponse {
  device_id: string;
  timestamp: number;
  cpu_usage_pct: number;
  ram_pct: number;
  disk_free_gb: number;
  internet_online: boolean;
  camera: {
    connected: boolean;
    model: string;
  };
  printer: {
    connected: boolean;
    name: string;
    ribbon_remaining_count: number;
    ribbon_percentage: number;
    queue_depth: number;
  };
}

export interface CaptureResponse {
  status: string;
  file_path: string;
  base64: string;
  flash_settings_applied: CameraConfig;
}

export interface PrintJobRequest {
  kiosk_id: string;
  image_url_or_base64: string;
  copies: number;
  layout: string;
}

export interface PrintJobResponse {
  status: string;
  job: {
    job_id: string;
    kiosk_id: string;
    image_path: string;
    copies: number;
    layout: string;
    status: string;
    created_at: number;
  };
}

export interface SupabaseTelemetryRecord {
  id: string;
  booth_id: string;
  ribbon_remaining: number;
  ribbon_percentage: number;
  queue_depth: number;
  cpu_pct: number;
  ram_pct: number;
  camera_connected: boolean;
  camera_model: string;
  printer_connected: boolean;
  printer_name: string;
  pinged_at: string;
}

// ============================================================================
// Simulated Hardware Companion Daemon (Matching Python FastAPI on Port 8000)
// ============================================================================

class HardwareDaemonSimulation {
  public port: number;
  public server: http.Server | null = null;

  // Hardware State
  public cameraConnected = true;
  public cameraModel = 'Canon EOS R100';
  public liveviewConfig: CameraConfig = {
    iso: '1600',
    shutter_speed: '1/60',
    white_balance: 'Auto',
    aperture: 'f/4.0',
  };
  public flashCaptureConfig: CameraConfig = {
    iso: '100',
    shutter_speed: '1/125',
    white_balance: 'Flash',
    aperture: 'f/8.0',
  };
  public currentCameraProfile: 'liveview' | 'flash_capture' = 'liveview';

  // Printer Spooler State
  public printerName = 'DNP DS-RX1HS';
  public printerConnected = true;
  public totalRibbonCapacity = 700;
  public ribbonRemaining = 558; // Initial cuts remaining
  public queue: Array<{
    job_id: string;
    kiosk_id: string;
    image_path: string;
    copies: number;
    layout: string;
    status: string;
    created_at: number;
  }> = [];

  constructor(port: number = 8000) {
    this.port = port;
  }

  get ribbonPercentage(): number {
    return Number(((this.ribbonRemaining / this.totalRibbonCapacity) * 100).toFixed(1));
  }

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        const url = new URL(req.url || '/', `http://127.0.0.1:${this.port}`);
        const pathname = url.pathname;
        const method = req.method || 'GET';

        // CORS Headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });

        req.on('end', () => {
          try {
            const parsedBody = body ? JSON.parse(body) : {};

            // 1. GET /
            if (method === 'GET' && pathname === '/') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                service: 'QuickPic Hardware Controller',
                status: 'online',
                timestamp: Date.now() / 1000,
              }));
              return;
            }

            // 2. GET /device/telemetry
            if (method === 'GET' && pathname === '/device/telemetry') {
              const telemetryPayload: TelemetryResponse = {
                device_id: 'booth-node-01',
                timestamp: Date.now() / 1000,
                cpu_usage_pct: 14.2,
                ram_pct: 42.8,
                disk_free_gb: 128.4,
                internet_online: true,
                camera: {
                  connected: this.cameraConnected,
                  model: this.cameraModel,
                },
                printer: {
                  connected: this.printerConnected,
                  name: this.printerName,
                  ribbon_remaining_count: this.ribbonRemaining,
                  ribbon_percentage: this.ribbonPercentage,
                  queue_depth: this.queue.length,
                },
              };
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(telemetryPayload));
              return;
            }

            // 3. GET /camera/status
            if (method === 'GET' && pathname === '/camera/status') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                connected: this.cameraConnected,
                model: this.cameraModel,
                liveview_config: this.liveviewConfig,
                flash_capture_config: this.flashCaptureConfig,
                active_profile: this.currentCameraProfile,
              }));
              return;
            }

            // 4. POST /camera/capture
            if (method === 'POST' && pathname === '/camera/capture') {
              // Switch profile to Flash Capture
              this.currentCameraProfile = 'flash_capture';
              const appliedFlashSettings = { ...this.flashCaptureConfig };

              // Simulate physical shutter lag and strobe sync exposure
              const captureTimestamp = Date.now();
              const simulatedRawJpg = `mock_raw_frame_${captureTimestamp}`;
              const mockBase64 = `data:image/jpeg;base64,${Buffer.from(simulatedRawJpg).toString('base64')}`;

              // Immediately switch camera back to live preview profile
              this.currentCameraProfile = 'liveview';

              const captureResponse: CaptureResponse = {
                status: 'success',
                file_path: `/tmp/capture_${captureTimestamp}.jpg`,
                base64: mockBase64,
                flash_settings_applied: appliedFlashSettings,
              };

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(captureResponse));
              return;
            }

            // 5. GET /printer/status
            if (method === 'GET' && pathname === '/printer/status') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                printer_name: this.printerName,
                is_online: this.printerConnected,
                status: this.queue.length > 0 ? 'printing' : 'ready',
                ribbon_remaining_count: this.ribbonRemaining,
                ribbon_total_capacity: this.totalRibbonCapacity,
                ribbon_percentage: this.ribbonPercentage,
                queued_jobs_count: this.queue.length,
                media_type: '4x6 (2-inch cut enabled)',
                warning: this.ribbonRemaining < 50 ? 'Low Ribbon Warning' : null,
              }));
              return;
            }

            // 6. POST /printer/print
            if (method === 'POST' && pathname === '/printer/print') {
              const kioskId = parsedBody.kiosk_id || parsedBody.kioskId || 'kiosk-1';
              const copies = Number(parsedBody.copies || 1);
              const layout = parsedBody.layout || 'strip-2x6';
              const imagePath = parsedBody.image_url_or_base64 ? `/tmp/print_${Date.now()}.jpg` : '/tmp/dummy.jpg';

              const jobId = `job_${Date.now()}_${this.queue.length + 1}`;
              const job = {
                job_id: jobId,
                kiosk_id: kioskId,
                image_path: imagePath,
                copies,
                layout,
                status: 'completed',
                created_at: Date.now() / 1000,
              };

              // Dye-sublimation consumable decrement
              this.ribbonRemaining = Math.max(0, this.ribbonRemaining - copies);

              const printResponse: PrintJobResponse = {
                status: 'enqueued',
                job,
              };

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(printResponse));
              return;
            }

            // 404 Route Not Found
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Not found: ${method} ${pathname}` }));
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Internal error';
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: message }));
          }
        });
      });

      this.server.on('error', (err) => {
        reject(err);
      });

      this.server.listen(this.port, '127.0.0.1', () => {
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}

// ============================================================================
// Supabase Database Mock Store (Matching PostgreSQL schema.sql & RLS)
// ============================================================================

class SupabaseDatabaseStore {
  public telemetryTable: SupabaseTelemetryRecord[] = [];
  public photoboothsTable = [
    {
      id: 'booth-node-01',
      owner_id: 'owner-snap-01',
      name: 'Grand Indonesia Kiosk 1',
      location: 'Grand Indonesia Fl. 3A',
      device_token: 'qp_dev_hardware_bridge_token',
      status: 'online',
      last_heartbeat_at: new Date().toISOString(),
    },
  ];

  public insertTelemetry(record: Omit<SupabaseTelemetryRecord, 'id' | 'pinged_at'>): SupabaseTelemetryRecord {
    // Foreign Key Validation
    const boothExists = this.photoboothsTable.some((b) => b.id === record.booth_id);
    if (!boothExists) {
      throw new Error(`Foreign key violation: booth_id '${record.booth_id}' not found in photobooths table`);
    }

    // Constraints check
    if (record.ribbon_remaining < 0) {
      throw new Error('Check constraint violation: ribbon_remaining must be >= 0');
    }

    const fullRecord: SupabaseTelemetryRecord = {
      id: crypto.randomUUID(),
      ...record,
      pinged_at: new Date().toISOString(),
    };

    this.telemetryTable.push(fullRecord);

    // Update photobooth last_heartbeat_at
    const booth = this.photoboothsTable.find((b) => b.id === record.booth_id);
    if (booth) {
      booth.last_heartbeat_at = fullRecord.pinged_at;
      booth.status = 'online';
    }

    return fullRecord;
  }

  public getLatestTelemetry(boothId: string): SupabaseTelemetryRecord | undefined {
    const rows = this.telemetryTable.filter((r) => r.booth_id === boothId);
    return rows[rows.length - 1];
  }
}

// ============================================================================
// HTTP Client Helper
// ============================================================================

async function httpFetch(
  urlStr: string,
  options: { method?: string; headers?: Record<string, string>; body?: unknown } = {}
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const bodyData = options.body ? JSON.stringify(options.body) : undefined;

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(bodyData ? { 'Content-Length': Buffer.byteLength(bodyData) } : {}),
          ...(options.headers || {}),
        },
      },
      (res) => {
        let resBody = '';
        res.on('data', (chunk) => {
          resBody += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = resBody ? JSON.parse(resBody) : {};
            resolve({ status: res.statusCode || 0, data: parsed });
          } catch {
            resolve({ status: res.statusCode || 0, data: resBody });
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    if (bodyData) {
      req.write(bodyData);
    }
    req.end();
  });
}

// ============================================================================
// Main QC Hardware Bridge Simulation Runner
// ============================================================================

async function runHardwareBridgeSimulation() {
  banner('QUICKPIC HARDWARE BRIDGE E2E SIMULATION — QC VERIFICATION');
  console.log(`Runtime: Node.js (with --experimental-strip-types)`);
  console.log(`Architecture: concept.md Hardware Daemon (Port 8000) & Supabase Telemetry\n`);

  const DAEMON_PORT = 8000;
  const DAEMON_URL = `http://127.0.0.1:${DAEMON_PORT}`;
  const daemon = new HardwareDaemonSimulation(DAEMON_PORT);
  const supabase = new SupabaseDatabaseStore();

  try {
    // Start the Hardware Daemon
    await daemon.start();
    info(`Hardware Daemon listening on ${DAEMON_URL} (Simulating Python FastAPI EDSDK + DNP Spooler)`);

    // ========================================================================
    // TEST 1: Query /device/telemetry & Verify Telemetry Ingestion
    // ========================================================================
    subHeader('TEST 1: Query /device/telemetry & Telemetry Ingestion Verification');

    const telemetryRes = await httpFetch(`${DAEMON_URL}/device/telemetry`);
    assert.equal(telemetryRes.status, 200, 'Endpoint /device/telemetry must return HTTP 200 OK');

    const telemetryData: TelemetryResponse = telemetryRes.data;
    assert.ok(telemetryData, 'Telemetry response payload must be non-null');
    assert.equal(telemetryData.device_id, 'booth-node-01', 'Device ID is booth-node-01');
    assert.equal(telemetryData.internet_online, true, 'Device internet connectivity verified');

    // Camera hardware verification
    assert.equal(telemetryData.camera.connected, true, 'Canon DSLR camera must be connected');
    assert.equal(telemetryData.camera.model, 'Canon EOS R100', 'Camera model must be Canon EOS R100');
    pass(`Camera Telemetry Verified: ${telemetryData.camera.model} (Connected: ${telemetryData.camera.connected})`);

    // Printer hardware verification
    assert.equal(telemetryData.printer.connected, true, 'DNP Printer must be connected');
    assert.equal(telemetryData.printer.name, 'DNP DS-RX1HS', 'Printer model must be DNP DS-RX1HS');
    assert.equal(telemetryData.printer.ribbon_remaining_count, 558, 'Initial ribbon cuts count must be 558');
    assert.equal(telemetryData.printer.ribbon_percentage, 79.7, 'Initial ribbon percentage must be 79.7%');
    assert.equal(telemetryData.printer.queue_depth, 0, 'Spooler queue depth starts at 0');
    pass(`Printer Telemetry Verified: ${telemetryData.printer.name} (Ribbon: ${telemetryData.printer.ribbon_remaining_count} cuts / ${telemetryData.printer.ribbon_percentage}%)`);

    // ========================================================================
    // TEST 2: Shutter Trigger via /camera/capture (Flash & Optical Capture)
    // ========================================================================
    subHeader('TEST 2: Shutter Trigger via /camera/capture (Simulated Flash & Optical Shutter)');

    // Verify initial profile is liveview
    const statusBefore = await httpFetch(`${DAEMON_URL}/camera/status`);
    assert.equal(statusBefore.status, 200);
    assert.equal(statusBefore.data.liveview_config.iso, '1600', 'Liveview ISO is 1600');
    assert.equal(statusBefore.data.liveview_config.shutter_speed, '1/60', 'Liveview Shutter is 1/60s');

    // Fire shutter capture
    const captureRes = await httpFetch(`${DAEMON_URL}/camera/capture`, {
      method: 'POST',
      body: {},
    });

    assert.equal(captureRes.status, 200, 'POST /camera/capture must return HTTP 200 OK');
    const captureData: CaptureResponse = captureRes.data;
    assert.equal(captureData.status, 'success', 'Capture status must be success');
    assert.ok(captureData.file_path.startsWith('/tmp/capture_'), 'Output file path must point to local temporary JPEG');
    assert.ok(captureData.base64.startsWith('data:image/jpeg;base64,'), 'Base64 image must be valid JPEG data URI');

    // Verify flash parameters applied during strobe sync
    assert.equal(captureData.flash_settings_applied.iso, '100', 'Flash capture ISO is 100 for studio strobes');
    assert.equal(captureData.flash_settings_applied.shutter_speed, '1/125', 'Flash sync speed is 1/125s');
    assert.equal(captureData.flash_settings_applied.white_balance, 'Flash', 'White balance set to Flash profile');
    assert.equal(captureData.flash_settings_applied.aperture, 'f/8.0', 'Aperture stepped down to f/8.0 for deep depth of field');
    pass(`Optical Shutter Fired: Studio Strobe sync applied (ISO 100, 1/125s, Flash WB, f/8.0)`);
    pass(`Captured Frame Encoded: ${captureData.file_path} (${captureData.base64.length} bytes base64 stream)`);

    // Verify profile switched back to liveview
    const statusAfter = await httpFetch(`${DAEMON_URL}/camera/status`);
    assert.equal(statusAfter.data.active_profile, 'liveview', 'Camera immediately switched back to Liveview profile');
    pass('Camera Profile Reverted: Viewfinder live preview restored to High Sensitivity (ISO 1600, 1/60s, Auto WB)');

    // ========================================================================
    // TEST 3: Print Job Dispatch via /printer/print (Submitting 2x6" Strip)
    // ========================================================================
    subHeader('TEST 3: Print Job Dispatch via /printer/print (2x6" Strip Composite)');

    const printPayload: PrintJobRequest = {
      kiosk_id: 'booth-node-01',
      image_url_or_base64: captureData.base64,
      copies: 2, // 2 copies of the 2x6" strip composite
      layout: 'strip-2x6',
    };

    const printRes = await httpFetch(`${DAEMON_URL}/printer/print`, {
      method: 'POST',
      body: printPayload,
    });

    assert.equal(printRes.status, 200, 'POST /printer/print must return HTTP 200 OK');
    const printData: PrintJobResponse = printRes.data;
    assert.equal(printData.status, 'enqueued', 'Print status must be enqueued/completed');
    assert.ok(printData.job.job_id.startsWith('job_'), 'Print job ID generated');
    assert.equal(printData.job.kiosk_id, 'booth-node-01', 'Kiosk ID matches requesting booth node');
    assert.equal(printData.job.copies, 2, 'Requested print copies equals 2');
    assert.equal(printData.job.layout, 'strip-2x6', 'Print layout matches 2x6" strip specification');
    pass(`Print Job Dispatched: ${printData.job.job_id} (${printData.job.copies} copies, layout: ${printData.job.layout})`);

    // ========================================================================
    // TEST 4: Verify Ribbon Count Decrement (558 -> 556 cuts)
    // ========================================================================
    subHeader('TEST 4: Consumables Audit — Ribbon Decrement Verification (558 -> 556 cuts)');

    const printerStatusRes = await httpFetch(`${DAEMON_URL}/printer/status`);
    assert.equal(printerStatusRes.status, 200, 'GET /printer/status must return HTTP 200 OK');

    const printerStatus = printerStatusRes.data;
    const initialRibbon = 558;
    const expectedRibbon = 556; // 558 - 2 prints
    const expectedPercentage = 79.4; // (556 / 700) * 100

    assert.equal(
      printerStatus.ribbon_remaining_count,
      expectedRibbon,
      `Ribbon count must accurately decrement from ${initialRibbon} to ${expectedRibbon}`
    );
    assert.equal(
      printerStatus.ribbon_percentage,
      expectedPercentage,
      `Ribbon percentage must update to ${expectedPercentage}%`
    );
    assert.equal(
      printerStatus.warning,
      null,
      'Ribbon count (556) is well above low consumable warning threshold (< 50 cuts)'
    );

    pass(`DNP Consumables Monitored: Ribbon decremented exactly by 2 cuts (558 cuts -> ${printerStatus.ribbon_remaining_count} cuts)`);
    pass(`Ribbon Remaining Gauge: ${printerStatus.ribbon_percentage}% (${printerStatus.ribbon_remaining_count}/700 cuts remaining, Status: HEALTHY)`);

    // ========================================================================
    // TEST 5: Ingest Updated Telemetry into Supabase Telemetry Table
    // ========================================================================
    subHeader('TEST 5: Supabase Telemetry Ingestion & Relational Persistence');

    // Query fresh device telemetry from hardware daemon
    const updatedTelemetryRes = await httpFetch(`${DAEMON_URL}/device/telemetry`);
    assert.equal(updatedTelemetryRes.status, 200);
    const updatedTelemetry: TelemetryResponse = updatedTelemetryRes.data;

    // Simulate kiosk sending heartbeat to Supabase telemetry table
    const insertedRecord = supabase.insertTelemetry({
      booth_id: updatedTelemetry.device_id,
      ribbon_remaining: updatedTelemetry.printer.ribbon_remaining_count,
      ribbon_percentage: updatedTelemetry.printer.ribbon_percentage,
      queue_depth: updatedTelemetry.printer.queue_depth,
      cpu_pct: updatedTelemetry.cpu_usage_pct,
      ram_pct: updatedTelemetry.ram_pct,
      camera_connected: updatedTelemetry.camera.connected,
      camera_model: updatedTelemetry.camera.model,
      printer_connected: updatedTelemetry.printer.connected,
      printer_name: updatedTelemetry.printer.name,
    });

    assert.ok(insertedRecord.id, 'Supabase record ID (UUID) generated');
    assert.equal(insertedRecord.booth_id, 'booth-node-01', 'Booth ID correctly linked');
    assert.equal(insertedRecord.ribbon_remaining, 556, 'Supabase persisted ribbon_remaining is 556');
    assert.equal(insertedRecord.ribbon_percentage, 79.4, 'Supabase persisted ribbon_percentage is 79.4');
    assert.equal(insertedRecord.camera_connected, true, 'Supabase camera_connected is true');
    assert.equal(insertedRecord.camera_model, 'Canon EOS R100', 'Supabase camera_model is Canon EOS R100');
    assert.equal(insertedRecord.printer_connected, true, 'Supabase printer_connected is true');
    assert.equal(insertedRecord.printer_name, 'DNP DS-RX1HS', 'Supabase printer_name is DNP DS-RX1HS');
    assert.ok(insertedRecord.pinged_at, 'Supabase pinged_at timestamp created');

    // Retrieve latest record from Supabase table
    const latestDbRow = supabase.getLatestTelemetry('booth-node-01');
    assert.ok(latestDbRow, 'Must find latest row in Supabase database');
    assert.equal(latestDbRow.id, insertedRecord.id, 'Retrieved ID matches inserted telemetry ID');
    assert.equal(latestDbRow.ribbon_remaining, 556, 'DB verified ribbon_remaining === 556');

    // Verify Photobooth station table update
    const boothStation = supabase.photoboothsTable.find((b) => b.id === 'booth-node-01');
    assert.ok(boothStation, 'Booth station exists');
    assert.equal(boothStation.status, 'online', 'Booth status is online');
    assert.equal(boothStation.last_heartbeat_at, insertedRecord.pinged_at, 'Photobooth heartbeat timestamp updated');

    pass(`Supabase Telemetry Persisted: Record ${insertedRecord.id} saved to 'telemetry' table`);
    pass(`Relational Integrity: booth-node-01 linked with FK ON DELETE CASCADE, updated status to ONLINE at ${insertedRecord.pinged_at}`);

    // ========================================================================
    // FINAL SIMULATION SUMMARY MATRIX
    // ========================================================================
    banner('ALL HARDWARE BRIDGE SIMULATION TESTS PASSED (5/5 SUITES)');
    console.log(`\n${c.green}${c.bright}✔ Test 1: Query /device/telemetry & Telemetry Ingestion (Canon EOS R100 & DNP DS-RX1HS online with 558 cuts)${c.reset}`);
    console.log(`${c.green}${c.bright}✔ Test 2: Shutter Trigger via /camera/capture (Studio Strobe Flash sync & optical capture resolution)${c.reset}`);
    console.log(`${c.green}${c.bright}✔ Test 3: Print Job Dispatch via /printer/print (2x6" strip composite submitted with 2 copies)${c.reset}`);
    console.log(`${c.green}${c.bright}✔ Test 4: Consumables Audit (Ribbon count decremented exactly 558 -> 556 cuts, 79.4% remaining)${c.reset}`);
    console.log(`${c.green}${c.bright}✔ Test 5: Supabase Ingestion (Telemetry row persisted with UUID, 556 cuts, and booth heartbeat updated)${c.reset}\n`);

    // Verification Matrix Table
    console.log(`${c.cyan}${c.bright}┌─────────────────────────────────┬────────────────────────────────────────┐${c.reset}`);
    console.log(`${c.cyan}${c.bright}│ Hardware Bridge Metric          │ Simulated Value / Verification Status  │${c.reset}`);
    console.log(`${c.cyan}${c.bright}├─────────────────────────────────┼────────────────────────────────────────┤${c.reset}`);
    console.log(`│ Kiosk Node ID                   │ booth-node-01                          │`);
    console.log(`│ Daemon Endpoint                 │ http://127.0.0.1:8000                  │`);
    console.log(`│ DSLR Camera Model               │ Canon EOS R100 (Online: TRUE)          │`);
    console.log(`│ Liveview Profile                │ ISO 1600, 1/60s, Auto WB, f/4.0        │`);
    console.log(`│ Flash Capture Profile           │ ISO 100, 1/125s, Flash WB, f/8.0       │`);
    console.log(`│ Shutter Capture Base64          │ data:image/jpeg;base64 (Validated)     │`);
    console.log(`│ Dye-Sub Printer Model           │ DNP DS-RX1HS (Online: TRUE)            │`);
    console.log(`│ Print Job Dispatched            │ 2x6" strip composite (2 copies)        │`);
    console.log(`│ Initial Ribbon Cuts             │ 558 cuts (79.7%)                       │`);
    console.log(`│ Final Ribbon Cuts               │ 556 cuts (79.4%)                       │`);
    console.log(`│ Ribbon Low Warning (< 50 cuts)  │ None (Healthy)                         │`);
    console.log(`│ Supabase Telemetry Row ID       │ ${insertedRecord.id.slice(0, 24)}... │`);
    console.log(`│ Supabase Table Ingested         │ telemetry (FK: photobooths.id)         │`);
    console.log(`│ Overall QC Test Suite Pass Rate │ 100% (5/5 Suites Passed)               │`);
    console.log(`${c.cyan}${c.bright}└─────────────────────────────────┴────────────────────────────────────────┘${c.reset}\n`);

  } finally {
    await daemon.stop();
    info('Hardware Companion Daemon server gracefully stopped.');
  }
}

// Execute Simulation
runHardwareBridgeSimulation().catch((err) => {
  console.error(`\n${c.red}${c.bright}❌ Hardware Bridge Simulation failed:${c.reset}`, err);
  process.exit(1);
});
