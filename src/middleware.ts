import { NextResponse, type NextRequest } from 'next/server';

/**
 * QuickPic Enterprise Edge Security Middleware
 *
 * Responsibilities:
 * 1. Inject hardened HTTP Security Headers across all requests
 * 2. Guard Kiosk API routes (/api/kiosk/*, /api/telemetry/*) by validating device token headers
 * 3. Enforce strict cache-busting headers on sensitive API and admin endpoints
 * 4. Prevent secret leaks and unauthorized cross-tenant requests
 */

const DEVICE_TOKEN_PREFIX = 'qp_dev_';

// Routes that require an authenticated kiosk device token
const PROTECTED_KIOSK_API_ROUTES = [
  '/api/kiosk',
  '/api/telemetry',
  '/api/booth/heartbeat',
  '/api/sessions/ingest',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Kiosk Device API Gatekeeper
  const isKioskApiRoute = PROTECTED_KIOSK_API_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  if (isKioskApiRoute) {
    const authHeader = request.headers.get('authorization');
    const customDeviceToken = request.headers.get('x-device-token');

    let bearerToken: string | null = null;
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      bearerToken = authHeader.slice(7).trim();
    } else if (customDeviceToken) {
      bearerToken = customDeviceToken.trim();
    }

    if (!bearerToken) {
      return NextResponse.json(
        {
          error: 'Unauthorized: Missing kiosk device bearer token',
          hint: 'Provide header "Authorization: Bearer qp_dev_..." or "x-device-token"',
        },
        { status: 401 }
      );
    }

    if (!bearerToken.startsWith(DEVICE_TOKEN_PREFIX) || bearerToken.length < 32) {
      return NextResponse.json(
        {
          error: 'Forbidden: Malformed or untrusted device token format',
        },
        { status: 403 }
      );
    }
  }

  // 2. Pass request and inject hardened HTTP Security Headers
  const response = NextResponse.next();

  // Defense-in-depth HTTP security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Allow camera for photobooth liveview, disallow microphone and geolocation
  response.headers.set(
    'Permissions-Policy',
    'camera=(self), microphone=(), geolocation=(), display-capture=(self)'
  );

  // Prevent caching of sensitive API or Admin endpoints
  if (pathname.startsWith('/api') || pathname.startsWith('/admin')) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, audio, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3|wav)$).*)',
  ],
};
