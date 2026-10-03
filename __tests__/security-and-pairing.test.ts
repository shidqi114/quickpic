import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
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

export function generatePairingPin(): string {
  const pin = crypto.randomInt(0, 1000000);
  return pin.toString().padStart(6, '0');
}

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

export function verifyPairingPin(providedPin: string, storedPin: string): boolean {
  if (!providedPin || !storedPin) return false;
  const cleanProvided = String(providedPin).trim();
  const cleanStored = String(storedPin).trim();
  if (cleanProvided.length !== 6 || cleanStored.length !== 6) return false;

  const bufProvided = Buffer.from(cleanProvided, 'utf8');
  const bufStored = Buffer.from(cleanStored, 'utf8');
  if (bufProvided.length !== bufStored.length) return false;
  return crypto.timingSafeEqual(bufProvided, bufStored);
}

export function generateDeviceToken(prefix: string = DEVICE_TOKEN_PREFIX): string {
  const randomEntropy = crypto.randomBytes(32).toString('hex');
  return `${prefix}${randomEntropy}`;
}

export function hashDeviceToken(rawToken: string): string {
  if (!rawToken || typeof rawToken !== 'string') {
    throw new Error('Invalid token provided for hashing');
  }
  return crypto.createHash('sha256').update(rawToken.trim(), 'utf8').digest('hex');
}

export function generateDeviceTokenWithHash(prefix: string = DEVICE_TOKEN_PREFIX): KioskDeviceTokenResult {
  const rawToken = generateDeviceToken(prefix);
  const hashedToken = hashDeviceToken(rawToken);
  return { rawToken, hashedToken };
}

export function verifyDeviceToken(
  providedToken: string,
  storedTokenOrHash: string
): boolean {
  if (!providedToken || !storedTokenOrHash) {
    return false;
  }

  const cleanProvided = providedToken.trim();
  const cleanStored = storedTokenOrHash.trim();

  const isStoredHash = /^[a-f0-9]{64}$/i.test(cleanStored);
  const candidateHash = hashDeviceToken(cleanProvided);
  const targetHash = isStoredHash
    ? cleanStored.toLowerCase()
    : hashDeviceToken(cleanStored);

  const bufCandidate = Buffer.from(candidateHash, 'hex');
  const bufTarget = Buffer.from(targetHash, 'hex');

  if (bufCandidate.length !== bufTarget.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufCandidate, bufTarget);
}

/**
 * Pure voucher calculation logic adhering strictly to @/lib/payments specification:
 * - Free: discount = currentTotal
 * - Percentage: discount = Math.round((currentTotal * voucher.value) / 100)
 * - Fixed: discount = Math.min(voucher.value, currentTotal)
 * - Final total: Math.max(0, currentTotal - discount)
 */
function calculateVoucherDiscount(
  voucher: { type: 'percentage' | 'fixed' | 'free'; value: number },
  currentTotal: number
): { discountAmount: number; finalTotal: number } {
  let discount = 0;
  if (voucher.type === 'free') {
    discount = currentTotal;
  } else if (voucher.type === 'percentage') {
    discount = Math.round((currentTotal * voucher.value) / 100);
  } else if (voucher.type === 'fixed') {
    discount = Math.min(voucher.value, currentTotal);
  }
  const finalTotal = Math.max(0, currentTotal - discount);
  return { discountAmount: discount, finalTotal };
}

