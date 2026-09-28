import { VoucherCode, PhotoboothPackage, PaymentDetails } from '@/types/photobooth';
import { INITIAL_VOUCHERS, STAFF_BYPASS_PIN } from '@/lib/constants';

export function validateVoucher(code: string, currentTotal: number): { valid: boolean; discountAmount: number; finalTotal: number; voucher?: VoucherCode; message: string } {
  const cleanCode = code.trim().toUpperCase();
  const voucher = INITIAL_VOUCHERS.find((v) => v.code === cleanCode && v.isActive);

  if (!voucher) {
    return { valid: false, discountAmount: 0, finalTotal: currentTotal, message: 'Invalid or expired voucher code' };
  }

  let discount = 0;
  if (voucher.type === 'free') {
    discount = currentTotal;
  } else if (voucher.type === 'percentage') {
    discount = Math.round((currentTotal * voucher.value) / 100);
  } else if (voucher.type === 'fixed') {
    discount = Math.min(voucher.value, currentTotal);
  }

  const finalTotal = Math.max(0, currentTotal - discount);

  return {
    valid: true,
    discountAmount: discount,
    finalTotal,
    voucher,
    message: `Voucher applied: ${voucher.description}`,
  };
}

export function generateDynamicQRIS(amount: number, transactionId: string): string {
  // Standard EMVCo / QRIS string simulation for Indonesian E-Wallets
  // 000201 (Payload format) 010212 (Point of initiation: Dynamic) ...
  return `00020101021226590014ID.LINKAJA.WWW0118936009110021${transactionId}520458125303360540${amount}5802ID5914QUICKPIC BOOTH6007JAKARTA62070703A016304${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

export function verifyStaffPin(pin: string): boolean {
  return pin === STAFF_BYPASS_PIN;
}
