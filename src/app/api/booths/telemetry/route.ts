import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

/**
 * Normalizes incoming telemetry payload whether submitted flat or nested.
 */
function parseTelemetryPayload(body: any, boothIdFallback: string) {
  const boothId = body.boothId || body.booth_id || body.deviceId || boothIdFallback;

  // Camera fields
  const cameraConnected =
    body.cameraConnected ??
    body.camera_connected ??
    body.camera?.connected ??
    false;

  const cameraModel =
    body.cameraModel ??
    body.camera_model ??
    body.camera?.model ??
    'Canon DSLR';

  // Printer fields
  const printerConnected =
    body.printerConnected ??
    body.printer_connected ??
    body.printer?.connected ??
    false;

  const printerName =
    body.printerName ??
    body.printer_name ??
    body.printer?.name ??
    'DNP DS-RX1HS';

  const ribbonRemaining = Number(
    body.ribbonRemaining ??
    body.ribbon_remaining ??
    body.printer?.ribbonRemaining ??
    700
  );

  const ribbonPercentage = Number(
    body.ribbonPercentage ??
    body.ribbon_percentage ??
    body.printer?.ribbonPercentage ??
    Math.round((ribbonRemaining / 700) * 100)
  );

  const queueDepth = Number(
    body.queueDepth ??
    body.queue_depth ??
    body.printer?.queueDepth ??
    0
  );

  // PC Load
  const cpuPct = Number(body.cpuPct ?? body.cpu_pct ?? 0);
  const ramPct = Number(body.ramPct ?? body.ram_pct ?? 0);

  return {
    boothId,
    cameraConnected: Boolean(cameraConnected),
    cameraModel: String(cameraModel),
    printerConnected: Boolean(printerConnected),
    printerName: String(printerName),
    ribbonRemaining,
    ribbonPercentage,
    queueDepth,
    cpuPct,
    ramPct,
  };
}

