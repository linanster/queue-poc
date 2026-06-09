import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Store QR code signing/verification (design.md §2.9).
 *
 * The QR is STATIC: it encodes `/s/{storeId}?sig=HMAC-SHA256(storeId, SECRET)`.
 * The signature only proves the code is an official store code (anti-forgery of
 * storeId). It is NOT a per-scan secret and does NOT prevent repeat take —
 * that is handled by token idempotency + rate limiting (design.md §2.1 / §2.8).
 */
@Injectable()
export class QrSignatureService {
  private readonly secret =
    process.env.STORE_QR_SECRET ?? 'poc-dev-store-qr-secret-change-me';

  sign(storeId: string): string {
    return createHmac('sha256', this.secret).update(storeId).digest('hex');
  }

  verify(storeId: string, signature: string | undefined): boolean {
    if (!signature) return false;
    const expected = this.sign(storeId);
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}
