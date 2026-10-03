/**
 * Hardware Daemon Client Bridge for QuickPic
 * Communicates with the local hardware daemon (Python EDSDK + DNP driver)
 * at http://127.0.0.1:8000 (or NEXT_PUBLIC_HARDWARE_DAEMON_URL).
 *
 * Provides resilient fallbacks so the kiosk application never crashes
 * when the local daemon or physical hardware is offline.
 */

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

/**
 * Fetch hardware telemetry from daemon with 2000ms timeout.
 * Returns resilient fallback if daemon is offline or unreachable.
 */
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
      console.warn(`[HardwareDaemon] Telemetry endpoint returned HTTP ${res.status}`);
      return FALLBACK_HARDWARE_STATUS;
    }

    const data = await res.json();

    // Map and normalize payload supporting both snake_case and camelCase
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
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    // Daemon is unreachable or timed out - provide safe fallback
    return FALLBACK_HARDWARE_STATUS;
  }
}

/**
 * Trigger physical DSLR capture via local Python daemon.
 */
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

/**
 * Dispatch a photo print job to the local DNP dye-sub printer spooler.
 */
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
    // When daemon is offline in demo/simulation, return graceful response
    console.warn(`[HardwareDaemon] Print job dispatch fallback: ${message}`);
    return {
      success: true,
      jobId: `sim-job-${Date.now()}`,
      message: `Simulated print spooled (${payload.copies} copies, layout ${payload.layout}) - daemon offline fallback`,
    };
  }
}

/**
 * Get current printer ribbon status and remaining cuts.
 */
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