/**
 * POST /api/booths/telemetry
 * Ingests 1-minute telemetry heartbeats from physical kiosk stations or hardware daemons.
 * Updates photobooths.last_seen_at and appends a row into telemetry.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Extract device token from headers for least-privilege kiosk auth
    const authHeader = req.headers.get('authorization') || '';
    const headerToken = req.headers.get('x-device-token') || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : headerToken.trim();

    const body = await req.json().catch(() => ({}));

    // Identify target photobooth
    const boothIdCandidate = body.boothId || body.booth_id || body.deviceId || '';
    if (!boothIdCandidate && !bearerToken) {
      return NextResponse.json(
        { error: 'boothId or valid device authorization token is required' },
        { status: 400 }
      );
    }

    const adminClient = getSupabaseAdminClient();
    const nowIso = new Date().toISOString();

    // 2. Simulation / Development mode if database is not configured
    if (!adminClient) {
      const parsed = parseTelemetryPayload(body, boothIdCandidate || 'booth-sim-01');
      return NextResponse.json({
        success: true,
        boothId: parsed.boothId,
        timestamp: nowIso,
        status: 'online',
        simulated: true,
        message: 'Telemetry ingested in simulation mode (Supabase not configured)',
      });
    }

    // 3. Authenticate and resolve booth
    let targetBoothId = boothIdCandidate;

    if (bearerToken) {
      // Find booth matching the device_token
      const { data: boothByToken } = await adminClient
        .from('photobooths')
        .select('id, device_token')
        .eq('device_token', bearerToken)
        .maybeSingle();

      if (boothByToken) {
        targetBoothId = boothByToken.id;
      } else if (boothIdCandidate) {
        // Fallback: verify if candidate booth exists
        const { data: boothById } = await adminClient
          .from('photobooths')
          .select('id, device_token')
          .eq('id', boothIdCandidate)
          .maybeSingle();

        if (boothById && boothById.device_token && boothById.device_token !== bearerToken) {
          return NextResponse.json(
            { error: 'Unauthorized: Invalid device_token for this photobooth', code: 'INVALID_DEVICE_TOKEN' },
            { status: 401 }
          );
        }
      }
    }

    if (!targetBoothId) {
      return NextResponse.json(
        { error: 'Photobooth station not recognized or unpaired', code: 'UNKNOWN_BOOTH' },
        { status: 404 }
      );
    }

    const payload = parseTelemetryPayload(body, targetBoothId);

    // 4. Update photobooth station status and heartbeat
    const { error: boothUpdateError } = await adminClient
      .from('photobooths')
      .update({
        last_seen_at: nowIso,
        last_heartbeat_at: nowIso,
        status: 'online',
      })
      .eq('id', payload.boothId);

    if (boothUpdateError) {
      console.warn('[Telemetry] Photobooth heartbeat update warning:', boothUpdateError.message);
    }

    // 5. Ingest telemetry record into database
    const { error: telemetryInsertError } = await adminClient
      .from('telemetry')
      .insert({
        booth_id: payload.boothId,
        ribbon_remaining: payload.ribbonRemaining,
        ribbon_percentage: payload.ribbonPercentage,
        queue_depth: payload.queueDepth,
        cpu_pct: payload.cpuPct,
        ram_pct: payload.ramPct,
        camera_connected: payload.cameraConnected,
        camera_model: payload.cameraModel,
        printer_connected: payload.printerConnected,
        printer_name: payload.printerName,
        pinged_at: nowIso,
      });

    if (telemetryInsertError) {
      return NextResponse.json(
        { error: 'Failed to record telemetry heartbeat', details: telemetryInsertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      boothId: payload.boothId,
      timestamp: nowIso,
      status: 'online',
    });
  } catch (error: unknown) {
    console.error('Telemetry ingestion unhandled error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/booths/telemetry?boothId=xxx&limit=10
 * Returns latest telemetry metrics for fleet monitoring dashboards.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const boothId = searchParams.get('boothId') || searchParams.get('deviceId');
    const limit = Math.min(Number(searchParams.get('limit') || 1), 100);

    const adminClient = getSupabaseAdminClient();

    if (!adminClient) {
      // Mock fallback for UI/UX testing
      return NextResponse.json({
        boothId: boothId || 'booth-sim-01',
        isOnline: true,
        lastPingTime: Date.now(),
        cpuPct: 18.5,
        ramPct: 45.2,
        camera: { connected: true, model: 'Canon EOS 200D II' },
        printer: {
          connected: true,
          name: 'DNP DS-RX1HS',
          ribbonRemaining: 540,
          ribbonPercentage: 77.1,
          queueDepth: 0,
        },
        simulated: true,
      });
    }

    if (!boothId) {
      // Return latest telemetry across fleet if no booth specified
      const { data: latestRows, error } = await adminClient
        .from('telemetry')
        .select('*')
        .order('pinged_at', { ascending: false })
        .limit(20);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ data: latestRows || [] });
    }

    // Query booth record and its latest telemetry
    const [boothRes, telemetryRes] = await Promise.all([
      adminClient.from('photobooths').select('id, name, status, last_seen_at').eq('id', boothId).maybeSingle(),
      adminClient.from('telemetry').select('*').eq('booth_id', boothId).order('pinged_at', { ascending: false }).limit(limit),
    ]);

    const latest = telemetryRes.data?.[0];
    const booth = boothRes.data;

    // Determine online status: considered online if pinged within last 3 minutes
    const isOnline = Boolean(
      booth?.last_seen_at &&
      Date.now() - new Date(booth.last_seen_at).getTime() < 3 * 60 * 1000
    );

    return NextResponse.json({
      boothId,
      boothName: booth?.name || boothId,
      isOnline,
      status: isOnline ? 'online' : (booth?.status || 'offline'),
      lastPingTime: latest?.pinged_at ? new Date(latest.pinged_at).getTime() : null,
      cpuPct: latest?.cpu_pct ?? 0,
      ramPct: latest?.ram_pct ?? 0,
      camera: {
        connected: latest?.camera_connected ?? false,
        model: latest?.camera_model ?? 'Unknown',
      },
      printer: {
        connected: latest?.printer_connected ?? false,
        name: latest?.printer_name ?? 'Unknown',
        ribbonRemaining: latest?.ribbon_remaining ?? 0,
        ribbonPercentage: latest?.ribbon_percentage ?? 0,
        queueDepth: latest?.queue_depth ?? 0,
      },
      history: limit > 1 ? telemetryRes.data : undefined,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
