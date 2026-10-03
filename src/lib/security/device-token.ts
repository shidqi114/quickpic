import crypto from 'crypto';

/**
 * QuickPic Device Security & Cryptographic Token Subsystem
 *
 * Provides cryptographically secure pairing PIN generation, high-entropy bearer token
 * creation, SHA-256 token hashing for safe database storage, and constant-time
 * token verification helpers for Next.js App Router API routes.
 */

export const DEVICE_TOKEN_PREFIX = 'qp_dev_';
export const DEFAULT_PAIRING_PIN_TTL_MINUTES = 15;

export interface KioskPairingCodeResult {
  code: string;
  expiresAt: Date;
  expiresAtIso: string;
}

export interface KioskDeviceTokenResult {
  rawToken: string;
  hashedToken: string;
}

export interface KioskValidationResult {
  isValid: boolean;
  token: string | null;
  error?: string;
}

/**
 * 1. Secure 6-digit Kiosk Pairing PIN Generator
 * Generates a crypto-random 6-digit numeric string ('000000' to '999999').
 * Uses crypto.randomInt for uniform, cryptographically unbiased distribution.
 */
export function generatePairingPin(): string {
  // crypto.randomInt generates integers uniformly distributed in [min, max)
  const pin = crypto.randomInt(0, 1000000);
  return pin.toString().padStart(6, '0');
}

/**
 * Generates a 6-digit pairing PIN with an expiration timestamp.
 */
export function generatePairingPinWithExpiry(
  ttlMinutes: number = DEFAULT_PAIRING_PIN_TTL_MINUTES
): KioskPairingCodeResult {
  const code = generatePairingPin();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  return {
    code,
    expiresAt,
    expiresAtIso: expiresAt.toISOString(),
  };
}

/**
 * Verifies a 6-digit pairing PIN in constant time to prevent timing attacks.
 */
export function verifyPairingPin(providedPin: string, storedPin: string): boolean {
  if (!providedPin || !storedPin) return false;
  const cleanProvided = providedPin.trim();
  const cleanStored = storedPin.trim();

  if (cleanProvided.length !== 6 || cleanStored.length !== 6) {
    return false;
  }

  const bufProvided = Buffer.from(cleanProvided, 'utf-8');
  const bufStored = Buffer.from(cleanStored, 'utf-8');

  return crypto.timingSafeEqual(bufProvided, bufStored);
}

/**
 * 2. Cryptographic Device Bearer Token Generator
 * Generates a 256-bit (32 bytes) cryptographically secure bearer token.
 * Output format: 'qp_dev_<64-character-hex-string>'
 */
export function generateDeviceToken(prefix: string = DEVICE_TOKEN_PREFIX): string {
  const randomEntropy = crypto.randomBytes(32).toString('hex');
  return `${prefix}${randomEntropy}`;
}

/**
 * Hashes a device bearer token using SHA-256 for secure database storage.
 * Recommended practice: store the SHA-256 hash in photobooths.device_token
 * rather than plaintext tokens to prevent token compromise if DB is dumped.
 */
export function hashDeviceToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Generates a device bearer token along with its SHA-256 hash.
 */
export function generateDeviceTokenWithHash(
  prefix: string = DEVICE_TOKEN_PREFIX
): KioskDeviceTokenResult {
  const rawToken = generateDeviceToken(prefix);
  const hashedToken = hashDeviceToken(rawToken);
  return { rawToken, hashedToken };
}

/**
 * 3. Token Extraction Helper
 * Extracts device token from either 'Authorization: Bearer <token>' or 'x-device-token' header.
 * Compatible with Next.js Request, Headers, or Node.js IncomingHttpHeaders.
 */
