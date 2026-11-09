import crypto from 'node:crypto';

export const TOTP_STEP_S = 30;
export const TOTP_DIGITS = 6;

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const SECRET_BYTES = 20;

export const newTotpSecret = (): Buffer => crypto.randomBytes(SECRET_BYTES);

/** RFC 4648 base32, no padding. */
export function base32(b: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of b) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return bits > 0 ? out + ALPHABET[(value << (5 - bits)) & 31] : out;
}

/** RFC 4226 HOTP with SHA-1 at counter `step`, truncated to 6 digits. */
export function totpAt(secret: Buffer, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = crypto.createHmac('sha1', secret).update(counter).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const binary = mac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}

const SIX_DIGITS = /^\d{6}$/;

/** The accepted step, or null. Tries step-1, step and step+1 without an early exit; a step at or below `lastStep` is a replay and refused. */
export function checkTotp(secret: Buffer, code: string, now: Date, lastStep: number | null): number | null {
  const typed = code.replace(/\s/g, '');
  if (!SIX_DIGITS.test(typed)) return null;
  const current = Math.floor(now.getTime() / 1000 / TOTP_STEP_S);
  const want = Buffer.from(typed);
  let accepted: number | null = null;
  for (const step of [current - 1, current, current + 1]) {
    const equal = crypto.timingSafeEqual(Buffer.from(totpAt(secret, step)), want);
    if (equal && accepted === null && (lastStep === null || step > lastStep)) accepted = step;
  }
  return accepted;
}

export function otpauthUrl(email: string, secret: Buffer): string {
  const label = encodeURIComponent(email).replace(/%40/g, '@');
  return `otpauth://totp/EduSport:${label}?secret=${base32(secret)}&issuer=EduSport`;
}

export const groupedKey = (secret: Buffer): string => (base32(secret).match(/.{1,4}/g) ?? []).join(' ');
