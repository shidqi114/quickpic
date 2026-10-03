import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

/**
 * Helper to generate a cryptographically random 6-digit PIN.
 */
function generateSixDigitPin(): string {
  const num = crypto.randomInt(100000, 1000000);
  return num.toString();
}

/**
 * Helper to generate a secure device token for physical photobooth kiosks.
 * Format: qp_dev_<48 hex chars>
 */
function generateDeviceToken(): string {
  const entropy = crypto.randomBytes(24).toString('hex');
  return `qp_dev_${entropy}`;
}

/**
 * POST /api/booths/pair
 * Handles pairing physical kiosks to an Owner's fleet via a 6-digit PIN.
 * Also supports pairing code generation when called by vendor dashboard.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'pair';

    const adminClient = getSupabaseAdminClient();

    // --------------------------------------------------------------------------
    // ACTION: GENERATE PAIRING CODE (Owner Dashboard initiates kiosk addition)
    // --------------------------------------------------------------------------
    if (action === 'generate') {
      const { boothId, ownerId, boothName = 'New Photobooth', location = 'Unassigned Venue' } = body;

      if (!boothId) {
        return NextResponse.json(
          { error: 'boothId is required to generate a pairing code' },
          { status: 400 }
        );
      }

      const pairingPin = generateSixDigitPin();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15-minute validity window

      if (!adminClient) {
        // Dev / Simulation fallback
        return NextResponse.json({
          success: true,
          boothId,
          pairingCode: pairingPin,
          expiresAt,
          simulated: true,
          message: 'Simulated pairing code generated (Supabase not configured)',
        });
      }

      // Upsert photobooth record with new pairing code
      const { data, error } = await adminClient
        .from('photobooths')
        .upsert(
          {
            id: boothId,
            owner_id: ownerId || 'default-vendor',
            name: boothName,
            location,
            pairing_code: pairingPin,
            pairing_code_expires_at: expiresAt,
            status: 'offline',
          },
          { onConflict: 'id' }
        )
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: 'Failed to generate pairing code in database', details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        boothId: data.id,
        pairingCode: pairingPin,
        expiresAt,
      });
    }

    // --------------------------------------------------------------------------
    // ACTION: PAIR (Physical Kiosk submits 6-digit PIN)
    // --------------------------------------------------------------------------
    const rawPin = body.pairingCode || body.pairing_code || body.pin || '';
    const cleanPin = String(rawPin).trim();
    const targetBoothId = body.boothId || body.booth_id;

    if (!cleanPin) {
      return NextResponse.json(
        { error: 'A 6-digit pairing PIN is required', code: 'MISSING_PIN' },
        { status: 400 }
      );
    }

    if (!/^\d{6}$/.test(cleanPin)) {
      return NextResponse.json(
        { error: 'Invalid pairing PIN format. Expected exactly 6 digits.', code: 'INVALID_FORMAT' },
        { status: 400 }
      );
    }

    // If Supabase credentials are not yet configured in local environment,
    // support development simulation so frontend/kiosk teams can proceed seamlessly.
    if (!adminClient) {
      const simulatedToken = generateDeviceToken();
      return NextResponse.json({
        success: true,
        boothId: targetBoothId || 'booth-sim-01',
        boothName: 'QuickPic Station (Simulation)',
        location: 'Demo Floor',
        ownerId: 'owner-sim-01',
        deviceToken: simulatedToken,
        pairedAt: new Date().toISOString(),
        simulated: true,
        message: 'Paired successfully in simulation mode (Supabase credentials missing)',
      });
    }

    // Find booth matching pairing code
    let query = adminClient
      .from('photobooths')
      .select('*')
      .eq('pairing_code', cleanPin);

    if (targetBoothId) {
      query = query.eq('id', targetBoothId);
    }

    const { data: booth, error: fetchError } = await query.maybeSingle();

    if (fetchError) {
      return NextResponse.json(
        { error: 'Database query error during pairing verification', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!booth) {
      return NextResponse.json(
        {
          error: 'Invalid pairing PIN. No matching photobooth found or PIN has expired.',
          code: 'PIN_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // Check expiration if expiry timestamp was set
    if (booth.pairing_code_expires_at) {
      const expirationDate = new Date(booth.pairing_code_expires_at);
      if (expirationDate.getTime() < Date.now()) {
        return NextResponse.json(
          {
            error: 'Pairing PIN has expired. Please generate a new code from the vendor dashboard.',
            code: 'PIN_EXPIRED',
          },
          { status: 410 }
        );
      }
    }

    // Generate cryptographic device token
    const deviceToken = generateDeviceToken();
    const nowIso = new Date().toISOString();

    // Consume single-use pairing PIN and issue device token
    const { error: updateError } = await adminClient
      .from('photobooths')
      .update({
        device_token: deviceToken,
        pairing_code: null, // Clear single-use PIN immediately for security
        pairing_code_expires_at: null,
        status: 'online',
        last_seen_at: nowIso,
        last_heartbeat_at: nowIso,
      })
      .eq('id', booth.id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to bind device token to photobooth', details: updateError.message },
        { status: 500 }
      );
    }

    // Also ensure initial booth_settings row exists for this station
    try {
      await adminClient
        .from('booth_settings')
        .upsert(
          {
            booth_id: booth.id,
            event_name: booth.name || 'QuickPic Event',
          },
          { onConflict: 'booth_id' }
        );
    } catch (err: unknown) {
      console.warn('Non-critical booth_settings init warning:', err);
    }

    return NextResponse.json({
      success: true,
      boothId: booth.id,
      boothName: booth.name,
      location: booth.location,
      ownerId: booth.owner_id,
      deviceToken,
      pairedAt: nowIso,
    });
  } catch (error: unknown) {
    console.error('Pairing endpoint unhandled exception:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/booths/pair?boothId=xxx
 * Allows vendor dashboard to check the current pairing status or active code of a booth.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const boothId = searchParams.get('boothId') || searchParams.get('id');

    if (!boothId) {
      return NextResponse.json(
        { error: 'boothId parameter is required' },
        { status: 400 }
      );
    }

    const adminClient = getSupabaseAdminClient();
    if (!adminClient) {
      return NextResponse.json({
        boothId,
        isPaired: false,
        status: 'offline',
        simulated: true,
      });
    }

    const { data: booth, error } = await adminClient
      .from('photobooths')
      .select('id, name, location, status, last_seen_at, pairing_code, pairing_code_expires_at, device_token')
      .eq('id', boothId)
      .maybeSingle();

    if (error || !booth) {
      return NextResponse.json(
        { error: 'Booth not found' },
        { status: 404 }
      );
    }

    const isPaired = Boolean(booth.device_token);

    return NextResponse.json({
      boothId: booth.id,
      name: booth.name,
      location: booth.location,
      status: booth.status,
      lastSeenAt: booth.last_seen_at,
      isPaired,
      hasActivePairingCode: Boolean(booth.pairing_code),
      pairingCodeExpiresAt: booth.pairing_code_expires_at,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
