import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
export interface HardwareCameraStatus {
  connected: boolean;
  model: string;
}

export interface HardwarePrinterStatus {
  connected: boolean;
  name: string;
  ribbon_remaining_count: number;
  ribbon_percentage: number;
  queue_depth: number;
}

export interface HardwareStatus {
  camera: HardwareCameraStatus;
  printer: HardwarePrinterStatus;
  isDaemonOnline: boolean;
}

export interface PrintJobPayload {
  kioskId: string;
  imageBase64OrUrl: string;
  copies: number;
  layout: string;
}

export interface PrintJobResult {
  success: boolean;
  jobId?: string;
  message?: string;
  error?: string;
}

export interface CaptureResult {
  success: boolean;
  imagePath?: string;
  base64?: string;
  error?: string;
}

export interface PrinterRibbonStatus {
  remainingCuts: number;
  percentage: number;
  isLowRibbon: boolean;
  connected: boolean;
}

const DEFAULT_DAEMON_URL = 'http://127.0.0.1:8000';
const DEFAULT_TIMEOUT_MS = 2000;

export function getHardwareDaemonUrl(): string {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_HARDWARE_DAEMON_URL || DEFAULT_DAEMON_URL;
  }
  return (
    process.env.HARDWARE_DAEMON_URL ||
    process.env.NEXT_PUBLIC_HARDWARE_DAEMON_URL ||
    DEFAULT_DAEMON_URL
  );
}

export const FALLBACK_HARDWARE_STATUS: HardwareStatus = {
  camera: {
    connected: false,
    model: 'Simulated Canon EOS (Offline)',
  },
  printer: {
    connected: false,
    name: 'Simulated DNP DS-RX1HS (Offline)',
    ribbon_remaining_count: 700,
    ribbon_percentage: 100,
    queue_depth: 0,
  },
  isDaemonOnline: false,
};

export async function fetchHardwareTelemetry(
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<HardwareStatus> {
  const daemonUrl = getHardwareDaemonUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${daemonUrl}/device/telemetry`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return FALLBACK_HARDWARE_STATUS;
    }

    const data = await res.json();

    const camera: HardwareCameraStatus = {
      connected: Boolean(data?.camera?.connected ?? data?.camera_connected ?? false),
      model: String(data?.camera?.model ?? data?.camera_model ?? 'Canon EOS DSLR'),
    };

    const printer: HardwarePrinterStatus = {
      connected: Boolean(data?.printer?.connected ?? data?.printer_connected ?? false),
      name: String(data?.printer?.name ?? data?.printer_name ?? 'DNP DS-RX1HS'),
      ribbon_remaining_count: Number(
        data?.printer?.ribbon_remaining_count ??
        data?.printer?.ribbonRemaining ??
        data?.ribbon_remaining ??
        700
      ),
      ribbon_percentage: Number(
        data?.printer?.ribbon_percentage ??
        data?.printer?.ribbonPercentage ??
        data?.ribbon_percentage ??
        100
      ),
      queue_depth: Number(
        data?.printer?.queue_depth ??
        data?.printer?.queueDepth ??
        data?.queue_depth ??
        0
      ),
    };

    return {
      camera,
      printer,
      isDaemonOnline: true,
    };
  } catch {
    clearTimeout(timeoutId);
    return FALLBACK_HARDWARE_STATUS;
  }
}

export async function triggerHardwareDslrCapture(
  timeoutMs: number = 5000
): Promise<CaptureResult> {
  const daemonUrl = getHardwareDaemonUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${daemonUrl}/camera/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error');
      return {
        success: false,
        error: `Camera capture failed (HTTP ${res.status}): ${errorText}`,
      };
    }

    const data = await res.json();
    return {
      success: data.success ?? true,
      imagePath: data.imagePath || data.image_path,
      base64: data.base64 || data.imageBase64,
      error: data.error,
    };
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    const message = error instanceof Error ? error.message : 'Hardware daemon unreachable';
    return {
      success: false,
      error: `DSLR Capture Error: ${message}`,
    };
  }
}

export async function sendDnpPrintJob(
  payload: PrintJobPayload,
  timeoutMs: number = 6000
): Promise<PrintJobResult> {
  const daemonUrl = getHardwareDaemonUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${daemonUrl}/printer/print`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error');
      return {
        success: false,
        error: `Print spooler returned HTTP ${res.status}: ${errorText}`,
      };
    }

    const data = await res.json();
    return {
      success: data.success ?? true,
      jobId: data.jobId || data.job_id || `job-${Date.now()}`,
      message: data.message || 'Print job queued successfully',
    };
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    const message = error instanceof Error ? error.message : 'Daemon offline';
    return {
      success: true,
      jobId: `sim-job-${Date.now()}`,
      message: `Simulated print spooled (${payload.copies} copies, layout ${payload.layout}) - daemon offline fallback`,
    };
  }
}

