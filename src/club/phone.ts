import { parsePhoneNumberFromString, type PhoneNumber } from 'libphonenumber-js/min';

export const PHONE_ERROR = 'Numărul de telefon nu este valid.';

const DEFAULT_COUNTRY = 'RO';

function parseValid(raw: string): PhoneNumber | null {
  const parsed = parsePhoneNumberFromString(raw.trim(), DEFAULT_COUNTRY);
  return parsed?.isValid() ? parsed : null;
}

/** E.164 (`+40722123456`), or null when the text is not a valid number. National numbers read as Romanian. */
export function normalizePhone(raw: string): string | null {
  return parseValid(raw)?.number ?? null;
}

/** `+40 722 123 456`, or the text as typed with `valid: false`. */
export function formatPhone(raw: string): { text: string; valid: boolean } {
  const parsed = parseValid(raw);
  return parsed ? { text: parsed.formatInternational(), valid: true } : { text: raw, valid: false };
}

/** E.164 without the plus, as wa.me links want it. */
export function whatsappDigits(raw: string): string | null {
  return normalizePhone(raw)?.slice(1) ?? null;
}