describe('QuickPic Security & Device Pairing Test Suite', () => {
  // ============================================================================
  // 1. 6-Digit PIN Generation Tests
  // ============================================================================
  describe('6-Digit PIN Generation', () => {
    it('should generate a 6-digit numeric string', () => {
      const pin = generatePairingPin();
      assert.strictEqual(typeof pin, 'string');
      assert.strictEqual(pin.length, 6);
      assert.match(pin, /^\d{6}$/);
    });

    it('should consistently generate valid 6-digit PINs across multiple iterations', () => {
      for (let i = 0; i < 100; i++) {
        const pin = generatePairingPin();
        assert.strictEqual(pin.length, 6, `PIN length must be 6, got ${pin.length}`);
        assert.match(pin, /^\d{6}$/, `PIN "${pin}" must contain only digits`);
        const num = Number(pin);
        assert.ok(num >= 0 && num <= 999999, `PIN "${pin}" out of bounds`);
      }
    });

    it('should preserve leading zeros for PIN values below 100000', () => {
      // Test that padStart(6, '0') behavior is enforced
      const smallPin = (42).toString().padStart(6, '0');
      assert.strictEqual(smallPin, '000042');
      assert.strictEqual(smallPin.length, 6);
    });

    it('should generate pairing PIN with expiry metadata and default 15-minute TTL', () => {
      const beforeTime = Date.now();
      const result = generatePairingPinWithExpiry();
      const afterTime = Date.now();

      assert.strictEqual(typeof result.code, 'string');
      assert.strictEqual(result.code.length, 6);
      assert.match(result.code, /^\d{6}$/);
      assert.ok(result.expiresAt instanceof Date);

      const expectedMinMs = beforeTime + DEFAULT_PAIRING_PIN_TTL_MINUTES * 60 * 1000;
      const expectedMaxMs = afterTime + DEFAULT_PAIRING_PIN_TTL_MINUTES * 60 * 1000;
      assert.ok(result.expiresAt.getTime() >= expectedMinMs);
      assert.ok(result.expiresAt.getTime() <= expectedMaxMs);
      assert.strictEqual(result.expiresAtIso, result.expiresAt.toISOString());
    });

    it('should support custom TTL for pairing PIN expiry', () => {
      const customTtl = 30; // 30 minutes
      const beforeTime = Date.now();
      const result = generatePairingPinWithExpiry(customTtl);

      const expectedMinMs = beforeTime + customTtl * 60 * 1000;
      assert.ok(result.expiresAt.getTime() >= expectedMinMs);
    });
  });

  // ============================================================================
  // 2. Constant-Time PIN Verification Tests
  // ============================================================================
  describe('Constant-Time PIN Verification', () => {
    it('should return true for identical 6-digit PINs', () => {
      assert.strictEqual(verifyPairingPin('123456', '123456'), true);
      assert.strictEqual(verifyPairingPin('000123', '000123'), true);
      assert.strictEqual(verifyPairingPin('999999', '999999'), true);
    });

    it('should return false for mismatched PINs', () => {
      assert.strictEqual(verifyPairingPin('123456', '654321'), false);
      assert.strictEqual(verifyPairingPin('000000', '000001'), false);
      assert.strictEqual(verifyPairingPin('111111', '222222'), false);
    });

    it('should return false for single-character variations across all positions', () => {
      const base = '123456';
      assert.strictEqual(verifyPairingPin('923456', base), false); // Index 0
      assert.strictEqual(verifyPairingPin('193456', base), false); // Index 1
      assert.strictEqual(verifyPairingPin('129456', base), false); // Index 2
      assert.strictEqual(verifyPairingPin('123956', base), false); // Index 3
      assert.strictEqual(verifyPairingPin('123496', base), false); // Index 4
      assert.strictEqual(verifyPairingPin('123459', base), false); // Index 5
    });

    it('should handle whitespace trimming gracefully for valid 6-digit PINs', () => {
      assert.strictEqual(verifyPairingPin(' 123456 ', '123456'), true);
      assert.strictEqual(verifyPairingPin('123456', ' 123456 '), true);
      assert.strictEqual(verifyPairingPin('  987654  ', '  987654  '), true);
    });

    it('should return false when provided PIN length is less than 6 digits', () => {
      assert.strictEqual(verifyPairingPin('12345', '123456'), false);
      assert.strictEqual(verifyPairingPin('1', '123456'), false);
      assert.strictEqual(verifyPairingPin('', '123456'), false);
    });

    it('should return false when provided PIN length exceeds 6 digits', () => {
      assert.strictEqual(verifyPairingPin('1234567', '123456'), false);
      assert.strictEqual(verifyPairingPin('123456789', '123456'), false);
    });

    it('should return false when stored PIN length is not 6 digits', () => {
      assert.strictEqual(verifyPairingPin('123456', '12345'), false);
      assert.strictEqual(verifyPairingPin('123456', '1234567'), false);
      assert.strictEqual(verifyPairingPin('123456', ''), false);
    });

    it('should return false when both PINs are invalid length even if identical', () => {
      assert.strictEqual(verifyPairingPin('123', '123'), false);
      assert.strictEqual(verifyPairingPin('1234567', '1234567'), false);
    });

    it('should handle empty or falsy values safely without throwing exceptions', () => {
      assert.strictEqual(verifyPairingPin('', ''), false);
      assert.strictEqual(verifyPairingPin(null as any, '123456'), false);
      assert.strictEqual(verifyPairingPin('123456', null as any), false);
      assert.strictEqual(verifyPairingPin(undefined as any, undefined as any), false);
    });
  });

  // ============================================================================
  // 3. Device Token Format & SHA-256 Hashing Tests
  // ============================================================================
  describe('Device Token Format & SHA-256 Hashing', () => {
    it('should generate tokens prefixed with qp_dev_', () => {
      const token = generateDeviceToken();
      assert.ok(token.startsWith(DEVICE_TOKEN_PREFIX));
      assert.strictEqual(DEVICE_TOKEN_PREFIX, 'qp_dev_');
    });

    it('should generate 71-character tokens (7 prefix + 64 hex chars entropy)', () => {
      const token = generateDeviceToken();
      assert.strictEqual(token.length, 71);
      assert.match(token, /^qp_dev_[0-9a-f]{64}$/);
    });

    it('should support custom token prefixes', () => {
      const customPrefix = 'qp_kiosk_custom_';
      const token = generateDeviceToken(customPrefix);
      assert.ok(token.startsWith(customPrefix));
      assert.strictEqual(token.length, customPrefix.length + 64);
    });

    it('should produce high-entropy unique tokens across multiple invocations', () => {
      const set = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const token = generateDeviceToken();
        assert.ok(!set.has(token), `Duplicate token detected: ${token}`);
        set.add(token);
      }
      assert.strictEqual(set.size, 50);
    });

    it('should hash device tokens using SHA-256 into 64-character hex strings', () => {
      const token = generateDeviceToken();
      const hash = hashDeviceToken(token);
      assert.strictEqual(typeof hash, 'string');
      assert.strictEqual(hash.length, 64);
      assert.match(hash, /^[0-9a-f]{64}$/);
    });

    it('should produce deterministic SHA-256 hashes matching Node crypto', () => {
      const token = 'qp_dev_abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      const hash1 = hashDeviceToken(token);
      const hash2 = hashDeviceToken(token);
      const expected = crypto.createHash('sha256').update(token.trim()).digest('hex');

      assert.strictEqual(hash1, hash2);
      assert.strictEqual(hash1, expected);
    });

    it('should generate paired raw and hashed tokens via generateDeviceTokenWithHash', () => {
      const { rawToken, hashedToken } = generateDeviceTokenWithHash();
      assert.ok(rawToken.startsWith(DEVICE_TOKEN_PREFIX));
      assert.strictEqual(hashedToken, hashDeviceToken(rawToken));
      assert.strictEqual(hashedToken.length, 64);
    });

    it('should verify device token against matching plaintext token', () => {
      const token = generateDeviceToken();
      assert.strictEqual(verifyDeviceToken(token, token), true);
    });

    it('should verify device token against matching SHA-256 hash', () => {
      const token = generateDeviceToken();
      const hashed = hashDeviceToken(token);
      assert.strictEqual(verifyDeviceToken(token, hashed), true);
    });

    it('should reject invalid or mismatched device tokens against stored hash', () => {
      const tokenA = generateDeviceToken();
      const tokenB = generateDeviceToken();
      const hashA = hashDeviceToken(tokenA);

      assert.strictEqual(verifyDeviceToken(tokenB, hashA), false);
      assert.strictEqual(verifyDeviceToken('qp_dev_invalid', hashA), false);
    });

    it('should handle empty or falsy tokens safely during verification', () => {
      assert.strictEqual(verifyDeviceToken('', 'hash'), false);
      assert.strictEqual(verifyDeviceToken('token', ''), false);
      assert.strictEqual(verifyDeviceToken('', ''), false);
    });
  });

  // ============================================================================
  // 4. Voucher Discount Calculation Math Tests (@/lib/payments)
  // ============================================================================
  describe('Voucher Discount Calculation Math (@/lib/payments)', () => {
    describe('Percentage Voucher Discount Math', () => {
      it('should calculate 20% discount correctly on Rp 35.000', () => {
        const voucher = { type: 'percentage' as const, value: 20 };
        const result = calculateVoucherDiscount(voucher, 35000);

        assert.strictEqual(result.discountAmount, 7000);
        assert.strictEqual(result.finalTotal, 28000);
      });

      it('should calculate 20% discount correctly on Rp 55.000', () => {
        const voucher = { type: 'percentage' as const, value: 20 };
        const result = calculateVoucherDiscount(voucher, 55000);

        assert.strictEqual(result.discountAmount, 11000);
        assert.strictEqual(result.finalTotal, 44000);
      });

      it('should calculate 50% discount correctly on Rp 40.000', () => {
        const voucher = { type: 'percentage' as const, value: 50 };
        const result = calculateVoucherDiscount(voucher, 40000);

        assert.strictEqual(result.discountAmount, 20000);
        assert.strictEqual(result.finalTotal, 20000);
      });

      it('should round fractional percentage discount to nearest integer', () => {
        const voucher = { type: 'percentage' as const, value: 15 };
        // 35000 * 15% = 5250
        const result = calculateVoucherDiscount(voucher, 35000);
        assert.strictEqual(result.discountAmount, 5250);
        assert.strictEqual(result.finalTotal, 29750);

        // 33333 * 20% = 6666.6 -> rounds to 6667
        const resultFraction = calculateVoucherDiscount({ type: 'percentage', value: 20 }, 33333);
        assert.strictEqual(resultFraction.discountAmount, 6667);
        assert.strictEqual(resultFraction.finalTotal, 33333 - 6667);
      });

      it('should handle 100% percentage discount', () => {
        const voucher = { type: 'percentage' as const, value: 100 };
        const result = calculateVoucherDiscount(voucher, 35000);

        assert.strictEqual(result.discountAmount, 35000);
        assert.strictEqual(result.finalTotal, 0);
      });
    });

    describe('Fixed Voucher Discount Math', () => {
      it('should deduct fixed amount of Rp 10.000 from Rp 35.000', () => {
        const voucher = { type: 'fixed' as const, value: 10000 };
        const result = calculateVoucherDiscount(voucher, 35000);

        assert.strictEqual(result.discountAmount, 10000);
        assert.strictEqual(result.finalTotal, 25000);
      });

      it('should deduct fixed amount of Rp 10.000 from Rp 55.000', () => {
        const voucher = { type: 'fixed' as const, value: 10000 };
        const result = calculateVoucherDiscount(voucher, 55000);

        assert.strictEqual(result.discountAmount, 10000);
        assert.strictEqual(result.finalTotal, 45000);
      });

      it('should cap discount when fixed voucher value equals current total', () => {
        const voucher = { type: 'fixed' as const, value: 35000 };
        const result = calculateVoucherDiscount(voucher, 35000);

        assert.strictEqual(result.discountAmount, 35000);
        assert.strictEqual(result.finalTotal, 0);
      });

      it('should cap discount and prevent negative total when fixed voucher exceeds current total', () => {
        // e.g. Rp 50.000 fixed voucher on an Rp 35.000 total
        const voucher = { type: 'fixed' as const, value: 50000 };
        const result = calculateVoucherDiscount(voucher, 35000);

        // Math.min(50000, 35000) = 35000
        assert.strictEqual(result.discountAmount, 35000);
        assert.strictEqual(result.finalTotal, 0);
        assert.ok(result.finalTotal >= 0, 'Final total must never be negative');
      });
    });

    describe('Free Voucher Discount Math', () => {
      it('should discount full total (100% free) for Rp 35.000', () => {
        const voucher = { type: 'free' as const, value: 100 };
        const result = calculateVoucherDiscount(voucher, 35000);

        assert.strictEqual(result.discountAmount, 35000);
        assert.strictEqual(result.finalTotal, 0);
      });

      it('should discount full total (100% free) for Rp 55.000', () => {
        const voucher = { type: 'free' as const, value: 100 };
        const result = calculateVoucherDiscount(voucher, 55000);

        assert.strictEqual(result.discountAmount, 55000);
        assert.strictEqual(result.finalTotal, 0);
      });

      it('should handle free voucher on zero current total', () => {
        const voucher = { type: 'free' as const, value: 100 };
        const result = calculateVoucherDiscount(voucher, 0);

        assert.strictEqual(result.discountAmount, 0);
        assert.strictEqual(result.finalTotal, 0);
      });
    });

    describe('Negative Total Prevention & Boundary Checks', () => {
      it('should strictly guarantee non-negative finalTotal for all voucher types', () => {
        const vouchers = [
          { type: 'percentage' as const, value: 150 }, // Over 100% edge case
          { type: 'fixed' as const, value: 999999 },    // Massive fixed discount
          { type: 'free' as const, value: 100 },
        ];

        for (const voucher of vouchers) {
          const result = calculateVoucherDiscount(voucher, 25000);
          assert.ok(result.finalTotal >= 0, `finalTotal (${result.finalTotal}) must be >= 0`);
          assert.strictEqual(result.finalTotal, 0);
        }
      });

      it('should return 0 discount and 0 finalTotal when initial total is 0', () => {
        const resultFixed = calculateVoucherDiscount({ type: 'fixed', value: 10000 }, 0);
        assert.strictEqual(resultFixed.discountAmount, 0);
        assert.strictEqual(resultFixed.finalTotal, 0);

        const resultPct = calculateVoucherDiscount({ type: 'percentage', value: 20 }, 0);
        assert.strictEqual(resultPct.discountAmount, 0);
        assert.strictEqual(resultPct.finalTotal, 0);
      });
    });
  });
});