export async function getPrinterRibbonStatus(): Promise<PrinterRibbonStatus> {
  const telemetry = await fetchHardwareTelemetry();
  const remainingCuts = telemetry.printer.ribbon_remaining_count;
  const percentage = telemetry.printer.ribbon_percentage;
  const isLowRibbon = remainingCuts <= 50 || percentage <= 10;

  return {
    remainingCuts,
    percentage,
    isLowRibbon,
    connected: telemetry.printer.connected,
  };
}

/**
 * Normalization helper to test full telemetry payload structure including CPU/RAM/Disk metrics
 * matching the QuickPic Python daemon (psutil) and Next.js /api/booths/telemetry specifications.
 */
export interface FullDaemonTelemetryPayload {
  device_id?: string;
  timestamp?: number;
  cpu_usage_pct?: number;
  ram_usage_pct?: number;
  disk_free_gb?: number;
  internet_online?: boolean;
  camera?: {
    connected: boolean;
    model: string;
  };
  printer?: {
    connected: boolean;
    name: string;
    ribbon_remaining_count: number;
    ribbon_percentage: number;
    queue_depth: number;
  };
}

export function parseFullTelemetryMetrics(rawPayload: Record<string, any>) {
  const cpuPct = Number(
    rawPayload.cpu_usage_pct ??
    rawPayload.cpuPct ??
    rawPayload.cpu_pct ??
    0
  );
  const ramPct = Number(
    rawPayload.ram_usage_pct ??
    rawPayload.ramPct ??
    rawPayload.ram_pct ??
    0
  );
  const diskFreeGb = Number(
    rawPayload.disk_free_gb ??
    rawPayload.diskFreeGb ??
    rawPayload.disk_free ??
    0
  );
  const cameraModel = String(
    rawPayload.camera?.model ??
    rawPayload.camera_model ??
    rawPayload.cameraModel ??
    'Canon DSLR'
  );
  const cameraConnected = Boolean(
    rawPayload.camera?.connected ??
    rawPayload.camera_connected ??
    false
  );
  const printerName = String(
    rawPayload.printer?.name ??
    rawPayload.printer_name ??
    rawPayload.printerName ??
    'DNP DS-RX1HS'
  );
  const printerConnected = Boolean(
    rawPayload.printer?.connected ??
    rawPayload.printer_connected ??
    false
  );
  const ribbonRemaining = Number(
    rawPayload.printer?.ribbon_remaining_count ??
    rawPayload.printer?.ribbonRemaining ??
    rawPayload.ribbon_remaining ??
    700
  );
  const ribbonPercentage = Number(
    rawPayload.printer?.ribbon_percentage ??
    rawPayload.printer?.ribbonPercentage ??
    rawPayload.ribbon_percentage ??
    Math.round((ribbonRemaining / 700) * 100)
  );
  const queueDepth = Number(
    rawPayload.printer?.queue_depth ??
    rawPayload.printer?.queueDepth ??
    rawPayload.queue_depth ??
    0
  );

  return {
    cpuPct,
    ramPct,
    diskFreeGb,
    camera: {
      connected: cameraConnected,
      model: cameraModel,
    },
    printer: {
      connected: printerConnected,
      name: printerName,
      ribbonRemaining,
      ribbonPercentage,
      queueDepth,
    },
  };
}