export function extractDeviceToken(
  headersOrRequest:
    | Request
    | Headers
    | Record<string, string | string[] | undefined>
    | null
    | undefined
): string | null {
  if (!headersOrRequest) return null;

  // Case 1: Fetch API Request object
  if (typeof (headersOrRequest as Request).headers?.get === 'function') {
    const reqHeaders = (headersOrRequest as Request).headers;
    const auth = reqHeaders.get('authorization');
    if (auth && auth.toLowerCase().startsWith('bearer ')) {
      return auth.slice(7).trim();
    }
    const customHeader = reqHeaders.get('x-device-token');
    if (customHeader) {
      return customHeader.trim();
    }
    return null;
  }

  // Case 2: Standard Headers object
  if (typeof (headersOrRequest as Headers).get === 'function') {
    const headers = headersOrRequest as Headers;
    const auth = headers.get('authorization');
    if (auth && auth.toLowerCase().startsWith('bearer ')) {
      return auth.slice(7).trim();
    }
    const customHeader = headers.get('x-device-token');
    if (customHeader) {
      return customHeader.trim();
    }
    return null;
  }

  // Case 3: Record / Dictionary of headers
  const headerRecord = headersOrRequest as Record<string, string | string[] | undefined>;
  const authHeader = headerRecord['authorization'] || headerRecord['Authorization'];
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  const customHeader = headerRecord['x-device-token'] || headerRecord['X-Device-Token'];
  if (typeof customHeader === 'string') {
    return customHeader.trim();
  }

  return null;
}

/**
 * 4. Token Verification Helper
 * Verifies a provided token against an expected token (or stored SHA-256 hash)
 * using constant-time comparison to prevent side-channel timing attacks.
 */
export function verifyDeviceToken(
  providedToken: string,
  storedTokenOrHash: string
): boolean {
  if (!providedToken || !storedTokenOrHash) {
    return false;
  }

  const cleanProvided = providedToken.trim();
  const cleanStored = storedTokenOrHash.trim();

  // If the stored value is a 64-char hex SHA-256 hash, hash the provided token first
  const isStoredHash = /^[a-f0-9]{64}$/i.test(cleanStored);
  const candidateHash = isStoredHash
    ? hashDeviceToken(cleanProvided)
    : hashDeviceToken(cleanProvided);
  const targetHash = isStoredHash
    ? cleanStored.toLowerCase()
    : hashDeviceToken(cleanStored);

  // Both hashes are guaranteed to be 64 hex characters (32 bytes)
  const bufCandidate = Buffer.from(candidateHash, 'hex');
  const bufTarget = Buffer.from(targetHash, 'hex');

  if (bufCandidate.length !== bufTarget.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufCandidate, bufTarget);
}

/**
 * 5. Kiosk Request Validator for Next.js App Router API Routes
 * Validates incoming HTTP requests from kiosk nodes.
 *
 * @example
 * ```ts
 * export async function POST(req: NextRequest) {
 *   const validation = validateKioskRequest(req);
 *   if (!validation.isValid) {
 *     return NextResponse.json({ error: validation.error }, { status: 401 });
 *   }
 *   // Proceed with kiosk operation
 * }
 * ```
 */
export function validateKioskRequest(
  req: Request | { headers: Headers }
): KioskValidationResult {
  const token = extractDeviceToken(req.headers);

  if (!token) {
    return {
      isValid: false,
      token: null,
      error: 'Missing device authentication token (provide via Bearer auth or x-device-token)',
    };
  }

  if (!token.startsWith(DEVICE_TOKEN_PREFIX)) {
    return {
      isValid: false,
      token,
      error: 'Invalid device token format (must start with qp_dev_)',
    };
  }

  if (token.length < 32) {
    return {
      isValid: false,
      token,
      error: 'Device token entropy too low',
    };
  }

  return {
    isValid: true,
    token,
  };
}

/**
 * 6. Cryptographic HMAC Request Signature Helpers
 * Used for tamper-proof telemetry packets and offline syncing.
 */
export function signPayloadHmac(payload: string, secretKey: string): string {
  return crypto.createHmac('sha256', secretKey).update(payload).digest('hex');
}

export function verifyPayloadHmac(
  payload: string,
  signature: string,
  secretKey: string
): boolean {
  if (!payload || !signature || !secretKey) return false;
  const expectedSig = signPayloadHmac(payload, secretKey);

  const bufExpected = Buffer.from(expectedSig, 'hex');
  const bufActual = Buffer.from(signature.trim(), 'hex');

  if (bufExpected.length !== bufActual.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufExpected, bufActual);
}
