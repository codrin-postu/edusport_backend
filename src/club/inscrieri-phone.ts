import { whatsappDigits } from './phone';

/** The first message of the WhatsApp / SMS action (user's text, 2026-11-17); placeholders available: {parinte}, {copil}. */
export const WHATSAPP_MESSAGE =
  'Bună ziua! Confirmăm înscrierea la cursurile de patinaj. În următoarele zile veți primi un SMS cu ora/grupa. O zi frumoasă!\n\nȘcoala de Patinaj EduSport';

export const PHONE_COPY = { copied: 'Copiat.', invalid: 'Număr de telefon invalid', copy: 'Copiază', whatsapp: 'WhatsApp', sms: 'SMS', send: 'Trimite mesaj', close: 'Închide' };

type Names = { parinte: string; copil: string };

/** Fills the placeholders of a template with the parent and child names. */
export function fillMessage(template: string, names: Names): string {
  return template.split('{parinte}').join(names.parinte).split('{copil}').join(names.copil);
}

export const whatsappMessage = (names: Names): string => fillMessage(WHATSAPP_MESSAGE, names);

/** whatsapp: app link with the (edited) message (opens the installed app, not the wa.me web page); null when the phone does not parse. */
export function whatsappUrl(raw: string, text: string): string | null {
  const digits = whatsappDigits(raw);
  return digits ? `whatsapp://send?phone=${digits}&text=${encodeURIComponent(text)}` : null;
}

/** sms: link with the (edited) message; null when the phone does not parse. */
export function smsUrl(raw: string, text: string): string | null {
  const digits = whatsappDigits(raw);
  return digits ? `sms:+${digits}?body=${encodeURIComponent(text)}` : null;
}