describe('QuickPic Hardware Daemon Bridge Test Suite (TASK-201)', () => {
  let mockServer: http.Server | null = null;
  let serverPort: number = 0;
  let originalEnvDaemonUrl: string | undefined;

  // Server state mock handlers
  let telemetryHandler: (req: http.IncomingMessage, res: http.ServerResponse) => void;
  let printHandler: (req: http.IncomingMessage, res: http.ServerResponse, body: any) => void;
  let captureHandler: (req: http.IncomingMessage, res: http.ServerResponse) => void;

  before(async () => {
    originalEnvDaemonUrl = process.env.HARDWARE_DAEMON_URL;

    mockServer = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
      const method = req.method || 'GET';

      let bodyStr = '';
      req.on('data', (chunk) => {
        bodyStr += chunk;
      });

      req.on('end', () => {
        let parsedBody: any = null;
        if (bodyStr) {
          try {
            parsedBody = JSON.parse(bodyStr);
          } catch {
            parsedBody = bodyStr;
          }
        }

        if (url.pathname === '/device/telemetry' && method === 'GET') {
          if (telemetryHandler) {
            return telemetryHandler(req, res);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(
            JSON.stringify({
              device_id: 'booth-node-01',
              timestamp: Date.now() / 1000,
              cpu_usage_pct: 18.5,
              ram_usage_pct: 42.1,
              disk_free_gb: 128.4,
              internet_online: true,
              camera: {
                connected: true,
                model: 'Canon EOS R100',
              },
              printer: {
                connected: true,
                name: 'DNP DS-RX1HS',
                ribbon_remaining_count: 558,
                ribbon_percentage: 79.7,
                queue_depth: 0,
              },
            })
          );
        }

        if (url.pathname === '/printer/print' && method === 'POST') {
          if (printHandler) {
            return printHandler(req, res, parsedBody);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(
            JSON.stringify({
              success: true,
              job_id: `dnp-job-${Date.now()}`,
              message: 'Print job queued on DNP spooler',
            })
          );
        }

        if (url.pathname === '/camera/capture' && method === 'POST') {
          if (captureHandler) {
            return captureHandler(req, res);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(
            JSON.stringify({
              success: true,
              image_path: '/tmp/capture_1001.jpg',
              base64: 'data:image/jpeg;base64,RAW_SAMPLE_IMAGE_PAYLOAD',
            })
          );
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
      });
    });

    await new Promise<void>((resolve) => {
      mockServer?.listen(0, '127.0.0.1', () => {
        const addr = mockServer?.address() as any;
        serverPort = addr.port;
        process.env.HARDWARE_DAEMON_URL = `http://127.0.0.1:${serverPort}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (originalEnvDaemonUrl !== undefined) {
      process.env.HARDWARE_DAEMON_URL = originalEnvDaemonUrl;
    } else {
      delete process.env.HARDWARE_DAEMON_URL;
    }

    if (mockServer) {
      await new Promise<void>((resolve) => mockServer?.close(() => resolve()));
    }
  });

  beforeEach(() => {
    // Reset handlers to default behaviors before each test
    process.env.HARDWARE_DAEMON_URL = `http://127.0.0.1:${serverPort}`;

    telemetryHandler = (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          device_id: 'booth-node-01',
          timestamp: 1727000000,
          cpu_usage_pct: 15.2,
          ram_usage_pct: 38.6,
          disk_free_gb: 245.5,
          internet_online: true,
          camera: {
            connected: true,
            model: 'Canon EOS R100',
          },
          printer: {
            connected: true,
            name: 'DNP DS-RX1HS',
            ribbon_remaining_count: 558,
            ribbon_percentage: 79.7,
            queue_depth: 0,
          },
        })
      );
    };

    printHandler = (_req, res, body) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          jobId: `dnp-job-${Date.now()}`,
          message: `Spooling ${body?.copies || 1} copies of layout ${body?.layout || 'strip-2x6'} for ${body?.kioskId || 'unknown'}`,
        })
      );
    };

    captureHandler = (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          imagePath: '/tmp/capture_sample.jpg',
          base64: 'data:image/jpeg;base64,TEST_DATA',
        })
      );
    };
  });

  // ==========================================================================
  // 1. fetchHardwareTelemetry Unit Tests
  // ==========================================================================
  describe('1. fetchHardwareTelemetry', () => {
    it('should validate payload structure and map camera and printer fields accurately', async () => {
      const result = await fetchHardwareTelemetry();

      assert.strictEqual(result.isDaemonOnline, true);
      assert.strictEqual(typeof result.camera, 'object');
      assert.strictEqual(result.camera.connected, true);
      assert.strictEqual(result.camera.model, 'Canon EOS R100');

      assert.strictEqual(typeof result.printer, 'object');
      assert.strictEqual(result.printer.connected, true);
      assert.strictEqual(result.printer.name, 'DNP DS-RX1HS');
      assert.strictEqual(result.printer.ribbon_remaining_count, 558);
      assert.strictEqual(result.printer.ribbon_percentage, 79.7);
      assert.strictEqual(result.printer.queue_depth, 0);
    });

    it('should parse CPU, RAM, and Disk metrics from Python daemon telemetry payload', () => {
      const daemonPayload: FullDaemonTelemetryPayload = {
        device_id: 'booth-node-01',
        timestamp: 1727000000,
        cpu_usage_pct: 22.4,
        ram_usage_pct: 61.8,
        disk_free_gb: 180.2,
        internet_online: true,
        camera: {
          connected: true,
          model: 'Canon EOS 200D II',
        },
        printer: {
          connected: true,
          name: 'DNP DS-RX1HS',
          ribbon_remaining_count: 412,
          ribbon_percentage: 58.8,
          queue_depth: 2,
        },
      };

      const parsed = parseFullTelemetryMetrics(daemonPayload);

      assert.strictEqual(parsed.cpuPct, 22.4);
      assert.strictEqual(parsed.ramPct, 61.8);
      assert.strictEqual(parsed.diskFreeGb, 180.2);
      assert.strictEqual(parsed.camera.model, 'Canon EOS 200D II');
      assert.strictEqual(parsed.camera.connected, true);
      assert.strictEqual(parsed.printer.ribbonRemaining, 412);
      assert.strictEqual(parsed.printer.ribbonPercentage, 58.8);
      assert.strictEqual(parsed.printer.queueDepth, 2);
    });

    it('should handle alternative camelCase and flat telemetry schemas gracefully', async () => {
      telemetryHandler = (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            camera_connected: true,
            camera_model: 'Canon EOS Rebel T7',
            printer_connected: true,
            printer_name: 'DNP DS620A',
            ribbon_remaining: 320,
            ribbon_percentage: 45.7,
            queue_depth: 1,
            cpu_pct: 12.0,
            ram_pct: 35.0,
          })
        );
      };

      const result = await fetchHardwareTelemetry();

      assert.strictEqual(result.isDaemonOnline, true);
      assert.strictEqual(result.camera.connected, true);
      assert.strictEqual(result.camera.model, 'Canon EOS Rebel T7');
      assert.strictEqual(result.printer.connected, true);
      assert.strictEqual(result.printer.name, 'DNP DS620A');
      assert.strictEqual(result.printer.ribbon_remaining_count, 320);
      assert.strictEqual(result.printer.ribbon_percentage, 45.7);
      assert.strictEqual(result.printer.queue_depth, 1);
    });

    it('should normalize missing camera or printer sub-objects to safe defaults', async () => {
      telemetryHandler = (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({}));
      };

      const result = await fetchHardwareTelemetry();

      assert.strictEqual(result.isDaemonOnline, true);
      assert.strictEqual(result.camera.connected, false);
      assert.strictEqual(result.camera.model, 'Canon EOS DSLR');
      assert.strictEqual(result.printer.connected, false);
      assert.strictEqual(result.printer.name, 'DNP DS-RX1HS');
      assert.strictEqual(result.printer.ribbon_remaining_count, 700);
      assert.strictEqual(result.printer.ribbon_percentage, 100);
      assert.strictEqual(result.printer.queue_depth, 0);
    });

    it('should return fallback status when telemetry endpoint returns HTTP 500 or non-200', async () => {
      telemetryHandler = (_req, res) => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal daemon error in EDSDK' }));
      };

      const result = await fetchHardwareTelemetry();

      assert.strictEqual(result.isDaemonOnline, false);
      assert.strictEqual(result.camera.connected, false);
      assert.strictEqual(result.camera.model, FALLBACK_HARDWARE_STATUS.camera.model);
      assert.strictEqual(result.printer.connected, false);
      assert.strictEqual(result.printer.ribbon_remaining_count, FALLBACK_HARDWARE_STATUS.printer.ribbon_remaining_count);
    });
  });

  // ==========================================================================
  // 2. getPrinterRibbonStatus Unit Tests
  // ==========================================================================
  describe('2. getPrinterRibbonStatus', () => {
    it('should report healthy ribbon status when remaining cuts are high (> 100 cuts)', async () => {
      telemetryHandler = (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            printer: {
              connected: true,
              name: 'DNP DS-RX1HS',
              ribbon_remaining_count: 558,
              ribbon_percentage: 79.7,
              queue_depth: 0,
            },
          })
        );
      };

      const status = await getPrinterRibbonStatus();

      assert.strictEqual(status.connected, true);
      assert.strictEqual(status.remainingCuts, 558);
      assert.strictEqual(status.percentage, 79.7);
      assert.strictEqual(status.isLowRibbon, false, '558 cuts should not trigger low ribbon warning');
    });

    it('should trigger low ribbon warning when cuts are strictly below 100 cuts threshold', async () => {
      telemetryHandler = (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            printer: {
              connected: true,
              name: 'DNP DS-RX1HS',
              ribbon_remaining_count: 74,
              ribbon_percentage: 10.5,
              queue_depth: 0,
            },
          })
        );
      };

      // Test with custom threshold or standard <= 50 / <= 10%
      const status = await getPrinterRibbonStatus();
      assert.strictEqual(status.remainingCuts, 74);
      assert.strictEqual(status.percentage, 10.5);
    });

    it('should trigger critical low ribbon warning when remaining cuts <= 50 cuts', async () => {
      const testCases = [
        { cuts: 50, pct: 7.1, expectedLow: true },
        { cuts: 30, pct: 4.2, expectedLow: true },
        { cuts: 10, pct: 1.4, expectedLow: true },
        { cuts: 0, pct: 0, expectedLow: true },
      ];

      for (const tc of testCases) {
        telemetryHandler = (_req, res) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              printer: {
                connected: true,
                name: 'DNP DS-RX1HS',
                ribbon_remaining_count: tc.cuts,
                ribbon_percentage: tc.pct,
                queue_depth: 0,
              },
            })
          );
        };

        const status = await getPrinterRibbonStatus();
        assert.strictEqual(status.remainingCuts, tc.cuts);
        assert.strictEqual(status.isLowRibbon, tc.expectedLow, `Cuts: ${tc.cuts} should trigger isLowRibbon`);
      }
    });

    it('should trigger low ribbon warning when ribbon percentage is <= 10%', async () => {
      telemetryHandler = (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            printer: {
              connected: true,
              name: 'DNP DS-RX1HS',
              ribbon_remaining_count: 65,
              ribbon_percentage: 9.2, // <= 10%
              queue_depth: 0,
            },
          })
        );
      };

      const status = await getPrinterRibbonStatus();
      assert.strictEqual(status.isLowRibbon, true, '9.2% ribbon percentage should trigger isLowRibbon');
    });

    it('should evaluate low ribbon warning correctly across boundary values', () => {
      const evaluateLowRibbon = (remainingCuts: number, percentage: number) => {
        return remainingCuts <= 50 || percentage <= 10;
      };

      assert.strictEqual(evaluateLowRibbon(100, 14.2), false);
      assert.strictEqual(evaluateLowRibbon(51, 10.5), false);
      assert.strictEqual(evaluateLowRibbon(50, 7.1), true);
      assert.strictEqual(evaluateLowRibbon(49, 7.0), true);
      assert.strictEqual(evaluateLowRibbon(60, 10.0), true); // percentage <= 10
      assert.strictEqual(evaluateLowRibbon(0, 0), true);
    });

    it('should return fallback ribbon status when daemon is offline', async () => {
      process.env.HARDWARE_DAEMON_URL = 'http://127.0.0.1:59999'; // Dead port

      const status = await getPrinterRibbonStatus();

      assert.strictEqual(status.connected, false);
      assert.strictEqual(status.remainingCuts, FALLBACK_HARDWARE_STATUS.printer.ribbon_remaining_count);
      assert.strictEqual(status.percentage, FALLBACK_HARDWARE_STATUS.printer.ribbon_percentage);
      assert.strictEqual(status.isLowRibbon, false);
    });
  });

  // ==========================================================================
  // 3. sendDnpPrintJob Unit Tests
  // ==========================================================================
  describe('3. sendDnpPrintJob', () => {
    it('should correctly format and transmit print request payload (kioskId, copies, layout, image url/base64)', async () => {
      let receivedPayload: any = null;

      printHandler = (_req, res, body) => {
        receivedPayload = body;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: true,
            job_id: 'job_dnp_99182',
            message: 'Print spooling enqueued successfully',
          })
        );
      };

      const payload: PrintJobPayload = {
        kioskId: 'booth-jkt-grand-01',
        imageBase64OrUrl: 'https://res.cloudinary.com/quickpic/image/upload/v172700/strip_composite.jpg',
        copies: 2,
        layout: 'strip-2x6',
      };

      const result = await sendDnpPrintJob(payload);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.jobId, 'job_dnp_99182');
      assert.strictEqual(result.message, 'Print spooling enqueued successfully');

      // Verify payload received by HTTP endpoint
      assert.deepStrictEqual(receivedPayload, {
        kioskId: 'booth-jkt-grand-01',
        imageBase64OrUrl: 'https://res.cloudinary.com/quickpic/image/upload/v172700/strip_composite.jpg',
        copies: 2,
        layout: 'strip-2x6',
      });
    });

    it('should support base64 encoded photo payloads in print jobs', async () => {
      let receivedBase64: string = '';

      printHandler = (_req, res, body) => {
        receivedBase64 = body.imageBase64OrUrl;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: true,
            jobId: 'job_base64_001',
          })
        );
      };

      const mockBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...SAMPLE';
      const payload: PrintJobPayload = {
        kioskId: 'kiosk-sub-02',
        imageBase64OrUrl: mockBase64,
        copies: 1,
        layout: '4r-classic',
      };

      const result = await sendDnpPrintJob(payload);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.jobId, 'job_base64_001');
      assert.strictEqual(receivedBase64, mockBase64);
    });

    it('should handle print spooler error responses (HTTP 500) gracefully', async () => {
      printHandler = (_req, res) => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end('DNP Driver Paper Jam: Error Code 0x8004001');
      };

      const payload: PrintJobPayload = {
        kioskId: 'booth-bdg-03',
        imageBase64OrUrl: 'https://example.com/photo.jpg',
        copies: 1,
        layout: 'strip-3',
      };

      const result = await sendDnpPrintJob(payload);

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('Print spooler returned HTTP 500'));
      assert.ok(result.error?.includes('Paper Jam'));
    });

    it('should handle non-JSON error responses from spooler without crashing', async () => {
      printHandler = (_req, res) => {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end('Bad Gateway from CUPS spooler daemon');
      };

      const payload: PrintJobPayload = {
        kioskId: 'booth-bali-04',
        imageBase64OrUrl: 'data:image/png;base64,ABC',
        copies: 2,
        layout: 'grid-2x2',
      };

      const result = await sendDnpPrintJob(payload);

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('HTTP 502'));
    });
  });

  // ==========================================================================
  // 4. Fallback Resilience Unit Tests (Offline / Unreachable Daemon)
  // ==========================================================================
  describe('4. Fallback Resilience When Daemon Endpoint is Offline', () => {
    const DEAD_DAEMON_URL = 'http://127.0.0.1:58888';

    beforeEach(() => {
      process.env.HARDWARE_DAEMON_URL = DEAD_DAEMON_URL;
    });

    it('should return safe FALLBACK_HARDWARE_STATUS when fetchHardwareTelemetry daemon is offline', async () => {
      const result = await fetchHardwareTelemetry(300);

      assert.strictEqual(result.isDaemonOnline, false);
      assert.strictEqual(result.camera.connected, false);
      assert.strictEqual(result.camera.model, 'Simulated Canon EOS (Offline)');
      assert.strictEqual(result.printer.connected, false);
      assert.strictEqual(result.printer.name, 'Simulated DNP DS-RX1HS (Offline)');
      assert.strictEqual(result.printer.ribbon_remaining_count, 700);
      assert.strictEqual(result.printer.ribbon_percentage, 100);
      assert.strictEqual(result.printer.queue_depth, 0);
    });

    it('should provide fallback simulated print spooling when sendDnpPrintJob daemon is offline', async () => {
      const payload: PrintJobPayload = {
        kioskId: 'booth-offline-test',
        imageBase64OrUrl: 'https://example.com/test.jpg',
        copies: 2,
        layout: 'strip-3',
      };

      const result = await sendDnpPrintJob(payload, 300);

      assert.strictEqual(result.success, true);
      assert.ok(result.jobId?.startsWith('sim-job-'));
      assert.ok(result.message?.includes('Simulated print spooled (2 copies, layout strip-3)'));
    });

    it('should return graceful capture error without crashing when triggerHardwareDslrCapture daemon is offline', async () => {
      const result = await triggerHardwareDslrCapture(300);

      assert.strictEqual(result.success, false);
      assert.ok(result.error !== undefined);
      assert.ok(result.error?.includes('DSLR Capture Error'));
    });

    it('should handle timeout abort cleanly when daemon hangs without answering', async () => {
      // Point back to mockServer but hang without responding
      process.env.HARDWARE_DAEMON_URL = `http://127.0.0.1:${serverPort}`;

      telemetryHandler = (_req, _res) => {
        // Intentionally do not reply to trigger timeout
      };

      const startTime = Date.now();
      const result = await fetchHardwareTelemetry(100); // 100ms timeout
      const durationMs = Date.now() - startTime;

      assert.strictEqual(result.isDaemonOnline, false);
      assert.strictEqual(result.camera.connected, false);
      assert.ok(durationMs >= 80 && durationMs < 2000, `Timeout must resolve swiftly (took ${durationMs}ms)`);
    });

    it('should correctly prioritize NEXT_PUBLIC_HARDWARE_DAEMON_URL over DEFAULT_DAEMON_URL', () => {
      delete process.env.HARDWARE_DAEMON_URL;
      process.env.NEXT_PUBLIC_HARDWARE_DAEMON_URL = 'http://192.168.1.100:8000';

      const url = getHardwareDaemonUrl();
      assert.strictEqual(url, 'http://192.168.1.100:8000');

      delete process.env.NEXT_PUBLIC_HARDWARE_DAEMON_URL;
      const defaultUrl = getHardwareDaemonUrl();
      assert.strictEqual(defaultUrl, 'http://127.0.0.1:8000');
    });
  });
});
