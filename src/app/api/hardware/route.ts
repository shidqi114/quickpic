import { NextRequest, NextResponse } from 'next/server';
import {
  fetchHardwareTelemetry,
  sendDnpPrintJob,
  triggerHardwareDslrCapture,
  getPrinterRibbonStatus,
  PrintJobPayload,
} from '@/lib/hardware/daemon-client';

/**
 * GET /api/hardware
 * Ingests and returns latest hardware telemetry (DSLR, DNP Printer, Ribbon status).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode');

    if (mode === 'ribbon') {
      const ribbonStatus = await getPrinterRibbonStatus();
      return NextResponse.json(ribbonStatus, { status: 200 });
    }

    const telemetry = await fetchHardwareTelemetry();
    return NextResponse.json(telemetry, { status: 200 });
  } catch (error: unknown) {
    console.error('Hardware telemetry API error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch telemetry';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/hardware
 * Dispatches print job to local DNP spooler or executes hardware capture commands.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Check if request is a camera capture command
    if (body.action === 'capture') {
      const captureResult = await triggerHardwareDslrCapture();
      return NextResponse.json(captureResult, {
        status: captureResult.success ? 200 : 502,
      });
    }

    // Default POST action is print job dispatch
    const kioskId = body.kioskId || body.boothId || 'default-kiosk';
    const imageBase64OrUrl = body.imageBase64OrUrl || body.imageUrl || body.compositeUrl || body.image;
    const copies = Number(body.copies || 1);
    const layout = body.layout || 'strip-3';

    if (!imageBase64OrUrl) {
      return NextResponse.json(
        { error: 'Missing image payload (imageBase64OrUrl or imageUrl required)' },
        { status: 400 }
      );
    }

    const payload: PrintJobPayload = {
      kioskId,
      imageBase64OrUrl,
      copies,
      layout,
    };

    const printResult = await sendDnpPrintJob(payload);

    return NextResponse.json(printResult, {
      status: printResult.success ? 200 : 502,
    });
  } catch (error: unknown) {
    console.error('Hardware print dispatch API error:', error);
    const message = error instanceof Error ? error.message : 'Print dispatch failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
